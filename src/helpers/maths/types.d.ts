declare namespace NsAlgorithms {
    /**
     * Frequency table for Huffman coding.
     */
    type huffmanFrequencyTable = {
        [key: string | number]: number;
    };

    /**
     * Table of Huffman codes.
     */
    type huffmanTable = {
        [key: string | number]: string;
    };
}


export default NsAlgorithms;