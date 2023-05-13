import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { TARGA_FILE_HEADER, TEXTURE_FILE_CONFIG, TEXTURE_FILE_CHUNK_TYPES } from "configs/constants";
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
import { extractorChecker, getFileName } from "helpers/files";
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
    const textureHeaderLength = calculateMappingsLength(MpBinFileTextureChunk);
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

        // Add the data field
        chunk.data.data = new Uint8Array(0);

        // Get the formatted chunk type
        let fmChunkType: string;
        if (TEXTURE_FILE_CHUNK_TYPES.hasOwnProperty(chunk.data.chunkType as number)) {
            fmChunkType = TEXTURE_FILE_CHUNK_TYPES[chunk.data.chunkType as number];
        } else {
            fmChunkType = "UNKNOWN";
        }

        if (chunk.data.magic === TEXTURE_FILE_CONFIG.magic) {
            // Verify the chunk mark
            if (chunk.data.chunkMark !== TEXTURE_FILE_CONFIG.chunkMark) {
                logger.error(
                    `Invalid chunk mark, expected '${TEXTURE_FILE_CONFIG.chunkMark}' but got '${chunk.data.chunkMark}'.`
                );

                process.exit(1);
            }

            // Size of the chunk data
            let dataSize = chunkSize - textureHeaderLength;

            if (dataSize > 0) {
                if (fmChunkType != "PALETTE_LINK") {
                    // Texture || Palette
                    // Read 4 additional bytes if the chunk is procedural
                    if (fmChunkType == "PROCEDURAL" && dataSize == 64) {
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
                chunk.data.data = cache.readBytes(pointer + textureHeaderLength, dataSize);
            } else {
                logger.error(`Unsupported chunk data size, expected more than 0 but got '${dataSize}'.`);
                process.exit(1);
            }

            pointer += 4 + chunkSize;
        } else {
            // Other chunk types (FontDesc, etc..)
        }





    }
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

    const chunks = getChunks(
        cache,
        littleEndian
    );



    logger.info(`Successfully extracted textures: '${getFileName(binFilePath)}' => '${outputDirPath}'.`);
}