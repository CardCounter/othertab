class Minesweeper {
    constructor() {
        this.difficultyStorageKey = 'MINES-last-difficulty';
        this.firstGameStorageKey = 'MINES-first-game-completed';
        this.gameContainer = document.getElementById('game-container');
        this.gridWrapper = document.querySelector('.grid-wrapper');
        this.gridElement = document.getElementById('grid');
        this.flagCountElement = document.getElementById('flag-count');
        this.timerElement = document.getElementById('timer');
        this.shareButton = document.getElementById('copy-button');
        this.resetHintElement = document.getElementById('reset-hint');
        this.newGameButton = document.getElementById('new-game-button');
        this.modeButton = document.getElementById('mode-button');
        this.modePanel = document.getElementById('mode-panel');
        this.difficultyButtons = Array.from(document.querySelectorAll('.difficulty-button'));

        this.grid = [];
        this.revealed = 0;
        this.gameOver = false;
        this.firstClick = true;
        this.timer = 0;
        this.timerInterval = null;
        this.maxTimerSeconds = (99 * 3600) + (59 * 60) + 59;
        this.isWin = false;
        this.isMouseDown = false;
        this.mouseDownButton = null;
        this.currentShareText = '';
        this.currentSeed = '';
        this.isSeedLoadedGame = false;
        this.seedLockActive = false;
        this.seedStartCell = null;
        this.shareButtonResetTimeout = null;
        this.hoveredCell = null;

        this.setDifficulty(this.getStoredDifficulty());
        this.flagsRemaining = this.mines;

        if (this.shareButton) {
            this.shareButton.addEventListener('click', () => {
                this.handleShareButtonClick();
            });
        }

        if (this.newGameButton) {
            this.newGameButton.addEventListener('click', () => {
                this.newGameButton.blur();
                this.resetGame();
            });
        }

        if (this.modeButton && this.modePanel) {
            this.modeButton.addEventListener('click', () => {
                if (this.isModePanelOpen()) {
                    this.closeModePanel();
                } else {
                    this.openModePanel();
                }
            });

            document.addEventListener('click', (event) => {
                if (!this.isModePanelOpen()) {
                    return;
                }
                const target = event.target;
                if (this.modePanel.contains(target) || this.modeButton.contains(target)) {
                    return;
                }
                this.closeModePanel();
            });
        }
        
        this.initializeGrid();
        this.renderGrid();
        this.updateStats();
        this.hideTimer();
        this.showGridBorder();

        // difficulty buttons
        this.difficultyButtons.forEach(button => {
            button.addEventListener('click', () => {
                // set difficulty and reset game
                this.setDifficulty(button.id);
                this.resetGame();
                this.closeModePanel();
            });
        });

        this.bindGridEvents();
        this.bindKeyboardShortcuts();

        document.addEventListener('mouseup', () => {
            this.handleGlobalMouseRelease();
        });

        window.addEventListener('blur', () => {
            this.handleGlobalMouseRelease();
        });
        this.setupNewGame();
    }
    
    getStoredDifficulty() {
        const storedDifficulty = localStorage.getItem(this.difficultyStorageKey);
        if (storedDifficulty === 'easy' || storedDifficulty === 'medium' || storedDifficulty === 'hard') {
            return storedDifficulty;
        }
        return 'hard';
    }

    persistDifficulty() {
        localStorage.setItem(this.difficultyStorageKey, this.difficulty);
    }

    setDifficulty(difficulty) {
        const validDifficulties = ['easy', 'medium', 'hard'];
        if (!validDifficulties.includes(difficulty)) {
            difficulty = 'hard';
        }
        this.difficulty = difficulty;
        this.setDifficultySettings(this.difficulty);
        this.persistDifficulty();
        this.updateActiveDifficultyButton();
    }

    updateActiveDifficultyButton() {
        if (!this.difficultyButtons || !this.difficultyButtons.length) {
            return;
        }
        const activeClass = 'difficulty-button--active';
        this.difficultyButtons.forEach(btn => {
            const isActive = btn.id === this.difficulty;
            btn.classList.toggle(activeClass, isActive);
        });
    }

    setDifficultySettings(difficulty) {
        switch (difficulty) {
            case 'easy':
                this.rows = 9;
                this.cols = 9;
                this.mines = 10;
                break;
            case 'medium':
                this.rows = 16;
                this.cols = 16;
                this.mines = 40;
                break;
            case 'hard':
            default:
                this.rows = 16;
                this.cols = 30;
                this.mines = 99;
                break;
        }
    }

    updateTimerDisplay() {
        if (this.timerElement) {
            this.timerElement.textContent = this.formatTime(this.timer);
        }
    }

    updateStats() {
        if (this.flagCountElement) {
            this.flagCountElement.textContent = this.flagsRemaining;
        }
        this.updateTimerDisplay();
    }

    showTimer() {
        if (this.timerElement) {
            this.timerElement.classList.remove('hidden');
        }
    }

    hideTimer() {
        if (this.timerElement) {
            this.timerElement.classList.add('hidden');
        }
    }

    setupNewGame(options = {}) {
        const { fromSeed = false, beforeRender } = options;
        const wasSeedLoadedGame = this.isSeedLoadedGame;
        if (wasSeedLoadedGame && !fromSeed) {
            this.clearSeedFromUrl();
        }
        this.stopTimer();
        this.hideResetHint();
        this.showGridBorder();
        this.clearAllPressedStyles();
        this.hoveredCell = null;
        if (!fromSeed) {
            this.setDifficultySettings(this.difficulty);
        }
        this.gameOver = false;
        this.firstClick = true;
        this.isWin = false;
        this.seedLockActive = false;
        this.seedStartCell = null;
        this.revealed = 0;
        this.flagsRemaining = this.mines;
        this.timer = 0;
        this.isSeedLoadedGame = fromSeed;
        this.currentSeed = '';
        this.hideTimer();
        this.updateTimerDisplay();
        this.resetShareButton();
        this.initializeGrid();
        if (typeof beforeRender === 'function') {
            beforeRender();
        }
        this.renderGrid();
        this.updateStats();
    }

    clearShareButtonTimeout() {
        if (this.shareButtonResetTimeout) {
            clearTimeout(this.shareButtonResetTimeout);
            this.shareButtonResetTimeout = null;
        }
    }

    resetShareButton() {
        this.currentShareText = '';
        this.clearShareButtonTimeout();
        if (this.shareButton) {
            this.shareButton.textContent = 'share';
            this.shareButton.classList.add('hidden');
        }
    }

    showShareButton({ text = 'share', shareText } = {}) {
        if (!this.shareButton) {
            return;
        }
        this.clearShareButtonTimeout();
        if (shareText) {
            this.currentShareText = shareText;
        }
        this.shareButton.textContent = text;
        this.shareButton.classList.remove('hidden');
    }

    handleShareButtonClick() {
        if (!this.shareButton || !this.currentShareText || this.shareButton.classList.contains('hidden')) {
            return;
        }
        navigator.clipboard.writeText(this.currentShareText);
        this.shareButton.textContent = 'copied';
        this.clearShareButtonTimeout();
        this.shareButtonResetTimeout = setTimeout(() => {
            if (this.shareButton) {
                this.shareButton.textContent = 'share';
            }
        }, 1000);
    }

    loadSeed(seedString) {
        if (!window.MinesSeed) {
            return;
        }
        const parsed = window.MinesSeed.parseSeed(seedString);
        this.setDifficulty(parsed.mode);
        this.rows = parsed.rows;
        this.cols = parsed.cols;
        this.setupNewGame({
            fromSeed: true,
            beforeRender: () => {
                let mineCount = 0;
                for (let row = 0; row < this.rows; row++) {
                    for (let col = 0; col < this.cols; col++) {
                        const cell = this.grid[row][col];
                        const isMine = Boolean(parsed.layout[row][col]);
                        cell.isMine = isMine;
                        cell.isRevealed = false;
                        cell.isFlagged = false;
                        cell.value = 0;
                        delete cell.isSafe;
                        if (isMine) {
                            mineCount++;
                        }
                    }
                }
                for (let row = 0; row < this.rows; row++) {
                    for (let col = 0; col < this.cols; col++) {
                        if (!this.grid[row][col].isMine) {
                            this.grid[row][col].value = this.countAdjacentMines(row, col);
                        }
                    }
                }
                this.mines = mineCount;
                this.flagsRemaining = this.mines;
                this.seedLockActive = true;
                this.seedStartCell = { row: parsed.startRow, col: parsed.startCol };
                this.currentSeed = parsed.seed;
            }
        });
    }

    isCellLocked(row, col) {
        if (!this.seedLockActive) {
            return false;
        }
        if (!this.seedStartCell) {
            return true;
        }
        return !(row === this.seedStartCell.row && col === this.seedStartCell.col);
    }

    refreshSeedLockState() {
        if (!this.gridElement) {
            return;
        }
        const cells = this.gridElement.querySelectorAll('.cell');
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row, 10);
            const col = parseInt(cell.dataset.col, 10);
            this.updateCellAppearance(cell, row, col);
        });
    }

    prepareSeed(row, col) {
        if (!window.MinesSeed) {
            this.currentSeed = '';
            return;
        }
        this.isSeedLoadedGame = false;
        try {
            this.currentSeed = window.MinesSeed.createSeed({
                mode: this.difficulty,
                grid: this.grid,
                rows: this.rows,
                cols: this.cols,
                startRow: row,
                startCol: col
            });
        } catch (error) {
            this.currentSeed = '';
        }
    }

    initializeGrid() {
        // create empty grid
        this.grid = Array(this.rows).fill().map(() =>
            Array(this.cols).fill().map(() => ({
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                value: 0
            }))
        );
    }

    applyCellPressedStyle(cell) {
        cell.classList.add('pressed');
    }

    clearCellPressedStyle(cell) {
        cell.classList.remove('pressed');
    }

    clearAllPressedStyles() {
        if (!this.gridWrapper) {
            return;
        }
        const pressedCells = this.gridWrapper.querySelectorAll('.cell.pressed');
        pressedCells.forEach(cell => this.clearCellPressedStyle(cell));
    }

    handleGlobalMouseRelease() {
        if (!this.isMouseDown) {
            return;
        }
        this.isMouseDown = false;
        this.mouseDownButton = null;
        this.clearAllPressedStyles();
    }

    bindGridEvents() {
        if (!this.gridElement) {
            return;
        }
        this.gridElement.addEventListener('mousedown', (event) => this.handleGridMouseDown(event));
        this.gridElement.addEventListener('mouseup', (event) => this.handleGridMouseUp(event));
        this.gridElement.addEventListener('contextmenu', (event) => this.handleGridContextMenu(event));
        this.gridElement.addEventListener('mouseover', (event) => this.handleGridMouseOver(event));
        this.gridElement.addEventListener('mouseout', (event) => this.handleGridMouseOut(event));
        this.gridElement.addEventListener('mouseleave', () => this.handleGridMouseLeave());
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
    }

    isInteractiveElementFocused() {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body) {
            return false;
        }
        const tagName = activeElement.tagName;
        if (!tagName) {
            return false;
        }
        const interactiveTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
        if (interactiveTags.includes(tagName)) {
            return true;
        }
        if (activeElement.isContentEditable) {
            return true;
        }
        return false;
    }

    handleKeyDown(event) {
        const interactiveElementFocused = this.isInteractiveElementFocused();

        if (event.code === 'Space') {
            if (interactiveElementFocused || this.gameOver) {
                return;
            }
            const hoveredCell = this.hoveredCell;
            if (!hoveredCell) {
                return;
            }
            const { row, col } = hoveredCell;
            const cell = this.grid[row] && this.grid[row][col];
            if (!cell) {
                return;
            }
            event.preventDefault();
            if (!cell.isRevealed) {
                this.toggleFlag(row, col);
            } else if (cell.value > 0) {
                this.chord(row, col);
            }
            return;
        }

        const isEnterReset = event.code === 'Enter' || event.code === 'NumpadEnter';
        if ((event.code === 'KeyR' || isEnterReset) && !interactiveElementFocused) {
            event.preventDefault();
            this.resetGame();
        }
    }

    getCellFromEvent(event) {
        if (!event || !event.target || !this.gridElement) {
            return null;
        }
        const targetElement = event.target.nodeType === 1 ? event.target : event.target.parentElement;
        if (!targetElement) {
            return null;
        }
        const target = targetElement.closest('.cell');
        if (!target || !this.gridElement.contains(target)) {
            return null;
        }
        return target;
    }

    getCellCoordinates(cellElement) {
        return {
            row: parseInt(cellElement.dataset.row, 10),
            col: parseInt(cellElement.dataset.col, 10)
        };
    }

    handleGridMouseDown(event) {
        const cellElement = this.getCellFromEvent(event);
        if (!cellElement) {
            return;
        }
        const { row, col } = this.getCellCoordinates(cellElement);
        this.hoveredCell = { row, col };
        if (this.isCellLocked(row, col) || this.gameOver) {
            return;
        }
        this.isMouseDown = true;
        this.mouseDownButton = event.button;
        if (event.button !== 2 && !cellElement.classList.contains('revealed')) {
            this.applyCellPressedStyle(cellElement);
        }
        if ((event.button === 1 || event.buttons === 3) && this.grid[row][col].isRevealed) {
            this.chord(row, col);
        }
    }

    handleGridMouseUp(event) {
        const cellElement = this.getCellFromEvent(event);
        if (!cellElement) {
            return;
        }
        const { row, col } = this.getCellCoordinates(cellElement);
        this.clearCellPressedStyle(cellElement);
        if (this.isCellLocked(row, col) || this.gameOver) {
            return;
        }
        if (event.button !== 2 && !this.grid[row][col].isFlagged) {
            this.reveal(row, col);
        }
    }

    handleGridContextMenu(event) {
        const cellElement = this.getCellFromEvent(event);
        if (!cellElement) {
            return;
        }
        event.preventDefault();
        const { row, col } = this.getCellCoordinates(cellElement);
        if (this.isCellLocked(row, col) || this.gameOver) {
            return;
        }
        if (!this.grid[row][col].isRevealed) {
            this.toggleFlag(row, col);
        }
    }

    handleGridMouseOver(event) {
        const cellElement = this.getCellFromEvent(event);
        if (!cellElement) {
            return;
        }
        const { row, col } = this.getCellCoordinates(cellElement);
        this.hoveredCell = { row, col };
        if (this.isCellLocked(row, col) || this.gameOver) {
            return;
        }
        if (this.isMouseDown && this.mouseDownButton !== 2 && !cellElement.classList.contains('revealed')) {
            this.applyCellPressedStyle(cellElement);
        }
    }

    handleGridMouseOut(event) {
        const cellElement = this.getCellFromEvent(event);
        if (!cellElement) {
            return;
        }
        if (!cellElement.classList.contains('revealed')) {
            this.clearCellPressedStyle(cellElement);
        }
        const { row, col } = this.getCellCoordinates(cellElement);
        if (this.hoveredCell && this.hoveredCell.row === row && this.hoveredCell.col === col) {
            this.hoveredCell = null;
        }
    }

    handleGridMouseLeave() {
        this.hoveredCell = null;
        if (this.isMouseDown) {
            this.clearAllPressedStyles();
        }
    }

    renderGrid() {
        if (!this.gridElement) {
            return;
        }
        this.gridElement.innerHTML = '';
        this.gridElement.style.gridTemplateColumns = `repeat(${this.cols}, 2rem)`; // change cell size here
        this.gridElement.style.gridTemplateRows = `repeat(${this.rows}, 2rem)`;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                this.updateCellAppearance(cell, row, col);  
                
                this.gridElement.appendChild(cell);
            }
        }
    }

    forEachNeighbor(row, col, callback, options = {}) {
        const { includeSelf = false } = options;
        for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                if (!includeSelf && r === row && c === col) {
                    continue;
                }
                callback(r, c);
            }
        }
    }
    
    placeMines(firstRow, firstCol) {
        let minesPlaced = 0;
        
        // create island
        this.clearAreaAroundFirstClick(firstRow, firstCol);
        
        while (minesPlaced < this.mines) {
            const row = Math.floor(Math.random() * this.rows);
            const col = Math.floor(Math.random() * this.cols);
            
            // dont place mines in island or ontop of each other
            if (!this.grid[row][col].isSafe && !this.grid[row][col].isMine) {
                this.grid[row][col].isMine = true;
                minesPlaced++;
            }
        }
        
        // calc mine numbers
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.grid[row][col].isMine) {
                    this.grid[row][col].value = this.countAdjacentMines(row, col);
                }
            }
        }
    }
    
    clearAreaAroundFirstClick(row, col) {
        // make island
        this.forEachNeighbor(row, col, (r, c) => {
            this.grid[r][c].isSafe = true;
        }, { includeSelf: true });
    }
    
    countAdjacentMines(row, col) {
        let count = 0;

        this.forEachNeighbor(row, col, (r, c) => {
            if (this.grid[r][c].isMine) {
                count++;
            }
        });
        
        return count;
    }
    
    reveal(row, col) {
        if (this.isCellLocked(row, col)) {
            return;
        }
        // handle first click
        if (this.firstClick) {
            this.firstClick = false;
            if (this.seedLockActive) {
                this.seedLockActive = false;
                this.startTimer();
                this.refreshSeedLockState();
            } else {
                this.placeMines(row, col);
                this.prepareSeed(row, col);
                this.startTimer();
            }
        }

        const cell = this.grid[row][col];
        
        // skip if already revealed or flagged
        if (cell.isRevealed || cell.isFlagged) {
            return;
        }
        
        // reveal cell
        cell.isRevealed = true;
        this.revealed++;
        
        // game over if mine
        if (cell.isMine) {
            this.gameOver = true;
            this.stopTimer();
            this.showResetHintIfFirstTime();
            this.hideGridBorder();
            this.revealAllMines(cell);
            this.showSeedFailureShare();
            return;
        }
        
        // auto-reveal empty cells
        if (cell.value === 0) {
            this.forEachNeighbor(row, col, (r, c) => {
                this.reveal(r, c);
            });
        }
        
        // update the ui
        this.updateCell(row, col);
        
        // check for win
        if (this.revealed === (this.rows * this.cols) - this.mines) {
            this.gameOver = true;
            this.isWin = true;
            this.stopTimer();
            this.showWinPopup();
            this.showResetHintIfFirstTime();
            this.hideGridBorder();
        }
    }
    
    toggleFlag(row, col) {
        if (this.seedLockActive) {
            return;
        }
        if (this.isCellLocked(row, col)) {
            return;
        }
        const cell = this.grid[row][col];

        if (!cell.isRevealed) {
            if (cell.isFlagged) {
                cell.isFlagged = false;
                this.flagsRemaining = Math.min(this.flagsRemaining + 1, this.mines);
            } else {
                cell.isFlagged = true;
                this.flagsRemaining -= 1;
            }
            this.updateCell(row, col);
            this.updateStats();
        }
    }
    
    chord(row, col) {
        const cell = this.grid[row][col];
        if (!cell.isRevealed || cell.value === 0) return;
        
        // count flagged cells around
        let flaggedCount = 0;
        this.forEachNeighbor(row, col, (r, c) => {
            if (this.grid[r][c].isFlagged) {
                flaggedCount++;
            }
        });
        
        // if flags match the number, reveal all non-flagged cells
        if (flaggedCount === cell.value) {
            this.forEachNeighbor(row, col, (r, c) => {
                if (!this.grid[r][c].isRevealed && !this.grid[r][c].isFlagged) {
                    this.reveal(r, c);
                }
            });
        }
    }

    updateCellAppearance(cell, row, col) {
        const cellData = this.grid[row][col];
        
        // first clear existing classes that might be present
        cell.classList.remove('revealed', 'mine', 'flag', 'start-cell', 'locked-cell', 'pressed');
        cell.textContent = '';

        // remove all color classes
        for (let i = 1; i <= 8; i++) {
            cell.classList.remove(`color-${i}`);
        }

        if (this.seedLockActive) {
            if (this.seedStartCell && row === this.seedStartCell.row && col === this.seedStartCell.col) {
                cell.textContent = 'X';
                cell.classList.add('start-cell');
            } else {
                cell.classList.add('locked-cell');
            }
            return;
        }

        if (cellData.isRevealed) {
            cell.classList.add('revealed');
            
            if (cellData.isMine && !cellData.isFlagged) {
                cell.classList.add('mine');
                cell.textContent = 'M';
                cell.classList.add('mine-symbol');
            } else if (cellData.value > 0) {
                cell.textContent = cellData.value;
                cell.classList.add(`color-${cellData.value}`);
            }
        } else if (cellData.isFlagged) {
            cell.classList.add('flag');
            cell.textContent = 'F';
        } else {
            cell.textContent = '';
        }
    }

    updateClickedMineAppearance(cell) {
        cell.classList.add('revealed');
        cell.classList.add('mine');
        cell.textContent = '!';
        cell.classList.add('mine-symbol');
    }

    updateFalseFlagAppearance(cell) {
        cell.textContent = 'X';
        cell.classList.add('false-flag');
    }

    getCellElement(row, col) {
        if (!this.gridElement) {
            return null;
        }
        return this.gridElement.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    }

    updateCell(row, col) {
        const cellElement = this.getCellElement(row, col);
        if (cellElement) {
            this.updateCellAppearance(cellElement, row, col);
        }
    }

    updateClickedMine(row, col) {
        const cellElement = this.getCellElement(row, col);
        if (cellElement) {
            this.updateClickedMineAppearance(cellElement);
        }
    }

    updateFalseFlag(row, col) {
        const cellElement = this.getCellElement(row, col);
        if (cellElement) {
            this.updateFalseFlagAppearance(cellElement);
        }
    }

    revealAllMines(cell) { // and false flags
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.grid[row][col].isMine && this.grid[row][col].isFlagged){
                    this.updateFalseFlag(row, col);
                }
                else if (this.grid[row][col].isMine && !this.grid[row][col].isFlagged) {
                    if (cell != this.grid[row][col]) {
                        this.grid[row][col].isRevealed = true;
                        this.updateCell(row, col);
                    }
                    else {
                        this.grid[row][col].isRevealed = true;
                        this.updateClickedMine(row, col);
                    }
                }
            }
        }
    }
    
    startTimer() {
        this.stopTimer(); // stop any existing timer
        this.timer = 0;
        const timerEl = this.timerElement;
        if (!timerEl) {
            return;
        }
        timerEl.textContent = this.formatTime(this.timer);
        this.showTimer();
        
        this.timerInterval = setInterval(() => {
            if (this.timer >= this.maxTimerSeconds) {
                this.timer = this.maxTimerSeconds;
                timerEl.textContent = this.formatTime(this.timer);
                this.stopTimer();
                return;
            }

            this.timer++;
            timerEl.textContent = this.formatTime(this.timer);
            
            if (this.timer >= this.maxTimerSeconds) {
                this.stopTimer();
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    getDifficultyLabel() {
        switch (this.difficulty) {
            case 'easy':
                return 'E';
            case 'medium':
                return 'M';
            case 'hard':
                return 'H';
            default:
                return this.difficulty.charAt(0).toUpperCase();
        }
    }

    buildShareText({ result = 'win' } = {}) {
        const timerValue = this.formatTime(this.timer);
        const difficultyLabel = this.getDifficultyLabel();
        const statusLine = result === 'fail' ? `X, ${timerValue}` : timerValue;
        let shareText = `MINES_${difficultyLabel}\n${statusLine}`;
        if (this.currentSeed) {
            shareText += `\nhttps://othertab.com/mines/?${this.currentSeed}`;
        }
        return shareText;
    }

    showWinPopup(){
        if (!this.shareButton) {
            return;
        }
        const shareText = this.buildShareText({ result: 'win' });
        this.showShareButton({ shareText });
    }

    showSeedFailureShare() {
        if (!this.shareButton || !this.isSeedLoadedGame || !this.currentSeed) {
            return;
        }
        const shareText = this.buildShareText({ result: 'fail' });
        this.showShareButton({ shareText });
    }

    showResetHintIfFirstTime() {
        if (!this.resetHintElement) {
            return;
        }
        const hasCompletedFirstGame = localStorage.getItem(this.firstGameStorageKey);
        if (!hasCompletedFirstGame) {
            if (this.isSeedLoadedGame) {
                localStorage.setItem(this.firstGameStorageKey, 'true');
                return;
            }
            this.resetHintElement.textContent = 'press r, ↵, or click the reset button to reset.';
            this.resetHintElement.classList.remove('hidden');
            localStorage.setItem(this.firstGameStorageKey, 'true');
        }
    }

    hideResetHint() {
        if (!this.resetHintElement) {
            return;
        }
        this.resetHintElement.textContent = '';
        this.resetHintElement.classList.add('hidden');
    }

    hideGridBorder() {
        if (this.gridWrapper) {
            this.gridWrapper.classList.add('board-finished');
        }
    }

    showGridBorder() {
        if (this.gridWrapper) {
            this.gridWrapper.classList.remove('board-finished');
        }
    }

    isModePanelOpen() {
        if (!this.modePanel) {
            return false;
        }
        return !this.modePanel.classList.contains('hidden');
    }

    openModePanel() {
        if (this.modePanel) {
            this.modePanel.classList.remove('hidden');
            this.modePanel.setAttribute('aria-hidden', 'false');
        }
        if (this.modeButton) {
            this.modeButton.setAttribute('aria-expanded', 'true');
        }
    }

    closeModePanel() {
        if (this.modePanel) {
            this.modePanel.classList.add('hidden');
            this.modePanel.setAttribute('aria-hidden', 'true');
        }
        if (this.modeButton) {
            this.modeButton.setAttribute('aria-expanded', 'false');
        }
    }

    clearSeedFromUrl() {
        if (!window.location || !window.history || !window.history.replaceState) {
            return;
        }
        const hasSeedQuery = Boolean(window.location.search);
        if (!hasSeedQuery) {
            return;
        }
        const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
        window.history.replaceState(null, '', cleanUrl);
    }

    resetGame() {
        this.setupNewGame();
    }
}

function getSeedFromLocation() {
    const search = window.location.search || '';
    if (search.startsWith('?') && search.length > 1) {
        const params = new URLSearchParams(search);
        const seedParam = params.get('seed') || params.get('s');
        if (seedParam) {
            return seedParam;
        }
        const rawSeed = search.slice(1);
        if (!rawSeed.includes('=') && !rawSeed.includes('&')) {
            return decodeURIComponent(rawSeed);
        }
    }
    const pathSegments = (window.location.pathname || '')
        .split('/')
        .filter(Boolean);
    const minesSegmentIndex = pathSegments.indexOf('mines');
    if (minesSegmentIndex === -1) {
        return '';
    }
    const trailingSegments = pathSegments.slice(minesSegmentIndex + 1);
    if (!trailingSegments.length) {
        return '';
    }
    return decodeURIComponent(trailingSegments.join('/'));
}

// initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('js-loading');
    const game = new Minesweeper();
    const seedString = getSeedFromLocation();
    if (seedString) {
        try {
            game.loadSeed(seedString);
        } catch (error) {
            console.error('failed to load mines seed from URL', error);
        }
    }
});
