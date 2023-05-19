import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import {
    MpBinFileTextGroupIDEntry,
    MpBinFileTextGroupStringRefs
} from "configs/mappings";
import {
    calculateMappingsLength,
    convertStringToUint8Array,
    convertUint8ArrayToNumber,
    convertUint8ArrayToString,
    generateBytesObjectFromMapping,
    generateBytesTableFromMapping
} from "helpers/bytes";
import { getFileName } from "helpers/files";
import logger from "helpers/logger";
import NsBin from "types/bin";
import NsBytes from "types/bytes";


/**
 * Read the text groups.
 * @param cache Initialized cache class.
 * @param littleEndian Whether the bin file is little endian or not.
 * @returns The text groups.
 */
function readTextGroups(cache: Cache, littleEndian: boolean): NsBin.IsBinFileTextGroupStringTextIDs {
    logger.info("Reading text group IDs..");

    let pointer = 0;

    // Group ID Entry Size
    const textGroupsSize = convertUint8ArrayToNumber(cache.readBytes(pointer), littleEndian);

    pointer += 4;

    // Calculate the number of groups
    const groupIDEntryMappingLength = calculateMappingsLength(MpBinFileTextGroupIDEntry);
    const numberOfGroups = Math.floor(textGroupsSize / groupIDEntryMappingLength);

    logger.verbose(`Number of groups: ${numberOfGroups}`);

    // Group ID Entries
    const rawGroupIDEntries = cache.readBytes(pointer, textGroupsSize);

    const groupIDEntries = generateBytesTableFromMapping(
        rawGroupIDEntries,
        MpBinFileTextGroupIDEntry,
        groupIDEntryMappingLength,
        false,
        littleEndian
    );

    pointer += textGroupsSize;

    // Group String Refs
    const groupStringRefs: NsBytes.IsMappingByteObject[][] = [];

    // Repeat based on the number of groups
    for (let i = 0; i < numberOfGroups; i++) {
        // Get the size of the group string refs
        const groupStringRefsSize = convertUint8ArrayToNumber(cache.readBytes(pointer));

        pointer += 4;

        // Size of the mapping for one group string ref
        const groupStringRefsMappingLength = calculateMappingsLength(MpBinFileTextGroupStringRefs);

        // Read the group string ref
        const rawGroupStringRef = cache.readBytes(pointer, groupStringRefsSize);

        pointer += groupStringRefsSize;

        const groupStringRef = generateBytesTableFromMapping(
            rawGroupStringRef,
            MpBinFileTextGroupStringRefs,
            groupStringRefsMappingLength,
            false,
            littleEndian
        );

        // Push the mapped data to the group string refs array
        groupStringRefs.push(groupStringRef);

        // Add 4 bytes to the pointer for an unknown value
        pointer += 4;
    }

    return {
        groupIDEntries: groupIDEntries,
        groupStringRefs: groupStringRefs,
        pointer: pointer
    };
}

/**
 * Read the text group strings.
 * @param cache Initialized cache class.
 * @param dataBlockSize The size of the data block.
 * @param textGroups The text groups and the pointer.
 * @param littleEndian Whether the bin file is little endian or not.
 * @returns The group strings in a list.
 */
function readGroupStrings(
    cache: Cache,
    dataBlockSize: number,
    textGroups: NsBin.IsBinFileTextGroupStringTextIDs,
    littleEndian: boolean
) {
    let pointer = textGroups.pointer;
    const groupSize = dataBlockSize - pointer;

    logger.info(`Reading group strings with a group size of ${groupSize} bytes.`);

    const breakPositions: number[] = [];
    const strings: string[] = [];

    const totalLength = groupSize + textGroups.pointer;
    while (pointer < totalLength) {
        // Break size
        const breakSize = convertUint8ArrayToNumber(cache.readBytes(pointer), littleEndian);
        pointer += 4;

        // Break positions
        const rawBreakPositions = cache.readBytes(pointer, breakSize);
        pointer += breakSize;

        // Convert the break positions to numbers
        for (let i = 0; i < breakSize; i += 4) {
            const breakPosition = convertUint8ArrayToNumber(rawBreakPositions.slice(i, i + 4), littleEndian);
            breakPositions.push(breakPosition);
        }

        // Strings size
        const stringSize = convertUint8ArrayToNumber(cache.readBytes(pointer), littleEndian);
        pointer += 4;

        // Concatenated strings
        // const concatenatedStrings = convertUint8ArrayToString(cache.readBytes(pointer, stringSize), littleEndian);
        pointer += stringSize;

        console.log(stringSize);

        // // Apply the break positions to the concatenated strings
        // let string = "";
        // let stringIndex = 0;

        // for (let i = 0; i < breakPositions.length; i++) {
        //     const breakPosition = breakPositions[i];

        //     string += concatenatedStrings.slice(stringIndex, breakPosition);
        //     stringIndex = breakPosition;
        // }

        // // Push the string to the strings array
        // strings.push(string);
    }

    logger.info(`Number of strings: ${strings.length}`);

    return strings;
}

/**
 * Decode the escaped unicode string.
 * @param strings An array of all the encoded strings.
 * @returns The decoded string with line breaks.
 */
function escapedUnicodeDecoder(strings: string[]) {
    logger.info("Decoding escaped unicode characters..");

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
 * @param littleEndian Whether the bin file is little endian or not.
 * @link [Bin Text files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md)
 */
export default function BinText(
    outputDirPath: string,
    binFilePath: string,
    dataBlocks: Uint8Array[],
    littleEndian = true
) {
    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks);

    const textGroups = readTextGroups(
        cache,
        littleEndian
    );

    const groupStrings = readGroupStrings(
        cache,
        cache.bufferLength,
        textGroups,
        littleEndian
    );

    // const decoded = escapedUnicodeDecoder(
    //     groupStrings
    // );

    // const result = convertStringToUint8Array(
    //     decoded,
    //     littleEndian
    // );

    // const filename = path.basename(binFilePath, ".bin") + ".txt";

    // const outputFilePath = path.join(outputDirPath, filename);
    // fs.writeFileSync(outputFilePath, result);

    // logger.info(`Successfully extracted: '${getFileName(binFilePath)}' => '${getFileName(outputFilePath)}'.`);
}