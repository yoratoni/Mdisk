declare namespace NsBigFile {
    /**
     * Formatted file data.
     */
    interface IsFile {
        name: string;
        key: string;
        offset: number;
        size: number;
        nextIndex: number;
        previousIndex: number;
        directoryName: string;
        directoryIndex: number;
        unixTimestamp: number;
        data?: Uint8Array;
    }

    /**
     * Formatted directory data.
     */
    interface IsDirectory {
        name: string;
        path: string;
        fileIndexes: number[];
    }
}


export default NsBigFile;