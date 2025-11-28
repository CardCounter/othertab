const puzzle = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

const boardState = puzzle.map((row) => row.slice());
const boardElement = document.getElementById('sudoku-board');
const cells = new Map();
const highlightClasses = ['active-cell', 'peer-cell', 'match-cell'];
const CONFLICT_CLASS = 'conflict-cell';
const DEFAULT_CELL_SIZE = 70; //px
const MAX_UNDO_STACK_SIZE = 100;
let activeCellKey = null;
let pendingClearCellKey = null;
let armedClearCellKey = null;
let initialCandidatesPenciled = false;
const undoStack = [];

const keyFromCoords = (row, col) => `${row}-${col}`;

const dispatchReady = () => {
    document.dispatchEvent(new Event('fouc:ready'));
};

const isInteractiveElementForUndo = (target) => {
    if (!target || typeof target.closest !== 'function') {
        return false;
    }

    if (target.closest('button, input, select, textarea')) {
        return true;
    }

    const editableAncestor = target.closest('[contenteditable="true"]');
    return Boolean(editableAncestor);
};

const clearActiveCell = () => {
    activeCellKey = null;
    pendingClearCellKey = null;
    armedClearCellKey = null;
    cells.forEach((cell) => {
        highlightClasses.forEach((cls) => cell.element.classList.remove(cls));
    });
};

const setBoardCellSize = (sizePx) => {
    if (!boardElement) {
        return;
    }

    boardElement.style.setProperty('--sudoku-cell-size', `${sizePx}px`);
};

const setActiveCell = (cellKey) => {
    clearActiveCell();
    if (!cellKey) {
        return;
    }

    const cell = cells.get(cellKey);
    if (!cell) {
        return;
    }

    activeCellKey = cellKey;
    const currentValue = boardState[cell.row][cell.col];
    const highlightValue = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : null;

    cell.element.classList.add('active-cell');
    if (highlightValue) {
        cell.element.classList.add('match-cell');
    }

    cells.forEach((other, otherKey) => {
        if (otherKey === cellKey) {
            return;
        }

        const sameRow = other.row === cell.row;
        const sameCol = other.col === cell.col;
        const sameBox = Math.floor(other.row / 3) === Math.floor(cell.row / 3) &&
            Math.floor(other.col / 3) === Math.floor(cell.col / 3);

        if (sameRow || sameCol || sameBox) {
            other.element.classList.add('peer-cell');
        }

        if (highlightValue && boardState[other.row][other.col] === highlightValue) {
            other.element.classList.add('match-cell');
        }
    });
};

const handleCellPointerDown = (cellKey) => {
    const wasAlreadyActive = activeCellKey === cellKey || armedClearCellKey === cellKey;
    setActiveCell(cellKey);
    if (wasAlreadyActive) {
        pendingClearCellKey = cellKey;
    } else {
        pendingClearCellKey = null;
    }
    armedClearCellKey = null;
};

if (boardElement) {
    document.addEventListener('pointerdown', (event) => {
        if (!boardElement.contains(event.target)) {
            clearActiveCell();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' && event.key !== ' ') {
            return;
        }

        if (isInteractiveElementForUndo(event.target)) {
            return;
        }

        event.preventDefault();
        undoLastAction();
    });
}

const computeCandidates = (row, col) => {
    if (boardState[row][col] !== 0) {
        return [];
    }

    const used = new Set();

    for (let i = 0; i < 9; i += 1) {
        used.add(boardState[row][i]);
        used.add(boardState[i][col]);
    }

    const boxRowStart = Math.floor(row / 3) * 3;
    const boxColStart = Math.floor(col / 3) * 3;
    for (let r = boxRowStart; r < boxRowStart + 3; r += 1) {
        for (let c = boxColStart; c < boxColStart + 3; c += 1) {
            used.add(boardState[r][c]);
        }
    }

    const candidates = [];
    for (let num = 1; num <= 9; num += 1) {
        if (!used.has(num)) {
            candidates.push(num);
        }
    }
    return candidates;
};

const findConflictCellKeys = () => {
    const conflictKeys = new Set();
    for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
            const value = boardState[row][col];
            if (!Number.isFinite(value) || value <= 0) {
                continue;
            }

            for (let i = 0; i < 9; i += 1) {
                if (i !== col && boardState[row][i] === value) {
                    conflictKeys.add(keyFromCoords(row, col));
                    conflictKeys.add(keyFromCoords(row, i));
                }
                if (i !== row && boardState[i][col] === value) {
                    conflictKeys.add(keyFromCoords(row, col));
                    conflictKeys.add(keyFromCoords(i, col));
                }
            }

            const boxRowStart = Math.floor(row / 3) * 3;
            const boxColStart = Math.floor(col / 3) * 3;
            for (let r = boxRowStart; r < boxRowStart + 3; r += 1) {
                for (let c = boxColStart; c < boxColStart + 3; c += 1) {
                    if ((r !== row || c !== col) && boardState[r][c] === value) {
                        conflictKeys.add(keyFromCoords(row, col));
                        conflictKeys.add(keyFromCoords(r, c));
                    }
                }
            }
        }
    }
    return conflictKeys;
};

const refreshConflicts = () => {
    const conflictKeys = findConflictCellKeys();
    cells.forEach((cell, cellKey) => {
        if (conflictKeys.has(cellKey)) {
            cell.element.classList.add(CONFLICT_CLASS);
        } else {
            cell.element.classList.remove(CONFLICT_CLASS);
        }
    });
};

const refreshCellCandidates = (cell) => {
    if (!cell || cell.isGiven || cell.filled) {
        return;
    }

    const available = new Set(computeCandidates(cell.row, cell.col));
    cell.candidateButtons.forEach((button, number) => {
        button.disabled = false;
        if (available.has(number)) {
            button.classList.add('available');
        } else {
            button.classList.remove('available');
        }
    });
};

const refreshAllCandidates = () => {
    cells.forEach((cell) => {
        if (!cell.isGiven && !cell.filled) {
            refreshCellCandidates(cell);
        }
    });
};

const createActionContext = () => ({
    cellSnapshots: new Map()
});

const captureCellSnapshot = (cellKey, context) => {
    if (!context || context.cellSnapshots.has(cellKey)) {
        return;
    }

    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven) {
        return;
    }

    const penciledNumbers = [];
    cell.candidateButtons.forEach((button, number) => {
        if (button.classList.contains('penciled')) {
            penciledNumbers.push(number);
        }
    });

    context.cellSnapshots.set(cellKey, {
        value: boardState[cell.row][cell.col],
        filled: cell.filled,
        penciledNumbers
    });
};

const restoreCellSnapshot = (cellKey, snapshot) => {
    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven) {
        return;
    }

    const penciledSet = new Set(snapshot.penciledNumbers);
    boardState[cell.row][cell.col] = snapshot.value;
    cell.filled = snapshot.filled;
    if (snapshot.filled && snapshot.value > 0) {
        cell.valueEl.textContent = snapshot.value;
        cell.element.classList.add('filled', 'player-value');
    } else {
        cell.valueEl.textContent = '';
        cell.element.classList.remove('filled', 'player-value');
    }

    cell.candidateButtons.forEach((button, number) => {
        button.disabled = snapshot.filled;
        button.classList.remove('penciled');
        if (!snapshot.filled && penciledSet.has(number)) {
            button.classList.add('penciled');
        }
    });
};

const pushUndoAction = (context) => {
    if (!context || context.cellSnapshots.size === 0) {
        return;
    }

    undoStack.push(context);
    if (undoStack.length > MAX_UNDO_STACK_SIZE) {
        undoStack.shift();
    }
};

const undoLastAction = () => {
    if (undoStack.length === 0) {
        return;
    }

    const action = undoStack.pop();
    action.cellSnapshots.forEach((snapshot, cellKey) => {
        restoreCellSnapshot(cellKey, snapshot);
    });
    refreshAllCandidates();
    refreshConflicts();
    clearActiveCell();
    armedClearCellKey = null;
};

const clearPeerCandidatePencils = (row, col, value, actionContext = null) => {
    if (!Number.isFinite(value) || value <= 0) {
        return new Set();
    }

    const originKey = keyFromCoords(row, col);
    const impactedCellKeys = new Set();
    const processed = new Set();
    const maybeClear = (targetRow, targetCol) => {
        const key = keyFromCoords(targetRow, targetCol);
        if (key === originKey || processed.has(key)) {
            return;
        }

        processed.add(key);
        const cell = cells.get(key);
        if (!cell || cell.isGiven || cell.filled) {
            return;
        }

        captureCellSnapshot(key, actionContext);
        const button = cell.candidateButtons.get(value);
        if (button) {
            const wasPenciled = button.classList.contains('penciled');
            button.classList.remove('penciled');
            if (wasPenciled) {
                impactedCellKeys.add(key);
            }
        }
    };

    for (let c = 0; c < 9; c += 1) {
        maybeClear(row, c);
    }

    for (let r = 0; r < 9; r += 1) {
        maybeClear(r, col);
    }

    const boxRowStart = Math.floor(row / 3) * 3;
    const boxColStart = Math.floor(col / 3) * 3;
    for (let r = boxRowStart; r < boxRowStart + 3; r += 1) {
        for (let c = boxColStart; c < boxColStart + 3; c += 1) {
            maybeClear(r, c);
        }
    }

    return impactedCellKeys;
};

const findSinglePenciledCandidateValue = (cell) => {
    if (!cell) {
        return null;
    }

    let candidateValue = null;
    for (const [number, button] of cell.candidateButtons.entries()) {
        if (!button.classList.contains('penciled')) {
            continue;
        }

        if (candidateValue !== null) {
            return null;
        }
        candidateValue = number;
    }

    return candidateValue;
};

const cascadeFillSingleCandidateCells = (initialCellKeys = [], actionContext = null) => {
    const queue = Array.from(initialCellKeys);
    const queued = new Set(queue);

    while (queue.length > 0) {
        const cellKey = queue.shift();
        if (!cellKey) {
            continue;
        }

        queued.delete(cellKey);
        const cell = cells.get(cellKey);
        if (!cell || cell.isGiven || cell.filled) {
            continue;
        }

        const forcedValue = findSinglePenciledCandidateValue(cell);
        if (!Number.isFinite(forcedValue)) {
            continue;
        }

        const impactedCells = setCellValue(
            cellKey,
            forcedValue,
            { triggerCascade: false, focusCell: false, actionContext }
        );
        impactedCells.forEach((impactedKey) => {
            if (!queued.has(impactedKey)) {
                queue.push(impactedKey);
                queued.add(impactedKey);
            }
        });
    }
};

const pencilInitialCandidates = () => {
    if (initialCandidatesPenciled) {
        return;
    }

    cells.forEach((cell) => {
        if (cell.isGiven || cell.filled) {
            return;
        }

        cell.candidateButtons.forEach((button) => {
            if (button.classList.contains('available')) {
                button.classList.add('penciled');
            }
        });
    });

    initialCandidatesPenciled = true;
};

const setCellValue = (cellKey, value, options = {}) => {
    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven) {
        return new Set();
    }

    const {
        triggerCascade = true,
        focusCell = true,
        actionContext = null
    } = options;

    const context = actionContext || createActionContext();
    const shouldCommitAction = !actionContext;

    captureCellSnapshot(cellKey, context);
    boardState[cell.row][cell.col] = value;
    cell.valueEl.textContent = value;
    cell.filled = true;
    cell.element.classList.add('filled', 'player-value');
    const impactedCells = clearPeerCandidatePencils(cell.row, cell.col, value, context);
    cell.candidateButtons.forEach((button) => {
        button.classList.remove('available', 'penciled');
        button.disabled = true;
    });
    refreshAllCandidates();
    refreshConflicts();
    if (focusCell) {
        setActiveCell(cellKey);
        armedClearCellKey = cellKey;
    }

    if (triggerCascade && impactedCells.size > 0) {
        cascadeFillSingleCandidateCells(impactedCells, context);
    }

    if (shouldCommitAction) {
        pushUndoAction(context);
    }

    return impactedCells;
};

const clearCellValue = (cellKey) => {
    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven || !cell.filled) {
        return null;
    }

    const previousValue = boardState[cell.row][cell.col];
    boardState[cell.row][cell.col] = 0;
    cell.valueEl.textContent = '';
    cell.filled = false;
    cell.element.classList.remove('filled', 'player-value');
    cell.candidateButtons.forEach((button) => {
        button.disabled = false;
        button.classList.remove('penciled');
    });
    refreshAllCandidates();
    refreshConflicts();
    return previousValue;
};

const handleCandidateClick = (event, cellKey, number) => {
    event.stopPropagation();
    if (event.detail && event.detail > 1) {
        return;
    }

    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven || cell.filled) {
        return;
    }

    const button = cell.candidateButtons.get(number);
    if (!button) {
        return;
    }

    const context = createActionContext();
    captureCellSnapshot(cellKey, context);
    const wasPenciled = button.classList.contains('penciled');
    button.classList.toggle('penciled');
    const isPenciled = button.classList.contains('penciled');
    if (wasPenciled === isPenciled) {
        return;
    }

    pushUndoAction(context);
};

const handleCandidateDoubleClick = (event, cellKey, number) => {
    event.preventDefault();
    event.stopPropagation();

    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven || cell.filled) {
        return;
    }

    const button = cell.candidateButtons.get(number);
    if (!button) {
        return;
    }

    setCellValue(cellKey, number);
};

const handleCellClear = (event, cellKey) => {
    event.stopPropagation();
    const cell = cells.get(cellKey);
    if (!cell) {
        pendingClearCellKey = null;
        return;
    }

    if (pendingClearCellKey !== cellKey) {
        pendingClearCellKey = null;
        return;
    }

    pendingClearCellKey = null;

    if (cell.isGiven) {
        setActiveCell(cellKey);
        return;
    }

    if (!cell.filled) {
        setActiveCell(cellKey);
        return;
    }

    clearCellValue(cellKey);
    setActiveCell(cellKey);
};

const createPlayerCell = (row, col) => {
    const cellElement = document.createElement('div');
    cellElement.className = 'sudoku-cell player';
    cellElement.dataset.row = String(row);
    cellElement.dataset.col = String(col);
    cellElement.setAttribute('role', 'gridcell');
    cellElement.tabIndex = 0;

    const valueElement = document.createElement('div');
    valueElement.className = 'cell-value';
    cellElement.appendChild(valueElement);

    const grid = document.createElement('div');
    grid.className = 'candidates-grid';
    const candidateButtons = new Map();

    for (let number = 1; number <= 9; number += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'candidate';
        button.dataset.number = String(number);
        button.textContent = number;
        button.setAttribute(
            'aria-label',
            `Candidate ${number} for row ${row + 1}, column ${col + 1}`
        );
        button.addEventListener('click', (event) => handleCandidateClick(event, keyFromCoords(row, col), number));
        button.addEventListener('dblclick', (event) => handleCandidateDoubleClick(event, keyFromCoords(row, col), number));
        grid.appendChild(button);
        candidateButtons.set(number, button);
    }

    cellElement.appendChild(grid);
    const cellKey = keyFromCoords(row, col);
    cellElement.addEventListener('pointerdown', () => handleCellPointerDown(cellKey));
    cellElement.addEventListener('focus', () => {
        if (activeCellKey !== cellKey) {
            setActiveCell(cellKey);
        }
    });
    cellElement.addEventListener('click', (event) => handleCellClear(event, cellKey));
    cellElement.addEventListener('keydown', (event) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') {
            return;
        }
        const targetCell = cells.get(cellKey);
        if (!targetCell || targetCell.isGiven) {
            return;
        }
        clearCellValue(cellKey);
        setActiveCell(cellKey);
    });

    return {
        row,
        col,
        element: cellElement,
        valueEl: valueElement,
        isGiven: false,
        filled: false,
        candidateButtons
    };
};

const createGivenCell = (row, col, value) => {
    const cellElement = document.createElement('div');
    cellElement.className = 'sudoku-cell given filled';
    cellElement.dataset.row = String(row);
    cellElement.dataset.col = String(col);
    cellElement.setAttribute('role', 'gridcell');
    cellElement.tabIndex = 0;

    const valueElement = document.createElement('div');
    valueElement.className = 'cell-value';
    valueElement.textContent = value;
    cellElement.appendChild(valueElement);

    const cellKey = keyFromCoords(row, col);
    cellElement.addEventListener('pointerdown', () => handleCellPointerDown(cellKey));
    cellElement.addEventListener('focus', () => {
        if (activeCellKey !== cellKey) {
            setActiveCell(cellKey);
        }
    });

    return {
        row,
        col,
        element: cellElement,
        valueEl: valueElement,
        isGiven: true,
        filled: true,
        candidateButtons: new Map()
    };
};

const applyBorderClasses = (cellElement, row, col) => {
    if (row % 3 === 0) {
        cellElement.classList.add('border-top-bold');
    }
    if (col % 3 === 0) {
        cellElement.classList.add('border-left-bold');
    }
};

const buildBoard = () => {
    if (!boardElement) {
        dispatchReady();
        return;
    }

    initialCandidatesPenciled = false;
    setBoardCellSize(DEFAULT_CELL_SIZE);
    clearActiveCell();
    boardElement.textContent = '';
    cells.clear();
    for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
            const value = puzzle[row][col];
            const cellKey = keyFromCoords(row, col);
            const cell = value > 0 ? createGivenCell(row, col, value) : createPlayerCell(row, col);
            applyBorderClasses(cell.element, row, col);
            boardElement.appendChild(cell.element);
            cells.set(cellKey, cell);
        }
    }

    refreshAllCandidates();
    pencilInitialCandidates();
    refreshConflicts();
    dispatchReady();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBoard, { once: true });
} else {
    buildBoard();
}
