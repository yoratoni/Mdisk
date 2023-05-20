# Mdisk (WORK IN PROGRESS)
A tool for the game Beyond Good & Evil.

Note that I'm using Beyond Good & Evil - Steam & GOG - PC (sally_clean.bf),
this tool is compatible with both versions.

Usage
-----
The goal here was to build a tool that can extract and build the game files.
The tool is separated into two main parts: the extraction and the building.

### Extraction
The extraction is done by providing the path to the Big File and the path to the output directory.
Note that the output directory will be created if it does not exist.

The extraction process will create multiple directories and one file:
- `Bin`: Contains the extracted `.bin` files.
- `EngineDatas`: Contains all the other type of files.
- `ExtractedFiles`: Contains the extracted files from the `Bin` & `EngineDatas` directories.
- `metadata.json`: Contains all the information about the files inside the Big File (for building).

**Note that** `ExtractedFiles` **is basically where you will modify the files**.

Inside of `ExtractedFiles`, you'll find a folder named for each extracted file,
once modified, you can rebuild them, it will generate a `build` folder inside of it,
this folder will contain the rebuilt file that will be automatically used to build the Big File.

### Building
The building is done by providing the path to the extracted Big File (directory)
and the path to the output directory where the new Big File will be created.
Note that it verifies that all needed files are present in the extracted Big File.

Basically, all files that are not built inside the `ExtractedFiles` directory will be replaced by the original ones
using the original Big File.

So if there's nothing inside the `ExtractedFiles` directory, the Big File will be the same as the original one,
without the unused directories (the Big File contains a lot of unused dirs..).

**WARNING: NEVER OVERWRITE THE ORIGINAL BIG FILE BY MINE, I PREFER TO SAY IT..**

Extraction / Building Support
-----------------------------
| File    | Description       | Status                      |
|---------|-------------------|-----------------------------|
| `.bf`   | Big File          | **EXTRACTION / BUILDING**   |
| `.bik`  | Video             | **EXTRACTION / BUILDING**   |
| `.wa*`  | Audio             | **EXTRACTION**              |
| `.mtx`  | Trailer videos ?  | **-----------------------** |
| `.bin`  | Binary files      | **WORK IN PROGRESS**        |
| `.wol`  | List for `ff0`    | **-----------------------** |
| `.ofc`  | Binarized actions | **-----------------------** |
| `.oin`  | Binarized actions | **-----------------------** |
| `.ova`  | Binarized actions | **-----------------------** |
| `.omd`  | Binarized actions | **-----------------------** |

Bin extraction / building Support
---------------------------------
| File    | Description        | Status                         |
|---------|--------------------|--------------------------------|
| `fe*`   | Sound headers      | **-----------------------**    |
| `ff4*`  | Sound effects      | **-----------------------**    |
| `fd*`   | Texts              | **EXTRACTION**                 |
| `ff8*`  | Textures           | **-----------------------**    |
| `ff0*`  | Miscellaneous      | **-----------------------**    |

Technical Summary
-----------------
This tool is built with TS-Node and Typescript, I made the whole thing fully scalable by creating
general classes and helper functions. I also added a mapping system between byte positions
and data. The files can be read by chunks instead of a complete loading.

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

Credits
-------
* Most of the information about general parsing comes from [this documentation](https://gitlab.com/Kapouett/bge-formats-doc) made by **Kapouett**.
* Another good source of information comes from [this repository](https://github.com/panzi/bgebf) made by **panzi**.
* There's also this mysterious [quickBMS script](https://zenhax.com/viewtopic.php?t=2478&start=80) wrote by **AnonBaiter**
* Some info [here](https://raymanpc.com/forum/viewtopic.php?t=74804) that helped me to complete the list made by **Kapouett**.
* I'm also using [ChatGPT](https://chat.openai.com/chat) to interpret some file structures.
* I used [this file](https://github.com/vgmstream/vgmstream/blob/master/src/meta/ubi_jade.c) as a reference to extract audio files.
