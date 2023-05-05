import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import {
    MpBinFileTextGroup,
    MpBinFileTextGroupIdEntry,
    MpBinFileTextGroupStringRefs,
    MpBinFileTextGroupStringRefsSize
} from "configs/mappings";
import {
    calculateMappingsLength,
    convertStringToUint8Array,
    convertUint8ArrayToNumber,
    convertUint8ArrayToString,
    generateByteObjectFromMapping,
    generateByteTableFromMapping
} from "helpers/bytes";
import { checkFileExtension } from "helpers/files";
import logger from "helpers/logger";
import NsBin from "types/bin";


/**
 * Read the text group IDs.
 * @param cache Initialized cache class.
 * @returns The group ID entries, the group string refs and the pointer.
 */
function readTextIDs(cache: Cache): NsBin.IsGroupStringTextIDs {
    let rawValue: Uint8Array;

    // Group ID Entry Size
    rawValue = cache.readBytes(0);
    const groupIdEntrySize = generateByteObjectFromMapping(rawValue, MpBinFileTextGroup);

    // Calculate the number of groups
    const groupIDEntryMappingLength = calculateMappingsLength(MpBinFileTextGroupIdEntry);
    const numberOfGroups = groupIdEntrySize.data.groupIdEntrySize as number / groupIDEntryMappingLength;

    // Group ID Entries
    rawValue = cache.readBytes(4, groupIdEntrySize.data.groupIdEntrySize as number);

    const groupIDEntries = generateByteTableFromMapping(
        rawValue,
        MpBinFileTextGroupIdEntry,
        groupIDEntryMappingLength,
        false
    );

    // Group String Refs
    const groupStringRefs = [];
    let groupStringRefsPointer = groupIdEntrySize.data.groupIdEntrySize as number + 4;

    // Repeat based on the number of groups
    for (let i = 0; i < numberOfGroups; i++) {
        // Get the size of the group string refs
        rawValue = cache.readBytes(groupStringRefsPointer);

        const groupStringRefsSize = generateByteObjectFromMapping(
            rawValue,
            MpBinFileTextGroupStringRefsSize
        );

        // Get one group string refs
        const groupStringRefsMappingLength = calculateMappingsLength(MpBinFileTextGroupStringRefs);

        rawValue = cache.readBytes(
            groupStringRefsPointer + 4,
            groupStringRefsSize.data.groupStringRefsSize as number
        );

        const oneGroupStringRefs = generateByteTableFromMapping(
            rawValue,
            MpBinFileTextGroupStringRefs,
            groupStringRefsMappingLength,
            false
        );

        // Push the mapped data to the group string refs array
        groupStringRefs.push(oneGroupStringRefs);

        // Update the pointer
        // Note that it's +8 because there's an unknown value after the group string refs
        // + 4 bytes for the size of the group string refs
        groupStringRefsPointer += groupStringRefsSize.data.groupStringRefsSize as number + 8;
    }

    return {
        groupIDEntries,
        groupStringRefs,
        pointer: groupStringRefsPointer
    };
}

/**
 * Read the text group strings.
 * @param cache Initialized cache class.
 * @param dataBlockSize The size of the data block.
 * @param textIDs The group ID entries, the group string refs and the pointer.
 * @returns The group strings in a list.
 */
function readGroupStrings(
    cache: Cache,
    dataBlockSize: number,
    textIDs: NsBin.IsGroupStringTextIDs
) {
    let pointer = textIDs.pointer;
    const groupSize = dataBlockSize - pointer;

    const breakPositions: number[] = [];
    const strings: string[] = [];

    while (pointer < groupSize) {
        // Breaks size
        const breaksSize = convertUint8ArrayToNumber(cache.readBytes(pointer));
        pointer += 4;

        // Breaks positions
        const rawBreakPositions = cache.readBytes(pointer, breaksSize);
        pointer += breaksSize;

        // Convert the breaks positions to numbers
        for (let i = 0; i < breaksSize; i += 4) {
            const breakPosition = convertUint8ArrayToNumber(rawBreakPositions.slice(i, i + 4));
            breakPositions.push(breakPosition);
        }

        // Strings size
        const stringSize = convertUint8ArrayToNumber(cache.readBytes(pointer));
        pointer += 4;

        // Concatenated strings
        const concatenatedStrings = convertUint8ArrayToString(cache.readBytes(pointer, stringSize));
        pointer += stringSize;

        // Apply the breaks positions to the concatenated strings
        let string = "";
        let stringIndex = 0;

        for (let i = 0; i < breakPositions.length; i++) {
            const breakPosition = breakPositions[i];

            string += concatenatedStrings.slice(stringIndex, breakPosition);
            stringIndex = breakPosition;
        }

        // Push the string to the strings array
        strings.push(string);
    }

    return strings;
}

/**
 * Decode the escaped unicode string.
 * @param strings An array of all the encoded strings.
 * @returns The decoded string with line breaks.
 */
function escapedUnicodeDecoder(strings: string[]) {
    let decodedStrings = "";

    for (let i = 0; i < strings.length; i++) {
        let decodedString = strings[i];

        // Replace unescaped unicode characters
        decodedString = decodedString.replace(/\\U\+(\d+)\\/gi, (_, p1) => {
            const code = parseInt(p1, 10);
            let character = "";

            if (code < 61) {
                // console.log(code);
            }

            // Character validity check
            if (code !== undefined && code >= 0x0061 && code <= 0x10FFFF) {
                character = String.fromCharCode(code);
            } else {
                character = " ";
            }

            return character;
        });

        // Removes the codes (\p14\ etc..)
        // console.log(decodedString);
        decodedString = decodedString.replace(/\\[a-z][0-9]{1,2}\\/gi, "");

        // Removes the colors (\cffffffff\ etc..)
        decodedString = decodedString.replace(/\\c[a-z0-9]{8}\\/gi, "");

        // Concatenate the decoded strings
        decodedStrings = decodedStrings.concat(decodedString);
    }

    return decodedStrings;
}

/**
 * Subfunction of BinFile to decompress "fd*".
 * @param outputDirPath The output directory path.
 * @param binFilePath The bin file path.
 * @param dataBlocks The decompressed data blocks.
 * @link [BIN Text files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md)
 */
export default function BinText(outputDirPath: string, binFilePath: string, dataBlocks: Uint8Array[]) {
    if (!fs.existsSync(binFilePath)) {
        logger.error(`Invalid bin file path: ${binFilePath}`);
        process.exit(1);
    }

    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    if (!checkFileExtension(binFilePath, ".bin")) {
        logger.error(`Invalid bin file extension: ${binFilePath}`);
        process.exit(1);
    }

    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks);

    const textIDs = readTextIDs(
        cache
    );

    const groupStrings = readGroupStrings(
        cache,
        cache.bufferLength,
        textIDs
    );

    const decoded = escapedUnicodeDecoder(
        groupStrings
    );

    const result = convertStringToUint8Array(
        decoded
    );

    const filename = path.basename(binFilePath, ".bin") + ".txt";

    const outputFilePath = path.join(outputDirPath, filename);
    fs.writeFileSync(outputFilePath, result);
}