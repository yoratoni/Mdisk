/**
 * General configuration.
 */
export const GENERAL_CONFIG = {
    verbose: true,                                  // Set the winston logger to verbose mode
    dateFormat: "YYYY-MM-DD HH:mm:ss",              // Date format for the winston logger
    bigFile: {
        extractedFilesDirName: "ExtractedFiles",    // Dir where the extracted files will be placed
        buildFileDirName: "build",                  // Dir where the build file will be placed
    }
};

/**
 * Visualizer configuration.
 */
export const VIS_CONFIG = {
    outputDirPath: "C:/Users/terci/Desktop",        // Output dir path
    bytesPerRow: 2048,                              // Number of bytes per row
    numberOfBytesToRead: 0,                         // Number of bytes to read (0 = all)
    chunkSize: 8,                                   // Number of bytes per chunk
    backgroundColor: [0x7F, 0x00, 0x00],            // Background color
    alphaMask: 0xFF,                                // Alpha mask
};

/**
 * Visualizer gradients.
 * Colors: array with dark to light colors,
 * - [R, G, B] for each color.
 */
export const VIS_GRADIENTS = {
    purple: [
        [0x1F, 0x01, 0x3A],
        [0x36, 0x01, 0x67],
        [0x6B, 0x07, 0x72],
        [0xAF, 0x12, 0x81],
        [0xCF, 0x26, 0x8A],
        [0xE6, 0x5C, 0x9C],
        [0xFB, 0x8C, 0xAB]
    ]
};