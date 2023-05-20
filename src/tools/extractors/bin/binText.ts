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
    generateBytesTableFromMapping
} from "helpers/bytes";
import { getFileName } from "helpers/files";
import logger from "helpers/logger";
import NsBin from "types/bin";
import NsBytes from "types/bytes";


/**
 * Read the text groups.
 * @param cache Initialized cache class.
 * @param initialPointer The initial pointer position.
 * @param littleEndian Whether the bin file is little endian or not.
 * @returns The text groups.
 */
function readTextGroups(
    cache: Cache,
    initialPointer: number,
    littleEndian: boolean
): NsBin.IsBinFileTextGroupStringTextIDs {
    logger.info("Reading text group IDs..");

    let pointer = initialPointer;

    // Group ID Entry Size
    const textGroupsSize = convertUint8ArrayToNumber(cache.readBytes(pointer), littleEndian);

    pointer += 4;

    // Calculate the number of groups
    const groupIDEntryMappingLength = calculateMappingsLength(MpBinFileTextGroupIDEntry);
    const numberOfGroups = Math.floor(textGroupsSize / groupIDEntryMappingLength);

    // Group ID Entries
    const rawGroupIDEntries = cache.readBytes(pointer, textGroupsSize);

    const groupIDEntries = generateBytesTableFromMapping(
        rawGroupIDEntries,
        MpBinFileTextGroupIDEntry,
        groupIDEntryMappingLength,
        false,
        littleEndian
    );

    // Remove the invalid group ID entries (using ".txg " as marker)
    for (const groupIDEntry of groupIDEntries) {
        if (groupIDEntry.magic != ".txg") {
            const index = groupIDEntries.indexOf(groupIDEntry);
            groupIDEntries.splice(index, 1);
        }
    }

    pointer += textGroupsSize;

    // Group String Refs
    const groupStringRefs: NsBytes.IsMappingByteObject[][] = [];

    // Repeat based on the number of groups
    for (let i = 0; i < numberOfGroups; i++) {
        // Get the size of the group string ref
        const groupStringRefSize = convertUint8ArrayToNumber(cache.readBytes(pointer));
        pointer += 4;

        // Size of the mapping for one group string ref
        const groupStringRefMappingLength = calculateMappingsLength(MpBinFileTextGroupStringRefs);

        // Read the group string ref
        const rawGroupStringRef = cache.readBytes(pointer, groupStringRefSize);

        pointer += groupStringRefSize;

        const groupStringRef = generateBytesTableFromMapping(
            rawGroupStringRef,
            MpBinFileTextGroupStringRefs,
            groupStringRefMappingLength,
            false,
            littleEndian
        );

        // Add 4 bytes to the pointer for an unknown value
        pointer += 4;

        // Verify the group string ref (using ".txi " & ".txs" as markers)
        let groupStringRefVerified = true;
        for (const stringID of groupStringRef) {
            if (stringID.magic1 != ".txi" || stringID.magic2 != ".txs") {
                groupStringRefVerified = false;
                break;
            }
        }

        // Push the mapped data to the group string refs array
        if (groupStringRefVerified) {
            groupStringRefs.push(groupStringRef);
        } else {
            // Reset the pointer position if the group string ref is not verified
            pointer -= groupStringRefSize + 8;
        }
    }

    // Sometimes the number of group string refs is less than the number of group ID entries
    while (groupStringRefs.length < groupIDEntries.length) {
        groupIDEntries.pop();
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
 * @param textGroups The text groups and the pointer.
 * @param littleEndian Whether the bin file is little endian or not.
 * @returns The group strings in a list.
 */
function readGroupStrings(
    cache: Cache,
    textGroups: NsBin.IsBinFileTextGroupStringTextIDs,
    littleEndian: boolean
) {
    const numberOfGroups = textGroups.groupStringRefs.length;
    let groupIndex = 0;
    let pointer = textGroups.pointer;

    logger.info(`Reading ${numberOfGroups} strings..`);

    const breakPositions: number[] = [];
    const strings: string[] = [];

    while (groupIndex < numberOfGroups) {
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
        const concatenatedStrings = convertUint8ArrayToString(cache.readBytes(pointer, stringSize), littleEndian);
        pointer += stringSize;

        // Apply the break positions to the concatenated strings
        let string = "";
        let stringIndex = 0;

        for (let i = 0; i < breakPositions.length; i++) {
            const breakPosition = breakPositions[i];

            string += concatenatedStrings.slice(stringIndex, breakPosition);
            stringIndex = breakPosition;
        }

        // Push the string to the strings array
        strings.push(string);

        groupIndex++;
    }

    return {
        strings: strings,
        pointer: pointer
    };
}

/**
 * Decode the escaped unicode string.
 * @param strings An array of all the encoded strings.
 * @returns The decoded string with line breaks.
 */
function escapedUnicodeDecoder(
    strings: string[],
    removeCodes: boolean,
    removeColors: boolean
) {
    logger.info("Decoding escaped unicode characters..");

    let decodedStrings = "";

    for (let i = 0; i < strings.length; i++) {
        let decodedString = strings[i];

        // Replace unescaped unicode characters
        decodedString = decodedString.replace(/\\U\+(\d+)\\/gi, (_, p1) => {
            const code = parseInt(p1, 10);
            let character = "";

            // Character validity check
            if (code !== undefined && code >= 0x0061 && code <= 0x10FFFF) {
                character = String.fromCharCode(code);
            } else {
                character = " ";
            }

            return character;
        });

        // Removes the codes (\p14\ etc..)
        if (removeCodes) {
            decodedString = decodedString.replace(/\\[a-z][0-9]{1,2}\\/gi, "");
        }

        // Removes the colors (\cffffffff\ etc..)
        if (removeColors) {
            decodedString = decodedString.replace(/\\c[a-z0-9]{8}\\/gi, "");
        }

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
 * @param removeCodes Whether to remove the codes or not (optional, default: false)
 * @param removeColors Whether to remove the colors or not (optional, default: false)
 * @param littleEndian Whether the bin file is little endian or not.
 * @link [Bin Text files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md)
 */
export default function BinText(
    outputDirPath: string,
    binFilePath: string,
    dataBlocks: Uint8Array[],
    removeCodes = false,
    removeColors = false,
    littleEndian = true
) {
    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks);
    const bufferLength = cache.bufferLength;
    let lastPointer = 0;

    const groupStrings: string[] = [];

    // There's multiple groups inside the bin file
    // We need to read only groups defined by their ID entries
    // Then, start again if the pointer is not at the end of the buffer
    while (lastPointer < bufferLength) {
        const textGroups = readTextGroups(
            cache,
            lastPointer,
            littleEndian
        );

        const { strings, pointer } = readGroupStrings(
            cache,
            textGroups,
            littleEndian
        );

        // Add the strings to the group strings array
        groupStrings.push(...strings);

        lastPointer = pointer;
    }

    const decodedStrings = escapedUnicodeDecoder(
        groupStrings,
        removeCodes,
        removeColors
    );

    const finalStrings = convertStringToUint8Array(
        decodedStrings,
        littleEndian,
        "utf-8"
    );

    const filename = path.basename(binFilePath, ".bin") + ".txt";

    const outputFilePath = path.join(outputDirPath, filename);
    fs.writeFileSync(outputFilePath, finalStrings);

    logger.info(`Successfully extracted: '${getFileName(binFilePath)}' => '${getFileName(outputFilePath)}'.`);
}