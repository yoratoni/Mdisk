declare namespace NS_BigFile {
    interface IsBigFileHeader {
        formatVersion: Uint8Array | null;
        fileCount: Uint8Array | null;
        directoryCount: Uint8Array | null;
        offsetTableMaxLength: Uint8Array | null;
        initialKey: Uint8Array | null;
        offsetTableOffset: Uint8Array | null;
        fileMetadataOffset: Uint8Array | null;
        directoryMetadataOffset: Uint8Array | null;
    }
}


export default NS_BigFile;