import NsMappings from "types/mappings";


/*
 * This file is made to map file data with positions in the bytes array.
 * Example: "formatVersion: 4" means that the format version is at the 4th byte.
 *
 * The default length used for each key is 4 bytes, but you can specify a length
 * by using an object instead of a number { position: 20, length: 64 }.
 *
 * If the length is 0, it will use the previous key's value.
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


export const MpAudioHeader: NsMappings.IsMapping = {

};