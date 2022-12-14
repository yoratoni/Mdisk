import { Cache } from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import {
    MpBigFileDirectoryMetadataTableEntry,
    MpBigFileFileData,
    MpBigFileFileMetadataTableEntry,
    MpBigFileHeader,
    MpBigFileOffsetTableEntry
} from "configs/mappings";
import {
    calculateMappingsLength,
    convertNumberToUint8Array,
    convertUint8ArrayToHexString,
    convertUint8ArrayToNumber,
    convertUint8ArrayToString,
    generateByteObjectFromMapping,
    generateByteTableFromMapping
} from "helpers/bytes";
import { exportAsJson } from "helpers/files";
import NsBigFile from "types/bigFile";
import NsBytes from "types/bytes";


/**
 * Reads the header of the Big File.
 * @param cache Initialized cache class.
 * @param headerSize The size of the header (defaults to 68 bytes).
 * @returns The formatted header.
 */
export function readBigFileHeader(cache: Cache, headerSize = 68) {
    const rawHeader = cache.readNBytes(0, headerSize);
    const header = generateByteObjectFromMapping(rawHeader, MpBigFileHeader, true);

    // Converts to numbers before operation
    const offsetTableOffset = convertUint8ArrayToNumber(header.data.offsetTableOffset);
    const offsetTableMaxLength = convertUint8ArrayToNumber(header.data.offsetTableMaxLength);

    // The file metadata table offset can be found after the offset table:
    // fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8.
    const fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8;

    // The directory metadata table can be found after the file metadata table:
    // directoryMetadataOffset = fileMetadataOffset + offsetTableMaxLength * 84
    const directoryMetadataOffset = fileMetadataOffset + offsetTableMaxLength * 84;

    // Values are then converted back to Uint8Array
    header.data.fileMetadataOffset = convertNumberToUint8Array(fileMetadataOffset);
    header.data.directoryMetadataOffset = convertNumberToUint8Array(directoryMetadataOffset);

    return header;
}

/**
 * Reads the offset table of the Big File.
 * @param cache Initialized cache class.
 * @param offsetTableOffset The offset of the offset table.
 * @param offsetTableMaxLength The max number of entries in the offset table.
 * @returns The formatted offset table.
 */
export function readBigFileOffsetTable(
    cache: Cache,
    offsetTableOffset: Uint8Array,
    offsetTableMaxLength: Uint8Array
) {
    const offset = convertUint8ArrayToNumber(offsetTableOffset, false);
    const entryCount = convertUint8ArrayToNumber(offsetTableMaxLength, false);

    const mappingLength = calculateMappingsLength(MpBigFileOffsetTableEntry);
    const bytesArrayLength = mappingLength * entryCount;

    const rawOffsetTable = cache.readNBytes(offset, bytesArrayLength);
    const offsetTable = generateByteTableFromMapping(
        rawOffsetTable,
        MpBigFileOffsetTableEntry,
        mappingLength,
        false
    );

    return offsetTable;
}

/**
 * Reads the file metadata table of the Big File.
 * @param cache Initialized cache class.
 * @param fileMetadataOffset The offset of the file metadata table.
 * @param fileCount The number of files in the file metadata table.
 * @returns The formatted file metadata table.
 */
export function readBigFileFileMetadataTable(
    cache: Cache,
    fileMetadataOffset: Uint8Array,
    fileCount: number
) {
    const offset = convertUint8ArrayToNumber(fileMetadataOffset, false);

    const mappingLength = calculateMappingsLength(MpBigFileFileMetadataTableEntry);
    const bytesArrayLength = mappingLength * fileCount;

    const rawFileMetadataTable = cache.readNBytes(offset, bytesArrayLength);
    const fileMetadataTable = generateByteTableFromMapping(
        rawFileMetadataTable,
        MpBigFileFileMetadataTableEntry,
        mappingLength,
        true
    );

    fileMetadataTable.forEach((entry) => {
        entry.strFilename = convertUint8ArrayToString(entry.filename);
    });

    return fileMetadataTable;
}

/**
 * Reads the directory metadata table of the Big File.
 * @param cache Initialized cache class.
 * @param directoryMetadataOffset The offset of the directory metadata table.
 * @param dirCount The number of dirs in the directory metadata table.
 * @returns The formatted directory metadata table.
 */
export function readBigFileDirectoryMetadataTable(
    cache: Cache,
    directoryMetadataOffset: Uint8Array,
    dirCount: number
) {
    const offset = convertUint8ArrayToNumber(directoryMetadataOffset, false);

    const mappingLength = calculateMappingsLength(MpBigFileDirectoryMetadataTableEntry);
    const bytesArrayLength = mappingLength * dirCount;

    const rawDirectoryMetadataTable = cache.readNBytes(offset, bytesArrayLength);
    const directoryMetadataTable = generateByteTableFromMapping(
        rawDirectoryMetadataTable,
        MpBigFileDirectoryMetadataTableEntry,
        mappingLength,
        true
    );

    directoryMetadataTable.forEach((entry) => {
        entry.strDirname = convertUint8ArrayToString(entry.dirname);
    });

    return directoryMetadataTable;
}

/**
 * Reads the file data table of the Big File and links it to the file metadata,
 * creating an array containing the complete file data.
 * Note that this function formats all the fields into readable values.
 * @param offsetTable The offset table (used to get the file data offsets).
 * @param directoryMetadataTable The directory metadata table (used to link data to dirs).
 * @param fileMetadataTable The file metadata table (used to link data to metadata).
 * @param numberOfFiles The number of files in the file metadata table (max = offsetTable.length).
 * @returns The formatted files into an array.
 */
export function readBigFileFiles(
    offsetTable: NsBytes.IsMappingByteObject[],
    directoryMetadataTable: NsBytes.IsMappingByteObject[],
    fileMetadataTable: NsBytes.IsMappingByteObject[],
    numberOfFiles: number
) {
    const resultArray: NsBigFile.IsFile[] = [];

    if (numberOfFiles > offsetTable.length) {
        numberOfFiles = offsetTable.length;
    }

    for (let i = 0; i < numberOfFiles; i++) {
        const tbOffset = offsetTable[i];
        const tbMetadata = fileMetadataTable[i];

        const dirIndex = convertUint8ArrayToNumber(tbMetadata.directoryIndex);
        const offset = convertUint8ArrayToNumber(tbOffset.dataOffset);
        const length = convertUint8ArrayToNumber(tbMetadata.fileSize);

        // const dirName = directoryMetadataTable[dirIndex].strDirname;
        const dirName = "A";

        if (tbMetadata.strFilename && dirName) {
            resultArray[i] = {
                name: tbMetadata.strFilename,
                key: convertUint8ArrayToHexString(tbOffset.key, true, false),
                offset: offset + 4,
                size: length,
                index: i,
                nextIndex: convertUint8ArrayToNumber(tbMetadata.nextIndex),
                previousIndex: convertUint8ArrayToNumber(tbMetadata.previousIndex),
                directoryName: dirName,
                directoryIndex: dirIndex,
                unixTimestamp: convertUint8ArrayToNumber(tbMetadata.unixTimestamp)
            };
        }
    }

    return resultArray;
}

/**
 * Main function to read the Big File.
 * @param relativePath The relative path to the Big File.
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md
 */
export function readBigFile(relativePath: string) {
    const cache = new Cache(relativePath, CHUNK_SIZE);

    const header = readBigFileHeader(cache);

    const offsetTable = readBigFileOffsetTable(
        cache,
        header.data.offsetTableOffset,
        header.data.offsetTableMaxLength
    );

    const fileMetadataTable = readBigFileFileMetadataTable(
        cache,
        header.data.fileMetadataOffset,
        offsetTable.length
    );

    const directoryMetadataTable = readBigFileDirectoryMetadataTable(
        cache,
        header.data.directoryMetadataOffset,
        offsetTable.length
    );

    const files = readBigFileFiles(
        offsetTable,
        directoryMetadataTable,
        fileMetadataTable,
        1
    );

    console.log(directoryMetadataTable.length);
    console.log(files);
    // exportAsJson(files, "bigFile.json");

    cache.closeFile();
}