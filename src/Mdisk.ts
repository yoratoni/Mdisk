/* eslint-disable @typescript-eslint/no-unused-vars */
import { convertStringToUint8Array, convertUint8ArrayToHexString, convertUint8ArrayToString } from "helpers/bytes";
import { generateBMPImage } from "helpers/images/bmp";
import logger from "helpers/logger";
import BigFileBuilder from "tools/builders/bigFileBuilder";
import AudioExtractor from "tools/extractors/audioExtractor";
import BigFileExtractor from "tools/extractors/bigFileExtractor";
import BinExtractor from "tools/extractors/binExtractor";
import TrailerExtractor from "tools/extractors/trailerExtractor";


// STEAM GOG

logger.info("Mdisk started..");

const rgb = [];
const rgba = [];

// RGB
rgb.push(
    { R: 255, G: 0, B: 0 },
    { R: 255, G: 255, B: 255 },
    { R: 0, G: 0, B: 255 },
    { R: 0, G: 255, B: 0 },
);

// RGBA
rgba.push(
    { R: 0, G: 0, B: 255, A: 127 },
    { R: 0, G: 255, B: 0, A: 127 },
    { R: 255, G: 0, B: 0, A: 127 },
    { R: 255, G: 255, B: 255, A: 127 },
    { R: 0, G: 0, B: 255, A: 255 },
    { R: 0, G: 255, B: 0, A: 255 },
    { R: 255, G: 0, B: 0, A: 255 },
    { R: 255, G: 255, B: 255, A: 255 },
);

generateBMPImage(
    "C:/Users/terci/Desktop",
    "BMP_TEST",
    4,
    2,
    rgba
);




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