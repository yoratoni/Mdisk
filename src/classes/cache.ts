import { Pointers } from "classes/pointers";
import { convertMegaBytesToBytes } from "helpers/bytes";
import { closeFile, getAbsolutePath, getFileSize, openFile, readFileByChunk } from "helpers/files";


export class Cache {
    private _filePath = "";
    private _fileSize = 0;
    private _file = 0;
    private _chunkNumber = 0;
    private _chunkSize = 0;
    private _buffer: Buffer = Buffer.alloc(0);
    private _pointers: Pointers;


    /**
     * Constructor -> Loads the file into the cache.
     * @param relativePath The relative path to the file.
     * @param chunkSize The size of the chunk in MB.
     */
    constructor(
        relativePath: string,
        chunkSize: number
    ) {
        this._filePath = getAbsolutePath(relativePath);
        this._fileSize = getFileSize(this._filePath);
        this._chunkSize = convertMegaBytesToBytes(chunkSize);
        this._file = openFile(this._filePath);

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
     * @param relativePath The relative path to the file.
     */
    public loadFile(relativePath: string) {
        this._filePath = getAbsolutePath(relativePath);
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
     * @param relativePath The relative path to the file.
     */
    public set filePath(relativePath: string) {
        if (getAbsolutePath(relativePath) === this._filePath) {
            return;
        }

        this.loadFile(relativePath);
    }

    /**
     * Get the complete cached buffer.
     */
    public get buffer() {
        return this._buffer;
    }

    /**
     * Reads an unique byte from the file.
     * @param absolutePointer The absolute pointer to the byte.
     * @returns The byte.
     */
    public readByte(absolutePointer: number) {
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

        return this._buffer[this._pointers.bytePointer];
    }
}