import fs from "fs";
import path from "path";


import Cache from "classes/cache";
import { BIN_FILE_TYPES, CHUNK_SIZE } from "configs/constants";
import { MpBinFileDataBlockHeader } from "configs/mappings";
import { generateByteObjectFromMapping } from "helpers/bytes";
import { checkFileExtension, getFileName } from "helpers/files";
import lzo from "lzo";
import BinMiscellaneous from "tools/bin/binMiscellaneous";
import BinSoundEffect from "tools/bin/binSoundEffect";
import BinSoundHeader from "tools/bin/binSoundHeader";
import BinText from "tools/bin/binText";
import BinTexture from "tools/bin/binTexture";
import NsBytes from "types/bytes";


/**
 * Get the type of the bin file.
 * @param binFilePath The absolute path to the bin file.
 * @returns The type of the bin file.
 */
function getBinType(binFilePath: string) {
    const filename = getFileName(binFilePath);
    const fileLetters = filename.slice(0, 2);
    const fileNumber = filename[2];

    if (fileLetters === "ff") {
        const filePrefix = fileLetters + fileNumber;

        if (filePrefix in BIN_FILE_TYPES) {
            return BIN_FILE_TYPES[filePrefix];
        }

        return BIN_FILE_TYPES["unknown"];
    }

    return BIN_FILE_TYPES[fileLetters];
}

/**
 * Reads the header of a data block.
 * @param cache Initialized cache class.
 * @param fileType The type of the bin file.
 * @param pointer The pointer to the data block.
 * @param headerSize The size of the header (defaults to 8).
 * @returns The formatted header.
 */
function readDataBlockHeader(
    cache: Cache,
    fileType: string,
    pointer: number,
    headerSize = 8
) {
    // Sound effects don't have any header and are not compressed.
    if (fileType === "SOUND_EFFECT") {
        const header: NsBytes.IsMappingByteObjectResultWithEmptiness = {
            data: {},
            isEmpty: false,
        };

        // Generate a fake header
        header.data.headerSize = 0;
        header.data.compressed = false;
        header.data.decompressedSize = cache.getFileSize();
        header.data.compressedSize = cache.getFileSize();

        return header;
    }

    const rawHeader = cache.readBytes(pointer, headerSize);
    const header = generateByteObjectFromMapping(rawHeader, MpBinFileDataBlockHeader);

    header.data.headerSize = headerSize;

    if (header.data.decompressedSize !== header.data.compressedSize) {
        header.data.compressed = true;
    } else {
        header.data.compressed = false;
    }

    return header;
}

/**
 * Reads unique data block data.
 * @param cache Initialized cache class.
 * @param header The header of the data block.
 * @param pointer The pointer to the data block.
 * @returns The data (decompressed if necessary).
 */
function readDataBlockData(
    cache: Cache,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
    pointer: number
): Uint8Array {
    const rawData = cache.readBytes(
        header.data.headerSize as number + pointer,
        header.data.compressedSize as number
    );

    // Decompress the data if needed and convert it to a Uint8Array
    if (header.data.compressed) {
        const decompressedDataBuffer = lzo.decompress(
            Buffer.from(rawData),
            header.data.decompressedSize as number
        );

        return new Uint8Array(decompressedDataBuffer);
    }

    return rawData;
}

/**
 * Reads all data blocks of a bin file.
 * @param cache Initialized cache class.
 * @param fileType The type of the bin file.
 * @returns An array of all data blocks.
 */
function readDataBlocks(cache: Cache, fileType: string) {
    const dataBlocks = [];
    const fileSize = cache.getFileSize();

    let dataBlockHeader: NsBytes.IsMappingByteObjectResultWithEmptiness;
    let dataBlockData: Uint8Array;
    let pointer = 0;

    while (pointer < fileSize) {
        dataBlockHeader = readDataBlockHeader(cache, fileType, pointer);
        dataBlockData = readDataBlockData(cache, dataBlockHeader, pointer);

        const headerSize = dataBlockHeader.data.headerSize as number;
        const compressedSize = dataBlockHeader.data.compressedSize as number;

        pointer += headerSize + compressedSize;

        if (compressedSize === 0) {
            break;
        }

        dataBlocks.push(dataBlockData);
    }

    return dataBlocks;
}

/**
 * Main function for reading/extracting bin files.
 * @param binFilePath The absolute path to the bin file.
 * @param outputDirPath The absolute path to the output directory.
 * @param exportDecompressedBin Whether to export the decompressed bin file or not.
 * @link https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/Bin.md
 */
export default function BinExtractor(binFilePath: string, outputDirPath: string, exportDecompressedBin = false) {
    if (!fs.existsSync(binFilePath)) {
        throw new Error(`The bin file doesn't exist: ${binFilePath}`);
    }

    if (!checkFileExtension(binFilePath, ".bin")) {
        throw new Error("Invalid bin file extension");
    }

    const cache = new Cache(binFilePath, CHUNK_SIZE);

    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    // File types (defined inside of the Kapouett's bge-formats-doc repository)
    const fileType = getBinType(binFilePath);

    // Read all data blocks
    const dataBlocks = readDataBlocks(cache, fileType);

    // Extract the data blocks depending on the file type
    switch (fileType) {
        case "MISCELLANEOUS":
            BinMiscellaneous(dataBlocks);
            break;
        case "SOUND_EFFECT":
            BinSoundEffect(dataBlocks);
            break;
        case "SOUND_HEADER":
            BinSoundHeader(dataBlocks);
            break;
        case "TEXT":
            BinText(outputDirPath, binFilePath, dataBlocks);
            break;
        case "TEXTURE":
            BinTexture(dataBlocks);
            break;
        case "UNKNOWN":
            throw new Error("Unknown bin file type");
        default:
            throw new Error("Invalid bin file type");
    }

    // Export the decompressed bin file
    if (exportDecompressedBin) {
        const outputFilePath = path.join(outputDirPath, "DECOMP_" + path.basename(binFilePath));
        fs.writeFileSync(outputFilePath, Buffer.concat(dataBlocks));
    }
}