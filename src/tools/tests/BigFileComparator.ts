import fs from "fs";

import Cache from "classes/cache";
import { BF_FILE_CONFIG, CHUNK_SIZE, VERSION_DETECTOR } from "configs/constants";
import logger from "helpers/logger";


/**
 * Use this function to compare two Big Files.
 * @param bf1Path The path of the first Big File.
 * @param bf2Path The path of the second Big File.
 * @param chunkSize The size of the chunks to be read from the Big Files.
 */
export default function BigFileComparator(
    bf1Path: string,
    bf2Path: string,
    chunkSize: number = CHUNK_SIZE,
) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenBytes = 0.00001;  // 10 bytes as 0.00001 MB.

    const cache1 = new Cache(bf1Path, tenBytes);
    const cache2 = new Cache(bf2Path, tenBytes);

    const bf1Size = fs.statSync(bf1Path).size;
    const bf2Size = fs.statSync(bf2Path).size;

    if (bf1Size !== bf2Size) {
        logger.warn(
            `The two files have different sizes: ${bf1Size.toLocaleString("en-US")} and ${bf2Size.toLocaleString("en-US")}`
        );
    }

    // Analyze and compare all the chunks.
    const bf1Chunk1 = cache1.readBytes(0, 15);
    const bf2Chunk1 = cache2.readBytes(0, 15);

    console.log(bf1Chunk1);
    console.log(bf2Chunk1);

    // Closing the files from the caches
    cache1.closeFile();
    cache2.closeFile();
}