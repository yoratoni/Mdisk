import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { convertNumberArrayToUint8Array } from "helpers/bytes";
import { createBMPHeader, createDIBHeader_BITMAPV4HEADER } from "helpers/images/bmp";
import logger from "helpers/logger";
import NsBytes from "types/bytes";


/**
 * Filter function (single channel => 3 channels (RGB)).
 */
export type filterFunction = (
    input: Uint8Array,
    byteIndex: number
) => NsBytes.IsRGBColor;

/**
 * Options for the grayscale function.
 *
 *  * Note about the filter function:
 * ```typescript
 *   (color: number) => { R: number, G: number, B: number }
 * ```
 * Takes a single byte as input and returns 3 channel values (RGB) to allow for custom color mapping.
 * @param bytesPerRow Bytes per row on the image (optional, defaults to 16, 0 = squared image).
 * @param numberOfBytesToRead Number of bytes to read from the file (optional, defaults to 0 = all bytes).
 * @param chunkSize Chunk size in MB (optional, defaults to 8).
 * @param filter The filter function to apply to each byte (optional, defaults to no filter).
 * @param backgroundColor RGB background color of the image (optional, defaults to [127, 0, 0]).
 * @param alphaMask Alpha mask to apply (optional, defaults to 0xFF, used for superposition).
 */
export interface grayscaleOptions {
    bytesPerRow?: number;
    numberOfBytesToRead?: number;
    chunkSize?: number;
    filter?: filterFunction;
    backgroundColor?: number[];
    alphaMask?: number;
}

/**
 * Mixes one color byte to a color array (with the index of the color to mix).
 * @param colorByte The color byte to mix.
 * @param colorByteIndex The index of the color to mix (0 = R, 1 = G, 2 = B).
 * @param colorArray The color array.
 * @param ratio The ratio to apply to the colors (optional, defaults to 0.55).
 * @returns The mixed color byte.
 */
export function mixColorByteWithColorArray(
    colorByte: number,
    colorByteIndex: 0 | 1 | 2,
    colorArray: number[],
    ratio = 0.55
) {
    const resColor = Math.round(
        colorByte * ratio + colorArray[colorByteIndex] * (1 - ratio)
    );

    return resColor;
}

/**
 * Allows to visualize binary data as a BMP grayscale image.
 *
 * Used to analyze binary data so the BMP image is reversed to match first byte of the file.
 *
 * @param filePath The path to the file.
 * @param outputDirPath The output directory path.
 * @param options The options for the grayscale function (optional).
 * @link https://en.wikipedia.org/wiki/BMP_file_format
 */
export default function visualizer(
    filePath: string,
    outputDirPath: string,
    options?: grayscaleOptions
) {
    // Options
    const {
        bytesPerRow = 16,
        numberOfBytesToRead = 0,
        chunkSize = 8,
        filter = undefined,
        backgroundColor = [0x7F, 0x00, 0x00],
        alphaMask = 0xFF
    } = options || {};

    // Number of bytes to read
    let bytesToRead = numberOfBytesToRead;

    if (!fs.existsSync(filePath)) {
        logger.error(`Invalid path: ${filePath}`);
        process.exit(1);
    }

    // Loading the cache
    const cache = new Cache(filePath, chunkSize);

    // File info
    const filename = path.basename(filePath, path.extname(filePath));
    const size = cache.getSize();

    // Create a directory for the output file (chunks)
    const outputSubDirPath = path.join(outputDirPath, filename);

    if (!fs.existsSync(outputSubDirPath)) {
        fs.mkdirSync(outputSubDirPath, { recursive: true });
    }

    logger.info("Generating chunk images from binary data..");

    // Replace number of bytes to read with the length of the input array if == 0
    if (bytesToRead <= 0 || bytesToRead > cache.chunkSize) {
        bytesToRead = cache.chunkSize;
    }

    // Index of the current chunk
    let chunkIndex = 0;

    // Byte depth (RGBA)
    const byteDepth = 4;

    // Bit depth (RGBA)
    const bitDepth = byteDepth * 8;

    while (chunkIndex * bytesToRead < size) {
        const input = cache.readBytes(chunkIndex * bytesToRead, bytesToRead);

        // Calculate height
        let height: number;

        if (bytesPerRow <= 0) {
            // Square image (sqrt)
            height = Math.ceil(Math.sqrt(input.length));
        } else {
            // Number of rows
            height = Math.ceil(input.length / bytesPerRow);
        }

        // Calculate width (if bytesPerRow is -1, width = height)
        const width = bytesPerRow <= 0 ? height : bytesPerRow;

        logger.info(`Chunk image dimensions: ${width}x${height}`);

        // Convert the Uint8Array to a number array
        // Filled with backgroundColor for missing bytes
        const nbArray: number[] = new Array<number>(width * height * byteDepth);

        for (let i = 0; i < nbArray.length; i += byteDepth) {
            nbArray[i] = backgroundColor[2];        // B
            nbArray[i + 1] = backgroundColor[1];    // G
            nbArray[i + 2] = backgroundColor[0];    // R
            nbArray[i + 3] = alphaMask;             // A
        }

        // Fill the number array with the input data
        for (let i = 0; i < input.length; i++) {
            // Apply filter function if defined
            if (!filter) {
                nbArray[i * byteDepth] = input[i];
                nbArray[i * byteDepth + 1] = input[i];
                nbArray[i * byteDepth + 2] = input[i];
            } else {
                const filtered = filter(input, i);
                nbArray[i * byteDepth] = filtered.B;
                nbArray[i * byteDepth + 1] = filtered.G;
                nbArray[i * byteDepth + 2] = filtered.R;
            }
        }

        // Convert the number array to a Uint8Array
        const pixelUint8Array = convertNumberArrayToUint8Array(nbArray);

        // Reverse the pixel array (y-axis)
        pixelUint8Array.reverse();

        // Reverse the pixel array (x-axis)
        for (let y = 0; y < height; y++) {
            const row = pixelUint8Array.slice(y * width * byteDepth, (y + 1) * width * byteDepth);
            row.reverse();

            pixelUint8Array.set(row, y * width * byteDepth);
        }

        // Create DIB header
        const dibHeader = createDIBHeader_BITMAPV4HEADER(
            width,
            height,
            bitDepth,
            pixelUint8Array.length,
            72
        );

        // Create BMP header
        const header = createBMPHeader(dibHeader.length + pixelUint8Array.length, dibHeader.length);

        // Create BMP Uint8Array
        const bmpImage = new Uint8Array(header.length + dibHeader.length + pixelUint8Array.length);

        // Combine header and pixel arrays
        bmpImage.set(header, 0);
        bmpImage.set(dibHeader, header.length);
        bmpImage.set(pixelUint8Array, header.length + dibHeader.length);

        // Write to file
        const outputFilePath = path.join(outputSubDirPath, `${filename}_${chunkIndex}.bmp`);
        fs.writeFileSync(outputFilePath, bmpImage);

        logger.info(
            `Successfully generated image N°${chunkIndex}: '${filename}_${chunkIndex}.bmp' => '${outputSubDirPath}'.`
        );

        // Increment chunk index
        chunkIndex++;
    }
}
