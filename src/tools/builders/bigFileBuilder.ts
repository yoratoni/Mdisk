import fs from "fs";
import path from "path";

import { BF_FILE_CONFIG } from "configs/constants";
import { BigFileBuilderChecker } from "helpers/files";
import logger from "helpers/logger";
import NsBigFile from "types/bigFile";
import { concatenateUint8Arrays, convertHexStringToUint8Array, convertNumberToUint8Array, convertStringToUint8Array } from "helpers/bytes";


/**
 * Gets the metadata from the input Big File directory (metadata.json).
 * @param bigFilePath The absolute path to the input Big File directory.
 * @returns The metadata object.
 */
function getMetadata(bigFilePath: string) {
    const metadataJSONPath = path.join(bigFilePath, "metadata.json");

    if (!fs.existsSync(metadataJSONPath)) {
        logger.error(`Invalid Big File directory (file 'metadata.json' missing): ${bigFilePath}`);
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
 * Calculates the number of files and directories in the Big File.
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
 * Generates the Big File header.
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
    // Add the null terminator to the magic bytes
    metadata.header.magic += "\0";

    // Override the number of files and directories in the metadata.
    metadata.header.fileCount = fileCount;
    metadata.header.fileCount2 = fileCount;
    metadata.header.directoryCount = directoryCount;
    metadata.header.directoryCount2 = directoryCount;

    const rawHeader = [
        convertStringToUint8Array(metadata.header.magic, littleEndian),
        convertHexStringToUint8Array(metadata.header.formatVersion, littleEndian),
        convertNumberToUint8Array(metadata.header.fileCount, 4, littleEndian),
        convertNumberToUint8Array(metadata.header.directoryCount, 4, littleEndian),
    ];

    // Get the final Uint8Array header
    const header = concatenateUint8Arrays(rawHeader);

    return header;
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

    const metadata = getMetadata(
        inputDirPath
    );

    const { fileCount, directoryCount } = calculateFileAndDirCounts(
        metadata,
        metadata.includeEmptyDirs
    );

    const header = generateHeader(metadata, fileCount, directoryCount, metadata.littleEndian);

    console.log(header);
}