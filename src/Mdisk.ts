/* eslint-disable @typescript-eslint/no-unused-vars */
import logger from "helpers/logger";
import AudioExtractor from "tools/audioExtractor";
import BigFileExtractor from "tools/bigFileExtractor";
import BinExtractor from "tools/binExtractor";

logger.info("Mdisk started..");

// TODO: Add a parameter for endianness.

// BigFileExtractor("F:/Yoratoni/Mdisk/src/binary/bf/sally_clean.bf", "C:/Users/terci/Desktop/BigFile", true);
// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/jingle_demo.wam", "F:/Yoratoni/Mdisk/src/binary");
// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/beluga_demo.waa", "F:/Yoratoni/Mdisk/src/binary");

BinExtractor("F:/Yoratoni/Mdisk/src/binary/bin/textures/ff802b5b.bin", "F:/Yoratoni/Mdisk/src/binary/textures");