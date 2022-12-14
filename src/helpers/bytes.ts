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
 * Converts an Uint8Array to a string.
 * Note that this function removes "0" from the array before conversion.
 * @param bytesArray The bytes array.
 * @returns The decoded string.
 */
export function convertUint8ArrayToString(bytesArray: Uint8Array) {
    const decoder = new TextDecoder("iso-8859-1");
    const nonZeroBytes = bytesArray.filter(b => b !== 0);
    return decoder.decode(nonZeroBytes);
}

/**
 * Converts an Uint8Array to an hex string.
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @param prefix Whether to add the "0x" prefix (defaults to true).
 * @returns The hex string.
 */
export function convertUint8ArrayToHexString(
    bytesArray: Uint8Array,
    littleEndian = true,
    prefix = true
) {
    if (!littleEndian) {
        bytesArray = bytesArray.reverse();
    }

    const hex = bytesArray.reduce((acc, value) => acc + value.toString(16).padStart(2, "0"), "");

    if (prefix) {
        return `0x${hex.toUpperCase()}`;
    } else {
        return hex.toUpperCase();
    }
}

/**
 * Converts an Uint8Array to a number.
 * Note that 0xFFFFFFFF is converted to -1.
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The number.
 */
export function convertUint8ArrayToNumber(bytesArray: Uint8Array, littleEndian = true) {
    if (bytesArray.every(b => b === 0xff)) {
        return -1;
    }

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
 * Based on a mapping, calculate its total length, including the entries that have a custom length.
 *
 * Example:
 *     unixTimestamp: 16,  // 4 bytes by default
 *     filename: { position: 20, length: 64 }  // 64 bytes
 * >>> The length of this mapping is 68 (4 + 64).
 *
 * @param mapping The mapping.
 * @returns The length of the mapping.
 */
export function calculateMappingsLength(mapping: NsMappings.IsMapping) {
    let mappingLength = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [key, value] of Object.entries(mapping)) {
        if (typeof value === "object" && value !== null) {
            mappingLength += value.length;
        } else {
            mappingLength += 4;
        }
    }

    return mappingLength;
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
 * @param ignoreEmptiness Whether to ignore the emptiness check (defaults to true).
 */
export function generateByteObjectFromMapping(
    bytesArray: Uint8Array,
    mapping: NsMappings.IsMapping,
    ignoreEmptiness = true
) {
    const resultObject: NsBytes.IsMappingByteObject = {};

    for (const [key, value] of Object.entries(mapping)) {
        let res;

        // If the value is an object, it means that the length is specified
        if (typeof value === "object") {
            res = readNBytesFromBytesArray(bytesArray, value.position, value.length);
        } else {
            res = readNBytesFromBytesArray(bytesArray, value);
        }

        resultObject[key] = res;
    }

    // Check if the object is empty
    let checkEmptiness = false;
    if (!ignoreEmptiness) {
        checkEmptiness = Object.values(resultObject).every(
            arr => arr.every(byte => byte === 0)
        );
    }

    return {
        data: resultObject,
        isEmpty: checkEmptiness
    };
}

/**
 * Generates a bytes array from a mapping.
 * Don't forget to calculate the bytes array length (in the case of countable entries).
 * @param bytesArray The bytes array.
 * @param mapping The mapping.
 * @param mappingLength The length of the mapping.
 * @param ignoreEmptiness Whether to ignore the emptiness check (defaults to true).
 */
export function generateByteTableFromMapping(
    bytesArray: Uint8Array,
    mapping: NsMappings.IsMapping,
    mappingLength: number,
    ignoreEmptiness = true
) {
    const resultTable: NsBytes.IsMappingByteObject[] = [];

    for (let i = 0; i < bytesArray.length; i += mappingLength) {
        const slicedBytesArray = readNBytesFromBytesArray(bytesArray, i, mappingLength);
        const resultObject = generateByteObjectFromMapping(slicedBytesArray, mapping, ignoreEmptiness);

        // If the result object is empty, we can stop the loop
        // as tables are not generally fully filled.
        if (!ignoreEmptiness && resultObject.isEmpty) {
            break;
        }

        resultTable.push(resultObject.data);
    }

    return resultTable;
}