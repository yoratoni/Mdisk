import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { TARGA_FILE_HEADER, TEXTURE_FILE_CHUNK_TYPES, TEXTURE_FILE_CONFIG } from "configs/constants";
import { MpBinFileTextureChunk } from "configs/mappings";
import {
    calculateMappingsLength,
    concatenateUint8Arrays,
    convertNumberArrayToUint8Array,
    convertUint8ArrayToHexString,
    convertUint8ArrayToNumber,
    convertUint8ArrayToString,
    generateBytesObjectFromMapping
} from "helpers/bytes";
import { exportAsJson, extractorChecker, getFileName } from "helpers/files";
import logger from "helpers/logger";
import NsBin from "types/bin";
import NsBytes from "types/bytes";


/**
 * Get chunks from the texture buffer and format them as readable objects.
 * @param cache The cache object.
 * @param littleEndian Whether the texture is little endian or not.
 * @returns The formatted chunks.
 */
function getChunks(cache: Cache, littleEndian: boolean) {
    logger.info("Getting chunks..");

    const chunkHeaderLength = calculateMappingsLength(MpBinFileTextureChunk);
    const chunks: NsBytes.IsMappingByteObjectResultWithEmptiness[] = [];
    let pointer = 0;

    while (pointer < cache.bufferLength) {
        const chunkSize = convertUint8ArrayToNumber(cache.readBytes(pointer), littleEndian);
        const rawChunk = cache.readBytes(pointer + 4, chunkSize);

        // Read the chunk header
        const chunk = generateBytesObjectFromMapping(
            rawChunk,
            MpBinFileTextureChunk,
            true,
            littleEndian
        );

        // Get the formatted chunk type (replacing the original chunk type number)
        if (TEXTURE_FILE_CHUNK_TYPES.hasOwnProperty(chunk.data.chunkType as number)) {
            chunk.data.chunkType = TEXTURE_FILE_CHUNK_TYPES[chunk.data.chunkType as number];
        } else {
            chunk.data.chunkType = "UNKNOWN";
        }

        // Add the data field
        chunk.data.data = new Uint8Array(0);

        if (chunk.data.magic === TEXTURE_FILE_CONFIG.magic) {
            // Verify the chunk mark
            if (chunk.data.chunkMark !== TEXTURE_FILE_CONFIG.chunkMark) {
                logger.error(
                    `Invalid chunk mark, expected '${TEXTURE_FILE_CONFIG.chunkMark}' but got '${chunk.data.chunkMark}'.`
                );

                process.exit(1);
            }

            // Size of the chunk data
            let dataSize = chunkSize - chunkHeaderLength;

            if (dataSize > 0) {
                if (chunk.data.chunkType != "PALETTE_LINK") {
                    // Texture || Palette
                    // Read 4 additional bytes if the chunk is procedural
                    if (chunk.data.chunkType == "PROCEDURAL" && dataSize == 64) {
                        dataSize += 4;
                    }
                } else {
                    // Palette link
                    // Verify the palette link dimensions
                    if (chunk.data.width != 0 || chunk.data.height != 0) {
                        logger.error(
                            `Invalid palette link dimensions, expected 0x0 but got '${chunk.data.width}x${chunk.data.height}'.`
                        );

                        process.exit(1);
                    }
                }

                // Get the data
                chunk.data.data = cache.readBytes(pointer + chunkHeaderLength + 4, dataSize);

                // Check if filled with 0s
                chunk.isEmpty = chunk.data.data.every((byte) => byte === 0);
            } else {
                chunk.isEmpty = true;
            }

            chunks.push(chunk);

            // 4 bytes for the chunk size info, the header length and the data size
            pointer += 4 + chunkHeaderLength + dataSize;
        } else {
            // Other chunk types (FontDesc, etc..)
            const fontDescMagic = convertUint8ArrayToString(rawChunk.slice(0, 8), littleEndian);

            if (fontDescMagic === TEXTURE_FILE_CONFIG.fontDescMagic) {
                // FontDesc
                chunks.push({
                    data: {
                        chunkMark: undefined,
                        unknown1: undefined,
                        chunkType: TEXTURE_FILE_CONFIG.fontDescMagic,
                        width: undefined,
                        height: undefined,
                        unknown2: undefined,
                        fontKey: undefined,
                        magic: TEXTURE_FILE_CONFIG.fontDescMagic,
                        data: rawChunk
                    },
                    isEmpty: false
                });
            } else {
                // Palette
                if (
                    rawChunk.length != 0x30 &&
                    rawChunk.length != 0x40 &&
                    rawChunk.length != 0x300 &&
                    rawChunk.length != 0x400
                ) {
                    logger.warn(
                        `Invalid palette size, expected 0x30, 0x40, 0x300 or 0x400 but got '${rawChunk.length}'.`
                    );
                }

                const isRGBA = rawChunk.length == 0x40 || rawChunk.length == 0x400;
                const colorBytes = isRGBA ? 4 : 3;
                const colorCount = rawChunk.length / colorBytes;
                const palette: number[] = [];

                for (let i = 0; i < colorCount; i++) {
                    const rawColor = rawChunk.slice(i * colorBytes, (i + 1) * colorBytes);

                    const color = {
                        B: convertUint8ArrayToNumber(rawColor.slice(0, 1), littleEndian),
                        G: convertUint8ArrayToNumber(rawColor.slice(1, 2), littleEndian),
                        R: convertUint8ArrayToNumber(rawColor.slice(2, 3), littleEndian),
                        A: isRGBA ? convertUint8ArrayToNumber(rawColor.slice(3, 4), littleEndian) : 0xFF
                    };

                    // Number array formatted as 4 bytes per color (BGRA)
                    palette.push(color.B, color.G, color.R, color.A);
                }

                chunks.push({
                    data: {
                        chunkMark: undefined,
                        unknown1: undefined,
                        chunkType: "PALETTE",
                        width: undefined,
                        height: undefined,
                        unknown2: undefined,
                        fontKey: undefined,
                        magic: undefined,
                        data: palette
                    },
                    isEmpty: false
                });
            }

            pointer += 4 + chunkSize;
        }
    }

    logger.info(`Found ${chunks.length} chunks.`);

    return chunks;
}

/**
 * Sort the chunks by putting them into different sections and links the palettes & textures together.
 * @param rawChunks The raw chunks.
 * @returns The sorted chunks.
 */
function sortChunks(
    rawChunks: NsBytes.IsMappingByteObjectResultWithEmptiness[],
    littleEndian: boolean
) {
    logger.info("Sorting chunks..");

}

/**
 * Subfunction of BinFile to decompress "ff8".
 * @param outputDirPath The output directory path.
 * @param binFilePath The bin file path.
 * @param dataBlocks The decompressed data blocks.
 * @param littleEndian Whether the bin file is little endian or not.
 * @link [Texture files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextureFile.md)
 * @link [Jade Studio source code by 4g3v.](https://github.com/4g3v/JadeStudio/tree/master/JadeStudio.Core/FileFormats/Texture)
 */
export default function BinTexture(
    outputDirPath: string,
    binFilePath: string,
    dataBlocks: Uint8Array[],
    littleEndian = true
) {
    // Add a folder to the output path (filename without extension)
    outputDirPath = path.join(outputDirPath, getFileName(binFilePath));

    extractorChecker(binFilePath, "bin file", ".bin", outputDirPath);

    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks);

    const rawChunks = getChunks(
        cache,
        littleEndian
    );

    logger.info(`Successfully extracted textures: '${getFileName(binFilePath)}' => '${outputDirPath}'.`);
}