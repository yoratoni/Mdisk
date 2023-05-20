import NsBytes from "types/bytes";


declare namespace NsBin {
    /**
     * Bin text group string text IDs.
     */
    interface IsBinFileTextGroupStringTextIDs {
        groupIDEntries: NsBytes.IsMappingByteObject[];          // Group ID Entries
        groupStringRefs: NsBytes.IsMappingByteObject[][];       // Group String Refs
        pointer: number;                                        // Final pointer position
    }
}


export default NsBin;