declare namespace NsBytes {
    /**
     * The result of a mapped bytes array.
     * Can contain fixed keys for other data types.
     */
    interface IsMappingByteObject {
        strFilename?: string;
        strDirname?: string;
        [key: string]: Uint8Array;
    }
}


export default NsBytes;