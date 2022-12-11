/**
 * Converts bytes to megabytes for the file operations.
 * @param megaBytes The number of megabytes.
 * @returns The number of bytes.
 */
export function convertMegaBytesToBytes(megaBytes: number) {
    return megaBytes * 1024 * 1024;
}

/**
 * Reads a number of bytes from a bytes array.
 * @param bytesArray The bytes array.
 * @param offset The offset to start reading from (defaults to 0).
 * @param numberOfBytes The number of bytes to read (defaults to 4).
 */
export function readNBytesFromBytesArray(bytesArray: number[], offset = 0, numberOfBytes = 4) {
    return bytesArray.slice(offset, offset + numberOfBytes);
}