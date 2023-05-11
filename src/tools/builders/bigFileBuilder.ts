import fs from "fs";
import path from "path";

import { GENERAL_CONFIG } from "configs/config";
import { BF_FILE_CONFIG } from "configs/constants";
import {
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

    // Get a list of the directories and files inside (non-recursive)
    const extractedFileDirents = fs.readdirSync(extractedFilesDirPath, { withFileTypes: true });

    const extractedFiles: string[] = [];

    // Convert the Dirent[] to string[]
    for (let i = 0; i < extractedFileDirents.length; i++) {
        extractedFiles[i] = extractedFileDirents[i].name;
    }

    return extractedFiles;
}


/**
 * Gets the metadata from the input Big File directory (metadata.json).
 * @param inputDirPath The absolute path to the input Big File directory.
 * @returns The metadata object.
 */
function getMetadata(inputDirPath: string) {
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
    const { offsets, directories, files, structures } = metadata;

    const allFiles: NsBigFile.IsMetadataCompleteFileData[] = [];

    for (const { index, file } of files.map((file, index) => ({ index, file }))) {
        const offset = offsets[index];
        const directory = directories[file.directoryIndex];
        const structure = structures.filter(structure => structure.fileIndexes.includes(index))[0];
        const isExtracted = extractedFiles.includes(file.filename);

        // Remove all the path from the structure path until it matches "Bin" or "EngineDatas"
        const structurePath = structure.path.split("/");
        const structurePathIndex = structurePath.findIndex(path => path === "Bin" || path === "EngineDatas");
        structurePath.splice(0, structurePathIndex);

        // Generate the path
        let filePath: string;

        if (!isExtracted) {
            filePath = path.join(inputDirPath, ...structurePath, file.filename);
        } else {
            filePath = path.join(inputDirPath, GENERAL_CONFIG.bigFile.extractedFilesDirName, file.filename);
        }

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
            logger.error(`Invalid Big File directory (file '${file.filename}' missing): ${inputDirPath}`);
            process.exit(1);
        }

        // Generate the complete file data
        const completeFileData: NsBigFile.IsMetadataCompleteFileData = {
            ...file,

            // Offset table
            dataOffset: offset.dataOffset,
            key: offset.key,

            // Directories
            dirname: directory.dirname,
            filePath: filePath,

            // Is extracted
            isExtracted: isExtracted
        };

        if (file.filename === "ff802b5b.bin") {
            // console.log(structurePath);
            allFiles.push(completeFileData);
        }
    }

    return allFiles;
}

/**
 * Calculates the number of files and directories in the Big File (Using metadata.structures).
 * @param metadata The metadata object.
 * @param includeEmptyDirs Whether to include empty directories.
 */
function calculateFileAndDirCounts(metadata: NsBigFile.IsMetadata, includeEmptyDirs: boolean) {
    let fileCount = 0;
    let directoryCount = 0;

    for (const structure of metadata.structures) {

        if (!includeEmptyDirs) {
            if (structure.fileIndexes.length > 0) {
                fileCount += structure.fileIndexes.length;
                directoryCount++;
            }
        } else {
            fileCount += structure.fileIndexes.length;
            directoryCount++;
        }
    }

    return {
        fileCount,
        directoryCount
    };
}

/**
 * Generates the Big File header by modifying the raw header directly.
 * @param metadata The metadata object.
 * @param fileCount The number of files in the Big File.
 * @param directoryCount The number of directories in the Big File.
 * @param littleEndian Whether to use little endian.
 * @returns The header as Uint8Array.
 */
function generateHeader(
    metadata: NsBigFile.IsMetadata,
    fileCount: number,
    directoryCount: number,
    littleEndian: boolean
) {
    // Recover the raw header from the metadata
    const rawHeader = convertHexStringToUint8Array(metadata.rawHeader, littleEndian);

    if (!metadata.includeEmptyDirs) {
        // Override the number of files and directories in the (formatted) metadata header
        metadata.header.fileCount = fileCount;
        metadata.header.fileCount2 = fileCount;
        metadata.header.directoryCount = directoryCount;
        metadata.header.directoryCount2 = directoryCount;

        // Convert the file and directory counts to hex
        const hexFileCount = convertNumberToUint8Array(fileCount, 4, littleEndian);
        const hexDirectoryCount = convertNumberToUint8Array(directoryCount, 4, littleEndian);

        // Replace the file and directory counts in the raw header
        rawHeader.set(hexFileCount, BF_FILE_CONFIG.fileCountOffset);
        rawHeader.set(hexDirectoryCount, BF_FILE_CONFIG.directoryCountOffset);
        rawHeader.set(hexFileCount, BF_FILE_CONFIG.fileCount2Offset);
        rawHeader.set(hexDirectoryCount, BF_FILE_CONFIG.directoryCount2Offset);
    }

    return rawHeader;
}

function generateOffsetTable() {
    //
}

/**
 * Main function to build the Big File archive.
 * @param inputDirPath The absolute path to the input Big File directory.
 * @param bigFilePath The absolute path to the output Big File.
 * @link [Big File doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md)
 */
export default function BigFileBuilder(
    inputDirPath: string,
    bigFilePath: string
) {
    BigFileBuilderChecker(inputDirPath);

    /**
     * Note: The goal here is to recover all the directories
     * from the input/ExtractedFiles directory (name can be different),
     * which are named after the extracted files, so we can build
     * the Big File with these extracted files too.
     *
     * If a file is missing (as a dir name) compared to the metadata, we can assume it's a
     * non-extracted file and we can just skip it and use the default file data.
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

    const { fileCount, directoryCount } = calculateFileAndDirCounts(
        metadata,
        metadata.includeEmptyDirs
    );

    const header = generateHeader(
        metadata,
        fileCount,
        directoryCount,
        metadata.littleEndian
    );

    const offsetTable = generateOffsetTable(

    );

    console.log(allFiles);
}