(function () {
  "use strict";

  const difficultyMap = {
    easy: { rows: 9, cols: 9 },
    medium: { rows: 16, cols: 16 },
    hard: { rows: 16, cols: 30 }
  };
  const modeToPrefix = {
    easy: "e",
    medium: "m",
    hard: "h"
  };
  const prefixToMode = {
    e: "easy",
    m: "medium",
    h: "hard",
    E: "easy",
    M: "medium",
    H: "hard"
  };
  const modeMaskSeeds = {
    easy: 137,
    medium: 211,
    hard: 59
  };
  const CURRENT_VERSION = 1;
  const MAX_DIMENSION = 64;
  const MAX_MINES = 1023;
  const modeToId = {
    easy: 0,
    medium: 1,
    hard: 2
  };
  const idToMode = Object.fromEntries(
    Object.entries(modeToId).map(([mode, id]) => [id, mode])
  );
  const baseAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const baseIndexMap = Object.fromEntries(
    baseAlphabet.split("").map((char, idx) => [char, idx])
  );
  const binomialCache = new Map();

  function getSettingsForMode(mode) {
    const settings = difficultyMap[mode];
    if (!settings) {
      throw new Error("unsupported mines mode");
    }
    return settings;
  }

  function bytesToBits(bytes) {
    let bits = "";
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      for (let bitPos = 7; bitPos >= 0; bitPos--) {
        bits += ((b >> bitPos) & 1) ? "1" : "0";
      }
    }
    return bits;
  }

  function deriveModeMask(length, seed) {
    const mask = new Uint8Array(length);
    let state = seed & 0xFF;
    for (let i = 0; i < length; i++) {
      state = (state * 73 + 41) & 0xFF;
      mask[i] = state;
    }
    return mask;
  }

  function applyModeMask(bytes, mode, encode) {
    const seed = modeMaskSeeds[mode];
    if (typeof seed !== "number") {
      throw new Error("unsupported mines mode");
    }
    const mask = deriveModeMask(bytes.length, seed);
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

  function base64UrlToBytes(base64) {
    const b64 = base64.replace(/-/g, "+").replace(/!/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
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
        throw new Error("invalid seed encoding");
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

  function getBitWidth(value) {
    if (value <= 1) {
      return 1;
    }
    return Math.ceil(Math.log2(value));
  }

  function isWithinSafeZone(row, col, startRow, startCol) {
    return (
      Math.abs(row - startRow) <= 1 &&
      Math.abs(col - startCol) <= 1
    );
  }

  function buildEligibleInfo(rows, cols, startRow, startCol) {
    const eligiblePositions = [];
    const indexMap = new Array(rows * cols).fill(-1);
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isWithinSafeZone(r, c, startRow, startCol)) {
          continue;
        }
        const linear = r * cols + c;
        indexMap[linear] = idx;
        eligiblePositions.push(linear);
        idx++;
      }
    }
    return { eligiblePositions, indexMap };
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

  function encodeMetadata({ modeId, rows, cols, mineCount, startRow, startCol }) {
    if (rows < 1 || rows > MAX_DIMENSION || cols < 1 || cols > MAX_DIMENSION) {
      throw new Error("unsupported board dimensions");
    }
    if (mineCount < 0 || mineCount > MAX_MINES) {
      throw new Error("unsupported mine count");
    }
    const writer = new BitWriter();
    writer.writeBits(CURRENT_VERSION, 3);
    writer.writeBits(modeId, 2);
    writer.writeBits(rows - 1, 6);
    writer.writeBits(cols - 1, 6);
    writer.writeBits(mineCount, 10);
    const rowBits = getBitWidth(rows);
    const colBits = getBitWidth(cols);
    writer.writeBits(startRow, rowBits);
    writer.writeBits(startCol, colBits);
    return writer.toBytes();
  }

  function decodeMetadata(bytes) {
    const reader = new BitReader(bytes);
    const version = reader.readBits(3);
    if (version !== CURRENT_VERSION) {
      throw new Error("unsupported seed version");
    }
    const modeId = reader.readBits(2);
    const rows = reader.readBits(6) + 1;
    const cols = reader.readBits(6) + 1;
    const mineCount = reader.readBits(10);
    const rowBits = getBitWidth(rows);
    const colBits = getBitWidth(cols);
    const startRow = reader.readBits(rowBits);
    const startCol = reader.readBits(colBits);
    reader.alignToByte();
    return {
      metadata: { modeId, rows, cols, mineCount, startRow, startCol },
      headerEndOffset: reader.byteIndex
    };
  }

  function buildLayoutFromMines(rows, cols, startRow, startCol, mineIndices, eligiblePositions) {
    const layout = [];
    for (let r = 0; r < rows; r++) {
      const row = new Array(cols).fill(false);
      layout.push(row);
    }
    for (let i = 0; i < eligiblePositions.length; i++) {
      const linear = eligiblePositions[i];
      const r = Math.floor(linear / cols);
      const c = linear % cols;
      layout[r][c] = false;
    }
    for (let i = 0; i < mineIndices.length; i++) {
      const idx = mineIndices[i];
      if (idx < 0 || idx >= eligiblePositions.length) {
        throw new Error("invalid mine index");
      }
      const linear = eligiblePositions[idx];
      const r = Math.floor(linear / cols);
      const c = linear % cols;
      layout[r][c] = true;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isWithinSafeZone(r, c, startRow, startCol)) {
          layout[r][c] = false;
        }
      }
    }
    return layout;
  }

  function getModeId(mode) {
    const modeIdValue = modeToId[mode];
    if (typeof modeIdValue !== "number") {
      throw new Error("unsupported mines mode");
    }
    return modeIdValue;
  }

  function bitsToLayout(bits, rows, cols) {
    const layout = [];
    let index = 0;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(bits[index] === "1");
        index++;
      }
      layout.push(row);
    }
    return layout;
  }

  function createSeed({ mode, grid, rows, cols, startRow, startCol }) {
    const { rows: expectedRows, cols: expectedCols } = getSettingsForMode(mode);
    if (rows !== expectedRows || cols !== expectedCols) {
      throw new Error("grid size does not match mode");
    }
    if (startCol < 0 || startCol >= cols || startRow < 0 || startRow >= rows) {
      throw new Error("start location outside grid");
    }
    const prefix = modeToPrefix[mode];
    if (!prefix) {
      throw new Error("unsupported mines mode");
    }
    const modeId = getModeId(mode);
    const { eligiblePositions, indexMap } = buildEligibleInfo(rows, cols, startRow, startCol);
    const mineIndices = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const isMine = typeof cell === "boolean" ? cell : !!cell.isMine;
        if (!isMine) {
          continue;
        }
        const linear = r * cols + c;
        const eligibleIndex = indexMap[linear];
        if (eligibleIndex === -1) {
          throw new Error("mine present inside safe zone");
        }
        mineIndices.push(eligibleIndex);
      }
    }
    mineIndices.sort((a, b) => a - b);
    const mineCount = mineIndices.length;
    if (mineCount > eligiblePositions.length) {
      throw new Error("invalid mine configuration");
    }
    const rank = encodeCombination(mineIndices);
    const metadataBytes = encodeMetadata({
      modeId,
      rows,
      cols,
      mineCount,
      startRow,
      startCol
    });
    const combinationBytes = bigIntToBytes(rank);
    if (combinationBytes.length > 255) {
      throw new Error("seed payload too large");
    }
    const payload = new Uint8Array(metadataBytes.length + 1 + combinationBytes.length);
    payload.set(metadataBytes, 0);
    payload[metadataBytes.length] = combinationBytes.length;
    payload.set(combinationBytes, metadataBytes.length + 1);
    const maskedBytes = applyModeMask(payload, mode, true);
    const encoded = bytesToUrlSafeBase(maskedBytes);
    return `${prefix}${encoded}`;
  }

  function parseLegacySeed(mode, encoded) {
    const { rows, cols } = getSettingsForMode(mode);
    const totalBits = rows * cols + 10;
    const bytes = base64UrlToBytes(encoded);
    const unmaskedBytes = applyModeMask(bytes, mode, false);
    const allBits = bytesToBits(unmaskedBytes);
    if (allBits.length < totalBits) {
      throw new Error("seed layout too short");
    }
    const relevantBits = allBits.slice(0, totalBits);
    const layoutBits = relevantBits.slice(0, rows * cols);
    const colBits = relevantBits.slice(rows * cols, rows * cols + 5);
    const rowBits = relevantBits.slice(rows * cols + 5, rows * cols + 10);
    const layout = bitsToLayout(layoutBits, rows, cols);
    const startCol = parseInt(colBits || "0", 2);
    const startRow = parseInt(rowBits || "0", 2);
    if (!Number.isInteger(startCol) || !Number.isInteger(startRow)) {
      throw new Error("invalid start location");
    }
    if (startCol < 0 || startCol >= cols || startRow < 0 || startRow >= rows) {
      throw new Error("start location outside grid");
    }
    return { mode, rows, cols, layout, startCol, startRow };
  }

  function isModernSeedCandidate(encoded) {
    for (let i = 0; i < encoded.length; i++) {
      if (typeof baseIndexMap[encoded[i]] !== "number") {
        return false;
      }
    }
    return true;
  }

  function parseModernSeed(mode, encoded) {
    const maskedBytes = urlSafeBaseToBytes(encoded);
    if (!maskedBytes.length) {
      throw new Error("invalid seed");
    }
    const unmaskedBytes = applyModeMask(maskedBytes, mode, false);
    const { metadata, headerEndOffset } = decodeMetadata(unmaskedBytes);
    const derivedMode = idToMode[metadata.modeId];
    if (!derivedMode || derivedMode !== mode) {
      throw new Error("invalid seed mode");
    }
    const { rows, cols, mineCount, startRow, startCol } = metadata;
    if (startCol < 0 || startCol >= cols || startRow < 0 || startRow >= rows) {
      throw new Error("start location outside grid");
    }
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
    const { eligiblePositions } = buildEligibleInfo(rows, cols, startRow, startCol);
    if (mineCount > eligiblePositions.length) {
      throw new Error("invalid mine configuration");
    }
    const mineIndices = decodeCombination(rank, mineCount, eligiblePositions.length);
    if (mineIndices.length !== mineCount) {
      throw new Error("invalid mine data");
    }
    const layout = buildLayoutFromMines(rows, cols, startRow, startCol, mineIndices, eligiblePositions);
    return { mode, rows, cols, layout, startCol, startRow };
  }

  function parseSeed(seedString) {
    if (typeof seedString !== "string" || seedString.length < 2) {
      throw new Error("invalid seed");
    }
    const prefix = seedString.charAt(0);
    const mode = prefixToMode[prefix];
    if (!mode) {
      throw new Error("invalid seed");
    }
    const encoded = seedString.slice(1);
    if (!encoded) {
      throw new Error("invalid seed");
    }
    let result;
    if (isModernSeedCandidate(encoded)) {
      try {
        result = parseModernSeed(mode, encoded);
      } catch (modernErr) {
        result = parseLegacySeed(mode, encoded);
      }
    } else {
      result = parseLegacySeed(mode, encoded);
    }
    return { ...result, seed: seedString };
  }

  window.MinesSeed = {
    createSeed,
    parseSeed,
    getSettingsForMode
  };
})();
