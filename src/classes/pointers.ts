import { CHUNK_SIZE } from "configs/constants";
import { convertMegaBytesToBytes } from "helpers/bytes";


export default class Pointers {
    private _chunkPointer = 0;
    private _bytePointer = 0;
    private _absolutePointer = 0;
    private _chunkSize = convertMegaBytesToBytes(CHUNK_SIZE);

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
     * Increment the absolute pointer.
     * @param increment The increment value (defaults to 1).
     */
    public incrementAbsolutePointer(increment = 1) {
        this._absolutePointer += increment;
    }

    /**
     * Increment the chunk pointer.
     * @param increment The increment value (defaults to 1).
     */
    public incrementChunkPointer(increment = 1) {
        this._chunkPointer += increment;
    }

    /**
     * Increment the byte pointer.
     * @param increment The increment value (defaults to 1).
     */
    public incrementBytePointer(increment = 1) {
        this._bytePointer += increment;
    }

    /**
     * Reset the absolute pointer.
     */
    public resetAbsolutePointer() {
        this._absolutePointer = 0;
    }

    /**
     * Reset the chunk pointer.
     */
    public resetChunkPointer() {
        this._chunkPointer = 0;
    }

    /**
     * Reset the byte pointer.
     */
    public resetBytePointer() {
        this._bytePointer = 0;
    }

    /**
     * Get the chunk and byte pointers from the absolute pointer.
     * @returns The chunk and byte pointers.
     */
    public getChunkAndBytePointersFromAbsolutePointer() {
        this._chunkPointer = Math.floor(this._absolutePointer / this._chunkSize);
        this._bytePointer = this._absolutePointer % this._chunkSize;

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
        this._absolutePointer = (this._chunkPointer) * this._chunkSize + this._bytePointer;

        return this._absolutePointer;
    }
}