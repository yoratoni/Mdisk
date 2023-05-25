/* eslint-disable @typescript-eslint/no-unused-vars */
import { VIS_CONFIG, VIS_GRADIENTS } from "configs/config";
import logger from "helpers/logger";
import visualizer, { mixColorByteWithColorArray } from "helpers/visualizer";


logger.info("File visualizer started..");

const filter = (input: Uint8Array, byteIndex: number) => {
    const color = input[byteIndex];

    const resColor = {
        R: color,
        G: color,
        B: color
    };

    if (color === 0x00) {
        resColor.R = VIS_GRADIENTS.purple[0][0];
        resColor.G = VIS_GRADIENTS.purple[0][1];
        resColor.B = VIS_GRADIENTS.purple[0][2];
    }

    return {
        R: resColor.R,
        G: resColor.G,
        B: resColor.B
    };
};

visualizer(
    "F:/Yoratoni/Mdisk/src/binary/mtx/trailerOK_NTSC.mtx",
    VIS_CONFIG.outputDirPath,
    {
        bytesPerRow: VIS_CONFIG.bytesPerRow,
        numberOfBytesToRead: VIS_CONFIG.numberOfBytesToRead,
        chunkSize: VIS_CONFIG.chunkSize,
        filter: filter,
        backgroundColor: VIS_CONFIG.backgroundColor,
        alphaMask: VIS_CONFIG.alphaMask
    }
);