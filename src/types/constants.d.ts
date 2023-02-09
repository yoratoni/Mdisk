declare namespace NsConstants {
    /**
     * Any string file types.
     */
    interface IsStringFileTypes {
        [key: string]: string
    }

    /**
     * Any number file types.
     */
    interface IsNumberAndStringFileTypes {
        [key: string]: number | string
    }
}


export default NsConstants;