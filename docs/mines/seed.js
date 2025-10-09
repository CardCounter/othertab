(function () {
  "use strict";

  const difficultyMap = {
    easy: { rows: 9, cols: 9 },
    medium: { rows: 16, cols: 16 },
    hard: { rows: 16, cols: 30 }
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

  function bitsToBase64(bits) {
    const padLength = (8 - (bits.length % 8)) % 8;
    if (padLength) {
      bits = bits + "0".repeat(padLength);
    }
    let binary = "";
    for (let i = 0; i < bits.length; i += 8) {
      const chunk = bits.slice(i, i + 8);
      const charCode = parseInt(chunk, 2);
      binary += String.fromCharCode(charCode);
    }
    return btoa(binary).replace(/=+$/g, "");
  }

  function base64ToBits(base64) {
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    let bits = "";
    for (let i = 0; i < binary.length; i++) {
      const charCode = binary.charCodeAt(i);
      bits += charCode.toString(2).padStart(8, "0");
    }
    return bits;
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
    const bits = flattenLayout(grid, rows, cols);
    const encoded = bitsToBase64(bits);
    return `${mode}-${encoded}-${startCol}-${startRow}`;
  }

  function parseSeed(seedString) {
    if (typeof seedString !== "string" || !seedString.includes("-")) {
      throw new Error("invalid seed");
    }
    const parts = seedString.split("-");
    if (parts.length !== 4) {
      throw new Error("invalid seed");
    }
    const [mode, encoded, startX, startY] = parts;
    const { rows, cols } = getSettingsForMode(mode);
    const bits = base64ToBits(encoded).slice(0, rows * cols);
    if (bits.length < rows * cols) {
      throw new Error("seed layout too short");
    }
    const layout = bitsToLayout(bits, rows, cols);
    const startCol = Number.parseInt(startX, 10);
    const startRow = Number.parseInt(startY, 10);
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
