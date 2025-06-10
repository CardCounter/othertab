class Nono {
    constructor() {
        this.grid = [];
        this.rows = 10;
        this.cols = 10;

        this.isMouseDown - false;
        
        this.initializeGrid();
        this.renderGrid();
    }

    initializeGrid() {
        this.grid = Array(this.rows).fill().map(() => 
            Array(this.cols).fill().map(() => ({
                isOn: false,
                isOff: false,
                isMarked: false
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
                cell.addEventListener('mousedown', (e) => { // change these to css styles, blank, on, off, marked
                    this.isMouseDown = true;
                    if (e.button == 0){
                        if (cell.style.backgroundColor === 'blue') cell.style.backgroundColor = 'white';
                        else {cell.style.backgroundColor = 'blue';}
                    }
                    if (e.button == 1){
                        if (cell.style.backgroundColor === 'black') cell.style.backgroundColor = 'white';
                        else {cell.style.backgroundColor = 'black';}
                    }
                    if (e.button == 2){
                        if (cell.style.backgroundColor === 'grey') cell.style.backgroundColor = 'white';
                        else {cell.style.backgroundColor = 'grey';}
                    }
                });
                
                cell.addEventListener('mouseup', (e) => {
                    this.isMouseDown = false;
                });
                
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                });

                cell.addEventListener('mouseover', (e) => { 
                    if (this.isMouseDown){
                        if (e.buttons & 1){
                            if (cell.style.backgroundColor === 'blue') cell.style.backgroundColor = 'white';
                            else {cell.style.backgroundColor = 'blue';}
                        }
                        else if (e.buttons & 4){ ////// look up why this works again
                            if (cell.style.backgroundColor === 'black') cell.style.backgroundColor = 'white';
                            else {cell.style.backgroundColor = 'black';}
                        }
                        else if (e.buttons & 2){
                            if (cell.style.backgroundColor === 'grey') cell.style.backgroundColor = 'white';
                            else {cell.style.backgroundColor = 'grey';}
                        }
                    }

                });
                
                // add fix for when mouse leave grid, reset dont keep drawing if re enter without 
                window.addEventListener('mouseup', () => {
                    this.isMouseDown = false;
                });

                // this.updateCellAppearance(cell, row, col);  
                
                gridElement.appendChild(cell);
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const paper = new Nono();
});