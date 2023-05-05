import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { TEXTURE_FILE_CONFIG, TEXTURE_FILE_TYPES } from "configs/constants";
import { MpBinFileTexture } from "configs/mappings";
import { convertUint8ArrayToHexString, convertUint8ArrayToNumber, generateByteObjectFromMapping } from "helpers/bytes";
import { checkFileExtension, exportAsJson } from "helpers/files";
import logger from "helpers/logger";
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
        let chunkType = TEXTURE_FILE_TYPES[rawChunkType];

        // Fallback for unknown chunk types
        if (!chunkType) {
            chunkType = "UNKNOWN_TYPE";
        }

        // Reads the magic
        pointer += 14;
        const chunkMagic = convertUint8ArrayToHexString(chunk.slice(pointer, pointer + 12));

        // Chunk verification with the magic hex (0x3412D0CAFF00FF00DEC0DEC0)
        if (chunkMagic === TEXTURE_FILE_CONFIG.magicHex) {
            const parsedChunk = generateByteObjectFromMapping(
                chunk,
                MpBinFileTexture
            );

            // Add the chunk type
            parsedChunk.data.chunkType = chunkType;

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

            // Check if the chunk is a palette (NOT PALETTE_LINK)
            const isPalette = chunkType !== "PALETTE_LINK";

            const parsedChunk = {
                data: {
                    chunkType: chunkType,
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

/**
 * Prepare the chunks by putting them into different sections
 * and links palettes & textures.
 * @param chunks The parsed chunks.
 * @returns The resObject containing all the chunks and linked palettes/textures.
 */
function prepareChunks(chunks: NsBytes.IsMappingByteObjectResultWithEmptiness[]) {
    const resObject: NsBin.binTextureFileChunkResObj = {
        fonts: [],
        palettes: [],
        textures: [],
        RGBHeaders: [],
        NoDataRGBHeaders: [],
        RGBAHeaders: [],
        NoDataRGBAHeaders: [],
        textureKeys: [],
        paletteKeys: [],
        linkedPalettes: {},
        linkedTextures: {}
    };

    for (const { index, chunk } of chunks.map((chunk, index) => ({ index, chunk }))) {
        const chunkType = TEXTURE_FILE_TYPES[chunk.data.textureType as number];
        const chunkData = chunk.data.data as Uint8Array | undefined;
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

        // RGB headers + added to textures
        if (isWithData && chunkType === "RGB_HEADER") {
            resObject.RGBHeaders.push(chunk);
            resObject.textures.push(chunk);
        }

        // No data RGB headers
        if (!isWithData && chunkType === "RGB_HEADER") {
            resObject.NoDataRGBHeaders.push(chunk);
        }

        // RGBA Headers + added to textures
        if (isWithData && chunkType === "RGBA_HEADER") {
            resObject.RGBAHeaders.push(chunk);
            resObject.textures.push(chunk);
        }

        // No data RGBA Headers
        if (!isWithData && chunkType === "RGBA_HEADER") {
            resObject.NoDataRGBAHeaders.push(chunk);
        }

        // Linked index between RGBHeaders and NoDataRGBHeaders
        for (let i = 0; i < resObject.NoDataRGBHeaders.length; i++) {
            const chunkIndexInsideRGBHeader = chunks.indexOf(resObject.RGBHeaders[i]);

            resObject.NoDataRGBHeaders[i].data.linkedIndex = chunkIndexInsideRGBHeader;
        }

        // Linked index between RGBHeaders and NoDataRGBHeaders
        for (let i = 0; i < resObject.NoDataRGBAHeaders.length; i++) {
            const chunkIndexInsideRGBAHeader = chunks.indexOf(resObject.RGBAHeaders[i]);

            resObject.NoDataRGBAHeaders[i].data.linkedIndex = chunkIndexInsideRGBAHeader;
        }

        // Get the keys for the texture and palette and add them to the object
        if (chunkType === "PALETTE_LINK") {
            const data = chunk.data.data as Uint8Array;

            const textureKey = convertUint8ArrayToHexString(data.slice(0, 4), true, true);
            const paletteKey = convertUint8ArrayToHexString(data.slice(4, 8), true, true);

            resObject.textureKeys.push(textureKey);
            resObject.paletteKeys.push(paletteKey);
        }
    }

    // Link palettes
    const distinctPaletteKeys = [...new Set(resObject.paletteKeys)];

    for (let i = 0; i < distinctPaletteKeys.length; i++) {
        try {
            resObject.linkedPalettes[distinctPaletteKeys[i]] = resObject.palettes[i];
        } catch (e) {
            // Doing nothing (sometimes, distinctPaletteKeys > palettes)
        }
    }

    // Link textures
    const distinctTextureKeys = [...new Set(resObject.textureKeys)];
    const textureHeadersWithoutData = chunks.filter((chunk) => {
        const chunkType = chunk.data.chunkType as string;

        // Palette 4 & palette 8 with no data
        return (
            chunkType === "PALETTE_4" ||
            chunkType === "PALETTE_8"
        ) && chunk.data.data === undefined;
    });

    for (let i = 0; i < distinctTextureKeys.length; i++) {
        try {
            resObject.linkedTextures[distinctTextureKeys[i]] = textureHeadersWithoutData[i];
        } catch (e) {
            // Doing nothing (sometimes, distinctTextureKeys > textureHeadersWithoutData)
        }
    }

    return resObject;
}

/**
 * Dump the textures.
 * @param outputDirPath The output directory path.
 * @param binFilePath The bin file path.
 * @param chunks The parsed chunks.
 * @param resObject The resObject containing all the chunks and linked palettes/textures.
 */
function dumpTextures(
    outputDirPath: string,
    binFilePath: string,
    chunks: NsBytes.IsMappingByteObjectResultWithEmptiness[],
    resObject: NsBin.binTextureFileChunkResObj,
) {
    const remainingTextures = chunks.filter((chunk) => {
        const chunkType = chunk.data.chunkType as string;

        return (
            chunkType != "PALETTE_4" &&
            chunkType != "PALETTE_8" &&
            chunkType != "RGB_HEADER" &&
            chunkType != "RGBA_HEADER" &&
            chunkType != "PALETTE_LINK" &&
            !chunk.data.isPalette &&
            !chunk.data.isFontDesc
        ) && chunk.data.data != undefined;
    });

    // Dump remaining textures
    for (const remainingTexture of remainingTextures) {
        const chunkType = remainingTexture.data.chunkType as string;

        // Filename: index_chunkType.bin
        const filename = `${chunks.indexOf(remainingTexture)}_${chunkType}.bin`;

        const outputFilePath = path.join(outputDirPath, filename);
        fs.writeFileSync(outputFilePath, remainingTexture.data.data as Uint8Array);
    }

    // Total length of textures
    const totalLength = resObject.paletteKeys.length +
        resObject.NoDataRGBHeaders.length +
        resObject.NoDataRGBAHeaders.length;

    // Dump textures
    for (let i = 0; i < totalLength; i++) {
        const texture = resObject.textures[i];
        const chunkType = texture.data.chunkType as string;

        // Filename: index_chunkType.tga
        const filename = `${chunks.indexOf(texture)}_${chunkType}.tga`;
        const outputFilePath = path.join(outputDirPath, filename);

        // Dump corresponding font desc and link the font desc to its texture
        if (texture.data.isFontDesc) {
            const chunkIndex = chunks.indexOf(texture);

            const fontDescFilename = `${chunkIndex}_FONTDESC.bin`;
            const fontDescOutputFilePath = path.join(outputDirPath, fontDescFilename);
            fs.writeFileSync(fontDescOutputFilePath, texture.data.data as Uint8Array);
        }

        // Dump RGB Headers
        if (chunkType === "RGB_HEADER") {
            fs.writeFileSync(outputFilePath, texture.data.data as Uint8Array);
            continue;
        }

        // Dump RGBA Headers
        if (chunkType === "RGBA_HEADER") {
            fs.writeFileSync(outputFilePath, texture.data.data as Uint8Array);
            continue;
        }

        // Missing palettes
        if (i >= resObject.paletteKeys.length) {
            const missingPaletteFilename = `${i}_MISSING_PALETTE.bin`;
            const missingPaletteOutputFilePath = path.join(outputDirPath, missingPaletteFilename);
            fs.writeFileSync(missingPaletteOutputFilePath, texture.data.data as Uint8Array);
            continue;
        }
    }
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
    if (!fs.existsSync(binFilePath)) {
        logger.error(`Invalid bin file path: ${binFilePath}`);
        process.exit(1);
    }

    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    if (!checkFileExtension(binFilePath, ".bin")) {
        logger.error(`Invalid bin file extension: ${binFilePath}`);
        process.exit(1);
    }

    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks);

    const rawChunks = getAllChunks(
        cache
    );

    const chunks = parseChunks(
        rawChunks
    );

    const resObject = prepareChunks(
        chunks
    );

    dumpTextures(
        outputDirPath,
        binFilePath,
        chunks,
        resObject
    );
}