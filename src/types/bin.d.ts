import NsBytes from "types/bytes";


declare namespace NsBin {
    /**
     * Bin text file text groups.
     * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md
     */
    interface IsBinFileTextGroups {
        unknown4Bytes: boolean;                                 // Unknown 4 bytes
        initialPointer: number;                                 // Initial pointer position
        groupIDEntriesSize: number;                             // Group ID Entries Size
        groupIDEntries: NsBytes.IsMappingByteObject[];          // Group ID Entries
        groupStringRefs: NsBytes.IsMappingByteObject[][];       // Group String Refs
        endPointer: number;                                     // End pointer position
    }

    /**
     * Bin text file text groups metadata.
     * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md
     */
    interface IsBinFileGroupStringsMetadata {
        initialPointer: number;                                 // Pointer position
        numberOfGroups: number;                                 // Number of groups
        breakSizes: number[];                                   // Break sizes
        breakPositions: number[];                               // Break positions
        stringSizes: number[];                                  // String sizes
        endPointer: number;                                     // End pointer position
    }

    /**
     * Bin text file group strings.
     * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextFile.md
     */
    interface IsBinFileGroupStrings {
        strings: string[];                                      // Group strings
        endPointer: number;                                     // End pointer position
        metadata: IsBinFileGroupStringsMetadata;                // Group strings metadata
    }
}


export default NsBin;