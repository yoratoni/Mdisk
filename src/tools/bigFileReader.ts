import { Cache } from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import {
    MpBigFileDirectoryMetadataTableEntry,
    MpBigFileFileMetadataTableEntry,
    MpBigFileHeader,
    MpBigFileOffsetTableEntry
} from "configs/mappings";
import {
    calculateMappingsLength,
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
    const offsetTableOffset = header.data.offsetTableOffset as number;
    const offsetTableMaxLength = header.data.offsetTableMaxLength as number;

    // The file metadata table offset can be found after the offset table:
    // fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8.
    header.data.fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8;

    // The directory metadata table can be found after the file metadata table:
    // directoryMetadataOffset = fileMetadataOffset + offsetTableMaxLength * 84
    header.data.directoryMetadataOffset = header.data.fileMetadataOffset + offsetTableMaxLength * 84;

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
    offsetTableOffset: number,
    offsetTableMaxLength: number
) {
    const mappingLength = calculateMappingsLength(MpBigFileOffsetTableEntry);
    const bytesArrayLength = mappingLength * offsetTableMaxLength;

    const rawOffsetTable = cache.readNBytes(offsetTableOffset, bytesArrayLength);
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
 * @param numberOfFiles The number of files in the file metadata table.
 * @returns The formatted file metadata table.
 */
export function readBigFileFileMetadataTable(
    cache: Cache,
    fileMetadataOffset: number,
    numberOfFiles: number
) {
    const mappingLength = calculateMappingsLength(MpBigFileFileMetadataTableEntry);
    const bytesArrayLength = mappingLength * numberOfFiles;

    const rawFileMetadataTable = cache.readNBytes(fileMetadataOffset, bytesArrayLength);
    const fileMetadataTable = generateByteTableFromMapping(
        rawFileMetadataTable,
        MpBigFileFileMetadataTableEntry,
        mappingLength,
        true
    );

    return fileMetadataTable;
}

/**
 * Reads the directory metadata table of the Big File.
 * @param cache Initialized cache class.
 * @param directoryMetadataOffset The offset of the directory metadata table.
 * @param numberOfDirectories The number of dirs in the directory metadata table.
 * @returns The formatted directory metadata table.
 */
export function readBigFileDirectoryMetadataTable(
    cache: Cache,
    directoryMetadataOffset: number,
    numberOfDirectories: number
) {
    const mappingLength = calculateMappingsLength(MpBigFileDirectoryMetadataTableEntry);
    const bytesArrayLength = mappingLength * numberOfDirectories;

    const rawDirectoryMetadataTable = cache.readNBytes(directoryMetadataOffset, bytesArrayLength);
    const directoryMetadataTable = generateByteTableFromMapping(
        rawDirectoryMetadataTable,
        MpBigFileDirectoryMetadataTableEntry,
        mappingLength,
        true
    );

    return directoryMetadataTable;
}

/**
 * Reads the file data table of the Big File and links it to the file metadata,
 * creating an array containing the complete file data.
 * Note that this function formats all the fields into readable values.
 * @param cache Initialized cache class.
 * @param offsetTable The offset table (used to get the file data offsets).
 * @param directoryMetadataTable The directory metadata table (used to link data to dirs).
 * @param fileMetadataTable The file metadata table (used to link data to metadata).
 * @param numberOfFiles The number of files in the file metadata table (max = offsetTable.length).
 * @param includeData Whether to include the file data in the result (defaults to false).
 * @returns The formatted files into an array.
 */
export function readBigFileFiles(
    cache: Cache,
    offsetTable: NsBytes.IsMappingByteObject[],
    directoryMetadataTable: NsBytes.IsMappingByteObject[],
    fileMetadataTable: NsBytes.IsMappingByteObject[],
    numberOfFiles: number,
    includeData = false
) {
    const resultArray: NsBigFile.IsFile[] = [];

    if (numberOfFiles > offsetTable.length) {
        numberOfFiles = offsetTable.length;
    }

    for (let i = 0; i < numberOfFiles; i++) {
        const tbOffset = offsetTable[i];
        const tbFileMetadata = fileMetadataTable[i];

        // Skip the first 4 bytes of the file data (representing the file size)
        const dataOffset = tbOffset.dataOffset as number + 4;
        const dataSize = tbFileMetadata.fileSize as number;

        const dirName = directoryMetadataTable[tbFileMetadata.directoryIndex as number].dirname;

        resultArray[i] = {
            name: tbFileMetadata.filename as string,
            key: tbOffset.key as string,
            offset: dataOffset,
            size: dataSize,
            nextIndex: tbFileMetadata.nextIndex as number,
            previousIndex: tbFileMetadata.previousIndex as number,
            directoryName: dirName as string,
            directoryIndex: tbFileMetadata.directoryIndex as number,
            unixTimestamp: tbFileMetadata.unixTimestamp as number,
        };

        let data: Uint8Array | undefined;
        if (includeData) {
            data = cache.readNBytes(dataOffset, dataSize);
            resultArray[i].data = data;
        }
    }

    return resultArray;
}

export function readBigFileStructure(
    directoryMetadataTable: NsBytes.IsMappingByteObject[],
    files: NsBigFile.IsFile[]
) {
    const resultArray: NsBigFile.IsDirectory[] = [];

    for (let i = 0; i < directoryMetadataTable.length; i++) {

        

        resultArray[i] = {
            name: directoryMetadataTable[i].dirname as string,
            subdirIndexes: [],
            fileIndexes: []
        };
    }
}

/**
 * Main function to read the Big File.
 * @param relativePath The relative path to the Big File.
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md
 */
export function readBigFile(relativePath: string) {
    const cache = new Cache(relativePath, CHUNK_SIZE);

    const header = readBigFileHeader(cache);

    // exportAsJson(header, "bigFileHeader.json");

    const offsetTable = readBigFileOffsetTable(
        cache,
        header.data.offsetTableOffset as number,
        header.data.offsetTableMaxLength as number
    );

    // exportAsJson(offsetTable, "bigFileOffsetTable.json");

    const fileMetadataTable = readBigFileFileMetadataTable(
        cache,
        header.data.fileMetadataOffset as number,
        header.data.fileCount as number
    );

    // exportAsJson(fileMetadataTable, "bigFileFileMetadataTable.json");

    const directoryMetadataTable = readBigFileDirectoryMetadataTable(
        cache,
        header.data.directoryMetadataOffset as number,
        header.data.directoryCount as number
    );

    // exportAsJson(directoryMetadataTable, "bigFileDirectoryMetadataTable.json");

    const files = readBigFileFiles(
        cache,
        offsetTable,
        directoryMetadataTable,
        fileMetadataTable,
        header.data.fileCount as number,
        false
    );

    const structure = readBigFileStructure(
        directoryMetadataTable,
        files
    );

    console.log(structure);

    // exportAsJson(files, "bigFileFiles.json");

    cache.closeFile();
}