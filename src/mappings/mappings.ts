import NsMappings from "types/mappings";


/*
 * This file is made to map file data with positions in the bytes array.
 * Example: "formatVersion: 4" means that the format version is at the 4th byte.
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