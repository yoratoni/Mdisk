import NsBytes from "types/bytes";
import NsMappings from "types/mappings";


/**
 * Converts bytes to megabytes for the file operations.
 * @param megaBytes The number of megabytes.
 * @returns The number of bytes.
 */
export function convertMegaBytesToBytes(megaBytes: number) {
    return megaBytes * 1000 * 1000;
}

/**
 * A function that concatenates Uint8Arrays into one.
 * @param bytesArrays The Uint8Arrays to concatenate.
 * @returns The concatenated Uint8Array.
 */
export function concatenateUint8Arrays(bytesArrays: Uint8Array[]) {
    const totalLength = bytesArrays.reduce((acc, array) => acc + array.length, 0);

    let offset = 0;
    const result = new Uint8Array(totalLength);

    for (const bytesArray of bytesArrays) {
        result.set(bytesArray, offset);
        offset += bytesArray.length;
    }

    return result;
}

/**
 * A debug function to convert an hex string to an array of numbers (int16).
 * @param hexString The hex string to convert.
 * @returns The array of numbers.
 */
export function convertHexStringToNumberArray(
    hexString: string,
    littleEndian = true
) {
    const hexArray = hexString.split(" ");
    const numberArray: number[] = [];

    for (let i = 0; i < hexArray.length; i += 2) {
        let hexBytes = hexArray.slice(i, i + 2);

        if (littleEndian) {
            hexBytes = hexBytes.reverse();
        }

        let hex = parseInt(hexBytes.join(""), 16);

        if (hex > 32767) {
            hex -= 65536;
        }

        numberArray.push(hex);
    }

    return numberArray;
}

/**
 * Converts an Uint8Array to a string.
 *
 * Note that this function removes "0" from the array before conversion.
 *
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The decoded string.
 */
export function convertUint8ArrayToString(bytesArray: Uint8Array, littleEndian = true) {
    const decoder = new TextDecoder("iso-8859-1");

    if (!littleEndian) {
        bytesArray = bytesArray.reverse();
    }

    const nonZeroBytes = bytesArray.filter(b => b !== 0);
    return decoder.decode(nonZeroBytes);
}

/**
 * Converts a string to an Uint8Array.
 * @param string The string.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The bytes array.
 */
export function convertStringToUint8Array(string: string, littleEndian = true) {
    const encoder = new TextEncoder();
    const bytesArray = encoder.encode(string);

    if (!littleEndian) {
        return bytesArray.reverse();
    }

    return bytesArray;
}

/**
 * Converts an Uint8Array to an hex string.
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @param prefix Whether to add the "0x" prefix (defaults to true).
 * @param separateBySpace Whether to separate the bytes by space (defaults to false).
 * @returns The hex string.
 */
export function convertUint8ArrayToHexString(
    bytesArray: Uint8Array,
    littleEndian = true,
    prefix = true,
    separateBySpace = false
) {
    if (!littleEndian) {
        bytesArray = bytesArray.reverse();
    }

    const hex = bytesArray.reduce((acc, value) => acc + value.toString(16).padStart(2, "0"), "");

    // Split the hex string into pairs of 2 characters
    if (separateBySpace) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return `${prefix ? "0x" : ""}${hex.match(/.{2}/g)!.join(" ")}`.toUpperCase();
    }

    if (prefix) {
        return `0x${hex.toUpperCase()}`;
    } else {
        return hex.toUpperCase();
    }
}

/**
 * Converts an Uint8Array to a number.
 *
 * Note that 0xFFFFFFFF is converted to -1.
 *
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The number.
 */
export function convertUint8ArrayToNumber(bytesArray: Uint8Array, littleEndian = true) {
    if (bytesArray.every(b => b === 0xff)) {
        return -1;
    }

    const view = new DataView(bytesArray.buffer);

    switch (bytesArray.length) {
        case 1:
            return view.getUint8(0);
        case 2:
            return view.getUint16(0, littleEndian);
        case 4:
            return view.getUint32(0, littleEndian);
        default:
            return 0;
    }
}

/**
 * Converts an Uint8Array to a signed number.
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The signed number.
 */
export function convertUint8ArrayToSignedNumber(bytesArray: Uint8Array, littleEndian = true) {
    const view = new DataView(bytesArray.buffer);

    switch (bytesArray.length) {
        case 1:
            return view.getInt8(0);
        case 2:
            return view.getInt16(0, littleEndian);
        case 4:
            return view.getInt32(0, littleEndian);
        default:
            return 0;
    }
}

/**
 * Converts a number to an Uint8Array (limited to 4 bytes).
 * @param number The number.
 * @param bytes The number of bytes (defaults to 4).
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The bytes array.
 */
export function convertNumberToUint8Array(number: number, bytes = 4, littleEndian = true) {
    const bytesArray = new Uint8Array(bytes);

    for (let i = bytesArray.length - 1; i >= 0; i--) {
        bytesArray[i] = number & 0xff;
        number = number >> 8;
    }

    if (!littleEndian) {
        return bytesArray.reverse();
    }

    return bytesArray;
}

/**
 * Converts a number array to an Uint8Array.
 * @param numberArray The number array.
 * @returns The bytes array.
 */
export function convertNumberArrayToUint8Array(numberArray: number[]) {
    const bytesArray = new Uint8Array(numberArray.length);

    for (let i = 0; i < numberArray.length; i++) {
        bytesArray[i] = numberArray[i];
    }

    return bytesArray;
}

/**
 * Converts an Uint8Array to a hex string array.
 * @param bytesArray The bytes array.
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @returns The hex string array.
 */
export function convertUint8ArrayToHexStringArray(
    bytesArray: Uint8Array,
    littleEndian = true
) {
    if (!littleEndian) {
        bytesArray = bytesArray.reverse();
    }

    const hexArray = [];

    for (let i = 0; i < bytesArray.length; i++) {
        const hex = convertUint8ArrayToHexString(new Uint8Array([bytesArray[i]]), littleEndian, false);
        hexArray.push(hex);
    }

    return hexArray;
}

/**
 * Converts a number array to an hex string separated by spaces.
 * Mostly used for previewing the data.
 * @param numberArray The number[] array to preview.
 */
export function convertNumberArrayToHexString(numberArray: number[]) {
    const convertedData: string[] = [];

    for (const sample of numberArray) {
        const uint8Arr = convertNumberToUint8Array(sample, 2);
        const hexStringArr = convertUint8ArrayToHexString(uint8Arr, false, false, true);

        convertedData.push(hexStringArr);
    }

    return convertedData.join(" ");
}

/**
 * Based on a mapping, calculate its total length, including the entries that have a custom length.
 *
 * Note that the mapping values should all follow each other in the table
 * as the mapping length is calculated from each key of the mapping.
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
        if (typeof value === "object") {
            if (value.length) {
                mappingLength += value.length;
            } else {
                mappingLength += 4;
            }
        } else {
            mappingLength += 4;
        }
    }

    return mappingLength;
}

/**
 * Reads a number of bytes from a bytes array.
 *
 * Note that this function populates the bytes array with 0 to match the number of bytes.
 *
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
 * Check the emptiness of a value.
 * @param value The value to check.
 * @returns Whether the value is empty.
 */
export function checkValueEmptiness(
    value: string | number | Uint8Array | undefined | boolean | Uint8Array[] | number[]
) {
    if (typeof value === "string") {
        return value === "" || value === "0x00000000";
    } else if (typeof value === "number") {
        return value === -1 || value === 0;
    } else if (value instanceof Uint8Array) {
        return value.every(b => b === 0);
    } else if (typeof value === "boolean") {
        return !value;
    } else if (Array.isArray(value)) {
        if (value.length === 0) {
            return true;
        } else {
            if (value[0] instanceof Uint8Array) {
                const array = value as Uint8Array[];
                return array.every(b => b.every(bb => bb === 0));
            } else {
                const array = value as number[];
                return array.every(b => b === 0);
            }
        }
    } else {
        return true;
    }
}

/**
 * Read bytes from a mapping and a bytes array and returns an object based on the mapping.
 *
 * Returns an object containing the data and secondly a boolean indicating if the data is empty.
 *
 * @param bytesArray The bytes array.
 * @param mapping The mapping.
 * @param ignoreEmptiness Whether to ignore the emptiness check (defaults to true).
 * @param littleEndian Whether the bytes array is little endian (defaults to true).
 * @param hexPrefix Whether to add the "0x" prefix if outputting any hex string (defaults to true).
 */
export function generateByteObjectFromMapping(
    bytesArray: Uint8Array,
    mapping: NsMappings.IsMapping,
    ignoreEmptiness = true,
    littleEndian = true,
    hexPrefix = true
): NsBytes.IsMappingByteObjectResultWithEmptiness {
    const resultObject: NsBytes.IsMappingByteObject = {};

    for (const [key, value] of Object.entries(mapping)) {
        let res;

        // If the value is an object, it means that the length is specified
        if (typeof value === "object") {
            let length: number;

            if (value.length) {
                length = value.length;
            } else {
                length = 4;
            }

            const rawRes = readNBytesFromBytesArray(bytesArray, value.position, length);

            if (value.type) {
                switch (value.type) {
                    case "str":
                        res = convertUint8ArrayToString(rawRes, littleEndian);
                        break;
                    case "hex":
                        res = convertUint8ArrayToHexString(rawRes, littleEndian, hexPrefix);
                        break;
                    case "number":
                        res = convertUint8ArrayToNumber(rawRes, littleEndian);
                        break;
                    case "signed":
                        res = convertUint8ArrayToSignedNumber(rawRes, littleEndian);
                }
            } else {
                res = rawRes;
            }
        } else {
            res = readNBytesFromBytesArray(bytesArray, value);
        }

        resultObject[key] = res;
    }

    // Check if the object is empty
    let checkEmptiness = false;
    if (!ignoreEmptiness) {
        checkEmptiness = Object.values(resultObject).every(
            arr => checkValueEmptiness(arr)
        );
    }

    return {
        data: resultObject,
        isEmpty: checkEmptiness
    };
}

/**
 * Generates a bytes array from a mapping (generateByteObjectFromMapping applied x times).
 *
 * Don't forget to calculate the bytes array length (in the case of countable entries).
 *
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

        const resultObject = generateByteObjectFromMapping(
            slicedBytesArray,
            mapping,
            ignoreEmptiness
        );

        // If the result object is empty, we can stop the loop
        // as tables are not generally fully filled.
        if (!ignoreEmptiness && resultObject.isEmpty) {
            break;
        }

        resultTable.push(resultObject.data);
    }

    return resultTable;
}