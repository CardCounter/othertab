// Difficulty configuration: which techniques are allowed and givens range
const SUDOKU_DIFFICULTY_CONFIG = Object.freeze({
    easy: {
        key: 'easy',
        displayName: 'Easy',
        // Basic human techniques
        techniques: [
            'fullHouse',
            'nakedSingle',
            'hiddenSingle',
            'lockedCandidatesType1Pointing',
            'lockedCandidatesType2Claiming',
            'nakedPair'
        ],
        minGivens: 36,
        maxGivens: 49
    },
    medium: {
        key: 'medium',
        displayName: 'Medium',
        // Standard subset + simple pattern techniques
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
        // Heavier patterns, finned fish, most uniqueness, ALS, chains
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
            'niceLoop',              // Nice Loop / AIC
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
        // Monster stuff and methods of last resort
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



/**
 * Shallow utility helpers for grids
 */
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

        // Local Fisher–Yates shuffle so we don't rely on external helpers
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

            // Backtrack
            grid[row][col] = 0;
        }

        // No valid number here, trigger backtracking
        return false;
    };

    solveFromIndex(0);

    return grid;
};

// Helper: in-place Fisher–Yates shuffle
const shuffleArrayInPlace = (array) => {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
};

/**
 * Combined carve + technique-based analysis.
 *
 * - Starts from a complete solutionGrid
 * - Iteratively removes clues in random order
 * - After each removal:
 *    - checks solvability with allowed techniques
 *    - checks uniqueness (no second solution)
 *    - ensures givens don't go below config.minGivens
 * - Stops when no further valid removals are possible
 *
 * Returns:
 *   {
 *     puzzleGrid,          // the carved puzzle
 *     analysis: {
 *       isSolvable,        // solvable with allowed techniques
 *       isUnique,          // (heuristic) uniqueness check
 *       usedTechniques     // Set of technique names actually used
 *     }
 *   }
 */
const carvePuzzleFromSolution = (solutionGrid, config) => {
    const puzzleGrid = cloneGrid(solutionGrid);

    // Local wrapper that will later call the real technique helpers.
    // For now it's a stub, but the *interface* is what we care about.
    const runTechniqueSolver = (grid, allowedTechniques, { requireUnique = true } = {}) => {
        // TODO: implement human-style solver that:
        //  - tries allowedTechniques in some order
        //  - tracks which ones were actually used
        //  - checks uniqueness (e.g., backtracking solver that looks for >1 solution)

        // TEMP STUB so the generator wiring works:
        return {
            isSolvable: true,
            isUnique: !requireUnique ? true : true,
            usedTechniques: new Set()
        };
    };

    // Build list of all cell positions and randomize removal order.
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

        // Don't go below the minimum givens for this difficulty.
        if (currentGivenCount <= config.minGivens) {
            break;
        }

        // Tentatively remove this clue.
        puzzleGrid[r][c] = 0;
        currentGivenCount -= 1;

        // Quick sanity on givens range: if we somehow go below min, revert.
        if (currentGivenCount < config.minGivens) {
            puzzleGrid[r][c] = originalValue;
            currentGivenCount += 1;
            continue;
        }

        // Ask the technique-based solver if this puzzle is still okay.
        const stepAnalysis = runTechniqueSolver(
            puzzleGrid,
            config.techniques,
            { requireUnique: true }
        );

        if (!stepAnalysis.isSolvable || !stepAnalysis.isUnique) {
            // Revert removal – this clue is necessary.
            puzzleGrid[r][c] = originalValue;
            currentGivenCount += 1;
            continue;
        }

        // Keep this removal and aggregate any techniques that were used.
        if (stepAnalysis.usedTechniques && stepAnalysis.usedTechniques.size > 0) {
            stepAnalysis.usedTechniques.forEach((t) => aggregatedUsedTechniques.add(t));
        }
    }

    // Final analysis pass so that the returned metadata reflects the final puzzle.
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

/**
 * Main generator function.
 *
 * This is the thing you’ll call like:
 *   const { puzzle, solution, meta } = generateSudokuPuzzle('medium');
 */
const generateSudokuPuzzle = (difficultyKey = 'easy', options = {}) => {
    const config =
        SUDOKU_DIFFICULTY_CONFIG[difficultyKey] ||
        SUDOKU_DIFFICULTY_CONFIG.easy;

    const maxAttempts = Number.isFinite(options.maxAttempts)
        ? options.maxAttempts
        : 50;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // 1. Generate a full valid solution
        const solutionGrid = generateCompleteSolutionGrid();

        // 2. Carve a puzzle from the solution while enforcing techniques + givens range
        const { puzzleGrid, analysis } = carvePuzzleFromSolution(solutionGrid, config);

        // 3. Sanity check on givens range (should already be true, but double-check)
        const givenCount = countGivensInGrid(puzzleGrid);
        if (givenCount < config.minGivens || givenCount > config.maxGivens) {
            continue;
        }

        // 4. Make sure final analysis says it's solvable + unique
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

// Optional: expose for debugging in the browser console
if (typeof window !== 'undefined') {
    window.generateSudokuPuzzle = generateSudokuPuzzle;
    window.SUDOKU_DIFFICULTY_CONFIG = SUDOKU_DIFFICULTY_CONFIG;
}

/// end puzzle gen
