# Mdisk
A tool for the game Beyond Good & Evil.


Technical Summary
-----------------
This tool is build with TS-Node and Typescript, I made the whole fully scalable by creating
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

The header of the file contains the offsets of the .. offsets of the data, linking to an offset table,
this table have a **max** length that can also be found inside of the header (generally **11165**),
this length is not the number of bytes of the table but the number of entries.

Each of these entries contains two data (u32), the offset of the file data and a resource key,
used to quickly identify the file, note that these 11166 "slots" are not all used,
it's the max amount of files that the Big File can contain, certainly allowing the devs to
add files if necessary, without modifying the whole BigFile system.

*More information about the Big File can be found [here](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md).*


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
* I also used [ChatGPT](https://chat.openai.com/chat) to interpret some file structures.