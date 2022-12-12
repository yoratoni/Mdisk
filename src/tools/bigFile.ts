import { Cache } from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import {
    convertNumberToUint8Array,
    convertUint8ArrayToNumber,
    generateByteObjectFromMapping,
    generateByteTableFromMapping
} from "helpers/bytes";
import { MpBigFileHeader, MpBigFileOffsetTableEntry } from "mappings/mappings";
// import NsBigFile from "types/BigFile";


/**
 * Reads the header of the Big File.
 * @param headerSize The size of the header (defaults to 68 bytes).
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md
 */
export function readBigFileHeader(cache: Cache, headerSize = 68) {
    const rawHeader = cache.readNBytes(0, headerSize);
    const header = generateByteObjectFromMapping(rawHeader, MpBigFileHeader);

    // Converts to numbers before operation
    const offsetTableOffset = convertUint8ArrayToNumber(header.offsetTableOffset);
    const offsetTableMaxLength = convertUint8ArrayToNumber(header.offsetTableMaxLength);

    // The file metadata table offset can be found after the offset table:
    // fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8.
    const fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8;

    // The directory metadata table can be found after the file metadata table:
    // directoryMetadataOffset = fileMetadataOffset + offsetTableMaxLength * 84
    const directoryMetadataOffset = fileMetadataOffset + offsetTableMaxLength * 84;

    // Values are then converted back to Uint8Array
    header.fileMetadataOffset = convertNumberToUint8Array(fileMetadataOffset);
    header.directoryMetadataOffset = convertNumberToUint8Array(directoryMetadataOffset);

    return header;
}

export function readBigFileOffsetTable(
    cache: Cache,
    offsetTableOffset: Uint8Array,
    offsetTableMaxLength: Uint8Array
) {
    const offset = convertUint8ArrayToNumber(offsetTableOffset, false);
    const maxLength = convertUint8ArrayToNumber(offsetTableMaxLength, false);

    const rawOffsetTable = cache.readNBytes(offset, maxLength);
    const offsetTable = generateByteTableFromMapping(rawOffsetTable, MpBigFileOffsetTableEntry);

    return offsetTable;
}

/**
 * Main function to read the Big File.
 * @param relativePath The relative path to the Big File.
 */
export function readBigFile(relativePath: string) {
    const cache = new Cache(relativePath, CHUNK_SIZE);

    const header = readBigFileHeader(cache);

    console.log(header);

    const offsetTable = readBigFileOffsetTable(cache, header.offsetTableOffset, header.offsetTableMaxLength);

    console.log(offsetTable[offsetTable.length - 6]);

    cache.closeFile();
}