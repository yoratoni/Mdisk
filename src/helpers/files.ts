import fs from "fs";
import path from "path";


/**
 * Returns the absolute path based on the relative path
 * @param relativePath The relative path to the file.
 * @returns The absolute path to the file.
 */
export function getAbsolutePath(relativePath: string): string {
    const projectRoot = path.resolve(__dirname);
    const absolutePath = path.dirname(projectRoot ?? "").replace(/\\/g,"/") + `/${relativePath}`;

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`${absolutePath} does not exist, please check the path.`);
    }

    return absolutePath;
}

/**
 * Returns the name of the file.
 * @param filePath The path to the file.
 * @returns The name of the file.
 */
export function getFileName(filePath: string): string {
    return path.basename(filePath);
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
 * * @param fileName The name of the file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportAsJson(data: any, absolutePath: string, fileName: string) {
    const path = absolutePath + `/${fileName}`;
    const dataString = JSON.stringify(data, null, 4);

    if (dataString === undefined) {
        throw new Error("Could not stringify data");
    }

    fs.writeFileSync(path, dataString);
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