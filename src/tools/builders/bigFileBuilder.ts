import fs from "fs";
import path from "path";

import { BigFileBuilderChecker } from "helpers/files";
import logger from "helpers/logger";
import NsBigFile from "types/bigFile";


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
 * Main function to build the Big File archive.
 * @param inputDirPath The absolute path to the input Big File directory.
 * @param bigFilePath The absolute path to the output Big File.
 * @param includeEmptyDirs Whether to include empty directories in the output (defaults to false).
 * @link [Big File doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/BigFile.md)
 */
export default function BigFileBuilder(
    inputDirPath: string,
    bigFilePath: string,
    includeEmptyDirs = false
) {
    BigFileBuilderChecker(inputDirPath);

    const metadata = getMetadata(
        inputDirPath
    );

    console.log(metadata.header);
}