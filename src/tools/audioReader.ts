import fs from "fs";
import { Readable } from "stream";

import Speaker from "speaker";

import Cache from "classes/cache";
import { AUDIO_MS_ADPCM_TABLES , CHUNK_SIZE } from "configs/constants";
import {
    MpAudioHeader
} from "configs/mappings";
import {
    convertNumberToUint8Array,
    convertUint8ArrayToHexString,
    convertUint8ArrayToHexStringArray,
    convertUint8ArrayToSignedNumber,
    generateByteObjectFromMapping
} from "helpers/bytes";
import { checkFileExtension } from "helpers/files";
import { clamp } from "helpers/numbers";
import NsBytes from "types/bytes";
import NsMappings from "types/mappings";


/**
 * Converts the number of bytes in the audio file (MS-ADPCM) to the number of samples.
 * @param dataBlockSize The size of the data (number of byte for the data blocks).
 * @param dataBlockAlign The size of one data block.
 * @param numChannels The number of channels.
 * @returns The number of samples.
 */
function convertMsadpcmBytesToSamples(dataBlockSize: number, dataBlockAlign: number, numChannels: number) {
    if (dataBlockAlign <= 0 || numChannels <= 0) {
        return 0;
    }

    // 6 * numChannels => (7-1) * numChannels
    const samples = (dataBlockSize / dataBlockAlign) * (dataBlockAlign - 6 * numChannels) * 2 / numChannels;
    const eSamples = (dataBlockSize % dataBlockAlign) ? ((dataBlockSize % dataBlockAlign) - 6 * numChannels) * 2 / numChannels : 0;

    return samples + eSamples;
}

/**
 * Reads the header of the audio file.
 *
 * Note that the size includes 2 padding bytes
 * so a subChunk size of 18 instead of 16.
 *
 * @param cache Initialized cache class.
 * @param loopFlag Whether the audio file supposedly is looped.
 * @param headerSize The size of the header (defaults to 46 bytes).
 * @returns The formatted header.
 */
function readAudioHeader(cache: Cache, loopFlag: boolean, headerSize = 46) {
    const rawHeader = cache.readBytes(0, headerSize);
    const header = generateByteObjectFromMapping(rawHeader, MpAudioHeader);

    header.data.headerSize = headerSize;

    if (header.data.chunkID !== "RIFF" || header.data.format !== "WAVE") {
        throw new Error("Invalid audio file format (RIFF/WAVE)");
    }

    if (header.data.fmtBlockSize !== 0x12 && header.data.fmtBlockSize !== 0x32) {
        throw new Error("Invalid audio file format (fmt block size)");
    }

    if (header.data.dataBlockAlign !== header.data.numChannels as number * 0x24) {
        throw new Error("Invalid audio file format (data block align)");
    }

    // Calculate the number of samples
    header.data.samples = convertMsadpcmBytesToSamples(
        header.data.dataBlockSize as number,
        header.data.dataBlockAlign as number,
        header.data.numChannels as number
    );

    // Jade Engine V1 loops by extension, try to detect incorrectly looped jingles (too short)
    // < 15s is generally too short for a looped jingle
    const sampleRate = header.data.sampleRate as number;
    header.data.loopFlag = loopFlag && header.data.samples >= 15 * sampleRate;

    header.data.loopStart = 0;
    header.data.loopEnd = header.data.samples;

    return header;
}

/**
 * Reads the MS-ADPCM audio header(s) returning an array
 * where each value are the data for a channel (stereo, etc..).
 *
 * Note that this function supports any number of channels.
 *
 * @param cache Initialized cache class.
 * @param header The audio file header.
 * @param dataBlockNumber The number of the block to read.
 * @returns The formatted MS-ADPCM audio header(s).
 */
function readAudioDataBlockHeader(
    cache: Cache,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
    dataBlockNumber: number
) {
    const headerSize = header.data.headerSize as number;
    const numChannels = header.data.numChannels as number;
    const dataBlockAlign = header.data.dataBlockAlign as number;

    const blocks: NsBytes.IsMappingByteObjectResultWithEmptiness[] = [];

    for (let i = 0; i < numChannels; i++) {
        const rawBlock = cache.readBytes(headerSize + dataBlockNumber * dataBlockAlign, dataBlockAlign);

        // Create a custom mapping for each channel
        const mapping: NsMappings.IsMapping = {
            predictor: { position: i, length: 1, type: "number" },
            delta: { position: i * 2 + 1, length: 2, type: "signed" },
            sample1: { position: i * 4 + 3, length: 2, type: "signed" },
            sample2: { position: i * 4 + 5, length: 2, type: "signed" }
        };

        const block = generateByteObjectFromMapping(rawBlock, mapping);

        // The predictor is in the range 0 to 6
        block.data.predictor = clamp(block.data.predictor as number, 0, 6);

        // Get the coefficients
        block.data.coeff1 = AUDIO_MS_ADPCM_TABLES.coeff1[block.data.predictor as number];
        block.data.coeff2 = AUDIO_MS_ADPCM_TABLES.coeff2[block.data.predictor as number];

        // Get the remaining samples (still in byte form)
        block.data.samples = rawBlock.slice(7, dataBlockAlign - 7);

        blocks.push(block);
    }

    return blocks;
}

/**
 * Reads and decode an MS-ADPCM audio file.
 *
 * Note that this function supports any number of channels.
 *
 * @param cache Initialized cache class.
 * @param header The audio file header.
 * @returns The decoded audio data.
 */
function decodeAudioData(
    cache: Cache,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness
) {
    // Calculate the amount of blocks
    const dataBlockAlign = header.data.dataBlockAlign as number;
    const dataBlockSize = header.data.dataBlockSize as number;
    const numBlocks = Math.ceil(dataBlockSize / dataBlockAlign);

    for (let i = 0; i < numBlocks; i++) {
        const blocks = readAudioDataBlockHeader(cache, header, i);

        // For each channel
        for (let j = 0; j < blocks.length; j++) {
            const block = blocks[j];

            console.log(block);
        }
    }
}

/**
 * Sends the audio data to the speaker.
 * @param data The audio data.
 */
function sendDataToSpeaker(data: Uint8Array[][]) {
    const speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 44100
    });

    const stream = new Readable();

    stream._read = () => {
        for (let i = 0; i < data.length; i++) {
            const channelData = data[i];

            for (let j = 0; j < channelData.length; j++) {
                stream.push(Buffer.from(channelData[j]));
            }
        }

        stream.push(null);
    };

    stream.pipe(speaker);
}

/**
 * Main function for reading audio files (.waa, .wac, .wad, .wam).
 * @param audioFilePath The absolute path to the audio file.
 * @param outputDirPath The absolute path to the output directory.
 * @link https://wiki.multimedia.cx/index.php/Microsoft_ADPCM
 */
export function Audio(audioFilePath: string, outputDirPath: string) {
    if (!fs.existsSync(audioFilePath)) {
        throw new Error(`The audio file doesn't exist: ${audioFilePath}`);
    }

    if (!checkFileExtension(audioFilePath, [".waa", ".wac", ".wad", ".wam"])) {
        throw new Error("Invalid audio file extension");
    }

    const cache = new Cache(audioFilePath, CHUNK_SIZE);

    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    // BG&E files don't contain looping information, so the looping is done by extension
    // wam and waa contain ambient sounds and music, so often they contain looped music,
    // later, if the file is too short looping will be disabled
    // https://github.com/vgmstream/vgmstream/blob/master/src/meta/ubi_jade.c
    const loopFlag = checkFileExtension(audioFilePath, [".waa", ".wam"]);

    const header = readAudioHeader(
        cache,
        loopFlag
    );

    const decodedData = decodeAudioData(
        cache,
        header
    );

    console.log(decodedData);

    cache.closeFile();
}