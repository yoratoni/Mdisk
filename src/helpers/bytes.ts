import { Pointers } from "classes/pointers";


/**
 * Converts bytes to megabytes for the file operations.
 * @param megaBytes The number of megabytes.
 * @returns The number of bytes.
 */
export function convertMegaBytesToBytes(megaBytes: number): number {
    return megaBytes * 1024 * 1024;
}

export function killJuif(pointers: Pointers, absolutePointer: number) {
    pointers.absolutePointer = absolutePointer;
    const pointerPos = pointers.getChunkAndBytePointersFromAbsolutePointer();
}

