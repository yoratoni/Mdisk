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

    /**
     * The result object of the chunk sorting inside a Bin texture file.
     */
    interface binTextureFileChunkResObj {
        fonts: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        palettes: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        textures: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        TGAs: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        NoDataTGAs: NsBytes.IsMappingByteObjectResultWithEmptiness[];
    }
}


export default NsBin;