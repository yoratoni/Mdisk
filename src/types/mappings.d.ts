declare namespace NsMappings {
    /**
     * Used to map data more precisely.
     */
    interface IsPreciseMapping {
        position: number;
        length?: number;
        type?: "str" | "hex" | "number" | "signed";
    }

    /**
     * The linear mapping for a bytes array.
     */
    interface IsMapping {
        [key: string]: number | IsPreciseMapping
    }
}


export default NsMappings;