# Mdisk
A tool for the game Beyond Good & Evil.


Technical Summary
-----------------
Note that I'm using Beyond Good & Evil - Steam - PC (sally_clean.bf).

This tool is built with TS-Node and Typescript, I made the whole thing fully scalable by creating
general classes and helper functions. I also added a mapping system between byte positions
and data. The files can be read by chunks instead of a complete loading.


Support
-------
| File    | Description       | Status                      |
|---------|-------------------|-----------------------------|
| `.bf`   | Big File          | **SUPPORTED**               |
| `.bik`  | Video             | **SUPPORTED**               |
| `.wa*`  | Audio             | **SUPPORTED**               |
| `.mtx`  | Trailer videos ?  | **WORK IN PROGRESS**        |
| `.bin`  | Binary files      | **WORK IN PROGRESS**        |
| `.wol`  | Prototypes ?      | **-----------------------** |
| `.ofc`  | Binarized actions | **-----------------------** |
| `.oin`  | Binarized actions | **-----------------------** |
| `.ova`  | Binarized actions | **-----------------------** |
| `.omd`  | Binarized actions | **-----------------------** |


Bin Support
-----------
| File    | Description        | Status                      |
|---------|--------------------|-----------------------------|
| `ff4*`  | Sound effects      | **-----------------------** |
| `fe*`   | Sound headers      | **-----------------------** |
| `fd*`   | Translated strings | **WORK IN PROGRESS**        |
| `ff8*`  | Textures           | **-----------------------** |
| `ff0*`  | Miscellaneous      | **-----------------------** |


Big File
--------
The Big File stores all the game data, it is similar to a **tar** archive as the data inside are
not compressed.

The whole extraction thing is now fully done, I also added the option to export some JSON
files containing some data, inside the root of the extracted directory:

- `bigFileDirectoryMetadataTable` Metadata of each directory.
- `bigFileFileMetadataTable` Metadata of the files.
- `bigFileHeader` The header of the Big File.
- `bigFileOffsetTable` The offset table (useful to get the keys).
- `bigFileStructure` Contains the whole archive structure.

*More information about the Big File can be found [here](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md).*

### Formats of files stored in the Big File

- `*.bin` are a custom format, detailed [here](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/Bin.md).
- `*.waa`, `*.wac`, `*.wad`, `*.wam` are `wav` files (MS-ADPCM).
- `*.waa` are ambient sounds.
- `*.wac` are SFX.
- `*.wad` are dialogs.
- `*.wam` are game musics.
- `*.bik` are Bink videos.
- `*.mtx` seems to be some videos for the trailer (PAL or NTSC).
- `*.omd` ?
- `*.ofc` are binarized functions to perform specific actions.
- `*.oin` ?
- `*.ova` ?
- `*.wol` are prototypes made during development.


Video Files
-----------
These did not require any work, `.bik` files are actually already readable using VLC media player.

Some of these files are actually only used as "frames" or something like that, only a few kiloBytes,
but yeah, you can read them and convert them, so I didn't have that much to do.


Audio Files
-----------
It took much more time than I thought, but now, `.wa*` audio files can be decoded and decompressed,
I used [VgmStream](https://github.com/vgmstream/vgmstream) to extract a test file and compare the data with my own program.

So, the goal was to convert a custom `ADPCM` format to a `PCM` one, it is, of course, fully written in Typescript, without any audio library..

Now, it is common for some game sounds to have looping information, as an example, an ambient sound
will be played in a loop. In BG&E, the fact that the file should be played in a loop is simply described
by the file extension, mostly `.waa` and `.wam`, so I added the looping information for these two file extensions,
but these songs are not looped 100% of the time.

As an example, the song `Cine_M_atterrissage beluga fin.waa` is not really played as a loop, but it's still a `.waa` file,
so, I decided to declare as non-looped all the sounds that have a duration of less than 30 seconds.

Looping information is stored inside the name of the `.wav` file: `beluga_demo_0.00_17.99.wav`.


Trailer Files
-------------
I suppose, for now, that these files are actually some trailer videos or something like that.
There's only 4 of these files inside the Big File, they all ends with `NTSC` and `PAL`.

These files can be found inside `01 Texture Bank/Video Library/Trailer BGE`,
so it seems possible that these files could be some video that can be set as textures inside of the game..

Note that `NTSC` data are not compressed, compared to `PAL`, this can be seen inside the
decompressed file size field, if the file size == the decompressed file size (-2004), it uses `NTSC`.

A `*.mtx` file seems to contain one or multiple tables that starts just after the header,
these tables are the same size between `NTSC` & `PAL`.
After that, a big padding containing only 0x00 separates the actual data from the table(s).

The data seems to be represented as 16 byte long (starting after the header).

The table values seems to generally start with `0x0C`, I suppose that the first byte could be reserved
to indicate the type of block, but note that it's not always the case.
A clue is that the second byte is generally `0x00`.

Here's a table containing what I found out about the file header (for `MO_NTSC.mtx`):

| Offset | `NTSC`      | Value      | Description                              |
|--------|-------------|------------|------------------------------------------|
| 0      | 6D 74 78 20 | ---------- | Magic ("mtx ")                           |
| 4      | 01 10 00 00 | 4097       | Possibly the format/version              |
| 8      | 28 10 FF 01 | 33,493,032 | Decompressed file size (-2004)           |
| 12     | 00 80 1C 00 | 1,867,776  | The size of the padding & one data block |
| 16     | 0B D5 BF 01 | 29,349,131 | ?                                        |
| 20     | 00 C8 00 00 | 51,200     | Size of a table                          |
| 24     | 02 00 00 00 | 2          | ?                                        |
| 28     | 00 80 0C 00 | 819,200    | ?                                        |
| 32     | 00 7D 00 00 | 32,000     | Certainly a sample rate / data rate      |
| 36     | 00 00 80 3F | ---------- | Last value of the header                 |

Here's the table of each block (for `MO_NTSC.mtx`):

| Offset     | Size       | Description                              |
|------------|------------|------------------------------------------|
| 0          | 40         | File header                              |
| 40         | 51,200     | Table A & data                           |
| 51,240     | 51,200     | Table B & data                           |
| 102,440    | 1,867,776  | Padding                                  |
| 1,970,216  | 25,612,288 | Main data ?                              |
| 27,582,504 | 51,200     | Table C                                  |
| 27,633,704 | 51,200     | Table D                                  |
| 27,684,904 | 1,867,776  | A set of data                            |
| 29,552,680 | 51,200     | Table E (0x0C & empty)                   |
| 29,603,880 | 51,200     | Table F (0x0C & empty)                   |
| 29,655,080 | 1,867,776  | A set of data                            |
| 31,522,856 | 51,200     | Table G (0x0C & empty)                   |
| 31,574,056 | 51,200     | Table H (0x0C & empty)                   |
| 31,625,256 | 1,867,776  | A set of data                            |
| 33,493,032 | 2,004      | Padding                                  |

About the last data set, it's a bit .. complicated, it is actually not 1,867,776 bytes long
but 1,332,496 bytes long, with 537,284 `0x00` bytes, so 1,869,780 bytes long in total,
when 2004 is removed from this result (value obtained when I compare the size of the file with the size
inside the header), we also obtain 1,867,776 bytes long which corresponds to the size of one block.


Credits
-------
* Most of the information about general parsing comes from [this documentation](https://gitlab.com/Kapouett/bge-formats-doc) made by **Kapouett**.
* Another good source of information comes from [this repository](https://github.com/panzi/bgebf) made by **panzi**.
* There's also this mysterious [quickBMS script](https://zenhax.com/viewtopic.php?t=2478&start=80) wrote by **AnonBaiter**
* Some info [here](https://raymanpc.com/forum/viewtopic.php?t=74804) that helped me to complete the list made by **Kapouett**.
* I'm also using [ChatGPT](https://chat.openai.com/chat) to interpret some file structures.
* I used [this file](https://github.com/vgmstream/vgmstream/blob/master/src/meta/ubi_jade.c) as a reference to extract audio files.