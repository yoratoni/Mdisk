import fs from "fs";
import path from "path";

import logger from "helpers/logger";


/**
 * Returns the absolute path based on the relative path
 * @param relativePath The relative path to the file.
 * @returns The absolute path to the file.
 */
export function getAbsolutePath(relativePath: string): string {
    const projectRoot = path.resolve(__dirname);
    const absolutePath = path.dirname(projectRoot ?? "").replace(/\\/g, "/") + `/${relativePath}`;

    if (!fs.existsSync(absolutePath)) {
        logger.error(`${absolutePath} does not exist, please check the path.`);
        process.exit(1);
    }

    return absolutePath;
}

/**
 * Returns the name of the file.
 * @param filePath The path to the file.
 * @param includeExtension Whether to include the extension.
 * @returns The name of the file.
 */
export function getFileName(filePath: string, includeExtension = true): string {
    const fileName = path.basename(filePath);

    if (includeExtension) {
        return fileName;
    }

    return fileName.split(".")[0];
}

/**
 * Checks if a file has a specific extension.
 * @param filePath The path to the file.
 * @param extension The extension to check.
 * @returns Whether the file has the extension.
 */
export function checkFileExtension(filePath: string, extension: string | string[]): boolean {
    const fileExtension = path.extname(filePath);

    if (Array.isArray(extension)) {
        return extension.includes(fileExtension);
    } else {
        return fileExtension === extension;
    }
}

/**
 * Generates a path from a string stack.
 * @param pathStack The path stack.
 * @returns The path.
 */
export function generatePathFromStringStack(pathStack: string[]): string {
    return pathStack.join("/");
}

/**
 * Exports any data as a JSON file.
 * @param data The data to export.
 * @param absolutePath The absolute path to the file.
 * @param fileName The name of the file.
 * @param force Whether to force the export.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportAsJson(data: any, absolutePath: string, fileName: string, force = false) {
    const path = absolutePath + `/${fileName}`;

    if (!fs.existsSync(path) || force) {
        if (force) {
            logger.warn(`Overwriting '${fileName}'..`);
        }

        const dataString = JSON.stringify(data, null, 4);

        if (dataString === undefined) {
            logger.error("Could not stringify data");
            process.exit(1);
        }

        fs.writeFileSync(path, dataString);
    } else {
        logger.warn(`'${fileName}' already exists, skipping export.`);
    }
}

/**
 * Returns the size of the sally file in bytes.
 * @param absolutePath The path to the file.
 * @returns The size of the file in bytes.
 */
export function getFileSize(absolutePath: string): number {
    const fileStats = fs.statSync(absolutePath);

    return fileStats.size;
}

/**
 * Opens a file for binary reading.
 * @param absolutePath The absolute path to the file.
 * @returns The file descriptor.
 */
export function openFile(absolutePath: string): number {
    const file = fs.openSync(absolutePath, "r");

    return file;
}

/**
 * Closes a file.
 * @param file The file descriptor.
 */
export function closeFile(file: number): void {
    fs.closeSync(file);
}

/**
 * Reads a chunk of the binary file.
 * @param file The file descriptor.
 * @param fileSize The size of the file.
 * @param buffer The buffer to read the file into.
 * @param chunkNumber The number of the chunk.
 * @param chunkSize The size of the chunk in bytes.
 * @returns The buffer chunk of the file.
 */
export function readFileByChunk(
    file: number,
    fileSize: number,
    buffer: Uint8Array,
    chunkNumber: number,
    chunkSize: number
): Uint8Array {
    if (buffer.length !== chunkSize) {
        buffer = new Uint8Array(chunkSize);
    }

    const position = chunkNumber * chunkSize;

    if (position >= fileSize) {
        return new Uint8Array(0);
    }

    fs.readSync(file, buffer, 0, chunkSize, position);

    return buffer;
}

/**
 * Checks if an extracted Big File folder is valid for building.
 * @param inputDirPath The path to the input Big File directory.
 */
export function BigFileBuilderChecker(
    inputDirPath: string
) {
    logger.info("Beginning Big File build process..");

    if (!fs.existsSync(inputDirPath)) {
        logger.error(`Invalid Big File directory path: ${inputDirPath}`);
        process.exit(1);
    }

    // Check if the Bin folder exists
    if (!fs.existsSync(`${inputDirPath}/Bin`)) {
        logger.error(`Invalid Big File directory (directory 'Bin' missing): ${inputDirPath}`);
        process.exit(1);
    }

    // Check if the EngineData folder exists
    if (!fs.existsSync(`${inputDirPath}/EngineDatas`)) {
        logger.error(`Invalid Big File directory (directory 'EngineDatas' missing): ${inputDirPath}`);
        process.exit(1);
    }

    // Checks if the "metadata.json" file exists
    if (!fs.existsSync(`${inputDirPath}/metadata.json`)) {
        logger.error(`Invalid Big File directory (file 'metadata.json' missing): ${inputDirPath}`);
        process.exit(1);
    }
}

/**
 * Checks if a file path is valid and if the output directory exists,
 * if not, creates the output directory recursively.
 *
 * In the case of the file path, it also checks if the file extension is valid.
 * In either case, if the check fails, the process exits with code 1.
 * @param filePath The path to the file.
 * @param fileType The type of the file (ex: "Big File", "bin file", etc..).
 * @param requiredFileExtension The required file extension(s) (ex: ".bf", [".waa", ".wac"], etc..).
 * @param outputDirPath The path to the output directory.
 */
export function extractorChecker(
    filePath: string,
    fileType: string,
    requiredFileExtension: string | string[],
    outputDirPath: string
) {
    logger.info(`Beginning '${getFileName(filePath)}' extraction process..`);

    if (!fs.existsSync(filePath)) {
        logger.error(`Invalid ${fileType} path: ${filePath}`);
        process.exit(1);
    }

    if (!fs.existsSync(outputDirPath)) {
        logger.info(`Creating output directory: ${outputDirPath}`);
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    if (!checkFileExtension(filePath, requiredFileExtension)) {
        logger.error(`Invalid ${fileType} extension: ${filePath}`);
        process.exit(1);
    }
}