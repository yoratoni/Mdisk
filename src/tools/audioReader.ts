import fs from "fs";
import { Readable } from "stream";

import Speaker from "speaker";

import Cache from "classes/cache";
import { AUDIO_MS_ADPCM_TABLES , CHUNK_SIZE } from "configs/constants";
import { MpAudioHeader } from "configs/mappings";
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


/**
 * Converts the number of bytes in the audio file (MS-ADPCM) to the number of samples.
 * @param subChunk2Size The size of the audio data.
 * @param blockAlign The header block size metadata.
 * @param numChannels The number of channels.
 * @returns The number of samples.
 */
function convertMsadpcmBytesToSamples(subChunk2Size: number, blockAlign: number, numChannels: number) {
    if (blockAlign <= 0 || numChannels <= 0) {
        return 0;
    }

    // 6 * numChannels => (7-1) * numChannels
    const samples = (subChunk2Size / blockAlign) * (blockAlign - 6 * numChannels) * 2 / numChannels;
    const eSamples = (subChunk2Size % blockAlign) ? ((subChunk2Size % blockAlign) - 6 * numChannels) * 2 / numChannels : 0;

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

    if (header.data.subChunk1Size !== 0x12 && header.data.subChunk1Size !== 0x32) {
        throw new Error("Invalid audio file format (sub chunk size)");
    }

    if (header.data.blockAlign !== header.data.numChannels as number * 0x24) {
        throw new Error("Invalid audio file format (block size)");
    }

    header.data.samples = convertMsadpcmBytesToSamples(
        header.data.subChunk2Size as number,
        header.data.blockAlign as number,
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
 * Reads the MS-ADPCM audio header.
 *
 * Note that this function supports any number of channels.
 *
 * @param cache Initialized cache class.
 * @param header The header of the audio file.
 * @returns The formatted MS-ADPCM audio header.
 */
function readAudioDataBlockHeader(
    cache: Cache,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
): NsBytes.IsMappingByteObjectResultWithEmptiness {
    const headerSize = header.data.headerSize as number;
    const numChannels = header.data.numChannels as number;
    const dataBlockHeaderSize = 7 * numChannels;

    const rawHeader = cache.readBytes(headerSize, dataBlockHeaderSize);

    const predictors: number[] = [];
    const coeffs1: number[] = [];
    const coeffs2: number[] = [];
    const deltas: Uint8Array[] = [];
    const samples1: Uint8Array[] = [];
    const samples2: Uint8Array[] = [];

    for (let i = 0; i < numChannels; i++) {
        const predictor = clamp(convertUint8ArrayToSignedNumber(rawHeader.slice(i, i+1)), 0, 6);
        const coeff1 = AUDIO_MS_ADPCM_TABLES.coeff1[predictor];
        const coeff2 = AUDIO_MS_ADPCM_TABLES.coeff2[predictor];
        const delta = rawHeader.slice(i+numChannels, i+numChannels+2);
        const sample1 = rawHeader.slice(i+numChannels+2, i+numChannels+4);
        const sample2 = rawHeader.slice(i+numChannels+4, i+numChannels+6);

        predictors.push(predictor);
        coeffs1.push(coeff1);
        coeffs2.push(coeff2);
        deltas.push(delta);
        samples1.push(sample1);
        samples2.push(sample2);
    }

    return {
        data: {
            predictors,
            coeffs1,
            coeffs2,
            deltas,
            samples1,
            samples2
        },
        isEmpty: false
    };
}


/**
 * Expands the nibble to a sample.
 * @param nibble The nibble operation.
 * @param coeffs1 The coefficients (T-1).
 * @param coeffs2 The coefficients (T-2).
 * @param deltas The deltas.
 * @param rawSamples1 The raw samples (T-1).
 * @param rawSamples2 The raw samples (T-2).
 * @param currChannel The current channel.
 * @returns The expanded nibble (+ the data to update).
 */
function expandNibble(
    nibble: number,
    coeffs1: number[],
    coeffs2: number[],
    deltas: Uint8Array[],
    rawSamples1: Uint8Array[],
    rawSamples2: Uint8Array[],
    currChannel: number
) {
    const signed = 8 <= nibble ? nibble - 16 : nibble;

    // Converts the data into numbers for calculations
    const sample1 = convertUint8ArrayToSignedNumber(rawSamples1[currChannel]);
    const sample2 = convertUint8ArrayToSignedNumber(rawSamples2[currChannel]);
    const delta = convertUint8ArrayToSignedNumber(deltas[currChannel]);

    // console.log("sample1 (NUM)", sample1);

    // Calculate the predictor
    let predictor = sample1 * coeffs1[currChannel] + sample2 * coeffs2[currChannel];
    predictor = predictor >> 8;
    predictor += signed * delta;
    predictor = clamp(predictor, -32768, 32767);

    // Converts the numbers back into bytes
    const pcmSample = convertNumberToUint8Array(predictor);
    const rawSample2 = convertNumberToUint8Array(sample1);
    const rawSample1 = pcmSample;

    // console.log("sample1 (BYTE)", rawSample2);

    // Saturate delta to lower bound of 16
    let lowBoundDelta = Math.floor((delta * AUDIO_MS_ADPCM_TABLES.adaptationTable[nibble]) >> 8);
    if (lowBoundDelta < 16) {
        lowBoundDelta = 16;
    }

    const rawDelta = convertNumberToUint8Array(lowBoundDelta);

    return {
        pcmSample,
        rawSample1,
        rawSample2,
        rawDelta
    };
}

/**
 * Reads the data from the audio file.
 * @param cache Initialized cache class.
 * @param header The header of the audio file.
 * @param dataBlockHeader The MS-ADPCM audio header.
 * @returns The audio data (Uint8Array[] where each list is a channel).
 */
function decodeAudioData(
    cache: Cache,
    header: NsBytes.IsMappingByteObjectResultWithEmptiness,
    dataBlockHeader: NsBytes.IsMappingByteObjectResultWithEmptiness
) {
    const output: Uint8Array[] = [];

    const headerSize = header.data.headerSize as number;
    const subChunk2Size = header.data.subChunk2Size as number;
    const numChannels = header.data.numChannels as number;

    const coeffs1 = dataBlockHeader.data.coeffs1 as number[];
    const coeffs2 = dataBlockHeader.data.coeffs2 as number[];
    const deltas = dataBlockHeader.data.deltas as Uint8Array[];
    const samples1 = dataBlockHeader.data.samples1 as Uint8Array[];
    const samples2 = dataBlockHeader.data.samples2 as Uint8Array[];

    const data = cache.readBytes(headerSize, subChunk2Size);

    for (let i = 0; i < numChannels; i++) {
        const sample1 = samples1[i * 2];
        const sample2 = samples2[i * 2];

        // The initial 2 samples from the block preamble are sent directly to the output,
        // sample 2 is first, then sample 1
        output[i] = new Uint8Array([...sample2, ...sample1]);
    }

    let offset = 0;
    let nibble;
    let currChannel = 0;

    while (offset < 2) {
        const byte = data[offset];

        // Upper nibble
        nibble = expandNibble(
            byte >> 4,
            coeffs1,
            coeffs2,
            deltas,
            samples1,
            samples2,
            currChannel
        );

        // Updates the data for the next nibble
        samples1[currChannel] = nibble.rawSample1;
        deltas[currChannel] = nibble.rawDelta;

        output[currChannel] = new Uint8Array([...output[currChannel], ...nibble.pcmSample]);
        currChannel = (currChannel + 1) % numChannels;

        // Lower nibble
        nibble = expandNibble(
            byte & 0xf,
            coeffs1,
            coeffs2,
            deltas,
            samples1,
            samples2,
            currChannel
        );

        // Updates the data for the next nibble
        samples2[currChannel] = nibble.rawSample2;
        deltas[currChannel] = nibble.rawDelta;

        output[currChannel] = new Uint8Array([...output[currChannel], ...nibble.pcmSample]);
        currChannel = (currChannel + 1) % numChannels;

        offset++;
    }

    return output;
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

    const dataBlockHeader = readAudioDataBlockHeader(
        cache,
        header
    );

    const data = decodeAudioData(
        cache,
        header,
        dataBlockHeader
    );

    console.log(convertUint8ArrayToHexStringArray(data[0]));
    // sendDataToSpeaker(data);

    cache.closeFile();
}