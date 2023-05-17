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
function sortChunks(rawChunks: NsBytes.IsMappingByteObjectResultWithEmptiness[]) {
    logger.info("Sorting chunks..");

    const chunks: NsBin.IsBinFileTextureSeparatedChunks = {
        fonts: [],
        palettes: [],
        textures: [],

        targa1: [],
        NoDataTarga1: [],
        targa2: [],
        NoDataTarga2: [],

        links: [],
        paletteKeys: [],
        textureKeys: [],

        linkedPalettes: {},
        linkedTextures: {}
    };

    for (const { index, chunk } of rawChunks.map((chunk, index) => ({ index, chunk }))) {
        const chunkType = chunk.data.chunkType as string;
        const chunkData = chunk.data.data as Uint8Array;
        const isEmpty = (chunk.isEmpty as boolean) || chunkData.length == 0;

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

        // Font desc
        if (chunkType === TEXTURE_FILE_CONFIG.fontDescMagic) {
            chunks.fonts[index - 1] = chunk;
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
    const paletteHeaders = rawChunks.filter((rawChunk) => {
        const chunkType = rawChunk.data.chunkType as string;

        // Palette 4 & palette 8 with no data
        return (chunkType === "PALETTE_4" || chunkType === "PALETTE_8") && rawChunk.isEmpty;
    });

    for (let i = 0; i < distinctTextureKeys.length; i++) {
        try {
            chunks.linkedTextures[distinctTextureKeys[i]] = paletteHeaders[i];
        } catch (e) {
            // Doing nothing (sometimes, distinctTextureKeys > paletteHeaders)
        }
    }

    logger.info(`Found ${chunks.palettes.length.toLocaleString("en-US")} palettes..`);
    logger.info(`Found ${chunks.textures.length.toLocaleString("en-US")} textures..`);
    logger.info(`Found ${chunks.targa1.length.toLocaleString("en-US")} Targa 1 (TGA)..`);
    logger.info(`Found ${chunks.targa2.length.toLocaleString("en-US")} Targa 2 (TGA)..`);
    logger.info(`Found ${chunks.fonts.length.toLocaleString("en-US")} fonts..`);
    logger.info(`Found ${chunks.paletteKeys.length.toLocaleString("en-US")} palette keys..`);
    logger.info(`Found ${chunks.textureKeys.length.toLocaleString("en-US")} texture keys..`);
    logger.info(`Found ${chunks.links.length.toLocaleString("en-US")} links..`);
    logger.info("Chunks sorted..");

    return chunks;
}

/**
 * Dump the textures.
 * @param outputDirPath The output directory path.
 * @param binFilePath The bin file path.
 * @param rawChunks The raw chunks.
 * @param sortedChunks The sorted chunks.
 */
function dumpTextures(
    outputDirPath: string,
    binFilePath: string,
    rawChunks: NsBytes.IsMappingByteObjectResultWithEmptiness[],
    sortedChunks: NsBin.IsBinFileTextureSeparatedChunks,
) {
    logger.info("Dumping textures..");

    const remainingTextures = rawChunks.filter((rawChunk) => {
        const chunkType = rawChunk.data.chunkType as string;

        return (
            chunkType != "PALETTE_4" &&
            chunkType != "PALETTE_8" &&
            chunkType != "TARGA_1" &&
            chunkType != "TARGA_2" &&
            chunkType != "PALETTE_LINK" &&
            chunkType != "PALETTE" &&
            chunkType != TEXTURE_FILE_CONFIG.fontDescMagic
        ) && rawChunk.data.data != undefined && !rawChunk.isEmpty;
    });

    // Dump remaining textures
    for (const remainingTexture of remainingTextures) {
        const chunkType = remainingTexture.data.chunkType as string;

        // Filename: index_chunkType.bin
        const filename = `${rawChunks.indexOf(remainingTexture)}_${chunkType}.bin`;

        const outputFilePath = path.join(outputDirPath, filename);
        fs.writeFileSync(outputFilePath, remainingTexture.data.data as Uint8Array);
    }

    logger.info(`Dumped ${remainingTextures.length.toLocaleString("en-US")} remaining texture(s)..`);

    // Total length of textures
    const totalLength = sortedChunks.paletteKeys.length + sortedChunks.targa1.length + sortedChunks.targa2.length;

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
        const texture = sortedChunks.textures[i];
        const textureIndex = rawChunks.indexOf(texture);
        const textureData = texture.data.data as Uint8Array;
        const textureType = texture.data.chunkType as string;
        const textureHeader = sortedChunks.linkedTextures[sortedChunks.textureKeys[i]];

        // Filename: index_textureType.tga
        const filename = `${rawChunks.indexOf(texture)}_${textureType}.tga`;
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
        if (i >= sortedChunks.paletteKeys.length) {
            const missingPaletteFilename = `${i}_MISSING_PALETTE.bin`;
            const missingPaletteOutputFilePath = path.join(outputDirPath, missingPaletteFilename);
            fs.writeFileSync(missingPaletteOutputFilePath, textureData);

            counters.missingPalettes++;
            continue;
        }

        // Link texture chunk without data to the one with data and vice versa
        textureHeader.data.linkedIndex = textureIndex;
        texture.data.linkedIndex = rawChunks.indexOf(textureHeader);

        // Link texture chunk with data to palette link
        sortedChunks.links[i].data.linkedIndex = textureIndex;

        // Palette info
        const linkedPalette = sortedChunks.linkedPalettes[sortedChunks.paletteKeys[i]];
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

        // Get the final palette data (BGR or BGRA)
        const palette: NsBin.IsBinTextureBGRAData[] = [];

        let pointer = 0;
        while (pointer < linkedPaletteData.length) {
            const color: NsBin.IsBinTextureBGRAData = {
                B: 0,
                G: 0,
                R: 0,
                A: 0xFF
            };

            if (usesRGBA) {
                color.B = linkedPaletteData[pointer];
                color.G = linkedPaletteData[pointer + 1];
                color.R = linkedPaletteData[pointer + 2];
                color.A = linkedPaletteData[pointer + 3];

                pointer += 4;
            } else {
                color.B = linkedPaletteData[pointer];
                color.G = linkedPaletteData[pointer + 1];
                color.R = linkedPaletteData[pointer + 2];

                pointer += 3;
            }

            palette.push(color);
        }

        // Specs:
        // - https://www.fileformat.info/format/tga/egff.htm
        // - https://en.wikipedia.org/wiki/Truevision_TGA
        // - http://www.paulbourke.net/dataformats/tga/

        // Set the Targa file header image width and height
        TARGA_FILE_HEADER.width = textureHeader.data.width as number;
        TARGA_FILE_HEADER.height = textureHeader.data.height as number;

        // Create the Targa file
        const targaHeader = new Uint8Array(TARGA_FILE_HEADER.headerLength);

        // Targa Header
        targaHeader[0] = TARGA_FILE_HEADER.idLength;
        targaHeader[1] = TARGA_FILE_HEADER.colorMapType;
        targaHeader[2] = TARGA_FILE_HEADER.imageType;

        // Color Map Specification
        targaHeader[3] = TARGA_FILE_HEADER.firstEntryIndex;
        targaHeader[4] = TARGA_FILE_HEADER.firstEntryIndex >> 8;
        targaHeader[5] = TARGA_FILE_HEADER.colorMapLength;
        targaHeader[6] = TARGA_FILE_HEADER.colorMapLength >> 8;
        targaHeader[7] = TARGA_FILE_HEADER.colorMapEntrySize;

        // Image Specification
        targaHeader[8] = TARGA_FILE_HEADER.xOrigin;
        targaHeader[9] = TARGA_FILE_HEADER.xOrigin >> 8;
        targaHeader[10] = TARGA_FILE_HEADER.yOrigin;
        targaHeader[11] = TARGA_FILE_HEADER.yOrigin >> 8;
        targaHeader[12] = TARGA_FILE_HEADER.width;
        targaHeader[13] = TARGA_FILE_HEADER.width >> 8;
        targaHeader[14] = TARGA_FILE_HEADER.height;
        targaHeader[15] = TARGA_FILE_HEADER.height >> 8;
        targaHeader[16] = TARGA_FILE_HEADER.pixelDepth;
        targaHeader[17] = TARGA_FILE_HEADER.imageDescriptor;

        // Create the Targa raw data
        const targaRawData: number[] = [];

        let test = 0;

        // Targa Data
        for (const index of textureData) {
            let color: NsBin.IsBinTextureBGRAData;

            if (index > test) {
                test = index;
            }

            if (textureType === "PALETTE_4") {
                const index1 = (index & 0xf0) >> 4;
                const index2 = (index & 0x0f);

                color = palette[index1];
                targaRawData.push(
                    color.B,
                    color.G,
                    color.R,
                    color.A
                );

                color = palette[index2];
                targaRawData.push(
                    color.B,
                    color.G,
                    color.R,
                    color.A
                );

                continue;
            }

            color = palette[index % palette.length];
            targaRawData.push(
                color.B,
                color.G,
                color.R,
                color.A
            );
        }

        // console.log(test, palette.length);

        // Convert the Targa data to Uint8Array
        const targaData = convertNumberArrayToUint8Array(targaRawData);

        // Get the final Targa content in Uint8Array format
        const targa = concatenateUint8Arrays([
            targaHeader,
            targaData
        ]);

        // Write the Targa file
        const targaFilename = `${getFileName(binFilePath, false)}_${i}.tga`;
        const targaOutputFilePath = path.join(outputDirPath, targaFilename);
        fs.writeFileSync(targaOutputFilePath, targa);

        // Increment the counters
        counters.targaFiles++;
    }

    // Dump metadata file
    const filename = path.basename(binFilePath, path.extname(binFilePath));

    const metadataPath = path.join(outputDirPath, `${filename}.json`);
    if (!fs.existsSync(metadataPath)) {
        // Remove the data from the chunks
        const noDataChunks = rawChunks.map((chunk) => {
            chunk.data.data = undefined;
            return chunk;
        });

        exportAsJson(noDataChunks, outputDirPath, `${filename}.json`);
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

    const sortedChunks = sortChunks(
        rawChunks
    );

    dumpTextures(
        outputDirPath,
        binFilePath,
        rawChunks,
        sortedChunks
    );

    logger.info(`Successfully extracted textures: '${getFileName(binFilePath)}' => '${outputDirPath}'.`);
}