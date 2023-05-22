import NsAlgorithms from "../types";


/**
 * Node of a Huffman Tree.
 */
class HuffmanNode {
    private _key: string | number | null;
    private _value: number;
    private _left: HuffmanNode | null;
    private _right: HuffmanNode | null;

    constructor(
        key: string | null,
        value: number,
        left: HuffmanNode | null = null,
        right: HuffmanNode | null = null
    ) {
        this._key = key;
        this._value = value;
        this._left = left;
        this._right = right;
    }

    /**
     * Get the value of the node.
     */
    get key(): string | number | null {
        return this._key;
    }

    /**
     * Set the value of the node.
     */
    set value(value: number) {
        this._value = value;
    }

    /**
     * Get the value of the node.
     */
    get value(): number {
        return this._value;
    }

    /**
     * Get the left child of the node.
     */
    get left(): HuffmanNode | null {
        return this._left;
    }

    /**
     * Get the right child of the node.
     */
    get right(): HuffmanNode | null {
        return this._right;
    }

    /**
     * Get the children of the node (left and right).
     */
    get children(): (HuffmanNode | null)[] {
        return [this._left, this._right];
    }
}

/**
 * Get the frequency table of each character in a string.
 * @param str String to analyze.
 * @returns Table with the frequency of each character.
 */
export function getStrFrequencyTable(str: string): NsAlgorithms.huffmanFrequencyTable {
    const frequencyTable: NsAlgorithms.huffmanFrequencyTable = {};

    for (const char of str) {
        frequencyTable[char] ? frequencyTable[char]++ : (frequencyTable[char] = 1);
    }

    return frequencyTable;
}

/**
 * Get the frequency table of each byte in an Uint8Array.
 * @param bytes Bytes to analyze.
 * @returns Table with the frequency of each byte.
 */
export function getByteFrequencyTable(bytes: Uint8Array): NsAlgorithms.huffmanFrequencyTable {
    const frequencyTable: NsAlgorithms.huffmanFrequencyTable = {};

    for (const byte of bytes) {
        frequencyTable[byte] ? frequencyTable[byte]++ : (frequencyTable[byte] = 1);
    }

    return frequencyTable;
}

/**
 * Make a Huffman Tree from a frequency table.
 * @param frequencyTable Frequency table to use.
 * @returns The root Huffman node.
 */
export function makeHuffmanTree(
    frequencyTable: NsAlgorithms.huffmanFrequencyTable
): HuffmanNode {
    const nodes: HuffmanNode[] = [];

    for (const symbol in frequencyTable) {
        nodes.push(new HuffmanNode(symbol, frequencyTable[symbol]));
    }

    while (nodes.length > 1) {
        nodes.sort((a, b) => {
            return a.value - b.value;
        });

        const left = nodes.shift();
        const right = nodes.shift();

        if (left && right) {
            const sum = left.value + right.value;
            const newNode = new HuffmanNode(null, sum, left, right);

            nodes.push(newNode);
        }
    }

    return nodes[0];
}

/**
 * Huffman algorithm.
 * @param data String or Uint8Array (bytes) to encode.
 * @returns The encoded data in binary.
 * @link https://compression.fiches-horaires.net/la-compression-sans-perte
 */
export function generateHuffmanCoding(data: string | Uint8Array): string {
    let frequencyTable: NsAlgorithms.huffmanFrequencyTable;

    // Get the frequency table (string or bytes)
    if (typeof data === "string") {
        frequencyTable = getStrFrequencyTable(data);
    } else {
        frequencyTable = getByteFrequencyTable(data);
    }

    // Make the Huffman Tree
    const huffmanTree = makeHuffmanTree(frequencyTable);

    // Make the Huffman Table
    const huffmanTable: NsAlgorithms.huffmanTable = {};

    /**
     * Traverse the Huffman Tree and make the Huffman Table.
     * @param node The current node.
     * @param code The current code.
     * @returns The Huffman Table.
     */
    function traverse(node: HuffmanNode, code: string) {
        if (node.key) {
            huffmanTable[node.key] = code;
        } else {
            // Traverse left child and append "0" to the code
            traverse(
                node.left ? node.left : new HuffmanNode(null, 0),
                code + "0"
            );

            // Traverse right child and append "1" to the code
            traverse(
                node.right ? node.right : new HuffmanNode(null, 0),
                code + "1"
            );
        }
    }

    // Start the traversal
    traverse(huffmanTree, "");

    // Get the binary string
    let binary = "";

    for (const singleValue of data) {
        if (singleValue in huffmanTable) {
            binary += huffmanTable[singleValue];
        } else {
            binary += "0";
        }
    }

    return binary;
}