declare namespace NsBigFile {
    interface IsFile {
        name: string;
        key: string;
        offset: number;
        size: number;
        nextIndex: number;
        previousIndex: number;
        directoryIndex: number;
        unixTimestamp: number;
    }
}


export default NsBigFile;