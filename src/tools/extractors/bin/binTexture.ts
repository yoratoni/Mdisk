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
 * @param littleEndian Whether the texture is little endian or not.
 * @returns The chunks.
 * @link [Texture Chunks by 4g3v.](https://github.com/4g3v/JadeStudio/blob/master/JadeStudio.Core/FileFormats/Texture/Chunk.cs)
 */
function getRawChunks(cache: Cache, littleEndian: boolean) {
    const chunks: Uint8Array[] = [];
    let pointer = 0;

    while (pointer < cache.bufferLength) {
        const chunkSize = convertUint8ArrayToNumber(cache.readBytes(pointer), littleEndian);
        const chunk = cache.readBytes(pointer + 4, chunkSize);

        console.log(chunkSize);

        pointer += chunkSize + 4;
    }

    return chunks;
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

    const rawChunks = getRawChunks(
        cache,
        littleEndian
    );



    logger.info(`Successfully extracted textures: '${getFileName(binFilePath)}' => '${outputDirPath}'.`);
}