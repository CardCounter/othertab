import { HAND_LABELS, STREAK_TARGET } from "./config.js";
import { formatChipAmount } from "./chips.js";

const FOUR_CARD_STRAIGHT_FLAG = "straight_four_card_scoring";

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

export function createStandardEvaluator(options = {}) {
    const labels = resolveHandLabels(options);
    const detectStraight = typeof options.detectStraight === "function"
        ? options.detectStraight
        : detectStandardStraight;
    const rules = Array.isArray(options.rules) && options.rules.length > 0
        ? options.rules
        : DEFAULT_CLASSIFICATION_RULES;
    return (cards, handSize, context = {}) => {
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

export function buildResultMessage({ success, classification, streak, permanentlyCompleted, payout = 0 }) {
    if (success) {
        const formattedPayout = formatChipAmount(payout, { includeSymbol: false });
        if (permanentlyCompleted || streak >= STREAK_TARGET) {
            return `hit ${classification.label}, streak: ${streak}, payout: ${formattedPayout}⛁`;
        }
        return `hit ${classification.label} ${streak}/${STREAK_TARGET}, payout: ${formattedPayout}⛁`;
    }
    return `missed (${classification.label})`;
}
