(function () {
  "use strict";

  /**
   * Seed helper utilities for NONO
   * Encoding scheme:
   * - Flatten board (row-major) to a binary string of length size*size
   * - Convert binary to a BigInt decimal string
   * - Prefix two-digit size code to avoid leading zero ambiguity
   *   - For single-digit size 5, use 50 (not 05)
   *   - For >=10, use the two-digit value (10, 15, 20, 25, 30)
   * The final seed is a decimal string: SS + D, where SS are two digits and D is the decimal value of the board bits
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
    // Accept math.js matrix or plain arrays
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
        const v = layoutArray[r][c];
        bits += v ? "1" : "0";
      }
    }
    return bits;
  }

  function binaryStringToDecimalString(binStr) {
    if (binStr.length === 0) return "0";
    const asBigInt = BigInt("0b" + binStr);
    return asBigInt.toString(10);
  }

  function decimalStringToBinaryString(decStr) {
    if (!decStr || decStr === "0") return "";
    const asBigInt = BigInt(decStr);
    return asBigInt.toString(2);
  }

  function padBinaryLeft(binStr, targetLength) {
    if (binStr.length >= targetLength) {
      // If longer than expected, keep the least significant bits
      return binStr.slice(-targetLength);
    }
    return binStr.padStart(targetLength, "0");
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

  /**
   * Create a decimal seed string from a layout and size.
   * Returns a string like: "10<decimal>" or "50<decimal>" for size 5.
   */
  function createSeedFromLayout(layout, size) {
    const layoutArray = normalizeLayoutToArray(layout);
    if (!Array.isArray(layoutArray) || layoutArray.length === 0) {
      throw new Error("Invalid layout: expected a non-empty 2D array or math.js matrix");
    }
    const bits = flattenToBinaryString(layoutArray);
    const decimal = binaryStringToDecimalString(bits);
    const prefix = encodeSizePrefix(size);
    return prefix + decimal;
  }

  /**
   * Parse a decimal seed string back into a { size, layoutArray } object.
   * layoutArray is a 2D array of 0/1 values (row-major).
   */
  function parseSeed(seedString) {
    if (typeof seedString !== "string" || seedString.length < 2) {
      throw new Error("Invalid seed: expected at least two characters for size prefix");
    }
    const sizePrefix = seedString.slice(0, 2);
    const size = decodeSizePrefix(sizePrefix);
    const decimalPart = seedString.slice(2) || "0";

    const totalBits = size * size;
    const bin = decimalStringToBinaryString(decimalPart);
    const padded = padBinaryLeft(bin, totalBits);

    const layoutArray = rebuildLayoutFromBinary(padded, size);
    return { size, layoutArray };
  }

  // Expose as global helper
  window.Seed = {
    createSeedFromLayout,
    parseSeed,
    // Extra utils if needed elsewhere
    _encodeSizePrefix: encodeSizePrefix,
    _decodeSizePrefix: decodeSizePrefix,
    _flattenToBinaryString: flattenToBinaryString,
    _rebuildLayoutFromBinary: rebuildLayoutFromBinary
  };
})(); 