import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import { extractorChecker } from "helpers/files";
import { generateBMPImageFromUint8Array } from "helpers/images/bmp";


export default function TrailerExtractor(trailerFilePath: string, outputDirPath: string) {
    extractorChecker(trailerFilePath, "trailer video", ".mtx", outputDirPath);

    // Loading the cache
    const cache = new Cache(trailerFilePath, CHUNK_SIZE);

    generateBMPImageFromUint8Array(
        "C:/Users/terci/Desktop",
        "trailer",
        cache.readBytes(0, 4)
    );
}