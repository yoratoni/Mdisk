import fs from "fs";
import path from "path";

import { convertNumberArrayToUint8Array, convertNumberToUint8Array, convertStringToUint8Array } from "helpers/bytes";
import logger from "helpers/logger";
import NsBytes from "types/bytes";


/**
 * Creates a BMP header (Little Endian).
 * @param fileSize The size of the file in bytes (without the header length).
 * @param offset The offset of the pixel array in bytes (without the header length).
 * @returns The BMP header.
 */
function createBMPHeader(
    fileSize: number,
    offset: number
): Uint8Array {
    logger.info("Creating BMP header..");

    const header = new Uint8Array(14);

    // BMP flag ("BM" - ASCII)
    const BMPFlag = convertStringToUint8Array("BM", false, "ASCII");
    header.set(BMPFlag, 0);

    // File size
    const fileSizeBytes = convertNumberToUint8Array(header.length + fileSize, 4, true);
    header.set(fileSizeBytes, 2);

    // Reserved bytes (0x0000)
    const reservedBytes = new Uint8Array(4);
    header.set(reservedBytes, 6);

    // Offset
    const offsetBytes = convertNumberToUint8Array(header.length + offset, 4, true);
    header.set(offsetBytes, 10);

    return header;
}

/**
 * Creates a BITMAPINFOHEADER DIB header (Little Endian).
 * @param width The width of the image in pixels.
 * @param height The height of the image in pixels.
 * @param bitDepth The bit depth of the image (should be 24).
 * @param pixelArrayLength The length of the pixel array.
 * @param DPI The DPI of the image.
 */
function createDIBHeader_BITMAPINFOHEADER(
    width: number,
    height: number,
    bitDepth: number,
    pixelArrayLength: number,
    DPI: number
) {
    logger.info("Creating DIB header (BITMAPINFOHEADER)..");

    const header = new Uint8Array(40);

    // Header size
    const headerSize = convertNumberToUint8Array(header.length, 4, true);
    header.set(headerSize, 0);

    // Width
    const widthBytes = convertNumberToUint8Array(width, 4, true);
    header.set(widthBytes, 4);

    // Height
    const heightBytes = convertNumberToUint8Array(height, 4, true);
    header.set(heightBytes, 8);

    // Planes (1)
    const planes = convertNumberToUint8Array(1, 2, true);
    header.set(planes, 12);

    // Bit depth
    const bitDepthBytes = convertNumberToUint8Array(bitDepth, 2, true);
    header.set(bitDepthBytes, 14);

    // Compression (0 - BI_RGB)
    const compression = convertNumberToUint8Array(0, 4, true);
    header.set(compression, 16);

    // Image size
    const dataSize = convertNumberToUint8Array(pixelArrayLength, 4, true);
    header.set(dataSize, 20);

    // Calculate PPM (pixels per meter)
    const PPM = Math.round(DPI * 39.3701);

    // Horizontal resolution
    const horizontalResolution = convertNumberToUint8Array(PPM, 4, true);
    header.set(horizontalResolution, 24);

    // Vertical resolution
    const verticalResolution = convertNumberToUint8Array(PPM, 4, true);
    header.set(verticalResolution, 28);

    // Colors in color palette (0 - no color palette)
    const colorsInColorPalette = convertNumberToUint8Array(0, 4, true);
    header.set(colorsInColorPalette, 32);

    // Important colors (0 - all colors are important)
    const importantColors = convertNumberToUint8Array(0, 4, true);
    header.set(importantColors, 36);

    return header;
}

/**
 * Creates a BITMAPV4HEADER DIB header (Little Endian).
 * @param width The width of the image in pixels.
 * @param height The height of the image in pixels.
 * @param bitDepth The bit depth of the image (should be 32).
 * @param pixelArrayLength The length of the pixel array.
 * @param DPI The DPI of the image.
 */
function createDIBHeader_BITMAPV4HEADER(
    width: number,
    height: number,
    bitDepth: number,
    pixelArrayLength: number,
    DPI: number
) {
    logger.info("Creating DIB header (BITMAPV4HEADER)..");

    const header = new Uint8Array(108);

    // Header size
    const headerSize = convertNumberToUint8Array(header.length, 4, true);
    header.set(headerSize, 0);

    // Width
    const widthBytes = convertNumberToUint8Array(width, 4, true);
    header.set(widthBytes, 4);

    // Height
    const heightBytes = convertNumberToUint8Array(height, 4, true);
    header.set(heightBytes, 8);

    // Planes (1)
    const planes = convertNumberToUint8Array(1, 2, true);
    header.set(planes, 12);

    // Bit depth
    const bitDepthBytes = convertNumberToUint8Array(bitDepth, 2, true);
    header.set(bitDepthBytes, 14);

    // Compression (3 - BI_BITFIELDS)
    const compression = convertNumberToUint8Array(3, 4, true);
    header.set(compression, 16);

    // Data size
    const dataSize = convertNumberToUint8Array(pixelArrayLength, 4, true);
    header.set(dataSize, 20);

    // Calculate PPM (pixels per meter)
    const PPM = Math.round(DPI * 39.3701);

    // Horizontal resolution
    const horizontalResolution = convertNumberToUint8Array(PPM, 4, true);
    header.set(horizontalResolution, 24);

    // Vertical resolution
    const verticalResolution = convertNumberToUint8Array(PPM, 4, true);
    header.set(verticalResolution, 28);

    // Colors in color palette (0 - no color palette)
    const colorsInColorPalette = convertNumberToUint8Array(0, 4, true);
    header.set(colorsInColorPalette, 32);

    // Important colors (0 - all colors are important)
    const importantColors = convertNumberToUint8Array(0, 4, true);
    header.set(importantColors, 36);

    // Red channel bit mask
    const redChannelBitMask = convertNumberToUint8Array(0x00FF0000, 4, true);
    header.set(redChannelBitMask, 40);

    // Green channel bit mask
    const greenChannelBitMask = convertNumberToUint8Array(0x0000FF00, 4, true);
    header.set(greenChannelBitMask, 44);

    // Blue channel bit mask
    const blueChannelBitMask = convertNumberToUint8Array(0x000000FF, 4, true);
    header.set(blueChannelBitMask, 48);

    // Alpha channel bit mask
    const alphaChannelBitMask = convertNumberToUint8Array(0xFF000000, 4, true);
    header.set(alphaChannelBitMask, 52);

    // Color space type (LCS_sRGB)
    const colorSpaceType = convertStringToUint8Array("sRGB", false);
    header.set(colorSpaceType, 56);

    // CIEXYZTRIPLE Color Space endpoints (0 - unused)
    const colorSpaceEndpoints = new Uint8Array(36);
    header.set(colorSpaceEndpoints, 60);

    // Red gamma (unused)
    const redGamma = convertNumberToUint8Array(0, 4, true);
    header.set(redGamma, 96);

    // Green gamma (unused)
    const greenGamma = convertNumberToUint8Array(0, 4, true);
    header.set(greenGamma, 100);

    // Blue gamma (unused)
    const blueGamma = convertNumberToUint8Array(0, 4, true);
    header.set(blueGamma, 104);

    return header;
}

/**
 * Generates a BMP image.
 * @param outputDirPath The output directory path.
 * @param filename The filename of the image.
 * @param width The width of the image in pixels.
 * @param height The height of the image in pixels.
 * @param pixelArray The pixel array of the image.
 * @param bitDepth The bit depth of the image (optional, defaults to 32).
 * @param DPI The DPI of the image (optional, defaults to 72).
 * @link https://en.wikipedia.org/wiki/BMP_file_format
 */
export function generateBMPImage(
    outputDirPath: string,
    filename: string,
    width: number,
    height: number,
    pixelArray: NsBytes.IsRGBAColor[] | NsBytes.IsRGBColor[],
    DPI = 72
) {
    logger.info("Creating BMP image..");

    // Calculate bit depth
    const bitDepth = Object.keys(pixelArray[0]).length * 8;

    if (bitDepth !== 24 && bitDepth !== 32) {
        logger.error(`Invalid bit depth: ${bitDepth}.`);
        return;
    }

    // Is RGBA or RGB
    const isRGBA = bitDepth === 32;

    // The final array containing the BMP image
    const finalArray: number[] = [];

    if (!isRGBA) {
        // RGB
        const rgbArray = pixelArray as NsBytes.IsRGBColor[];

        for (let i = 0; i < rgbArray.length; i++) {
            finalArray.push(
                rgbArray[i].B,
                rgbArray[i].G,
                rgbArray[i].R
            );

            // Add 2 bytes padding every two pixels
            // Based on length of final array without padding
            if (i > 0 && (i - 1) % 2 === 0) {
                finalArray.push(0x00, 0x00);
            }
        }
    } else {
        // RGBA
        const rgbaArray = pixelArray as NsBytes.IsRGBAColor[];

        for (let i = 0; i < rgbaArray.length; i++) {
            finalArray.push(
                rgbaArray[i].B,
                rgbaArray[i].G,
                rgbaArray[i].R,
                rgbaArray[i].A
            );
        }
    }

    // Convert final array to Uint8Array
    const pixelUint8Array = convertNumberArrayToUint8Array(finalArray);

    /**
     * Note: BMP header & DIB header contains information about the image
     * so we need to create the final pixel array first before creating the headers.
     */

    // Create DIB header
    let dibHeader: Uint8Array;

    if (!isRGBA) {
        // RGB
        dibHeader = createDIBHeader_BITMAPINFOHEADER(width, height, bitDepth, pixelUint8Array.length, DPI);
    } else {
        // RGBA
        dibHeader = createDIBHeader_BITMAPV4HEADER(width, height, bitDepth, pixelUint8Array.length, DPI);
    }

    // Create BMP header
    const header = createBMPHeader(dibHeader.length + pixelUint8Array.length, dibHeader.length);

    // Create BMP Uint8Array
    const bmpImage = new Uint8Array(header.length + dibHeader.length + pixelUint8Array.length);

    // Combine header and pixel arrays
    bmpImage.set([...header, ...dibHeader, ...pixelUint8Array], 0);

    // Write to file
    const outputFilePath = path.join(outputDirPath, `${filename}.bmp`);
    fs.writeFileSync(outputFilePath, bmpImage);

    logger.info(`Successfully generated the BMP image: '${filename}' => '${outputDirPath}'.`);
}