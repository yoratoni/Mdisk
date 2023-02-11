import NsMappings from "types/mappings";


/*
 * This file is made to map file data with positions in the bytes array.
 * Example: "formatVersion: 4" means that the format version is at the 4th byte.
 *
 * The default length used for each key is 4 bytes, but you can specify a length
 * by using an object instead of a number { position: 20, length: 64 }.
 *
 * The custom object can also contain a "type" key, which can be used to specify
 * the type of the value. The default type is "Uint8Array", "number" converts it to a number
 * and "str" to a string (ISO-8859-1).
 */

/**
 * Mapping for the Big File header.
 */
export const MpBigFileHeader: NsMappings.IsMapping = {
    magic: { position: 0, type: "str" },
    formatVersion: { position: 4, type: "hex" },
    fileCount: { position: 8, type: "number" },
    directoryCount: { position: 12, type: "number" },
    offsetTableMaxLength: { position: 32, type: "number" },
    initialKey: { position: 40, type: "hex" },
    offsetTableOffset: { position: 52, type: "number" }
};

/**
 * Mapping for the Big File offset table entries.
 */
export const MpBigFileOffsetTableEntry: NsMappings.IsMapping = {
    dataOffset: { position: 0, type: "number" },
    key: { position: 4, type: "hex" }
};

/**
 * Mapping for the Big File file metadata table entries.
 */
export const MpBigFileFileMetadataTableEntry: NsMappings.IsMapping = {
    fileSize: { position: 0, type: "number" },
    nextIndex: { position: 4, type: "number" },
    previousIndex: { position: 8, type: "number" },
    directoryIndex: { position: 12, type: "number" },
    unixTimestamp: { position: 16, type: "number" },
    filename: { position: 20, length: 64, type: "str" }
};

/**
 * Mapping for the Big File directory metadata table entries.
 */
export const MpBigFileDirectoryMetadataTableEntry: NsMappings.IsMapping = {
    firstFileIndex: { position: 0, type: "number" },
    firstSubdirIndex: { position: 4, type: "number" },
    nextIndex: { position: 8, type: "number" },
    previousIndex: { position: 12, type: "number" },
    parentIndex: { position: 16, type: "number" },
    dirname: { position: 20, length: 64, type: "str" }
};

/**
 * Mapping for the audio (MS-ADPCM) header (.waa, .wac, .wad, .wam).
 * @link [Making WAVs by Low Byte Productions.](https://www.youtube.com/watch?v=udbA7u1zYfc)
 */
export const MpAudioHeader: NsMappings.IsMapping = {
    headerSize: { position: 0, length: 0 },
    fileID: { position: 0, type: "str" },
    fileSize: { position: 4, type: "number" },
    format: { position: 8, type: "str" },
    fmtBlockID: { position: 12, type: "str" },
    fmtBlockSize: { position: 16, type: "number" },
    codec: { position: 20, length: 2, type: "number" },
    numChannels: { position: 22, length: 2, type: "number" },
    sampleRate: { position: 24, type: "number" },
    byteRate: { position: 28, type: "number" },
    dataBlockAlign: { position: 32, length: 2, type: "number" },
    bitsPerSample: { position: 34, length: 2, type: "number" },
    dataBlockID: { position: 38, type: "str" },
    dataBlockSize: { position: 42, type: "number" }
};

/**
 * Mapping for a Bin File data block header.
 * @link [BIN files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/Bin.md)
 */
export const MpBinFileDataBlockHeader: NsMappings.IsMapping = {
    decompressedSize: { position: 0, type: "number" },
    compressedSize: { position: 4, type: "number" }
};

/**
 * Mapping for a Bin File text group header.
 * @link [BIN Text files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md)
 */
export const MpBinFileTextGroup: NsMappings.IsMapping = {
    groupIdEntrySize: { position: 0, type: "number" }
};

/**
 * Mapping for a Bin File text group ID entry.
 * @link [BIN Text files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md)
 */
export const MpBinFileTextGroupIdEntry: NsMappings.IsMapping = {
    groupID: { position: 0, type: "hex" },
    magic: { position: 4, type: "str" }
};

/**
 * Mapping for a Bin File text group string refs.
 * @link [BIN Text files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md)
 */
export const MpBinFileTextGroupStringRefsSize: NsMappings.IsMapping = {
    groupStringRefsSize: { position: 0, type: "number" }
};

/**
 * Mapping for a Bin File text group string refs.
 * @link [BIN Text files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md)
 */
export const MpBinFileTextGroupStringRefs: NsMappings.IsMapping = {
    textID: { position: 0, type: "hex" },
    magic1: { position: 4, type: "str" },
    stringID: { position: 8, type: "hex" },
    magic2: { position: 12, type: "str" }
};

/**
 * Mapping for a Bin File texture.
 */
export const MpBinFileTexture: NsMappings.IsMapping = {
    unknown1: { position: 0, type: "hex" },
    unknown2: { position: 4, length: 2, type: "hex" },
    textureType: { position: 6, length: 2, type: "number" },
    width: { position: 8, length: 2, type: "number" },
    height: { position: 10, length: 2, type: "number" },
    unknown3: { position: 12, type: "hex" },
    fontID: { position: 16, type: "hex" },
    magic1: { position: 20, type: "hex" },
    magic2: { position: 24, type: "hex" },
    magic3: { position: 28, type: "hex" }
};