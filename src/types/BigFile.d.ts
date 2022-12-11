declare namespace NS_BigFile {
    interface IsBigFileHeader {
        formatVersion: number[];
        fileCount: number[];
        directoryCount: number[];
        offsetTableMaxLength: number[];
        initialKey: number[];
        offsetTableOffset: number[];
        fileMetadataOffset: number[];
        directoryMetadataOffset: number[];
    }
}


export default NS_BigFile;