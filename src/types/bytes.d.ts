declare namespace NsBytes {
    /**
     * The result of a mapped bytes array.
     * Can contain fixed keys for other data types.
     */
    interface IsMappingByteObject {
        [key: string]: string | number | Uint8Array | undefined | boolean | Uint8Array[] | number[];
    }

    /**
     * The result of a mapped bytes array.
     */
    interface IsMappingByteObjectResultWithEmptiness {
        data: NsBytes.IsMappingByteObject;
        isEmpty: boolean;
    }
}


export default NsBytes;