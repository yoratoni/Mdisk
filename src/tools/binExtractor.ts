import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { BIN_FILE_TYPES } from "configs/constants";
import { getFileName } from "helpers/files";


/**
 * Get the type of the bin file.
 * @param binFilePath The absolute path to the bin file.
 * @returns The type of the bin file.
 */
function getBinType(binFilePath: string) {
    const filename = getFileName(binFilePath);
    const fileLetters = filename.slice(0, 2);
    const fileNumber = filename[2];

    if (fileLetters === "ff") {
        const filePrefix = fileLetters + fileNumber;

        if (filePrefix in BIN_FILE_TYPES) {
            return BIN_FILE_TYPES[filePrefix];
        }

        return BIN_FILE_TYPES["unknown"];
    }

    return BIN_FILE_TYPES[fileLetters];
}

/**
 * Main function for reading/extracting bin files.
 * @param binFilePath The absolute path to the bin file.
 * @param outputDirPath The absolute path to the output directory.
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/Bin.md
 */
export default function BinExtractor(binFilePath: string, outputDirPath: string) {
    const fileType = getBinType(binFilePath);

    console.log(fileType);
}