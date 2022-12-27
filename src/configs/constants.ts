/**
 * The chunk size in Megabytes, to read the files.
 */
export const CHUNK_SIZE = 512;

/**
 * Defines if the application is running in verbose mode.
 */
export const VERBOSE = true;

/**
 * The prefix used by the logger.
 */
export const LOGGER_PREFIX = ">";

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