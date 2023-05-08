import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { TARGA_FILE_HEADER, TEXTURE_FILE_CONFIG, TEXTURE_FILE_TYPES } from "configs/constants";
import { MpBinFileTexture } from "configs/mappings";
import {
    concatenateUint8Arrays,
    convertNumberArrayToUint8Array,
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
 * Get raw chunks from the texture buffer.
 * @param cache The cache object.
 * @returns The chunks.
 */
function getRawChunks(cache: Cache, littleEndian = true) {
    const chunks = [];
    let pointer = 0;

    while (pointer < cache.bufferLength) {
        const chunkSize = convertUint8ArrayToNumber(cache.readBytes(pointer), littleEndian);
        const chunk = cache.readBytes(pointer + 4, chunkSize);

        if (convertUint8ArrayToHexString(chunk.slice(0, 4), littleEndian, true) != TEXTURE_FILE_CONFIG.unk1) {

            console.log(
                convertUint8ArrayToHexString(chunks[chunks.length - 1], true, false, true)
            );

            console.log(
                convertUint8ArrayToHexString(chunk, true, false, true)
            );
            throw new Error("Invalid chunk header.");
        }

        chunks.push(chunk);

        pointer += chunkSize + 4;
    }

    return chunks;
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

    const rawChunks = getRawChunks(
        cache
    );



    logger.info(`Successfully extracted textures: '${getFileName(binFilePath)}' => '${outputDirPath}'.`);
}