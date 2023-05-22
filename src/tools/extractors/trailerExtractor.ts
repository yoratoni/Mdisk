import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import { extractorChecker } from "helpers/files";


export default function TrailerExtractor(trailerFilePath: string, outputDirPath: string) {
    extractorChecker(trailerFilePath, "trailer video", ".mtx", outputDirPath);

    // Loading the cache
    const cache = new Cache(trailerFilePath, CHUNK_SIZE);
}