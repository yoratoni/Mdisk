import NsMappings from "types/mappings";


/*
 * This file is made to map file data with positions in the bytes array.
 * Example: "formatVersion: 4" means that the format version is at the 4th byte.
 *
 * The default length used for each key is 4 bytes, but you can specify a length
 * by using an object instead of a number { position: 20, length: 64 }.
 *
 * If the length is 0, it will use the previous key's value.
 */

/**
 * Mapping for the Big File header.
 */
export const MpBigFileHeader: NsMappings.IsMapping = {
    formatVersion: 4,
    fileCount: 8,
    directoryCount: 12,
    offsetTableMaxLength: 32,
    initialKey: 40,
    offsetTableOffset: 52
};

/**
 * Mapping for the Big File offset table entries.
 */
export const MpBigFileOffsetTableEntry: NsMappings.IsMapping = {
    dataOffset: 0,
    key: 4
};

/**
 * Mapping for the Big File file metadata table entries.
 */
export const MpBigFileFileMetadataTableEntry: NsMappings.IsMapping = {
    fileSize: 0,
    nextIndex: 4,
    previousIndex: 8,
    directoryIndex: 12,
    unixTimestamp: 16,
    filename: { position: 20, length: 64 }
};

/**
 * Mapping for the Big File directory metadata table entries.
 */
export const MpBigFileDirectoryMetadataTableEntry: NsMappings.IsMapping = {
    firstFileIndex: 0,
    firstSubdirIndex: 4,
    nextIndex: 8,
    previousIndex: 12,
    parentIndex: 16,
    dirname: { position: 20, length: 64 }
};

/**
 * Mapping for the Big File file data.
 */
export const MpBigFileFileData: NsMappings.IsMapping = {
    fileSize: 0,
    data: { position: 4, length: 0 }
};