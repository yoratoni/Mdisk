import Pointers from "classes/pointers";
import { concatenateUint8Arrays, convertMegaBytesToBytes } from "helpers/bytes";
import { closeFile, getFileSize, openFile, readFileByChunk } from "helpers/files";


export default class Cache {
    private _filePath: string;
    private _fileSize: number;
    private _file: number;
    private _chunkNumber: number;
    private _chunkSize: number;
    private _buffer: Uint8Array;
    private _pointers: Pointers;
    private _bufferLoaded: boolean;


    /**
     * Constructor -> Loads the file / Buffer into the cache.
     * @param absolutePath The absolute path to the file.
     * @param chunkSize The size of the chunk in MB.
     * @param buffer Allows to add a buffer, replacing the file (optional).
     */
    constructor(
        absolutePath: string,
        chunkSize: number,
        buffer?: Uint8Array[]
    ) {
        if (buffer) {
            this._bufferLoaded = true;

            const concatenatedBuffer = concatenateUint8Arrays(buffer);

            this._filePath = "";
            this._fileSize = concatenatedBuffer.length;
            this._chunkNumber = 0;
            this._chunkSize = concatenatedBuffer.length;
            this._file = -1;

            this._buffer = concatenatedBuffer;

            this._pointers = new Pointers();
            this._pointers.customChunkSize(concatenatedBuffer.length);

            return;
        }

        this._bufferLoaded = false;
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
     * Loads a new file / Buffer into the cache.
     * @param absolutePath The absolute path to the file.
     * @param buffer buffer, replacing the file (optional).
     */
    public loadFile(absolutePath: string, buffer?: Uint8Array) {
        if (this._bufferLoaded && buffer) {
            this._filePath = "";
            this._fileSize = buffer.length;
            this._file = -1;
            this._chunkNumber = 0;

            this._buffer = buffer;

            return;
        }

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
        if (this._file) {
            closeFile(this._file);
        }
    }

    /**
     * Access the pointers.
     */
    public get pointers() {
        return this._pointers;
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
        if (this._bufferLoaded) {
            return;
        }

        if (absolutePath === this._filePath) {
            return;
        }

        this.loadFile(absolutePath);
    }

    /**
     * Get the complete cached buffer.
     * @returns The complete cached buffer.
     */
    public get buffer() {
        return this._buffer;
    }

    /**
     * Get the length of the buffer.
     * @returns The length of the buffer.
     */
    public get bufferLength() {
        return this._buffer.length;
    }

    /**
     * Get the size of the file in bytes.
     * @returns The size of the file in bytes.
     */
    public getFileSize() {
        return this._fileSize;
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

        if (this._pointers.chunkPointer !== this._chunkNumber && !this._bufferLoaded) {
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
            this._pointers.bytePointer,
            this._pointers.bytePointer + numberOfBytes
        );

        this._pointers.incrementAbsolutePointer(numberOfBytes);

        return bytes;
    }
}