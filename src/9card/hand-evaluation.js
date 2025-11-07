import { CHIP_SYMBOL, DICE_SYMBOL, HAND_LABELS, STREAK_TARGET, RANKS, SUITS } from "./config.js";
import { formatChipAmount } from "./chips.js";

const FOUR_CARD_STRAIGHT_FLAG = "straight_four_card_scoring";
const CLASSIFICATION_PRIORITY = [
    "royal_flush",
    "straight_flush",
    "four_kind",
    "full_house",
    "flush",
    "straight",
    "three_kind",
    "two_pair",
    "pair",
    "high_card"
];
const CLASSIFICATION_PRIORITY_INDEX = new Map(
    CLASSIFICATION_PRIORITY.map((id, index) => [id, index])
);
const VALUE_TO_RANK_SYMBOL = new Map(RANKS.map(({ value, symbol }) => [value, symbol]));
const SUIT_SYMBOL_TO_NAME = new Map(SUITS.map(({ symbol, name }) => [symbol, name]));
const SUIT_SYMBOL_TO_COLOR = new Map(SUITS.map(({ symbol, color }) => [symbol, color]));
const SUIT_SYMBOLS = SUITS.map(({ symbol }) => symbol);

function hasUpgradeFlag(context, flag) {
    if (!context || !flag) {
        return false;
    }
    if (context.flags instanceof Set && context.flags.has(flag)) {
        return true;
    }
    if (Array.isArray(context.flags) && context.flags.includes(flag)) {
        return true;
    }
    if (Array.isArray(context.flagList) && context.flagList.includes(flag)) {
        return true;
    }
    return false;
}

function shouldAllowFourCardStraight(context) {
    if (!context) {
        return false;
    }
    if (context.state?.straightFourCardActive) {
        return true;
    }
    return hasUpgradeFlag(context, FOUR_CARD_STRAIGHT_FLAG);
}

function findFourCardStraightRun(values) {
    if (!Array.isArray(values) || values.length < 4) {
        return null;
    }
    const unique = [...new Set(values)].sort((a, b) => a - b);
    const valueSet = new Set(unique);
    let best = null;

    unique.forEach((start) => {
        const sequence = [start, start + 1, start + 2, start + 3];
        const isRun = sequence.every((value) => valueSet.has(value));
        if (!isRun) {
            return;
        }
        const high = sequence[sequence.length - 1];
        if (!best || high > best.high) {
            best = { sequenceValues: sequence, high };
        }
    });

    const wheelSequence = [14, 2, 3, 4];
    const hasWheel = wheelSequence.every((value) => valueSet.has(value));
    if (hasWheel) {
        const wheel = { sequenceValues: wheelSequence, high: 4 };
        if (!best || wheel.high > best.high) {
            best = wheel;
        }
    }

    return best;
}

export function isStraight(values, handSize, context = {}) {
    return detectStandardStraight(values, handSize, context);
}

export function detectStandardStraight(values, handSize, context = {}) {
    const count = Number.isFinite(handSize) ? Math.floor(handSize) : values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const unique = [...new Set(sorted)];
    const baseResult = {
        straight: false,
        high: null,
        length: 0,
        sequenceValues: []
    };
    if (unique.length === count) {
        const first = unique[0];
        const expected = Array.from({ length: count }, (_, index) => first + index);
        const matches = expected.every((value, index) => value === unique[index]);
        if (matches) {
            return {
                straight: true,
                high: unique[unique.length - 1],
                length: count,
                sequenceValues: [...unique]
            };
        }
        if (count === 5) {
            const wheel = [2, 3, 4, 5, 14];
            const isWheel = wheel.every((value, index) => unique[index] === value);
            if (isWheel) {
                return {
                    straight: true,
                    high: 5,
                    length: wheel.length,
                    sequenceValues: wheel
                };
            }
        }
    }

    if (shouldAllowFourCardStraight(context)) {
        const run = findFourCardStraightRun(unique);
        if (run) {
            return {
                straight: true,
                high: run.high,
                length: run.sequenceValues.length,
                sequenceValues: run.sequenceValues
            };
        }
    }

    return baseResult;
}

export function analyzeHand(cards, handSize, options = {}) {
    const count = Number.isFinite(handSize) ? Math.floor(handSize) : cards.length;
    const suits = cards.map((card) => card.suit);
    const values = cards.map((card) => card.value);
    const detectStraight = typeof options.detectStraight === "function"
        ? options.detectStraight
        : detectStandardStraight;
    const straight = detectStraight(values, count, options.context ?? {});
    const counts = new Map();
    const valueIndices = new Map();
    cards.forEach((card, index) => {
        if (!card) {
            return;
        }
        const list = valueIndices.get(card.value);
        if (list) {
            list.push(index);
        } else {
            valueIndices.set(card.value, [index]);
        }
    });
    values.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    const countValues = Array.from(counts.values()).sort((a, b) => b - a);
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
    return {
        cards,
        count,
        suits,
        values,
        flush: suits.length > 0 ? suits.every((suit) => suit === suits[0]) : false,
        straight,
        counts,
        countValues,
        uniqueValues,
        valueIndices
    };
}

function collectIndicesForValues(analysis, valueSequence) {
    if (!analysis || !Array.isArray(analysis.cards) || !Array.isArray(valueSequence) || valueSequence.length === 0) {
        return [];
    }
    const remaining = new Map();
    valueSequence.forEach((value) => {
        if (value == null) {
            return;
        }
        remaining.set(value, (remaining.get(value) ?? 0) + 1);
    });
    if (remaining.size === 0) {
        return [];
    }
    const indices = [];
    for (let index = 0; index < analysis.cards.length; index += 1) {
        if (remaining.size === 0) {
            break;
        }
        const card = analysis.cards[index];
        if (!card) {
            continue;
        }
        const value = card.value;
        if (!remaining.has(value)) {
            continue;
        }
        const count = remaining.get(value);
        indices.push(index);
        if (count <= 1) {
            remaining.delete(value);
        } else {
            remaining.set(value, count - 1);
        }
    }
    return indices;
}

function resolveHighlightIndicesFromAnalysis(analysis, classificationId) {
    if (!analysis || !classificationId) {
        return [];
    }
    const { valueIndices } = analysis;
    const indexEntries = valueIndices instanceof Map ? [...valueIndices.entries()] : [];
    const findValueByCount = (count) => {
        const entry = indexEntries.find(([, indices]) => indices.length === count);
        return entry ? entry[0] : null;
    };
    const findValuesByCount = (count) =>
        indexEntries.filter(([, indices]) => indices.length === count).map(([value]) => value);

    switch (classificationId) {
        case "high_card": {
            const values = Array.isArray(analysis.values) ? analysis.values : [];
            if (values.length === 0) {
                return [];
            }
            const maxValue = Math.max(...values);
            return Number.isFinite(maxValue) ? collectIndicesForValues(analysis, [maxValue]) : [];
        }
        case "pair": {
            const value = findValueByCount(2);
            return value != null ? collectIndicesForValues(analysis, [value, value]) : [];
        }
        case "two_pair": {
            const values = findValuesByCount(2).slice(0, 2);
            if (values.length === 0) {
                return [];
            }
            const multiset = values.flatMap((value) => [value, value]);
            return collectIndicesForValues(analysis, multiset);
        }
        case "three_kind": {
            const value = findValueByCount(3);
            return value != null ? collectIndicesForValues(analysis, [value, value, value]) : [];
        }
        case "four_kind": {
            const value = findValueByCount(4);
            return value != null
                ? collectIndicesForValues(analysis, [value, value, value, value])
                : [];
        }
        case "full_house": {
            const tripleValue = findValueByCount(3);
            const pairValue = findValueByCount(2);
            if (tripleValue != null && pairValue != null) {
                return collectIndicesForValues(analysis, [
                    tripleValue,
                    tripleValue,
                    tripleValue,
                    pairValue,
                    pairValue
                ]);
            }
            return analysis.cards.map((_, index) => index);
        }
        case "straight":
        case "straight_flush":
        case "royal_flush": {
            if (!analysis.straight?.straight) {
                return [];
            }
            const sequence = Array.isArray(analysis.straight.sequenceValues) && analysis.straight.sequenceValues.length > 0
                ? analysis.straight.sequenceValues
                : analysis.uniqueValues;
            return collectIndicesForValues(analysis, sequence);
        }
        case "flush": {
            if (!Array.isArray(analysis.cards) || analysis.cards.length === 0) {
                return [];
            }
            const targetSuit = analysis.cards[0]?.suit ?? null;
            if (!targetSuit) {
                return [];
            }
            const indices = [];
            analysis.cards.forEach((card, index) => {
                if (card?.suit === targetSuit) {
                    indices.push(index);
                }
            });
            return indices;
        }
        default:
            return [];
    }
}

export const DEFAULT_CLASSIFICATION_RULES = [
    (analysis) => {
        if (analysis.straight?.straight && analysis.flush) {
            if (analysis.straight.high === 14) {
                return { id: "royal_flush" };
            }
            return { id: "straight_flush" };
        }
        return null;
    },
    (analysis) => {
        if (analysis.countValues[0] === 4) {
            return { id: "four_kind" };
        }
        return null;
    },
    (analysis) => {
        if (analysis.countValues[0] === 3 && analysis.countValues[1] === 2) {
            return { id: "full_house" };
        }
        return null;
    },
    (analysis) => {
        if (analysis.flush) {
            return { id: "flush" };
        }
        return null;
    },
    (analysis) => {
        if (analysis.straight?.straight) {
            return { id: "straight" };
        }
        return null;
    },
    (analysis) => {
        if (analysis.countValues[0] === 3) {
            return { id: "three_kind" };
        }
        return null;
    },
    (analysis) => {
        if (analysis.countValues[0] === 2) {
            const pairCount = analysis.countValues.filter((value) => value === 2).length;
            if (pairCount === 2) {
                return { id: "two_pair" };
            }
            return { id: "pair" };
        }
        return null;
    },
    () => ({ id: "high_card" })
];

function resolveHandLabels(options = {}) {
    if (options.handLabels && typeof options.handLabels === "object") {
        return { ...HAND_LABELS, ...options.handLabels };
    }
    return HAND_LABELS;
}

function applyClassificationRules(analysis, context, rules, labels) {
    for (let index = 0; index < rules.length; index += 1) {
        const rule = rules[index];
        if (typeof rule !== "function") {
            continue;
        }
        const result = rule(analysis, context);
        if (!result || typeof result !== "object" || !result.id) {
            continue;
        }
        if (!result.label) {
            result.label = labels[result.id] ?? HAND_LABELS[result.id] ?? result.id;
        }
        if (!Array.isArray(result.highlightIndices)) {
            result.highlightIndices = resolveHighlightIndicesFromAnalysis(analysis, result.id);
        }
        return result;
    }
    const fallback = {
        id: "high_card",
        label: labels.high_card ?? HAND_LABELS.high_card
    };
    fallback.highlightIndices = resolveHighlightIndicesFromAnalysis(analysis, fallback.id);
    return fallback;
}

export function evaluateHandWithWildcards(cards, handSize, context, detectStraight, rules, labels) {
    if (!Array.isArray(cards) || cards.length === 0) {
        const analysis = analyzeHand([], handSize, {
            detectStraight,
            context
        });
        return applyClassificationRules(analysis, context, rules, labels);
    }

    const markWildcardContribution = (classification, cardList) => {
        if (!classification || typeof classification !== "object") {
            return;
        }
        const highlights = Array.isArray(classification.highlightIndices)
            ? classification.highlightIndices
            : [];
        if (highlights.length === 0) {
            classification.wildcardsContributed = false;
            if ("wildcardIndices" in classification) {
                delete classification.wildcardIndices;
            }
            return;
        }
        const wildcardIndices = [];
        highlights.forEach((index) => {
            if (!Array.isArray(cardList)) {
                return;
            }
            const card = cardList[index];
            if (card?.wildAssigned === true || card?.isWild === true) {
                wildcardIndices.push(index);
            }
        });
        classification.wildcardsContributed = wildcardIndices.length > 0;
        if (wildcardIndices.length > 0) {
            classification.wildcardIndices = wildcardIndices;
        } else if ("wildcardIndices" in classification) {
            delete classification.wildcardIndices;
        }
    };

    const wildIndices = [];
    const nonWildCards = [];
    cards.forEach((card, index) => {
        if (card?.isWild === true) {
            wildIndices.push(index);
        } else if (card) {
            nonWildCards.push({ card, index });
        }
    });

    const wildCount = wildIndices.length;
    if (wildCount === 0) {
        const analysis = analyzeHand(cards, handSize, {
            detectStraight,
            context
        });
        const classification = applyClassificationRules(analysis, context, rules, labels);
        markWildcardContribution(classification, cards);
        return classification;
    }

    const getPriorityIndex = (id) =>
        CLASSIFICATION_PRIORITY_INDEX.get(id) ?? CLASSIFICATION_PRIORITY.length;

    const targetId = typeof context?.state?.config?.target === "string"
        ? context.state.config.target
        : null;

    let flushCompatible = true;
    let strictFlushSuit = null;
    if (nonWildCards.length === 0) {
        strictFlushSuit = null;
    } else {
        for (let i = 0; i < nonWildCards.length; i += 1) {
            const suit = nonWildCards[i].card?.suit ?? null;
            if (!suit) {
                flushCompatible = false;
                break;
            }
            if (strictFlushSuit == null) {
                strictFlushSuit = suit;
            } else if (strictFlushSuit !== suit) {
                flushCompatible = false;
                break;
            }
        }
    }

    let flushSuitOptions = [];
    if (!flushCompatible) {
        flushSuitOptions = [];
    } else if (strictFlushSuit) {
        flushSuitOptions = [strictFlushSuit];
    } else {
        flushSuitOptions = [...SUIT_SYMBOLS];
    }

    const suitModes = [];
    flushSuitOptions.forEach((suit) => {
        suitModes.push({ type: "flush", suit });
    });
    suitModes.push({
        type: "mixed",
        avoidSuit: flushSuitOptions.length === 1 ? flushSuitOptions[0] : null
    });

    const compareValueVectors = (a, b) => {
        const length = Math.max(a.length, b.length);
        for (let index = 0; index < length; index += 1) {
            const aValue = a[index] ?? Number.NEGATIVE_INFINITY;
            const bValue = b[index] ?? Number.NEGATIVE_INFINITY;
            if (aValue !== bValue) {
                return bValue - aValue;
            }
        }
        return 0;
    };

    const compareResults = (entryA, entryB) => {
        const priorityDiff = getPriorityIndex(entryA.classification.id)
            - getPriorityIndex(entryB.classification.id);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }
        const wildcardDiff = entryA.wildcardUseCount - entryB.wildcardUseCount;
        if (wildcardDiff !== 0) {
            return wildcardDiff;
        }
        const valueDiff = compareValueVectors(entryA.valuesDescending, entryB.valuesDescending);
        if (valueDiff !== 0) {
            return valueDiff;
        }
        return 0;
    };

    const compareTargetResults = (entryA, entryB) => {
        const wildcardDiff = entryA.wildcardUseCount - entryB.wildcardUseCount;
        if (wildcardDiff !== 0) {
            return wildcardDiff;
        }
        const valueDiff = compareValueVectors(entryA.valuesDescending, entryB.valuesDescending);
        if (valueDiff !== 0) {
            return valueDiff;
        }
        return 0;
    };

    const resolveMixedSuit = (wildIndex, card, avoidSuit) => {
        if (card?.suit && card.suit !== "*" && (!avoidSuit || card.suit !== avoidSuit)) {
            return card.suit;
        }
        for (let offset = 0; offset < SUIT_SYMBOLS.length; offset += 1) {
            const candidate = SUIT_SYMBOLS[(wildIndex + offset) % SUIT_SYMBOLS.length];
            if (!avoidSuit || candidate !== avoidSuit) {
                return candidate;
            }
        }
        return SUIT_SYMBOLS[0];
    };

    const buildResolvedCards = (comboValues, suitMode) => {
        let assignmentIndex = 0;
        return cards.map((card) => {
            if (!card) {
                return card;
            }
            if (card.isWild === true) {
                const assignedValue = comboValues[assignmentIndex] ?? 14;
                let assignedSuit;
                if (suitMode.type === "flush") {
                    assignedSuit = suitMode.suit;
                } else {
                    assignedSuit = resolveMixedSuit(assignmentIndex, card, suitMode.avoidSuit);
                }
                const suitName = SUIT_SYMBOL_TO_NAME.get(assignedSuit) ?? card.suitName ?? "wild";
                const suitColor = SUIT_SYMBOL_TO_COLOR.get(assignedSuit) ?? card.color ?? "wild";
                const rankSymbol = VALUE_TO_RANK_SYMBOL.get(assignedValue) ?? card.rank;
                assignmentIndex += 1;
                return {
                    ...card,
                    rank: rankSymbol,
                    value: assignedValue,
                    suit: assignedSuit,
                    suitName,
                    color: suitColor,
                    wildAssigned: true
                };
            }
            return card;
        });
    };

    const createAssignmentKey = (resolvedCards, suitMode) => {
        const valuePart = resolvedCards
            .map((card) => (Number.isFinite(card?.value) ? card.value : "x"))
            .join("-");
        const suitPart = resolvedCards.map((card) => card?.suit ?? "*").join("");
        return `${valuePart}|${suitPart}|${suitMode.type === "flush" ? `F-${suitMode.suit}` : "M"}`;
    };

    const visited = new Set();
    let targetResult = null;
    let bestResult = null;
    const allResults = [];

    const processResolvedCards = (resolvedCards, suitMode) => {
        const key = createAssignmentKey(resolvedCards, suitMode);
        if (visited.has(key)) {
            return;
        }
        visited.add(key);

        const analysis = analyzeHand(resolvedCards, handSize, {
            detectStraight,
            context
        });
        const classification = applyClassificationRules(analysis, context, rules, labels);
        markWildcardContribution(classification, resolvedCards);
        const wildcardUseCount = Array.isArray(classification.wildcardIndices)
            ? classification.wildcardIndices.length
            : 0;
        const valuesDescending = resolvedCards
            .map((entry) => (Number.isFinite(entry?.value) ? entry.value : Number.NEGATIVE_INFINITY))
            .sort((a, b) => b - a);
        const result = {
            classification,
            wildcardUseCount,
            valuesDescending
        };

        allResults.push(result);

        if (targetId && classification.id === targetId) {
            if (!targetResult || compareTargetResults(result, targetResult) < 0) {
                targetResult = result;
            }
        }

        if (!bestResult || compareResults(result, bestResult) < 0) {
            bestResult = result;
        }
    };

    const wildcardValues = [];
    const generateValueCombinations = (minValue, depth) => {
        if (depth === wildCount) {
            suitModes.forEach((suitMode) => {
                const resolvedCards = buildResolvedCards(wildcardValues, suitMode);
                processResolvedCards(resolvedCards, suitMode);
            });
            return;
        }
        for (let value = minValue; value <= 14; value += 1) {
            wildcardValues[depth] = value;
            generateValueCombinations(value, depth + 1);
        }
    };

    generateValueCombinations(2, 0);

    // if target is set but targetResult is null, check all results again
    // this handles cases where targetResult might have been missed
    if (targetId && !targetResult && allResults.length > 0) {
        for (const result of allResults) {
            if (result.classification.id === targetId) {
                if (!targetResult || compareTargetResults(result, targetResult) < 0) {
                    targetResult = result;
                }
            }
        }
    }

    if (targetResult) {
        return targetResult.classification;
    }
    if (bestResult) {
        return bestResult.classification;
    }

    const fallbackAnalysis = analyzeHand(cards, handSize, {
        detectStraight,
        context
    });
    const fallbackClassification = applyClassificationRules(
        fallbackAnalysis,
        context,
        rules,
        labels
    );
    markWildcardContribution(fallbackClassification, cards);
    return fallbackClassification;
}

export function createStandardEvaluator(options = {}) {
    const labels = resolveHandLabels(options);
    const detectStraight = typeof options.detectStraight === "function"
        ? options.detectStraight
        : detectStandardStraight;
    const rules = Array.isArray(options.rules) && options.rules.length > 0
        ? options.rules
        : DEFAULT_CLASSIFICATION_RULES;
    return (cards, handSize, context = {}) => {
        if (Array.isArray(cards) && cards.some((card) => card?.isWild === true)) {
            return evaluateHandWithWildcards(cards, handSize, context, detectStraight, rules, labels);
        }
        const analysis = analyzeHand(cards, handSize, {
            detectStraight,
            context
        });
        return applyClassificationRules(analysis, context, rules, labels);
    };
}

function getLegacyHighlightIndices(cards, classificationId, handSize) {
    if (!Array.isArray(cards) || typeof classificationId !== "string") {
        return [];
    }
    const count = Number.isFinite(handSize) ? Math.floor(handSize) : cards.length;
    const values = cards.map((card) => card.value);
    const indexMap = new Map();
    values.forEach((value, index) => {
        const list = indexMap.get(value);
        if (list) {
            list.push(index);
        } else {
            indexMap.set(value, [index]);
        }
    });

    switch (classificationId) {
        case "high_card": {
            const maxValue = Math.max(...values);
            return indexMap.get(maxValue) ?? [];
        }
        case "pair": {
            const pair = [...indexMap.values()].find((indices) => indices.length === 2);
            return pair ?? [];
        }
        case "two_pair": {
            return [...indexMap.values()]
                .filter((indices) => indices.length === 2)
                .flat();
        }
        case "three_kind": {
            const triple = [...indexMap.values()].find((indices) => indices.length === 3);
            return triple ?? [];
        }
        case "four_kind": {
            const quad = [...indexMap.values()].find((indices) => indices.length === 4);
            return quad ?? [];
        }
        case "full_house":
        case "straight":
        case "flush":
        case "straight_flush":
        case "royal_flush": {
            return Array.from({ length: count }, (_, index) => index);
        }
        default:
            return [];
    }
}

export function getHighlightIndices(arg1, arg2, arg3) {
    if (Array.isArray(arg1) && typeof arg2 === "string") {
        return getLegacyHighlightIndices(arg1, arg2, arg3);
    }
    const classification = arg1;
    const cards = arg2;
    const handSize = arg3;
    if (Array.isArray(classification?.highlightIndices)) {
        return classification.highlightIndices;
    }
    if (classification?.id) {
        return getLegacyHighlightIndices(cards, classification.id, handSize);
    }
    return [];
}

function formatDiceAmount(value) {
    const integerValue = Number.isFinite(value) ? Math.ceil(Math.max(0, value)) : 0;
    const SCIENTIFIC_NOTATION_THRESHOLD = 100_000_000;
    if (integerValue >= SCIENTIFIC_NOTATION_THRESHOLD) {
        return integerValue.toExponential(2).replace("e+", "e");
    }
    return integerValue.toLocaleString();
}

export function buildResultMessage({ success, classification, streak, permanentlyCompleted, payout = 0, diceAwarded = 0 }) {
    if (success) {
        const formattedPayout = formatChipAmount(payout, { includeSymbol: false });
        const formattedDice = formatDiceAmount(diceAwarded);
        if (permanentlyCompleted || streak >= STREAK_TARGET) {
            return `hit ${classification.label}. payout ${formattedPayout}${CHIP_SYMBOL}, ${formattedDice}${DICE_SYMBOL}. streak ${streak}/${STREAK_TARGET}`;
        }
        return `hit ${classification.label}. payout ${formattedPayout}${CHIP_SYMBOL}, ${formattedDice}${DICE_SYMBOL}. streak ${streak}/${STREAK_TARGET}`;
    }
    return `missed (${classification.label})`;
}

// --- Wildcard-aware "attainable categories" + "exactness" helpers -----------------

// Internal: derive simple counts (values/suits) and wild count from this project's card model
function _statFromCards(cards) {
    const stat = {
        valueCounts: new Map(),   // key: numeric value (2..14)
        suitCounts: new Map(),    // key: suit symbol from config
        bySuitValues: new Map(),  // key: suit -> Set of values present in that suit
        wilds: 0
    };

    const isCardWild = (c) =>
        c?.isWild === true ||
        c?.rank === "W" || c?.suit === "W" || c?.suit === "*" ||
        c?.wildAssigned === true; // already assigned wilds should still be treated as flexible for attainability checks

    // initialize suit maps from config to be safe
    SUIT_SYMBOLS.forEach(s => {
        stat.suitCounts.set(s, 0);
        stat.bySuitValues.set(s, new Set());
    });

    for (const c of Array.isArray(cards) ? cards : []) {
        if (!c) continue;
        if (isCardWild(c)) {
            stat.wilds += 1;
            continue;
        }
        // value
        if (Number.isFinite(c.value)) {
            stat.valueCounts.set(c.value, (stat.valueCounts.get(c.value) ?? 0) + 1);
        }
        // suit + per-suit value set
        if (c.suit && stat.suitCounts.has(c.suit)) {
            stat.suitCounts.set(c.suit, (stat.suitCounts.get(c.suit) ?? 0) + 1);
            if (Number.isFinite(c.value)) {
                stat.bySuitValues.get(c.suit).add(c.value);
            }
        }
    }
    return stat;
}

// Straight windows (values). Includes wheel A(14)-to-5 straight.
const _STRAIGHT_WINDOWS = [
    [10,11,12,13,14], // Ten to Ace
    [9,10,11,12,13],
    [8,9,10,11,12],
    [7,8,9,10,11],
    [6,7,8,9,10],
    [5,6,7,8,9],
    [4,5,6,7,8],
    [3,4,5,6,7],
    [2,3,4,5,6],
    [14,2,3,4,5] // wheel, high = 5
];

// Helpers to read counts
function _countOfValue(stat, v) { return stat.valueCounts.get(v) ?? 0; }
function _maxOfMap(m) {
    let max = 0;
    for (const [,v] of m) if (v > max) max = v;
    return max;
}

// --- Attainability checkers (ignore "exactness") ---------------------------------

function _canMakeFourKind(stat) {
    for (let v = 2; v <= 14; v += 1) {
        if (_countOfValue(stat, v) + stat.wilds >= 4) return true;
    }
    return false;
}

function _canMakeFullHouse(stat) {
    for (let tripV = 2; tripV <= 14; tripV += 1) {
        const haveTrip = _countOfValue(stat, tripV);
        const needTrip = Math.max(0, 3 - haveTrip);
        if (needTrip > stat.wilds) continue;
        const left = stat.wilds - needTrip;

        // can we form a pair of some OTHER rank?
        for (let pairV = 2; pairV <= 14; pairV += 1) {
            if (pairV === tripV) continue;
            const havePair = _countOfValue(stat, pairV);
            const needPair = Math.max(0, 2 - havePair);
            if (needPair <= left) return true;
        }
        // Or use entirely new ranks not present (two wilds left)
        if (left >= 2) return true;
    }
    return false;
}

function _canMakeThreeKind(stat) {
    for (let v = 2; v <= 14; v += 1) {
        if (_countOfValue(stat, v) + stat.wilds >= 3) return true;
    }
    return false;
}

function _canMakeTwoPair(stat) {
    // Choose two distinct ranks; allocate wilds to complete both pairs.
    const counts = [];
    for (let v = 2; v <= 14; v += 1) counts.push(_countOfValue(stat, v));
    for (let i = 0; i < counts.length; i++) {
        for (let j = i + 1; j < counts.length; j++) {
            const need = Math.max(0, 2 - counts[i]) + Math.max(0, 2 - counts[j]);
            if (need <= stat.wilds) return true;
        }
    }
    // Also possible to create both pairs entirely from wilds
    return stat.wilds >= 4;
}

function _canMakePair(stat) {
    for (let v = 2; v <= 14; v += 1) {
        if (_countOfValue(stat, v) + stat.wilds >= 2) return true;
    }
    return false;
}

function _canMakeFlush(stat) {
    for (const s of SUIT_SYMBOLS) {
        if ((stat.suitCounts.get(s) ?? 0) + stat.wilds >= 5) return true;
    }
    return false;
}

function _canMakeStraight(stat) {
    for (const window of _STRAIGHT_WINDOWS) {
        let missing = 0;
        for (const v of window) {
            if (_countOfValue(stat, v) <= 0) missing += 1;
        }
        if (missing <= stat.wilds) return true;
    }
    return false;
}

function _canMakeStraightFlush(stat) {
    // Per-suit check using values present in that suit; wilds can adopt the suit.
    for (const s of SUIT_SYMBOLS) {
        const present = stat.bySuitValues.get(s) || new Set();
        if ((present.size + stat.wilds) < 5) continue;
        for (const window of _STRAIGHT_WINDOWS) {
            let missing = 0;
            for (const v of window) {
                if (!present.has(v)) missing += 1;
            }
            if (missing <= stat.wilds) return true;
        }
    }
    return false;
}

function _canMakeRoyalFlush(stat) {
    // Need straight-flush specifically for 10,J,Q,K,A
    const royal = [10,11,12,13,14];
    for (const s of SUIT_SYMBOLS) {
        const present = stat.bySuitValues.get(s) || new Set();
        if ((present.size + stat.wilds) < 5) continue;
        let missing = 0;
        for (const v of royal) if (!present.has(v)) missing += 1;
        if (missing <= stat.wilds) return true;
    }
    return false;
}

// --- Best category with wilds (project's category IDs) ---------------------------

const _CATEGORY_ORDER = [
    "royal_flush",
    "straight_flush",
    "four_kind",
    "full_house",
    "flush",
    "straight",
    "three_kind",
    "two_pair",
    "pair",
    "high_card"
];

function _bestCategoryWithWildsId(cards) {
    const stat = _statFromCards(cards);

    if (_canMakeRoyalFlush(stat)) return "royal_flush";
    if (_canMakeStraightFlush(stat)) return "straight_flush";
    if (_canMakeFourKind(stat)) return "four_kind";
    if (_canMakeFullHouse(stat)) return "full_house";
    if (_canMakeFlush(stat)) return "flush";
    if (_canMakeStraight(stat)) return "straight";
    if (_canMakeThreeKind(stat)) return "three_kind";
    if (_canMakeTwoPair(stat)) return "two_pair";
    if (_canMakePair(stat)) return "pair";
    return "high_card";
}

// Exported: list all attainable categories (IDs), even if a stronger one is also possible.
export function allAttainableCategories(cards) {
    const stat = _statFromCards(cards);
    const out = [];
    if (_canMakeRoyalFlush(stat)) out.push("royal_flush");
    if (_canMakeStraightFlush(stat)) out.push("straight_flush");
    if (_canMakeFourKind(stat)) out.push("four_kind");
    if (_canMakeFullHouse(stat)) out.push("full_house");
    if (_canMakeFlush(stat)) out.push("flush");
    if (_canMakeStraight(stat)) out.push("straight");
    if (_canMakeThreeKind(stat)) out.push("three_kind");
    if (_canMakeTwoPair(stat)) out.push("two_pair");
    if (_canMakePair(stat)) out.push("pair");
    out.push("high_card");
    return out;
}

// Exported: exactness check — passes only if the BEST achievable equals the target ID.
export function hitsExactly(cards, targetId) {
    if (typeof targetId !== "string") return false;
    const best = _bestCategoryWithWildsId(cards);
    return best === targetId;
}

// Convenience: can form a specific category (even if stronger exists)
export function canFormCategory(cards, targetId) {
    if (typeof targetId !== "string") return false;
    return allAttainableCategories(cards).includes(targetId);
}
