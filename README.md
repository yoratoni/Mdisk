# Mdisk
A tool for the game Beyond Good & Evil.


Technical Summary
-----------------
This tool is built with TS-Node and Typescript, I made the whole thing fully scalable by creating
general classes and helper functions. I also added a mapping system between byte positions
and data. The files can be read by chunks instead of a complete loading.

The `Pointer` class allows to work with an absolute pointer (position into file),
a chunk pointer (chunk number) and a byte pointer (which corresponds to the position
of the byte into the currently loaded chunk).

The `Cache` class allows to load a file, close it and read bytes while updating the chunk if necessary.

There's also a ton of helper functions that are used to do different stuff such as conversions,
reading N bytes etc.. Most of the values extracted from files are represented as Node's `Uint8Array` / `number[]`.


Support
-------

| File    | Description       | Status                      |
|---------|-------------------|-----------------------------|
| `.bf`   | Big File          | **SUPPORTED**               |
| `.bik`  | Video             | **SUPPORTED**               |
| `.wa*`  | Audio             | **SUPPORTED**               |
| `.mtx`  | Trailer videos ?  | **WORK IN PROGRESS**        |
| `.bin`  | Binary files      | **-----------------------** |
| `.wol`  | Prototypes ?      | **-----------------------** |
| `.ofc`  | Binarized actions | **-----------------------** |
| `.oin`  | Binarized actions | **-----------------------** |
| `.ova`  | Binarized actions | **-----------------------** |
| `.omd`  | Binarized actions | **-----------------------** |


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

Note that `NTSC` data are not compressed, compared to `PAL`, this can be seen inside the
decompressed data size field, if the file size == the decompressed data size (- 2004), it uses `NTSC`.

A `*.mtx` file seems to contain a table that starts  just after the header,
after that, a big padding containing only 0x00 separates the actual data from the table.

Here's a table containing what I found out about the file header:

| Size | Type | `NTSC`      | `PAL`       | Description                              |
|------|------|-------------|-------------|------------------------------------------|
| 4    | str  | 6D 74 78 20 | -- -- -- -- | Magic byte ("mtx ")                      |
| 4    | ?    | 01 10 00 00 | -- -- -- -- | Possibly the format/version              |
| 4    | ?    | 28 10 FF 01 | 28 20 65 02 | Decompressed data size (- 0x07D4)        |
| 4    | ?    | 00 80 1C 00 | 00 18 1D 00 | Padding between table and data           |
| 4    | ?    | 0B D5 BF 01 | F0 0E 23 02 | ?                                        |
| 4    | ?    | 00 C8 00 00 | -- -- -- -- | ?                                        |
| 4    | ?    | 02 00 00 00 | -- -- -- -- | ?                                        |
| 4    | ?    | 00 80 0C 00 | 00 D8 0E 00 | ?                                        |
| 4    | ?    | 00 7D 00 00 | 00 7D 00 00 | Depends on one video no matter the codec |
| 4    | ?    | 00 00 80 3F | -- -- -- -- | Last value of the header                 |


File Format
-----------
Byte order is little endian and the character encoding seems to be ISO-8859-1.
A value of 0xFFFFFFFF for any field denoting an index is a "null pointer". E.g.
the root directory has a parent directory index of 0xFFFFFFFF. (It might actually
be a signed 32bit integer and the value is -1).


Credits
-------
* Most of the information about general parsing comes from [this documentation](https://gitlab.com/Kapouett/bge-formats-doc) made by **Kapouett**.
* Another good source of information comes from [this repository](https://github.com/panzi/bgebf) made by **panzi**.
* There's also this mysterious [quickBMS script](https://zenhax.com/viewtopic.php?t=2478&start=80) wrote by **AnonBaiter**
* Some info [here](https://raymanpc.com/forum/viewtopic.php?t=74804) that helped me to complete the list made by **Kapouett**.
* I'm also using [ChatGPT](https://chat.openai.com/chat) to interpret some file structures.
* I used [this file](https://github.com/vgmstream/vgmstream/blob/master/src/meta/ubi_jade.c) as a reference to extract audio files.
