class Nono {
    constructor() {
        this.grid = [];
        this.size = 15;



        this.possibleLayout = this.getLayout(this.size, this.size);
        [this.topNums, this.sideNums] = this.getNums();

        this.initializeTable();
        this.syncTableSizes(); /// add this and everything on reset()
        // this.renderGrid();

        this.hoveredCell = null;

        // document.querySelectorAll('[class^="cell-"]').forEach(cell => {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                if (this.hoveredCell === cell) return;
                this.hoveredCell = cell;

                const row = cell.dataset.row;
                const col = cell.dataset.col;

                document.querySelectorAll('.cell').forEach(innerCell => {
                    if (
                        (innerCell.dataset.row === row) !== (innerCell.dataset.col === col) && // XOR, so doesnt highlight the target cell
                        innerCell.classList.length === 1 &&
                        innerCell.classList.contains('cell')
                    ) {
                        innerCell.classList.add('highlight');
                    }
                });

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
            });

            cell.addEventListener('mouseleave', () => {
                this.hoveredCell = null;

                const row = cell.dataset.row;
                const col = cell.dataset.col;

                document.querySelectorAll('.cell').forEach(innerCell => {
                    if (innerCell.dataset.row === row || innerCell.dataset.col === col) {
                        innerCell.classList.remove('highlight');
                    }
                });

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
                this.handleClick(e, cell);
            });

            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        });

        document.addEventListener('keydown', (e) => {
            if ((e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyX') && this.hoveredCell) {
                e.preventDefault();
                this.hoveredCell.classList.remove('marked');
                this.hoveredCell.classList.remove('greyed');
                this.hoveredCell.classList.toggle('clicked');
            }
            else if ((e.code === 'KeyE' || e.code === 'KeyD' || e.code === 'KeC') && this.hoveredCell) {
                e.preventDefault();
                this.hoveredCell.classList.remove('highlight');

                this.hoveredCell.classList.remove('marked');
                this.hoveredCell.classList.toggle('greyed');
                this.hoveredCell.classList.remove('clicked');
            }
            else if ((e.code === 'KeyR' || e.code === 'KeyF' || e.code === 'KeyV') && this.hoveredCell) {
                e.preventDefault();
                this.hoveredCell.classList.remove('highlight');

                this.hoveredCell.classList.toggle('marked');
                this.hoveredCell.classList.remove('greyed');
                this.hoveredCell.classList.remove('clicked');
            }
        });

    }

    getLayout(row, col) {
        const layout = math.matrix(
            Array.from({ length: row }, () =>
                Array.from({ length: col }, () =>
                    math.randomInt(0, 2)
                )
            )
        );

        console.log(`this is layout: ${layout}`)

        return layout;
    }

    getNums() {
        const layout = this.possibleLayout;

        console.log(`this is layout going into getNums: ${layout}`);

        const rows = layout.toArray();

        const cols = Array.from({ length: rows[0].length }, (_, c) =>
            rows.map(row => row[c])
        );

        const topNums = this.getNumsSum(cols);
        const sideNums = this.getNumsSum(rows);

        // console.log(`top nums: ${topNums}`);
        // console.log(`row nums: ${sideNums}`);

        return [topNums, sideNums];
    }

    getNumsSum(array) {
        const finalList = [];

        for (let list of array) {
            console.log(`sending list: ${list}`)
            finalList.push(this.getRuns(list));
            console.log(`got: ${JSON.stringify(this.getRuns(list))}`)
        }

        console.log(`final: ${JSON.stringify(finalList)}`)
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

        const bestSize = Math.max(height, width);

        corner.style.height = bestSize + 'px';
        corner.style.width = bestSize + 'px';
    }

    handleClick(e, cell) {
        if (e.button === 0) {
            cell.classList.remove('highlight');

            cell.classList.remove('marked');
            cell.classList.remove('greyed');
            cell.classList.toggle('clicked');
        } else if (e.button === 2) {
            cell.classList.remove('highlight');

            cell.classList.remove('marked');
            cell.classList.toggle('greyed');
            cell.classList.remove('clicked');
        } else if (e.button === 1) {
            cell.classList.remove('highlight');

            cell.classList.toggle('marked');
            cell.classList.remove('greyed');
            cell.classList.remove('clicked');
        }
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
