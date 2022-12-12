import { Cache } from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import {
    convertNumberToUint8Array,
    convertUint8ArrayToNumber,
    readNBytesFromBytesArray
} from "helpers/bytes";
import NS_BigFile from "types/BigFile";


/**
 * Reads the header of the Big File.
 * @param headerSize The size of the header (defaults to 68 bytes).
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md
 */
export function readBigFileHeader(cache: Cache, headerSize = 68) {
    const header: NS_BigFile.IsBigFileHeader = {
        formatVersion: null,
        fileCount: null,
        directoryCount: null,
        offsetTableMaxLength: null,
        initialKey: null,
        offsetTableOffset: null,
        fileMetadataOffset: null,
        directoryMetadataOffset: null
    };

    const rawHeader = cache.readNBytes(0, headerSize);

    header.formatVersion = readNBytesFromBytesArray(rawHeader, 4);
    header.fileCount = readNBytesFromBytesArray(rawHeader, 8);
    header.directoryCount = readNBytesFromBytesArray(rawHeader, 12);
    header.offsetTableMaxLength = readNBytesFromBytesArray(rawHeader, 32);
    header.initialKey = readNBytesFromBytesArray(rawHeader, 40);
    header.offsetTableOffset = readNBytesFromBytesArray(rawHeader, 52);

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

/**
 * Main function to read the Big File.
 * @param relativePath The relative path to the Big File.
 */
export function readBigFile(relativePath: string) {
    const cache = new Cache(relativePath, CHUNK_SIZE);

    const header = readBigFileHeader(cache);

    console.log(header);

    cache.closeFile();
}