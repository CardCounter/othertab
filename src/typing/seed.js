const baseAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const baseIndexMap = Object.fromEntries(baseAlphabet.split("").map((char, idx) => [char, idx]));

const WORD_LIST_KEY_TO_ID = {
  none: 0
};

const WORD_LIST_ID_TO_KEY = Object.fromEntries(
  Object.entries(WORD_LIST_KEY_TO_ID).map(([key, id]) => [id, key])
);

const TYPING_SEED_VERSION = 1;
const MAX_WORD_COUNT = 2047;
const WORD_COUNT_BIT_WIDTH = 11;
const WORD_LIST_ID_BIT_WIDTH = 5;

function getBitWidth(value) {
  if (value <= 1) {
    return 1;
  }
  return Math.ceil(Math.log2(value));
}

class BitWriter {
  constructor() {
    this.bytes = [];
    this.length = 0;
  }

  writeBits(value, count) {
    if (!count) {
      return;
    }
    for (let i = count - 1; i >= 0; i--) {
      const bit = (value >> i) & 1;
      const byteIndex = Math.floor(this.length / 8);
      const bitPos = 7 - (this.length % 8);
      if (typeof this.bytes[byteIndex] !== "number") {
        this.bytes[byteIndex] = 0;
      }
      this.bytes[byteIndex] |= bit << bitPos;
      this.length++;
    }
  }

  alignToByte() {
    const remainder = this.length & 7;
    if (remainder) {
      this.writeBits(0, 8 - remainder);
    }
  }

  toBytes() {
    if (!this.bytes.length) {
      return new Uint8Array([0]);
    }
    return new Uint8Array(this.bytes);
  }
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.bitIndex = 0;
  }

  readBits(count) {
    if (!count) {
      return 0;
    }
    let value = 0;
    for (let i = 0; i < count; i++) {
      if (this.bitIndex >= this.bytes.length * 8) {
        throw new Error("unexpected end of typing seed data");
      }
      const byte = this.bytes[this.bitIndex >> 3];
      const bitPos = 7 - (this.bitIndex & 7);
      const bit = (byte >> bitPos) & 1;
      value = (value << 1) | bit;
      this.bitIndex++;
    }
    return value;
  }

  alignToByte() {
    const remainder = this.bitIndex & 7;
    if (remainder) {
      this.bitIndex += 8 - remainder;
    }
  }

  get byteIndex() {
    return this.bitIndex >> 3;
  }
}

function bytesToUrlSafeBase(bytes) {
  if (!bytes.length) {
    return "";
  }
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;
    const remaining = bytes.length - i;
    output += baseAlphabet[(chunk >> 18) & 0x3F];
    output += baseAlphabet[(chunk >> 12) & 0x3F];
    if (remaining > 1) {
      output += baseAlphabet[(chunk >> 6) & 0x3F];
    }
    if (remaining > 2) {
      output += baseAlphabet[chunk & 0x3F];
    }
  }
  return output;
}

function urlSafeBaseToBytes(str) {
  if (typeof str !== "string" || !str) {
    return new Uint8Array(0);
  }
  const output = [];
  let buffer = 0;
  let bitsInBuffer = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    const value = baseIndexMap[char];
    if (typeof value !== "number") {
      throw new Error("invalid typing seed encoding");
    }
    buffer = (buffer << 6) | value;
    bitsInBuffer += 6;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      const byte = (buffer >> bitsInBuffer) & 0xFF;
      output.push(byte);
      buffer &= (1 << bitsInBuffer) - 1;
    }
  }
  return new Uint8Array(output);
}

function encodeMetadata({ wordListId, wordCount }) {
  if (wordCount < 1 || wordCount > MAX_WORD_COUNT) {
    throw new Error("typing seed word count out of range");
  }
  const writer = new BitWriter();
  writer.writeBits(TYPING_SEED_VERSION, 3);
  writer.writeBits(wordListId, WORD_LIST_ID_BIT_WIDTH);
  writer.writeBits(wordCount, WORD_COUNT_BIT_WIDTH);
  writer.alignToByte();
  return writer.toBytes();
}

function decodeMetadata(bytes) {
  const reader = new BitReader(bytes);
  const version = reader.readBits(3);
  if (version !== TYPING_SEED_VERSION) {
    throw new Error("unsupported typing seed version");
  }
  const wordListId = reader.readBits(WORD_LIST_ID_BIT_WIDTH);
  const wordCount = reader.readBits(WORD_COUNT_BIT_WIDTH);
  reader.alignToByte();
  return {
    metadata: { wordListId, wordCount },
    headerEndOffset: reader.byteIndex
  };
}

function assertVocabSize(vocabSize) {
  if (!Number.isInteger(vocabSize) || vocabSize <= 0 || vocabSize > 65535) {
    throw new Error("invalid typing vocab size");
  }
}

function getWordListId(key) {
  const id = WORD_LIST_KEY_TO_ID[key];
  if (typeof id !== "number") {
    throw new Error("unknown typing word list key");
  }
  return id;
}

function getWordListKey(id) {
  return WORD_LIST_ID_TO_KEY[id] || null;
}

function createSeed({ wordIndices, wordListKey = "none", vocabSize }) {
  if (!Array.isArray(wordIndices) || !wordIndices.length) {
    throw new Error("cannot create typing seed without word indices");
  }
  assertVocabSize(vocabSize);
  const wordListId = getWordListId(wordListKey);
  const bitsPerWord = getBitWidth(vocabSize);
  const writer = new BitWriter();
  for (let i = 0; i < wordIndices.length; i++) {
    const idx = wordIndices[i];
    if (!Number.isInteger(idx) || idx < 0 || idx >= vocabSize) {
      throw new Error("typing seed word index out of range");
    }
    writer.writeBits(idx, bitsPerWord);
  }
  const payloadBytes = writer.toBytes();
  const metadataBytes = encodeMetadata({
    wordListId,
    wordCount: wordIndices.length
  });
  const combined = new Uint8Array(metadataBytes.length + payloadBytes.length);
  combined.set(metadataBytes, 0);
  combined.set(payloadBytes, metadataBytes.length);
  return `t${bytesToUrlSafeBase(combined)}`;
}

function parseSeed(seedString, { vocabSize }) {
  if (typeof seedString !== "string" || seedString.length < 2) {
    throw new Error("invalid typing seed");
  }
  assertVocabSize(vocabSize);
  const prefix = seedString.charAt(0);
  if (prefix !== "t") {
    throw new Error("invalid typing seed prefix");
  }
  const encodedPayload = seedString.slice(1);
  if (!encodedPayload) {
    throw new Error("missing typing seed payload");
  }
  const bytes = urlSafeBaseToBytes(encodedPayload);
  if (!bytes.length) {
    throw new Error("invalid typing seed payload");
  }
  const { metadata, headerEndOffset } = decodeMetadata(bytes);
  const wordListKey = getWordListKey(metadata.wordListId);
  if (!wordListKey) {
    throw new Error("unknown typing seed word list");
  }
  if (metadata.wordCount < 1 || metadata.wordCount > MAX_WORD_COUNT) {
    throw new Error("typing seed word count invalid");
  }
  const bitsPerWord = getBitWidth(vocabSize);
  const indexBytes = bytes.slice(headerEndOffset);
  const reader = new BitReader(indexBytes);
  const wordIndices = [];
  for (let i = 0; i < metadata.wordCount; i++) {
    const idx = reader.readBits(bitsPerWord);
    if (idx >= vocabSize) {
      throw new Error("typing seed index exceeds vocab");
    }
    wordIndices.push(idx);
  }
  return {
    seed: seedString,
    wordIndices,
    wordCount: metadata.wordCount,
    wordListKey
  };
}

export const TypingSeed = {
  createSeed,
  parseSeed
};
