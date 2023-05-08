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
    generateByteObjectFromMapping,
    generateByteTableFromMapping
} from "helpers/bytes";
import { exportAsJson, extractorChecker, generatePathFromStringStack } from "helpers/files";
import logger from "helpers/logger";
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
    logger.info("Reading Big File header..");

    const rawHeader = cache.readBytes(0, headerSize);
    const header = generateByteObjectFromMapping(rawHeader, MpBigFileHeader);

    // Verify the magic string
    if (header.data.magic !== "BIG") {
        logger.error("Invalid Big File file format (magic).");
        process.exit(1);
    }

    // Converts to numbers before operation
    const offsetTableOffset = header.data.offsetTableOffset as number;
    const offsetTableMaxLength = header.data.offsetTableMaxLength as number;

    logger.verbose(`Offset table offset: ${offsetTableOffset.toLocaleString("en-US")}`);
    logger.verbose(`Offset table max length: ${offsetTableMaxLength.toLocaleString("en-US")}`);

    // The file metadata table offset can be found after the offset table:
    // fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8.
    header.data.fileMetadataOffset = offsetTableOffset + offsetTableMaxLength * 8;

    logger.verbose(`File metadata offset: ${header.data.fileMetadataOffset.toLocaleString("en-US")}`);

    // The directory metadata table can be found after the file metadata table:
    // directoryMetadataOffset = fileMetadataOffset + offsetTableMaxLength * 84
    header.data.directoryMetadataOffset = header.data.fileMetadataOffset + offsetTableMaxLength * 84;

    logger.verbose(`Directory metadata offset: ${header.data.directoryMetadataOffset.toLocaleString("en-US")}`);

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
    logger.info("Reading Big File offset table..");

    const mappingLength = calculateMappingsLength(MpBigFileOffsetTableEntry);
    const bytesArrayLength = mappingLength * offsetTableMaxLength;

    logger.verbose(`Offset table mapping length: ${mappingLength.toLocaleString("en-US")}`);

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
 * Reads a metadata table of the Big File.
 *
 * Note that the mapping values should all follow each other in the table
 * as the mapping length is calculated from each key of the mapping.
 *
 * @param cache Initialized cache class.
 * @param mapping The mapping to use to read the table.
 * @param metadataOffset The offset of the directory metadata table.
 * @param numberOfEntries The number of dirs in the directory metadata table.
 * @param type The type of the metadata table (used for logging) ("directories" | "files").
 * @returns The formatted directory metadata table.
 */
function readBigFileMetadataTable(
    cache: Cache,
    mapping: NsMappings.IsMapping,
    metadataOffset: number,
    numberOfEntries: number,
    type: "directories" | "files"
) {
    logger.info(`Reading Big File ${type} metadata table..`);

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
 *
 * Note that this function formats all the fields into readable values.
 *
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
    if (includeData) {
        logger.info("Reading Big File files and their data..");
    }

    const resultArray: NsBigFile.IsFile[] = [];

    if (numberOfFiles > offsetTable.length) {
        if (includeData) {
            logger.warn("The number of files is greater than the offset table length, ceiling it.");
        }

        numberOfFiles = offsetTable.length;
    }

    if (includeData) {
        logger.verbose(`Number of files to read: ${numberOfFiles.toLocaleString("en-US")}`);
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
    logger.info("Reading Big File structure..");

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

    // Link all the file indexes to their directories.
    logger.info("Linking file indexes to directories..");

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
 * @param includeEmptyDirs Whether to include empty directories in the output (defaults to false).
 */
function extractBigFile(
    structure: NsBigFile.IsDirectory[],
    files: NsBigFile.IsFile[],
    includeEmptyDirs = false
) {
    logger.info("Extracting Big File..");

    const counters = {
        existingDirs: 0,
        dirs: 0,
        files: 0
    };

    for (let i = 0; i < structure.length; i++) {
        const dir = structure[i];

        const includeDir = includeEmptyDirs || dir.fileIndexes.length > 0;
        const dirExists = fs.existsSync(dir.path);

        if (dirExists) {
            counters.existingDirs++;
        }

        // Create the current directory if it doesn't exist.
        if (includeDir && !dirExists) {
            fs.mkdirSync(dir.path, { recursive: true });

            counters.dirs++;
        }

        // Write all the files of the current directory.
        for (let j = 0; j < dir.fileIndexes.length; j++) {
            const fileIndex = dir.fileIndexes[j];
            const file = files[fileIndex];

            const filePath = `${dir.path}/${file.name}`;

            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, file.data as Uint8Array);

                counters.files++;
            }
        }
    }

    if (counters.existingDirs > 0) {
        logger.warn(`Skipped ${counters.existingDirs.toLocaleString("en-US")} existing directories.`);
    }

    if (!includeEmptyDirs && counters.dirs > 0) {
        logger.warn(`Removed ${structure.length - counters.dirs} empty directories.`);
    }

    logger.info(
        `Extracted ${counters.dirs.toLocaleString("en-US")} directories` +
        ` and ${counters.files.toLocaleString("en-US")} files..`
    );
}

function createMetadataFile() {
    //
}

/**
 * Main function to extract the Big File archive.
 * @param bigFilePath The absolute path to the Big File (sally.bf or sally_clean.bf).
 * @param outputDirPath The absolute path to the output directory.
 * @param includeEmptyDirs Whether to include empty directories in the output (defaults to false).
 * @link [Big File doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md)
 */
export default function BigFileExtractor(
    bigFilePath: string,
    outputDirPath: string,
    includeEmptyDirs = false
) {
    extractorChecker(bigFilePath, "Big File", ".bf", outputDirPath);

    // Loading the cache
    const cache = new Cache(bigFilePath, CHUNK_SIZE);

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
        header.data.fileCount as number,
        "files"
    );

    const directoryMetadataTable = readBigFileMetadataTable(
        cache,
        MpBigFileDirectoryMetadataTableEntry,
        header.data.directoryMetadataOffset as number,
        header.data.directoryCount as number,
        "directories"
    );

    // Used for JSON export
    const fileMetadata = readBigFileFiles(
        cache,
        offsetTable,
        directoryMetadataTable,
        fileMetadataTable,
        header.data.fileCount as number,
        false
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
        files,
    );

    extractBigFile(
        structure,
        files,
        includeEmptyDirs
    );

    logger.info("Creating Metadata JSON file..");
    const metadata = createMetadataFile(
        // TODO
    );

    logger.info("Exporting Metadata JSON file..");

    exportAsJson(metadata, outputDirPath, "metadata.json");

    logger.info("Big File extracted successfully!");

    cache.closeFile();
}