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
 * Generates a BMP grayscale image from a Uint8Array,
 * where each pixel is represented by 1 byte of the input array.
 *
 * Used to analyze binary data so the BMP image is reversed to match first byte of the file.
 * @param outputDirPath The output directory path
 * @param filename The filename of the image (without the extension).
 * @param input The Uint8Array to generate the image from.
 * @param bytesPerRow Bytes per row on the image (optional, defaults to 16, -1 = squared image).
 * @link https://en.wikipedia.org/wiki/BMP_file_format
 */
export function generateBMPGrayscaleFromUint8Array(
    outputDirPath: string,
    filename: string,
    input: Uint8Array,
    bytesPerRow = 16
) {
    logger.info("Generating BMP grayscale image from Uint8Array..");

    // Byte depth (grayscale)
    // Using 3 same values for RGB24 with 8 bit depth (no palette)
    const byteDepth = 3;

    // Bit depth (grayscale)
    // Using 3 same values for RGB24 with 8 bit depth (no palette)
    const bitDepth = byteDepth * 8;

    // Verify bytes per row
    if (bytesPerRow > input.length) {
        logger.error("Invalid bytes per row!");
        return;
    }

    // Calculate height
    let height: number;

    if (bytesPerRow < 0) {
        // Square image (sqrt)
        height = Math.floor(Math.sqrt(input.length));
    } else {
        // Number of rows
        height = Math.floor(input.length / bytesPerRow);
    }

    // Calculate width (if bytesPerRow is -1, width = height)
    const width = bytesPerRow < 0 ? height : bytesPerRow;

    logger.info(`Guessed dimensions: ${width}x${height}`);

    // Convert the Uint8Array to a number array
    const nbArray: number[] = [];

    // Generate pixel array
    const bmpBytesPerRow = width * byteDepth;
    const paddingBytes = (4 - (bmpBytesPerRow % 4)) % 4;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x);

            nbArray.push(
                input[index],
                input[index],
                input[index]
            );
        }

        // Add padding bytes
        for (let p = 0; p < paddingBytes; p++) {
            nbArray.push(0x00);
        }
    }

    // Convert the number array to a Uint8Array
    const pixelUint8Array = convertNumberArrayToUint8Array(nbArray);

    // Reverse the pixel array (y-axis)
    pixelUint8Array.reverse();

    // Reverse the pixel array (x-axis)
    for (let y = 0; y < height; y++) {
        const row = pixelUint8Array.slice(y * bmpBytesPerRow, (y + 1) * bmpBytesPerRow);
        row.reverse();

        pixelUint8Array.set(row, y * bmpBytesPerRow);
    }

    // Create DIB header
    const dibHeader = createDIBHeader_BITMAPINFOHEADER(
        width,
        height,
        bitDepth,
        pixelUint8Array.length,
        72
    );

    // Create BMP header
    const header = createBMPHeader(dibHeader.length + pixelUint8Array.length, dibHeader.length);

    logger.info("Creating BMP Uint8Array..");

    // Create BMP Uint8Array
    const bmpImage = new Uint8Array(header.length + dibHeader.length + pixelUint8Array.length);

    logger.info("Combining BMP/DIB header and pixel array..");

    // Combine header and pixel arrays
    bmpImage.set(header, 0);
    bmpImage.set(dibHeader, header.length);
    bmpImage.set(pixelUint8Array, header.length + dibHeader.length);

    logger.info("Writing BMP grayscale to file..");

    // Write to file
    const outputFilePath = path.join(outputDirPath, `${filename}.bmp`);
    fs.writeFileSync(outputFilePath, bmpImage);

    logger.info(`Successfully generated the BMP grayscale from Uint8Array: '${filename}' => '${outputDirPath}'.`);
}

/**
 * Generates a BMP image from a Uint8Array (RGB square image),
 * where each pixel is represented by 3 bytes of the input array.
 *
 * Used to analyze binary data so the BMP image is reversed to match first byte of the file.
 * @param outputDirPath The output directory path
 * @param filename The filename of the image (without the extension).
 * @param input The Uint8Array to generate the image from.
 * @link https://en.wikipedia.org/wiki/BMP_file_format
 */
export function generateBMPImageFromUint8Array(
    outputDirPath: string,
    filename: string,
    input: Uint8Array
) {
    logger.info("Generating BMP image from Uint8Array..");

    // Byte depth (RGB)
    const byteDepth = 3;

    // Bit depth (RGB)
    const bitDepth = byteDepth * 8;

    // Calculate width & height
    const width = Math.floor(Math.sqrt(input.length / byteDepth));
    const height = width;

    logger.info(`Guessed dimensions: ${width}x${height} pixels.`);

    // Convert the Uint8Array to a number array
    const nbArray: number[] = [];

    // Generate pixel array
    const bytesPerRow = width * byteDepth;
    const paddingBytes = (4 - (bytesPerRow % 4)) % 4;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * byteDepth;

            nbArray.push(
                input[index],
                input[index + 1],
                input[index + 2]
            );
        }

        // Add padding bytes
        for (let p = 0; p < paddingBytes; p++) {
            nbArray.push(0x00);
        }
    }

    // Convert the number array to a Uint8Array
    const pixelUint8Array = convertNumberArrayToUint8Array(nbArray);

    // Reverse the pixel array (y-axis)
    pixelUint8Array.reverse();

    // Reverse the pixel array (x-axis)
    for (let y = 0; y < height; y++) {
        const row = pixelUint8Array.slice(y * bytesPerRow, (y + 1) * bytesPerRow);
        row.reverse();

        pixelUint8Array.set(row, y * bytesPerRow);
    }

    // Create DIB header
    const dibHeader = createDIBHeader_BITMAPINFOHEADER(
        width,
        height,
        bitDepth,
        pixelUint8Array.length,
        72
    );

    // Create BMP header
    const header = createBMPHeader(dibHeader.length + pixelUint8Array.length, dibHeader.length);

    logger.info("Creating BMP Uint8Array..");

    // Create BMP Uint8Array
    const bmpImage = new Uint8Array(header.length + dibHeader.length + pixelUint8Array.length);

    logger.info("Combining BMP/DIB header and pixel array..");

    // Combine header and pixel arrays
    bmpImage.set(header, 0);
    bmpImage.set(dibHeader, header.length);
    bmpImage.set(pixelUint8Array, header.length + dibHeader.length);

    logger.info("Writing BMP image to file..");

    // Write to file
    const outputFilePath = path.join(outputDirPath, `${filename}.bmp`);
    fs.writeFileSync(outputFilePath, bmpImage);

    logger.info(`Successfully generated the BMP image from Uint8Array: '${filename}' => '${outputDirPath}'.`);
}

/**
 * Generates a BMP image.
 * @param outputDirPath The output directory path.
 * @param filename The filename of the image (without the extension).
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
    logger.info("Generating BMP image..");

    // Calculate byte depth
    const byteDepth = Object.keys(pixelArray[0]).length;

    // Calculate bit depth
    const bitDepth = byteDepth * 8;

    if (bitDepth !== 24 && bitDepth !== 32) {
        logger.error(`Invalid bit depth: ${bitDepth}.`);
        return;
    }

    // Is RGBA or RGB
    const isRGBA = bitDepth === 32;

    // The number array containing the BMP image
    const nbArray: number[] = [];

    if (!isRGBA) {
        // RGB
        const rgbArray = pixelArray as NsBytes.IsRGBColor[];
        const bytesPerRow = width * byteDepth;
        const paddingBytes = (4 - (bytesPerRow % 4)) % 4;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;

                nbArray.push(
                    rgbArray[index].B,
                    rgbArray[index].G,
                    rgbArray[index].R
                );
            }

            // Add padding bytes
            for (let p = 0; p < paddingBytes; p++) {
                nbArray.push(0x00);
            }
        }
    } else {
        // RGBA
        const rgbaArray = pixelArray as NsBytes.IsRGBAColor[];

        for (let i = 0; i < rgbaArray.length; i++) {
            nbArray.push(
                rgbaArray[i].B,
                rgbaArray[i].G,
                rgbaArray[i].R,
                rgbaArray[i].A
            );
        }
    }

    // Convert number array to Uint8Array
    const pixelUint8Array = convertNumberArrayToUint8Array(nbArray);

    /**
     * Note: BMP header & DIB header contains information about the image
     * so we need to create the pixel array first before creating the headers.
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

    logger.info("Creating BMP Uint8Array..");

    // Create BMP Uint8Array
    const bmpImage = new Uint8Array(header.length + dibHeader.length + pixelUint8Array.length);

    logger.info("Combining BMP/DIB header and pixel array..");

    // Combine header and pixel arrays
    bmpImage.set(header, 0);
    bmpImage.set(dibHeader, header.length);
    bmpImage.set(pixelUint8Array, header.length + dibHeader.length);

    logger.info("Writing BMP image to file..");

    // Write to file
    const outputFilePath = path.join(outputDirPath, `${filename}.bmp`);
    fs.writeFileSync(outputFilePath, bmpImage);

    logger.info(`Successfully generated the BMP image: '${filename}' => '${outputDirPath}'.`);
}