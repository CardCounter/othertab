import SudokuTechniqueLadderModule, { SudokuTechniqueLadder as NamedTechniqueLadder } from './techniques.js';

const PRESET_TECHNIQUE_LADDER = SudokuTechniqueLadderModule || NamedTechniqueLadder || null;

const SUDOKU_DIFFICULTY_CONFIG = Object.freeze({
    easy: {
        key: 'easy',
        displayName: 'Easy',
        techniques: [
            'fullHouse', //
            'nakedSingle', //
            'hiddenSingle', //
            'lockedCandidatesType1Pointing', //
            'lockedCandidatesType2Claiming', //
            'nakedPair' //
        ],
        minGivens: 36,
        maxGivens: 49
    },
    medium: {
        key: 'medium',
        displayName: 'Medium',
        techniques: [
            'hiddenPair',
            'hiddenTriple',
            'hiddenQuadruple',
            'nakedTriple',
            'nakedQuadruple',
            'basicFish',
            'xWing',
            'skyscraper',
            'twoStringKite',
            'xyWing',
            'simpleColors'
        ],
        minGivens: 32,
        maxGivens: 35
    },
    hard: {
        key: 'hard',
        displayName: 'Hard',
        techniques: [
            'swordfish',
            'jellyfish',
            'finnedFish',
            'finnedXWing',
            'finnedSwordfish',
            'finnedJellyfish',
            'turbotFish',
            'emptyRectangle',
            'xyzWing',
            'wWing',
            'remotePair',
            'xChain',
            'xyChain',
            'niceLoop',
            'groupedNiceLoop',
            'sueDeCoq',
            'alsXz',
            'alsXyWing',
            'alsChain',
            'uniqueRectangleType1',
            'uniqueRectangleType2',
            'uniqueRectangleType3',
            'uniqueRectangleType4',
            'hiddenRectangle',
            'avoidableRectangle',
            'bugPlusOne'
        ],
        minGivens: 28,
        maxGivens: 31
    },
    expert: {
        key: 'expert',
        displayName: 'Expert',
        techniques: [
            'frankenFish',
            'mutantFish',
            'siameseFish',
            'krakenFish',
            'multiColors',
            'uniqueRectangleType5',
            'uniqueRectangleType6',
            'uniqueRectangleMissingCandidates',
            'deathBlossom',
            'forcingChain',
            'forcingNet',
            'bruteForce'
        ],
        minGivens: 17,
        maxGivens: 27
    }
});



const cloneGrid = (grid) => grid.map((row) => row.slice());

const countGivensInGrid = (grid) => {
    let count = 0;
    for (let r = 0; r < 9; r += 1) {
        for (let c = 0; c < 9; c += 1) {
            if (Number.isFinite(grid[r][c]) && grid[r][c] > 0) {
                count += 1;
            }
        }
    }
    return count;
};

const generateCompleteSolutionGrid = () => {
    const SIZE = 9;
    const BOX_SIZE = 3;

    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

    const isSafe = (row, col, num) => {
        for (let c = 0; c < SIZE; c += 1) {
            if (grid[row][c] === num) {
                return false;
            }
        }

        for (let r = 0; r < SIZE; r += 1) {
            if (grid[r][col] === num) {
                return false;
            }
        }

        const startRow = row - (row % BOX_SIZE);
        const startCol = col - (col % BOX_SIZE);
        for (let r = 0; r < BOX_SIZE; r += 1) {
            for (let c = 0; c < BOX_SIZE; c += 1) {
                if (grid[startRow + r][startCol + c] === num) {
                    return false;
                }
            }
        }

        return true;
    };

    const getShuffledDigits = () => {
        const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

        for (let i = digits.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = digits[i];
            digits[i] = digits[j];
            digits[j] = tmp;
        }

        return digits;
    };

    const solveFromIndex = (index) => {
        if (index >= SIZE * SIZE) {
            return true;
        }

        const row = Math.floor(index / SIZE);
        const col = index % SIZE;

        if (grid[row][col] !== 0) {
            return solveFromIndex(index + 1);
        }

        const digits = getShuffledDigits();
        for (let i = 0; i < digits.length; i += 1) {
            const num = digits[i];
            if (!isSafe(row, col, num)) {
                continue;
            }

            grid[row][col] = num;

            if (solveFromIndex(index + 1)) {
                return true;
            }

            grid[row][col] = 0;
        }

        return false;
    };

    solveFromIndex(0);

    return grid;
};

const shuffleArrayInPlace = (array) => {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
};

const isPlacementValid = (grid, row, col, value) => {
    if (!Number.isInteger(value) || value < 1 || value > 9) {
        return false;
    }

    for (let c = 0; c < 9; c += 1) {
        if (c !== col && grid[row][c] === value) {
            return false;
        }
    }

    for (let r = 0; r < 9; r += 1) {
        if (r !== row && grid[r][col] === value) {
            return false;
        }
    }

    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
            const currentRow = startRow + r;
            const currentCol = startCol + c;
            if (
                (currentRow !== row || currentCol !== col) &&
                grid[currentRow][currentCol] === value
            ) {
                return false;
            }
        }
    }

    return true;
};

const isGridValid = (grid) => {
    const seen = new Set();

    for (let r = 0; r < 9; r += 1) {
        seen.clear();
        for (let c = 0; c < 9; c += 1) {
            const value = grid[r][c];
            if (value <= 0) {
                continue;
            }
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
        }
    }

    for (let c = 0; c < 9; c += 1) {
        seen.clear();
        for (let r = 0; r < 9; r += 1) {
            const value = grid[r][c];
            if (value <= 0) {
                continue;
            }
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
        }
    }

    for (let boxRow = 0; boxRow < 3; boxRow += 1) {
        for (let boxCol = 0; boxCol < 3; boxCol += 1) {
            seen.clear();
            for (let r = 0; r < 3; r += 1) {
                for (let c = 0; c < 3; c += 1) {
                    const value = grid[(boxRow * 3) + r][(boxCol * 3) + c];
                    if (value <= 0) {
                        continue;
                    }
                    if (seen.has(value)) {
                        return false;
                    }
                    seen.add(value);
                }
            }
        }
    }

    return true;
};

const isGridComplete = (grid) => {
    for (let r = 0; r < 9; r += 1) {
        for (let c = 0; c < 9; c += 1) {
            if (!Number.isInteger(grid[r][c]) || grid[r][c] <= 0) {
                return false;
            }
        }
    }
    return true;
};

const buildCandidateGrid = (grid) => {
    const candidates = Array.from(
        { length: 9 },
        () => Array.from({ length: 9 }, () => [])
    );
    for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
            if (grid[row][col] > 0) {
                candidates[row][col] = [];
            } else {
                candidates[row][col] = getCandidatesForCell(grid, row, col);
            }
        }
    }
    return candidates;
};

const getCandidatesForCell = (grid, row, col) => {
    if (grid[row][col] > 0) {
        return [];
    }

    const candidates = [];
    for (let value = 1; value <= 9; value += 1) {
        if (isPlacementValid(grid, row, col, value)) {
            candidates.push(value);
        }
    }
    return candidates;
};

const loadTechniqueLadder = () => {
    if (PRESET_TECHNIQUE_LADDER) {
        return PRESET_TECHNIQUE_LADDER;
    }
    if (typeof globalThis !== 'undefined' && globalThis.SudokuTechniqueLadder) {
        return globalThis.SudokuTechniqueLadder;
    }
    if (typeof window !== 'undefined' && window.SudokuTechniqueLadder) {
        return window.SudokuTechniqueLadder;
    }
    if (typeof require === 'function') {
        try {
            const ladderModule = require('./techniques.js');
            if (ladderModule && typeof ladderModule === 'object') {
                if (ladderModule.SudokuTechniqueLadder) {
                    return ladderModule.SudokuTechniqueLadder;
                }
                return ladderModule;
            }
        } catch (error) {
            // ignore inability to require when running in the browser
        }
    }
    throw new Error('SudokuTechniqueLadder module is not available');
};

const TECHNIQUE_LADDER = loadTechniqueLadder();

const solveWithBacktracking = (grid, limitSolutions = 2) => {
    const workingGrid = cloneGrid(grid);
    const solutions = [];

    const findBestCell = () => {
        let bestCell = null;
        for (let r = 0; r < 9; r += 1) {
            for (let c = 0; c < 9; c += 1) {
                if (workingGrid[r][c] > 0) {
                    continue;
                }
                const candidates = getCandidatesForCell(workingGrid, r, c);
                if (candidates.length === 0) {
                    return { row: r, col: c, candidates };
                }
                if (
                    !bestCell ||
                    candidates.length < bestCell.candidates.length
                ) {
                    bestCell = { row: r, col: c, candidates };
                    if (candidates.length === 1) {
                        return bestCell;
                    }
                }
            }
        }
        return bestCell;
    };

    const search = () => {
        if (solutions.length >= limitSolutions) {
            return true;
        }

        const targetCell = findBestCell();
        if (!targetCell) {
            solutions.push(cloneGrid(workingGrid));
            return solutions.length >= limitSolutions;
        }

        if (targetCell.candidates.length === 0) {
            return false;
        }

        const { row, col, candidates } = targetCell;
        for (let i = 0; i < candidates.length; i += 1) {
            workingGrid[row][col] = candidates[i];
            if (search()) {
                if (solutions.length >= limitSolutions) {
                    break;
                }
            }
            workingGrid[row][col] = 0;
        }

        return solutions.length >= limitSolutions;
    };

    search();
    return {
        solutions,
        solutionCount: solutions.length
    };
};

const carvePuzzleFromSolution = (solutionGrid, config) => {
    const puzzleGrid = cloneGrid(solutionGrid);

    const runTechniqueSolver = (grid, allowedTechniques, { requireUnique = true } = {}) => {
        const workingGrid = cloneGrid(grid);
        const techniqueSequence = Array.isArray(allowedTechniques) ? allowedTechniques : [];
        const usedTechniques = new Set();

        if (!isGridValid(workingGrid)) {
            return {
                isSolvable: false,
                isUnique: false,
                usedTechniques
            };
        }

        const candidateGrid = buildCandidateGrid(workingGrid);

        let progress = true;
        while (progress) {
            progress = false;
            const appliedTechnique = TECHNIQUE_LADDER.applyTechniqueLadderStep(
                workingGrid,
                candidateGrid,
                techniqueSequence
            );
            if (appliedTechnique) {
                usedTechniques.add(appliedTechnique);
                progress = true;
            }
        }

        const solvedByTechniques = isGridComplete(workingGrid);
        if (!solvedByTechniques) {
            return {
                isSolvable: false,
                isUnique: false,
                usedTechniques
            };
        }

        const uniquenessResult = solveWithBacktracking(grid, requireUnique ? 2 : 1);
        const hasSolution = uniquenessResult.solutionCount > 0;
        const isUnique = requireUnique
            ? uniquenessResult.solutionCount === 1
            : true;

        return {
            isSolvable: hasSolution,
            isUnique,
            usedTechniques
        };
    };

    const positions = [];
    for (let r = 0; r < 9; r += 1) {
        for (let c = 0; c < 9; c += 1) {
            positions.push({ r, c });
        }
    }
    shuffleArrayInPlace(positions);

    let currentGivenCount = countGivensInGrid(puzzleGrid);
    const aggregatedUsedTechniques = new Set();

    for (const { r, c } of positions) {
        const originalValue = puzzleGrid[r][c];
        if (!Number.isFinite(originalValue) || originalValue <= 0) {
            continue;
        }

        if (currentGivenCount <= config.minGivens) {
            break;
        }

        puzzleGrid[r][c] = 0;
        currentGivenCount -= 1;

        if (currentGivenCount < config.minGivens) {
            puzzleGrid[r][c] = originalValue;
            currentGivenCount += 1;
            continue;
        }

        const stepAnalysis = runTechniqueSolver(
            puzzleGrid,
            config.techniques,
            { requireUnique: true }
        );

        if (!stepAnalysis.isSolvable || !stepAnalysis.isUnique) {
            puzzleGrid[r][c] = originalValue;
            currentGivenCount += 1;
            continue;
        }

        if (stepAnalysis.usedTechniques && stepAnalysis.usedTechniques.size > 0) {
            stepAnalysis.usedTechniques.forEach((t) => aggregatedUsedTechniques.add(t));
        }
    }

    const finalAnalysis = runTechniqueSolver(
        puzzleGrid,
        config.techniques,
        { requireUnique: true }
    );

    const finalUsed = new Set(aggregatedUsedTechniques);
    if (finalAnalysis.usedTechniques && finalAnalysis.usedTechniques.size > 0) {
        finalAnalysis.usedTechniques.forEach((t) => finalUsed.add(t));
    }

    return {
        puzzleGrid,
        analysis: {
            isSolvable: finalAnalysis.isSolvable,
            isUnique: finalAnalysis.isUnique,
            usedTechniques: finalUsed
        }
    };
};

const generateSudokuPuzzle = (difficultyKey = 'easy', options = {}) => {
    const config =
        SUDOKU_DIFFICULTY_CONFIG[difficultyKey] ||
        SUDOKU_DIFFICULTY_CONFIG.easy;

    const maxAttempts = Number.isFinite(options.maxAttempts)
        ? options.maxAttempts
        : 50;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const solutionGrid = generateCompleteSolutionGrid();

        const { puzzleGrid, analysis } = carvePuzzleFromSolution(solutionGrid, config);

        const givenCount = countGivensInGrid(puzzleGrid);
        if (givenCount < config.minGivens || givenCount > config.maxGivens) {
            continue;
        }

        if (!analysis.isSolvable || !analysis.isUnique) {
            continue;
        }

        return {
            puzzle: puzzleGrid,
            solution: solutionGrid,
            difficulty: config.key,
            attempt,
            meta: {
                givenCount,
                techniquesUsed: analysis.usedTechniques
            }
        };
    }

    throw new Error(
        `Failed to generate a "${difficultyKey}" Sudoku after ${maxAttempts} attempts`
    );
};

export {
    generateSudokuPuzzle,
    SUDOKU_DIFFICULTY_CONFIG
};

export default generateSudokuPuzzle;

if (typeof window !== 'undefined') {
    window.generateSudokuPuzzle = generateSudokuPuzzle;
    window.SUDOKU_DIFFICULTY_CONFIG = SUDOKU_DIFFICULTY_CONFIG;
}
