import { Cache } from "classes/cache";
import { CHUNK_SIZE } from "configs/constants";


const cache = new Cache("binary/binkw32.dll", CHUNK_SIZE);

console.log(
    cache.readByte(12)
);

cache.closeFile();