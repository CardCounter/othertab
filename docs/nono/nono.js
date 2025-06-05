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

    settingsPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

});

class Nono {
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

        // console.log(this.size)

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

                // console.log(this.size)

                this.reset();
            });
        });

        this.possibleLayout = this.getLayout(this.size);
        this.numActivatedCellsMaster = this.getNumActivatedCells(this.possibleLayout);
        this.numActivatedCells = 0;
        [this.topNums, this.sideNums] = this.getNums();

        // console.log(`top: ${JSON.stringify(this.topNums)}, side: ${JSON.stringify(this.sideNums)}`)

        this.initializeTable();
        this.syncTableSizes(); /// add this and everything on reset()
        // this.renderGrid();

        this.hoveredCell = null;
        this.isActionDown = false;
        this.lastAction = null;
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);

        this.isGameOver = false;

        this.mainGameActions();
        this.mainKeyActions();
    }

    reset() {
        // console.log('in reset')
        // console.log(`size: ${typeof(this.size)}`)
        this.possibleLayout = this.getLayout(this.size);
        this.numActivatedCellsMaster = this.getNumActivatedCells(this.possibleLayout);
        this.numActivatedCells = 0;
        // console.log(`layout ${typeof(this.possibleLayout)}`)
        // console.log(`data type for top side: ${typeof(this.topNums)},${this.topNums} ${typeof(this.sideNums)},${this.sideNums}`)
        
        let t1;
        let t2
        [t1, t2] = this.getNums();
        // console.log(`t ${t1}, ${t2}`)
        this.topNums = t1;
        this.sideNums = t2;
        // [this.topNums, this.sideNums] = this.getNums();

        // console.log(`top ${this.topNums}`)
        // console.log(`side ${this.sideNums}`)

        this.initializeTable();
        this.syncTableSizes(); /// add this and everything on reset()
        // this.renderGrid();

        this.hoveredCell = null;
        this.isActionDown = false;
        this.lastAction = null;
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);

        this.isGameOver = false;

        this.mainGameActions();
    }

    mainGameActions(){
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
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
                if (this.isActionDown) this.applyLastAction(cell);

            });

            cell.addEventListener('mouseleave', () => {
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

            cell.addEventListener('mousedown', (e) => {
                this.handleClick(e); // dont pass in cell, use this.hoverCell and check for null in handle
            });

            cell.addEventListener('mouseup', (e) => {
                this.isActionDown = false;
                this.lastAction = null;

                this.updateCell();
                this.checkGameEnd();
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
            this.isActionDown = false;
            this.lastAction = null;
        });

        document.querySelectorAll('.top').forEach(top => {
            top.addEventListener('mouseenter', () => {
               this.isActionDown = false;
                this.lastAction = null; 
            });
        });

        document.querySelectorAll('.side').forEach(side => {
            side.addEventListener('mouseenter', () => {
               this.isActionDown = false;
                this.lastAction = null; 
            });
        });

    }

    // separated per cell logic and key logic becaues when reseting using the enter key, reset would call 
    // main key action, which would create a new keydown listener, so when reseting again it would call double the 
    // number of listeners each time. so now mainKeyActions is only called once in the constructor, while mainGameActions
    // can be called everytime in reset()
    mainKeyActions(){
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;  // prevent repeats when holding down

            if (e.code === 'Enter') this.reset();

            if ((['KeyE', 'KeyD', 'KeyC'].includes(e.code)) && this.hoveredCell) {
                e.preventDefault();
                // this.isActionDown = true;
                // this.lastAction = 'clicked';

                // this.hoveredCell.classList.remove('marked', 'greyed');
                // const wasActive = this.hoveredCell.classList.contains('clicked');
                // this.numActivatedCells += wasActive ? -1 : 1;
                // this.hoveredCell.classList.toggle('clicked');
                this.actionClick();
            }
            else if ((['KeyW', 'KeyS', 'KeyX'].includes(e.code)) && this.hoveredCell) {
                e.preventDefault();
                this.actionGrey();
            }
            else if ((['KeyR', 'KeyF', 'KeyV'].includes(e.code)) && this.hoveredCell) {
                e.preventDefault();
                this.actionMark();
            }

        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyX' ||
                e.code === 'KeyE' || e.code === 'KeyD' || e.code === 'KeC' ||
                e.code === 'KeyR' || e.code === 'KeyF' || e.code === 'KeyV'
            ) {
                e.preventDefault();
                this.isActionDown = false;
                this.lastAction = null;

                this.updateCell();
                this.checkGameEnd();
            }
        });
    }

    applyLastAction(cell) {
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
            // this.lastAction = 'clicked';

            // cell.classList.remove('marked', 'greyed');
            // const wasActive = cell.classList.contains('clicked');
            // this.numActivatedCells += wasActive ? -1 : 1;
            // cell.classList.toggle('clicked');
            this.actionClick();
        } else if (e.button === 2) {
            this.actionGrey();
        } else if (e.button === 1) {
            this.actionMark();
        }
    }

    actionClick() {
        this.isActionDown = true;
        this.lastAction = 'clicked';

        this.hoveredCell.classList.remove('marked', 'greyed');
        // const wasActive = this.hoveredCell.classList.contains('clicked');
        // this.numActivatedCells += wasActive ? -1 : 1;
        this.hoveredCell.classList.toggle('clicked');

        this.updateCell();
        this.checkGameEnd();
    }

    actionGrey() {
        this.isActionDown = true;
        this.lastAction = 'greyed';

        this.hoveredCell.classList.remove('marked', 'clicked');
        this.hoveredCell.classList.toggle('greyed');

        this.updateCell();
        this.checkGameEnd();
    }

    actionMark() {  
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

        // console.log(`this is layout: ${layout}`)

        return layout;
    }

    getNumActivatedCells(possibleLayout) {
        return math.sum(possibleLayout);
    }

    getNums() {
        const layout = this.possibleLayout;
        // console.log(`layout in getNums ${this.possibleLayout}`)

        // console.log(`this is layout going into getNums: ${layout}`);

        const rows = layout.toArray();
        // console.log(`rows ${rows}`)

        const cols = Array.from({ length: rows[0].length }, (_, c) =>
            rows.map(row => row[c])
        );

        // console.log(`cols ${cols}`)

        const topNums = this.getNumsSum(cols);
        const sideNums = this.getNumsSum(rows);

        // console.log(`returning topNums: ${topNums}`)

        // console.log(`top nums: ${topNums}`);
        // console.log(`row nums: ${sideNums}`);

        return [topNums, sideNums];
    }

    getNumsSum(array) {
        const finalList = [];

        for (let list of array) {
            // console.log(`sending list: ${list}`)
            finalList.push(this.getRuns(list));
            // console.log(`got: ${JSON.stringify(this.getRuns(list))}`)
        }

        // console.log(`final: ${JSON.stringify(finalList)}`)
        // console.log(`returning finallist ${finalList}`)
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

        // console.log(`out: ${finalList}`)
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
            html += `<td class="top" id="top-${col}" data-col="${col}">${topNumValue}</td>`; // added col for highlight
        }
        html += '</tr>';

        // get rest
        for (let row = 0; row < rows; row++) {
            html += '<tr>';
            for (let col = 0; col < cols; col++) {
                if (col === 0) {
                    let sideNumValue = this.sideNumToString(sideNums[row]);
                    html += `<td class="side" id="side-${row}" data-row="${row}">${sideNumValue}</td>`; // added row for highlight
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

        // console.log(`width ${width} height: ${height}`)

        const bestSize = Math.max(height, width);

        // console.log(`best ${bestSize}`)

        corner.style.height = bestSize + 'px';
        corner.style.width = bestSize + 'px';

        // console.log(`offsetheight: ${corner.offsetHeight} width ${corner.offsetWidth}`)
    }

    updateCell(){
        const row = this.hoveredCell.dataset.row;
        const col = this.hoveredCell.dataset.col;

        this.updateTop(col);
        this.updateSide(row);  
        
        console.log(`top flags: ${this.colCompleteFlags}`)
        console.log(`side flags: ${this.rowCompleteFlags}`)

    }

    updateTop(col) {
        const id = `top-${col}`
        const workingCol = document.getElementById(id);

        console.log(`iscolcomplete: ${this.isColComplete(col)}`)

        if (this.isColComplete(col)) {
            console.log(`in true: ${col}`)
            // set correspoding colflag to true
            this.colCompleteFlags[col] = true;

            // grey out working row
            workingCol.classList.add('complete');
        }
        else {
            console.log(`in false: ${col}`)
            this.colCompleteFlags[col] = false;
            workingCol.classList.remove('complete');
        }

    }

    updateSide(row) {
        const id = `side-${row}`
        const workingRow = document.getElementById(id);

        const isComp = this.isRowComplete(row);

        if (isComp) {
            // set correspoding colflag to true
            this.rowCompleteFlags[row] = true;

            // grey out working row
            workingRow.classList.add('complete');
        }
        else {
            this.colCompleteFlags[row] = false;
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
        // console.log(`looking at slice: ${JSON.stringify(slice)}`)
        const sliceSum = this.getRuns(slice);
        console.log(`my slice: ${JSON.stringify(sliceSum)}, their slice: ${this.topNums[col]}`)

        // const bool = this.isEqualSlice(sliceSum, this.topNums[col]);
        // console.log(`is it good? ${bool}, what im checking: ${JSON.stringify(sliceSum[0])}`)
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
        if (this.rowCompleteFlags.every(Boolean) && this.colCompleteFlags.every(Boolean)) {
            this.isGameOver = true;
            console.log(`game finish`);
        }
    }

}

window.addEventListener('DOMContentLoaded', () => {
    const nono = new Nono();
});

// window.addEventListener('load', this.syncTableSizes());

/*
prevent hover cell from selecting top and side, or 
prevent clicking on top and side if not complete




*/