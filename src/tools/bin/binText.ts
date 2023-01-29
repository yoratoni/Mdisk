import Cache from "classes/cache";
import {
    MpBinFileTextGroup,
    MpBinFileTextGroupIdEntry,
    MpBinFileTextGroupStringRefs,
    MpBinFileTextGroupStringRefsSize
} from "configs/mappings";
import {
    calculateMappingsLength,
    generateByteObjectFromMapping,
    generateByteTableFromMapping
} from "helpers/bytes";

/**
 * Read the text group IDs.
 * @param cache Initialized cache class.
 */
function readTextIDs(cache: Cache) {
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
        groupStringRefs
    };
}

/**
 * Subfunction of BinFile to decompress "fd*".
 * @param dataBlocks The decompressed data blocks.
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md
 */
export default function BinText(dataBlocks: Uint8Array[]) {
    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks[0]);

    readTextIDs(
        cache
    );
}