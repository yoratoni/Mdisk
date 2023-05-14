import NsBytes from "types/bytes";


declare namespace NsBin {
    /**
     * The group ID entries, the group string refs and the pointer inside Bin text files.
     */
    interface IsBinFileTextGroupStringTextIDs {
        groupIDEntries: NsBytes.IsMappingByteObject[];
        groupStringRefs: NsBytes.IsMappingByteObject[][];
        pointer: number;
    }

    /**
     * Links all the font chunks inside Bin texture files.
     */
    interface IsBinFileTextureFileFonts {
        [key: number]: NsBytes.IsMappingByteObjectResultWithEmptiness;
    }

    /**
     * The linked data inside Bin texture files.
     */
    interface IsBinFileTextureLinkedData {
        [key: string]: NsBytes.IsMappingByteObjectResultWithEmptiness;
    }

    /**
     * Sorted chunks for Bin texture files.
     */
    interface IsBinFileTextureSeparatedChunks {
        fonts: IsBinFileTextureFileFonts;
        palettes: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        textures: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        targa1: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        NoDataTarga1: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        targa2: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        NoDataTarga2: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        textureKeys: string[];
        paletteKeys: string[];
        links: NsBytes.IsMappingByteObjectResultWithEmptiness[];
        linkedTextures: IsBinFileTextureLinkedData;
        linkedPalettes: IsBinFileTextureLinkedData;
    }
}


export default NsBin;