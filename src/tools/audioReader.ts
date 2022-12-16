import fs from "fs";

import Cache from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";
import {
    convertStringToUint8Array,
    convertUint8ArrayToHexString,
    convertUint8ArrayToString
} from "helpers/bytes";


function readAudioHeader(cache: Cache, headerSize = 68) {
    //
}

export function Audio(audioFilePath: string) {
    if (!fs.existsSync(audioFilePath)) {
        throw new Error(`The audio file doesn't exist: ${audioFilePath}`);
    }
}