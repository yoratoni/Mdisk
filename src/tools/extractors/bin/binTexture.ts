import path from "path";

import Cache from "classes/cache";
import { TEXTURE_FILE_CHUNK_TYPES, TEXTURE_FILE_CONFIG } from "configs/constants";
import { MpBinFileTextureChunk } from "configs/mappings";
import {
    calculateMappingsLength,
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
function sortChunks(rawChunks: NsBytes.IsMappingByteObjectResultWithEmptiness[]) {
    const chunks: NsBin.IsBinFileTextureSeparatedChunks = {
        fonts: [],
        palettes: [],
        textures: [],
        targa1: [],
        NoDataTarga1: [],
        targa2: [],
        NoDataTarga2: [],
        paletteKeys: [],
        textureKeys: [],
        links: [],
        linkedPalettes: {},
        linkedTextures: {}
    };

    for (const { index, chunk } of rawChunks.map((chunk, index) => ({ index, chunk }))) {
        const chunkType = chunk.data.chunkType as string;
        const chunkData = chunk.data.data as Uint8Array;
        const isEmpty = (chunk.isEmpty as boolean) || chunkData.length == 0;

        // Font desc
        if (chunkType === TEXTURE_FILE_CONFIG.fontDescMagic) {
            chunks.fonts[index - 1] = chunk;
        }

        // Palette
        if (chunkType === "PALETTE") {
            chunks.palettes.push(chunk);
        }

        // Texture
        if (!isEmpty && (chunkType === "PALETTE_4" || chunkType === "PALETTE_8")) {
            chunks.textures.push(chunk);
        }

        // Targa 1 + added to textures
        if (!isEmpty && chunkType === "TARGA_1") {
            chunks.targa1.push(chunk);
            chunks.textures.push(chunk);
        }

        // No data targa 1
        if (isEmpty && chunkType === "TARGA_1") {
            chunks.NoDataTarga1.push(chunk);
        }

        // Targa 2 + added to textures
        if (!isEmpty && chunkType === "TARGA_2") {
            chunks.targa2.push(chunk);
            chunks.textures.push(chunk);
        }

        // No data targa 2
        if (isEmpty && chunkType === "TARGA_2") {
            chunks.NoDataTarga2.push(chunk);
        }

        // Linked index between targa1 and NoDataTarga1
        const targa1LinkIndex = chunks.NoDataTarga1.length - 1;
        if (chunks.targa1[targa1LinkIndex] !== undefined) {
            chunks.NoDataTarga1[targa1LinkIndex].data.linkedIndex = rawChunks.indexOf(
                chunks.targa1[targa1LinkIndex]
            );
        }

        // Linked index between targa2 and NoDataTarga2
        const targa2LinkIndex = chunks.NoDataTarga2.length - 1;
        if (chunks.targa2[targa2LinkIndex] !== undefined) {
            chunks.NoDataTarga2[targa2LinkIndex].data.linkedIndex = rawChunks.indexOf(
                chunks.targa2[targa2LinkIndex]
            );
        }

        // Get the keys for the texture and palette and add them to the object
        if (!isEmpty && chunkType === "PALETTE_LINK") {
            const textureKey = convertUint8ArrayToHexString(chunkData.slice(0, 4), true, true);
            const paletteKey = convertUint8ArrayToHexString(chunkData.slice(4, 8), true, true);

            chunks.links.push(chunk);
            chunks.textureKeys.push(textureKey);
            chunks.paletteKeys.push(paletteKey);
        }
    }

    // Link palettes
    const distinctPaletteKeys = [...new Set(chunks.paletteKeys)];

    for (let i = 0; i < distinctPaletteKeys.length; i++) {
        try {
            chunks.linkedPalettes[distinctPaletteKeys[i]] = chunks.palettes[i];
        } catch (e) {
            // Doing nothing (sometimes, distinctPaletteKeys > palettes)
        }
    }

    // Link textures
    const distinctTextureKeys = [...new Set(chunks.textureKeys)];
    const textureHeadersWithoutData = rawChunks.filter((rawChunk) => {
        const chunkType = rawChunk.data.chunkType as string;

        // Palette 4 & palette 8 with no data
        return (chunkType === "PALETTE_4" || chunkType === "PALETTE_8") && rawChunk.data.data === undefined;
    });

    for (let i = 0; i < distinctTextureKeys.length; i++) {
        try {
            chunks.linkedTextures[distinctTextureKeys[i]] = textureHeadersWithoutData[i];
        } catch (e) {
            // Doing nothing (sometimes, distinctTextureKeys > textureHeadersWithoutData)
        }
    }

    logger.info(`Found ${chunks.palettes.length.toLocaleString("en-US")} palettes..`);
    logger.info(`Found ${chunks.textures.length.toLocaleString("en-US")} textures..`);
    logger.verbose(`Found ${chunks.targa1.length.toLocaleString("en-US")} Targa 1 (TGA)..`);
    logger.verbose(`Found ${chunks.NoDataTarga1.length.toLocaleString("en-US")} Targa 1 (TGA) without data..`);
    logger.verbose(`Found ${chunks.targa2.length.toLocaleString("en-US")} Targa 2 (TGA)..`);
    logger.verbose(`Found ${chunks.NoDataTarga2.length.toLocaleString("en-US")} Targa 2 (TGA) without data..`);
    logger.verbose(`Found ${chunks.paletteKeys.length.toLocaleString("en-US")} palette keys..`);
    logger.verbose(`Found ${chunks.textureKeys.length.toLocaleString("en-US")} texture keys..`);
    logger.verbose(`Found ${chunks.links.length.toLocaleString("en-US")} links..`);
    logger.info("Chunks sorted..");

    return chunks;
}

/**
 * Dump the textures.
 * @param outputDirPath The output directory path.
 * @param binFilePath The bin file path.
 * @param rawChunks The raw chunks.
 * @param chunks The sorted chunks.
 */
function dumpTextures(
    outputDirPath: string,
    binFilePath: string,
    rawChunks: NsBytes.IsMappingByteObjectResultWithEmptiness[],
    chunks: NsBin.IsBinFileTextureSeparatedChunks,
) {
    logger.info("Dumping textures..");

    // TODO
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

    const chunks = sortChunks(
        rawChunks
    );

    dumpTextures(
        outputDirPath,
        binFilePath,
        rawChunks,
        chunks
    );

    logger.info(`Successfully extracted textures: '${getFileName(binFilePath)}' => '${outputDirPath}'.`);
}