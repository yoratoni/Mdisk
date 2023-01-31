import Cache from "classes/cache";
import {
    MpBinFileTextGroup,
    MpBinFileTextGroupIdEntry,
    MpBinFileTextGroupStringRefs,
    MpBinFileTextGroupStringRefsSize
} from "configs/mappings";
import {
    calculateMappingsLength,
    convertUint8ArrayToNumber,
    convertUint8ArrayToString,
    generateByteObjectFromMapping,
    generateByteTableFromMapping
} from "helpers/bytes";
import NsBin from "types/bin";
import NsBytes from "types/bytes";


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
 */
function readGroupStrings(
    cache: Cache,
    dataBlockSize: number,
    textIDs: NsBin.IsGroupStringTextIDs
) {
    let pointer = textIDs.pointer;
    const groupSize = dataBlockSize - pointer;

    const breakPositions: number[] = [];
    let strings = "";

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
        strings = strings.concat(string + "\n");
    }

    console.log(strings);

    return strings;
}

/**
 * Subfunction of BinFile to decompress "fd*".
 * @param dataBlocks The decompressed data blocks.
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md
 */
export default function BinText(dataBlocks: Uint8Array[]) {
    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks[0]);

    const textIDs = readTextIDs(
        cache
    );

    const groupStrings = readGroupStrings(
        cache,
        dataBlocks[0].length,
        textIDs
    );

    // console.log(groupStrings);
}