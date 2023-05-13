/* eslint-disable @typescript-eslint/no-unused-vars */
import { convertStringToUint8Array, convertUint8ArrayToString } from "helpers/bytes";
import logger from "helpers/logger";
import BigFileBuilder from "tools/builders/bigFileBuilder";
import AudioExtractor from "tools/extractors/audioExtractor";
import BigFileExtractor from "tools/extractors/bigFileExtractor";
import BinExtractor from "tools/extractors/binExtractor";

// STEAM GOG

logger.info("Mdisk started..");

// BigFileExtractor("F:/Yoratoni/Mdisk/src/binary/bf/sally_clean_gog.bf", "C:/Users/terci/Desktop/BigFile (GOG)", true, false);

// BigFileBuilder(
//     "F:/Yoratoni/Mdisk/src/binary/bf/sally_clean_gog.bf",
//     "C:/Users/terci/Desktop/BigFile (GOG)",
//     "C:/Users/terci/Desktop/BigFile (GOG)"
// );

// TODO: Add a parameter for endianness.


// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/jingle_demo.wam", "F:/Yoratoni/Mdisk/src/binary");
// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/beluga_demo.waa", "F:/Yoratoni/Mdisk/src/binary");

// BinExtractor("F:/Yoratoni/Mdisk/src/binary/bin/textures/ff802b5b.bin", "F:/Yoratoni/Mdisk/src/binary/textures", true);