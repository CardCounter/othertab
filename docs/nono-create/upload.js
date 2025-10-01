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

  function setUploadStatus(statusElement, message, state) {
    if (!statusElement) {
      return;
    }
    statusElement.textContent = message;
    statusElement.classList.remove("processing", "success", "error");
    if (state) {
      statusElement.classList.add(state);
    }
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

  document.addEventListener("nono-create-board-ready", (event) => {
    if (event.detail) {
      window.NonoCreateBoard = event.detail;
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("image-upload-input");
    const uploadButton = document.getElementById("image-upload-button");
    const statusElement = document.getElementById("image-upload-status");

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
        setUploadStatus(statusElement, "please select an image file", "error");
        fileInput.value = "";
        return;
      }

      const boardInterface = window.NonoCreateBoard;
      if (!boardInterface || typeof boardInterface.getSize !== "function" || typeof boardInterface.applyBinaryGrid !== "function") {
        setUploadStatus(statusElement, "board not ready", "error");
        fileInput.value = "";
        return;
      }

      const targetSize = Number(boardInterface.getSize());
      if (!Number.isFinite(targetSize) || targetSize <= 0) {
        setUploadStatus(statusElement, "board size unavailable", "error");
        fileInput.value = "";
        return;
      }

      setUploadStatus(statusElement, "processing image…", "processing");
      try {
        const binaryGrid = await convertFileToBinaryGrid(file, targetSize);
        boardInterface.applyBinaryGrid(binaryGrid);
        setUploadStatus(statusElement, `loaded ${file.name}`, "success");
      } catch (error) {
        console.error("Unable to process image", error);
        setUploadStatus(statusElement, "unable to load image", "error");
      } finally {
        fileInput.value = "";
      }
    });
  });
})();
