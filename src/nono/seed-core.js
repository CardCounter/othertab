(function () {
  "use strict";

  const sizeCodeMap = {
    ca: 30,
    tz: 25,
    de: 20,
    kr: 15,
    al: 10,
    sg: 5
  };
  const codeFromSize = Object.fromEntries(Object.entries(sizeCodeMap).map(([code, size]) => [size, code]));

  const CURRENT_VERSION = 1;
  const MAX_SIZE = 64;
  const sizeMaskSeeds = {
    ca: 173,
    tz: 89,
    de: 241,
    kr: 37,
    al: 199,
    sg: 113
  };

  const baseAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const baseIndexMap = Object.fromEntries(
    baseAlphabet.split("").map((char, idx) => [char, idx])
  );
  const binomialCache = new Map();

  function encodeSizePrefix(boardSize) {
    const code = codeFromSize[boardSize];
    if (!code) throw new Error("Unsupported board size for seed encoding: " + boardSize);
    return code;
  }

  function decodeSizePrefix(prefix) {
    const size = sizeCodeMap[prefix];
    if (!size) throw new Error("Invalid seed: unknown size prefix '" + prefix + "'");
    return size;
  }

  function normalizeLayoutToArray(layout) {
    if (layout && typeof layout.toArray === "function") {
      return layout.toArray();
    }
    return layout;
  }

  function flattenToBinaryString(layoutArray) {
    const rows = layoutArray.length;
    const cols = layoutArray[0]?.length ?? 0;
    let bits = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bits += layoutArray[r][c] ? "1" : "0";
      }
    }
    return bits;
  }

  function rebuildLayoutFromBinary(binStr, size) {
    const result = new Array(size);
    let i = 0;
    for (let r = 0; r < size; r++) {
      const row = new Array(size);
      for (let c = 0; c < size; c++) {
        row[c] = binStr[i++] === "1" ? 1 : 0;
      }
      result[r] = row;
    }
    return result;
  }

  function ensureSquareLayout(layoutArray, expectedSize) {
    if (!Array.isArray(layoutArray) || layoutArray.length !== expectedSize) {
      throw new Error("Invalid layout: expected an array with length " + expectedSize);
    }
    for (let r = 0; r < expectedSize; r++) {
      const row = layoutArray[r];
      if (!Array.isArray(row) || row.length !== expectedSize) {
        throw new Error("Invalid layout row at index " + r);
      }
    }
  }

  function collectFilledIndices(layoutArray, size) {
    ensureSquareLayout(layoutArray, size);
    const filled = [];
    for (let r = 0; r < size; r++) {
      const row = layoutArray[r];
      for (let c = 0; c < size; c++) {
        if (!!row[c]) {
          filled.push(r * size + c);
        }
      }
    }
    return filled;
  }

  function buildLayoutFromFilledIndices(size, filledIndices) {
    const layout = new Array(size);
    for (let r = 0; r < size; r++) {
      const row = new Array(size).fill(0);
      layout[r] = row;
    }
    for (let i = 0; i < filledIndices.length; i++) {
      const idx = filledIndices[i];
      if (idx < 0 || idx >= size * size) {
        throw new Error("Invalid cell index in seed");
      }
      const r = Math.floor(idx / size);
      const c = idx % size;
      layout[r][c] = 1;
    }
    return layout;
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
        throw new Error("Invalid seed encoding");
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
          throw new Error("unexpected end of seed metadata");
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

  function getBitWidth(value) {
    if (value <= 1) {
      return 1;
    }
    return Math.ceil(Math.log2(value));
  }

  function binomial(n, k) {
    if (k < 0 || k > n) {
      return 0n;
    }
    if (k === 0 || k === n) {
      return 1n;
    }
    const key = (n << 11) + k;
    if (binomialCache.has(key)) {
      return binomialCache.get(key);
    }
    const kk = Math.min(k, n - k);
    let result = 1n;
    for (let i = 1; i <= kk; i++) {
      result = (result * BigInt(n - kk + i)) / BigInt(i);
    }
    binomialCache.set(key, result);
    return result;
  }

  function encodeCombination(indices) {
    if (!indices.length) {
      return 0n;
    }
    let rank = 0n;
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      rank += binomial(idx, i + 1);
    }
    return rank;
  }

  function decodeCombination(rank, picks, totalPositions) {
    if (!picks) {
      return [];
    }
    let remainingRank = rank;
    let cursor = totalPositions - 1;
    const result = [];
    for (let i = picks; i >= 1; i--) {
      while (cursor >= i - 1) {
        const combos = binomial(cursor, i);
        if (combos <= remainingRank) {
          result.push(cursor);
          remainingRank -= combos;
          cursor--;
          break;
        }
        cursor--;
      }
    }
    return result.reverse();
  }

  function bigIntToBytes(value) {
    if (value === 0n) {
      return new Uint8Array([0]);
    }
    const bytes = [];
    let temp = value;
    while (temp > 0n) {
      bytes.push(Number(temp & 0xFFn));
      temp >>= 8n;
    }
    return new Uint8Array(bytes.reverse());
  }

  function bytesToBigInt(bytes) {
    let value = 0n;
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8n) | BigInt(bytes[i]);
    }
    return value;
  }

  function deriveSizeMask(length, seed) {
    const mask = new Uint8Array(length);
    let state = seed & 0xFF;
    for (let i = 0; i < length; i++) {
      state = (state * 73 + 41) & 0xFF;
      mask[i] = state;
    }
    return mask;
  }

  function applyModernSizeMask(bytes, sizeCode, encode) {
    const seed = sizeMaskSeeds[sizeCode];
    if (typeof seed !== "number") {
      throw new Error("Unsupported board size for seed masking: " + sizeCode);
    }
    const mask = deriveSizeMask(bytes.length, seed);
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      const maskByte = mask[i];
      result[i] = encode
        ? (byte + maskByte) & 0xFF
        : (byte - maskByte + 256) & 0xFF;
    }
    return result;
  }

  function encodeMetadata({ size, filledCount }) {
    if (size < 1 || size > MAX_SIZE) {
      throw new Error("unsupported board size");
    }
    const totalCells = size * size;
    if (filledCount < 0 || filledCount > totalCells) {
      throw new Error("invalid filled cell count");
    }
    const writer = new BitWriter();
    writer.writeBits(CURRENT_VERSION, 3);
    writer.writeBits(size - 1, 6);
    const countBits = getBitWidth(totalCells + 1);
    writer.writeBits(filledCount, countBits);
    return writer.toBytes();
  }

  function decodeMetadata(bytes) {
    const reader = new BitReader(bytes);
    const version = reader.readBits(3);
    if (version !== CURRENT_VERSION) {
      throw new Error("unsupported seed version");
    }
    const size = reader.readBits(6) + 1;
    if (size < 1 || size > MAX_SIZE) {
      throw new Error("unsupported board size");
    }
    const totalCells = size * size;
    const countBits = getBitWidth(totalCells + 1);
    const filledCount = reader.readBits(countBits);
    reader.alignToByte();
    return {
      metadata: { size, filledCount },
      headerEndOffset: reader.byteIndex
    };
  }

  function createSeedFromLayout(layout, size) {
    const layoutArray = normalizeLayoutToArray(layout);
    if (!Array.isArray(layoutArray) || !layoutArray.length) {
      throw new Error("Invalid layout: expected a non-empty 2D array or math.js matrix");
    }
    ensureSquareLayout(layoutArray, size);
    const sizeCode = encodeSizePrefix(size);
    const filledIndices = collectFilledIndices(layoutArray, size);
    const filledCount = filledIndices.length;
    const totalCells = size * size;
    if (filledCount > totalCells) {
      throw new Error("Invalid layout data");
    }
    const rank = encodeCombination(filledIndices);
    const metadataBytes = encodeMetadata({ size, filledCount });
    const combinationBytes = bigIntToBytes(rank);
    if (combinationBytes.length > 255) {
      throw new Error("seed payload too large");
    }
    const payload = new Uint8Array(metadataBytes.length + 1 + combinationBytes.length);
    payload.set(metadataBytes, 0);
    payload[metadataBytes.length] = combinationBytes.length;
    payload.set(combinationBytes, metadataBytes.length + 1);
    const maskedBytes = applyModernSizeMask(payload, sizeCode, true);
    const encoded = bytesToUrlSafeBase(maskedBytes);
    return sizeCode + encoded;
  }

  function parseModernSeed(sizePrefix, encoded) {
    const maskedBytes = urlSafeBaseToBytes(encoded);
    if (!maskedBytes.length) {
      throw new Error("Invalid seed");
    }
    const unmaskedBytes = applyModernSizeMask(maskedBytes, sizePrefix, false);
    const { metadata, headerEndOffset } = decodeMetadata(unmaskedBytes);
    const expectedSize = decodeSizePrefix(sizePrefix);
    if (metadata.size !== expectedSize) {
      throw new Error("Seed size mismatch");
    }
    const { size, filledCount } = metadata;
    const combinationLengthOffset = headerEndOffset;
    if (combinationLengthOffset >= unmaskedBytes.length) {
      throw new Error("invalid seed payload");
    }
    const combinationLength = unmaskedBytes[combinationLengthOffset];
    const start = combinationLengthOffset + 1;
    const end = start + combinationLength;
    if (combinationLength === 0 || end > unmaskedBytes.length) {
      throw new Error("invalid seed payload");
    }
    const combinationBytes = unmaskedBytes.slice(start, end);
    const rank = bytesToBigInt(combinationBytes);
    const totalCells = size * size;
    if (filledCount > totalCells) {
      throw new Error("invalid layout data");
    }
    const filledIndices = decodeCombination(rank, filledCount, totalCells);
    if (filledIndices.length !== filledCount) {
      throw new Error("invalid seed data");
    }
    const layoutArray = buildLayoutFromFilledIndices(size, filledIndices);
    return { size, layoutArray };
  }

  function parseSeed(seedString) {
    if (typeof seedString !== "string" || seedString.length < 2) {
      throw new Error("Invalid seed: expected '<XX><encoded>'");
    }
    const sizePrefix = seedString.slice(0, 2);
    decodeSizePrefix(sizePrefix);
    const encodedPayload = seedString.slice(2);
    if (!encodedPayload) {
      throw new Error("Invalid seed: missing payload");
    }
    return parseModernSeed(sizePrefix, encodedPayload);
  }

  window.Seed = {
    createSeedFromLayout,
    parseSeed,
    _flattenToBinaryString: flattenToBinaryString,
    _rebuildLayoutFromBinary: rebuildLayoutFromBinary
  };
})();
