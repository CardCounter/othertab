// dark mode toggle
const darkToggleButton = document.getElementById('dark-toggle');

darkToggleButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    darkToggleButton.textContent = isDark ? 'l_m' : 'd_m';
    
    // store dark mode in local storage        
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
});

// check for dark mode settings on load
document.addEventListener('DOMContentLoaded', () => {
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
        darkToggleButton.textContent = 'l_m';
    }
});

class Minesweeper {
    constructor() {
        this.difficulty = 'hard'; // default starting difficulty
        document.getElementById(this.difficulty).classList.add('active');
        this.setDifficultySettings(this.difficulty);
        
        this.grid = [];
        this.revealed = 0;
        this.gameOver = false;
        this.firstClick = true;
        this.flagsRemaining = this.mines;
        this.timer = 0;
        this.timerInterval = null;
        this.maxTimerSeconds = (99 * 3600) + (59 * 60) + 59;
        this.gameContainer = document.getElementById('game-container');
        this.isWin = false;
        this.isMouseDown = false;
        this.currentShareText = '';
        this.currentSeed = '';
        this.isSeedLoadedGame = false;
        this.seedLockActive = false;
        this.seedStartCell = null;
        this.shareButton = document.getElementById('copy-button');
        this.shareButtonResetTimeout = null;
        if (this.shareButton) {
            this.shareButton.onclick = () => {
                if (!this.currentShareText || this.shareButton.classList.contains('hidden')) {
                    return;
                }

                navigator.clipboard.writeText(this.currentShareText);
                this.shareButton.textContent = 'copied';
                if (this.shareButtonResetTimeout) {
                    clearTimeout(this.shareButtonResetTimeout);
                }
                this.shareButtonResetTimeout = setTimeout(() => {
                    if (this.shareButton) {
                        this.shareButton.textContent = 'share';
                    }
                }, 1000);
            };
        }

        this.loadButton = document.getElementById('load-button');
        this.loadPanel = document.getElementById('load-panel');
        this.seedInput = document.getElementById('seed-input');

        this.modeButton = document.getElementById('mode-button');
        this.modePanel = document.getElementById('mode-panel');
        if (this.modeButton && this.modePanel) {
            this.modeButton.addEventListener('click', () => {
                const isHidden = this.modePanel.classList.toggle('hidden');
                this.modeButton.setAttribute('aria-expanded', (!isHidden).toString());
                this.modePanel.setAttribute('aria-hidden', isHidden.toString());
            });

            document.addEventListener('click', (event) => {
                if (!this.modePanel || this.modePanel.classList.contains('hidden')) {
                    return;
                }
                const target = event.target;
                if (this.modePanel.contains(target) || this.modeButton.contains(target)) {
                    return;
                }
                this.modePanel.classList.add('hidden');
                this.modeButton.setAttribute('aria-expanded', 'false');
                this.modePanel.setAttribute('aria-hidden', 'true');
            });
        }
        
        this.initializeGrid();
        this.renderGrid();
        this.updateStats();
        this.initializeLoadControls();

        // difficulty buttons
        const difficultyButtons = document.querySelectorAll('.difficulty-button');
        difficultyButtons.forEach(button => {
            button.addEventListener('click', () => {
                // reset all to active state
                difficultyButtons.forEach(btn => btn.classList.remove('active'));
                
                // add active state for chosen button
                button.classList.add('active');
                
                // set difficulty and reset game
                this.difficulty = button.id;
                this.setDifficultySettings(this.difficulty);
                this.resetGame();
                if (this.modePanel && this.modeButton) {
                    this.modePanel.classList.add('hidden');
                    this.modeButton.setAttribute('aria-expanded', 'false');
                    this.modePanel.setAttribute('aria-hidden', 'true');
                }
            });
        });

        // new game button
        document.getElementById('new-game').addEventListener('click', () => {
            this.resetGame();
        });

        // functionality for space, reset keys
        document.addEventListener('keydown', (e) => {
            if ((e.code === 'Space')) { // && !this.gameOver
                e.preventDefault();   
                if (!this.gameOver){
                    const hoveredCell = document.querySelector('.cell:hover');

                    if (hoveredCell) {
                        const row = parseInt(hoveredCell.dataset.row);
                        const col = parseInt(hoveredCell.dataset.col);
                        
                        if (!this.grid[row][col].isRevealed) {
                            this.toggleFlag(row, col);
                        } 
                        
                        else if (this.grid[row][col].value > 0) {
                            this.chord(row, col);
                        }
                    }
                }
            }
                
            // reset game with `
            if (e.code === 'Backquote') {
                this.resetGame();
            }

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

    updateStats() {
        document.getElementById('flag-count').textContent = this.flagsRemaining;
        document.getElementById('timer').textContent = this.formatTime(this.timer);
    }

    initializeLoadControls() {
        if (!this.loadButton || !this.loadPanel || !this.seedInput) {
            return;
        }

        const hidePanel = () => {
            this.loadPanel.classList.add('hidden');
            this.loadPanel.setAttribute('aria-hidden', 'true');
            this.loadButton.setAttribute('aria-expanded', 'false');
            this.seedInput.value = '';
        };

        const showPanel = () => {
            this.loadPanel.classList.remove('hidden');
            this.loadPanel.setAttribute('aria-hidden', 'false');
            this.loadButton.setAttribute('aria-expanded', 'true');
            try {
                this.seedInput.focus({ preventScroll: true });
            } catch (_) {
                this.seedInput.focus();
            }
        };

        hidePanel();

        let suppressNextOpen = false;
        const markToggleIntent = () => {
            suppressNextOpen = !this.loadPanel.classList.contains('hidden');
        };

        this.loadButton.addEventListener('pointerdown', markToggleIntent);
        this.loadButton.addEventListener('mousedown', markToggleIntent);
        this.loadButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                markToggleIntent();
            }
        });

        this.loadButton.addEventListener('click', () => {
            if (suppressNextOpen) {
                suppressNextOpen = false;
                hidePanel();
                return;
            }
            const isHidden = this.loadPanel.classList.contains('hidden');
            if (isHidden) {
                showPanel();
            } else {
                hidePanel();
            }
            if (this.modePanel) {
                this.modePanel.classList.add('hidden');
                this.modePanel.setAttribute('aria-hidden', 'true');
            }
            if (this.modeButton) {
                this.modeButton.setAttribute('aria-expanded', 'false');
            }
        });

        this.seedInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const seedStr = this.seedInput.value.trim();
                if (!seedStr) {
                    hidePanel();
                    return;
                }
                try {
                    this.loadSeed(seedStr);
                    hidePanel();
                } catch (error) {
                    return;
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                hidePanel();
            }
        });

        this.seedInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.loadPanel && !this.loadPanel.contains(document.activeElement)) {
                    hidePanel();
                }
            }, 0);
        });

        document.addEventListener('click', (event) => {
            if (!this.loadPanel || this.loadPanel.classList.contains('hidden')) {
                return;
            }
            const target = event.target;
            if (this.loadPanel.contains(target) || this.loadButton.contains(target)) {
                return;
            }
            hidePanel();
        });
    }

    loadSeed(seedString) {
        if (!window.MinesSeed) {
            return;
        }
        const parsed = window.MinesSeed.parseSeed(seedString);
        this.stopTimer();
        this.difficulty = parsed.mode;
        this.setDifficultySettings(this.difficulty);
        document.querySelectorAll('.difficulty-button').forEach(btn => btn.classList.remove('active'));
        const difficultyButton = document.getElementById(this.difficulty);
        if (difficultyButton) {
            difficultyButton.classList.add('active');
        }

        this.rows = parsed.rows;
        this.cols = parsed.cols;
        this.initializeGrid();
        let mineCount = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const isMine = parsed.layout[row][col];
                if (isMine) {
                    this.grid[row][col].isMine = true;
                    mineCount++;
                } else {
                    this.grid[row][col].isMine = false;
                }
                this.grid[row][col].isRevealed = false;
                this.grid[row][col].isFlagged = false;
                this.grid[row][col].value = 0;
                delete this.grid[row][col].isSafe;
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
        this.revealed = 0;
        this.gameOver = false;
        this.firstClick = true;
        this.isWin = false;
        this.isSeedLoadedGame = true;
        this.seedLockActive = true;
        this.seedStartCell = { row: parsed.startRow, col: parsed.startCol };
        this.currentSeed = parsed.seed;
        this.currentShareText = '';

        this.timer = 0;
        document.getElementById('timer').textContent = this.formatTime(this.timer);

        if (this.shareButton) {
            this.shareButton.textContent = 'share';
            this.shareButton.classList.add('hidden');
        }
        if (this.shareButtonResetTimeout) {
            clearTimeout(this.shareButtonResetTimeout);
            this.shareButtonResetTimeout = null;
        }

        this.renderGrid();
        this.updateStats();
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
        const cells = document.querySelectorAll('.cell');
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

    renderGrid() {
        const gridElement = document.getElementById('grid');
        gridElement.innerHTML = '';
        gridElement.style.gridTemplateColumns = `repeat(${this.cols}, 30px)`; // change cell size here
        gridElement.style.gridTemplateRows = `repeat(${this.rows}, 30px)`;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // middle click or both buttons for chord
                cell.addEventListener('mousedown', (e) => {
                    if (this.isCellLocked(row, col) || this.gameOver) {
                        return;
                    }
                    this.isMouseDown = true;
                    if (!(e.button == 2)){
                        if (!cell.classList.contains('revealed')) {
                            cell.style.backgroundColor = '#999999';
                        }
                    }

                    // middle click or left right, note button vs buttons
                    if ((e.button === 1 || (e.buttons === 3)) && this.grid[row][col].isRevealed) {
                        this.chord(row, col);
                    }
                });

                cell.addEventListener('mouseup', (e) => {
                    this.isMouseDown = false;
                    if (this.isCellLocked(row, col) || this.gameOver) {
                        return;
                    }
                    if (!(e.button == 2)){
                        if (!cell.classList.contains('revealed')) {
                            cell.style.backgroundColor = '';
                        }

                        if (!this.grid[row][col].isFlagged) {
                            this.reveal(row, col);
                        }
                    }
                });

                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (this.isCellLocked(row, col) || this.gameOver) {
                        return;
                    }
                    if (!this.grid[row][col].isRevealed) {
                        this.toggleFlag(row, col);
                    }
                });

                cell.addEventListener('mouseover', () => {
                    if (this.isCellLocked(row, col) || this.gameOver) {
                        return;
                    }
                    if (this.isMouseDown && !cell.classList.contains('revealed')) {
                        cell.style.backgroundColor = '#999999';
                    }

                });
                
                // fix for the hover state bug, force reset of style when mouse leaves
                cell.addEventListener('mouseleave', () => { 
                    if (!cell.classList.contains('revealed')) {
                        cell.style.backgroundColor = '';
                    }

                });

                this.updateCellAppearance(cell, row, col);  
                
                gridElement.appendChild(cell);
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
        for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                this.grid[r][c].isSafe = true;
            }
        }
    }
    
    countAdjacentMines(row, col) {
        let count = 0;
        
        for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                if (this.grid[r][c].isMine) {
                    count++;
                }
            }
        }
        
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
            this.revealAllMines(cell);
            return;
        }
        
        // auto-reveal empty cells
        if (cell.value === 0) {
            for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
                for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                    if (r !== row || c !== col) {
                        this.reveal(r, c);
                    }
                }
            }
        }
        
        // update the ui
        this.updateCell(row, col);
        
        // check for win
        if (this.revealed === (this.rows * this.cols) - this.mines) {
            this.gameOver = true;
            this.isWin = true;
            this.stopTimer();
            this.showWinPopup();
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
        for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                if (this.grid[r][c].isFlagged) {
                    flaggedCount++;
                }
            }
        }
        
        // if flags match the number, reveal all non-flagged cells
        if (flaggedCount === cell.value) {
            for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
                for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                    if (!this.grid[r][c].isRevealed && !this.grid[r][c].isFlagged) {
                        this.reveal(r, c);
                    }
                }
            }
        }
    }

    updateCellAppearance(cell, row, col) {
        const cellData = this.grid[row][col];
        
        // first clear existing classes that might be present
        cell.classList.remove('revealed', 'mine', 'flag', 'start-cell', 'locked-cell');
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
    
    updateCell(row, col) {
        const cellElement = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cellElement) {
            this.updateCellAppearance(cellElement, row, col);
        }
    }

    updateClickedMine(row, col) {
        const cellElement = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cellElement) {
            this.updateClickedMineAppearance(cellElement);
        }
    }

    updateFalseFlag(row, col) {
        const cellElement = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
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
        document.getElementById('timer').textContent = this.formatTime(this.timer);
        
        this.timerInterval = setInterval(() => {
            if (this.timer >= this.maxTimerSeconds) {
                this.timer = this.maxTimerSeconds;
                document.getElementById('timer').textContent = this.formatTime(this.timer);
                this.stopTimer();
                return;
            }

            this.timer++;
            document.getElementById('timer').textContent = this.formatTime(this.timer);
            
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

    showWinPopup(){
        if (!this.shareButton) {
            return;
        }
        const timerValue = this.formatTime(this.timer);

        const difficultyLabel = (() => {
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
        })();

        let shareText = `MINES_${difficultyLabel} => ${timerValue}`;
        if (this.currentSeed) {
            shareText += `\n${this.currentSeed}`;
        }
        this.currentShareText = shareText;
        if (this.shareButtonResetTimeout) {
            clearTimeout(this.shareButtonResetTimeout);
            this.shareButtonResetTimeout = null;
        }
        this.shareButton.textContent = 'share';
        this.shareButton.classList.remove('hidden');
    }
    
    resetGame() {
        this.stopTimer();
        this.setDifficultySettings(this.difficulty);
        this.grid = [];
        this.revealed = 0;
        this.gameOver = false;
        this.firstClick = true;
        this.isSeedLoadedGame = false;
        this.seedLockActive = false;
        this.seedStartCell = null;
        this.currentSeed = '';
        this.flagsRemaining = this.mines;
        this.timer = 0;
        this.isWin = false;

        // reset timer display
        document.getElementById('timer').textContent = this.formatTime(this.timer);

        // reset share button
        if (this.shareButton) {
            this.shareButton.textContent = 'share';
            this.shareButton.classList.add('hidden');
        }
        this.currentShareText = '';
        if (this.shareButtonResetTimeout) {
            clearTimeout(this.shareButtonResetTimeout);
            this.shareButtonResetTimeout = null;
        }

        this.initializeGrid();
        this.renderGrid();
        this.updateStats();
    }
}

// initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('js-loading');
    const game = new Minesweeper();
});
