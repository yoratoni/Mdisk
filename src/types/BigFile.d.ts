declare namespace NsBigFile {
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
}


export default NsBigFile;