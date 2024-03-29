# Mdisk (WORK IN PROGRESS)
A tool for the game Beyond Good & Evil.

Note that I'm using Beyond Good & Evil - Steam & GOG - PC (sally_clean.bf),
this tool is compatible with both versions.

Technical Summary
-----------------
You can find all the researches I've done on game files [here](https://github.com/yoratoni/Mdisk/blob/main/RESEARCHES.md).

I'm trying to not use any library to decompress/compress the files as I'm also using this project to improve my skills, I'm only using `lzo` for the Bin files and `iconv-lite` for String <=> Uint8Array conversions as I'm using a lot of different string encodings.

Notes:
- Implemented a file reading system with chunks.
- Mostly using Uint8Arrays for hex data.
- Helper functions for bytes, files & numbers.
- Complete BMP export implementation.
- Classes for pointers & cache.

I'm using the implemented BMP generation to preview data from files such as `mtx` trailers or texture Bin files, in the goal of reverse engineering them.

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

Credits
-------
* Most of the information about general parsing comes from [this documentation](https://gitlab.com/Kapouett/bge-formats-doc) made by **Kapouett**.
* Another good source of information comes from [this repository](https://github.com/panzi/bgebf) made by **panzi**.
* There's also this mysterious [quickBMS script](https://zenhax.com/viewtopic.php?t=2478&start=80) wrote by **AnonBaiter**
* Some info [here](https://raymanpc.com/forum/viewtopic.php?t=74804) that helped me to complete the list made by **Kapouett**.
* I'm also using [ChatGPT](https://chat.openai.com/chat) to interpret some file structures.
* I used [this file](https://github.com/vgmstream/vgmstream/blob/master/src/meta/ubi_jade.c) as a reference to extract audio files.
