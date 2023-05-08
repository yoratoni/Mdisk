declare namespace NsBigFile {
    /**
     * File data.
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
        data: Uint8Array;
    }

    /**
     * Formatted directory data.
     */
    interface IsFormattedDirectory {
        name: string;
        path: string;
        fileIndexes: number[];
    }

    /**
     * Metadata offset data.
     */
    interface IsMetadataOffset {
        dataOffset: number;
        key: string;
    }

    /**
     * Metadata directory data.
     */
    interface IsMetadataDirectory {
        firstFileIndex: number;
        firstSubdirIndex: number;
        nextIndex: number;
        previousIndex: number;
        parentIndex: number;
        dirName: string;
    }

    /**
     * Metadata file data.
     */
    interface IsMetadataFile {
        fileSize: number;
        nextIndex: number;
        previousIndex: number;
        directoryIndex: number;
        unixTimestamp: number;
        filename: string;
    }

    /**
     * Metadata structure data.
     */
    interface IsMetadataStructure {
        name: string;
        fileIndexes: number[];
    }

    /**
     * Metadata format.
     */
    interface IsMetadata {
        includeEmptyDirs: boolean;
        header: {
            magic: string;
            formatVersion: string;
            fileCount: number;
            directoryCount: number;
            unknown1: string;
            unknown2: string;
            unknown3: string;
            unknown4: string;
            offsetTableMaxLength: number;
            unknown5: string;
            initialKey: string;
            fileCount2: number;
            directoryCount2: number;
            offsetTableOffset: number;
            unknown6: string;
            unknown7: string;
            offsetTableMaxLengthMinOne: number;
            fileMetadataOffset: number;
            directoryMetadataOffset: number;
        };
        offsets: IsMetadataOffset[];
        directories: IsMetadataDirectory[];
        files: IsMetadataFile[];
        structures: IsMetadataStructure[];
    }
}


export default NsBigFile;