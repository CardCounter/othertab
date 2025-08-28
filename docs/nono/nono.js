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
        
        const initialSizeEl = document.getElementById(this.sizeMode);
        if (initialSizeEl) {
            initialSizeEl.classList.add('active');
            this.size = Number(initialSizeEl.dataset.size);
            document.documentElement.style.setProperty('--num-font-size', initialSizeEl.dataset.font);
        } else {
            // Fallback if size buttons not yet in DOM
            this.size = 15;
            document.documentElement.style.setProperty('--num-font-size', '16px');
        }

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
                this.size = Number(document.getElementById(this.sizeMode)?.dataset.size ?? button.dataset.size);
                document.documentElement.style.setProperty('--num-font-size', document.getElementById(this.sizeMode)?.dataset.font ?? button.dataset.font);

                this.reset();

            });
        });

        this.possibleLayout = this.getLayout(this.size);
        this.numActivatedCellsMaster = this.getNumActivatedCells(this.possibleLayout);
        this.numActivatedCells = 0;
        [this.topNums, this.sideNums] = this.getNums();

        this.hoveredCell = null;
        this.lastValidDragCell = null; // Track last valid drag position
        this.isActionDown = false;
        this.lastAction = null;
        this.dragStartCell = null;
        this.dragDirection = null;
        this.inputMethod = null; // Track whether current action is keyboard or mouse
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);
        this.actionedCols = new Set();
        this.actionedRows = new Set();

        this.firstKey = true;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;

        this.history = [];
        this.currentAction = null;

        this.initializeTable();
        this.syncTableSizes();
        this.mainGameActions();
        this.mainKeyActions();

        // Ensure seed/load buttons exist even if not in HTML
        this.ensureSeedLoadButtons();
        // Seed / Load UI
        this.initSeedControls();
    }

    ensureSeedLoadButtons() {
        const footer = document.querySelector('footer');
        if (!footer) return;
        const sizeBtn = document.getElementById('settings-button');
        let seedBtn = document.getElementById('seed-button');
        let loadBtn = document.getElementById('load-button');

        if (!seedBtn) {
            seedBtn = document.createElement('button');
            seedBtn.id = 'seed-button';
            seedBtn.className = 'settings-button';
            seedBtn.textContent = 'seed';
            if (sizeBtn && sizeBtn.nextSibling) {
                footer.insertBefore(seedBtn, sizeBtn.nextSibling);
            } else {
                footer.prepend(seedBtn);
            }
        }
        if (!loadBtn) {
            loadBtn = document.createElement('button');
            loadBtn.id = 'load-button';
            loadBtn.className = 'settings-button';
            loadBtn.textContent = 'load';
            if (seedBtn && seedBtn.nextSibling) {
                footer.insertBefore(loadBtn, seedBtn.nextSibling);
            } else {
                footer.prepend(loadBtn);
            }
        }

        // Ensure load panel exists
        let loadPanel = document.getElementById('load-panel');
        if (!loadPanel) {
            loadPanel = document.createElement('div');
            loadPanel.id = 'load-panel';
            loadPanel.className = 'settings-panel hidden';
            loadPanel.style.gap = '8px';
            loadPanel.style.padding = '12px';
            loadPanel.innerHTML = `
                <label for="seed-input">enter seed</label>
                <input id="seed-input" type="text" placeholder="e.g. 151234567890" style="width: 100%;" />
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="seed-confirm" class="settings-button">y</button>
                    <button id="seed-cancel" class="settings-button">n</button>
                </div>
            `;
            footer.appendChild(loadPanel);
        }
    }

    initSeedControls() {
        const seedBtn = document.getElementById('seed-button');
        const loadBtn = document.getElementById('load-button');
        const loadPanel = document.getElementById('load-panel');
        const seedInput = document.getElementById('seed-input');
        const confirmBtn = document.getElementById('seed-confirm');
        const cancelBtn = document.getElementById('seed-cancel');

        if (seedBtn) {
            seedBtn.addEventListener('click', () => {
                try {
                    const seedStr = window.Seed ? window.Seed.createSeedFromLayout(this.possibleLayout, this.size) : '';
                    if (seedStr) {
                        navigator.clipboard.writeText(seedStr);
                        seedBtn.textContent = 'copied';
                        setTimeout(() => seedBtn.textContent = 'seed', 1000);
                    }
                } catch (e) {
                    // ignore
                }
            });
        }

        if (loadBtn && loadPanel && seedInput && confirmBtn && cancelBtn) {
            loadBtn.addEventListener('click', () => {
                // Show the panel above buttons without hiding them
                const isHidden = loadPanel.classList.contains('hidden');
                if (isHidden) {
                    loadPanel.classList.remove('hidden');
                    seedInput.focus();
                } else {
                    loadPanel.classList.add('hidden');
                    seedInput.value = '';
                }
            });

            cancelBtn.addEventListener('click', () => {
                loadPanel.classList.add('hidden');
                seedInput.value = '';
            });

            confirmBtn.addEventListener('click', () => {
                const seedStr = seedInput.value.trim();
                if (!seedStr) return;
                try {
                    this.loadSeed(seedStr);
                    loadPanel.classList.add('hidden');
                    seedInput.value = '';
                } catch (e) {
                    confirmBtn.textContent = 'invalid';
                    setTimeout(() => confirmBtn.textContent = 'y', 1000);
                }
            });
        }
    }

    loadSeed(seedString) {
        if (!window.Seed) throw new Error('Seed helpers not available');
        const { size, layoutArray } = window.Seed.parseSeed(seedString);

        // Map size to a difficulty button id
        const buttonId = `difficulty-${size}`;
        const button = document.getElementById(buttonId);
        if (!button) throw new Error('Unsupported size in seed');

        // Update size and UI font
        this.sizeMode = buttonId;
        localStorage.setItem('NONO-currentSize', buttonId);
        this.size = size;
        document.documentElement.style.setProperty('--num-font-size', button.dataset.font);

        // Set layout from seed
        this.possibleLayout = math.matrix(layoutArray);
        this.numActivatedCellsMaster = this.getNumActivatedCells(this.possibleLayout);
        this.numActivatedCells = 0;

        // reset seed button text
        const seedBtn = document.getElementById('seed-button');
        if (seedBtn) seedBtn.textContent = 'seed';

        let t1, t2;
        [t1, t2] = this.getNums();
        this.topNums = t1;
        this.sideNums = t2;

        this.hoveredCell = null;
        this.lastValidDragCell = null; // Track last valid drag position
        this.isActionDown = false;
        this.lastAction = null;
        this.dragStartCell = null;
        this.dragDirection = null;
        this.inputMethod = null;
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);
        this.actionedCols = new Set();
        this.actionedRows = new Set();

        // Ensure timer is fully reset and stopped until first interaction
        this.stopTimer();
        this.firstKey = true;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;
        const timerElement = document.getElementById('timer');
        if (timerElement) timerElement.textContent = '0:00';
        
        this.history = [];
        this.currentAction = null;

        // Clear any drag previews
        document.querySelectorAll('.drag-preview').forEach(cell => {
            cell.classList.remove('drag-preview');
        });

        // hide win popup and keep copy button hidden until game end
        const popup = document.getElementById('win-paste');
        if (popup) popup.classList.add('hidden');
        const shareButton = document.getElementById('copy-button');
        if (shareButton) shareButton.classList.add('hidden');
        const resetHint = document.getElementById('reset-hint');
        if (resetHint) resetHint.classList.add('hidden');

        this.initializeTable();
        this.syncTableSizes();
        this.mainGameActions();
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
        this.lastValidDragCell = null; // Track last valid drag position
        this.isActionDown = false;
        this.lastAction = null;
        this.dragStartCell = null;
        this.dragDirection = null;
        this.inputMethod = null;
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);
        this.actionedCols = new Set();
        this.actionedRows = new Set();

        this.firstKey = true;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;

        this.history = [];
        this.currentAction = null;

        // Clear any drag previews
        document.querySelectorAll('.drag-preview').forEach(cell => {
            cell.classList.remove('drag-preview');
        });

        const shareButton = document.getElementById('copy-button');
        if (shareButton) {
            shareButton.textContent = 'share';
            shareButton.onclick = null;
            shareButton.classList.add('hidden');
        }

        // reset seed button text
        const seedBtn = document.getElementById('seed-button');
        if (seedBtn) seedBtn.textContent = 'seed';

        const timerElement = document.getElementById('timer');
        if (timerElement) timerElement.textContent = '0:00';

        const popup = document.getElementById('win-paste');
        if (popup) popup.classList.add('hidden');
        const resetHint = document.getElementById('reset-hint');
        if (resetHint) resetHint.classList.add('hidden');

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
                        const startCell = this.dragStartCell;
                        if (startCell) {
                            const startRow = startCell.dataset.row;
                            const startCol = startCell.dataset.col;

                            if (!this.dragDirection) {
                                if (row === startRow && col !== startCol) {
                                    this.dragDirection = 'row';
                                } else if (col === startCol && row !== startRow) {
                                    this.dragDirection = 'col';
                                } else {
                                    return;
                                }
                                // Show initial preview when direction is determined
                                this.showDragPreview();
                            } else {
                                // Always show drag preview when drag is active, regardless of cursor position
                                this.showDragPreview();
                            }
                        }
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
                    // Only apply drag actions if we actually dragged to other cells
                    if (this.isActionDown && this.dragStartCell && this.dragDirection && this.lastValidDragCell) {
                        // This was a drag operation that moved to other cells
                        this.applyDragActions();
                    }
                    // If no dragDirection or no lastValidDragCell, it was just a single click
                    // Single click action already applied on mousedown, just need to finalize
                    
                    this.isActionDown = false;
                    this.lastAction = null;
                    this.dragStartCell = null;
                    this.dragDirection = null;
                    this.inputMethod = null;
                    this.lastValidDragCell = null;

                    // For single clicks, action already applied on mousedown, but still need to update completion
                    // For drags, applyDragActions() already handles updates and game end check
                    if (!this.dragDirection) {
                        // Single click - update completion status and check game end
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    } else {
                        // Drag operation - update all cells and check game end
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    }
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

        // Track mouse position for continuous drag preview
        gameContainer.addEventListener('mousemove', (e) => {
            this.handleIfActive(() => {
                if (this.isActionDown && this.dragStartCell) {
                    // Update drag preview continuously while dragging
                    // This maintains preview even when cursor is outside grid cells
                    this.showDragPreview();
                }
            });
        });

        // end click and drag when leaving main container
        gameContainer.addEventListener('mouseleave', () => {
            this.handleIfActive(() => {
                // Keep drag previews visible if dragging is active
                // Only clear previews and reset drag state if not actively dragging
                if (!this.isActionDown) {
                    // Clear any drag previews only if not dragging
                    document.querySelectorAll('.drag-preview').forEach(cell => {
                        cell.classList.remove('drag-preview');
                    });
                    
                    this.lastAction = null;
                    this.dragStartCell = null;
                    this.dragDirection = null;
                    this.updateAllCells();
                }
            });
        });

        document.querySelectorAll('.top').forEach(top => {
            top.addEventListener('mouseenter', () => {
                this.handleIfActive(() => {
                    // Keep drag previews visible if dragging is active
                    if (!this.isActionDown) {
                        // Clear any drag previews only if not dragging
                        document.querySelectorAll('.drag-preview').forEach(cell => {
                            cell.classList.remove('drag-preview');
                        });
                        
                        this.lastAction = null;
                        this.dragStartCell = null;
                        this.dragDirection = null;
                    }
                });
            });
        });

        document.querySelectorAll('.side').forEach(side => {
            side.addEventListener('mouseenter', () => {
                this.handleIfActive(() => {
                    // Keep drag previews visible if dragging is active
                    if (!this.isActionDown) {
                        // Clear any drag previews only if not dragging
                        document.querySelectorAll('.drag-preview').forEach(cell => {
                            cell.classList.remove('drag-preview');
                        });
                        
                        this.lastAction = null;
                        this.dragStartCell = null;
                        this.dragDirection = null;
                    }
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
                        this.currentAction = { cells: [] };
                        for (let row = 0; row < this.size; row++) {
                            const cell = document.getElementById(`cell-${row}-${col}`);
                            if (!cell.classList.contains('clicked')) {
                                this.recordCellState(cell);
                                cell.classList.remove('marked');
                                cell.classList.add('greyed');
                                this.actionedCols.add(col);
                                this.actionedRows.add(row);
                            }
                        }
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
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
                        this.currentAction = { cells: [] };
                        for (let col = 0; col < this.size; col++) {
                            const cell = document.getElementById(`cell-${row}-${col}`);
                            if (!cell.classList.contains('clicked')) {
                                this.recordCellState(cell);
                                cell.classList.remove('marked');
                                cell.classList.add('greyed');
                                this.actionedCols.add(col);
                                this.actionedRows.add(row);
                            }
                        }
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    }
                });
            });
        });

        const corner = document.getElementById('corner');
        if (corner) {
            corner.addEventListener('click', () => {
                this.reset();
            });
        }
    }

    // separated per cell logic and key logic becaues when reseting using the enter key, reset would call 
    // main key action, which would create a new keydown listener, so when reseting again it would call double the 
    // number of listeners each time. so now mainKeyActions is only called once in the constructor, while mainGameActions
    // can be called everytime in reset()
    mainKeyActions(){
        document.addEventListener('keydown', (e) => {
            if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) {
                const activeEl = document.activeElement;
                if (activeEl && activeEl.id === 'seed-input') {
                    e.preventDefault();
                    const seedInput = document.getElementById('seed-input');
                    const loadPanel = document.getElementById('load-panel');
                    const confirmBtn = document.getElementById('seed-confirm');
                    const seedStr = seedInput ? seedInput.value.trim() : '';
                    if (!seedStr) return;
                    try {
                        this.loadSeed(seedStr);
                        if (loadPanel) loadPanel.classList.add('hidden');
                        if (seedInput) seedInput.value = '';
                    } catch (err) {
                        if (confirmBtn) {
                            confirmBtn.textContent = 'invalid';
                            setTimeout(() => confirmBtn.textContent = 'y', 900);
                        }
                    }
                    return;
                }
                this.reset();
                return;
            }
            
            this.handleIfActive(() => {
                if (e.repeat) return;  // prevent repeats when holding down
                if (e.code === 'Space') {
                    e.preventDefault();
                    this.undo();
                }
                else if ((['KeyW', 'KeyS', 'KeyX'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionClickKeyboard();
                }
                else if ((['KeyE', 'KeyD', 'KeyC'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionMarkKeyboard();
                }
                else if ((['KeyR', 'KeyF', 'KeyV'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionGreyKeyboard();
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
                    // Only apply drag actions if we actually dragged to other cells
                    if (this.isActionDown && this.dragStartCell && this.dragDirection && this.lastValidDragCell) {
                        // This was a drag operation that moved to other cells
                        this.applyDragActions();
                    }
                    // If no dragDirection or no lastValidDragCell, it was just a single click
                    // Single click action already applied on keydown, just need to finalize
                    
                    this.isActionDown = false;
                    this.lastAction = null;
                    this.dragStartCell = null;
                    this.dragDirection = null;
                    this.inputMethod = null;
                    this.lastValidDragCell = null;

                    // For single clicks, action already applied on keydown, but still need to update completion
                    // For drags, applyDragActions() already handles updates and game end check
                    if (!this.dragDirection) {
                        // Single click - update completion status and check game end
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    } else {
                        // Drag operation - update all cells and check game end
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    }
                }
            });
        });

        // Prevent right-click context menu globally except on links and home button
        document.addEventListener('contextmenu', (e) => {
            // Allow context menu on links (a tags)
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            
            // Allow context menu on home button (check for common home button identifiers)
            if (e.target.id === 'home-button' || 
                e.target.classList.contains('home-button') ||
                e.target.closest('#home-button') ||
                e.target.closest('.home-button')) {
                return;
            }
            
            // Prevent context menu everywhere else
            e.preventDefault();
        });

        // Add global mouseup event listener
        document.addEventListener('mouseup', (e) => {
            this.handleIfActive(() => {
                // Only apply drag actions if we actually dragged to other cells
                if (this.isActionDown && this.dragStartCell && this.dragDirection && this.lastValidDragCell) {
                    // This was a drag operation that moved to other cells
                    this.applyDragActions();
                }
                // If no dragDirection or no lastValidDragCell, it was just a single click
                // Single click action already applied on mousedown, just need to finalize
                
                this.isActionDown = false;
                this.lastAction = null;
                this.dragStartCell = null;
                this.dragDirection = null;
                this.inputMethod = null;
                this.lastValidDragCell = null;

                // For single clicks, action already applied on mousedown, but still need to update completion
                // For drags, applyDragActions() already handles updates and game end check
                if (!this.dragDirection) {
                    // Single click - update completion status and check game end
                    this.updateAllCells();
                    this.checkGameEnd();
                    this.finalizeAction();
                } else {
                    // Drag operation - update all cells and check game end
                    this.updateAllCells();
                    this.checkGameEnd();
                    this.finalizeAction();
                }
            });
        });
    }

    applyLastAction() {
        const cell = this.hoveredCell;
        this.recordCellState(cell);
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

    recordCellState(cell) {
        if (!this.currentAction) return;
        const row = cell.dataset.row;
        const col = cell.dataset.col;
        if (this.currentAction.cells.some(c => c.row === row && c.col === col)) return;
        let prevState = '';
        if (cell.classList.contains('clicked')) prevState = 'clicked';
        else if (cell.classList.contains('marked')) prevState = 'marked';
        else if (cell.classList.contains('greyed')) prevState = 'greyed';
        this.currentAction.cells.push({ row, col, prevState });
    }

    finalizeAction() {
        if (this.currentAction && this.currentAction.cells.length) {
            this.history.push(this.currentAction);
        }
        this.currentAction = null;
    }

    undo() {
        if (!this.history.length) return;
        const action = this.history.pop();
        action.cells.forEach(({ row, col, prevState }) => {
            const cell = document.getElementById(`cell-${row}-${col}`);
            const wasClicked = cell.classList.contains('clicked');
            cell.classList.remove('clicked', 'marked', 'greyed');
            if (prevState) cell.classList.add(prevState);
            const isClicked = cell.classList.contains('clicked');
            if (wasClicked && !isClicked) this.numActivatedCells--;
            else if (!wasClicked && isClicked) this.numActivatedCells++;
            this.actionedCols.add(col);
            this.actionedRows.add(row);
        });
        this.updateAllCells();
        this.checkGameEnd();
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
        // Block if keyboard action is already active
        if (this.inputMethod === 'keyboard') return;
        
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'clicked';
        this.currentAction = { cells: [] };
        this.dragStartCell = this.hoveredCell;
        this.dragDirection = null;
        this.inputMethod = 'mouse';
        
        // Apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'greyed');
        this.hoveredCell.classList.toggle('clicked');
        
        this.updateCell();
        this.checkGameEnd();
        
        // Don't show preview for single clicks - only when actually dragging
    }

    actionGrey() {
        // Block if keyboard action is already active
        if (this.inputMethod === 'keyboard') return;
        
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'greyed';
        this.currentAction = { cells: [] };
        this.dragStartCell = this.hoveredCell;
        this.dragDirection = null;
        this.inputMethod = 'mouse';
        
        // Apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'clicked');
        this.hoveredCell.classList.toggle('greyed');
        
        this.updateCell();
        this.checkGameEnd();
        
        // Don't show preview for single clicks - only when actually dragging
    }

    actionMark() {
        // Block if keyboard action is already active
        if (this.inputMethod === 'keyboard') return;
        
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'marked';
        this.currentAction = { cells: [] };
        this.dragStartCell = this.hoveredCell;
        this.dragDirection = null;
        this.inputMethod = 'mouse';
        
        // Apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'clicked');
        this.hoveredCell.classList.toggle('marked');
        
        this.updateCell();
        this.checkGameEnd();
        
        // Don't show preview for single clicks - only when actually dragging
    }

    actionClickKeyboard() {
        // Block if mouse action is already active
        if (this.inputMethod === 'mouse') return;
        
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'clicked';
        this.currentAction = { cells: [] };
        this.dragStartCell = this.hoveredCell;
        this.dragDirection = null;
        this.inputMethod = 'keyboard';
        
        // Apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'greyed');
        this.hoveredCell.classList.toggle('clicked');
        
        this.updateCell();
        this.checkGameEnd();
        
        // Don't show preview for single clicks - only when actually dragging
    }

    actionGreyKeyboard() {
        // Block if mouse action is already active
        if (this.inputMethod === 'mouse') return;
        
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'greyed';
        this.currentAction = { cells: [] };
        this.dragStartCell = this.hoveredCell;
        this.dragDirection = null;
        this.inputMethod = 'keyboard';
        
        // Apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'clicked');
        this.hoveredCell.classList.toggle('greyed');
        
        this.updateCell();
        this.checkGameEnd();
        
        // Don't show preview for single clicks - only when actually dragging
    }

    actionMarkKeyboard() {
        // Block if mouse action is already active
        if (this.inputMethod === 'mouse') return;
        
        if (this.firstKey) {
            this.firstKey = false;
            this.startTimer();
        }
        this.isActionDown = true;
        this.lastAction = 'marked';
        this.currentAction = { cells: [] };
        this.dragStartCell = this.hoveredCell;
        this.dragDirection = null;
        this.inputMethod = 'keyboard';
        
        // Apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('greyed', 'clicked');
        this.hoveredCell.classList.toggle('marked');
        
        this.updateCell();
        this.checkGameEnd();
        
        // Don't show preview for single clicks - only when actually dragging
    }

    showDragPreview() {
        // Show visual feedback only during actual drag operations
        // Don't show preview for single clicks
        if (this.dragStartCell && this.dragDirection) {
            // Clear previous previews
            document.querySelectorAll('.drag-preview').forEach(cell => {
                cell.classList.remove('drag-preview');
            });
            
            // Use hoveredCell if available, otherwise use lastValidDragCell
            const currentCell = this.hoveredCell || this.lastValidDragCell;
            
            // If we have a direction and a current cell (hovered or last valid), show the full path
            if (currentCell) {
                const startRow = this.dragStartCell.dataset.row;
                const startCol = this.dragStartCell.dataset.col;
                const currentRow = currentCell.dataset.row;
                const currentCol = currentCell.dataset.col;
                
                // Update lastValidDragCell if we have a hoveredCell
                if (this.hoveredCell) {
                    this.lastValidDragCell = this.hoveredCell;
                }
                
                // Show preview for the entire drag path
                if (this.dragDirection === 'row') {
                    const startIdx = Math.min(startCol, currentCol);
                    const endIdx = Math.max(startCol, currentCol);
                    for (let col = startIdx; col <= endIdx; col++) {
                        const cell = document.getElementById(`cell-${startRow}-${col}`);
                        if (cell) {
                            cell.classList.add('drag-preview');
                        }
                    }
                } else if (this.dragDirection === 'col') {
                    const startIdx = Math.min(startRow, currentRow);
                    const endIdx = Math.max(startRow, currentRow);
                    for (let row = startIdx; row <= endIdx; row++) {
                        const cell = document.getElementById(`cell-${row}-${startCol}`);
                        if (cell) {
                            cell.classList.add('drag-preview');
                        }
                    }
                }
            }
        }
    }

    applyDragActions() {
        // Apply the drag action to all cells that currently have drag-preview class
        if (!this.lastAction) return;
        
        // Find all cells with drag-preview class and apply the action
        const previewCells = document.querySelectorAll('.drag-preview');
        previewCells.forEach(cell => {
            // Skip the drag start cell if it already has the action applied
            // This prevents double-application for single clicks
            if (cell === this.dragStartCell) {
                // Just mark it for updates without re-applying the action
                const row = cell.dataset.row;
                const col = cell.dataset.col;
                this.actionedCols.add(col);
                this.actionedRows.add(row);
                return;
            }
            
            this.recordCellState(cell);
            this.applyLastActionToCell(cell);
            
            // Mark the affected row and column for updates
            const row = cell.dataset.row;
            const col = cell.dataset.col;
            this.actionedCols.add(col);
            this.actionedRows.add(row);
        });
        
        // Clear all drag preview classes
        previewCells.forEach(cell => {
            cell.classList.remove('drag-preview');
        });
        
        // Update the affected cells
        this.updateAllCells();
    }

    applyLastActionToCell(cell) {
        // Apply the last action to a specific cell with toggle behavior
        const wasClicked = cell.classList.contains('clicked');
        const wasMarked = cell.classList.contains('marked');
        const wasGreyed = cell.classList.contains('greyed');
        
        // Remove all existing states
        cell.classList.remove('clicked', 'marked', 'greyed');
        
        switch (this.lastAction) {
            case 'clicked':
                if (wasClicked) {
                    // If cell was already clicked, make it empty (toggle off)
                    if (wasClicked) {
                        this.numActivatedCells--;
                    }
                } else {
                    // If cell wasn't clicked, make it clicked
                    cell.classList.add('clicked');
                    this.numActivatedCells++;
                }
                break;
            case 'greyed':
                if (wasGreyed) {
                    // If cell was already greyed, make it empty (toggle off)
                    // No change to numActivatedCells since greyed cells don't count
                } else {
                    // If cell wasn't greyed, make it greyed
                    cell.classList.add('greyed');
                    if (wasClicked) {
                        this.numActivatedCells--;
                    }
                }
                break;
            case 'marked':
                if (wasMarked) {
                    // If cell was already marked, make it empty (toggle off)
                    // No change to numActivatedCells since marked cells don't count
                } else {
                    // If cell wasn't marked, make it marked
                    cell.classList.add('marked');
                    if (wasClicked) {
                        this.numActivatedCells--;
                    }
                }
                break;
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

        // For zero columns, check if they're actually empty
        if (this.topNums[col].length === 1 && this.topNums[col][0] === 0) {
            // Only mark as complete if there are no filled cells
            if (this.isColComplete(col)) {
                this.colCompleteFlags[col] = true;
                workingCol.classList.add('complete');
            } else {
                this.colCompleteFlags[col] = false;
                workingCol.classList.remove('complete');
            }
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

        // For zero rows, check if they're actually empty
        if (this.sideNums[row].length === 1 && this.sideNums[row][0] === 0) {
            // Only mark as complete if there are no filled cells
            if (this.isRowComplete(row)) {
                this.rowCompleteFlags[row] = true;
                workingRow.classList.add('complete');
            } else {
                this.rowCompleteFlags[row] = false;
                workingRow.classList.remove('complete');
            }
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
            // Only clicked cells count for completion - greyed and marked are just hints
            slice[row] = cell.classList.contains('clicked') ? 1 : 0;
        }

        return slice
    }

    getRowSlice(row) {
        const ROW = row;
        const slice = new Array(this.size).fill(0)
        for (let col=0; col<this.size; col++){
            let id = `cell-${ROW}-${col}`;
            const cell = document.getElementById(id);
            // Only clicked cells count for completion - greyed and marked are just hints
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
        const resetHint = document.getElementById('reset-hint');

        const hasCompletedFirstBoard = localStorage.getItem('NONO-first-board-completed');
        const isFirstTime = !hasCompletedFirstBoard;

        if (isFirstTime && resetHint) {
            resetHint.textContent = 'press enter or click the corner of the board to reset.';
            resetHint.classList.remove('hidden');
        } else if (resetHint) {
            resetHint.classList.add('hidden');
        }

        localStorage.setItem('NONO-first-board-completed', 'true');

        // Build seed from current generated layout
        let seedStr = '';
        try {
            seedStr = window.Seed ? window.Seed.createSeedFromLayout(this.possibleLayout, this.size) : '';
        } catch (e) {
            seedStr = '';
        }

        // Display time (keep UI minimal) – seed is included in share text below
        if (timerElement) timerElement.textContent = `${timeString}`;

        const plainText = `NONO ${this.size}\n${timeString}${seedStr ? `\n${seedStr}` : ''}`;


        const shareButton = document.getElementById('copy-button');
        if (shareButton) shareButton.classList.remove('hidden');

        // use onclick instead of addEventListener to prevent duplicate listeners
        if (shareButton) {
            shareButton.onclick = () => {
                navigator.clipboard.writeText(plainText);
                shareButton.textContent = 'copied';
                setTimeout(() => shareButton.textContent = 'share', 1000);
            };
            // ensure visible
            shareButton.classList.remove('hidden');
        }
            
        // display popup by removing hidden
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