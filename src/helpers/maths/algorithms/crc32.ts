/**
 * Generates a CRC table (IEEE polynomial).
 * @returns The CRC table (uint32).
 * @link https://www.w3.org/TR/PNG-CRCAppendix.html
 */
export function generateCRC32Table_IEEE(): Uint32Array {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let c = i;

        for (let j = 0; j < 8; j++) {
            if (c & 1) {
                c = 0xEDB88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }

        table[i] = c;
    }

    return table;
}

/**
 * Calculates the CRC of a chunk minus 4 bytes for the CRC itself (IEEE polynomial).
 * @param chunk The chunk.
 * @param littleEndian Whether the CRC should be calculated in Little Endian (optional, defaults to false).
 * @returns The CRC of the chunk (uint32 => uint8).
 * @link https://www.w3.org/TR/PNG-CRCAppendix.html
 */
export function calculateChunkCRC32_IEEE(chunk: Uint8Array, littleEndian = false): Uint8Array {
    const table = generateCRC32Table_IEEE();
    let c = 0xFFFFFFFF;

    for (let i = 4; i < chunk.length - 4; i++) {
        c = table[(c ^ chunk[i]) & 0xFF] ^ (c >>> 8);
    }

    const crc = c ^ 0xFFFFFFFF;

    // Reverse the bytes
    const crc32Bytes = new Uint32Array([crc]);

    // Convert to Uint8Array
    const crcBytes = new Uint8Array(crc32Bytes.buffer);

    return littleEndian ? crcBytes : crcBytes.reverse();
}