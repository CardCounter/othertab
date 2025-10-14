// settings panel
document.addEventListener('DOMContentLoaded', () => {
    const settingsButton = document.getElementById('settings-button');
    const settingsPanel = document.getElementById('settings-panel');
    const loadPanel = document.getElementById('load-panel');

    settingsButton.addEventListener('click', (e) => {
        const isHidden = settingsPanel.classList.contains('hidden');
        if (isHidden) {
            settingsPanel.classList.remove('hidden');
            if (loadPanel) {
                loadPanel.classList.add('hidden');
            }
        } else {
            settingsPanel.classList.add('hidden');
        }
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
            // fallback if size buttons not yet in dom
            this.size = 15;
            document.documentElement.style.setProperty('--num-font-size', '16px');
        }

        const settingsPanelEl = document.getElementById('settings-panel');
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

                settingsPanelEl?.classList.add('hidden');

            });
        });

        this.possibleLayout = this.getLayout(this.size);
        this.numActivatedCellsMaster = this.getNumActivatedCells(this.possibleLayout);
        this.numActivatedCells = 0;
        [this.topNums, this.sideNums] = this.getNums();

        this.hoveredCell = null;
        this.lastValidDragCell = null; // track last valid drag position
        this.isActionDown = false;
        this.lastAction = null;
        this.dragStartCell = null;
        this.dragDirection = null;
        this.inputMethod = null; // track whether current action is keyboard or mouse
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);
        this.actionedCols = new Set();
        this.actionedRows = new Set();

        this.firstKey = true;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;
        this.maxTimerSeconds = (99 * 3600) + (59 * 60) + 59;

        this.history = [];
        this.currentAction = null;

        this.clueOverflowFrame = null;
        this.activeClueCell = null;
        this.clueTooltipEl = null;
        this.ensureClueTooltipElement();
        this.boundHandleResize = () => {
            this.syncTableSizes();
            this.scheduleClueOverflowCheck();
            this.updateClueTooltipPosition();
        };
        this.boundHandleScroll = () => {
            this.updateClueTooltipPosition();
        };
        window.addEventListener('resize', this.boundHandleResize);
        window.addEventListener('scroll', this.boundHandleScroll, { passive: true });

        this.initializeTable();
        this.syncTableSizes();
        this.mainGameActions();
        this.mainKeyActions();

        // ensure seed/load buttons exist even if not in html
        this.ensureSeedLoadButtons();
        // seed / load ui
        this.initSeedControls();
    }

    ensureSeedLoadButtons() {
        const footer = document.querySelector('footer');
        const settingsGroup = footer?.querySelector('.settings-group');
        if (!footer || !settingsGroup) return;

        const sizeAnchor = settingsGroup.querySelector('.panel-anchor');

        let seedBtn = document.getElementById('seed-button');
        if (!seedBtn) {
            seedBtn = document.createElement('button');
            seedBtn.id = 'seed-button';
            seedBtn.className = 'settings-button';
            seedBtn.textContent = 'seed';
            if (sizeAnchor?.nextSibling) {
                settingsGroup.insertBefore(seedBtn, sizeAnchor.nextSibling);
            } else {
                settingsGroup.appendChild(seedBtn);
            }
        }

        let loadBtn = document.getElementById('load-button');
        let loadAnchor = loadBtn?.closest('.panel-anchor') ?? null;
        if (!loadBtn) {
            loadAnchor = document.createElement('div');
            loadAnchor.className = 'panel-anchor';
            loadBtn = document.createElement('button');
            loadBtn.id = 'load-button';
            loadBtn.className = 'settings-button';
            loadBtn.textContent = 'load';
            loadAnchor.appendChild(loadBtn);
            settingsGroup.appendChild(loadAnchor);
        } else if (!loadAnchor) {
            loadAnchor = document.createElement('div');
            loadAnchor.className = 'panel-anchor';
            loadBtn.replaceWith(loadAnchor);
            loadAnchor.appendChild(loadBtn);
            settingsGroup.appendChild(loadAnchor);
        }

        // ensure load panel exists and is inside the anchor
        let loadPanel = document.getElementById('load-panel');
        if (!loadPanel) {
            loadPanel = document.createElement('div');
            loadPanel.id = 'load-panel';
            loadPanel.className = 'settings-panel hidden';
            loadPanel.style.gap = '0.5rem';
            loadPanel.style.padding = '0.5rem';
            loadPanel.innerHTML = `
                <input id="seed-input" type="text" placeholder="enter seed" style="width: 100%;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            `;
        }

        if (loadAnchor) {
            loadAnchor.appendChild(loadPanel);
        } else {
            settingsGroup.appendChild(loadPanel);
        }
    }

    initSeedControls() {
        const seedBtn = document.getElementById('seed-button');
        const loadBtn = document.getElementById('load-button');
        const loadPanelEl = document.getElementById('load-panel');
        const seedInput = document.getElementById('seed-input');
        const sizeBtn = document.getElementById('settings-button');
        let copyResetTimer = null;

        const setCopyInterlock = (locked) => {
            [sizeBtn, loadBtn].forEach(btn => {
                if (!btn) return;
                btn.disabled = locked;
                if (locked) {
                    btn.setAttribute('aria-disabled', 'true');
                } else {
                    btn.removeAttribute('aria-disabled');
                }
            });
        };

        const hideLoadPanel = () => {
            if (!loadPanelEl || !seedInput) return;
            loadPanelEl.classList.add('hidden');
            seedInput.value = '';
        };

        if (seedBtn) {
            seedBtn.addEventListener('click', async () => {
                const settingsPanel = document.getElementById('settings-panel');
                settingsPanel?.classList.add('hidden');
                hideLoadPanel();
                try {
                    const seedStr = window.Seed ? window.Seed.createSeedFromLayout(this.possibleLayout, this.size) : '';
                    if (!seedStr) return;

                    if (!navigator.clipboard || !navigator.clipboard.writeText) {
                        return;
                    }
                    setCopyInterlock(true);
                    if (copyResetTimer) {
                        clearTimeout(copyResetTimer);
                        copyResetTimer = null;
                    }
                    await navigator.clipboard.writeText(seedStr);
                    seedBtn.textContent = 'copied';
                    copyResetTimer = setTimeout(() => {
                        seedBtn.textContent = 'seed';
                        setCopyInterlock(false);
                        copyResetTimer = null;
                    }, 1000);
                } catch (e) {
                    if (copyResetTimer) {
                        clearTimeout(copyResetTimer);
                        copyResetTimer = null;
                    }
                    seedBtn.textContent = 'seed';
                    setCopyInterlock(false);
                }
            });
        }

        if (loadBtn && loadPanelEl && seedInput) {
            let suppressNextOpen = false;

            const markToggleIntent = () => {
                suppressNextOpen = !loadPanelEl.classList.contains('hidden');
            };

            loadBtn.addEventListener('pointerdown', markToggleIntent);
            loadBtn.addEventListener('mousedown', markToggleIntent);
            loadBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    markToggleIntent();
                }
            });

            loadBtn.addEventListener('click', () => {
                // show the panel above buttons without hiding them
                if (suppressNextOpen) {
                    suppressNextOpen = false;
                    hideLoadPanel();
                    return;
                }
                const isHidden = loadPanelEl.classList.contains('hidden');
                if (isHidden) {
                    loadPanelEl.classList.remove('hidden');
                    try {
                        seedInput.focus({ preventScroll: true });
                    } catch (_) {
                        seedInput.focus();
                    }
                } else {
                    hideLoadPanel();
                }
                const settingsPanel = document.getElementById('settings-panel');
                settingsPanel?.classList.add('hidden');
            });

            seedInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const seedStr = seedInput.value.trim();
                    if (!seedStr) {
                        hideLoadPanel();
                        return;
                    }
                    try {
                        this.loadSeed(seedStr);
                        hideLoadPanel();
                    } catch (e) {
                        // invalid seed; leave panel open for correction
                    }
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    hideLoadPanel();
                }
            });

            seedInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (!loadPanelEl.contains(document.activeElement)) {
                        hideLoadPanel();
                    }
                }, 0);
            });
        }
    }

    loadSeed(seedString) {
        if (!window.Seed) throw new Error('Seed helpers not available');
        const { size, layoutArray } = window.Seed.parseSeed(seedString);

        // map size to a difficulty button id
        const buttonId = `difficulty-${size}`;
        const button = document.getElementById(buttonId);
        if (!button) throw new Error('Unsupported size in seed');

        // update selected size button in the ui
        document.querySelectorAll('.difficulty-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // update size and ui font
        this.sizeMode = buttonId;
        localStorage.setItem('NONO-currentSize', buttonId);
        this.size = size;
        document.documentElement.style.setProperty('--num-font-size', button.dataset.font);

        // set layout from seed
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
        this.lastValidDragCell = null; // track last valid drag position
        this.isActionDown = false;
        this.lastAction = null;
        this.dragStartCell = null;
        this.dragDirection = null;
        this.inputMethod = null;
        this.colCompleteFlags = new Array(this.size).fill(false);
        this.rowCompleteFlags = new Array(this.size).fill(false);
        this.actionedCols = new Set();
        this.actionedRows = new Set();

        // ensure timer is fully reset and stopped until first interaction
        this.stopTimer();
        this.firstKey = true;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;
        const timerElement = document.getElementById('timer');
        if (timerElement) timerElement.textContent = '0:00';
        
        this.history = [];
        this.currentAction = null;
        this.hideClueTooltip();

        // clear any drag previews
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
        this.lastValidDragCell = null; // track last valid drag position
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
        this.hideClueTooltip();

        // clear any drag previews
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
                                // show initial preview when direction is determined
                                this.showDragPreview();
                            } else {
                                // always show drag preview when drag is active, regardless of cursor position
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
                    this.handleClick(e); // dont pass in cell, use this.hovercell and check for null in handle
                });
            });

            cell.addEventListener('mouseup', (e) => {
                this.handleIfActive(() => {
                    // only apply drag actions if we actually dragged to other cells
                    if (this.isActionDown && this.dragStartCell && this.dragDirection && this.lastValidDragCell) {
                        // this was a drag operation that moved to other cells
                        this.applyDragActions();
                    }
                    // if no dragdirection or no lastvaliddragcell, it was just a single click
                    // single click action already applied on mousedown, just need to finalize
                    
                    this.isActionDown = false;
                    this.lastAction = null;
                    this.dragStartCell = null;
                    this.dragDirection = null;
                    this.inputMethod = null;
                    this.lastValidDragCell = null;

                    // for single clicks, action already applied on mousedown, but still need to update completion
                    // for drags, applydragactions() already handles updates and game end check
                    if (!this.dragDirection) {
                        // single click, update completion status and check game end
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    } else {
                        // drag operation, update all cells and check game end
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

        // track mouse position for continuous drag preview
        gameContainer.addEventListener('mousemove', (e) => {
            this.handleIfActive(() => {
                if (this.isActionDown && this.dragStartCell) {
                    // update drag preview continuously while dragging
                    // this maintains preview even when cursor is outside grid cells
                    this.showDragPreview();
                }
            });
        });

        // end click and drag when leaving main container
        gameContainer.addEventListener('mouseleave', () => {
            this.handleIfActive(() => {
                // keep drag previews visible if dragging is active
                // only clear previews and reset drag state if not actively dragging
                if (!this.isActionDown) {
                    // clear any drag previews only if not dragging
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
                    // keep drag previews visible if dragging is active
                    if (!this.isActionDown) {
                        // clear any drag previews only if not dragging
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
                    // keep drag previews visible if dragging is active
                    if (!this.isActionDown) {
                        // clear any drag previews only if not dragging
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
    // number of listeners each time. so now mainkeyactions is only called once in the constructor, while maingameactions
    // can be called everytime in reset()
    mainKeyActions(){
        document.addEventListener('keydown', (e) => {
            if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) {
                const activeEl = document.activeElement;
                if (activeEl && activeEl.id === 'seed-input') {
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
                else if ((['KeyW'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionClickKeyboard();
                }
                else if ((['KeyE'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionMarkKeyboard();
                }
                else if ((['KeyR'].includes(e.code)) && this.hoveredCell) {
                    e.preventDefault();
                    this.actionGreyKeyboard();
                }
            });
        });

        document.addEventListener('keyup', (e) => {
            this.handleIfActive(() => {
                if (e.code === 'KeyW' || e.code === 'KeyE' || e.code === 'KeyR') {
                    e.preventDefault();
                    // only apply drag actions if we actually dragged to other cells
                    if (this.isActionDown && this.dragStartCell && this.dragDirection && this.lastValidDragCell) {
                        // this was a drag operation that moved to other cells
                        this.applyDragActions();
                    }
                    // if no dragdirection or no lastvaliddragcell, it was just a single click
                    // single click action already applied on keydown, just need to finalize
                    
                    this.isActionDown = false;
                    this.lastAction = null;
                    this.dragStartCell = null;
                    this.dragDirection = null;
                    this.inputMethod = null;
                    this.lastValidDragCell = null;

                    // for single clicks, action already applied on keydown, but still need to update completion
                    // for drags, applydragactions() already handles updates and game end check
                    if (!this.dragDirection) {
                        // single click, update completion status and check game end
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    } else {
                        // drag operation, update all cells and check game end
                        this.updateAllCells();
                        this.checkGameEnd();
                        this.finalizeAction();
                    }
                }
            });
        });

        // prevent right,click context menu globally except on links and home button
        document.addEventListener('contextmenu', (e) => {
            // allow context menu on links (a tags)
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            
            // allow context menu on home button (check for common home button identifiers)
            if (e.target.id === 'home-button' || 
                e.target.classList.contains('home-button') ||
                e.target.closest('#home-button') ||
                e.target.closest('.home-button')) {
                return;
            }
            
            // prevent context menu everywhere else
            e.preventDefault();
        });

        // add global mouseup event listener
        document.addEventListener('mouseup', (e) => {
            this.handleIfActive(() => {
                // only apply drag actions if we actually dragged to other cells
                if (this.isActionDown && this.dragStartCell && this.dragDirection && this.lastValidDragCell) {
                    // this was a drag operation that moved to other cells
                    this.applyDragActions();
                }
                // if no dragdirection or no lastvaliddragcell, it was just a single click
                // single click action already applied on mousedown, just need to finalize
                
                this.isActionDown = false;
                this.lastAction = null;
                this.dragStartCell = null;
                this.dragDirection = null;
                this.inputMethod = null;
                this.lastValidDragCell = null;

                // for single clicks, action already applied on mousedown, but still need to update completion
                // for drags, applydragactions() already handles updates and game end check
                if (!this.dragDirection) {
                    // single click, update completion status and check game end
                    this.updateAllCells();
                    this.checkGameEnd();
                    this.finalizeAction();
                } else {
                    // drag operation, update all cells and check game end
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
        // block if keyboard action is already active
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
        
        // apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'greyed');
        this.hoveredCell.classList.toggle('clicked');
        
        this.updateCell();
        this.updateAllCells();
        this.checkGameEnd();
        
        // dont show preview for single clicks, only when actually dragging
    }

    actionGrey() {
        // block if keyboard action is already active
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
        
        // apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'clicked');
        this.hoveredCell.classList.toggle('greyed');
        
        this.updateCell();
        this.updateAllCells();
        this.checkGameEnd();
        
        // dont show preview for single clicks, only when actually dragging
    }

    actionMark() {
        // block if keyboard action is already active
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
        
        // apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('greyed', 'clicked');
        this.hoveredCell.classList.toggle('marked');
        
        this.updateCell();
        this.updateAllCells();
        this.checkGameEnd();
        
        // dont show preview for single clicks, only when actually dragging
    }

    actionClickKeyboard() {
        // block if mouse action is already active
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
        
        // apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'greyed');
        this.hoveredCell.classList.toggle('clicked');
        
        this.updateCell();
        this.updateAllCells();
        this.checkGameEnd();
        
        // dont show preview for single clicks, only when actually dragging
    }

    actionGreyKeyboard() {
        // block if mouse action is already active
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
        
        // apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('marked', 'clicked');
        this.hoveredCell.classList.toggle('greyed');
        
        this.updateCell();
        this.updateAllCells();
        this.checkGameEnd();
        
        // dont show preview for single clicks, only when actually dragging
    }

    actionMarkKeyboard() {
        // block if mouse action is already active
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
        
        // apply action immediately for single clicks
        this.recordCellState(this.hoveredCell);
        this.hoveredCell.classList.remove('greyed', 'clicked');
        this.hoveredCell.classList.toggle('marked');
        
        this.updateCell();
        this.updateAllCells();
        this.checkGameEnd();
        
        // dont show preview for single clicks, only when actually dragging
    }

    showDragPreview() {
        // show visual feedback only during actual drag operations
        // dont show preview for single clicks
        if (this.dragStartCell && this.dragDirection) {
            // clear previous previews
            document.querySelectorAll('.drag-preview').forEach(cell => {
                cell.classList.remove('drag-preview');
            });
            
            // use hoveredcell if available, otherwise use lastvaliddragcell
            const currentCell = this.hoveredCell || this.lastValidDragCell;
            
            // if we have a direction and a current cell (hovered or last valid), show the full path
            if (currentCell) {
                const startRow = this.dragStartCell.dataset.row;
                const startCol = this.dragStartCell.dataset.col;
                const currentRow = currentCell.dataset.row;
                const currentCol = currentCell.dataset.col;
                
                // update lastvaliddragcell if we have a hoveredcell
                if (this.hoveredCell) {
                    this.lastValidDragCell = this.hoveredCell;
                }
                
                // show preview for the entire drag path
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
        // apply the drag action to all cells that currently have drag,preview class
        if (!this.lastAction) return;
        
        // find all cells with drag,preview class and apply the action
        const previewCells = document.querySelectorAll('.drag-preview');
        previewCells.forEach(cell => {
            // skip the drag start cell if it already has the action applied
            // this prevents double,application for single clicks
            if (cell === this.dragStartCell) {
                // just mark it for updates without re,applying the action
                const row = cell.dataset.row;
                const col = cell.dataset.col;
                this.actionedCols.add(col);
                this.actionedRows.add(row);
                return;
            }
            
            this.recordCellState(cell);
            this.applyLastActionToCell(cell);
            
            // mark the affected row and column for updates
            const row = cell.dataset.row;
            const col = cell.dataset.col;
            this.actionedCols.add(col);
            this.actionedRows.add(row);
        });
        
        // clear all drag preview classes
        previewCells.forEach(cell => {
            cell.classList.remove('drag-preview');
        });
        
        // update the affected cells
        this.updateAllCells();
    }

    applyLastActionToCell(cell) {
        // apply the last action to a specific cell with toggle behavior
        const wasClicked = cell.classList.contains('clicked');
        const wasMarked = cell.classList.contains('marked');
        const wasGreyed = cell.classList.contains('greyed');
        
        // remove all existing states
        cell.classList.remove('clicked', 'marked', 'greyed');
        
        switch (this.lastAction) {
            case 'clicked':
                if (wasClicked) {
                    // if cell was already clicked, make it empty (toggle off)
                    if (wasClicked) {
                        this.numActivatedCells--;
                    }
                } else {
                    // if cell wasnt clicked, make it clicked
                    cell.classList.add('clicked');
                    this.numActivatedCells++;
                }
                break;
            case 'greyed':
                if (wasGreyed) {
                    // if cell was already greyed, make it empty (toggle off)
                    // no change to numactivatedcells since greyed cells dont count
                } else {
                    // if cell wasnt greyed, make it greyed
                    cell.classList.add('greyed');
                    if (wasClicked) {
                        this.numActivatedCells--;
                    }
                }
                break;
            case 'marked':
                if (wasMarked) {
                    // if cell was already marked, make it empty (toggle off)
                    // no change to numactivatedcells since marked cells dont count
                } else {
                    // if cell wasnt marked, make it marked
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

        const wrapClueContent = (content) => `<span class="clue-text">${content}</span><span class="clue-indicator" aria-hidden="true">*</span>`;
        const getTooltip = (list) => list.join(' ');

        let html = '';

        // top row
        html += '<tr><td class="corner" id="corner"></td>';
        for (let col = 0; col < cols - 1; col++) { //,1 bc added corner
            let topNumValue = this.topNumToString(topNums[col]);
            let topClass = 'top';
            if (topNums[col].length === 1 && topNums[col][0] === 0) {
                topClass = 'top complete';
                if (this.colCompleteFlags) {
                    this.colCompleteFlags[col] = true;
                }
            }
            const expectedLines = Math.max(1, topNums[col].length);
            const tooltip = getTooltip(topNums[col]);
            html += `<td class="${topClass}" id="top-${col}" data-col="${col}" data-expected-lines="${expectedLines}" data-clue-tooltip="${tooltip}">${wrapClueContent(topNumValue)}</td>`;
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
                    const tooltip = getTooltip(sideNums[row]);
                    html += `<td class="${sideClass}" id="side-${row}" data-row="${row}" data-expected-lines="1" data-clue-tooltip="${tooltip}">${wrapClueContent(sideNumValue)}</td>`;
                }
                else {
                    html += `<td class="cell" id="cell-${row}-${col - 1}" data-row="${row}" data-col="${col - 1}"></td>`; //,1 side offset
                }
            }

            html += '</tr>';
        }

        gameElement.innerHTML = html;
        this.attachClueTooltipHandlers();
        this.scheduleClueOverflowCheck();
    }

    ensureClueTooltipElement() {
        if (this.clueTooltipEl && document.body.contains(this.clueTooltipEl)) {
            return;
        }

        let tooltipEl = document.getElementById('clue-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'clue-tooltip';
            tooltipEl.className = 'clue-tooltip';
            tooltipEl.setAttribute('role', 'tooltip');
            tooltipEl.setAttribute('aria-hidden', 'true');
            document.body.appendChild(tooltipEl);
        } else {
            tooltipEl.classList.add('clue-tooltip');
            tooltipEl.setAttribute('role', 'tooltip');
            tooltipEl.setAttribute('aria-hidden', 'true');
        }

        tooltipEl.classList.remove('visible');
        tooltipEl.textContent = '';
        this.clueTooltipEl = tooltipEl;
    }

    attachClueTooltipHandlers() {
        const clueCells = document.querySelectorAll('.top, .side');
        clueCells.forEach(cell => {
            cell.addEventListener('mouseenter', () => this.handleClueTooltipEnter(cell));
            cell.addEventListener('mouseleave', () => this.handleClueTooltipLeave(cell));
            cell.addEventListener('focus', () => this.handleClueTooltipEnter(cell));
            cell.addEventListener('blur', () => this.handleClueTooltipLeave(cell));
        });
    }

    handleClueTooltipEnter(cell) {
        if (!cell.classList.contains('clue-overflow')) {
            this.hideClueTooltip();
            return;
        }

        this.activeClueCell = cell;
        this.showClueTooltip(cell);
    }

    handleClueTooltipLeave(cell) {
        if (this.activeClueCell === cell) {
            this.hideClueTooltip();
        }
    }

    showClueTooltip(cell) {
        this.ensureClueTooltipElement();
        if (!this.clueTooltipEl) return;

        const tooltip = cell.dataset.clueTooltip || cell.querySelector('.clue-text')?.textContent.trim() || '';
        this.clueTooltipEl.textContent = tooltip;
        if (cell.classList.contains('complete')) {
            this.clueTooltipEl.classList.add('complete');
        } else {
            this.clueTooltipEl.classList.remove('complete');
        }
        this.positionClueTooltip(cell);
        this.clueTooltipEl.classList.add('visible');
        this.clueTooltipEl.setAttribute('aria-hidden', 'false');
        this.adjustClueTooltipForViewport();
    }

    positionClueTooltip(cell) {
        if (!this.clueTooltipEl) return;

        const board = document.getElementById('game-container');
        if (!board) return;

        const boardRect = board.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        const offset = 16;
        const scrollLeft = window.scrollX || window.pageXOffset || 0;
        const scrollTop = window.scrollY || window.pageYOffset || 0;

        const isTopClue = cell.classList.contains('top');
        this.clueTooltipEl.style.whiteSpace = isTopClue ? 'nowrap' : 'normal';
        this.clueTooltipEl.style.maxWidth = isTopClue ? 'calc(100vw - 32px)' : '';

        const tooltipWidth = this.clueTooltipEl.offsetWidth;
        const tooltipHeight = this.clueTooltipEl.offsetHeight;

        let left = boardRect.left - offset - tooltipWidth + scrollLeft;
        let positionSide = 'left';
        if (left < 8) {
            left = boardRect.right + offset + scrollLeft;
            positionSide = 'right';
        }

        let top;
        if (isTopClue) {
            top = cellRect.bottom + offset + scrollTop;
        } else {
            top = cellRect.top + (cellRect.height - tooltipHeight) / 2 + scrollTop;
        }

        const minTop = scrollTop + 8;
        const maxTop = scrollTop + window.innerHeight - tooltipHeight - 8;
        top = Math.min(Math.max(top, minTop), maxTop);

        this.clueTooltipEl.style.transform = 'none';
        this.clueTooltipEl.style.left = `${left}px`;
        this.clueTooltipEl.style.top = `${top}px`;
        this.clueTooltipEl.dataset.position = positionSide;
    }

    adjustClueTooltipForViewport() {
        if (!this.clueTooltipEl || !this.clueTooltipEl.classList.contains('visible')) {
            return;
        }

        const board = document.getElementById('game-container');
        if (!board) return;

        const boardRect = board.getBoundingClientRect();
        const scrollLeft = window.scrollX || window.pageXOffset || 0;
        const scrollTop = window.scrollY || window.pageYOffset || 0;
        const offset = 16;

        let tooltipRect = this.clueTooltipEl.getBoundingClientRect();

        if (tooltipRect.left < 8 && this.clueTooltipEl.dataset.position !== 'right') {
            const adjustedLeft = boardRect.right + offset + scrollLeft;
            this.clueTooltipEl.style.left = `${adjustedLeft}px`;
            this.clueTooltipEl.dataset.position = 'right';
            tooltipRect = this.clueTooltipEl.getBoundingClientRect();
        } else if (this.clueTooltipEl.dataset.position === 'right') {
            const desiredLeft = boardRect.left - offset - tooltipRect.width + scrollLeft;
            if (desiredLeft >= 8) {
                this.clueTooltipEl.style.left = `${desiredLeft}px`;
                this.clueTooltipEl.dataset.position = 'left';
                tooltipRect = this.clueTooltipEl.getBoundingClientRect();
            }
        }

        if (tooltipRect.right > window.innerWidth - 8) {
            const clampedLeft = window.innerWidth - tooltipRect.width - 8 + scrollLeft;
            this.clueTooltipEl.style.left = `${Math.max(8, clampedLeft)}px`;
            tooltipRect = this.clueTooltipEl.getBoundingClientRect();
        }

        const tooltipHeight = tooltipRect.height;
        const minTop = scrollTop + 8;
        const maxTop = scrollTop + window.innerHeight - tooltipHeight - 8;
        let top = parseFloat(this.clueTooltipEl.style.top || '0');
        if (!Number.isFinite(top)) top = tooltipRect.top + scrollTop;
        if (top < minTop) top = minTop;
        if (top > maxTop) top = maxTop;
        this.clueTooltipEl.style.top = `${top}px`;
    }

    updateClueTooltipPosition() {
        if (!this.activeClueCell || !this.clueTooltipEl || !this.clueTooltipEl.classList.contains('visible')) {
            return;
        }

        if (!document.body.contains(this.activeClueCell)) {
            this.hideClueTooltip();
            return;
        }

        this.positionClueTooltip(this.activeClueCell);
        this.adjustClueTooltipForViewport();
    }

    hideClueTooltip() {
        if (!this.clueTooltipEl) return;

        this.clueTooltipEl.classList.remove('visible');
        this.clueTooltipEl.setAttribute('aria-hidden', 'true');
        this.clueTooltipEl.textContent = '';
        this.clueTooltipEl.classList.remove('complete');
        this.activeClueCell = null;
    }

    scheduleClueOverflowCheck() {
        const raf = window.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
        const caf = window.cancelAnimationFrame ?? window.clearTimeout;

        if (this.clueOverflowFrame) {
            caf(this.clueOverflowFrame);
        }

        this.clueOverflowFrame = raf(() => {
            this.applyClueOverflowIndicators();
            this.clueOverflowFrame = null;
            this.updateClueTooltipPosition();
        });
    }

    applyClueOverflowIndicators() {
        const clueCells = document.querySelectorAll('.top, .side');
        let activeStillOverflow = false;

        clueCells.forEach(cell => {
            cell.classList.remove('clue-overflow');
            cell.removeAttribute('aria-label');
            cell.removeAttribute('tabindex');

            const textEl = cell.querySelector('.clue-text');
            if (!textEl) return;

            const styles = window.getComputedStyle(textEl);
            let lineHeight = parseFloat(styles.lineHeight);
            if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
                const fontSize = parseFloat(styles.fontSize);
                lineHeight = Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.2 : 1;
            }

            if (lineHeight <= 0) return;

            const actualLines = textEl.scrollHeight / lineHeight;
            const expectedLines = Number(cell.dataset.expectedLines) || 1;

            if (actualLines - expectedLines > 0.5) {
                const tooltip = cell.dataset.clueTooltip || textEl.textContent.trim();
                cell.dataset.clueTooltip = tooltip;
                cell.classList.add('clue-overflow');
                cell.setAttribute('aria-label', tooltip);
                cell.setAttribute('tabindex', '0');
                if (cell === this.activeClueCell) {
                    activeStillOverflow = true;
                }
            }
        });

        if (this.activeClueCell && !activeStillOverflow) {
            this.hideClueTooltip();
        }
    }

    syncTableSizes() {
        const corner = document.getElementById('corner');
        if (!corner) {
            return;
        }

        const measureMax = (selector, dimension) => {
            let maxValue = 0;
            document.querySelectorAll(selector).forEach(el => {
                const scrollValue = dimension === 'height' ? el.scrollHeight : el.scrollWidth;
                const offsetValue = dimension === 'height' ? el.offsetHeight : el.offsetWidth;
                const value = Math.max(scrollValue, offsetValue);
                if (value > maxValue) {
                    maxValue = value;
                }
            });
            return maxValue;
        };

        const topContentHeight = measureMax('.top .clue-text', 'height');
        const sideContentWidth = measureMax('.side .clue-text', 'width');

        const cornerRect = corner.getBoundingClientRect();
        const fallbackSize = Math.max(cornerRect.height, cornerRect.width, 0);

        const padding = 4; // breathing room for borders/padding rounding
        const minClueSize = 24;
        const minCellSize = this.size <= 20 ? 12 : 9;

        const fallbackViewport = 520;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || fallbackViewport;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || fallbackViewport;
        const viewportMin = Math.min(viewportWidth, viewportHeight);

        let maxBoardSize = viewportMin * 0.85;
        if (!Number.isFinite(maxBoardSize) || maxBoardSize <= 0) {
            maxBoardSize = fallbackViewport * 0.8;
        }

        const minBoardSize = minClueSize + minCellSize * this.size;
        maxBoardSize = Math.max(maxBoardSize, minBoardSize);

        const measuredClueSize = Math.max(topContentHeight, sideContentWidth);
        const hasMeasuredClue = Number.isFinite(measuredClueSize) && measuredClueSize > 0;
        let baseClueSize = hasMeasuredClue ? measuredClueSize : Math.max(fallbackSize, minClueSize);
        if (!Number.isFinite(baseClueSize) || baseClueSize <= 0) {
            baseClueSize = minClueSize;
        }

        let clueSize = hasMeasuredClue ? baseClueSize + padding : baseClueSize;
        clueSize = Math.ceil(clueSize);
        const maxClueSize = Math.max(Math.floor(maxBoardSize * 0.32), minClueSize);
        clueSize = Math.min(Math.max(clueSize, minClueSize), maxClueSize);

        let cellSize = Math.floor((maxBoardSize - clueSize) / this.size);
        if (!Number.isFinite(cellSize) || cellSize <= 0) {
            cellSize = minCellSize;
        }

        if (cellSize < minCellSize) {
            cellSize = minCellSize;
        }

        let boardSize = clueSize + cellSize * this.size;

        if (boardSize > maxBoardSize) {
            const maxCells = Math.floor((maxBoardSize - minClueSize) / this.size);
            if (maxCells >= minCellSize) {
                cellSize = Math.min(cellSize, maxCells);
            } else {
                cellSize = minCellSize;
            }
            boardSize = clueSize + cellSize * this.size;

            if (boardSize > maxBoardSize) {
                clueSize = Math.max(minClueSize, Math.floor(maxBoardSize - cellSize * this.size));
                boardSize = clueSize + cellSize * this.size;
            }
        }

        boardSize = Math.min(boardSize, maxBoardSize);
        if (!Number.isFinite(boardSize) || boardSize <= 0) {
            boardSize = maxBoardSize;
        }

        const rootStyles = getComputedStyle(document.documentElement);
        const baseFont = parseFloat(rootStyles.getPropertyValue('--num-font-size')) || 16;
        const maxFontFromCell = cellSize * 0.95;
        const maxFontFromClue = clueSize * 0.9;
        const computedFont = Math.max(8, Math.min(baseFont, maxFontFromCell, maxFontFromClue));

        document.documentElement.style.setProperty('--clue-font-size', `${computedFont}px`);
        document.documentElement.style.setProperty('--clue-header-size', `${clueSize}px`);
        document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
        document.documentElement.style.setProperty('--board-size', `${boardSize}px`);
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

        // for zero columns, check if theyre actually empty
        if (this.topNums[col].length === 1 && this.topNums[col][0] === 0) {
            // only mark as complete if there are no filled cells
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

        // for zero rows, check if theyre actually empty
        if (this.sideNums[row].length === 1 && this.sideNums[row][0] === 0) {
            // only mark as complete if there are no filled cells
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
            // only clicked cells count for completion, greyed and marked are just hints
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
            // only clicked cells count for completion, greyed and marked are just hints
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
            if (this.timer >= this.maxTimerSeconds) {
                this.timer = this.maxTimerSeconds;
                if (timerElement) timerElement.textContent = this.formatTime(this.timer);
                this.stopTimer();
                return;
            }
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
        const currentGame = this;
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

        // build seed from current generated layout
        let seedStr = '';
        try {
            seedStr = window.Seed ? window.Seed.createSeedFromLayout(currentGame.possibleLayout, currentGame.size) : '';
        } catch (e) {
            seedStr = '';
        }

        // display time (keep ui minimal), seed is included in share text below
        if (timerElement) timerElement.textContent = `${timeString}`;

        const sizeLabel = currentGame.size < 10 ? `0${currentGame.size}` : `${currentGame.size}`;
        const plainText = `NONO_${sizeLabel} => ${timeString}${seedStr ? `\n${seedStr}` : ''}`;

        const shareButton = document.getElementById('copy-button');
        if (shareButton) shareButton.classList.remove('hidden');

        // use onclick instead of addeventlistener to prevent duplicate listeners
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
    const notifyReady = () => {
        document.dispatchEvent(new Event('fouc:ready'));
    };

    try {
        new Nono();
    } finally {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(notifyReady);
        } else {
            window.setTimeout(notifyReady, 0);
        }
    }
});

/*
TODO

change typing and mines copy button to .onclick to prevent dupe

docs/nono/nono.js:236 and docs/nono/nono.js:18991912 both attach their own DOMContentLoaded handlers; consider folding the settingspanel wiring into the class setup so you only register one load hook.

docs/nono/nono.js:400459 repeats most of the state wiring already done in the constructor (docs/nono/nono.js:86198 and docs/nono/nono.js:360398). A shared “reset state” helper would remove the duplicated assignments, timer resets, and DOM cleanup loops.

The “finalize after input” blocks at docs/nono/nono.js:538567 (mouse up) and docs/nono/nono.js:749778 (key up) are effectively identicalextracting a single finishInteraction() routine would keep the mouse/keyboard flows in sync.

Highlighting code requeries and toggles the same selectors in several places (docs/nono/nono.js:473528, docs/nono/nono.js:613704, docs/nono/nono.js:17961812). Caching the node lists or wrapping the highlight/unhighlight logic in helpers would cut down on repeated DOM walks.

Clearing drag previews is done with the same document.querySelectorAll('.dragpreview') loop at docs/nono/nono.js:382385, 434436, 600603, and 618620; a small utility (e.g., clearDragPreview()) would centralize that behaviour.

Nearly every place that completes an action runs this.updateAllCells(); this.checkGameEnd(); this.finalizeAction(); (see docs/nono/nono.js:559567, 565567, 777778, 686699). Collecting those into a single method would remove the repetition and reduce the chance of missing a call site.

Sizebutton styling is reset in multiple places (docs/nono/nono.js:6576, 334336); a helper like setActiveSizeButton(buttonId) could encapsulate the query, localStorage write, and fontsize update.

*/
