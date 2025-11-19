import { buildNonoShareLink } from "../scripts/nono-share-link.js";

(function () {
  "use strict";

  function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(0));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const boardElement = document.getElementById("creator-board");
    const settingsButton = document.getElementById("settings-button");
    const settingsPanel = document.getElementById("settings-panel");
    const sizeButtons = Array.from(document.querySelectorAll(".difficulty-button"));
    const seedButton = document.getElementById("seed-button");
    const clearButton = document.getElementById("clear-button");
    const invertButton = document.getElementById("invert-button");

    if (!boardElement || !settingsButton || !settingsPanel) {
      return;
    }

    const storedSizeId = localStorage.getItem("NONO_CREATE-currentSize");
    const initialButton = storedSizeId ? document.getElementById(storedSizeId) : document.getElementById("create-size-15");
    let size = Number(initialButton?.dataset.size ?? 15);
    if (!Number.isFinite(size) || size <= 0) {
      size = 15;
    }

    let board = createEmptyBoard(size);
    let cellRefs = [];
    let hoverCell = null;
    let pointerPainting = false;
    let pointerButtonDown = false;
    let keyPainting = false;
    let paintValue = 1;
    let paintPrimed = false;
    let activePaintMode = null;

    function setSizeVariable(value) {
      document.documentElement.style.setProperty("--creator-size", String(value));
    }

    setSizeVariable(size);

    function buildBoard() {
      boardElement.innerHTML = "";
      cellRefs = Array.from({ length: size }, () => new Array(size));
      hoverCell = null;
      pointerPainting = false;
      pointerButtonDown = false;
      keyPainting = false;
      paintPrimed = false;
      activePaintMode = null;

      for (let r = 0; r < size; r++) {
        const rowEl = document.createElement("tr");
        for (let c = 0; c < size; c++) {
          const cell = document.createElement("td");
          cell.className = "creator-cell";
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
          rowEl.appendChild(cell);
          cellRefs[r][c] = cell;
        }
        boardElement.appendChild(rowEl);
      }

      updateBoardUI();
    }

    function updateBoardUI() {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = cellRefs[r]?.[c];
          if (!cell) continue;
          if (board[r][c]) {
            cell.classList.add("filled");
          } else {
            cell.classList.remove("filled");
          }
        }
      }
    }

    function setCell(row, col, value) {
      row = clamp(row, 0, size - 1);
      col = clamp(col, 0, size - 1);
      if (board[row][col] === value) return;
      board[row][col] = value;
      const cell = cellRefs[row]?.[col];
      if (cell) {
        if (value) {
          cell.classList.add("filled");
        } else {
          cell.classList.remove("filled");
        }
      }
    }

    function clearBoard() {
      board = createEmptyBoard(size);
      updateBoardUI();
    }

    function invertBoard() {
      stopAllPainting();
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          board[r][c] = board[r][c] ? 0 : 1;
        }
      }
      updateBoardUI();
    }

    function isPrimaryInput(event) {
      if (!event) {
        return false;
      }
      if (typeof event.buttons === "number") {
        return (event.buttons & 1) === 1;
      }
      if (typeof event.button === "number") {
        return event.button === 0;
      }
      if (typeof event.which === "number") {
        return event.which === 1;
      }
      return true;
    }

    function startPointerPaint(row, col) {
      if (activePaintMode && activePaintMode !== "pointer") {
        return;
      }
      activePaintMode = "pointer";
      keyPainting = false;
      paintPrimed = false;
      pointerPainting = true;
      paintValue = board[row][col] ? 0 : 1;
      setCell(row, col, paintValue);
    }

    function stopPointerPainting() {
      pointerPainting = false;
      if (!pointerButtonDown && activePaintMode === "pointer") {
        activePaintMode = null;
      }
    }

    function startKeyPaint(row, col) {
      if (activePaintMode && activePaintMode !== "key") {
        return;
      }
      activePaintMode = "key";
      pointerPainting = false;
      pointerButtonDown = false;
      keyPainting = true;
      paintPrimed = false;
      paintValue = board[row][col] ? 0 : 1;
      setCell(row, col, paintValue);
    }

    function stopKeyPainting() {
      keyPainting = false;
      paintPrimed = false;
      if (activePaintMode === "key") {
        activePaintMode = null;
      }
    }

    function stopAllPainting() {
      stopPointerPainting();
      pointerButtonDown = false;
      stopKeyPainting();
      activePaintMode = null;
    }

    function handlePointerDown(event) {
      const target = event.target.closest(".creator-cell");
      if (!target) return;
      event.preventDefault();
      const row = Number(target.dataset.row);
      const col = Number(target.dataset.col);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return;
      if (!isPrimaryInput(event)) {
        return;
      }
      pointerButtonDown = true;
      if (keyPainting || activePaintMode === "key") {
        return;
      }
      startPointerPaint(row, col);
    }

    function handlePointerEnter(event) {
      const target = event.target.closest(".creator-cell");
      if (!target) return;
      const row = Number(target.dataset.row);
      const col = Number(target.dataset.col);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return;
      hoverCell = { row, col };
      if (keyPainting) {
        if (paintPrimed) {
          startKeyPaint(row, col);
        } else {
          setCell(row, col, paintValue);
        }
        pointerButtonDown = false;
        return;
      }

      const primaryDown = isPrimaryInput(event) || pointerButtonDown;
      if (primaryDown) {
        pointerButtonDown = true;
        if (!pointerPainting) {
          startPointerPaint(row, col);
          return;
        }
      }

      if (pointerPainting) {
        setCell(row, col, paintValue);
      }
    }

    function handlePointerLeave() {
      hoverCell = null;
    }

    boardElement.addEventListener("mousedown", handlePointerDown);
    boardElement.addEventListener("touchstart", (event) => {
      if (event.touches?.length) {
        const touch = event.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && boardElement.contains(element)) {
          handlePointerDown({
            target: element,
            preventDefault: () => event.preventDefault(),
            buttons: 1,
            button: 0,
          });
        }
      }
    }, { passive: false });

    boardElement.addEventListener("mouseover", handlePointerEnter);
    boardElement.addEventListener("mousemove", handlePointerEnter);
    boardElement.addEventListener("touchmove", (event) => {
      if (!event.touches?.length) return;
      const touch = event.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element && boardElement.contains(element)) {
        handlePointerEnter({ target: element, buttons: pointerButtonDown ? 1 : 0 });
      }
      event.preventDefault();
    }, { passive: false });
    boardElement.addEventListener("mouseleave", handlePointerLeave);
    boardElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    document.addEventListener("mousedown", (event) => {
      if (isPrimaryInput(event)) {
        pointerButtonDown = true;
      }
    });

    function handleGlobalPointerUp() {
      pointerButtonDown = false;
      stopPointerPainting();
      paintPrimed = false;
    }

    document.addEventListener("mouseup", handleGlobalPointerUp);
    document.addEventListener("touchend", handleGlobalPointerUp);
    document.addEventListener("touchcancel", handleGlobalPointerUp);

    document.addEventListener("keydown", (event) => {
      if (event.key && event.key.toLowerCase() === "w") {
        event.preventDefault();
        if (pointerPainting || pointerButtonDown || activePaintMode === "pointer") {
          return;
        }
        if (!keyPainting) {
          if (hoverCell) {
            const { row, col } = hoverCell;
            startKeyPaint(row, col);
          } else {
            paintPrimed = true;
            stopPointerPainting();
            pointerButtonDown = false;
            keyPainting = true;
            activePaintMode = "key";
          }
        }
      }
      if (event.key === "Enter") {
        event.preventDefault();
        clearBoard();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.key && event.key.toLowerCase() === "w") {
        stopKeyPainting();
      }
    });

    function hideSettingsPanel() {
      settingsPanel.classList.add("hidden");
      settingsPanel.setAttribute("aria-hidden", "true");
      settingsButton.setAttribute("aria-expanded", "false");
    }

    function showSettingsPanel() {
      settingsPanel.classList.remove("hidden");
      settingsPanel.setAttribute("aria-hidden", "false");
      settingsButton.setAttribute("aria-expanded", "true");
    }

    settingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (settingsPanel.classList.contains("hidden")) {
        showSettingsPanel();
      } else {
        hideSettingsPanel();
      }
    });

    settingsPanel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
      if (!settingsPanel.contains(event.target) && event.target !== settingsButton) {
        hideSettingsPanel();
      }
    });

    document.addEventListener("contextmenu", (event) => {
      if (!settingsPanel.contains(event.target) && event.target !== settingsButton) {
        hideSettingsPanel();
      }
    });

    sizeButtons.forEach((button) => {
      const buttonSize = Number(button.dataset.size);
      if (buttonSize === size) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => {
        sizeButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        hideSettingsPanel();
        const newSize = Number(button.dataset.size);
        if (!Number.isFinite(newSize) || newSize <= 0) return;
        size = newSize;
        localStorage.setItem("NONO_CREATE-currentSize", button.id);
        setSizeVariable(size);
        board = createEmptyBoard(size);
        buildBoard();
      });
    });

    if (initialButton) {
      sizeButtons.forEach((btn) => {
        if (btn !== initialButton) {
          btn.classList.remove("active");
        }
      });
      initialButton.classList.add("active");
    }

    buildBoard();

    if (clearButton) {
      clearButton.addEventListener("click", clearBoard);
    }

    if (invertButton) {
      invertButton.addEventListener("click", invertBoard);
    }

    if (seedButton) {
      seedButton.addEventListener("click", async () => {
        if (!window.Seed || typeof window.Seed.createSeedFromLayout !== "function") {
          return;
        }
        try {
          const seed = window.Seed.createSeedFromLayout(board, size);
          const shareLink = buildNonoShareLink(seed);
          const copyValue = shareLink || seed;
          if (!copyValue) {
            throw new Error("Unable to build seed");
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(copyValue);
            seedButton.textContent = "copied";
            setTimeout(() => {
              seedButton.textContent = "seed";
            }, 1200);
          } else {
            window.prompt("Seed URL", copyValue);
          }
        } catch (error) {
          console.error("Unable to copy seed", error);
          seedButton.textContent = "error";
          setTimeout(() => {
            seedButton.textContent = "seed";
          }, 1500);
        }
      });
    }

    const uploadBridge = Object.freeze({
      getSize: () => size,
      applyBinaryGrid(binaryGrid) {
        if (!Array.isArray(binaryGrid)) {
          return;
        }
        const sanitized = createEmptyBoard(size);
        for (let r = 0; r < size; r++) {
          const sourceRow = binaryGrid[r];
          if (!Array.isArray(sourceRow)) {
            continue;
          }
          for (let c = 0; c < size; c++) {
            sanitized[r][c] = sourceRow[c] ? 1 : 0;
          }
        }
        board = sanitized;
        hoverCell = null;
        stopAllPainting();
        updateBoardUI();
      },
    });

    // Freeze the bridge on window to guard against accidental tampering.
    try {
      Object.defineProperty(window, "NonoCreateBoard", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: uploadBridge,
      });
    } catch (error) {
      if (window.NonoCreateBoard !== uploadBridge) {
        console.warn("NonoCreateBoard already defined; existing reference retained.");
      }
    }
    document.dispatchEvent(new CustomEvent("nono-create-board-ready", { detail: uploadBridge }));

  });
})();
