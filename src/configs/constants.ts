import NsConstants from "types/constants";

/**
 * The chunk size in Megabytes, to read the files.
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
export const BIN_FILE_TYPES: NsConstants.IsBinFileTypes = {
    "ff4": "SOUND_EFFECT",
    "fe": "SOUND_HEADER",
    "fd": "TEXT",
    "ff8": "TEXTURE",
    "ff0": "MISCELLANEOUS",
    "unknown": "UNKNOWN"
};