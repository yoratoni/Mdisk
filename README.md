# Mdisk
A tool for the game Beyond Good & Evil.


Technical Summary
-----------------
This tool is build with TS-Node and Typescript, I made the whole thing fully scalable by creating
general classes and helper functions. I also added a mapping system between byte positions
and data. The files can be read by chunks instead of a complete loading.

The `Pointer` class allows to work with an absolute pointer (position into file),
a chunk pointer (chunk number) and a byte pointer (which corresponds to the position
of the byte into the currently loaded chunk).

The `Cache` class allows to load a file, close it and read bytes while updating the chunk if necessary.

There's also a ton of helper functions that are used to do different stuff such as conversions,
reading N bytes etc.. Most of the values extracted from files are represented as Typescript's `Uint8Array`.


Big File
--------
The Big File stores all the game data, it is similar to a **tar** archive as the data inside are
uncompressed.

The whole extraction thing is now fully done, I also added the option to also export some JSON
files are the root the extracted directory:

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
- `*.wol` are useless prototypes made during development.


Audio File
----------
It took much more time than I thought, but now, `.wa*` audio files can be decoded and decompressed, I used [VgmStream](https://github.com/vgmstream/vgmstream) to extract a test file and compare the data with my own program (yeah, I decided to not use any external lib).
So, the goal was to convert from a custom `ADPCM` format to `PCM`, it is, of course, fully written in Typescript.


File Format
-----------
Byte order is little endian and the character encoding seems to be ISO-8859-1.
A value of 0xFFFFFFFF for any field denoting an index is a "null pointer". E.g.
the root directory has a parent directory index of 0xFFFFFFFF. (It might actually
be a signed 32bit integer and the value is -1).


Credits
-------
* Most of the information about general parsing comes from this [documentation](https://gitlab.com/Kapouett/bge-formats-doc) made by **Kapouett**.
* Another good source of information comes from [this repository](https://github.com/panzi/bgebf) made by **panzi**.
* There's also this mysterious [quickBMS script](https://zenhax.com/viewtopic.php?t=2478&start=80) wrote by **AnonBaiter**
* Some info [here](https://raymanpc.com/forum/viewtopic.php?t=74804) that helped me to complete the list made by **Kapouett**.
* I'm also using [ChatGPT](https://chat.openai.com/chat) to interpret some file structures.
* I used [this file](https://github.com/vgmstream/vgmstream/blob/master/src/meta/ubi_jade.c) as a reference to extract audio files.
