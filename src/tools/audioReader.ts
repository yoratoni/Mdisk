import fs from "fs";Object

import Cache from "classes/cache";
import { AUDIO_MS_ADPCM_TABLES , CHUNK_SIZE } from "configs/constants";
import { MpAudioHeader } from "configs/mappings";
import { convertNumberToUint8Array, convertStringToUint8Array, generateByteObjectFromMapping } from "helpers/bytes";
import { checkFileExtension } from "helpers/files";
import { clamp } from "helpers/numbers";
import NsBytes from "types/bytes";
import NsMappings from "types/mappings";
import path from "path";


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
function readAudioHeader(cache: Cache, loopFlag: boolean, headerSize = 46) {
    const rawHeader = cache.readBytes(0, headerSize);
    const header = generateByteObjectFromMapping(rawHeader, MpAudioHeader);

    header.data.headerSize = headerSize;

    if (header.data.fileID !== "RIFF" || header.data.format !== "WAVE") {
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
 * Reads an unique MS-ADPCM audio block returning an array
 * where each value are the data for a channel (stereo, etc..).
 * Note that this function supports any number of channels.
 * @param cache Initialized cache class.
 * @param header The audio file header.
 * @param dataBlockNumber The number of the block to read.
 * @param dataBlockAlign The size of one data block.
 * @returns The formatted MS-ADPCM audio data (array -> each value = channel).
 */
function readAudioDataBlock(
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

        const blockHeader = generateByteObjectFromMapping(rawBlock, mapping);
        const blockHeaderSize = numChannels * 7;

        // The predictor is in the range 0 to 6
        blockHeader.data.predictor = clamp(blockHeader.data.predictor as number, 0, 6);

        // Get the coefficients
        blockHeader.data.coeff1 = AUDIO_MS_ADPCM_TABLES.coeff1[blockHeader.data.predictor as number];
        blockHeader.data.coeff2 = AUDIO_MS_ADPCM_TABLES.coeff2[blockHeader.data.predictor as number];

        // Get the remaining samples (still in byte form)
        // Note: don't remove blockHeaderSize from the length
        const rawSamples = rawBlock.slice(blockHeaderSize, dataBlockAlign);

        // Filter the samples for the current channel
        blockHeader.data.samples = rawSamples.filter((_, index) => {
            return index % numChannels === i;
        });

        channelBlocks.push(blockHeader);
    }

    return channelBlocks;
}

/**
 * Takes a formatted block as an argument and returns the decoded samples,
 * note that the input blocks should already be separated by channel.
 * @param block The mono-block to decode.
 * @returns The decoded samples.
 */
function decodeBlockSamples(
    block: NsBytes.IsMappingByteObjectResultWithEmptiness
) {
    const coeff1 = block.data.coeff1 as number;
    const coeff2 = block.data.coeff2 as number;
    const samples = block.data.samples as Uint8Array;
    let delta = block.data.delta as number;
    let sample1 = block.data.sample1 as number;
    let sample2 = block.data.sample2 as number;

    const output: number[] = [];

    // The initial 2 samples from the block preamble are sent directly to the output.
    // Sample 2 is first, then sample 1.
    output[0] = sample2;
    output[1] = sample1;

    for (let i = 0; i < samples.length; i++) {
        const nibbles = [
            samples[i] >> 4,  // High nibble
            samples[i] & 0x0f  // Low nibble
        ];

        // Though RIFFNEW writes "predictor / 256" (DIV), msadpcm.c uses "predictor >> 8" (SHR).
        // They may seem the same but on negative values SHR gets different results
        // (-128 / 256 = 0; -128 >> 8 = -1) = some output diffs.
        for (const nibble of nibbles) {
            const signed = 8 <= nibble ? nibble - 16 : nibble;

            // Calculate the predictor
            let predictor = (coeff1 * sample1 + coeff2 * sample2) >> 8;
            predictor += signed * delta;

            // Clamp the predictor to the range [-32768, 32767]
            predictor = clamp(predictor, -32768, 32767);

            // Round the predictor to the nearest integer
            predictor = Math.floor(predictor);

            // Add the predictor to the output
            output.push(predictor);

            // Shift the samples
            sample2 = sample1;
            sample1 = predictor;

            // Adapt the delta
            delta = Math.floor((delta * AUDIO_MS_ADPCM_TABLES.adaptationTable[nibble]) >> 8);

            // Saturate the delta to lower bound of 16
            delta = Math.max(delta, 16);
        }
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
        const channelBlocks = readAudioDataBlock(cache, header, i, dataBlockAlign);

        // For each channel -> data block
        for (let i = 0; i < channelBlocks.length; i++) {
            const block = decodeBlockSamples(channelBlocks[i]);

            // Add the decoded samples to the output
            // Note that we can't directly use push(...block)
            // because it would exceed the maximum call stack size.
            for (const sample of block) {
                output.push(sample);
            }
        }
    }

    return output;
}

/**
 * Generates the extracted PCM data (including the header) to an output Uint8Array.
 * @param header The audio file header.
 * @param data The decoded audio data.
 * @link http://soundfile.sapp.org/doc/WaveFormat/
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
        convertNumberToUint8Array(header.data.fileSize as number, 4, false),
        convertStringToUint8Array(header.data.format as string),
        convertStringToUint8Array(header.data.fmtBlockID as string),
        convertNumberToUint8Array(header.data.fmtBlockSize as number, 4, false),
        convertNumberToUint8Array(header.data.codec as number, 2, false),
        convertNumberToUint8Array(header.data.numChannels as number, 2, false),
        convertNumberToUint8Array(header.data.sampleRate as number, 4, false),
        convertNumberToUint8Array(header.data.byteRate as number, 4, false),
        convertNumberToUint8Array(header.data.dataBlockAlign as number, 2, false),
        convertNumberToUint8Array(header.data.bitsPerSample as number, 2, false),
        convertStringToUint8Array(header.data.dataBlockID as string),
        convertNumberToUint8Array(header.data.dataBlockSize as number, 4, false)
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
        dataArray.push(convertNumberToUint8Array(sample, 2, false));
    }

    const dataOutput = Buffer.concat(dataArray);

    return Buffer.concat([headerOutput, dataOutput]);
}

/**
 * Main function for reading audio files (.waa, .wac, .wad, .wam).
 * @param audioFilePath The absolute path to the audio file.
 * @param outputDirPath The absolute path to the output directory.
 * @link https://wiki.multimedia.cx/index.php/Microsoft_ADPCM
 */
export function AudioFileExtractor(audioFilePath: string, outputDirPath: string) {
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
        header,
        header.data.dataBlockAlign as number,
        header.data.dataBlockSize as number
    );

    const finalData = generateAudioData(
        header,
        decodedData
    );

    const outputFilePath = path.join(
        outputDirPath,
        path.basename(audioFilePath, path.extname(audioFilePath)) + ".wav"
    );

    fs.writeFileSync(outputFilePath, finalData);

    cache.closeFile();
}