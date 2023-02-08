import NsBytes from "types/bytes";


declare namespace NsBin {
    /**
     * The group ID entries, the group string refs and the pointer.
     */
    interface IsGroupStringTextIDs {
        groupIDEntries: NsBytes.IsMappingByteObject[];
        groupStringRefs: NsBytes.IsMappingByteObject[][];
        pointer: number;
    }
}


export default NsBin;