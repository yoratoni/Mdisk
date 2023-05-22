/**
 * Calculates the Adler-32 checksum of a chunk minus 4 bytes for the checksum itself.
 * @param chunk The chunk.
 * @param littleEndian Whether the checksum should be calculated in Little Endian (optional, defaults to false).
 * @returns The Adler-32 checksum of the chunk (uint32 => uint8).
 * @link https://compression.fiches-horaires.net/la-compression-sans-perte/deflate-lalgorithme-que-vous-retrouvez-partout/#4-un-decodeur-deflate-en-python
 */
export function calculateChunkAdler32(chunk: Uint8Array, littleEndian = false): Uint8Array {
    let a = 1;
    let b = 0;

    for (const byte of chunk) {
        a = (a + byte) % 65521;
        b = (b + a) % 65521;
    }

    const adler32 = (b << 16) | a;

    // Reverse the bytes
    const adler32Bytes = new Uint32Array([adler32]);

    // Convert to Uint8Array
    const adler8Bytes = new Uint8Array(adler32Bytes.buffer);

    return littleEndian ? adler8Bytes : adler8Bytes.reverse();
}