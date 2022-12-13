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

    return absolutePath;
}

/**
 * Exports any data as a JSON file.
 * @param data The data to export.
 * @param fileName The name of the file.
 * @param relativePath The relative path to the file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportAsJson(data: any, fileName: string, relativePath = "exports") {
    const absolutePath = getAbsolutePath(relativePath) + `/${fileName}`;
    const dataString = JSON.stringify(data, null, 4);

    if (dataString === undefined) {
        throw new Error("Could not stringify data");
    }

    fs.writeFileSync(absolutePath, dataString);
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