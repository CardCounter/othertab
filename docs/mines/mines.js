// dark mode toggle
const darkToggleButton = document.getElementById('dark-toggle');

darkToggleButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    darkToggleButton.textContent = isDark ? 'light mode' : 'dark mode';
    
    // store dark mode in local storage        
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
});

// check for dark mode settings on load
document.addEventListener('DOMContentLoaded', () => {
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
        darkToggleButton.textContent = 'light mode';
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
        this.flagCount = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.gameContainer = document.getElementById('game-container');
        this.isWin = false;
        this.isMouseDown = false;
        this.isAutoResetOn = false;
        
        this.initializeGrid();
        this.renderGrid();
        this.updateStats();

        this.timeNumbers = {
            0:'⓪',
            1:'①',
            2:'②',
            3:'③',
            4:'④',
            5:'⑤',
            6:'⑥',
            7:'⑦',
            8:'⑧',
            9:'⑨',
            10:'⑩',
            11:'⑪',
            12:'⑫',
            13:'⑬',
            14:'⑭',
            15:'⑮',
            16:'⑯',
            17:'⑰',
            18:'⑱',
            19:'⑲',
            20:'⑳',
        };
        this.timeDigits = {
            0:'⓪',
            1:'①',
            2:'②',
            3:'③',
            4:'④',
            5:'⑤',
            6:'⑥',
            7:'⑦',
            8:'⑧',
            9:'⑨',
        };

        // difficulty buttons
        const difficultyButtons = document.querySelectorAll('.difficulty');
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
            });
        });

        // new game button
        document.getElementById('new-game').addEventListener('click', () => {
            this.resetGame();
        });

        // auto reset toggle
        document.getElementById('auto-restart-mode').addEventListener('input', () => {
            this.isAutoResetOn = document.getElementById('auto-restart-mode').checked;
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
                
            // reset game, e, r   
            if (e.code === 'KeyR' || e.code === 'KeyE' || e.code === 'KeyW') {
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
        document.getElementById('mine-count').textContent = this.mines;
        document.getElementById('flag-count').textContent = this.flagCount;
        document.getElementById('timer').textContent = this.timer;
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
                    this.isMouseDown = true;
                    if (!(e.button == 2)){
                        if (!cell.classList.contains('revealed') && !this.gameOver) {
                            cell.style.backgroundColor = '#999999';
                        }
                    }

                    // middle click or left right
                    if ((e.button === 1 || (e.buttons === 3)) && !this.gameOver && this.grid[row][col].isRevealed) {
                        this.chord(row, col);
                    } 
                });
                
                cell.addEventListener('mouseup', (e) => {
                    this.isMouseDown = false;
                    if (!(e.button == 2)){
                        if (!cell.classList.contains('revealed')) {
                            cell.style.backgroundColor = '';
                        }

                        if (!this.gameOver && !this.grid[row][col].isFlagged) {
                            this.reveal(row, col);
                        }
                    }
                });
                
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (!this.gameOver && !this.grid[row][col].isRevealed) {
                        this.toggleFlag(row, col);
                    }
                });

                cell.addEventListener('mouseover', () => { 
                    if (this.isMouseDown && !cell.classList.contains('revealed') && !this.gameOver) {
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
        for (let r = Math.max(0, row - 2); r <= Math.min(this.rows - 1, row + 2); r++) {
            for (let c = Math.max(0, col - 2); c <= Math.min(this.cols - 1, col + 2); c++) {
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
        // handle first click
        if (this.firstClick) {
            this.firstClick = false;
            this.placeMines(row, col);
            this.startTimer();
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
            this.showLoseIndicator();
            if (this.isAutoResetOn) {
                setTimeout(() => {
                    this.resetGame();
                }, 100);
            }
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
            this.showWinIndicator();
            this.showWinPopup();
        }
    }
    
    toggleFlag(row, col) {
        const cell = this.grid[row][col];
        
        if (!cell.isRevealed) {
            cell.isFlagged = !cell.isFlagged;
            this.flagCount += cell.isFlagged ? 1 : -1;
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
        cell.classList.remove('revealed', 'mine', 'flag');
        cell.textContent = '';
        
        // remove all color classes
        for (let i = 1; i <= 8; i++) {
            cell.classList.remove(`color-${i}`);
        }
        
        if (cellData.isRevealed) {
            cell.classList.add('revealed');
            
            if (cellData.isMine && !cellData.isFlagged) { /////////////////////////// here to add red X for missed flags, 
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
            // if (this.gameOver && !(cellData.isMine)){
            //     cell.classList.remove('flag');
            //     cell.classList.add('false-flag');
            //     cell.textContent = 'X';
            // }
            
            // // change flagged cells to dollar signs when winning
            // if (this.isWin) {
            //     cell.textContent = '$';
            //     cell.classList.add('win-symbol');
            // }
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

    revealAllMines(cell) { /// and false flags
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
    
    convertFlagsToWinSymbols() { //////// modify this for flag X
        // update all flagged cells to show dollar signs
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col].isFlagged) {
                    this.updateCell(row, col);
                }
            }
        }
    }
    
    startTimer() {
        this.stopTimer(); // stop any existing timer
        this.timer = 0;
        document.getElementById('timer').textContent = this.timer;
        
        this.timerInterval = setInterval(() => {
            if (this.timer < 999){
                this.timer++;
                document.getElementById('timer').textContent = this.timer;
            }
            else {
                clearInterval(this.timerInterval);
            }   
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    showWinIndicator() {
        // change border to green for win
        this.gameContainer.classList.add('win-border');
    }

    showLoseIndicator() {
        // change border to red for loss
        this.gameContainer.classList.add('lose-border');
    }

    // Inside your Minesweeper class, when win condition is met:
    showWinPopup(){
        // Get the popup element
        const popup = document.getElementById('win-popup');
        let timerValue;
        let goodTime = '';

        if (this.difficulty == 'easy' && this.timer <= 6){
            goodTime = '!';
        }
        else if (this.difficulty == 'medium' && this.timer <= 60){
            goodTime = '!';
        }
        else if (this.difficulty == 'hard' && this.timer <= 100){
            goodTime = '!';
        }

        if (this.timer <= 21){
            timerValue = this.timeNumbers[this.timer];
        }
        else {
            let currentNum = this.timer;
            const finalTime = [];
            while(currentNum > 0){
                let digit = currentNum % 10;
                finalTime.unshift(this.timeDigits[digit]);
                currentNum = Math.floor(currentNum / 10);
            }
            timerValue = finalTime.join('')
        }
        
        popup.innerHTML = `
        <p>
        MINES<br>
        ${this.difficulty.toUpperCase()}<br>
        ${timerValue}${goodTime}<br>
        o_t
        </p>
            `;
            
        // display popup by adding hidden class, removing active
        popup.classList.remove('hidden');
        // popup.classList.add('active');
    }
    
    resetGame() {
        this.stopTimer();
        this.grid = [];
        this.revealed = 0;
        this.gameOver = false;
        this.firstClick = true;
        this.flagCount = 0;
        this.timer = 0;
        this.isWin = false;
        
        // reset timer display
        document.getElementById('timer').textContent = this.timer;
        
        // remove win/lose border indicators
        this.gameContainer.classList.remove('win-border');
        this.gameContainer.classList.remove('lose-border');

        const win_popup = document.getElementById('win-popup');
        // win_popup.classList.remove('active');
        win_popup.classList.add('hidden');
        
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