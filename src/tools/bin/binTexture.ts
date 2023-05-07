import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { TARGA_FILE_HEADER, TEXTURE_FILE_CONFIG, TEXTURE_FILE_TYPES } from "configs/constants";
import { MpBinFileTexture } from "configs/mappings";
import {
    concatenateUint8Arrays,
    convertUint8ArrayToHexString,
    convertUint8ArrayToNumber,
    generateByteObjectFromMapping
} from "helpers/bytes";
import { extractorChecker, getFileName } from "helpers/files";
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
    logger.info("Parsing chunks..");

    const parsedChunks = [];

    for (const chunk of chunks) {
        let pointer = 6;

        // Reads the type
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
                if (chunkType === "PROCEDURAL") {
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

    logger.info(`${parsedChunks.length.toLocaleString("en-US")} chunks parsed..`);

    return parsedChunks;
}

/**
 * Prepare the chunks by putting them into different sections
 * and links palettes & textures.
 * @param chunks The parsed chunks.
 * @returns The resObject containing all the chunks and linked palettes/textures.
 */
function prepareChunks(chunks: NsBytes.IsMappingByteObjectResultWithEmptiness[]) {
    logger.info("Preparing chunks..");

    const resObject: NsBin.binTextureFileChunkResObj = {
        fonts: [],
        palettes: [],
        textures: [],
        targa1: [],
        NoDataTarga1: [],
        targa2: [],
        NoDataTarga2: [],
        textureKeys: [],
        paletteKeys: [],
        links: [],
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
        if (isWithData && (chunkType === "PALETTE_4" || chunkType === "PALETTE_8")) {
            resObject.textures.push(chunk);
        }

        // Targa 1 + added to textures
        if (isWithData && chunkType === "TARGA_1") {
            resObject.targa1.push(chunk);
            resObject.textures.push(chunk);
        }

        // No data targa 1
        if (!isWithData && chunkType === "TARGA_1") {
            resObject.NoDataTarga1.push(chunk);
        }

        // Targa 2 + added to textures
        if (isWithData && chunkType === "TARGA_2") {
            resObject.targa2.push(chunk);
            resObject.textures.push(chunk);
        }

        // No data targa 2
        if (!isWithData && chunkType === "TARGA_2") {
            resObject.NoDataTarga2.push(chunk);
        }

        // Linked index between targa1 and NoDataTarga1
        const targa1LinkIndex = resObject.NoDataTarga1.length - 1;
        if (resObject.targa1[targa1LinkIndex] !== undefined) {
            resObject.NoDataTarga1[targa1LinkIndex].data.linkedIndex = chunks.indexOf(
                resObject.targa1[targa1LinkIndex]
            );
        }

        // Linked index between targa2 and NoDataTarga2
        const targa2LinkIndex = resObject.NoDataTarga2.length - 1;
        if (resObject.targa2[targa2LinkIndex] !== undefined) {
            resObject.NoDataTarga2[targa2LinkIndex].data.linkedIndex = chunks.indexOf(
                resObject.targa2[targa2LinkIndex]
            );
        }

        // Get the keys for the texture and palette and add them to the object
        if (isWithData && chunkType === "PALETTE_LINK") {
            const textureKey = convertUint8ArrayToHexString(chunkData.slice(0, 4), true, true);
            const paletteKey = convertUint8ArrayToHexString(chunkData.slice(4, 8), true, true);

            resObject.links.push(chunk);
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
        return (chunkType === "PALETTE_4" || chunkType === "PALETTE_8") && chunk.data.data === undefined;
    });

    for (let i = 0; i < distinctTextureKeys.length; i++) {
        try {
            resObject.linkedTextures[distinctTextureKeys[i]] = textureHeadersWithoutData[i];
        } catch (e) {
            // Doing nothing (sometimes, distinctTextureKeys > textureHeadersWithoutData)
        }
    }

    logger.info(`Found ${resObject.palettes.length.toLocaleString("en-US")} palettes..`);
    logger.info(`Found ${resObject.textures.length.toLocaleString("en-US")} textures..`);
    logger.verbose(`Found ${resObject.targa1.length.toLocaleString("en-US")} Targa 1 (TGA)..`);
    logger.verbose(`Found ${resObject.NoDataTarga1.length.toLocaleString("en-US")} Targa 1 (TGA) without data..`);
    logger.verbose(`Found ${resObject.targa2.length.toLocaleString("en-US")} Targa 2 (TGA)..`);
    logger.verbose(`Found ${resObject.NoDataTarga2.length.toLocaleString("en-US")} Targa 2 (TGA) without data..`);
    logger.verbose(`Found ${resObject.paletteKeys.length.toLocaleString("en-US")} palette keys..`);
    logger.verbose(`Found ${resObject.textureKeys.length.toLocaleString("en-US")} texture keys..`);
    logger.verbose(`Found ${resObject.links.length.toLocaleString("en-US")} links..`);
    logger.info("Chunks prepared..");

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
    logger.info("Dumping textures..");

    const remainingTextures = chunks.filter((chunk) => {
        const chunkType = chunk.data.chunkType as string;

        return (
            chunkType != "PALETTE_4" &&
            chunkType != "PALETTE_8" &&
            chunkType != "TARGA_1" &&
            chunkType != "TARGA_2" &&
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

    logger.info(`Dumped ${remainingTextures.length.toLocaleString("en-US")} remaining texture(s)..`);

    // Total length of textures
    const totalLength = resObject.paletteKeys.length + resObject.targa1.length + resObject.targa2.length;

    // Counters for the logs
    const counters = {
        fontDescs: 0,
        targa1: 0,
        targa2: 0,
        missingPalettes: 0,
        weirdPalettes: 0,
        targaFiles: 0
    };

    // Dump textures
    for (let i = 0; i < totalLength; i++) {
        const texture = resObject.textures[i];
        const textureIndex = chunks.indexOf(texture);
        const textureData = texture.data.data as Uint8Array;
        const textureType = texture.data.chunkType as string;
        const textureHeaderChunk = resObject.linkedTextures[resObject.textureKeys[i]];

        // Filename: index_textureType.tga
        const filename = `${chunks.indexOf(texture)}_${textureType}.tga`;
        const outputFilePath = path.join(outputDirPath, filename);

        // Dump corresponding font desc and link the font desc to its texture
        if (texture.data.isFontDesc) {
            const fontDescFilename = `${textureIndex}_FONTDESC.bin`;
            const fontDescOutputFilePath = path.join(outputDirPath, fontDescFilename);
            fs.writeFileSync(fontDescOutputFilePath, textureData);

            counters.fontDescs++;
        }

        // Dump Targa 1
        if (textureType === "TARGA_1") {
            fs.writeFileSync(outputFilePath, textureData);

            counters.targa1++;
            continue;
        }

        // Dump Targa 2
        if (textureType === "TARGA_2") {
            fs.writeFileSync(outputFilePath, textureData);

            counters.targa2++;
            continue;
        }

        // Missing palettes
        if (i >= resObject.paletteKeys.length) {
            const missingPaletteFilename = `${i}_MISSING_PALETTE.bin`;
            const missingPaletteOutputFilePath = path.join(outputDirPath, missingPaletteFilename);
            fs.writeFileSync(missingPaletteOutputFilePath, textureData);

            counters.missingPalettes++;
            continue;
        }

        // Link texture chunk without data to the one with data and vice versa
        textureHeaderChunk.data.linkedIndex = textureIndex;
        texture.data.linkedIndex = chunks.indexOf(textureHeaderChunk);

        // Link texture chunk with data to palette link
        resObject.links[i].data.linkedIndex = textureIndex;

        // Palette info
        const linkedPalette = resObject.linkedPalettes[resObject.paletteKeys[i]];
        const linkedPaletteData = linkedPalette.data.data as Uint8Array;

        // Check if it uses RGBA
        let usesRGBA = false;
        for (const RGBAPaletteLength of TEXTURE_FILE_CONFIG.RGBAPaletteLengths) {
            if (linkedPaletteData.length === RGBAPaletteLength) {
                usesRGBA = true;
                break;
            }
        }

        // Dump weird palettes
        if (!usesRGBA && linkedPaletteData.length != 0x30 && linkedPaletteData.length != 0x300) {
            const weirdPaletteFilename = `${i}_WEIRD_PALETTE.bin`;
            const weirdPaletteOutputFilePath = path.join(outputDirPath, weirdPaletteFilename);
            fs.writeFileSync(weirdPaletteOutputFilePath, textureData);

            const weirdLinkedPaletteFilename = `${i}_WEIRD_LINKED_PALETTE.bin`;
            const weirdLinkedPaletteOutputFilePath = path.join(outputDirPath, weirdLinkedPaletteFilename);
            fs.writeFileSync(weirdLinkedPaletteOutputFilePath, linkedPaletteData);

            counters.weirdPalettes++;
            continue;
        }

        // Get the pixel color data
        const pixelColorData: NsBin.binTextureRGBAData[] = [];

        let pointer = 0;
        while (pointer < linkedPaletteData.length) {
            const RGBA: NsBin.binTextureRGBAData = {
                B: 0,
                G: 0,
                R: 0,
                A: 0xFF
            };

            if (usesRGBA) {
                RGBA.B = linkedPaletteData[pointer];
                RGBA.G = linkedPaletteData[pointer + 1];
                RGBA.R = linkedPaletteData[pointer + 2];
                RGBA.A = linkedPaletteData[pointer + 3];

                pointer += 4;
            } else {
                RGBA.B = linkedPaletteData[pointer];
                RGBA.G = linkedPaletteData[pointer + 1];
                RGBA.R = linkedPaletteData[pointer + 2];

                pointer += 3;
            }

            pixelColorData.push(RGBA);
        }

        // Specs:
        // - Little Endian
        // - https://www.fileformat.info/format/tga/egff.htm
        // - https://en.wikipedia.org/wiki/Truevision_TGA
        // - http://www.paulbourke.net/dataformats/tga/

        // Create the Targa file
        const targaFileHeader = new Uint8Array(TARGA_FILE_HEADER.headerLength);

        // Set the Targa file header image width and height
        TARGA_FILE_HEADER.width = textureHeaderChunk.data.width as number;
        TARGA_FILE_HEADER.height = textureHeaderChunk.data.height as number;

        // Targa Header
        targaFileHeader[0] = TARGA_FILE_HEADER.idLength;
        targaFileHeader[1] = TARGA_FILE_HEADER.colorMapType;
        targaFileHeader[2] = TARGA_FILE_HEADER.imageType;

        // Color Map Specification
        targaFileHeader[3] = TARGA_FILE_HEADER.firstEntryIndex;
        targaFileHeader[4] = TARGA_FILE_HEADER.firstEntryIndex >> 8;
        targaFileHeader[5] = TARGA_FILE_HEADER.colorMapLength;
        targaFileHeader[6] = TARGA_FILE_HEADER.colorMapLength >> 8;
        targaFileHeader[7] = TARGA_FILE_HEADER.colorMapEntrySize;

        // Image Specification
        targaFileHeader[8] = TARGA_FILE_HEADER.xOrigin;
        targaFileHeader[9] = TARGA_FILE_HEADER.xOrigin >> 8;
        targaFileHeader[10] = TARGA_FILE_HEADER.yOrigin;
        targaFileHeader[11] = TARGA_FILE_HEADER.yOrigin >> 8;
        targaFileHeader[12] = TARGA_FILE_HEADER.width;
        targaFileHeader[13] = TARGA_FILE_HEADER.width >> 8;
        targaFileHeader[14] = TARGA_FILE_HEADER.height;
        targaFileHeader[15] = TARGA_FILE_HEADER.height >> 8;
        targaFileHeader[16] = TARGA_FILE_HEADER.pixelDepth;
        targaFileHeader[17] = TARGA_FILE_HEADER.imageDescriptor;

        // if (i == 11) {

        // Create the Targa data
        const allocatedBytes = TARGA_FILE_HEADER.pixelDepth / 8;
        const targaDataSize = TARGA_FILE_HEADER.width * TARGA_FILE_HEADER.height * allocatedBytes;
        const targaData: Uint8Array = new Uint8Array(targaDataSize);

        // console.log(
        //     "i:", i,
        //     " | textureType:", textureType,
        //     " | targaDataSize:", targaDataSize,
        //     " | textureData len:", textureData.length,
        //     " | PixelColorData len:", pixelColorData.length
        // );

        // Targa Data
        // for (let j = 0; j < targaDataSize; j += allocatedBytes) {
        //     let currRGBA: NsBin.binTextureRGBAData;
        //     const index = textureData[j / allocatedBytes];

        //     if (textureType === "PALETTE_4") {
        //         const index1 = (index & 0b11110000) >> 4;
        //         const index2 = (index & 0b00001111);

        //         currRGBA = pixelColorData[index1];
        //         targaData[j] = currRGBA.B;
        //         targaData[j + 1] = currRGBA.G;
        //         targaData[j + 2] = currRGBA.R;
        //         targaData[j + 3] = currRGBA.A;

        //         currRGBA = pixelColorData[index2];
        //         targaData[j + 4] = currRGBA.B;
        //         targaData[j + 5] = currRGBA.G;
        //         targaData[j + 6] = currRGBA.R;
        //         targaData[j + 7] = currRGBA.A;

        //         continue;
        //     }

        //     currRGBA = pixelColorData[index];

        //     if (currRGBA === undefined) {
        //         console.log(
        //             " | textureType:", textureType,
        //             " | Index:", index,
        //             " | J:", j,
        //             " | J / allocatedBytes:", j / allocatedBytes,
        //             " | textureData len:", textureData.length,
        //             " | PixelColorData len:", pixelColorData.length
        //         );
        //         continue;
        //     }

        //     targaData[j] = currRGBA.B;
        //     targaData[j + 1] = currRGBA.G;
        //     targaData[j + 2] = currRGBA.R;
        //     targaData[j + 3] = currRGBA.A;
        // }
        // }

        // Get the final Targa in Uint8Array format
        const targa = concatenateUint8Arrays([
            targaFileHeader,
            targaData
        ]);

        // Write the Targa file
        const targaFilename = `${getFileName(binFilePath, false)}_${i}.tga`;
        const targaOutputFilePath = path.join(outputDirPath, targaFilename);
        fs.writeFileSync(targaOutputFilePath, targa);

        // Increment the counters
        counters.targaFiles++;
    }

    logger.info(`Dumped ${counters.fontDescs.toLocaleString("en-US")} font desc(s)`);
    logger.info(`Dumped ${counters.targa1.toLocaleString("en-US")} Targa 1`);
    logger.info(`Dumped ${counters.targa2.toLocaleString("en-US")} Targa 2`);
    logger.info(`Dumped ${counters.missingPalettes.toLocaleString("en-US")} missing palette(s)`);
    logger.info(`Dumped ${counters.weirdPalettes.toLocaleString("en-US")} weird palette(s)`);
    logger.info(`Dumped ${counters.targaFiles.toLocaleString("en-US")} TARGA (TGA) file(s)`);
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
    // Add a folder to the output path (filename without extension)
    outputDirPath = path.join(outputDirPath, getFileName(binFilePath));

    extractorChecker(binFilePath, "bin file", ".bin", outputDirPath);

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

    logger.info(`Successfully extracted textures: '${getFileName(binFilePath)}' => '${outputDirPath}'.`);
}