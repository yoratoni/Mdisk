import { Cache } from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import { readNBytesFromBytesArray } from "helpers/bytes";
import NS_BigFile from "types/BigFile";


/**
 * Reads the header of the Big File.
 * @param headerSize The size of the header (defaults to 68 bytes).
 */
export function readBigFileHeader(cache: Cache, headerSize = 68) {
    const header: NS_BigFile.IsBigFileHeader = {
        formatVersion: [],
        fileCount: [],
        directoryCount: [],
        offsetTableMaxLength: [],
        initialKey: [],
        offsetTableOffset: [],
        fileMetadataOffset: [],
        directoryMetadataOffset: []
    };

    const rawHeader = cache.readNBytes(0, headerSize);

    header.formatVersion = readNBytesFromBytesArray(rawHeader, 4);
    header.fileCount = readNBytesFromBytesArray(rawHeader, 8);
    header.directoryCount = readNBytesFromBytesArray(rawHeader, 12);
    header.offsetTableMaxLength = readNBytesFromBytesArray(rawHeader, 36);
    header.initialKey = readNBytesFromBytesArray(rawHeader, 44);
    header.offsetTableOffset = readNBytesFromBytesArray(rawHeader, 56);

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