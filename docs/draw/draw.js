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

class Draw {
    constructor() {
        this.grid = [];
        // this.CanvasContainer = document.getElementById('canvas');
        this.isMouseDown = false;
        this.rows = 32;
        this.cols = 32;

        this.initializeGrid();
        this.renderGrid();

        document.addEventListener('keydown', (e) => {
            // reset game, e, r   
            if (e.code === 'KeyR' || e.code === 'KeyE' || e.code === 'KeyW') {
                this.resetGame();
            } 
        });
    }

    initializeGrid() {
        // create empty grid
        this.grid = Array(this.rows).fill().map(() => 
            Array(this.cols).fill().map(() => ({
                // redValue: 256,
                // greenValue: 256,
                // blueValue: 256,
                // alphaValue: 1
            }))
        );
    }

    renderGrid() {
        const gridElement = document.getElementById('canvas');
        gridElement.innerHTML = '';
        gridElement.style.gridTemplateColumns = `repeat(${this.cols}, 20px)`; // change cell size here
        gridElement.style.gridTemplateRows = `repeat(${this.rows}, 20px)`;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'pixel';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // middle click or both buttons for chord
                cell.addEventListener('mousedown', (e) => {
                    this.isMouseDown = true;
                    if (e.button === 0){
                        cell.style.backgroundColor = 'black';
                    }

                    // middle click or left right
                    if (e.button === 3){
                        cell.style.backgroundColor = 'grey';
                    }
                });
                
                cell.addEventListener('mouseup', (e) => {
                    this.isMouseDown = false;
                    // if (!(e.button == 2)){
                    //     if (!cell.classList.contains('revealed')) {
                    //         cell.style.backgroundColor = '';
                    //     }

                    //     if (!this.gameOver && !this.grid[row][col].isFlagged) {
                    //         this.reveal(row, col);
                    //     }
                    // }
                });
                
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    // if (!this.gameOver && !this.grid[row][col].isRevealed) {
                    //     this.toggleFlag(row, col);
                    // }
                    cell.style.backgroundColor = 'grey';
                });

                cell.addEventListener('mouseover', () => { 
                    if (this.isMouseDown) {
                        cell.style.backgroundColor = 'black';
                    }

                });
                
                // fix for the hover state bug, force reset of style when mouse leaves
                // cell.addEventListener('mouseleave', () => { 
                //     if (!cell.classList.contains('revealed')) {
                //         cell.style.backgroundColor = '';
                //     }

                // });

                // this.updateCellAppearance(cell, row, col);  
                
                gridElement.appendChild(cell);
            }
        }
    }

    // updateCellAppearance(cell, row, col) {
    //     const cellData = this.grid[row][col];
        
    //     // first clear existing classes that might be present
    //     cell.classList.remove('revealed', 'mine', 'flag');
    //     cell.textContent = '';
        
    //     // remove all color classes
    //     for (let i = 1; i <= 8; i++) {
    //         cell.classList.remove(`color-${i}`);
    //     }
        
    //     if (cellData.isRevealed) {
    //         cell.classList.add('revealed');
            
    //         if (cellData.isMine && !cellData.isFlagged) {
    //             cell.classList.add('mine');
    //             cell.textContent = 'M';
    //             cell.classList.add('mine-symbol');
    //         } else if (cellData.value > 0) {
    //             cell.textContent = cellData.value;
    //             cell.classList.add(`color-${cellData.value}`);
    //         }
    //     } else if (cellData.isFlagged) {
    //         cell.classList.add('flag');
    //         cell.textContent = 'F';
    //     } else {
    //         cell.textContent = '';
    //     }
    // }

    resetGame() {
        this.grid = [];
        
        this.initializeGrid();
        this.renderGrid();
    }

}

// initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    const paper = new Draw();
});