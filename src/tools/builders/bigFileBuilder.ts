import fs from "fs";
import path from "path";

import { GENERAL_CONFIG } from "configs/config";
import { BF_FILE_CONFIG } from "configs/constants";
import { MpBigFileDirectoryMetadataTableEntry, MpBigFileOffsetTableEntry } from "configs/mappings";
import {
    calculateMappingsLength,
    concatenateUint8Arrays,
    convertHexStringToUint8Array,
    convertNumberToUint8Array,
    convertStringToUint8Array,
    convertUint8ArrayToHexString
} from "helpers/bytes";
import { BigFileBuilderChecker } from "helpers/files";
import logger from "helpers/logger";
import NsBigFile from "types/bigFile";


/**
 * Get the list of extracted files.
 * @param inputDirPath The absolute path to the input Big File directory.
 * @returns The list of extracted files.
 */
function getExtractedFiles(inputDirPath: string) {
    const extractedFilesDirPath = path.join(inputDirPath, GENERAL_CONFIG.bigFile.extractedFilesDirName);
    const extractedFiles: string[] = [];

    // Get a list of the directories and files inside (non-recursive)
    if (fs.existsSync(extractedFilesDirPath)) {
        const extractedFileDirents = fs.readdirSync(extractedFilesDirPath, { withFileTypes: true });

        // Convert the Dirent[] to string[]
        for (let i = 0; i < extractedFileDirents.length; i++) {
            extractedFiles[i] = extractedFileDirents[i].name;
        }
    }

    logger.info(`Found ${extractedFiles.length} extracted files.`);

    return extractedFiles;
}

/**
 * Gets the metadata from the input Big File directory (metadata.json).
 * @param inputDirPath The absolute path to the input Big File directory.
 * @returns The metadata object.
 */
function getMetadata(inputDirPath: string) {
    logger.info("Reading metadata..");

    const metadataJSONPath = path.join(inputDirPath, "metadata.json");

    if (!fs.existsSync(metadataJSONPath)) {
        logger.error(`Invalid Big File directory (file 'metadata.json' missing): ${inputDirPath}`);
        process.exit(1);
    }

    try {
        const rawMetadata = fs.readFileSync(metadataJSONPath, "utf8");
        const metadata = JSON.parse(rawMetadata) as NsBigFile.IsMetadata;

        return metadata;
    } catch (err) {
        logger.error("Error while trying to read the 'metadata.json' file");
        process.exit(1);
    }
}

/**
 * Gets a list of all the files used in the Big File, including their data.
 *
 * Note: takes also the extracted files into account and replace the ones from the metadata,
 * it also adds a boolean indicating whether the file is extracted or not (if it needs to be built).
 * @param inputDirPath The absolute path to the input Big File directory.
 * @param extractedFiles The list of extracted files.
 * @param metadata The metadata object.
 */
function getAllFiles(
    inputDirPath: string,
    extractedFiles: string[],
    metadata: NsBigFile.IsMetadata
) {
    logger.info("Getting all files and their data..");

    const { offsets, directories, files, structures } = metadata;
    const allFiles: NsBigFile.IsMetadataCompleteFileData[] = [];

    for (const { index, file } of files.map((file, index) => ({ index, file }))) {
        const offset = offsets[index];
        const directory = directories[file.directoryIndex];
        const structure = structures.filter(structure => structure.fileIndexes.includes(index))[0];
        const isExtracted = extractedFiles.includes(file.filename);
        let filePath: string;

        // Remove all the path from the structure path until it matches "Bin" or "EngineDatas"
        const structurePath = structure.path.split("/");
        const structurePathIndex = structurePath.findIndex(path => path === "Bin" || path === "EngineDatas");
        structurePath.splice(0, structurePathIndex);

        // Get the file path (original from the Big File)
        const originalFilePath = path.join(inputDirPath, ...structurePath, file.filename);

        // If extracted, check if the file is built
        if (isExtracted) {
            const buildPath = path.join(
                inputDirPath,
                GENERAL_CONFIG.bigFile.extractedFilesDirName,
                file.filename,
                GENERAL_CONFIG.bigFile.buildFileDirName,
                file.filename
            );

            // If not, using the original file path instead
            if (!fs.existsSync(buildPath)) {
                logger.warn(`File '${file.filename}' is extracted but not built, using the original file instead..`);

                filePath = originalFilePath;
            } else {
                // If yes, using the built file path
                filePath = buildPath;

                // Replace the file size with the built file size
                file.fileSize = fs.statSync(filePath).size;
            }
        } else {
            filePath = originalFilePath;
        }

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
            logger.error(`Invalid Big File directory (file '${file.filename}' missing): ${inputDirPath}`);
            process.exit(1);
        }

        // Calculating the new data offset
        let previousDataOffset: number;
        let previousFileSize: number;
        let newDataOffset: number;

        // The new data offset is equal to the previous data offset + the previous file size + 4
        // 4 bytes for the file size information
        if (index > 0) {
            previousDataOffset = allFiles[index - 1].dataOffset;
            previousFileSize = allFiles[index - 1].fileSize;
            newDataOffset = previousDataOffset + previousFileSize + 4;
        } else {
            // Otherwise, if it's the first file, the new data offset is the same as the original one
            previousDataOffset = offset.dataOffset;
            previousFileSize = file.fileSize;
            newDataOffset = offset.dataOffset;
        }

        // Generate the complete file data
        const completeFileData: NsBigFile.IsMetadataCompleteFileData = {
            ...file,

            // Offset table
            dataOffset: newDataOffset,
            key: offset.key,

            // Directories
            dirname: directory.dirname,
            filePath: filePath,

            // Is extracted
            isExtracted: isExtracted
        };

        allFiles.push(completeFileData);
    }

    logger.info(`Found ${allFiles.length} file(s).`);

    return allFiles;
}

/**
 * Get the list of all the directories used in the Big File,
 * checking if they are used (includeEmptyDir), if all directories are used, return null.
 * @param metadata The metadata object.
 * @returns The list of all the directories used in the Big File, or null if all directories are used.
 */
function getDirIndexes(metadata: NsBigFile.IsMetadata) {
    if (metadata.includeEmptyDirs) {
        return null;
    }

    logger.info("Getting all directory indexes..");

    const dirIndexes: number[] = [0];  // Include the root directory (index 0)

    for (const { index, directory } of metadata.directories.map((directory, index) => ({ index, directory }))) {
        const structure = metadata.structures[index];

        // If the directory is not used, skip it
        if (structure.fileIndexes.length === 0) {
            continue;
        }

        // Add the directory index
        dirIndexes.push(index);

        // Recursively add all the parent directories if they are not already in the list
        let parentIndex = directory.parentIndex;

        // Stop when the parent index is -1 (root directory)
        while (parentIndex !== -1) {
            const parentDirectory = metadata.directories[parentIndex];

            if (!dirIndexes.includes(parentIndex)) {
                dirIndexes.push(parentIndex);
            }

            parentIndex = parentDirectory.parentIndex;
        }
    }

    // Sort the directory indexes
    const sortedDirIndexes = dirIndexes.sort((a, b) => a - b);

    logger.info(`Found ${sortedDirIndexes.length} directory index(es).`);

    return sortedDirIndexes;
}

/**
 * Generates the Big File header by modifying the raw header directly.
 * @param metadata The metadata object.
 * @param fileCount The number of files in the Big File.
 * @param directoryCount The number of directories in the Big File.
 * @returns The header as Uint8Array.
 */
function generateHeader(
    metadata: NsBigFile.IsMetadata,
    fileCount: number,
    directoryCount: number
) {
    logger.info("Generating the Big File header..");

    // Recover the raw header from the metadata
    const rawHeader = convertHexStringToUint8Array(metadata.rawHeader, metadata.littleEndian);

    if (!metadata.includeEmptyDirs) {
        // Override the number of files and directories in the (formatted) metadata header
        metadata.header.fileCount = fileCount;
        metadata.header.fileCount2 = fileCount;
        metadata.header.directoryCount = directoryCount;
        metadata.header.directoryCount2 = directoryCount;

        // Convert the file and directory counts to hex
        const hexFileCount = convertNumberToUint8Array(fileCount, 4, metadata.littleEndian);
        const hexDirectoryCount = convertNumberToUint8Array(directoryCount, 4, metadata.littleEndian);

        // Replace the file and directory counts in the raw header
        rawHeader.set(hexFileCount, BF_FILE_CONFIG.fileCountOffset);
        rawHeader.set(hexDirectoryCount, BF_FILE_CONFIG.directoryCountOffset);
        rawHeader.set(hexFileCount, BF_FILE_CONFIG.fileCount2Offset);
        rawHeader.set(hexDirectoryCount, BF_FILE_CONFIG.directoryCount2Offset);
    }

    logger.info("Big File header generated.");

    return rawHeader;
}

/**
 * Generates the Big File offset table.
 * @param metadata The metadata object.
 * @param allFiles The list of all files.
 * @returns The offset table as Uint8Array.
 */
function generateOffsetTable(
    metadata: NsBigFile.IsMetadata,
    allFiles: NsBigFile.IsMetadataCompleteFileData[]
) {
    logger.info("Generating the Big File offset table..");

    // Calculate the number of bytes needed per file (based on the mapping)
    const bytesPerFile = calculateMappingsLength(MpBigFileOffsetTableEntry);

    // Generate the offset table array
    const offsetTable = new Uint8Array(metadata.header.offsetTableMaxLength * bytesPerFile);

    for (const { index, file } of allFiles.map((file, index) => ({ index, file }))) {
        const dataOffset = convertNumberToUint8Array(file.dataOffset, 4, metadata.littleEndian);
        const key = convertHexStringToUint8Array(file.key, metadata.littleEndian);

        offsetTable.set(
            [
                ...dataOffset,
                ...key
            ],
            index * bytesPerFile
        );
    }

    logger.info("Big File offset table generated.");

    return offsetTable;
}

/**
 * Generates the Big File directory metadata table.
 * @param metadata The metadata object.
 * @param dirIndexes The list of all directory indexes (null if all used).
 * @returns The offset table as Uint8Array.
 */
function generateDirectoryMetadataTable(
    metadata: NsBigFile.IsMetadata,
    dirIndexes: number[] | null
) {
    logger.info("Generating the Big File directory metadata table..");

    // Get the number of directories
    const dirCount = dirIndexes ? dirIndexes.length : metadata.directories.length;

    // Calculate the number of bytes needed per directory (based on the mapping)
    const bytesPerDirectory = calculateMappingsLength(MpBigFileDirectoryMetadataTableEntry);

    // Generate the directory metadata table array
    const directoryMetadataTable = new Uint8Array(dirCount * bytesPerDirectory);

    // Generate the directory metadata table
    let index = 0;

    while (index < dirCount) {
        // Get the directory index
        const dirIndex = dirIndexes ? dirIndexes[index] : index;

        // Get the directory metadata
        const directory = metadata.directories[dirIndex];

        // Get the directory metadata table entries
        const firstFileIndex = convertNumberToUint8Array(directory.firstFileIndex, 4, metadata.littleEndian);
        const firstSubdirIndex = convertNumberToUint8Array(directory.firstSubdirIndex, 4, metadata.littleEndian);
        const nextIndex = convertNumberToUint8Array(directory.nextIndex, 4, metadata.littleEndian);
        const previousIndex = convertNumberToUint8Array(directory.previousIndex, 4, metadata.littleEndian);
        const parentIndex = convertNumberToUint8Array(directory.parentIndex, 4, metadata.littleEndian);
        const dirname = convertStringToUint8Array(directory.dirname, metadata.littleEndian);

        // Note: dirname is 64 bytes long, so we need to set the converted Uint8Array to this length
        const dirname64 = new Uint8Array(64);
        dirname64.set(dirname, 0);

        directoryMetadataTable.set(
            [
                ...firstFileIndex,
                ...firstSubdirIndex,
                ...nextIndex,
                ...previousIndex,
                ...parentIndex,
                ...dirname64
            ],
            index * bytesPerDirectory
        );

        index++;
    }

    logger.info("Big File directory metadata table generated.");

    return directoryMetadataTable;
}

/**
 * Main function to build the Big File archive.
 * @param inputBigFilePath The absolute path to the input Big File (used to recover original data).
 * @param inputDirPath The absolute path to the input Big File directory.
 * @param outputBigFilePath The absolute path to the output built Big File.
 * @link [Big File doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md)
 */
export default function BigFileBuilder(
    inputBigFilePath: string,
    inputDirPath: string,
    outputBigFilePath: string
) {
    BigFileBuilderChecker(inputDirPath);

    /**
     * Note: The goal here is to recover all the directories
     * from the input/ExtractedFiles directory (name can be different),
     * which are named after the extracted files, so we can build
     * the Big File with these extracted files too.
     *
     * If a file is missing (as a dir name) compared to the metadata, we can assume it's a
     * non-extracted file and we can just skip it and use the original file data.
     *
     * In the case of an extracted file, we verify that it has been built (/build directory),
     * if not, we use the original file data.
     *
     * Data for the non-extracted files are taken from the original Big File directly (a lot faster..).
     */

    const extractedFiles = getExtractedFiles(
        inputDirPath
    );

    const metadata = getMetadata(
        inputDirPath
    );

    const allFiles = getAllFiles(
        inputDirPath,
        extractedFiles,
        metadata
    );

    const dirIndexes = getDirIndexes(
        metadata
    );

    // If all directories are used, use the original directory count
    const header = generateHeader(
        metadata,
        allFiles.length,
        dirIndexes ? dirIndexes.length : metadata.directories.length
    );

    const offsetTable = generateOffsetTable(
        metadata,
        allFiles
    );

    const directoryMetadataTable = generateDirectoryMetadataTable(
        metadata,
        dirIndexes
    );

    console.log(directoryMetadataTable);
}