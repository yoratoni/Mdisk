/* eslint-disable @typescript-eslint/no-unused-vars */
import { convertStringToUint8Array, convertUint8ArrayToHexString, convertUint8ArrayToString } from "helpers/bytes";
import { generatePNG } from "helpers/images";
import logger from "helpers/logger";
import { generateHuffmanTable } from "helpers/maths/algorithms/huffman";
import BigFileBuilder from "tools/builders/bigFileBuilder";
import AudioExtractor from "tools/extractors/audioExtractor";
import BigFileExtractor from "tools/extractors/bigFileExtractor";
import BinExtractor from "tools/extractors/binExtractor";
import TrailerExtractor from "tools/extractors/trailerExtractor";


// STEAM GOG

logger.info("Mdisk started..");


const data =  "ABCDEflknojnjjnj";  // new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8]);

const encodedData = generateHuffmanTable(data);

console.log(encodedData);

// console.log(
//     convertUint8ArrayToHexString(encodedData, true, false, true)
// );


// const pixels = [];

// for (let i = 0; i < 1; i++) {
//     for (let j = 0; j < 1; j++) {
//         pixels.push({
//             R: 219,
//             G: 195,
//             B: 205
//         });
//     }
// }

// generatePNG(
//     "C:/Users/terci/Desktop",
//     "PNG_TEST",
//     1,
//     1,
//     pixels
// );

// BigFileExtractor("F:/Yoratoni/Mdisk/src/binary/bf/sally_clean_gog.bf", "C:/Users/terci/Desktop/BigFile (GOG)", true, false);

// BigFileBuilder(
//     "F:/Yoratoni/Mdisk/src/binary/bf/sally_clean_gog.bf",
//     "C:/Users/terci/Desktop/BigFile (GOG)",
//     "C:/Users/terci/Desktop/BigFile (GOG)"
// );

// TODO: Add a parameter for endianness.


// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/jingle_demo.wam", "F:/Yoratoni/Mdisk/src/binary");
// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/beluga_demo.waa", "F:/Yoratoni/Mdisk/src/binary");

// BinExtractor("F:/Yoratoni/Mdisk/src/binary/bin/texts/fd80f3f8.bin", "F:/Yoratoni/Mdisk/src/binary/archives/texts", true);

// TrailerExtractor("F:/Yoratoni/Mdisk/src/binary/mtx/MO_NTSC.mtx", "F:/Yoratoni/Mdisk/src/binary/archives/trailers");