const SudokuTechniqueLadder = (() => {
    const DIGITS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const createPeerMap = () => {
        const peerMap = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
        for (let row = 0; row < 9; row += 1) {
            for (let col = 0; col < 9; col += 1) {
                const peers = [];
                for (let c = 0; c < 9; c += 1) {
                    if (c !== col) {
                        peers.push([row, c]);
                    }
                }
                for (let r = 0; r < 9; r += 1) {
                    if (r !== row) {
                        peers.push([r, col]);
                    }
                }
                const startRow = row - (row % 3);
                const startCol = col - (col % 3);
                for (let r = 0; r < 3; r += 1) {
                    for (let c = 0; c < 3; c += 1) {
                        const targetRow = startRow + r;
                        const targetCol = startCol + c;
                        if (targetRow === row && targetCol === col) {
                            continue;
                        }
                        let exists = false;
                        for (let i = 0; i < peers.length; i += 1) {
                            const [pr, pc] = peers[i];
                            if (pr === targetRow && pc === targetCol) {
                                exists = true;
                                break;
                            }
                        }
                        if (!exists) {
                            peers.push([targetRow, targetCol]);
                        }
                    }
                }
                peerMap[row][col] = peers;
            }
        }
        return peerMap;
    };

    const PEERS = createPeerMap();

    const ROW_HOUSES = Array.from(
        { length: 9 },
        (_, row) => Array.from({ length: 9 }, (_, col) => [row, col])
    );

    const COLUMN_HOUSES = Array.from(
        { length: 9 },
        (_, col) => Array.from({ length: 9 }, (_, row) => [row, col])
    );

    const BOX_HOUSES = (() => {
        const houses = [];
        for (let boxRow = 0; boxRow < 3; boxRow += 1) {
            for (let boxCol = 0; boxCol < 3; boxCol += 1) {
                const cells = [];
                for (let r = 0; r < 3; r += 1) {
                    for (let c = 0; c < 3; c += 1) {
                        cells.push([(boxRow * 3) + r, (boxCol * 3) + c]);
                    }
                }
                houses.push(cells);
            }
        }
        return houses;
    })();

    const ALL_HOUSES = [...ROW_HOUSES, ...COLUMN_HOUSES, ...BOX_HOUSES];

    const cellsShareBlock = (rowA, colA, rowB, colB) =>
        Math.floor(rowA / 3) === Math.floor(rowB / 3) && Math.floor(colA / 3) === Math.floor(colB / 3);

    const cellsSeeEachOther = (rowA, colA, rowB, colB) =>
        rowA === rowB || colA === colB || cellsShareBlock(rowA, colA, rowB, colB);

    const getCombinations = (items, size) => {
        const results = [];
        const recurse = (startIndex, path) => {
            if (path.length === size) {
                results.push(path.slice());
                return;
            }
            for (let i = startIndex; i < items.length; i += 1) {
                path.push(items[i]);
                recurse(i + 1, path);
                path.pop();
            }
        };
        recurse(0, []);
        return results;
    };

    const removeCandidateFromCell = (candidates, row, col, value) => {
        const cellCandidates = candidates[row][col];
        if (!cellCandidates || cellCandidates.length === 0) {
            return false;
        }
        const index = cellCandidates.indexOf(value);
        if (index === -1) {
            return false;
        }
        cellCandidates.splice(index, 1);
        return true;
    };

    const eliminateUsingSharedPeers = (grid, candidates, digit, cellA, cellB, protectedCells = []) => {
        const skipKeys = new Set();
        const addKey = ([row, col]) => {
            if (typeof row !== 'number' || typeof col !== 'number') {
                return;
            }
            skipKeys.add(`${row}-${col}`);
        };
        addKey(cellA);
        addKey(cellB);
        for (let i = 0; i < protectedCells.length; i += 1) {
            addKey(protectedCells[i]);
        }

        for (let row = 0; row < 9; row += 1) {
            for (let col = 0; col < 9; col += 1) {
                if (skipKeys.has(`${row}-${col}`)) {
                    continue;
                }
                if (grid[row][col] > 0) {
                    continue;
                }
                if (!cellsSeeEachOther(row, col, cellA[0], cellA[1])) {
                    continue;
                }
                if (!cellsSeeEachOther(row, col, cellB[0], cellB[1])) {
                    continue;
                }
                if (removeCandidateFromCell(candidates, row, col, digit)) {
                    return true;
                }
            }
        }
        return false;
    };

    const applySimpleColors = (grid, candidates) => {
        const getCellKey = (row, col) => `${row}-${col}`;

        const buildConjugateGraph = (digit) => {
            const graph = new Map();
            const ensureNode = (row, col) => {
                const key = getCellKey(row, col);
                if (!graph.has(key)) {
                    graph.set(key, { key, row, col, neighbors: new Set() });
                }
                return graph.get(key);
            };
            const connectCells = (cellA, cellB) => {
                const [rowA, colA] = cellA;
                const [rowB, colB] = cellB;
                const nodeA = ensureNode(rowA, colA);
                const nodeB = ensureNode(rowB, colB);
                nodeA.neighbors.add(nodeB.key);
                nodeB.neighbors.add(nodeA.key);
            };
            const processHouse = (cells) => {
                const locations = [];
                for (let i = 0; i < cells.length; i += 1) {
                    const [row, col] = cells[i];
                    if (grid[row][col] > 0) {
                        continue;
                    }
                    const cellCandidates = candidates[row][col];
                    if (!cellCandidates || cellCandidates.length === 0) {
                        continue;
                    }
                    if (cellCandidates.includes(digit)) {
                        locations.push([row, col]);
                        if (locations.length > 2) {
                            break;
                        }
                    }
                }
                if (locations.length === 2) {
                    connectCells(locations[0], locations[1]);
                }
            };

            for (let i = 0; i < ALL_HOUSES.length; i += 1) {
                processHouse(ALL_HOUSES[i]);
            }

            return graph;
        };

        const exploreComponent = (startKey, graph, visitedKeys) => {
            const queue = [startKey];
            const colorAssignments = new Map([[startKey, 0]]);
            const keySet = new Set();
            const colorGroups = [[], []];
            visitedKeys.add(startKey);

            for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
                const key = queue[queueIndex];
                const node = graph.get(key);
                if (!node) {
                    continue;
                }
                const color = colorAssignments.get(key) || 0;
                keySet.add(key);
                colorGroups[color].push([node.row, node.col]);
                for (const neighborKey of node.neighbors) {
                    if (colorAssignments.has(neighborKey)) {
                        continue;
                    }
                    colorAssignments.set(neighborKey, 1 - color);
                    queue.push(neighborKey);
                    visitedKeys.add(neighborKey);
                }
            }

            return { colorAssignments, keySet, colorGroups };
        };

        const tryColorWrap = (component, digit) => {
            for (let color = 0; color < 2; color += 1) {
                const cells = component.colorGroups[color];
                if (cells.length < 2) {
                    continue;
                }
                for (let i = 0; i < cells.length - 1; i += 1) {
                    const [rowA, colA] = cells[i];
                    for (let j = i + 1; j < cells.length; j += 1) {
                        const [rowB, colB] = cells[j];
                        if (!cellsSeeEachOther(rowA, colA, rowB, colB)) {
                            continue;
                        }
                        let changed = false;
                        for (let k = 0; k < cells.length; k += 1) {
                            const [targetRow, targetCol] = cells[k];
                            if (removeCandidateFromCell(candidates, targetRow, targetCol, digit)) {
                                changed = true;
                            }
                        }
                        if (changed) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };

        const tryColorTrap = (component, digit) => {
            if (component.keySet.size === 0) {
                return false;
            }
            for (let row = 0; row < 9; row += 1) {
                for (let col = 0; col < 9; col += 1) {
                    if (grid[row][col] > 0) {
                        continue;
                    }
                    const cellCandidates = candidates[row][col];
                    if (!cellCandidates || cellCandidates.length === 0) {
                        continue;
                    }
                    if (!cellCandidates.includes(digit)) {
                        continue;
                    }
                    const cellKey = getCellKey(row, col);
                    if (component.keySet.has(cellKey)) {
                        continue;
                    }
                    let seesColorA = false;
                    let seesColorB = false;
                    const peers = PEERS[row][col];
                    for (let i = 0; i < peers.length; i += 1) {
                        const [peerRow, peerCol] = peers[i];
                        const peerKey = getCellKey(peerRow, peerCol);
                        if (!component.colorAssignments.has(peerKey)) {
                            continue;
                        }
                        const peerColor = component.colorAssignments.get(peerKey);
                        if (peerColor === 0) {
                            seesColorA = true;
                        } else {
                            seesColorB = true;
                        }
                        if (seesColorA && seesColorB) {
                            break;
                        }
                    }
                    if (seesColorA && seesColorB) {
                        if (removeCandidateFromCell(candidates, row, col, digit)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };

        for (let digitIndex = 0; digitIndex < DIGITS.length; digitIndex += 1) {
            const digit = DIGITS[digitIndex];
            const graph = buildConjugateGraph(digit);
            if (graph.size === 0) {
                continue;
            }
            const visited = new Set();
            for (const key of graph.keys()) {
                if (visited.has(key)) {
                    continue;
                }
                const component = exploreComponent(key, graph, visited);
                if (component.keySet.size < 2) {
                    continue;
                }
                if (tryColorWrap(component, digit)) {
                    return true;
                }
                if (tryColorTrap(component, digit)) {
                    return true;
                }
            }
        }

        return false;
    };

    const applyValueToCell = (grid, candidates, row, col, value) => {
        grid[row][col] = value;
        candidates[row][col] = [];
        const peers = PEERS[row][col];
        for (let i = 0; i < peers.length; i += 1) {
            const [peerRow, peerCol] = peers[i];
            removeCandidateFromCell(candidates, peerRow, peerCol, value);
        }
    };

    const applyFullHouse = (grid, candidates) => {
        const applyToHouse = (cells) => {
            const missingDigits = new Set(DIGITS);
            const emptyCells = [];

            cells.forEach(([row, col]) => {
                const value = grid[row][col];
                if (Number.isInteger(value) && value > 0) {
                    missingDigits.delete(value);
                } else {
                    emptyCells.push([row, col]);
                }
            });

            if (emptyCells.length === 1 && missingDigits.size === 1) {
                const [[targetRow, targetCol]] = emptyCells;
                const missingDigit = missingDigits.values().next().value;
                applyValueToCell(grid, candidates, targetRow, targetCol, missingDigit);
                return true;
            }
            return false;
        };

        for (let i = 0; i < ALL_HOUSES.length; i += 1) {
            if (applyToHouse(ALL_HOUSES[i])) {
                return true;
            }
        }
        return false;
    };

    const applyNakedSingles = (grid, candidates) => {
        for (let r = 0; r < 9; r += 1) {
            for (let c = 0; c < 9; c += 1) {
                if (grid[r][c] > 0 || candidates[r][c].length !== 1) {
                    continue;
                }
                applyValueToCell(grid, candidates, r, c, candidates[r][c][0]);
                return true;
            }
        }
        return false;
    };

    const applyHiddenSingles = (grid, candidates) => {
        const applyToHouse = (cells) => {
            const candidateMap = new Map();
            cells.forEach(([row, col]) => {
                if (grid[row][col] > 0) {
                    return;
                }
                const cellCandidates = candidates[row][col];
                for (let i = 0; i < cellCandidates.length; i += 1) {
                    const value = cellCandidates[i];
                    if (!candidateMap.has(value)) {
                        candidateMap.set(value, []);
                    }
                    candidateMap.get(value).push([row, col]);
                }
            });

            for (const [value, locations] of candidateMap.entries()) {
                if (locations.length === 1) {
                    const [[targetRow, targetCol]] = locations;
                    applyValueToCell(grid, candidates, targetRow, targetCol, value);
                    return true;
                }
            }
            return false;
        };
        for (let i = 0; i < ALL_HOUSES.length; i += 1) {
            if (applyToHouse(ALL_HOUSES[i])) {
                return true;
            }
        }
        return false;
    };

    const applyLockedCandidatesType1Pointing = (grid, candidates) => {
        for (let boxIndex = 0; boxIndex < BOX_HOUSES.length; boxIndex += 1) {
            const cells = BOX_HOUSES[boxIndex];
            for (let digitIndex = 0; digitIndex < DIGITS.length; digitIndex += 1) {
                const digit = DIGITS[digitIndex];
                const locations = [];
                for (let i = 0; i < cells.length; i += 1) {
                    const [row, col] = cells[i];
                    if (grid[row][col] > 0) {
                        continue;
                    }
                    if (candidates[row][col].includes(digit)) {
                        locations.push([row, col]);
                    }
                }
                if (locations.length < 2) {
                    continue;
                }
                const allSameRow = locations.every(([row]) => row === locations[0][0]);
                const allSameCol = locations.every(([, col]) => col === locations[0][1]);
                if (!allSameRow && !allSameCol) {
                    continue;
                }
                if (allSameRow) {
                    const targetRow = locations[0][0];
                    const blockColStart = Math.floor(locations[0][1] / 3) * 3;
                    for (let col = 0; col < 9; col += 1) {
                        if (col >= blockColStart && col < blockColStart + 3) {
                            continue;
                        }
                        if (removeCandidateFromCell(candidates, targetRow, col, digit)) {
                            return true;
                        }
                    }
                }
                if (allSameCol) {
                    const targetCol = locations[0][1];
                    const blockRowStart = Math.floor(locations[0][0] / 3) * 3;
                    for (let row = 0; row < 9; row += 1) {
                        if (row >= blockRowStart && row < blockRowStart + 3) {
                            continue;
                        }
                        if (removeCandidateFromCell(candidates, row, targetCol, digit)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };

    const applyLockedCandidatesType2Claiming = (grid, candidates) => {
        const scanHouseGroup = (houses, getBlockKey, eliminateInBlock) => {
            for (let i = 0; i < houses.length; i += 1) {
                const cells = houses[i];
                for (let digitIndex = 0; digitIndex < DIGITS.length; digitIndex += 1) {
                    const digit = DIGITS[digitIndex];
                    const locations = [];
                    for (let j = 0; j < cells.length; j += 1) {
                        const [row, col] = cells[j];
                        if (grid[row][col] > 0) {
                            continue;
                        }
                        if (candidates[row][col].includes(digit)) {
                            locations.push([row, col]);
                        }
                    }
                    if (locations.length < 2) {
                        continue;
                    }
                    const blockKeys = new Set(locations.map(([row, col]) => getBlockKey(row, col)));
                    if (blockKeys.size !== 1) {
                        continue;
                    }
                    if (eliminateInBlock(locations, digit)) {
                        return true;
                    }
                }
            }
            return false;
        };

        const eliminateFromBlock = (anchorCells, digit, rowFilter, colFilter) => {
            const [[firstRow, firstCol]] = anchorCells;
            const blockRow = Math.floor(firstRow / 3);
            const blockCol = Math.floor(firstCol / 3);
            const startRow = blockRow * 3;
            const startCol = blockCol * 3;
            for (let r = 0; r < 3; r += 1) {
                for (let c = 0; c < 3; c += 1) {
                    const row = startRow + r;
                    const col = startCol + c;
                    if (rowFilter(row) || colFilter(col)) {
                        continue;
                    }
                    if (removeCandidateFromCell(candidates, row, col, digit)) {
                        return true;
                    }
                }
            }
            return false;
        };

        const rowResult = scanHouseGroup(
            ROW_HOUSES,
            (row, col) => Math.floor(row / 3) * 3 + Math.floor(col / 3),
            (locations, digit) => {
                const targetRow = locations[0][0];
                const rowFilter = (row) => row === targetRow;
                const colFilter = () => false;
                return eliminateFromBlock(locations, digit, rowFilter, colFilter);
            }
        );
        if (rowResult) {
            return true;
        }

        const colResult = scanHouseGroup(
            COLUMN_HOUSES,
            (row, col) => Math.floor(row / 3) * 3 + Math.floor(col / 3),
            (locations, digit) => {
                const targetCol = locations[0][1];
                const rowFilter = () => false;
                const colFilter = (col) => col === targetCol;
                return eliminateFromBlock(locations, digit, rowFilter, colFilter);
            }
        );
        return colResult;
    };

    const applyNakedPairs = (grid, candidates) => {
        const processHouse = (cells) => {
            const pairMap = new Map();
            for (let i = 0; i < cells.length; i += 1) {
                const [row, col] = cells[i];
                if (grid[row][col] > 0 || candidates[row][col].length !== 2) {
                    continue;
                }
                const sorted = candidates[row][col].slice().sort((a, b) => a - b);
                const key = `${sorted[0]}-${sorted[1]}`;
                if (!pairMap.has(key)) {
                    pairMap.set(key, []);
                }
                pairMap.get(key).push([row, col]);
            }

            for (const [key, locations] of pairMap.entries()) {
                if (locations.length !== 2) {
                    continue;
                }
                const digits = key.split('-').map((value) => parseInt(value, 10));
                const [digitA, digitB] = digits;
                let changed = false;
                for (let i = 0; i < cells.length; i += 1) {
                    const [row, col] = cells[i];
                    if (
                        (row === locations[0][0] && col === locations[0][1]) ||
                        (row === locations[1][0] && col === locations[1][1])
                    ) {
                        continue;
                    }
                    const removedA = removeCandidateFromCell(candidates, row, col, digitA);
                    const removedB = removeCandidateFromCell(candidates, row, col, digitB);
                    if (removedA || removedB) {
                        changed = true;
                        break;
                    }
                }
                if (changed) {
                    return true;
                }
            }
            return false;
        };

        for (let i = 0; i < ALL_HOUSES.length; i += 1) {
            if (processHouse(ALL_HOUSES[i])) {
                return true;
            }
        }
        return false;
    };

    const createNakedSubsetExecutor = (subsetSize) => {
        const processHouse = (cells, grid, candidates) => {
            const eligibleCells = [];
            for (let i = 0; i < cells.length; i += 1) {
                const [row, col] = cells[i];
                if (grid[row][col] > 0) {
                    continue;
                }
                const cellCandidates = candidates[row][col];
                if (!cellCandidates || cellCandidates.length === 0) {
                    continue;
                }
                if (cellCandidates.length > subsetSize) {
                    continue;
                }
                eligibleCells.push({ row, col, candidates: cellCandidates });
            }
            if (eligibleCells.length < subsetSize) {
                return false;
            }

            const combinations = getCombinations(eligibleCells, subsetSize);
            for (let comboIndex = 0; comboIndex < combinations.length; comboIndex += 1) {
                const subsetCells = combinations[comboIndex];
                const unionDigits = new Set();
                for (let subsetIndex = 0; subsetIndex < subsetCells.length; subsetIndex += 1) {
                    const { candidates: cellCandidates } = subsetCells[subsetIndex];
                    for (let idx = 0; idx < cellCandidates.length; idx += 1) {
                        unionDigits.add(cellCandidates[idx]);
                    }
                }
                if (unionDigits.size !== subsetSize) {
                    continue;
                }
                const anchorKeys = new Set(
                    subsetCells.map(({ row, col }) => `${row}-${col}`)
                );
                let changed = false;
                for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
                    const [row, col] = cells[cellIndex];
                    if (grid[row][col] > 0) {
                        continue;
                    }
                    const key = `${row}-${col}`;
                    if (anchorKeys.has(key)) {
                        continue;
                    }
                    for (const digit of unionDigits) {
                        if (removeCandidateFromCell(candidates, row, col, digit)) {
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    return true;
                }
            }
            return false;
        };

        return (grid, candidates) => {
            for (let i = 0; i < ALL_HOUSES.length; i += 1) {
                if (processHouse(ALL_HOUSES[i], grid, candidates)) {
                    return true;
                }
            }
            return false;
        };
    };

    const createHiddenSubsetExecutor = (subsetSize) => {
        const processHouse = (cells, grid, candidates) => {
            const digitLocations = new Map();
            for (let i = 0; i < cells.length; i += 1) {
                const [row, col] = cells[i];
                if (grid[row][col] > 0) {
                    continue;
                }
                const cellCandidates = candidates[row][col];
                for (let idx = 0; idx < cellCandidates.length; idx += 1) {
                    const digit = cellCandidates[idx];
                    if (!digitLocations.has(digit)) {
                        digitLocations.set(digit, []);
                    }
                    digitLocations.get(digit).push([row, col]);
                }
            }

            const eligibleDigits = Array.from(digitLocations.entries()).filter(
                (entry) => entry[1].length > 0 && entry[1].length <= subsetSize
            );
            if (eligibleDigits.length < subsetSize) {
                return false;
            }

            const digitValues = eligibleDigits.map((entry) => entry[0]);
            const combinations = getCombinations(digitValues, subsetSize);
            for (let comboIndex = 0; comboIndex < combinations.length; comboIndex += 1) {
                const subsetDigits = combinations[comboIndex];
                const unionCells = [];
                const cellKeys = new Set();
                for (let d = 0; d < subsetDigits.length; d += 1) {
                    const digit = subsetDigits[d];
                    const locations = digitLocations.get(digit);
                    for (let locIndex = 0; locIndex < locations.length; locIndex += 1) {
                        const [row, col] = locations[locIndex];
                        const key = `${row}-${col}`;
                        if (!cellKeys.has(key)) {
                            cellKeys.add(key);
                            unionCells.push([row, col]);
                        }
                    }
                }
                if (unionCells.length !== subsetSize) {
                    continue;
                }
                const allowedDigits = new Set(subsetDigits);
                let changed = false;
                for (let cellIndex = 0; cellIndex < unionCells.length; cellIndex += 1) {
                    const [row, col] = unionCells[cellIndex];
                    const cellCandidates = candidates[row][col];
                    if (!cellCandidates || cellCandidates.length === 0) {
                        continue;
                    }
                    for (let idx = cellCandidates.length - 1; idx >= 0; idx -= 1) {
                        const value = cellCandidates[idx];
                        if (!allowedDigits.has(value)) {
                            cellCandidates.splice(idx, 1);
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    return true;
                }
            }
            return false;
        };

        return (grid, candidates) => {
            for (let i = 0; i < ALL_HOUSES.length; i += 1) {
                if (processHouse(ALL_HOUSES[i], grid, candidates)) {
                    return true;
                }
            }
            return false;
        };
    };

    const applyNakedTriples = createNakedSubsetExecutor(3);
    const applyNakedQuadruples = createNakedSubsetExecutor(4);

    const applyHiddenPairs = createHiddenSubsetExecutor(2);
    const applyHiddenTriples = createHiddenSubsetExecutor(3);
    const applyHiddenQuadruples = createHiddenSubsetExecutor(4);

    const applySkyscraper = (grid, candidates) => {
        const searchOrientation = (useRows) => {
            for (let digitIndex = 0; digitIndex < DIGITS.length; digitIndex += 1) {
                const digit = DIGITS[digitIndex];
                const basePositions = Array.from({ length: 9 }, () => null);

                for (let base = 0; base < 9; base += 1) {
                    const slots = [];
                    for (let cover = 0; cover < 9; cover += 1) {
                        const row = useRows ? base : cover;
                        const col = useRows ? cover : base;
                        if (grid[row][col] > 0) {
                            continue;
                        }
                        const cellCandidates = candidates[row][col];
                        if (!cellCandidates || cellCandidates.length === 0) {
                            continue;
                        }
                        if (cellCandidates.includes(digit)) {
                            slots.push(useRows ? col : row);
                        }
                    }
                    if (slots.length === 2) {
                        basePositions[base] = slots;
                    }
                }

                for (let baseA = 0; baseA < 9; baseA += 1) {
                    const positionsA = basePositions[baseA];
                    if (!positionsA) {
                        continue;
                    }
                    for (let baseB = baseA + 1; baseB < 9; baseB += 1) {
                        const positionsB = basePositions[baseB];
                        if (!positionsB) {
                            continue;
                        }

                        let sharedValue = null;
                        let sharedCount = 0;
                        for (let i = 0; i < positionsA.length; i += 1) {
                            if (positionsB.includes(positionsA[i])) {
                                sharedValue = positionsA[i];
                                sharedCount += 1;
                            }
                        }
                        if (sharedCount !== 1) {
                            continue;
                        }

                        const otherA = positionsA[0] === sharedValue ? positionsA[1] : positionsA[0];
                        const otherB = positionsB[0] === sharedValue ? positionsB[1] : positionsB[0];
                        if (otherA === sharedValue || otherB === sharedValue) {
                            continue;
                        }

                        if (Math.floor(baseA / 3) !== Math.floor(baseB / 3)) {
                            continue;
                        }

                        const remoteCellA = useRows ? [baseA, otherA] : [otherA, baseA];
                        const remoteCellB = useRows ? [baseB, otherB] : [otherB, baseB];
                        const baseCells = useRows
                            ? [
                                [baseA, sharedValue],
                                [baseB, sharedValue]
                            ]
                            : [
                                [sharedValue, baseA],
                                [sharedValue, baseB]
                            ];

                        if (eliminateUsingSharedPeers(grid, candidates, digit, remoteCellA, remoteCellB, baseCells)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };

        return searchOrientation(true) || searchOrientation(false);
    };

    const applyTwoStringKite = (grid, candidates) => {
        for (let digitIndex = 0; digitIndex < DIGITS.length; digitIndex += 1) {
            const digit = DIGITS[digitIndex];
            const rowPositions = Array.from({ length: 9 }, () => []);
            const columnPositions = Array.from({ length: 9 }, () => []);

            for (let row = 0; row < 9; row += 1) {
                for (let col = 0; col < 9; col += 1) {
                    if (grid[row][col] > 0) {
                        continue;
                    }
                    const cellCandidates = candidates[row][col];
                    if (!cellCandidates || cellCandidates.length === 0) {
                        continue;
                    }
                    if (cellCandidates.includes(digit)) {
                        rowPositions[row].push(col);
                        columnPositions[col].push(row);
                    }
                }
            }

            for (let row = 0; row < 9; row += 1) {
                const rowCols = rowPositions[row];
                if (rowCols.length !== 2) {
                    continue;
                }
                for (let col = 0; col < 9; col += 1) {
                    const colRows = columnPositions[col];
                    if (colRows.length !== 2) {
                        continue;
                    }

                    for (let rowChoiceIndex = 0; rowChoiceIndex < 2; rowChoiceIndex += 1) {
                        const rowConnectorCell = [row, rowCols[rowChoiceIndex]];
                        for (let colChoiceIndex = 0; colChoiceIndex < 2; colChoiceIndex += 1) {
                            const colConnectorCell = [colRows[colChoiceIndex], col];
                            if (
                                rowConnectorCell[0] === colConnectorCell[0] &&
                                rowConnectorCell[1] === colConnectorCell[1]
                            ) {
                                continue;
                            }
                            if (
                                !cellsShareBlock(
                                    rowConnectorCell[0],
                                    rowConnectorCell[1],
                                    colConnectorCell[0],
                                    colConnectorCell[1]
                                )
                            ) {
                                continue;
                            }

                            const rowOtherCol = rowCols[1 - rowChoiceIndex];
                            const colOtherRow = colRows[1 - colChoiceIndex];
                            const rowOtherCell = [row, rowOtherCol];
                            const colOtherCell = [colOtherRow, col];
                            if (
                                rowOtherCell[0] === colOtherCell[0] &&
                                rowOtherCell[1] === colOtherCell[1]
                            ) {
                                continue;
                            }

                            const protectedCells = [rowConnectorCell, colConnectorCell];
                            if (
                                eliminateUsingSharedPeers(
                                    grid,
                                    candidates,
                                    digit,
                                    rowOtherCell,
                                    colOtherCell,
                                    protectedCells
                                )
                            ) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    };

    const applyXYWing = (grid, candidates) => {
        const gatherPincers = (pivotRow, pivotCol, sharedDigit, excludedDigit) => {
            const pincers = [];
            const peers = PEERS[pivotRow][pivotCol];
            for (let i = 0; i < peers.length; i += 1) {
                const [row, col] = peers[i];
                if (grid[row][col] > 0) {
                    continue;
                }
                const peerCandidates = candidates[row][col];
                if (!peerCandidates || peerCandidates.length !== 2) {
                    continue;
                }
                if (!peerCandidates.includes(sharedDigit)) {
                    continue;
                }
                const otherDigit = peerCandidates[0] === sharedDigit ? peerCandidates[1] : peerCandidates[0];
                if (otherDigit === excludedDigit) {
                    continue;
                }
                pincers.push({ cell: [row, col], zDigit: otherDigit });
            }
            return pincers;
        };

        for (let row = 0; row < 9; row += 1) {
            for (let col = 0; col < 9; col += 1) {
                if (grid[row][col] > 0) {
                    continue;
                }
                const pivotCandidates = candidates[row][col];
                if (!pivotCandidates || pivotCandidates.length !== 2) {
                    continue;
                }
                const [digitA, digitB] = pivotCandidates;
                const pincersA = gatherPincers(row, col, digitA, digitB);
                const pincersB = gatherPincers(row, col, digitB, digitA);
                if (pincersA.length === 0 || pincersB.length === 0) {
                    continue;
                }
                for (let i = 0; i < pincersA.length; i += 1) {
                    const pincerA = pincersA[i];
                    for (let j = 0; j < pincersB.length; j += 1) {
                        const pincerB = pincersB[j];
                        if (
                            pincerA.cell[0] === pincerB.cell[0] &&
                            pincerA.cell[1] === pincerB.cell[1]
                        ) {
                            continue;
                        }
                        if (pincerA.zDigit !== pincerB.zDigit) {
                            continue;
                        }
                        const protectedCells = [[row, col]];
                        if (
                            eliminateUsingSharedPeers(
                                grid,
                                candidates,
                                pincerA.zDigit,
                                pincerA.cell,
                                pincerB.cell,
                                protectedCells
                            )
                        ) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };

    const applyXWing = (grid, candidates) => {
        const eliminateFromColumns = (rowA, rowB, columns, digit) => {
            let changed = false;
            for (let i = 0; i < columns.length; i += 1) {
                const col = columns[i];
                for (let row = 0; row < 9; row += 1) {
                    if (row === rowA || row === rowB) {
                        continue;
                    }
                    if (grid[row][col] > 0) {
                        continue;
                    }
                    if (removeCandidateFromCell(candidates, row, col, digit)) {
                        changed = true;
                    }
                }
            }
            return changed;
        };

        const eliminateFromRows = (colA, colB, rows, digit) => {
            let changed = false;
            for (let i = 0; i < rows.length; i += 1) {
                const row = rows[i];
                for (let col = 0; col < 9; col += 1) {
                    if (col === colA || col === colB) {
                        continue;
                    }
                    if (grid[row][col] > 0) {
                        continue;
                    }
                    if (removeCandidateFromCell(candidates, row, col, digit)) {
                        changed = true;
                    }
                }
            }
            return changed;
        };

        const searchXWing = (useRows) => {
            for (let digitIndex = 0; digitIndex < DIGITS.length; digitIndex += 1) {
                const digit = DIGITS[digitIndex];
                const basePositions = Array.from({ length: 9 }, () => []);
                if (useRows) {
                    for (let row = 0; row < 9; row += 1) {
                        for (let col = 0; col < 9; col += 1) {
                            if (grid[row][col] > 0) {
                                continue;
                            }
                            const cellCandidates = candidates[row][col];
                            if (!cellCandidates || cellCandidates.length === 0) {
                                continue;
                            }
                            if (cellCandidates.includes(digit)) {
                                basePositions[row].push(col);
                            }
                        }
                    }
                } else {
                    for (let col = 0; col < 9; col += 1) {
                        for (let row = 0; row < 9; row += 1) {
                            if (grid[row][col] > 0) {
                                continue;
                            }
                            const cellCandidates = candidates[row][col];
                            if (!cellCandidates || cellCandidates.length === 0) {
                                continue;
                            }
                            if (cellCandidates.includes(digit)) {
                                basePositions[col].push(row);
                            }
                        }
                    }
                }

                const signatureMap = new Map();
                for (let baseIndex = 0; baseIndex < basePositions.length; baseIndex += 1) {
                    const positions = basePositions[baseIndex];
                    if (positions.length !== 2) {
                        continue;
                    }
                    const sorted = positions.slice().sort((a, b) => a - b);
                    const key = `${sorted[0]}-${sorted[1]}`;
                    if (!signatureMap.has(key)) {
                        signatureMap.set(key, { coverPair: sorted, baseIndexes: [] });
                    }
                    signatureMap.get(key).baseIndexes.push(baseIndex);
                }

                for (const entry of signatureMap.values()) {
                    const { coverPair, baseIndexes } = entry;
                    if (baseIndexes.length < 2) {
                        continue;
                    }
                    for (let i = 0; i < baseIndexes.length - 1; i += 1) {
                        for (let j = i + 1; j < baseIndexes.length; j += 1) {
                            const baseA = baseIndexes[i];
                            const baseB = baseIndexes[j];
                            if (useRows) {
                                if (eliminateFromColumns(baseA, baseB, coverPair, digit)) {
                                    return true;
                                }
                            } else if (eliminateFromRows(baseA, baseB, coverPair, digit)) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        };

        return searchXWing(true) || searchXWing(false);
    };

    const TECHNIQUE_EXECUTORS = Object.freeze({
        fullHouse: applyFullHouse,
        nakedSingle: applyNakedSingles,
        hiddenSingle: applyHiddenSingles,
        lockedCandidatesType1Pointing: applyLockedCandidatesType1Pointing,
        lockedCandidatesType2Claiming: applyLockedCandidatesType2Claiming,
        nakedPair: applyNakedPairs,
        nakedTriple: applyNakedTriples,
        nakedQuadruple: applyNakedQuadruples,
        hiddenPair: applyHiddenPairs,
        hiddenTriple: applyHiddenTriples,
        hiddenQuadruple: applyHiddenQuadruples,
        xWing: applyXWing,
        skyscraper: applySkyscraper,
        twoStringKite: applyTwoStringKite,
        xyWing: applyXYWing,
        simpleColors: applySimpleColors
    });

    const TECHNIQUE_KEYS = Object.freeze(Object.keys(TECHNIQUE_EXECUTORS));

    const executeTechnique = (techniqueName, grid, candidates) => {
        if (typeof techniqueName !== 'string' || techniqueName.length === 0) {
            return false;
        }
        const handler = TECHNIQUE_EXECUTORS[techniqueName];
        if (typeof handler !== 'function') {
            return false;
        }
        return Boolean(handler(grid, candidates));
    };

    const applyTechniqueLadderStep = (grid, candidates, techniqueSequence) => {
        if (!Array.isArray(techniqueSequence) || techniqueSequence.length === 0) {
            return null;
        }
        for (let i = 0; i < techniqueSequence.length; i += 1) {
            const techniqueName = techniqueSequence[i];
            console.log(`Trying ${techniqueName}`);
            const succeeded = executeTechnique(techniqueName, grid, candidates);
            console.log(`${succeeded ? 'Success' : 'Fail'} ${techniqueName}`);
            if (succeeded) {
                return techniqueName;
            }
        }
        return null;
    };

    return Object.freeze({
        executeTechnique,
        applyTechniqueLadderStep,
        TECHNIQUE_EXECUTORS,
        TECHNIQUE_KEYS
    });
})();

export {
    SudokuTechniqueLadder
};

export default SudokuTechniqueLadder;

if (typeof globalThis !== 'undefined') {
    globalThis.SudokuTechniqueLadder = SudokuTechniqueLadder;
} else if (typeof window !== 'undefined') {
    window.SudokuTechniqueLadder = SudokuTechniqueLadder;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SudokuTechniqueLadder;
}
