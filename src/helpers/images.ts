import fs from "fs";
import path from "path";

import { convertNumberToUint8Array, convertStringToUint8Array } from "helpers/bytes";
import logger from "helpers/logger";
import { calculateChunkCRC32_IEEE } from "helpers/maths";
import NsBytes from "types/bytes";


/**
 * Creates a PNG header (Big Endian)
 * @returns The PNG header.
 */
function createPNGHeader(): Uint8Array {
    logger.info("Creating PNG header..");

    const header = new Uint8Array(8);

    header[0] = 0x89;  // System flag

    // PNG flag
    const PNGFlag = convertStringToUint8Array("PNG", false, "ASCII");
    header.set(PNGFlag, 1);

    header[4] = 0x0D;  // DOS line ending (CRLF)
    header[5] = 0x0A;  // DOS line ending (CRLF)
    header[6] = 0x1A;  // DOS end of file
    header[7] = 0x0A;  // DOS line ending (LF)

    return header;
}

/**
 * Creates a PNG IHDR chunk.
 * @param width The width of the image.
 * @param height The height of the image.
 * @param bitDepth The bit depth of the image (8 bits only).
 * @param colorType The color type of the image (2 | 6 for RGB | RGBA).
 * @returns The PNG IHDR chunk.
 */
function createPNGIHDRChunk(
    width: number,
    height: number,
    bitDepth: 8,
    colorType: 2 | 6
): Uint8Array {
    logger.info("Creating PNG IHDR chunk..");

    const chunk = new Uint8Array(25);

    // Chunk size
    const chunkSize = convertNumberToUint8Array(13, 4, false);
    chunk.set(chunkSize, 0);

    // Chunk type
    const chunkType = convertStringToUint8Array("IHDR", false, "ASCII");
    chunk.set(chunkType, 4);

    // Width
    const widthBytes = convertNumberToUint8Array(width, 4, false);
    chunk.set(widthBytes, 8);

    // Height
    const heightBytes = convertNumberToUint8Array(height, 4, false);
    chunk.set(heightBytes, 12);

    // Settings
    chunk[16] = bitDepth;
    chunk[17] = colorType;
    chunk[18] = 0x00;  // Compression method (0 = deflate)
    chunk[19] = 0x00;  // Filter method (0 = adaptive)
    chunk[20] = 0x00;  // Interlace method (0 = none)

    // CRC
    const CRC = calculateChunkCRC32_IEEE(chunk);
    chunk.set(CRC, 21);

    return chunk;
}

/**
 * Creates a PNG sRGB chunk.
 * @returns The PNG sRGB chunk.
 */
function createPNGsRGBChunk(): Uint8Array {
    logger.info("Creating PNG sRGB chunk..");

    const chunk = new Uint8Array(13);

    // Chunk size
    const chunkSize = convertNumberToUint8Array(1, 4, false);
    chunk.set(chunkSize, 0);

    // Chunk type
    const chunkType = convertStringToUint8Array("sRGB", false, "ASCII");
    chunk.set(chunkType, 4);

    // Rendering intent
    chunk[8] = 0x00;  // Perceptual

    // CRC
    const CRC = calculateChunkCRC32_IEEE(chunk);
    chunk.set(CRC, 9);

    return chunk;
}

/**
 * Creates a PNG IDAT chunk.
 * @param bitDepth The bit depth of the image (8 bits only).
 * @param colorType The color type of the image.
 * @param pixels The pixels of the image (RGBA array)
 * @returns The PNG IDAT chunk.
 */
function createPNGIDATChunk(
    bitDepth: 8,
    colorType: 2 | 6,
    pixels: NsBytes.IsRGBAColor[] | NsBytes.IsRGBColor[]
) {
    logger.info("Creating PNG IDAT chunk..");

    const componentsPerPixel = Object.keys(pixels[0]).length;
    const bytesPerPixel = (bitDepth * componentsPerPixel) / 8;
    const chunkSize = pixels.length * bytesPerPixel;

    const chunk = new Uint8Array(8 + chunkSize + 4);

    logger.verbose(`>> Chunk size: ${chunk.length} bytes (8 + ${chunkSize} + 4).`);

    // Chunk size
    const chunkSizeBytes = convertNumberToUint8Array(chunkSize, 4, false);
    chunk.set(chunkSizeBytes, 0);

    // Chunk type
    const chunkType = convertStringToUint8Array("IDAT", false, "ASCII");
    chunk.set(chunkType, 4);

    // Use RGBA or RGB
    const usesRGBA = colorType === 6;

    // Data
    let index = 8;

    if (!usesRGBA) {
        for (const pixel of pixels) {
            chunk[index++] = pixel.R;
            chunk[index++] = pixel.G;
            chunk[index++] = pixel.B;
        }
    } else {
        const rgbaPixels = pixels as NsBytes.IsRGBAColor[];
        for (const pixel of rgbaPixels) {
            chunk[index++] = pixel.R;
            chunk[index++] = pixel.G;
            chunk[index++] = pixel.B;
            chunk[index++] = pixel.A;
        }
    }

    // CRC
    const CRC = calculateChunkCRC32_IEEE(chunk);
    chunk.set(CRC, index);

    return chunk;
}

/**
 * Creates a PNG IEND chunk.
 * @returns The PNG IEND chunk.
 */
function createPNGIENDChunk() {
    logger.info("Creating PNG IEND chunk..");

    const chunk = new Uint8Array(12);

    // Chunk size
    const chunkSize = convertNumberToUint8Array(0, 4, false);
    chunk.set(chunkSize, 0);

    // Chunk type
    const chunkType = convertStringToUint8Array("IEND", false, "ASCII");
    chunk.set(chunkType, 4);

    // CRC (reversed)
    const CRC = calculateChunkCRC32_IEEE(chunk);
    chunk.set(CRC, 8);

    return chunk;
}

/**
 * Generates a PNG image.
 * @param outputDirPath The output directory path.
 * @param filename The filename.
 * @param width The width of the image.
 * @param height The height of the image.
 * @param pixels The pixels of the image (RGBA array)
 * @link http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html
 * @link https://zestedesavoir.com/billets/4045/faconner-un-fichier-png-a-la-main/
 * @link https://www.w3.org/TR/PNG
 * @link https://en.wikipedia.org/wiki/PNG
 */
export function generatePNG(
    outputDirPath: string,
    filename: string,
    width: number,
    height: number,
    pixels: NsBytes.IsRGBAColor[] | NsBytes.IsRGBColor[]
) {
    logger.info(`Generating '${filename}.png'.`);

    if (pixels.length !== width * height) {
        logger.error("The number of pixels does not match the width and height of the image.");
        return;
    }

    // Determine the color type based on RGBA or RGB
    let colorType: 2 | 6 = 2;  // Color used (2)

    if (pixels[0].hasOwnProperty("A")) {
        colorType = 6;  // Color used (2) + alpha channel (4)
    }

    logger.info(`Using ${colorType === 2 ? "'RGB'" : "'RGBA'"} color type.`);

    const header = createPNGHeader();
    const IHDRChunk = createPNGIHDRChunk(width, height, 8, colorType);
    const sRGBChunk = createPNGsRGBChunk();
    const IDATChunk = createPNGIDATChunk(8, colorType, pixels);
    const IENDChunk = createPNGIENDChunk();

    // Concatenate the header & the chunks
    const png = new Uint8Array([
        ...header,
        ...IHDRChunk,
        ...sRGBChunk,
        ...IDATChunk,
        ...IENDChunk
    ]);

    const filePath = path.join(outputDirPath, `${filename}.png`);
    fs.writeFileSync(filePath, png);

    logger.info(`Successfully created the PNG file: '${filename}' => '${outputDirPath}'.`);
}