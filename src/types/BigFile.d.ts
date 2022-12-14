declare namespace NsBigFile {
    interface IsFile {
        name: string;
        key: Uint8Array;
        size: number;
        nextIndex: Uint8Array;
        previousIndex: Uint8Array;
        directoryIndex: Uint8Array;
        unixTimestamp: Uint8Array;
        data: Uint8Array;
    }
}


export default NsBigFile;