import {
    convertStringToUint8Array,
    convertUint8ArrayToHexString,
    convertUint8ArrayToString
} from "helpers/bytes";


export function Audio() {
    // const test = new Uint8Array([
    //     0x0E,
    //     0xE8,
    //     0x0F,
    //     0x70
    // ]);

    const test2 = convertStringToUint8Array("RIFF");

    console.log(
        "RIFF:",
        convertUint8ArrayToHexString(test2),
        test2
    );
}