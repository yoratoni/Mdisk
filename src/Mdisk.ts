/* eslint-disable @typescript-eslint/no-unused-vars */
import logger from "helpers/logger";
import BigFileBuilder from "tools/builders/bigFileBuilder";
import AudioExtractor from "tools/extractors/audioExtractor";
import BigFileExtractor from "tools/extractors/bigFileExtractor";
import BinExtractor from "tools/extractors/binExtractor";

logger.info("Mdisk started..");

BigFileBuilder(
    "F:/Yoratoni/Mdisk/src/binary/bf/sally_clean.bf",
    "C:/Users/terci/Desktop/BigFile",
    "C:/Users/terci/Desktop/BigFile"
);

// TODO: Add a parameter for endianness.

// BigFileExtractor("F:/Yoratoni/Mdisk/src/binary/bf/sally_clean.bf", "C:/Users/terci/Desktop/BigFile", true, false);
// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/jingle_demo.wam", "F:/Yoratoni/Mdisk/src/binary");
// AudioExtractor("F:/Yoratoni/Mdisk/src/binary/beluga_demo.waa", "F:/Yoratoni/Mdisk/src/binary");

// BinExtractor("F:/Yoratoni/Mdisk/src/binary/bin/textures/ff802b5b.bin", "F:/Yoratoni/Mdisk/src/binary/textures", true);