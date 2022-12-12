/**
 * Converts bytes to megabytes for the file operations.
 * @param megaBytes The number of megabytes.
 * @returns The number of bytes.
 */
export function convertMegaBytesToBytes(megaBytes: number) {
    return megaBytes * 1024 * 1024;
}

/**
 * Converts an Uint8Array to a number.
 * @param bytesArray The bytes array.
 * @returns The number.
 */
export function convertUint8ArrayToNumber(bytesArray: Uint8Array) {
    return bytesArray.reverse().reduce((acc, value) => (acc << 8) + value);
}

/**
 * Converts a number to an Uint8Array (limited to 4 bytes).
 * @param number The number.
 * @returns The bytes array.
 */
export function convertNumberToUint8Array(number: number) {
    const bytesArray = new Uint8Array(4);

    for (let i = 0; i < 4; i++) {
        bytesArray[i] = number & 0xff;
        number = number >> 8;
    }

    return bytesArray;
}

/**
 * Reads a number of bytes from a bytes array.
 * @param bytesArray The bytes array.
 * @param offset The offset to start reading from (defaults to 0).
 * @param numberOfBytes The number of bytes to read (defaults to 4).
 */
export function readNBytesFromBytesArray(bytesArray: Uint8Array, offset = 0, numberOfBytes = 4) {
    return bytesArray.slice(offset, offset + numberOfBytes);
}