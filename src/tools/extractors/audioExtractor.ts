import fs from "fs";
import path from "path";

import Cache from "classes/cache";
import { AUDIO_MS_ADPCM_TABLES, CHUNK_SIZE } from "configs/constants";
import { MpAudioHeader } from "configs/mappings";
import {
    convertNumberToUint8Array,
    convertStringToUint8Array,
    generateBytesObjectFromMapping
} from "helpers/bytes";
import { checkFileExtension, extractorChecker } from "helpers/files";
import logger from "helpers/logger";
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
 * Note that the size includes 2 padding bytes
 * so a subChunk size of 18 instead of 16.
 * @param cache Initialized cache class.
 * @param loopFlag Whether the audio file supposedly is looped.
 * @param headerSize The size of the header (defaults to 46 bytes).
 * @returns The formatted header.
 */
function readFileHeader(cache: Cache, loopFlag: boolean, headerSize = 46) {
    const rawHeader = cache.readBytes(0, headerSize);
    const header = generateBytesObjectFromMapping(rawHeader, MpAudioHeader);

    header.data.headerSize = headerSize;

    if (header.data.fileID !== "RIFF" || header.data.format !== "WAVE") {
        logger.error("Invalid audio file format (RIFF/WAVE)");
        process.exit(1);
    }

    if (header.data.fmtBlockSize !== 0x12 && header.data.fmtBlockSize !== 0x32) {
        logger.error("Invalid audio file format (fmt block size)");
        process.exit(1);
    }

    if (header.data.dataBlockAlign !== header.data.numChannels as number * 0x24) {
        logger.error("Invalid audio file format (data block align)");
        process.exit(1);
    }

    // Calculate the number of samples
    header.data.samples = convertMsadpcmBytesToSamples(
        header.data.dataBlockSize as number,
        header.data.dataBlockAlign as number,
        header.data.numChannels as number
    );

    // Jade Engine V1 loops by extension, try to detect incorrectly looped jingles (too short)
    // < 30s is generally too short for a looped jingle
    const sampleRate = header.data.sampleRate as number;
    header.data.loopFlag = loopFlag && header.data.samples >= 30 * sampleRate;

    header.data.loopStart = 0;
    header.data.loopEnd = header.data.samples;

    return header;
}

/**
 * Converts a byte array of samples to an array of nibbles (UPPER - LOWER).
 * @param rawSamples The byte array of samples.
 * @returns The array of nibbles.
 */
function convertSamplesToNibbles(rawSamples: Uint8Array) {
    const nibbles: number[] = [];

    for (let i = 0; i < rawSamples.length; i++) {
        nibbles.push(rawSamples[i] >> 4);  // Upper nibble
        nibbles.push(rawSamples[i] & 0xF);  // Lower nibble
    }

    return nibbles;
}

/**
 * Reads an unique MS-ADPCM audio block returning an array containing
 * the data for each channel, including the nibbles (not filtered).
 * Note that this function supports any number of channels.
 * @param cache Initialized cache class.
 * @param header The audio file header.
 * @param dataBlockNumber The number of the block to read.
 * @param dataBlockAlign The size of one data block.
 * @returns The formatted MS-ADPCM audio data (array -> each value = channel).
 */
function readDataBlock(
    cache: Cache,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
    dataBlockNumber: number,
    dataBlockAlign: number
) {
    const headerSize = header.data.headerSize as number;
    const numChannels = header.data.numChannels as number;

    // Reads the complete block including all channels
    const rawBlock = cache.readBytes(headerSize + dataBlockNumber * dataBlockAlign, dataBlockAlign);

    const channelBlocks: NsBytes.IsMappingByteObjectResultWithEmptiness[] = [];

    for (let i = 0; i < numChannels; i++) {
        // Create a custom mapping for each channel
        const mapping: NsMappings.IsMapping = {
            predictor: { position: i, length: 1, type: "number" },
            delta: { position: i * 2 + numChannels, length: 2, type: "signed" },
            sample1: { position: i * 2 + 3 * numChannels, length: 2, type: "signed" },
            sample2: { position: i * 2 + 5 * numChannels, length: 2, type: "signed" }
        };

        const blockHeader = generateBytesObjectFromMapping(rawBlock, mapping);
        const blockHeaderSize = numChannels * 7;

        // Records the channel number & numChannels
        blockHeader.data.channel = i;
        blockHeader.data.numChannels = numChannels;

        // The predictor is in the range 0 to 6
        blockHeader.data.predictor = clamp(blockHeader.data.predictor as number, 0, 6);

        // Get the coefficients
        blockHeader.data.coeff1 = AUDIO_MS_ADPCM_TABLES.coeff1[blockHeader.data.predictor as number];
        blockHeader.data.coeff2 = AUDIO_MS_ADPCM_TABLES.coeff2[blockHeader.data.predictor as number];

        // Get the remaining samples (still in byte form)
        // Note: don't remove blockHeaderSize from the length
        const rawSamples = rawBlock.slice(blockHeaderSize, dataBlockAlign);

        // Convert the samples to nibbles
        blockHeader.data.nibbles = convertSamplesToNibbles(rawSamples);

        channelBlocks.push(blockHeader);
    }

    return channelBlocks;
}

/**
 * Takes a formatted block as an argument and returns the decoded samples.
 * Note that this function supports any number of channels.
 * @param channelBlock The channel-block to decode.
 * @returns The decoded samples.
 */
function decodeChannelSamples(
    channelBlock: NsBytes.IsMappingByteObjectResultWithEmptiness
) {
    const numChannels = channelBlock.data.numChannels as number;
    const channel = channelBlock.data.channel as number;
    const coeff1 = channelBlock.data.coeff1 as number;
    const coeff2 = channelBlock.data.coeff2 as number;
    const nibbles = channelBlock.data.nibbles as number[];

    let delta = channelBlock.data.delta as number;
    let sample1 = channelBlock.data.sample1 as number;
    let sample2 = channelBlock.data.sample2 as number;

    const output: number[] = [];

    // The initial 2 samples from the channelBlock preamble are sent directly to the output.
    // Sample 2 is first, then sample 1.
    output[0] = sample2;
    output[1] = sample1;

    // Decode the remaining samples
    // Note: the loop filters out the samples for the current channel
    for (let i = channel; i < nibbles.length; i += numChannels) {
        const nibble = nibbles[i];

        // Convert the nibble to a signed integer
        const signed = nibble >= 8 ? nibble - 16 : nibble;

        // Calculate the predictor
        let predictor = (coeff1 * sample1 + coeff2 * sample2) >> 8;
        predictor += signed * delta;

        // Clamp the predictor to the range [-32768, 32767]
        predictor = clamp(predictor, -32768, 32767);

        // Floor the predictor to the nearest integer
        predictor = Math.floor(predictor);

        // Add the predictor to the output
        output.push(predictor);

        // Shift the samples
        sample2 = sample1;
        sample1 = predictor;

        // Adapt the delta
        delta = Math.floor((delta * AUDIO_MS_ADPCM_TABLES.adaptationTable[nibble & 0xF]) >> 8);

        // Saturate the delta to lower bound of 16
        delta = Math.max(delta, 16);
    }

    return output;
}

/**
 * Reads and decode an MS-ADPCM audio file.
 * Note that this function supports any number of channels.
 * @param cache Initialized cache class.
 * @param header The audio file header.
 * @param dataBlockAlign The size of one data block.
 * @param dataBlockSize The size of the audio data.
 * @returns The decoded audio data (as a string[]).
 */
function decodeAudioData(
    cache: Cache,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
    dataBlockAlign: number,
    dataBlockSize: number
) {
    const numBlocks = Math.ceil(dataBlockSize / dataBlockAlign);

    const output: number[] = [];

    for (let i = 0; i < numBlocks; i++) {
        const channelBlocks = readDataBlock(cache, header, i, dataBlockAlign);
        const allSamples: number[][] = [];

        for (let j = 0; j < channelBlocks.length; j++) {
            const channelSamples = decodeChannelSamples(channelBlocks[j]);
            allSamples.push(channelSamples);
        }

        // Merge the channel samples together (interleaved)
        for (let j = 0; j < allSamples[0].length; j++) {
            for (let k = 0; k < allSamples.length; k++) {
                output.push(allSamples[k][j]);
            }
        }
    }

    return output;
}

/**
 * Generates the extracted PCM data (including the header) to an output Uint8Array.
 * @param header The audio file header.
 * @param data The decoded audio data.
 * @link [WAVE Format](http://soundfile.sapp.org/doc/WaveFormat/)
 */
function generateAudioData(
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
    data: number[]
) {
    const sampleRate = header.data.sampleRate as number;
    const numChannels = header.data.numChannels as number;

    // 2 bytes per sample
    header.data.dataBlockSize = data.length * 2;

    // 36 bytes for the subheader
    header.data.fileSize = header.data.dataBlockSize + 36;

    // Changing the fmt block size to 16 (removing the extra Jade Engine padding)
    header.data.fmtBlockSize = 16;

    // Changing the codec to PCM
    header.data.codec = 1;

    // Changing the bits per sample
    header.data.bitsPerSample = 16;

    // Changing the block align
    header.data.dataBlockAlign = numChannels * (header.data.bitsPerSample / 8);

    // Changing the byte rate
    header.data.byteRate = (sampleRate * numChannels * header.data.bitsPerSample) / 8;

    /*
     * =====================
     * Generating the header
     * =====================
     */

    const headerArray: Uint8Array[] = [];

    // Generate the header (as a Uint8Array)
    // Manually done because the header is not a simple mapping
    headerArray.push(
        convertStringToUint8Array(header.data.fileID as string),
        convertNumberToUint8Array(header.data.fileSize as number, 4),
        convertStringToUint8Array(header.data.format as string),
        convertStringToUint8Array(header.data.fmtBlockID as string),
        convertNumberToUint8Array(header.data.fmtBlockSize as number, 4),
        convertNumberToUint8Array(header.data.codec as number, 2),
        convertNumberToUint8Array(header.data.numChannels as number, 2),
        convertNumberToUint8Array(header.data.sampleRate as number, 4),
        convertNumberToUint8Array(header.data.byteRate as number, 4),
        convertNumberToUint8Array(header.data.dataBlockAlign as number, 2),
        convertNumberToUint8Array(header.data.bitsPerSample as number, 2),
        convertStringToUint8Array(header.data.dataBlockID as string),
        convertNumberToUint8Array(header.data.dataBlockSize as number, 4)
    );

    const headerOutput = Buffer.concat(headerArray);

    /*
     * ===================
     * Generating the data
     * ===================
     */

    const dataArray: Uint8Array[] = [];

    // Generate the data (as a Uint8Array)
    for (const sample of data) {
        dataArray.push(convertNumberToUint8Array(sample, 2));
    }

    const dataOutput = Buffer.concat(dataArray);

    return Buffer.concat([headerOutput, dataOutput]);
}

/**
 * Main function for reading/extracting audio files (.waa, .wac, .wad, .wam).
 * Converts the audio file to a PCM audio file (WAV).
 * @param audioFilePath The absolute path to the audio file.
 * @param outputDirPath The absolute path to the output directory.
 * @link [ADPCM Data wiki.](https://wiki.multimedia.cx/index.php/Microsoft_ADPCM)
 * @link [VgmStream for Jade Engine.](https://github.com/vgmstream/vgmstream/blob/master/src/meta/ubi_jade.c)
 * @link [Node MS ADPCM by Snack-X.](https://github.com/Snack-X/node-ms-adpcm/blob/master/index.js)
 */
export default function AudioExtractor(audioFilePath: string, outputDirPath: string) {
    extractorChecker(audioFilePath, "audio file", [".waa", ".wac", ".wad", ".wam"], outputDirPath);

    // Loading the cache
    const cache = new Cache(audioFilePath, CHUNK_SIZE);

    // BG&E files don't contain looping information, so the looping is done by extension
    // wam and waa contain ambient sounds and music, so often they contain looped music,
    // later, if the file is too short looping will be disabled
    const loopFlag = checkFileExtension(audioFilePath, [".waa", ".wam"]);

    const header = readFileHeader(
        cache,
        loopFlag
    );

    const decodedData = decodeAudioData(
        cache,
        header,
        header.data.dataBlockAlign as number,
        header.data.dataBlockSize as number
    );

    const finalData = generateAudioData(
        header,
        decodedData
    );

    // Remove the extension from the filename to replace it with .wav
    let filename = path.basename(audioFilePath, path.extname(audioFilePath));

    // Add the loop data to the name
    if (header.data.loopFlag) {
        const loopStart = header.data.loopStart as number;
        const loopEnd = header.data.loopEnd as number;

        const loopStartSeconds = loopStart / (header.data.sampleRate as number);
        const loopEndSeconds = loopEnd / (header.data.sampleRate as number);

        const loopStartString = loopStartSeconds.toFixed(2);
        const loopEndString = loopEndSeconds.toFixed(2);

        const loopString = `_${loopStartString}_${loopEndString}`;

        filename += loopString;
    }

    const outputFilePath = path.join(outputDirPath, filename + ".wav");

    fs.writeFileSync(outputFilePath, finalData);

    cache.closeFile();
}