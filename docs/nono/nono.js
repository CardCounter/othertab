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
        [this.topNums, this.sideNums] = this.getNums();

        this.initializeTable();
        this.syncTableSizes(); /// add this and everything on reset()
        // this.renderGrid();

        this.hoveredCell = null;
        this.isActionDown = false;
        this.lastAction = null;

        this.mainGameActions();
        this.mainKeyActions();
    }

    reset() {
        // console.log('in reset')
        // console.log(`size: ${typeof(this.size)}`)
        this.possibleLayout = this.getLayout(this.size);
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
                this.isActionDown = true;
                this.handleClick(e, cell);
            });

            cell.addEventListener('mouseup', (e) => {
                this.isActionDown = false;
                this.lastAction = null;
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

            if ((['KeyW', 'KeyS', 'KeyX'].includes(e.code)) && this.hoveredCell) {
                e.preventDefault();
                this.isActionDown = true;
                this.lastAction = 'clicked';

                this.hoveredCell.classList.remove('marked', 'greyed');
                this.hoveredCell.classList.toggle('clicked');
            }
            else if ((['KeyE', 'KeyD', 'KeyC'].includes(e.code)) && this.hoveredCell) {
                e.preventDefault();
                this.isActionDown = true;
                this.lastAction = 'greyed';

                this.hoveredCell.classList.remove('marked', 'clicked');
                this.hoveredCell.classList.toggle('greyed');
            }
            else if ((['KeyR', 'KeyF', 'KeyV'].includes(e.code)) && this.hoveredCell) {
                e.preventDefault();
                this.isActionDown = true;
                this.lastAction = 'marked';

                this.hoveredCell.classList.remove('greyed', 'clicked');
                this.hoveredCell.classList.toggle('marked');
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
            }
        });
    }

    applyLastAction(cell) {
        switch (this.lastAction) {
            case 'clicked':
                cell.classList.remove('marked', 'greyed');
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

    handleClick(e, cell) {
        if (e.button === 0) {
            this.lastAction = 'clicked';

            cell.classList.remove('marked', 'greyed');
            cell.classList.toggle('clicked');
        } else if (e.button === 2) {
            this.lastAction = 'greyed';

            cell.classList.remove('marked', 'clicked');
            cell.classList.toggle('greyed');
        } else if (e.button === 1) {
            this.lastAction = 'marked';

            cell.classList.remove('greyed', 'clicked');
            cell.classList.toggle('marked');
        }
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
            html += `<td class="top" data-col="${col}">${topNumValue}</td>`; // added col for highlight
        }
        html += '</tr>';

        // get rest
        for (let row = 0; row < rows; row++) {
            html += '<tr>';
            for (let col = 0; col < cols; col++) {
                if (col === 0) {
                    let sideNumValue = this.sideNumToString(sideNums[row]);
                    html += `<td class="side" data-row="${row}">${sideNumValue}</td>`; // added row for highlight
                }
                else {
                    html += `<td class="cell" data-row="${row}" data-col="${col - 1}"></td>`; // -1 side offset
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

// when remove toggle, will be blank background instead of highlight





    // initializeTable() {
    //     this.grid = Array(this.rows).fill().map(() => 
    //         Array(this.cols).fill().map(() => ({
    //             isOn: false,
    //             isOff: false,
    //             isMarked: false
    //         }))
    //     );
    // }

    // renderGrid() {
    //     const gridElement = document.getElementById('grid');
    //     gridElement.innerHTML = '';
    //     gridElement.style.gridTemplateColumns = `repeat(${this.cols}, 30px)`; // change cell size here
    //     gridElement.style.gridTemplateRows = `repeat(${this.rows}, 30px)`;
        
    //     for (let row = 0; row < this.rows; row++) {
    //         for (let col = 0; col < this.cols; col++) {
    //             const cell = document.createElement('div');
    //             cell.className = 'cell';
    //             cell.dataset.row = row;
    //             cell.dataset.col = col;

    //             // middle click or both buttons for chord
    //             cell.addEventListener('mousedown', (e) => { // change these to css styles, blank, on, off, marked
    //                 this.isMouseDown = true;
    //                 if (e.button == 0){
    //                     if (cell.style.backgroundColor === 'blue') cell.style.backgroundColor = 'white';
    //                     else {cell.style.backgroundColor = 'blue';}
    //                 }
    //                 if (e.button == 1){
    //                     if (cell.style.backgroundColor === 'black') cell.style.backgroundColor = 'white';
    //                     else {cell.style.backgroundColor = 'black';}
    //                 }
    //                 if (e.button == 2){
    //                     if (cell.style.backgroundColor === 'grey') cell.style.backgroundColor = 'white';
    //                     else {cell.style.backgroundColor = 'grey';}
    //                 }
    //             });
                
    //             cell.addEventListener('mouseup', (e) => {
    //                 this.isMouseDown = false;
    //             });
                
    //             cell.addEventListener('contextmenu', (e) => {
    //                 e.preventDefault();
    //             });

    //             cell.addEventListener('mouseover', (e) => { 
    //                 if (this.isMouseDown){
    //                     if (e.buttons & 1){
    //                         if (cell.style.backgroundColor === 'blue') cell.style.backgroundColor = 'white';
    //                         else {cell.style.backgroundColor = 'blue';}
    //                     }
    //                     else if (e.buttons & 4){ ////// look up why this works again
    //                         if (cell.style.backgroundColor === 'black') cell.style.backgroundColor = 'white';
    //                         else {cell.style.backgroundColor = 'black';}
    //                     }
    //                     else if (e.buttons & 2){
    //                         if (cell.style.backgroundColor === 'grey') cell.style.backgroundColor = 'white';
    //                         else {cell.style.backgroundColor = 'grey';}
    //                     }
    //                 }

    //             });
                
    //             // add fix for when mouse leave grid, reset dont keep drawing if re enter without 
    //             window.addEventListener('mouseup', () => {
    //                 this.isMouseDown = false;
    //             });

    //             // this.updateCellAppearance(cell, row, col);  
                
    //             gridElement.appendChild(cell);
    //         }
    //     }
    // }
}




// document.querySelectorAll('[class^="cell-"]').forEach(cell => {
//     cell.addEventListener('click', () => {
//         cell.classList.remove('greyed');
//         cell.classList.toggle('clicked');
//     });
//     cell.addEventListener('contextmenu', (e) => {
//         e.preventDefault();
//         cell.classList.remove('clicked')
//         cell.classList.toggle('greyed');
//     });
//     cell.addEventListener('mousedown', (e) => {
//         if (!(e.button == 2)){
//             if (!cell.classList.contains('revealed') && !this.gameOver) {
//                 cell.style.backgroundColor = '#999999';
//             }
//         }

//         // middle click or left right
//         if ((e.button === 1 || (e.buttons === 3)) && !this.gameOver && this.grid[row][col].isRevealed) {
//             this.chord(row, col);
//         } 
//     })


// });



// makes grid size scale


window.addEventListener('DOMContentLoaded', () => {
    const nono = new Nono();
});

// window.addEventListener('load', this.syncTableSizes());
