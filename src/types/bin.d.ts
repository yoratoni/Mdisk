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
     * Links all the font chunks inside the Bin texture file.
     */
    interface binTextureFileFonts {
        [key: number]: NsBytes.IsMappingByteObjectResultWithEmptiness;
    }

    /**
     * The result object of the chunk sorting inside a Bin texture file.
     */
    interface binTextureFileChunkResObj {
        fonts: binTextureFileFonts;
        palettes: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        textures: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        TGAs: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        NoDataTGAs: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        textureKeys: string[];
        paletteKeys: string[];
    }
}


export default NsBin;