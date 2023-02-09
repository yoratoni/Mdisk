import fs from "fs";
import path from "path";

import Cache from "classes/cache";


function readGroups(dataBlocks: Uint8Array[]) {
    //
}

/**
 * Subfunction of BinFile to decompress "ff8".
 * @param dataBlocks The decompressed data blocks.
 * @link [Texture files doc by Kapouett.](https://gitlab.com/Kapouett/bge-formats-doc/-/blob/master/TextureFile.md)
 * @link [Jade Studio source code by 4g3v.](https://github.com/4g3v/JadeStudio/tree/master/JadeStudio.Core/FileFormats/Texture)
 */
export default function BinTexture(dataBlocks: Uint8Array[]) {
    // Loading the cache in buffer mode (no file)
    const cache = new Cache("", 0, dataBlocks);

    console.log(cache.buffer);
}