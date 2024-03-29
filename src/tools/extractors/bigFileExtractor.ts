import fs from "fs";

import Cache from "classes/cache";
import { BF_FILE_CONFIG, CHUNK_SIZE, VERSION_DIFFS } from "configs/constants";
import {
    MpBigFileDirectoryMetadataTableEntry,
    MpBigFileFileMetadataTableEntry,
    MpBigFileHeader,
    MpBigFileOffsetTableEntry
} from "configs/mappings";
import {
    calculateMappingsLength,
    convertUint8ArrayToHexString,
    generateBytesObjectFromMapping,
    generateBytesTableFromMapping
} from "helpers/bytes";
import { exportAsJson, extractorChecker, generatePathFromStringStack, getFileName } from "helpers/files";
import logger from "helpers/logger";
import NsBigFile from "types/bigFile";
import NsBytes from "types/bytes";
import NsMappings from "types/mappings";


/**
 * Parse and format the header of the Big File.
 * @param rawHeader The raw header (as Uint8Array).
 * @param littleEndian Whether to use little endian or not.
 * @returns The formatted header.
 */
function parseHeader(rawHeader: Uint8Array, littleEndian: boolean) {
    logger.info("Reading Big File header..");

    const header = generateBytesObjectFromMapping(rawHeader, MpBigFileHeader, true, littleEndian);

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
 * @param littleEndian Whether to use little endian or not.
 * @returns The formatted offset table.
 */
function readOffsetTable(
    cache: Cache,
    offsetTableOffset: number,
    offsetTableMaxLength: number,
    littleEndian: boolean
) {
    logger.info("Reading Big File offset table..");

    const mappingLength = calculateMappingsLength(MpBigFileOffsetTableEntry);
    const bytesArrayLength = mappingLength * offsetTableMaxLength;

    logger.verbose(`Offset table mapping length: ${mappingLength.toLocaleString("en-US")}`);

    const rawOffsetTable = cache.readBytes(offsetTableOffset, bytesArrayLength);

    const offsetTable = generateBytesTableFromMapping(
        rawOffsetTable,
        MpBigFileOffsetTableEntry,
        mappingLength,
        false,
        littleEndian
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
 * @param littleEndian Whether to use little endian or not.
 * @param type The type of the metadata table (used for logging) ("directories" | "files").
 * @returns The formatted directory metadata table.
 */
function readMetadataTable(
    cache: Cache,
    mapping: NsMappings.IsMapping,
    metadataOffset: number,
    numberOfEntries: number,
    littleEndian: boolean,
    type: "directory" | "file"
) {
    logger.info(`Reading Big File ${type} metadata table..`);

    const mappingLength = calculateMappingsLength(mapping);
    const bytesArrayLength = mappingLength * numberOfEntries;

    const rawMetadataTable = cache.readBytes(metadataOffset, bytesArrayLength);
    const metadataTable = generateBytesTableFromMapping(
        rawMetadataTable,
        mapping,
        mappingLength,
        true,
        littleEndian
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
 * @param fileMetadataTable The file metadata table (used to link data to metadata).
 * @param directoryMetadataTable The directory metadata table (used to link data to dirs).
 * @param numberOfFiles The number of files in the file metadata table (max = offsetTable.length).
 * @returns The formatted files into an array.
 */
function readFiles(
    cache: Cache,
    offsetTable: NsBytes.IsMappingByteObject[],
    fileMetadataTable: NsBytes.IsMappingByteObject[],
    directoryMetadataTable: NsBytes.IsMappingByteObject[],
    numberOfFiles: number
) {
    logger.info("Reading Big File data..");

    const resultArray: NsBigFile.IsFile[] = [];

    if (numberOfFiles > offsetTable.length) {
        logger.warn("The number of files is greater than the offset table length, ceiling it.");

        numberOfFiles = offsetTable.length;
    }

    logger.verbose(`Number of files to read: ${numberOfFiles.toLocaleString("en-US")}`);

    if (numberOfFiles == VERSION_DIFFS.pc_gog_files) {
        logger.warn("Detected PC [GOG version]");
    } else if (numberOfFiles == VERSION_DIFFS.pc_steam_files) {
        logger.warn("Detected PC [Steam version]");
    }

    for (let i = 0; i < numberOfFiles; i++) {
        const tbOffset = offsetTable[i];
        const tbFileMetadata = fileMetadataTable[i];

        // Skip the first 4 bytes of the file data (representing the file size)
        const dataOffset = tbOffset.dataOffset as number + 4;
        const dataSize = tbFileMetadata.fileSize as number;

        const dirname = directoryMetadataTable[tbFileMetadata.directoryIndex as number].dirname;

        resultArray[i] = {
            name: tbFileMetadata.filename as string,
            key: tbOffset.key as string,
            offset: dataOffset,
            size: dataSize,
            nextIndex: tbFileMetadata.nextIndex as number,
            previousIndex: tbFileMetadata.previousIndex as number,
            directoryName: dirname as string,
            directoryIndex: tbFileMetadata.directoryIndex as number,
            unixTimestamp: tbFileMetadata.unixTimestamp as number,
            data: cache.readBytes(dataOffset, dataSize)
        };
    }

    return resultArray;
}

/**
 * Reads the directory structures of the Big File, linking all the subdirs and files.
 * @param absoluteOutputDirPath The absolute path of the output directory.
 * @param directoryMetadataTable The directory metadata table (used to link data to dirs).
 * @param files The formatted files into an array.
 * @returns The formatted directory structures including all the matching indexes.
 */
function readStructure(
    absoluteOutputDirPath: string,
    directoryMetadataTable: NsBytes.IsMappingByteObject[],
    files: NsBigFile.IsFile[]
) {
    logger.info("Reading Big File structures..");

    const structures: NsBigFile.IsFormattedDirectory[] = [];
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

        structures[i] = {
            name: dir.dirname as string,
            path: generatePathFromStringStack(pathStacks[i]),
            fileIndexes: []
        };
    }

    // Link all the file indexes to their directories.
    logger.info("Linking file indexes to directories..");

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        structures[file.directoryIndex as number].fileIndexes.push(i);
    }

    return structures;
}

/**
 * Extracts the Big File to the output directory.
 * @param structures The directory structures of the Big File (including file indexes per dir).
 * @param files The formatted files into an array.
 * @param includeEmptyDirs Whether to include empty directories in the output (defaults to false).
 */
function extractBigFile(
    structures: NsBigFile.IsFormattedDirectory[],
    files: NsBigFile.IsFile[],
    includeEmptyDirs = false
) {
    logger.info("Extracting Big File..");

    const counters = {
        existingDirs: 0,
        files: 0
    };

    for (let i = 0; i < structures.length; i++) {
        const dir = structures[i];

        const includeDir = includeEmptyDirs || dir.fileIndexes.length > 0;
        const dirExists = fs.existsSync(dir.path);

        if (dirExists) {
            counters.existingDirs++;
        }

        // Create the current directory if it doesn't exist.
        if (includeDir && !dirExists) {
            fs.mkdirSync(dir.path, { recursive: true });
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
        const name = counters.existingDirs === 1 ? "directory" : "directories";
        logger.warn(`Skipped ${counters.existingDirs.toLocaleString("en-US")} existing ${name}.`);
    }

    if (!includeEmptyDirs) {
        logger.warn("Removed empty directories.");
    }

    logger.info(`Extracted ${counters.files.toLocaleString("en-US")} files..`);
}

/**
 * Creates the metadata object from the header and the tables.
 * @param includeEmptyDirs Whether to include empty directories in the output.
 * @param littleEndian Whether the Big File is little endian.
 * @param rawHeader The raw header bytes.
 * @param header The header object.
 * @param offsetTable The offset table.
 * @param fileMetadataTable The file metadata table.
 * @param directoryMetadataTable The directory metadata table.
 * @param structures The directory structures of the Big File (including file indexes per dir).
 * @returns The metadata object.
 */
function createMetadata(
    includeEmptyDirs: boolean,
    littleEndian: boolean,
    rawHeader: Uint8Array,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
    offsetTable: NsBytes.IsMappingByteObject[],
    fileMetadataTable: NsBytes.IsMappingByteObject[],
    directoryMetadataTable: NsBytes.IsMappingByteObject[],
    structures: NsBigFile.IsFormattedDirectory[]
) {
    const metadata = {
        includeEmptyDirs: includeEmptyDirs,
        littleEndian: littleEndian,
        rawHeader: convertUint8ArrayToHexString(rawHeader, littleEndian, false, false),
        header: {
            ...header.data
        },
        offsets: offsetTable,
        directories: directoryMetadataTable,
        files: fileMetadataTable,
        structures: structures
    };

    return metadata as unknown as NsBigFile.IsMetadata;
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
    littleEndian = true,
    includeEmptyDirs = false
) {
    extractorChecker(bigFilePath, "Big File", ".bf", outputDirPath, true);

    // Loading the cache
    const cache = new Cache(bigFilePath, CHUNK_SIZE);

    // Get the raw header
    const rawHeader = cache.readBytes(0, BF_FILE_CONFIG.headerLength);

    const header = parseHeader(
        rawHeader,
        littleEndian
    );

    const offsetTable = readOffsetTable(
        cache,
        header.data.offsetTableOffset as number,
        header.data.offsetTableMaxLength as number,
        littleEndian
    );

    const fileMetadataTable = readMetadataTable(
        cache,
        MpBigFileFileMetadataTableEntry,
        header.data.fileMetadataOffset as number,
        header.data.fileCount as number,
        littleEndian,
        "file"
    );

    const directoryMetadataTable = readMetadataTable(
        cache,
        MpBigFileDirectoryMetadataTableEntry,
        header.data.directoryMetadataOffset as number,
        header.data.directoryCount as number,
        littleEndian,
        "directory"
    );

    const files = readFiles(
        cache,
        offsetTable,
        fileMetadataTable,
        directoryMetadataTable,
        header.data.fileCount as number
    );

    const structures = readStructure(
        outputDirPath,
        directoryMetadataTable,
        files,
    );

    extractBigFile(
        structures,
        files,
        includeEmptyDirs
    );

    logger.info("Creating Metadata JSON file..");

    const metadata = createMetadata(
        includeEmptyDirs,
        littleEndian,
        rawHeader,
        header,
        offsetTable,
        fileMetadataTable,
        directoryMetadataTable,
        structures
    );

    logger.info("Exporting Metadata JSON file..");

    exportAsJson(metadata, outputDirPath, "metadata.json", true);

    logger.info(`Successfully extracted the Big File: '${getFileName(bigFilePath)}' => '${outputDirPath}'.`);

    // Closing the file from the cache
    cache.closeFile();
}