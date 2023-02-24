import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { TEXTURE_FILE_CONFIG, TEXTURE_FILE_TYPES } from "configs/constants";
import { MpBinFileTexture } from "configs/mappings";
import { convertUint8ArrayToHexString, convertUint8ArrayToNumber, generateByteObjectFromMapping } from "helpers/bytes";
import NsBin from "types/bin";
import NsBytes from "types/bytes";


/**
 * Get all chunks from the texture buffer.
 * @param cache The cache object.
 * @returns The chunks.
 */
function getAllChunks(cache: Cache) {
    const chunks = [];
    let pointer = 0;

    while (pointer < cache.bufferLength) {
        const chunkSize = convertUint8ArrayToNumber(cache.readBytes(pointer));
        const chunk = cache.readBytes(pointer + 4, chunkSize);

        chunks.push(chunk);

        pointer += chunkSize + 4;
    }

    return chunks;
}

/**
 * Parse the chunks.
 * @param chunks The chunks to parse.
 * @returns The parsed chunks.
 */
function parseChunks(chunks: Uint8Array[]) {
    const parsedChunks = [];

    for (const chunk of chunks) {
        let pointer = 0;

        // Reads the type
        pointer += 6;
        const rawChunkType = convertUint8ArrayToNumber(chunk.slice(pointer, pointer + 2));
        const chunkType = TEXTURE_FILE_TYPES[rawChunkType];

        // Reads the magic
        pointer += 14;
        const chunkMagic = convertUint8ArrayToHexString(chunk.slice(pointer, pointer + 12));

        // Chunk verification with the magic hex (0x3412D0CAFF00FF00DEC0DEC0)
        if (chunkMagic === TEXTURE_FILE_CONFIG.magicHex) {
            const parsedChunk = generateByteObjectFromMapping(
                chunk,
                MpBinFileTexture
            );

            // For later font desc / palette dictionary
            parsedChunk.data.isFontDesc = false;
            parsedChunk.data.isPalette = false;

            // Remaining bytes inside a chunk
            let remainingBytes = chunk.length - TEXTURE_FILE_CONFIG.headerLength;

            // Data linked to the chunk
            if (remainingBytes > 0) {
                // Specific chunk parsing for procedural textures
                if (chunkType == TEXTURE_FILE_TYPES[5]) {
                    if (remainingBytes === 64) {
                        remainingBytes += 4;
                    }
                }

                parsedChunk.data.data = chunk.slice(
                    TEXTURE_FILE_CONFIG.headerLength,
                    TEXTURE_FILE_CONFIG.headerLength + remainingBytes
                );
            }

            parsedChunks.push(parsedChunk);
        } else {
            // Get the font desc magic
            const fontDescMagic = convertUint8ArrayToHexString(chunk.slice(0, 8));

            // Check if the chunk is a FONT DESC
            const isFontDesc = fontDescMagic === "FONTDESC";

            // Check if the chunk is a palette (NOT === 7 | PALETTE_LINK)
            const isPalette = chunkType !== "PALETTE_LINK";

            const parsedChunk = {
                data: {
                    isFontDesc: isFontDesc,
                    isPalette: isPalette,
                    data: chunk
                },
                isEmpty: false
            };

            parsedChunks.push(parsedChunk);
        }
    }

    return parsedChunks;
}

function test() {
    //
}

/**
 * Sort the chunks by putting them into different sections.
 * @param chunks The parsed chunks.
 * @returns The object containing all the sorted chunks.
 */
function sortChunks(chunks: NsBytes.IsMappingByteObjectResultWithEmptiness[]) {
    const resObject: NsBin.binTextureFileChunkResObj = {
        fonts: [],
        palettes: [],
        textures: [],
        TGAs: [],
        NoDataTGAs: [],
        textureKeys: [],
        paletteKeys: []
    };

    for (const { index, chunk } of chunks.map((chunk, index) => ({ index, chunk }))) {
        const chunkType = TEXTURE_FILE_TYPES[chunk.data.textureType as number];
        const chunkData = chunk.data.data as Uint8Array;
        const isWithData = chunkData !== undefined && chunkData.length > 0;

        // Font desc
        if (chunk.data.isFontDesc) {
            resObject.fonts[index - 1] = chunk;
        }

        // Palette
        if (chunk.data.isPalette) {
            resObject.palettes.push(chunk);
        }

        // Texture
        if (isWithData && (chunkType === "PALETTE_8" || chunkType === "PALETTE_4")) {
            resObject.textures.push(chunk);
        }

        // TGAs + added to textures
        if (isWithData && chunkType === "RGB_HEADER") {
            resObject.TGAs.push(chunk);
            resObject.textures.push(chunk);
        }

        // No data TGAs
        if (!isWithData && chunkType === "RGB_HEADER") {
            resObject.NoDataTGAs.push(chunk);
        }

        // Linked index between TGAs and NoDataTGAs
        for (let i = 0; i < resObject.NoDataTGAs.length; i++) {
            const chunkIndexInsideTGA = chunks.indexOf(resObject.TGAs[i]);

            resObject.NoDataTGAs[i].data.linkedIndex = chunkIndexInsideTGA;
        }

        // Get the keys for the texture and palette and add them to the object
        if (chunkType === "PALETTE_LINK") {
            const data = chunk.data.data as Uint8Array;

            const textureKey = convertUint8ArrayToHexString(data.slice(0, 4), true, true);
            const paletteKey = convertUint8ArrayToHexString(data.slice(4, 8), true, true);

            resObject.textureKeys.push(textureKey);
            resObject.paletteKeys.push(paletteKey);
        }

        // Link the palettes
        const distinctPaletteKeys = Array.from(new Set(resObject.paletteKeys));
    }

    return resObject;
}

/**
 * Subfunction of BinFile to decompress "ff8".
 * @param outputDirPath The output directory path.
 * @param binFilePath The bin file path.
 * @param dataBlocks The decompressed data blocks.
 * @link [Texture files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextureFile.md)
 * @link [Jade Studio source code by 4g3v.](https://github.com/4g3v/JadeStudio/tree/master/JadeStudio.Core/FileFormats/Texture)
 */
export default function BinTexture(outputDirPath: string, binFilePath: string, dataBlocks: Uint8Array[]) {
    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks);


    const rawChunks = getAllChunks(
        cache
    );

    const chunks = parseChunks(
        rawChunks
    );

    const resObject = sortChunks(
        chunks
    );

    console.log(resObject);
}