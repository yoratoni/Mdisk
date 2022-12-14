declare namespace NsBytes {
    /**
     * The result of a mapped bytes array.
     * Can contain fixed keys for other data types.
     */
    interface IsMappingByteObject {
        [key: string]: string | number | Uint8Array | undefined;
    }
}


export default NsBytes;