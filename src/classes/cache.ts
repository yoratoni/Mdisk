import Pointers from "classes/pointers";
import { concatenateUint8Arrays, convertMegaBytesToBytes } from "helpers/bytes";
import { closeFile, getFileName, getFileSize, openFile, readFileByChunk } from "helpers/files";
import logger from "helpers/logger";


export default class Cache {
    private _fileName: string;
    private _filePath: string;
    private _file: number;
    private _size: number;
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

            this._fileName = "";
            this._filePath = "";
            this._size = concatenatedBuffer.length;
            this._chunkNumber = 0;
            this._chunkSize = concatenatedBuffer.length;
            this._file = -1;

            this._buffer = concatenatedBuffer;

            this._pointers = new Pointers();
            this._pointers.customChunkSize(concatenatedBuffer.length);

            logger.verbose(`Loaded cache from buffer with ${buffer.length.toLocaleString("en-US")} chunk(s).`);
            logger.info(`Buffer size: ${this._size.toLocaleString("en-US")} bytes.`);

            return;
        }

        this._bufferLoaded = false;
        this._fileName = getFileName(absolutePath);
        this._filePath = absolutePath;
        this._size = getFileSize(this._filePath);
        this._chunkNumber = 0;
        this._chunkSize = convertMegaBytesToBytes(chunkSize);
        this._file = openFile(this._filePath);

        this._buffer = new Uint8Array(this._chunkSize);

        this._buffer = readFileByChunk(
            this._file,
            this._size,
            this._buffer,
            this._chunkNumber,
            this._chunkSize
        );

        this._pointers = new Pointers();

        const numberOfChunks = Math.ceil(this._size / this._chunkSize);
        logger.verbose(`Loaded cache from file '${this._fileName}' with ${numberOfChunks.toLocaleString("en-US")} chunk(s).`);
        logger.info(`Chunk size: ${this._chunkSize.toLocaleString("en-US")} bytes.`);
        logger.info(`File size: ${this._size.toLocaleString("en-US")} bytes.`);
    }

    /**
     * Loads a new file / Buffer into the cache.
     * @param absolutePath The absolute path to the file.
     * @param buffer buffer, replacing the file (optional).
     */
    public loadFile(absolutePath: string, buffer?: Uint8Array) {
        if (this._bufferLoaded && buffer) {
            this._filePath = "";
            this._size = buffer.length;
            this._file = -1;
            this._chunkNumber = 0;

            this._buffer = buffer;

            logger.verbose(`Loaded cache from new buffer with ${buffer.length.toLocaleString("en-US")} chunk(s).`);
            logger.info(`Buffer size: ${this._size.toLocaleString("en-US")} bytes.`);

            return;
        }

        this._fileName = getFileName(absolutePath);
        this._filePath = absolutePath;
        this._size = getFileSize(this._filePath);
        this._file = openFile(this._filePath);
        this._chunkNumber = 0;

        this._buffer = readFileByChunk(
            this._file,
            this._size,
            this._buffer,
            this._chunkNumber,
            this._chunkSize
        );

        const numberOfChunks = Math.ceil(this._size / this._chunkSize);
        logger.verbose(`Loaded cache from file '${this._fileName}' with ${numberOfChunks.toLocaleString("en-US")} chunk(s).`);
        logger.info(`Chunk size: ${this._chunkSize.toLocaleString("en-US")} bytes.`);
        logger.info(`File size: ${this._size.toLocaleString("en-US")} bytes.`);
    }

    /**
     * Closes the file.
     */
    public closeFile() {
        if (this._file) {
            closeFile(this._file);

            logger.info(`Closed '${this._fileName}' file.`);
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
        logger.info(`Changed file path to ${absolutePath}.`);

        if (this._bufferLoaded) {
            return;
        }

        if (absolutePath === this._filePath) {
            return;
        }

        this.loadFile(absolutePath);
    }

    /**
     * Get the size of one chunk in bytes.
     * @returns The size of one chunk in bytes.
     */
    public get chunkSize() {
        return this._chunkSize;
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
     * Get the total size of the file/buffer in bytes.
     * @returns The size of the file/buffer in bytes.
     */
    public getSize() {
        return this._size;
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
                this._size,
                this._buffer,
                this._chunkNumber,
                this._chunkSize
            );
        }

        // Getting the end pointer
        const endPointer = this._pointers.bytePointer + numberOfBytes;

        // Checking if the end pointer is out of bounds, if so, increase the buffer size temporarily
        if (endPointer > this._buffer.length) {
            try {
                this._buffer = readFileByChunk(
                    this._file,
                    this._size,
                    this._buffer,
                    0,  // Ignored
                    numberOfBytes,
                    this._pointers.absolutePointer
                );
            } catch (error) {
                logger.error(
                    "Error while reading bytes\n" +
                    `>> Absolute pointer: ${absolutePointer.toLocaleString("en-US")}\n` +
                    `>> Chunk pointer: ${this._pointers.chunkPointer.toLocaleString("en-US")}\n` +
                    `>> Byte pointer: ${this._pointers.bytePointer.toLocaleString("en-US")}\n` +
                    `>> Number of bytes: ${numberOfBytes.toLocaleString("en-US")}\n` +
                    `>> Buffer length: ${this._buffer.length.toLocaleString("en-US")}\n` +
                    `>> End pointer: ${endPointer.toLocaleString("en-US")}\n` +
                    `>> Chunk size: ${this._chunkSize.toLocaleString("en-US")}\n`
                );

                process.exit(1);
            }

            this._pointers.bytePointer = 0;
        }

        // Getting the bytes from the buffer
        const bytes = this._buffer.slice(this._pointers.bytePointer, endPointer);
        this._pointers.incrementAbsolutePointer(numberOfBytes);

        // Checking if the bytes are missing
        if (bytes.length != numberOfBytes) {
            const reachedEndOfBuffer = this._pointers.bytePointer + bytes.length === this._buffer.length;
            const reachedEndOfData = this._pointers.absolutePointer + numberOfBytes === this._size;

            logger.error(
                `Missing ${numberOfBytes.toLocaleString("en-US")} bytes\n` +
                `>> Absolute pointer: ${absolutePointer.toLocaleString("en-US")}\n` +
                `>> Chunk pointer: ${this._pointers.chunkPointer.toLocaleString("en-US")}\n` +
                `>> Byte pointer: ${this._pointers.bytePointer.toLocaleString("en-US")}\n` +
                `>> Bytes length: ${bytes.length.toLocaleString("en-US")}\n` +
                `>> Buffer length: ${this._buffer.length.toLocaleString("en-US")}\n` +
                `>> Reached end of buffer: ${reachedEndOfBuffer}\n` +
                `>> Reached end of data: ${reachedEndOfData}`
            );

            process.exit(1);
        }

        return bytes;
    }
}