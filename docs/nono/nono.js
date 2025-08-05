// settings panel 
document.addEventListener('DOMContentLoaded', () => {
    const settingsButton = document.getElementById('settings-button');
    const settingsPanel = document.getElementById('settings-panel');

    settingsButton.addEventListener('click', (e) => {
        settingsPanel.classList.toggle('hidden');
        e.stopPropagation(); 
    });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsButton) {
            settingsPanel.classList.add('hidden');
        }
    });

    document.addEventListener('contextmenu', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsButton) {
            settingsPanel.classList.add('hidden');
        }
    });

    settingsPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

});

class Nono {
    handleIfActive(callback) {
        if (!this.isGameOver) callback();
    }

    constructor() {
        // get size
        if (localStorage.getItem('NONO-currentSize')){
            this.sizeMode = localStorage.getItem('NONO-currentSize');
        }
        else{
            this.sizeMode = 'difficulty-15';
        }
        
        document.getElementById(this.sizeMode).classList.add('active');
        this.size = Number(document.getElementById(this.sizeMode).dataset.size);
        document.documentElement.style.setProperty('--num-font-size', document.getElementById(this.sizeMode).dataset.font);

        const sizeButtons = document.querySelectorAll('.difficulty-button');
        sizeButtons.forEach(button => {
            button.addEventListener('click', () => {
                // reset all to active state
                sizeButtons.forEach(btn => btn.classList.remove('active'));
                
                // add active state for chosen button
                button.classList.add('active');
                
                // set difficulty and reset game
                this.sizeMode = button.id;
                localStorage.setItem('NONO-currentSize', button.id);
                this.size = Number(document.getElementById(this.sizeMode).dataset.size);
                document.documentElement.style.setProperty('--num-font-size', document.getElementById(this.sizeMode).dataset.font);

                this.reset();

            });
        });

        this.possibleLayout = this.getLayout(this.size);
        this.numActivatedCellsMaster = this.getNumActivatedCells(this.possibleLayout);
        this.numActivatedCells = 0;
        [this.topNums, this.sideNums] = this.getNums();

        this.hoveredCell = null;
        this.isActionDown = false;
        this.lastAction = null;
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);
        this.actionedCols = new Set();
        this.actionedRows = new Set();

        this.firstKey = true;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;

        this.initializeTable();
        this.syncTableSizes();
        this.mainGameActions();
        this.mainKeyActions();
    }

    reset() {
        this.stopTimer();
        this.possibleLayout = this.getLayout(this.size);
        this.numActivatedCellsMaster = this.getNumActivatedCells(this.possibleLayout);
        this.numActivatedCells = 0;

        let t1;
        let t2
        [t1, t2] = this.getNums();
        this.topNums = t1;
        this.sideNums = t2;

        this.hoveredCell = null;
        this.isActionDown = false;
        this.lastAction = null;
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);
        this.actionedCols = new Set();
        this.actionedRows = new Set();

        this.firstKey = true;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;

        const shareButton = document.getElementById('copy-button');
        if (shareButton) {
            shareButton.textContent = 'share';
            shareButton.onclick = null;
            shareButton.classList.add('hidden');
        }

        const timerElement = document.getElementById('timer');
        if (timerElement) timerElement.textContent = '0:00';

        const popup = document.getElementById('win-paste');
        if (popup) popup.classList.add('hidden');

        this.initializeTable();
        this.syncTableSizes();
        this.mainGameActions();
        
    }

    mainGameActions(){
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                this.handleIfActive(() => {
                    if (this.hoveredCell === cell) return;
                    this.hoveredCell = cell;

                    const row = cell.dataset.row;
                    const col = cell.dataset.col;

                    document.querySelectorAll('.top').forEach(topCell => {
                        if (topCell.dataset.col === col) {
                            topCell.classList.add('highlight');
                        }
                    });

                    document.querySelectorAll('.side').forEach(sideCell => {
                        if (sideCell.dataset.row === row) {
                            sideCell.classList.add('highlight');
                        }
                    });

                    // drag option across here
                    if (this.isActionDown) {
                        this.applyLastAction();
                        this.updateCell()
                    }
                });
            });

            cell.addEventListener('mouseleave', () => {
                this.handleIfActive(() => {
                    this.hoveredCell = null;

                    const row = cell.dataset.row;
                    const col = cell.dataset.col;

                    document.querySelectorAll('.top').forEach(topCell => {
                        if (topCell.dataset.col === col) {
                            topCell.classList.remove('highlight');
                        }
                    });

                    document.querySelectorAll('.side').forEach(sideCell => {
                        if (sideCell.dataset.row === row) {
                            sideCell.classList.remove('highlight');
                        }
                    });
                });
            });

            cell.addEventListener('mousedown', (e) => {
                this.handleIfActive(() => {
                    this.handleClick(e); // dont pass in cell, use this.hoverCell and check for null in handle
                });
            });

            cell.addEventListener('mouseup', (e) => {
                this.handleIfActive(() => {
                    this.isActionDown = false;
                    this.lastAction = null;

                    this.updateAllCells();
                    this.checkGameEnd();
                });
            });

            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });

        });

        const gameContainer = document.getElementById('game-container');

        gameContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // end click and drag when leaving main container
        gameContainer.addEventListener('mouseleave', () => {
            this.handleIfActive(() => {
                this.isActionDown = false;
                this.lastAction = null;

                this.updateAllCells();
            });
        });

        document.querySelectorAll('.top').forEach(top => {
            top.addEventListener('mouseenter', () => {
                this.handleIfActive(() => {
                    this.isActionDown = false;
                    this.lastAction = null; 
                });
            });
        });

        document.querySelectorAll('.side').forEach(side => {
            side.addEventListener('mouseenter', () => {
                this.handleIfActive(() => {
                    this.isActionDown = false;
                    this.lastAction = null; 
                });
            });
        });

        document.querySelectorAll('.top').forEach(top => {
            top.addEventListener('click', () => {
                this.handleIfActive(() => {
                    if (top.classList.contains('complete')) {
                        if (this.firstKey) {
                            this.firstKey = false;
                            this.startTimer();
                        }
                        const col = top.dataset.col;
                        for (let row = 0; row < this.size; row++) {
                            const cell = document.getElementById(`cell-${row}-${col}`);
                            if (!cell.classList.contains('clicked')) {
                                cell.classList.remove('marked');
                                cell.classList.add('greyed');
                            }
                        }
                        this.updateAllCells();
                        this.checkGameEnd();
                    }
                });
            });
        });

        document.querySelectorAll('.side').forEach(side => {
            side.addEventListener('click', () => {
                this.handleIfActive(() => {
                    if (side.classList.contains('complete')) {
                        if (this.firstKey) {
                            this.firstKey = false;
                            this.startTimer();
                        }
                        const row = side.dataset.row;
                        for (let col = 0; col < this.size; col++) {
                            const cell = document.getElementById(`cell-${row}-${col}`);
                            if (!cell.classList.contains('clicked')) {
                                cell.classList.remove('marked');
                                cell.classList.add('greyed');
                            }
                        }
                        this.updateAllCells();
                        this.checkGameEnd();
                    }
                });
            });
        });
    }

    // separated per cell logic and key logic becaues when reseting using the enter key, reset would call 
    // main key action, which would create a new keydown listener, so when reseting again it would call double the 
    // number of listeners each time. so now mainKeyActions is only called once in the constructor, while mainGameActions
    // can be called everytime in reset()
    mainKeyActions(){
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Enter' && !e.repeat) {
                this.reset();
                return;
            }
            this.handleIfActive(() => {
                if (e.repeat) return;  // prevent repeats when holding down

                if ((['KeyW', 'KeyS', 'KeyX'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionClick();
                }
                else if ((['KeyE', 'KeyD', 'KeyC'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionMark();
                }
                else if ((['KeyR', 'KeyF', 'KeyV'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionGrey();
                }
            });
        });

        document.addEventListener('keyup', (e) => {
            this.handleIfActive(() => {
                if (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyX' ||
                    e.code === 'KeyE' || e.code === 'KeyD' || e.code === 'KeyC' ||
                    e.code === 'KeyR' || e.code === 'KeyF' || e.code === 'KeyV'
                ) {
                    e.preventDefault();
                    this.isActionDown = false;
                    this.lastAction = null;

                    this.updateAllCells();
                    this.checkGameEnd();
                }
            });
        });

        // Add global mouseup event listener
        document.addEventListener('mouseup', (e) => {
            this.handleIfActive(() => {
                this.isActionDown = false;
                this.lastAction = null;
                this.updateAllCells();
                this.checkGameEnd();
            });
        });
    }

    applyLastAction() {
        const cell = this.hoveredCell;
        switch (this.lastAction) {
            case 'clicked':
                cell.classList.remove('marked', 'greyed');
                const wasActive = cell.classList.contains('clicked');
                this.numActivatedCells += wasActive ? -1 : 1;
                cell.classList.toggle('clicked');
                break;
            case 'greyed':
                cell.classList.remove('marked', 'clicked');
                cell.classList.toggle('greyed');
                break;
            case 'marked':
                cell.classList.remove('greyed', 'clicked');
                cell.classList.toggle('marked');
                break;
        }
    }

    handleClick(e) {
        if (e.button === 0) {
            this.actionClick();
        } else if (e.button === 2) {
            this.actionGrey();
        } else if (e.button === 1) {
            this.actionMark();
        }
    }

    actionClick() {
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'clicked';

        this.hoveredCell.classList.remove('marked', 'greyed');
        this.hoveredCell.classList.toggle('clicked');

        this.updateCell();
        this.checkGameEnd();
    }

    actionGrey() {
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'greyed';

        this.hoveredCell.classList.remove('marked', 'clicked');
        this.hoveredCell.classList.toggle('greyed');

        this.updateCell();
        this.checkGameEnd();
    }

    actionMark() {  
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'marked';

        this.hoveredCell.classList.remove('greyed', 'clicked');
        this.hoveredCell.classList.toggle('marked');

        this.updateCell();
        this.checkGameEnd();
    }

    getLayout(size) {
        const layout = math.matrix(
            Array.from({ length: size }, () =>
                Array.from({ length: size }, () =>
                    math.randomInt(0, 2)
                )
            )
        );

        return layout;
    }

    getNumActivatedCells(possibleLayout) {
        return math.sum(possibleLayout);
    }

    getNums() {
        const layout = this.possibleLayout;

        const rows = layout.toArray();

        const cols = Array.from({ length: rows[0].length }, (_, c) =>
            rows.map(row => row[c])
        );

        const topNums = this.getNumsSum(cols);
        const sideNums = this.getNumsSum(rows);

        return [topNums, sideNums];
    }

    getNumsSum(array) {
        const finalList = [];

        for (let list of array) {
            finalList.push(this.getRuns(list));
        }

        return finalList;
    }

    getRuns(list) {
        const finalList = [];

        const fullLength = list.length;
        let head = 0;

        while (head < fullLength) {
            while (head < fullLength && list[head] === 0) head++;
            let sum = 0;
            while (head < fullLength && list[head] === 1) {
                sum++;
                head++;
            }
            if (sum > 0) finalList.push(sum);
        }

        if (finalList.length === 0) finalList.push(0);

        return finalList;
    }

    topNumToString(list) {
        return list.join('<br>');
    }

    sideNumToString(list) {
        return list.join(' ');
    }

    initializeTable() {
        const rows = this.size; // because will do the top row manually
        const cols = this.size + 1;

        const topNums = this.topNums;
        const sideNums = this.sideNums;
        const gameElement = document.getElementById('game-container');

        let html = '';

        // top row
        html += '<tr><td class="corner" id="corner"></td>';
        for (let col = 0; col < cols - 1; col++) { // -1 bc added corner
            let topNumValue = this.topNumToString(topNums[col]);
            let topClass = 'top';
            if (topNums[col].length === 1 && topNums[col][0] === 0) {
                topClass = 'top complete';
                if (this.colCompleteFlags) {
                    this.colCompleteFlags[col] = true;
                }
            }
            html += `<td class="${topClass}" id="top-${col}" data-col="${col}">${topNumValue}</td>`;
        }
        html += '</tr>';

        // get rest
        for (let row = 0; row < rows; row++) {
            html += '<tr>';
            for (let col = 0; col < cols; col++) {
                if (col === 0) {
                    let sideNumValue = this.sideNumToString(sideNums[row]);
                    let sideClass = 'side';
                    if (sideNums[row].length === 1 && sideNums[row][0] === 0) {
                        sideClass = 'side complete';
                        if (this.rowCompleteFlags) this.rowCompleteFlags[row] = true;
                    }
                    html += `<td class="${sideClass}" id="side-${row}" data-row="${row}">${sideNumValue}</td>`;
                }
                else {
                    html += `<td class="cell" id="cell-${row}-${col - 1}" data-row="${row}" data-col="${col - 1}"></td>`; // -1 side offset
                }
            }

            html += '</tr>';
        }

        gameElement.innerHTML = html;
    }

    syncTableSizes() {
        const corner = document.getElementById('corner');
        const height = corner.offsetHeight;
        const width = corner.offsetWidth;

        const bestSize = Math.max(height, width);

        corner.style.height = bestSize + 'px';
        corner.style.width = bestSize + 'px';

    }

    updateAllCells() {
        const colsToUpdate = new Set(this.actionedCols);
        const rowsToUpdate = new Set(this.actionedRows);

        for (let col of colsToUpdate) {
            this.updateTop(col);
            this.actionedCols.delete(col);
        }

        for (let row of rowsToUpdate) {
            this.updateSide(row);
            this.actionedRows.delete(row); 
        }
    }

    updateCell(){
        if (this.hoveredCell) {
            const row = this.hoveredCell.dataset.row;
            const col = this.hoveredCell.dataset.col;

            this.actionedCols.add(col);
            this.actionedRows.add(row);
        }
    }

    updateTop(col) {
        const id = `top-${col}`
        const workingCol = document.getElementById(id);

        if (this.topNums[col].length === 1 && this.topNums[col][0] === 0) {
            this.colCompleteFlags[col] = true;
            workingCol.classList.add('complete');
        } else if (this.isColComplete(col)) {
            this.colCompleteFlags[col] = true;
            workingCol.classList.add('complete');
        } else {
            this.colCompleteFlags[col] = false;
            workingCol.classList.remove('complete');
        }
    }

    updateSide(row) {
        const id = `side-${row}`;
        const workingRow = document.getElementById(id);

        // preserve completion for zero rows
        if (this.sideNums[row].length === 1 && this.sideNums[row][0] === 0) {
            this.rowCompleteFlags[row] = true;
            workingRow.classList.add('complete');
        } else if (this.isRowComplete(row)) {
            // set correspoding rowflag to true
            this.rowCompleteFlags[row] = true;
            // grey out working row
            workingRow.classList.add('complete');
        } else {
            this.rowCompleteFlags[row] = false;
            workingRow.classList.remove('complete');
        }
    }

    isEqualSlice(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;

        for (let i=0; i<arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }

        return true;
    }

    isColComplete(col) {
        const slice = this.getColSlice(col);
        const sliceSum = this.getRuns(slice);

        return this.isEqualSlice(sliceSum, this.topNums[col]);
    } 

    isRowComplete(row) {
        const slice = this.getRowSlice(row);
        const sliceSum = this.getRuns(slice);

        return this.isEqualSlice(sliceSum, this.sideNums[row]);
    }

    getColSlice(col) {
        const COL = col;
        const slice = new Array(this.size).fill(0)
        for (let row=0; row<this.size; row++){
            let id = `cell-${row}-${COL}`;
            const cell = document.getElementById(id);
            slice[row] = cell.classList.contains('clicked') ? 1 : 0; // just use row as a incrementor
        }

        return slice
    }

    getRowSlice(row) {
        const ROW = row;
        const slice = new Array(this.size).fill(0)
        for (let col=0; col<this.size; col++){
            let id = `cell-${ROW}-${col}`;
            const cell = document.getElementById(id);
            slice[col] = cell.classList.contains('clicked') ? 1 : 0;
        }

        return slice
    }

    checkGameEnd() {
        const allRowsComplete = this.rowCompleteFlags.every(Boolean);
        const allColsComplete = this.colCompleteFlags.every(Boolean);

        if (allRowsComplete && allColsComplete) {
            this.isGameOver = true;

            const corner = document.getElementById('corner');
            corner.classList.add('complete');

            document.querySelectorAll('.top').forEach(top => {
                top.classList.remove('complete');
                top.classList.remove('highlight');
            });

            document.querySelectorAll('.side').forEach(side => {
                side.classList.remove('complete');
                side.classList.remove('highlight');
            });


            this.stopTimer();
            const timeString = this.formatTime(this.timer);
            this.showWinPopup(timeString);
        }
    }

    startTimer() {
        this.stopTimer();
        this.timer = 0;

        const popup = document.getElementById('win-paste');
        const timerElement = document.getElementById('timer');

        if (popup) popup.classList.remove('hidden');
        if (timerElement) timerElement.textContent = this.formatTime(this.timer);

        this.timerInterval = setInterval(() => {
            this.timer++;
            if (timerElement) timerElement.textContent = this.formatTime(this.timer);

        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(timer) {
        const hours = Math.floor(timer / 3600);
        const mins = Math.floor((timer % 3600) / 60);
        const secs = timer % 60;

        if (hours > 0) {
            return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
            return `${mins}:${String(secs).padStart(2, '0')}`;
        }
    }

    showWinPopup(timeString) {
        const popup = document.getElementById('win-paste');
        const timerElement = document.getElementById('timer');
        if (timerElement) timerElement.textContent = `${timeString}`;
        const plainText = `NONO ${this.size}
${timeString}`;
        // add seed later
        const shareButton = document.getElementById('copy-button');
        shareButton.onclick = () => {
            navigator.clipboard.writeText(plainText);
            shareButton.textContent = 'copied';
        };
        shareButton.classList.remove('hidden');
        popup.classList.remove('hidden');
    }

}

window.addEventListener('DOMContentLoaded', () => {
    const nono = new Nono();
});

/*
TODO

add board seed, size-board in binary + some map, or similar
add this seed to win paste
add seed copy and load to settings pannel

change typing and mines copy button to .onclick to prevent dupe

*/