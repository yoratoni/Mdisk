import Pointers from "classes/pointers";
import { convertMegaBytesToBytes } from "helpers/bytes";
import { closeFile, getFileSize, openFile, readFileByChunk } from "helpers/files";


export default class Cache {
    private _filePath: string;
    private _fileSize: number;
    private _file: number;
    private _chunkNumber: number;
    private _chunkSize: number;
    private _buffer: Uint8Array;
    private _pointers: Pointers;


    /**
     * Constructor -> Loads the file into the cache.
     * @param absolutePath The absolute path to the file.
     * @param chunkSize The size of the chunk in MB.
     */
    constructor(
        absolutePath: string,
        chunkSize: number
    ) {
        this._filePath = absolutePath;
        this._fileSize = getFileSize(this._filePath);
        this._chunkNumber = 0;
        this._chunkSize = convertMegaBytesToBytes(chunkSize);
        this._file = openFile(this._filePath);

        this._buffer = new Uint8Array(this._chunkSize);

        this._buffer = readFileByChunk(
            this._file,
            this._fileSize,
            this._buffer,
            this._chunkNumber,
            this._chunkSize
        );

        this._pointers = new Pointers();
    }

    /**
     * Loads a new file into the cache.
     * @param absolutePath The absolute path to the file.
     */
    public loadFile(absolutePath: string) {
        this._filePath = absolutePath;
        this._fileSize = getFileSize(this._filePath);
        this._file = openFile(this._filePath);
        this._chunkNumber = 0;

        this._buffer = readFileByChunk(
            this._file,
            this._fileSize,
            this._buffer,
            this._chunkNumber,
            this._chunkSize
        );
    }

    /**
     * Closes the file.
     */
    public closeFile() {
        closeFile(this._file);
    }

    /**
     * Returns the absolute path to the file.
     */
    public get filePath() {
        return this._filePath;
    }

    /**
     * Sets the absolute path to a new file.
     * Note that it also loads the new file into the cache.
     * @param absolutePath The absolute path to the file.
     */
    public set filePath(absolutePath: string) {
        if (absolutePath === this._filePath) {
            return;
        }

        this.loadFile(absolutePath);
    }

    /**
     * Get the complete cached buffer.
     */
    public get buffer() {
        return this._buffer;
    }

    /**
     * Reads a certain amount of bytes from the file.
     * @param absolutePointer The absolute pointer to the first byte.
     * @param numberOfBytes The number of bytes to read (defaults to 4).
     * @returns The number of bytes in an array.
     */
    public readBytes(
        absolutePointer: number,
        numberOfBytes = 4
    ): Uint8Array {
        this._pointers.absolutePointer = absolutePointer;
        this._pointers.getChunkAndBytePointersFromAbsolutePointer();

        if (this._pointers.chunkPointer !== this._chunkNumber) {
            this._chunkNumber = this._pointers.chunkPointer;

            this._buffer = readFileByChunk(
                this._file,
                this._fileSize,
                this._buffer,
                this._chunkNumber,
                this._chunkSize
            );
        }

        const bytes = this._buffer.slice(
            this._pointers.absolutePointer,
            this._pointers.absolutePointer + numberOfBytes
        );

        this._pointers.incrementAbsolutePointer(numberOfBytes);

        return bytes;
    }
}