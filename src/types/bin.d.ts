import NsBytes from "types/bytes";


declare namespace NsBin {
    interface IsGroupStringTextIDs {
        groupIDEntries: NsBytes.IsMappingByteObject[];
        groupStringRefs: NsBytes.IsMappingByteObject[][];
        pointer: number;
    }
}


export default NsBin;