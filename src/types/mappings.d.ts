declare namespace NsMappings {
    interface IsMappingWithLength {
        position: number;
        length?: number;
        type?: "str" | "hex" | "number";
    }

    /**
     * The linear mapping for a bytes array.
     */
    interface IsMapping {
        [key: string]: number | IsMappingWithLength
    }
}


export default NsMappings;