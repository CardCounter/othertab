(function () {
  "use strict";

  /**
   * Seed helper utilities for NONO (base64-only)
   * Format: XX + BASE64URL(bits)
   * - XX: two-letter size code (ca, tz, de, kr, al, sg)
   * - bits: board flattened row-major, packed MSB-first into bytes
   */

  // Size code mapping
  const sizeCodeMap = {
    ca: 30,
    tz: 25,
    de: 20,
    kr: 15,
    al: 10,
    sg: 5
  };
  const codeFromSize = Object.fromEntries(Object.entries(sizeCodeMap).map(([k,v]) => [v, k]));

  const sizeCodeMaskBase = {
    ca: "111110100110101100001110111011111010001010011101011110111110101100111000101001101101001011010011110100010000101111001110100010100000010110111110101010101011011111100111101001111001100101001000000111000111001011100110000111011011000000000111011010000011010010001111011000001001000110000100010011110000000100000101110100011010011101000110000101110010011101111010101100011010000000010010000100001011000101110000110001001111001000000010001000000111111100101101000111010001001101100101011011000111110011110101001011101101010011100000110101001101100110000000000011011001001110010101010110101010100110011110101000101100100100110100001011111110110111011001011100110001110101101111111100010111001001011111100000001101100110001111100110100101011100100001001100001001010010010110100100111101010111010010011101011101100100011110010101001001010111010001110111011110101000010001010100110101011100001111100111111111101101010100", // 912 bits
    tz: "1111011111101111110100011011001011110010001100100111101010010000010000111100010101110101011111101011101011100000111000100000011010110111110101110011101100110000011101100101101001011010101100011011011010001001001110101111011100110111010001000111010101101001001101100101101000110000100000100111000001000111110000010010011000011101110111110111011101001101010110000000100001010110000100011111110110010001111110100110011010000100000011111000001011110010100000010111100100101101010011010110001110111010101000011111010001010000111000010101101011101111001001100001110111010100001100100001101000111111011111011010001010101111001110101010110110111111", // 640 bits
    de: "010000111110110111100011110110000010110010101101111101101011110001100010001000000110011111100000000100010100011110101110000110100101100111010011101001101110100000001000000111100101000110001101100100000001001011110111101010010010001001011101100101000101001010010111011000000000000100011000110100000000001011011100100001110011000101100001111001011110110000100101010101000101110100000001000101010100100101001010", // 408 bits
    kr: "011000010000100101010011011011011110100111100100010001011111100110000001011111111101110101001111110100010001101000011101100110000010001101010010011100101000101110101100011000000000000000110010101011111101010000111010001101011000001111001001", // 240 bits
    al: "1111110011010011001111111000111111010111111100100000001001000001011000001000101110100001011101011010001001100101", // 112 bits
    sg: "0010110011001110001010100000011110100100" // 40 bits
  };

  const sizeTailSignatures = {
    ca: "10111011",
    tz: "10011101",
    de: "01111001",
    kr: "01010111",
    al: "00111001",
    sg: "00000111"
  };

  const sizeCodeBitMasks = Object.fromEntries(Object.entries(sizeCodeMaskBase).map(([code, pattern]) => {
    const size = sizeCodeMap[code];
    if (!size) throw new Error("Mask base defined without matching size code: " + code);
    const baseBits = size * size;
    const padLen = (8 - (baseBits % 8)) % 8;
    const signature = sizeTailSignatures[code] ?? "";
    const totalBits = baseBits + padLen + signature.length;
    const repeats = Math.ceil(totalBits / pattern.length);
    const mask = pattern.repeat(repeats).slice(0, totalBits);
    return [code, mask];
  }));

  const sizeCodeMaskBytes = Object.fromEntries(Object.entries(sizeCodeBitMasks).map(([code, maskBits]) => {
    return [code, bitsToBytes(maskBits)];
  }));

  function applySizeMaskToBytes(bytes, sizeCode, encode) {
    const mask = sizeCodeMaskBytes[sizeCode];
    if (!mask) throw new Error("Unsupported board size for seed masking: " + sizeCode);
    if (mask.length !== bytes.length) {
      throw new Error("Mask length mismatch for size '" + sizeCode + "'");
    }
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      const maskByte = mask[i];
      if (encode) {
        result[i] = (byte + maskByte) & 0xFF;
      } else {
        result[i] = (byte - maskByte + 256) & 0xFF;
      }
    }
    return result;
  }

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

  // Base64url helpers
  function bytesToBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "!").replace(/=+$/g, "");
    return b64;
  }

  function base64UrlToBytes(b64url) {
    const b64 = b64url.replace(/-/g, "+").replace(/!/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bitsToBytes(binStr) {
    const totalBits = binStr.length;
    const byteLen = Math.ceil(totalBits / 8);
    const bytes = new Uint8Array(byteLen);
    for (let i = 0; i < totalBits; i++) {
      const bit = binStr.charCodeAt(i) === 49 ? 1 : 0; // '1'
      const byteIndex = Math.floor(i / 8);
      const bitPos = 7 - (i % 8); // MSB-first
      if (bit) bytes[byteIndex] |= (1 << bitPos);
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

  // Create base64 seed: "SSb<base64url>"
  function createSeedFromLayout(layout, size) {
    const layoutArray = normalizeLayoutToArray(layout);
    if (!Array.isArray(layoutArray) || layoutArray.length === 0) {
      throw new Error("Invalid layout: expected a non-empty 2D array or math.js matrix");
    }
    let bits = flattenToBinaryString(layoutArray);
    const sizeCode = encodeSizePrefix(size);
    const baseLen = bits.length;
    const padLen = (8 - (baseLen % 8)) % 8;
    if (padLen > 0) {
      const mask = sizeCodeBitMasks[sizeCode];
      if (!mask) throw new Error("Unsupported board size for seed padding: " + sizeCode);
      let padBits = "";
      for (let i = 0; i < padLen; i++) {
        const maskBit = mask.charAt((baseLen + i) % mask.length);
        padBits += maskBit === "1" ? "0" : "1";
      }
      bits += padBits;
    }
    const signature = sizeTailSignatures[sizeCode] ?? "";
    if (signature.length) bits += signature;
    const maskBits = sizeCodeBitMasks[sizeCode];
    if (!maskBits) throw new Error("Unsupported board size for seed masking: " + sizeCode);
    if (maskBits.length !== bits.length) {
      throw new Error("Mask length mismatch for size '" + sizeCode + "'");
    }
    const bytes = bitsToBytes(bits);
    const maskedBytes = applySizeMaskToBytes(bytes, sizeCode, true);
    const b64url = bytesToBase64Url(maskedBytes);
    return sizeCode + b64url;
  }

  // Parse base64 seed only
  function parseSeed(seedString) {
    if (typeof seedString !== "string" || seedString.length < 2) {
      throw new Error("Invalid seed: expected '<XX><base64url>'");
    }
    const sizePrefix = seedString.slice(0, 2);
    const size = decodeSizePrefix(sizePrefix);
    const b64url = seedString.slice(2);
    const maskedBytes = base64UrlToBytes(b64url);
    const bytes = applySizeMaskToBytes(maskedBytes, sizePrefix, false);
    const allBits = bytesToBits(bytes);
    const totalBits = size * size;
    let bin = allBits.slice(0, totalBits);
    if (bin.length < totalBits) bin = bin.padStart(totalBits, "0");
    const layoutArray = rebuildLayoutFromBinary(bin, size);
    return { size, layoutArray };
  }

  window.Seed = {
    createSeedFromLayout,
    parseSeed,
    // Expose for potential testing
    _flattenToBinaryString: flattenToBinaryString,
    _rebuildLayoutFromBinary: rebuildLayoutFromBinary
  };
})(); 
