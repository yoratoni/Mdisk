import NsBytes from "types/bytes";
import NsMappings from "types/mappings";


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
 * Note that this function have a number pass-through.
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The number.
 */
export function convertUint8ArrayToNumber(bytesArray: Uint8Array, littleEndian = true) {
    if (bytesArray[0] === 0) {
        bytesArray = bytesArray.slice(1);
    }

    if (!littleEndian) {
        return bytesArray.reduce((acc, value) => (acc << 8) + value);
    }

    return bytesArray.reverse().reduce((acc, value) => (acc << 8) + value);
}

/**
 * Converts a number to an Uint8Array (limited to 4 bytes).
 * @param number The number.
 * @returns The bytes array.
 */
export function convertNumberToUint8Array(number: number) {
    const bytesArray = new Uint8Array(4);

    for (let i = bytesArray.length - 1; i >= 0; i--) {
        bytesArray[i] = number & 0xff;
        number = number >> 8;
    }

    return bytesArray;
}

/**
 * Reads a number of bytes from a bytes array.
 * Note that this function populates the bytes array with 0 to match the number of bytes.
 * @param bytesArray The bytes array.
 * @param offset The offset to start reading from (defaults to 0).
 * @param numberOfBytes The number of bytes to read (defaults to 4).
 */
export function readNBytesFromBytesArray(bytesArray: Uint8Array, offset = 0, numberOfBytes = 4) {
    const result = new Uint8Array(numberOfBytes);

    result.set(
        bytesArray.slice(offset, offset + numberOfBytes)
    );

    return result;
}

/**
 * Read bytes from a mapping and a bytes array and returns an object based on the mapping.
 * Returns an object containing the data and secondly a boolean indicating if the data is empty.
 * @param bytesArray The bytes array.
 * @param mapping The mapping.
 */
export function generateByteObjectFromMapping(
    bytesArray: Uint8Array,
    mapping: NsMappings.IsMapping
) {
    const resultObject: NsBytes.IsMappingByteObject = {};

    for (const [key, position] of Object.entries(mapping)) {
        resultObject[key] = readNBytesFromBytesArray(bytesArray, position);
    }

    const checkEmptiness = Object.values(resultObject).every(
        byteArray => byteArray.every(byte => byte === 0)
    );

    return {
        data: resultObject,
        isEmpty: checkEmptiness
    };
}


/**
 * Generates a bytes array from a mapping (as a table).
 * The main difference with the generateByteObjectFromMapping function is that
 * this function returns an array of mapped objects instead of a single object.
 * @param bytesArray The bytes array.
 * @param mapping The mapping.
 */
export function generateByteTableFromMapping(
    bytesArray: Uint8Array,
    mapping: NsMappings.IsMapping
) {
    const resultTable: NsBytes.IsMappingByteObject[] = [];
    const mappingLength = Object.keys(mapping).length * 4;
    const bytesLength = bytesArray.length * mappingLength;

    for (let i = 0; i < bytesLength; i += mappingLength) {
        const slicedBytesArray = readNBytesFromBytesArray(bytesArray, i, mappingLength);
        const resultObject = generateByteObjectFromMapping(slicedBytesArray, mapping);

        // If the result object is empty, we can stop the loop
        // as the Offset table is not fully used
        if (resultObject.isEmpty) {
            break;
        }

        resultTable.push(resultObject.data);
    }

    return resultTable;
}