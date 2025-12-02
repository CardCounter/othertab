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

    const TECHNIQUE_EXECUTORS = Object.freeze({
        fullHouse: applyFullHouse,
        nakedSingle: applyNakedSingles,
        hiddenSingle: applyHiddenSingles,
        lockedCandidatesType1Pointing: applyLockedCandidatesType1Pointing,
        lockedCandidatesType2Claiming: applyLockedCandidatesType2Claiming,
        nakedPair: applyNakedPairs
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
            if (executeTechnique(techniqueName, grid, candidates)) {
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
