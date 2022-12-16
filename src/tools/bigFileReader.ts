import fs from "fs";

import Cache from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import {
    MpBigFileDirectoryMetadataTableEntry,
    MpBigFileFileMetadataTableEntry,
    MpBigFileHeader,
    MpBigFileOffsetTableEntry
} from "configs/mappings";
import {
    calculateMappingsLength,
    convertUint8ArrayToString,
    generateByteObjectFromMapping,
    generateByteTableFromMapping
} from "helpers/bytes";
import { exportAsJson, generatePathFromStringStack } from "helpers/files";
import NsBigFile from "types/bigFile";
import NsBytes from "types/bytes";
import NsMappings from "types/mappings";


/**
 * Reads the header of the Big File.
 * @param cache Initialized cache class.
 * @param headerSize The size of the header (defaults to 68 bytes).
 * @returns The formatted header.
 */
function readBigFileHeader(cache: Cache, headerSize = 68) {
    const rawHeader = cache.readBytes(0, headerSize);

    if (convertUint8ArrayToString(rawHeader.slice(0, 3)) !== "BIG") {
        throw new Error("Invalid Big File format");
    }

    const header = generateByteObjectFromMapping(rawHeader, MpBigFileHeader);

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
function readBigFileOffsetTable(
    cache: Cache,
    offsetTableOffset: number,
    offsetTableMaxLength: number
) {
    const mappingLength = calculateMappingsLength(MpBigFileOffsetTableEntry);
    const bytesArrayLength = mappingLength * offsetTableMaxLength;

    const rawOffsetTable = cache.readBytes(offsetTableOffset, bytesArrayLength);

    const offsetTable = generateByteTableFromMapping(
        rawOffsetTable,
        MpBigFileOffsetTableEntry,
        mappingLength,
        false
    );

    return offsetTable;
}

/**
 * Reads the directory metadata table of the Big File.
 * @param cache Initialized cache class.
 * @param mapping The mapping to use to read the table.
 * @param metadataOffset The offset of the directory metadata table.
 * @param numberOfEntries The number of dirs in the directory metadata table.
 * @returns The formatted directory metadata table.
 */
function readBigFileMetadataTable(
    cache: Cache,
    mapping: NsMappings.IsMapping,
    metadataOffset: number,
    numberOfEntries: number
) {
    const mappingLength = calculateMappingsLength(mapping);
    const bytesArrayLength = mappingLength * numberOfEntries;

    const rawMetadataTable = cache.readBytes(metadataOffset, bytesArrayLength);
    const metadataTable = generateByteTableFromMapping(rawMetadataTable,
        mapping,
        mappingLength,
        true
    );

    return metadataTable;
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
function readBigFileFiles(
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
            data = cache.readBytes(dataOffset, dataSize);
            resultArray[i].data = data;
        }
    }

    return resultArray;
}

/**
 * Reads the directory structure of the Big File, linking all the subdirs and files.
 * @param absoluteOutputDirPath The absolute path of the output directory.
 * @param directoryMetadataTable The directory metadata table (used to link data to dirs).
 * @param files The formatted files into an array.
 * @returns The formatted directory structure including all the matching indexes.
 */
function readBigFileStructure(
    absoluteOutputDirPath: string,
    directoryMetadataTable: NsBytes.IsMappingByteObject[],
    files: NsBigFile.IsFile[]
) {
    const structure: NsBigFile.IsDirectory[] = [];
    const pathStacks: string[][] = [];

    for (let i = 0; i < directoryMetadataTable.length; i++) {
        const dir = directoryMetadataTable[i];
        const parentIndex = dir.parentIndex as number;

        // Add the current directory name to the parent path stack.
        // If the parent index is -1, replace it by the absolute path (it's the root dir).
        if (parentIndex === -1) {
            pathStacks[i] = [absoluteOutputDirPath];
        } else {
            pathStacks[i] = [...pathStacks[parentIndex], dir.dirname as string];
        }

        structure[i] = {
            name: dir.dirname as string,
            path: generatePathFromStringStack(pathStacks[i]),
            fileIndexes: []
        };
    }

    // Link all the files to their directories.
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        structure[file.directoryIndex as number].fileIndexes.push(i);
    }

    return structure;
}

/**
 * Extracts the Big File to the output directory.
 * @param structure The directory structure of the Big File (including file indexes per dir).
 * @param files The formatted files into an array.
 */
function extractBigFile(
    structure: NsBigFile.IsDirectory[],
    files: NsBigFile.IsFile[]
) {
    for (let i = 0; i < structure.length; i++) {
        const dir = structure[i];

        // Create the current directory if it doesn't exist.
        if (!fs.existsSync(dir.path)) {
            fs.mkdirSync(dir.path, { recursive: true });
        }

        // Write all the files of the current directory.
        for (let j = 0; j < dir.fileIndexes.length; j++) {
            const fileIndex = dir.fileIndexes[j];
            const file = files[fileIndex];

            const filePath = `${dir.path}/${file.name}`;
            fs.writeFileSync(filePath, file.data as Uint8Array);
        }
    }
}

/**
 * Main function to extract the Big File archive.
 * @param bigFilePath The absolute path to the Big File (sally.bf or sally_clean.bf).
 * @param outputDirPath The absolute path to the output directory.
 * @param exportJSON Whether to export the JSON files of the BigFile data (defaults to false).
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md
 */
export function BigFile(bigFilePath: string, outputDirPath: string, exportJSON = false) {
    if (!fs.existsSync(bigFilePath)) {
        throw new Error(`The Big File doesn't exist: ${bigFilePath}`);
    }

    const cache = new Cache(bigFilePath, CHUNK_SIZE);

    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const header = readBigFileHeader(
        cache
    );

    const offsetTable = readBigFileOffsetTable(
        cache,
        header.data.offsetTableOffset as number,
        header.data.offsetTableMaxLength as number
    );

    const fileMetadataTable = readBigFileMetadataTable(
        cache,
        MpBigFileFileMetadataTableEntry,
        header.data.fileMetadataOffset as number,
        header.data.fileCount as number
    );

    const directoryMetadataTable = readBigFileMetadataTable(
        cache,
        MpBigFileDirectoryMetadataTableEntry,
        header.data.directoryMetadataOffset as number,
        header.data.directoryCount as number
    );

    const files = readBigFileFiles(
        cache,
        offsetTable,
        directoryMetadataTable,
        fileMetadataTable,
        header.data.fileCount as number,
        true
    );

    const structure = readBigFileStructure(
        outputDirPath,
        directoryMetadataTable,
        files
    );

    extractBigFile(
        structure,
        files
    );

    if (exportJSON) {
        exportAsJson(header, outputDirPath, "bigFileHeader.json");
        exportAsJson(offsetTable, outputDirPath, "bigFileOffsetTable.json");
        exportAsJson(fileMetadataTable, outputDirPath, "bigFileFileMetadataTable.json");
        exportAsJson(directoryMetadataTable, outputDirPath, "bigFileDirectoryMetadataTable.json");
        exportAsJson(structure, outputDirPath, "bigFileStructure.json");
    }

    cache.closeFile();
}