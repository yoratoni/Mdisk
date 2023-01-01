declare module "lzo" {
    /**
     * Compress data with the lzo compression algorithm.
     * @param input If the parameter is not a buffer, the function will try to convert via `Buffer.from`.
     * @return The compressed data.
     */
    export function compress(input: Buffer): Buffer;

    /**
     * Decompress data with the lzo compression algorithm.
     * @param input If the parameter is not a buffer, the function will try to convert via `Buffer.from`.
     * @param length The length of the decompressed data (optional).
     * @return The decompressed data.
     */
    export function decompress(input: Buffer, length: number | undefined): Buffer;

    /**
     * The version of the lzo library.
     */
    export const version: string;

    /**
     * The version date of the lzo library.
     */
    export const versionDate: string;

    /**
     * List of error codes.
     */
    export const errorCodes: {
        "-1": "LZO_E_ERROR",
        "-2": "LZO_E_OUT_OF_MEMORY",
        "-3": "LZO_E_NOT_COMPRESSIBLE",
        "-4": "LZO_E_INPUT_OVERRUN",
        "-5": "LZO_E_OUTPUT_OVERRUN",
        "-6": "LZO_E_LOOKBEHIND_OVERRUN",
        "-7": "LZO_E_EOF_NOT_FOUND",
        "-8": "LZO_E_INPUT_NOT_CONSUMED",
        "-9": "LZO_E_NOT_YET_IMPLEMENTED",
        "-10": "LZO_E_INVALID_ARGUMENT",
        "-11": "LZO_E_INVALID_ALIGNMENT",
        "-12": "LZO_E_OUTPUT_NOT_CONSUMED",
        "-99": "LZO_E_INTERNAL_ERROR"
    };
}