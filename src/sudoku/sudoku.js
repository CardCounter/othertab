const puzzle = [
    [0, 0, 0, 0, 7, 0, 0, 0, 0],
    [1, 0, 0, 9, 0, 4, 0, 0, 6],
    [0, 0, 7, 0, 0, 0, 3, 0, 0],
    [0, 5, 0, 0, 0, 2, 0, 4, 0],
    [0, 0, 0, 5, 0, 9, 0, 0, 0],
    [0, 9, 0, 1, 0, 0, 0, 7, 0],
    [0, 0, 3, 0, 0, 0, 5, 0, 0],
    [5, 0, 0, 7, 0, 8, 0, 0, 1],
    [0, 0, 0, 0, 3, 0, 0, 0, 0]
];

const boardState = puzzle.map((row) => row.slice());
const boardElement = document.getElementById('sudoku-board');
const cells = new Map();
const highlightClasses = ['active-cell', 'peer-cell', 'match-cell'];
let activeCellKey = null;

const keyFromCoords = (row, col) => `${row}-${col}`;

const dispatchReady = () => {
    document.dispatchEvent(new Event('fouc:ready'));
};

const clearActiveCell = () => {
    activeCellKey = null;
    cells.forEach((cell) => {
        highlightClasses.forEach((cls) => cell.element.classList.remove(cls));
    });
};

const setActiveCell = (cellKey, options = {}) => {
    clearActiveCell();
    if (!cellKey) {
        return;
    }

    const cell = cells.get(cellKey);
    if (!cell) {
        return;
    }

    activeCellKey = cellKey;
    const { valueOverride } = options;
    let highlightValue = Number.isFinite(valueOverride) ? valueOverride : boardState[cell.row][cell.col];
    if (!Number.isFinite(highlightValue) || highlightValue <= 0) {
        highlightValue = null;
    }

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

if (boardElement) {
    document.addEventListener('pointerdown', (event) => {
        if (!boardElement.contains(event.target)) {
            clearActiveCell();
        }
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

const refreshCellCandidates = (cell) => {
    if (!cell || cell.isGiven || cell.filled) {
        return;
    }

    const available = new Set(computeCandidates(cell.row, cell.col));
    cell.candidateButtons.forEach((button, number) => {
        if (available.has(number)) {
            button.disabled = false;
            button.classList.add('available');
        } else {
            button.disabled = true;
            button.classList.remove('available', 'penciled');
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

const setCellValue = (cellKey, value) => {
    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven) {
        return;
    }

    boardState[cell.row][cell.col] = value;
    cell.valueEl.textContent = value;
    cell.filled = true;
    cell.element.classList.add('filled', 'player-value');
    cell.candidateButtons.forEach((button) => {
        button.classList.remove('available', 'penciled');
        button.disabled = true;
    });
    refreshAllCandidates();
    setActiveCell(cellKey);
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
    if (!button || !button.classList.contains('available')) {
        return;
    }

    button.classList.toggle('penciled');
};

const handleCandidateDoubleClick = (event, cellKey, number) => {
    event.preventDefault();
    event.stopPropagation();

    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven || cell.filled) {
        return;
    }

    const button = cell.candidateButtons.get(number);
    if (!button || !button.classList.contains('available')) {
        return;
    }

    setCellValue(cellKey, number);
};

const handleCellClear = (event, cellKey) => {
    event.stopPropagation();
    const cell = cells.get(cellKey);
    if (!cell) {
        return;
    }

    if (cell.isGiven) {
        setActiveCell(cellKey);
        return;
    }

    if (!cell.filled) {
        setActiveCell(cellKey);
        return;
    }

    const previousValue = clearCellValue(cellKey);
    if (Number.isFinite(previousValue) && previousValue > 0) {
        setActiveCell(cellKey, { valueOverride: previousValue });
    } else {
        setActiveCell(cellKey);
    }
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
    cellElement.addEventListener('pointerdown', () => setActiveCell(cellKey));
    cellElement.addEventListener('focus', () => setActiveCell(cellKey));
    cellElement.addEventListener('click', (event) => handleCellClear(event, cellKey));
    cellElement.addEventListener('keydown', (event) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') {
            return;
        }
        const targetCell = cells.get(cellKey);
        if (!targetCell || targetCell.isGiven) {
            return;
        }
        const previousValue = clearCellValue(cellKey);
        if (Number.isFinite(previousValue) && previousValue > 0) {
            setActiveCell(cellKey, { valueOverride: previousValue });
        } else {
            setActiveCell(cellKey);
        }
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
    cellElement.addEventListener('pointerdown', () => setActiveCell(cellKey));
    cellElement.addEventListener('focus', () => setActiveCell(cellKey));

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
    if (row % 3 === 2) {
        cellElement.classList.add('border-bottom-bold');
    }
    if (col % 3 === 0) {
        cellElement.classList.add('border-left-bold');
    }
    if (col % 3 === 2) {
        cellElement.classList.add('border-right-bold');
    }
};

const buildBoard = () => {
    if (!boardElement) {
        dispatchReady();
        return;
    }

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
    dispatchReady();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBoard, { once: true });
} else {
    buildBoard();
}
