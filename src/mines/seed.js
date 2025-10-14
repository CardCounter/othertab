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
  const prefixToMode = Object.fromEntries(
    Object.entries(modeToPrefix).map(([mode, prefix]) => [prefix, mode])
  );
  const modeMaskSeeds = {
    easy: 137,
    medium: 211,
    hard: 59
  };

  function getSettingsForMode(mode) {
    const settings = difficultyMap[mode];
    if (!settings) {
      throw new Error("unsupported mines mode");
    }
    return settings;
  }

  function flattenLayout(grid, rows, cols) {
    let bits = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const isMine = typeof cell === "boolean" ? cell : !!cell.isMine;
        bits += isMine ? "1" : "0";
      }
    }
    return bits;
  }

  function bitsToBytes(binStr) {
    const totalBits = binStr.length;
    const byteLen = Math.ceil(totalBits / 8);
    const bytes = new Uint8Array(byteLen);
    for (let i = 0; i < totalBits; i++) {
      if (binStr.charCodeAt(i) !== 49) continue; // '1'
      const byteIndex = Math.floor(i / 8);
      const bitPos = 7 - (i % 8); // msb-first
      bytes[byteIndex] |= (1 << bitPos);
    }
    return bytes;
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

  function bytesToBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "!").replace(/=+$/g, "");
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

    const layoutBits = flattenLayout(grid, rows, cols);
    const colBits = Number(startCol).toString(2).padStart(5, "0");
    const rowBits = Number(startRow).toString(2).padStart(5, "0");

    let combinedBits = layoutBits + colBits + rowBits;
    const padLen = (8 - (combinedBits.length % 8)) % 8;
    if (padLen) {
      combinedBits += "0".repeat(padLen);
    }

    const bytes = bitsToBytes(combinedBits);
    const maskedBytes = applyModeMask(bytes, mode, true);
    const encoded = bytesToBase64Url(maskedBytes);
    return `${prefix}${encoded}`;
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
    return { mode, rows, cols, layout, startCol, startRow, seed: seedString };
  }

  window.MinesSeed = {
    createSeed,
    parseSeed,
    getSettingsForMode
  };
})();
