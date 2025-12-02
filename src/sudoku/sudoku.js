import { generateSudokuPuzzle, SUDOKU_DIFFICULTY_CONFIG } from './puzzle.js';

const FALLBACK_PUZZLE = [
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

const createGridClone = (grid) => grid.map((row) => row.slice());

let currentDifficulty = 'easy';
let currentPuzzleResult = null;
let puzzle = createGridClone(FALLBACK_PUZZLE);
let boardState = createGridClone(puzzle);
let isGeneratingPuzzle = false;
let isModeMenuOpen = false;

const boardElement = document.getElementById('sudoku-board');
const cells = new Map();
const MATCH_CANDIDATE_CLASS = 'match-candidate';
const MARKED_CANDIDATE_CLASS = 'candidate-marked';
const MARKED_CANDIDATE_LABELS = Object.freeze([
    '',
    '①',
    '②',
    '③',
    '④',
    '⑤',
    '⑥',
    '⑦',
    '⑧',
    '⑨'
]);
const INVALID_PLACEMENT_CLASS = 'invalid-placement-cell';
const highlightClasses = ['active-cell', 'peer-cell', 'match-cell', INVALID_PLACEMENT_CLASS];
const CONFLICT_CLASS = 'conflict-cell';
const DEFAULT_CELL_SIZE = 70; //px
const MAX_UNDO_STACK_SIZE = 100;
const CUSTOM_DOUBLE_CLICK_THRESHOLD_MS = 250;
const timerElement = document.getElementById('sudoku-timer');
const shareButton = document.getElementById('copy-button');
const newPuzzleButton = document.getElementById('new-puzzle-button');
const newPuzzleButtonLabel = document.getElementById('new-puzzle-button-label');
const difficultyButton = document.getElementById('mode-button');
const modeButtonLabel = document.getElementById('mode-button-label');
const difficultyPanel = document.getElementById('mode-panel');
const difficultyMenu = document.getElementById('mode-menu');
const MAX_TIMER_SECONDS = (99 * 3600) + (59 * 60) + 59;
const SHARE_BUTTON_RESET_DELAY_MS = 1000;
let activeCellKey = null;
let pendingClearCellKey = null;
let armedClearCellKey = null;
let initialCandidatesPenciled = false;
const undoStack = [];
const candidateClickTracker = new WeakMap();
let timerIntervalId = null;
let timerStartTimestamp = null;
let timerElapsedMs = 0;
let timerRunning = false;
let lastTimerDisplayValue = '0:00';
let isGameComplete = false;
let currentShareText = '';
let shareButtonResetTimeout = null;

const keyFromCoords = (row, col) => `${row}-${col}`;

const getMarkedCandidateLabel = (number) => {
    if (!Number.isInteger(number) || number < 1 || number >= MARKED_CANDIDATE_LABELS.length) {
        return String(number);
    }
    const label = MARKED_CANDIDATE_LABELS[number];
    return typeof label === 'string' && label.length > 0 ? label : String(number);
};

const updateCandidateButtonLabel = (button, number) => {
    if (!button) {
        return;
    }
    if (button.classList.contains(MARKED_CANDIDATE_CLASS)) {
        button.textContent = getMarkedCandidateLabel(number);
    } else {
        button.textContent = String(number);
    }
};

const setCandidateMarkedState = (button, number, shouldMark) => {
    if (!button) {
        return;
    }
    button.classList.toggle(MARKED_CANDIDATE_CLASS, Boolean(shouldMark));
    updateCandidateButtonLabel(button, number);
};

const dispatchReady = () => {
    document.dispatchEvent(new Event('fouc:ready'));
};

const formatElapsedTime = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return '0:00';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        const hourText = String(hours).padStart(2, '0');
        const minuteText = String(minutes).padStart(2, '0');
        const secondText = String(seconds).padStart(2, '0');
        return `${hourText}:${minuteText}:${secondText}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const updateTimerDisplay = () => {
    if (!timerElement) {
        return lastTimerDisplayValue;
    }

    let elapsedMs = timerRunning && timerStartTimestamp !== null
        ? Date.now() - timerStartTimestamp
        : timerElapsedMs;

    let elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds >= MAX_TIMER_SECONDS) {
        elapsedSeconds = MAX_TIMER_SECONDS;
        timerElapsedMs = elapsedSeconds * 1000;
        timerRunning = false;
        timerStartTimestamp = null;
        if (timerIntervalId) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
    } else if (timerRunning) {
        timerElapsedMs = elapsedSeconds * 1000;
    }

    lastTimerDisplayValue = formatElapsedTime(elapsedSeconds);
    timerElement.textContent = lastTimerDisplayValue;
    return lastTimerDisplayValue;
};

const showTimerElement = () => {
    if (timerElement) {
        timerElement.classList.remove('hidden');
    }
};

const hideTimerElement = () => {
    if (timerElement) {
        timerElement.classList.add('hidden');
    }
};

const resetTimer = () => {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
    timerRunning = false;
    timerStartTimestamp = null;
    timerElapsedMs = 0;
    lastTimerDisplayValue = '0:00';
    if (timerElement) {
        timerElement.textContent = lastTimerDisplayValue;
    }
    hideTimerElement();
};

const startTimer = () => {
    timerStartTimestamp = Date.now();
    timerRunning = true;
    updateTimerDisplay();
    showTimerElement();
    timerIntervalId = window.setInterval(updateTimerDisplay, 1000);
};

const startTimerIfNeeded = () => {
    if (timerRunning || timerStartTimestamp !== null || isGameComplete) {
        return;
    }
    startTimer();
};

const stopTimer = () => {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
    if (timerRunning && timerStartTimestamp !== null) {
        timerElapsedMs = Date.now() - timerStartTimestamp;
    }
    timerRunning = false;
    timerStartTimestamp = null;
    updateTimerDisplay();
};

const getFormattedElapsedTime = () => lastTimerDisplayValue;

const resetShareButton = () => {
    currentShareText = '';
    if (shareButtonResetTimeout) {
        clearTimeout(shareButtonResetTimeout);
        shareButtonResetTimeout = null;
    }
    if (shareButton) {
        shareButton.textContent = 'share';
        shareButton.classList.add('hidden');
    }
};

const showShareButton = () => {
    if (!shareButton) {
        return;
    }
    shareButton.textContent = 'share';
    shareButton.classList.remove('hidden');
};

const copyShareText = async () => {
    if (!currentShareText) {
        return false;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(currentShareText);
        return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = currentShareText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch (error) {
        copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
};

const handleShareButtonClick = async () => {
    if (!shareButton || !currentShareText) {
        return;
    }

    const copied = await copyShareText().catch(() => false);
    if (!copied) {
        return;
    }

    shareButton.textContent = 'copied';
    if (shareButtonResetTimeout) {
        clearTimeout(shareButtonResetTimeout);
    }
    shareButtonResetTimeout = window.setTimeout(() => {
        if (shareButton) {
            shareButton.textContent = 'share';
        }
        shareButtonResetTimeout = null;
    }, SHARE_BUTTON_RESET_DELAY_MS);
};

if (shareButton) {
    shareButton.addEventListener('click', handleShareButtonClick);
}

resetTimer();
resetShareButton();

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'];
let controlsInitialized = false;

const getDifficultyConfig = (difficultyKey = currentDifficulty) => (
    SUDOKU_DIFFICULTY_CONFIG[difficultyKey] || SUDOKU_DIFFICULTY_CONFIG.easy
);

const isDifficultyEnabled = (difficultyKey) => difficultyKey === 'easy';

const updateModeButtonLabel = () => {
    if (!modeButtonLabel) {
        return;
    }
    modeButtonLabel.textContent = 'mode';
};

const updateNewPuzzleButtonLabel = () => {
    if (!newPuzzleButtonLabel) {
        return;
    }
    const labelText = 'reset';
    newPuzzleButtonLabel.textContent = labelText;
    if (newPuzzleButton) {
        newPuzzleButton.setAttribute('aria-label', `${labelText} (press enter or r)`);
    }
};

const setModeMenuVisibility = (visible) => {
    if (!difficultyPanel || !difficultyButton) {
        return;
    }
    isModeMenuOpen = visible;
    difficultyPanel.classList.toggle('hidden', !visible);
    difficultyButton.setAttribute('aria-expanded', visible ? 'true' : 'false');
    difficultyPanel.setAttribute('aria-hidden', visible ? 'false' : 'true');
};

const closeDifficultyMenu = () => setModeMenuVisibility(false);
const openDifficultyMenu = () => setModeMenuVisibility(true);

const renderDifficultyMenu = () => {
    if (!difficultyMenu) {
        return;
    }
    difficultyMenu.textContent = '';
    DIFFICULTY_ORDER.forEach((difficultyKey) => {
        const config = SUDOKU_DIFFICULTY_CONFIG[difficultyKey];
        if (!config) {
            return;
        }
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'sudoku-footer-button sudoku-difficulty-button';
        option.dataset.difficulty = difficultyKey;
        option.textContent = config.displayName.toLowerCase();
        option.classList.toggle('sudoku-difficulty-button--active', currentDifficulty === difficultyKey);
        const enabled = isDifficultyEnabled(difficultyKey);
        if (!enabled) {
            option.disabled = true;
            option.setAttribute('aria-disabled', 'true');
            option.title = 'coming soon';
        } else {
            option.addEventListener('click', () => {
                if (currentDifficulty !== difficultyKey) {
                    requestNewPuzzle(difficultyKey);
                }
                closeDifficultyMenu();
            });
        }
        difficultyMenu.appendChild(option);
    });
};

const refreshDifficultyUi = () => {
    updateModeButtonLabel();
    updateNewPuzzleButtonLabel();
    renderDifficultyMenu();
};

const shouldIgnoreGlobalShortcut = (target) => {
    if (!target || typeof target.closest !== 'function') {
        return false;
    }
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

const setNewPuzzleButtonBusyState = (isBusy) => {
    if (!newPuzzleButton) {
        return;
    }
    newPuzzleButton.disabled = Boolean(isBusy);
    newPuzzleButton.classList.toggle('is-loading', Boolean(isBusy));
    if (isBusy) {
        newPuzzleButton.setAttribute('aria-busy', 'true');
    } else {
        newPuzzleButton.removeAttribute('aria-busy');
    }
};

const requestNewPuzzle = (difficultyKey = currentDifficulty) => {
    if (isGeneratingPuzzle) {
        return;
    }

    const targetDifficulty = isDifficultyEnabled(difficultyKey) ? difficultyKey : 'easy';
    isGeneratingPuzzle = true;
    setNewPuzzleButtonBusyState(true);
    try {
        const result = generateSudokuPuzzle(targetDifficulty);
        puzzle = createGridClone(result.puzzle);
        boardState = createGridClone(puzzle);
        currentPuzzleResult = result;
        currentDifficulty = result.difficulty || targetDifficulty;
    } catch (error) {
        console.error('Failed to generate Sudoku puzzle, using fallback puzzle.', error);
        puzzle = createGridClone(FALLBACK_PUZZLE);
        boardState = createGridClone(puzzle);
        currentPuzzleResult = null;
        currentDifficulty = 'easy';
    } finally {
        isGeneratingPuzzle = false;
        setNewPuzzleButtonBusyState(false);
    }

    buildBoard();
    refreshDifficultyUi();
};

const handleModeButtonClick = (event) => {
    event.preventDefault();
    if (!difficultyPanel) {
        return;
    }
    if (isModeMenuOpen) {
        closeDifficultyMenu();
    } else {
        openDifficultyMenu();
    }
};

const handleGlobalPointerDown = (event) => {
    if (!isModeMenuOpen || !difficultyPanel || !difficultyButton) {
        return;
    }
    if (difficultyPanel.contains(event.target) || difficultyButton.contains(event.target)) {
        return;
    }
    closeDifficultyMenu();
};

const handleModeMenuKeydown = (event) => {
    if (event.key !== 'Escape' || !isModeMenuOpen) {
        return;
    }
    event.preventDefault();
    closeDifficultyMenu();
    if (difficultyButton && typeof difficultyButton.focus === 'function') {
        difficultyButton.focus();
    }
};

const handleNewPuzzleShortcut = (event) => {
    const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    if (key !== 'enter' && key !== 'r') {
        return;
    }

    if (shouldIgnoreGlobalShortcut(event.target)) {
        return;
    }

    event.preventDefault();
    requestNewPuzzle(currentDifficulty);
};

const initializeControlListeners = () => {
    if (controlsInitialized) {
        return;
    }
    controlsInitialized = true;

    if (difficultyButton) {
        difficultyButton.addEventListener('click', handleModeButtonClick);
    }
    if (newPuzzleButton) {
        newPuzzleButton.addEventListener('click', () => {
            requestNewPuzzle(currentDifficulty);
        });
    }
    document.addEventListener('pointerdown', handleGlobalPointerDown);
    document.addEventListener('keydown', handleModeMenuKeydown);
    document.addEventListener('keydown', handleNewPuzzleShortcut);
};

const isInteractiveElementForUndo = (target) => {
    if (!target || typeof target.closest !== 'function') {
        return false;
    }

    if (boardElement && boardElement.contains(target)) {
        return false;
    }

    if (target.closest('button, input, select, textarea')) {
        return true;
    }

    const editableAncestor = target.closest('[contenteditable="true"]');
    return Boolean(editableAncestor);
};

const blurBoardTarget = (target) => {
    if (!boardElement || !target || typeof target.closest !== 'function') {
        return;
    }

    const focusable = target.closest('#sudoku-board [tabindex], #sudoku-board button');
    if (focusable && typeof focusable.blur === 'function') {
        focusable.blur();
    }
};

const clearActiveCell = () => {
    activeCellKey = null;
    pendingClearCellKey = null;
    armedClearCellKey = null;
    cells.forEach((cell) => {
        highlightClasses.forEach((cls) => cell.element.classList.remove(cls));
        cell.candidateButtons.forEach((button) => {
            button.classList.remove(MATCH_CANDIDATE_CLASS);
        });
    });
};

const focusCellElement = (cell) => {
    if (!cell || !cell.element || typeof cell.element.focus !== 'function') {
        return;
    }

    cell.element.focus();
};

const getDigitFromKeyboardEvent = (event) => {
    if (!event) {
        return null;
    }

    const { key, code } = event;
    if (typeof key === 'string' && key.length === 1 && key >= '0' && key <= '9') {
        return Number(key);
    }

    if (typeof code === 'string') {
        if (code.startsWith('Digit')) {
            const digit = Number(code.slice(5));
            if (Number.isFinite(digit) && digit >= 0 && digit <= 9) {
                return digit;
            }
        }

        if (code.startsWith('Numpad')) {
            const digit = Number(code.slice(6));
            if (Number.isFinite(digit) && digit >= 0 && digit <= 9) {
                return digit;
            }
        }
    }

    return null;
};

const setBoardCellSize = (sizePx) => {
    if (!boardElement) {
        return;
    }

    boardElement.style.setProperty('--sudoku-cell-size', `${sizePx}px`);
};

const highlightMatchingCandidates = (value) => {
    if (!Number.isFinite(value) || value <= 0) {
        return;
    }

    cells.forEach((cell) => {
        if (!cell || cell.candidateButtons.size === 0) {
            return;
        }
        const button = cell.candidateButtons.get(value);
        if (button && button.classList.contains('penciled')) {
            button.classList.add(MATCH_CANDIDATE_CLASS);
        }
    });
};

const highlightInvalidPlacementCells = (value) => {
    if (!Number.isFinite(value) || value <= 0) {
        return;
    }

    const blockedKeys = new Set();
    for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
            if (boardState[row][col] !== value) {
                continue;
            }

            for (let i = 0; i < 9; i += 1) {
                blockedKeys.add(keyFromCoords(row, i));
                blockedKeys.add(keyFromCoords(i, col));
            }

            const boxRowStart = Math.floor(row / 3) * 3;
            const boxColStart = Math.floor(col / 3) * 3;
            for (let r = boxRowStart; r < boxRowStart + 3; r += 1) {
                for (let c = boxColStart; c < boxColStart + 3; c += 1) {
                    blockedKeys.add(keyFromCoords(r, c));
                }
            }
        }
    }

    blockedKeys.forEach((cellKey) => {
        const cell = cells.get(cellKey);
        if (!cell) {
            return;
        }
        if (boardState[cell.row][cell.col] === value) {
            return;
        }
        cell.element.classList.add(INVALID_PLACEMENT_CLASS);
    });
};

const setActiveCell = (cellKey) => {
    if (isGameComplete) {
        return;
    }

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
        highlightMatchingCandidates(highlightValue);
        highlightInvalidPlacementCells(highlightValue);
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
    if (isGameComplete) {
        return;
    }

    const wasAlreadyActive = activeCellKey === cellKey || armedClearCellKey === cellKey;
    setActiveCell(cellKey);
    if (wasAlreadyActive) {
        pendingClearCellKey = cellKey;
    } else {
        pendingClearCellKey = null;
    }
    armedClearCellKey = null;
};

const handleBoardNumberInput = (event) => {
    if (isGameComplete || !activeCellKey) {
        return;
    }

    const digit = getDigitFromKeyboardEvent(event);
    if (!Number.isInteger(digit)) {
        return;
    }

    if (isInteractiveElementForUndo(event.target)) {
        return;
    }

    const cell = cells.get(activeCellKey);
    if (!cell || cell.isGiven) {
        return;
    }

    if (digit === 0) {
        if (!cell.filled) {
            return;
        }
        event.preventDefault();
        clearCellValue(activeCellKey);
        setActiveCell(activeCellKey);
        focusCellElement(cell);
        return;
    }

    if (digit < 1 || digit > 9 || cell.filled) {
        return;
    }

    event.preventDefault();
    setCellValue(activeCellKey, digit);
    focusCellElement(cell);
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

        event.preventDefault();
        blurBoardTarget(event.target);
        if (isInteractiveElementForUndo(event.target)) {
            return;
        }

        undoLastAction();
    }, { capture: true });

    document.addEventListener('keydown', handleBoardNumberInput, { capture: true });
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

const isBoardFilled = () => {
    for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
            const value = boardState[row][col];
            if (!Number.isFinite(value) || value <= 0) {
                return false;
            }
        }
    }
    return true;
};

const prepareWinShareText = () => {
    const timerValue = getFormattedElapsedTime();
    currentShareText = `SUDOKU\n${timerValue}\nhttps://othertab.com/sudoku/`;
    showShareButton();
};

const handleGameComplete = () => {
    if (isGameComplete) {
        return;
    }

    isGameComplete = true;
    pendingClearCellKey = null;
    armedClearCellKey = null;
    stopTimer();
    clearActiveCell();
    cells.forEach((cell) => {
        if (!cell || cell.isGiven || !cell.filled) {
            return;
        }
        cell.element.classList.add('player-complete-cell');
    });
    prepareWinShareText();
};

const checkForCompletion = () => {
    if (isGameComplete || !isBoardFilled()) {
        return;
    }

    const conflicts = findConflictCellKeys();
    if (conflicts.size > 0) {
        return;
    }

    handleGameComplete();
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
    const markedNumbers = [];
    cell.candidateButtons.forEach((button, number) => {
        if (button.classList.contains('penciled')) {
            penciledNumbers.push(number);
        }
        if (button.classList.contains(MARKED_CANDIDATE_CLASS)) {
            markedNumbers.push(number);
        }
    });

    context.cellSnapshots.set(cellKey, {
        value: boardState[cell.row][cell.col],
        filled: cell.filled,
        penciledNumbers,
        markedNumbers
    });
};

const restoreCellSnapshot = (cellKey, snapshot) => {
    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven) {
        return;
    }

    const penciledSet = new Set(snapshot.penciledNumbers || []);
    const markedSet = new Set(snapshot.markedNumbers || []);
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
        const shouldBeMarked = !snapshot.filled && markedSet.has(number);
        setCandidateMarkedState(button, number, shouldBeMarked);
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
    if (isGameComplete || undoStack.length === 0) {
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
        if (!cell || cell.isGiven) {
            return;
        }

        if (!cell.filled) {
            impactedCellKeys.add(key);
        }

        if (cell.filled) {
            return;
        }

        const button = cell.candidateButtons.get(value);
        if (!button) {
            return;
        }

        const hadState = button.classList.contains('penciled') ||
            button.classList.contains(MARKED_CANDIDATE_CLASS);
        if (!hadState) {
            return;
        }

        captureCellSnapshot(key, actionContext);
        button.classList.remove('penciled');
        setCandidateMarkedState(button, value, false);
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
    if (!initialCellKeys) {
        return;
    }

    const allowedCells = new Set(initialCellKeys);
    if (allowedCells.size === 0) {
        return;
    }

    let filledAny = true;
    while (filledAny) {
        filledAny = false;

        for (const cellKey of allowedCells) {
            const cell = cells.get(cellKey);
            if (!cell || cell.isGiven || cell.filled) {
                continue;
            }

            const forcedValue = findSinglePenciledCandidateValue(cell);
            if (!Number.isFinite(forcedValue)) {
                continue;
            }

            setCellValue(
                cellKey,
                forcedValue,
                { triggerCascade: false, focusCell: false, actionContext }
            );
            filledAny = true;
            break;
        }
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
    if (isGameComplete) {
        return new Set();
    }

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

    startTimerIfNeeded();
    captureCellSnapshot(cellKey, context);
    boardState[cell.row][cell.col] = value;
    cell.valueEl.textContent = value;
    cell.filled = true;
    cell.element.classList.add('filled', 'player-value');
    const impactedCells = clearPeerCandidatePencils(cell.row, cell.col, value, context);
    cell.candidateButtons.forEach((button, number) => {
        button.classList.remove('available', 'penciled');
        setCandidateMarkedState(button, number, false);
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

    checkForCompletion();

    return impactedCells;
};

const clearCellValue = (cellKey) => {
    if (isGameComplete) {
        return null;
    }

    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven || !cell.filled) {
        return null;
    }

    startTimerIfNeeded();

    const previousValue = boardState[cell.row][cell.col];
    boardState[cell.row][cell.col] = 0;
    cell.valueEl.textContent = '';
    cell.filled = false;
    cell.element.classList.remove('filled', 'player-value');
    cell.candidateButtons.forEach((button, number) => {
        button.disabled = false;
        button.classList.remove('penciled');
        setCandidateMarkedState(button, number, false);
    });
    refreshAllCandidates();
    refreshConflicts();
    return previousValue;
};

const markCandidateClick = (button) => {
    const timeoutId = window.setTimeout(() => {
        const entry = candidateClickTracker.get(button);
        if (entry && entry.timeoutId === timeoutId) {
            candidateClickTracker.delete(button);
        }
    }, CUSTOM_DOUBLE_CLICK_THRESHOLD_MS);
    candidateClickTracker.set(button, { lastClick: performance.now(), timeoutId });
};

const isCustomDoubleClick = (button) => {
    if (!button) {
        return false;
    }

    const now = performance.now();
    const entry = candidateClickTracker.get(button);
    if (entry && (now - entry.lastClick) <= CUSTOM_DOUBLE_CLICK_THRESHOLD_MS) {
        clearTimeout(entry.timeoutId);
        candidateClickTracker.delete(button);
        return true;
    }

    if (entry && entry.timeoutId) {
        clearTimeout(entry.timeoutId);
    }

    markCandidateClick(button);
    return false;
};

const fillCellFromCandidate = (cellKey, number) => {
    if (isGameComplete) {
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

    setCellValue(cellKey, number);
};

const handleCandidateClick = (event, cellKey, number) => {
    event.preventDefault();
    event.stopPropagation();

    if (isGameComplete) {
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

    if (isCustomDoubleClick(button)) {
        fillCellFromCandidate(cellKey, number);
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

    startTimerIfNeeded();
    pushUndoAction(context);
};

const handleCandidateMark = (event, cellKey, number) => {
    event.preventDefault();
    event.stopPropagation();

    if (isGameComplete) {
        return;
    }

    const cell = cells.get(cellKey);
    if (!cell || cell.isGiven || cell.filled) {
        return;
    }

    const button = cell.candidateButtons.get(number);
    if (!button || button.disabled) {
        return;
    }

    const context = createActionContext();
    captureCellSnapshot(cellKey, context);
    const wasMarked = button.classList.contains(MARKED_CANDIDATE_CLASS);
    setCandidateMarkedState(button, number, !wasMarked);
    const isMarked = button.classList.contains(MARKED_CANDIDATE_CLASS);
    if (wasMarked === isMarked) {
        return;
    }

    startTimerIfNeeded();
    pushUndoAction(context);
};

const handleCellClear = (event, cellKey) => {
    event.stopPropagation();

    if (isGameComplete) {
        pendingClearCellKey = null;
        return;
    }

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
    const cellKey = keyFromCoords(row, col);

    for (let number = 1; number <= 9; number += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'candidate';
        button.dataset.number = String(number);
        button.textContent = number;
        button.tabIndex = -1;
        button.setAttribute(
            'aria-label',
            `Candidate ${number} for row ${row + 1}, column ${col + 1}`
        );
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
        });
        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
        });
        button.addEventListener('click', (event) => handleCandidateClick(event, cellKey, number));
        button.addEventListener('contextmenu', (event) => handleCandidateMark(event, cellKey, number));
        grid.appendChild(button);
        candidateButtons.set(number, button);
    }

    cellElement.appendChild(grid);
    cellElement.addEventListener('pointerdown', () => handleCellPointerDown(cellKey));
    cellElement.addEventListener('focus', () => {
        if (isGameComplete) {
            return;
        }
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
        if (isGameComplete) {
            return;
        }
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

    boardState = createGridClone(puzzle);
    isGameComplete = false;
    resetTimer();
    resetShareButton();
    initialCandidatesPenciled = false;
    undoStack.length = 0;
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

const initializeSudoku = () => {
    refreshDifficultyUi();
    initializeControlListeners();
    requestNewPuzzle(currentDifficulty);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSudoku, { once: true });
} else {
    initializeSudoku();
}
