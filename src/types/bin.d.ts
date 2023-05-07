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
     * Links all the font chunks inside the bin texture file.
     */
    interface binTextureFileFonts {
        [key: number]: NsBytes.IsMappingByteObjectResultWithEmptiness;
    }

    /**
     * The linked data inside a bin texture file.
     */
    interface binTextureLinkedData {
        [key: string]: NsBytes.IsMappingByteObjectResultWithEmptiness;
    }

    /**
     * The result object of the chunk sorting inside a bin texture file.
     */
    interface binTextureFileChunkResObj {
        fonts: binTextureFileFonts;
        palettes: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        textures: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        targa1: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        NoDataTarga1: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        targa2: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        NoDataTarga2: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        paletteKeys: string[];
        textureKeys: string[];
        links: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        linkedPalettes: binTextureLinkedData;
        linkedTextures: binTextureLinkedData;
    }

    /**
     * Bin texture RGBA data.
     */
    interface binTextureRGBAData {
        B: number;
        G: number;
        R: number;
        A: number;
    }
}


export default NsBin;