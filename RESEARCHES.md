# Researches
This file contains all the researches I've done on the game files.

Big File
--------
The Big File stores all the game data, it is similar to a **tar** archive as the data inside are
not compressed.

The whole extraction thing is now fully done, it also exports a `metadata.json` file that contains
all the information about the files inside the Big File to be able to rebuild it.

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
- `*.wol` used to create `ff0` files.

Note about `.wol` files: these are files containing a list of all the `.wow` files used by a level,
it is used as a "header" for the `ff0` files, while also tracking the resources
already imported to not import them twice.

*More information about the Big File can be found [here](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md).*

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

Bin Text Files
--------------
Thanks to **Kapouett**, extracting the strings from the text (subtitles) files was not that hard.

It seems that the text uses a system of keys to show keys/colors on the screen:
| Key                   | Description                             |
|-----------------------|-----------------------------------------|
| \cFFFFFFFF\           | Some hex colors                         |
| \p16\                 | Seems to identify a key to show         |
| \pXX\                 | Certainly refers to an image to show    |
| \aXX\ **\|** d, etc.. | The ID of the image following the \pXX\ |

Here's some examples:
```
Organic matter.Gutter\cff6f6f6f\ (surface mining extraction)\cffffffff\
\p16\? No     Yes \p16\0
- Press \p16\\b24\O to select.
```
These kind of codes are not removed when the texts are extracted, to allow re-building of the files.

Notes:
- My code normally supports all Unicode characters including Korean etc..
- I'm using `>>>` & `<<<` to identify each string group, so don't remove them.

Bin Texture Files
-----------------
I used some of the [Jade Engine](https://github.com/4g3v/JadeStudio/tree/master/JadeStudio.Core/FileFormats/Texture)
source code to understand how the textures could be extracted, so, big thanks to him!

Different types of blocks inside a Texture file:
| Code       | Types               |
|------------|---------------------|
| 0x2        | **BMP**             |
| 0x3        | **JPEG**            |
| 0x4        | **SPRITE_GEN**      |
| 0x5        | **PROCEDURAL**      |
| 0x7        | **PALETTE_LINK**    |
| 0x9        | **ANIMATED**        |
| 0x1001     | **TARGA_1**         |
| 0x2001     | **TARGA_2**         |
| 0x4006     | **PALETTE_8**       |
| 0x5006     | **PALETTE_4**       |
| `FONTDESC` | **FONTDESC**        |

Notes:
- These types can be found at the beginning of the blocks.
- The `PALETTE_LINK` block contains 2 IDs, associating a Pixmap and a palette.
- A palette can be used multiple times (same ID).
- It is not rare to have more palette keys than actual palettes.
- I replaced the `TGA` type (0x1001 & 0x2001) by `TARGA_1` & `TARGA_2`.

Trailer Files
-------------
I suppose, for now, that these files are actually some trailer videos or something like that.
There's only 4 of these files inside the Big File, they all ends with `NTSC` and `PAL`.

The 4 files:
- `MO_NTSC.mtx`
- `MO_pal.mtx`
- `trailerOK_NTSC.mtx`
- `trailerOK_PAL.mtx`

`MO` could be the initials of `Making Of`.

These files can be found inside `01 Texture Bank/Video Library/Trailer BGE`,
so it seems possible that these files could be some video that can be set as textures inside of the game..

Note that `NTSC` data are not compressed, compared to `PAL`, this can be seen inside the
decompressed file size field, if the file size == the decompressed file size (diff of 2004), it uses `NTSC`.

A `*.mtx` file seems to contain one or multiple tables that starts just after the header,
these tables are the same size between `NTSC` & `PAL`.
After that, a big padding containing only 0x00 separates the actual data from the table(s).

Here's a table containing what I found out about the file header (for `MO_NTSC.mtx`):

| Offset | `NTSC`      | Value      | Description             | Same everywhere? |
|--------|-------------|------------|-------------------------|------------------|
| 0      | 6D 74 78 20 | ---------- | Magic ("mtx ")          | **Yes**          |
| 4      | 01 10 00 00 | 4097       | Possibly format/version | **Yes**          |
| 8      | 28 10 FF 01 | 33,493,032 | Decompressed size*      | **No**           |
| 12     | 00 80 1C 00 | 1,867,776  | Padding + block length  | **No**           |
| 16     | 0B D5 BF 01 | 29,349,131 | ? (always < file size)  | **No**           |
| 20     | 00 C8 00 00 | 51,200     | Size of a table         | **Yes**          |
| 24     | 02 00 00 00 | 2          | ?                       | **Yes**          |
| 28     | 00 80 0C 00 | 819,200    | ?                       | **No**           |
| 32     | 00 7D 00 00 | 32,000     | Sample rate / data rate | **MO / trailer** |
| 36     | 00 00 80 3F | ---------- | Last value of header    | **Yes**          |

Decompressed size:
- The decompressed size is equal to the file size - 2004 bytes if the file is in the `NTSC` format.
- In the case of `PAL`, it is compressed.

Here's the table of each block (for `MO_NTSC.mtx`):

| Offset     | Size       | Description            |
|------------|------------|------------------------|
| 0          | 40         | File header            |
| 40         | 51,200     | Table A & data         |
| 51,240     | 51,200     | Table B & data         |
| 102,440    | 1,867,776  | Padding                |
| 1,970,216  | 25,612,288 | Main data ?            |
| 27,582,504 | 51,200     | Table C                |
| 27,633,704 | 51,200     | Table D                |
| 27,684,904 | 1,867,776  | A set of data          |
| 29,552,680 | 51,200     | Table E (0x0C & empty) |
| 29,603,880 | 51,200     | Table F (0x0C & empty) |
| 29,655,080 | 1,867,776  | A set of data          |
| 31,522,856 | 51,200     | Table G (0x0C & empty) |
| 31,574,056 | 51,200     | Table H (0x0C & empty) |
| 31,625,256 | 1,867,776  | A set of data          |
| 33,493,032 | 2,004      | Padding                |

About the last data set, it's a bit .. complicated, it is actually not 1,867,776 bytes long
but 1,332,496 bytes long, with 537,284 `0x00` bytes, so 1,869,780 bytes long in total,
when 2004 is removed from this result (value obtained when I compare the size of the file with the size
inside the header), we also obtain 1,867,776 bytes long which corresponds to the size of one block.