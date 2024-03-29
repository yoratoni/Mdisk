import NsConstants from "types/constants";


/**
 * Version differences.
 */
export const VERSION_DIFFS = {
    pc_gog_files: 8924,
    pc_steam_files: 10005,
    pc_gog_padding: [0xA0, 0x00, 0x00, 0x00],
    pc_steam_padding: [0x58, 0x00, 0x00, 0x00]
};

/**
 * The configuration for bin files.
 */
export const BF_FILE_CONFIG = {
    headerLength: 68,
    fileCountOffset: 8,
    directoryCountOffset: 12,
    fileCount2Offset: 44,
    directoryCount2Offset: 48
};

/**
 * The chunk size in Megabytes, to read & write the Big File.
 * Note: Can't be more than 2,147,483,647 bytes (~2GB).
 */
export const CHUNK_SIZE = 256;

/**
 * Audio MS-ADPCM tables.
 */
export const AUDIO_MS_ADPCM_TABLES = {
    adaptationTable: [
        230, 230, 230, 230, 307, 409, 512, 614,
        768, 614, 512, 409, 307, 230, 230, 230
    ],
    coeff1: [256, 512, 0, 192, 240, 460, 392],
    coeff2: [0, -256, 0, 64, 0, -208, -232]
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
 * The configuration for texture files.
 */
export const TEXTURE_FILE_CONFIG = {
    magic: "0x3412D0CAFF00FF00DEC0DEC0",
    fontDescMagic: "FONTDESC",
    chunkMark: "0xFFFFFFFF",
    RGBAPaletteLengths: [
        0x40,
        0x400
    ]
};

/**
 * The internal chunk types of the texture files.
 */
export const TEXTURE_FILE_CHUNK_TYPES: NsConstants.IsStringFileTypes = {
    2: "BMP",
    3: "JPEG",
    4: "SPRITE_GEN",
    5: "PROCEDURAL",
    7: "PALETTE_LINK",
    9: "ANIMATED",
    4097: "TARGA_1",
    8193: "TARGA_2",
    16390: "PALETTE_8",
    20486: "PALETTE_4"
};

/**
 * Targa file header.
 * @link https://www.fileformat.info/format/tga/egff.htm
 * @link https://en.wikipedia.org/wiki/Truevision_TGA
 * @link http://www.paulbourke.net/dataformats/tga/
 */
export const TARGA_FILE_HEADER = {
    // Header length
    headerLength: 18,

    // Header
    idLength: 0,
    colorMapType: 0,
    imageType: 2,

    // Color Map Specification
    firstEntryIndex: 0,
    colorMapLength: 0,
    colorMapEntrySize: 0,

    // Image Specification
    xOrigin: 0,
    yOrigin: 0,
    width: 0,
    height: 0,
    pixelDepth: 32,
    imageDescriptor: 8
};