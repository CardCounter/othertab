(function () {
  "use strict";

  /**
   * Seed helper utilities for NONO (base64-only)
   * Format: SS + 'b' + BASE64URL(bits)
   * - SS: two-digit size prefix (5 uses 50)
   * - bits: board flattened row-major, packed MSB-first into bytes
   */

  function encodeSizePrefix(boardSize) {
    if (boardSize < 10) return String(boardSize * 10).padStart(2, "0");
    return String(boardSize).padStart(2, "0");
  }

  function decodeSizePrefix(prefix) {
    const code = Number(prefix);
    if (Number.isNaN(code)) throw new Error("Invalid seed: size prefix is not a number");
    return code === 50 ? 5 : code;
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
    const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    return b64;
  }

  function base64UrlToBytes(b64url) {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
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
    const bits = flattenToBinaryString(layoutArray);
    const bytes = bitsToBytes(bits);
    const b64url = bytesToBase64Url(bytes);
    return encodeSizePrefix(size) + "b" + b64url;
  }

  // Parse base64 seed only
  function parseSeed(seedString) {
    if (typeof seedString !== "string" || seedString.length < 3) {
      throw new Error("Invalid seed: expected 'SSb<base64url>'");
    }
    const sizePrefix = seedString.slice(0, 2);
    const size = decodeSizePrefix(sizePrefix);
    const rest = seedString.slice(2);
    if (!rest.startsWith("b")) {
      throw new Error("Invalid seed: only base64 format supported (SSb<base64url>)");
    }
    const b64url = rest.slice(1);
    const bytes = base64UrlToBytes(b64url);
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