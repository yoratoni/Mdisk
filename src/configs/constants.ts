import NsConstants from "types/constants";


/**
 * The chunk size in Megabytes, to read the Big File.
 */
export const CHUNK_SIZE = 512;

/**
 * Audio MS-ADPCM tables.
 */
export const AUDIO_MS_ADPCM_TABLES = {
    adaptationTable: [
        230, 230, 230, 230, 307, 409, 512, 614,
        768, 614, 512, 409, 307, 230, 230, 230
    ],
    coeff1: [ 256, 512, 0, 192, 240, 460, 392 ],
    coeff2: [ 0, -256, 0, 64, 0, -208, -232 ]
};

/**
 * The file types of the bin files.
 */
export const BIN_FILE_TYPES: NsConstants.IsStringFileTypes = {
    "ff4": "SOUND_EFFECT",
    "fe": "SOUND_HEADER",
    "fd": "TEXT",
    "ff8": "TEXTURE",
    "ff0": "MISCELLANEOUS",
    "unknown": "UNKNOWN"
};

/**
 * The internal texture types of the texture files.
 */
export const TEXTURE_FILE_TYPES: NsConstants.IsNumberAndStringFileTypes = {
    "BMP": 2,
    "JPEG": 3,
    "SPRITE_GEN": 4,
    "PROCEDURAL": 5,
    "PALETTE_LINK": 7,
    "ANIMATED": 9,
    "RGB_HEADER": 4097,
    "RGBA_HEADER": 8193,
    "PALETTE_8": 16390,
    "PALETTE_4": 20486,
    "FONT_DESC": "FONT_DESC",
};