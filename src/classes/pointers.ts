import { CHUNK_SIZE } from "configs/constants";
import { convertMegaBytesToBytes } from "helpers/bytes";


export class Pointers {
    private _chunkPointer = 0;
    private _bytePointer = 0;
    private _absolutePointer = 0;

    /**
     * Get the chunk pointer.
     * @returns The position of the chunk pointer.
     */
    public get chunkPointer() {
        return this._chunkPointer;
    }

    /**
     * Set the chunk pointer.
     * @param position The position of the chunk pointer.
     */
    public set chunkPointer(position: number) {
        this._chunkPointer = position;
    }

    /**
     * Get the byte pointer.
     * @returns The position of the byte pointer.
     */
    public get bytePointer() {
        return this._bytePointer;
    }

    /**
     * Set the byte pointer.
     * @param position The position of the byte pointer.
     */
    public set bytePointer(position: number) {
        this._bytePointer = position;
    }

    /**
     * Get the absolute pointer (Chunk + Byte positions).
     * @returns The position of the absolute pointer.
     */
    public get absolutePointer() {
        return this._absolutePointer;
    }

    /**
     * Set the absolute pointer (Chunk + Byte positions).
     * @param position The position of the absolute pointer.
     */
    public set absolutePointer(position: number) {
        this._absolutePointer = position;
    }

    /**
     * Increment the chunk pointer.
     */
    public incrementChunkPointer() {
        this._chunkPointer++;
    }

    /**
     * Increment the byte pointer.
     */
    public incrementBytePointer() {
        this._bytePointer++;
    }

    /**
     * Get the chunk and byte pointers from the absolute pointer.
     * @returns The chunk and byte pointers.
     */
    public getChunkAndBytePointersFromAbsolutePointer() {
        const bytes = convertMegaBytesToBytes(CHUNK_SIZE);

        this._chunkPointer = Math.floor(this._absolutePointer / bytes);
        this._bytePointer = this._absolutePointer % bytes;

        return {
            chunkPointer: this._chunkPointer,
            bytePointer: this._bytePointer
        };
    }

    /**
     * Get the absolute pointer from the chunk and byte pointers.
     * @returns The absolute pointer.
     */
    public getAbsolutePointerFromChunkAndBytePointers() {
        const bytes = convertMegaBytesToBytes(CHUNK_SIZE);

        this._absolutePointer = (this._chunkPointer) * bytes + this._bytePointer;

        return this._absolutePointer;
    }
}