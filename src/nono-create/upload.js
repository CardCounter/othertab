(function () {
  "use strict";

  async function loadImageResource(file) {
    if (!file) {
      throw new Error("No file provided");
    }
    if (typeof window.createImageBitmap === "function") {
      return await window.createImageBitmap(file);
    }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to load image"));
      };
      image.src = url;
    });
  }

  function runTwoMeans(values, maxIterations = 12) {
    if (!Array.isArray(values) || values.length === 0) {
      return { centers: [0, 255], assignments: [] };
    }
    let min = values[0];
    let max = values[0];
    for (const value of values) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const centers = [min, max];
    const assignments = new Array(values.length).fill(0);
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let changed = false;
      const sums = [0, 0];
      const counts = [0, 0];
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        const distanceToFirst = Math.abs(value - centers[0]);
        const distanceToSecond = Math.abs(value - centers[1]);
        const bestIndex = distanceToFirst <= distanceToSecond ? 0 : 1;
        if (assignments[i] !== bestIndex) {
          assignments[i] = bestIndex;
          changed = true;
        }
        sums[bestIndex] += value;
        counts[bestIndex] += 1;
      }
      for (let cluster = 0; cluster < 2; cluster++) {
        if (counts[cluster] > 0) {
          const newCenter = sums[cluster] / counts[cluster];
          if (newCenter !== centers[cluster]) {
            centers[cluster] = newCenter;
            changed = true;
          }
        }
      }
      if (!changed) {
        break;
      }
    }
    return { centers, assignments };
  }

  function createBinaryGridFromImageData(imageData) {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    const grayscaleValues = new Array(totalPixels);
    for (let index = 0; index < totalPixels; index++) {
      const offset = index * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const grayscale = 0.299 * red + 0.587 * green + 0.114 * blue;
      grayscaleValues[index] = grayscale;
    }
    const { centers, assignments } = runTwoMeans(grayscaleValues, 12);
    const difference = Math.abs(centers[0] - centers[1]);
    const darkCluster = centers[0] <= centers[1] ? 0 : 1;
    const grid = [];
    for (let row = 0; row < height; row++) {
      const gridRow = new Array(width);
      for (let column = 0; column < width; column++) {
        const pixelIndex = row * width + column;
        if (difference < 1) {
          gridRow[column] = 0;
        } else {
          gridRow[column] = assignments[pixelIndex] === darkCluster ? 1 : 0;
        }
      }
      grid[row] = gridRow;
    }
    return grid;
  }

  async function convertFileToBinaryGrid(file, targetSize) {
    const resource = await loadImageResource(file);
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Unable to create canvas context");
    }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, targetSize, targetSize);
    context.drawImage(resource, 0, 0, targetSize, targetSize);
    if (typeof resource.close === "function") {
      resource.close();
    }
    const imageData = context.getImageData(0, 0, targetSize, targetSize);
    return createBinaryGridFromImageData(imageData);
  }

  let boardInterface = null;

  function adoptBoardInterface(candidate) {
    if (!candidate || candidate !== window.NonoCreateBoard) {
      return;
    }
    if (typeof candidate.getSize !== "function" || typeof candidate.applyBinaryGrid !== "function") {
      return;
    }
    boardInterface = candidate;
  }

  document.addEventListener("nono-create-board-ready", (event) => {
    adoptBoardInterface(event.detail);
  });

  document.addEventListener("DOMContentLoaded", () => {
    adoptBoardInterface(window.NonoCreateBoard);
    const fileInput = document.getElementById("image-upload-input");
    const uploadButton = document.getElementById("image-upload-button");

    if (!fileInput || !uploadButton) {
      return;
    }

    uploadButton.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        return;
      }

      if (file.type && !file.type.startsWith("image/")) {
        console.warn("nono-create: rejected non-image upload", file.type);
        fileInput.value = "";
        return;
      }

      adoptBoardInterface(window.NonoCreateBoard);
      const activeBoard = boardInterface;
      if (!activeBoard || typeof activeBoard.getSize !== "function" || typeof activeBoard.applyBinaryGrid !== "function") {
        console.warn("nono-create: upload attempted before board ready");
        fileInput.value = "";
        return;
      }

      const targetSize = Number(activeBoard.getSize());
      if (!Number.isFinite(targetSize) || targetSize <= 0) {
        console.warn("nono-create: invalid board size", targetSize);
        fileInput.value = "";
        return;
      }

      try {
        const binaryGrid = await convertFileToBinaryGrid(file, targetSize);
        activeBoard.applyBinaryGrid(binaryGrid);
      } catch (error) {
        console.error("Unable to process image", error);
      } finally {
        fileInput.value = "";
      }
    });
  });
})();
