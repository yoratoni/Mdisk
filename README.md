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

Mappings
--------
As said, the mappings are made to link a byte position to a data into a file,
as an example: here's the mapping for the `BigFile` header:

```typescript
export const MpBigFileHeader: NsMappings.IsMapping = {
    formatVersion: 4,
    fileCount: 8,
    directoryCount: 12,
    offsetTableMaxLength: 32,
    initialKey: 40,
    offsetTableOffset: 52
};
```
Which returns this object:
```typescript
formatVersion:            [  34,   0,  0,   0 ],
fileCount:                [  21,  39,  0,   0 ],
directoryCount:           [  15,  43,  0,   0 ],
offsetTableMaxLength:     [   0,   0, 43, 158 ],
initialKey:               [ 249,  63,  0, 113 ],
offsetTableOffset:        [   0,   0,  0,  68 ],
fileMetadataOffset:       [  52,  93,  1,   0 ],
directoryMetadataOffset:  [  12, 173, 15,   0 ]
```

File Format
-----------
Byte order is little endian and the character encoding seems to be ISO-8859-1.
A value of 0xFFFFFFFF for any field denoting an index is a "null pointer". E.g.
the root directory has a parent directory index of 0xFFFFFFFF. (It might actually
be a signed 32bit integer and the value is -1.)


Credits
-------
* Most of the information about general parsing comes from this [documentation](https://gitlab.com/Kapouett/bge-formats-doc) made by **Kapouett**.
* Another good source of information comes from [this repository](https://github.com/panzi/bgebf) made by **panzi**.
