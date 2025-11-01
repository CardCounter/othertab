import { HAND_LABELS, STREAK_TARGET } from "./config.js";
import { formatChipAmount } from "./chips.js";

export function isStraight(values, handSize, context = {}) {
    return detectStandardStraight(values, handSize, context);
}

export function detectStandardStraight(values, handSize, context = {}) {
    const count = Number.isFinite(handSize) ? Math.floor(handSize) : values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const unique = [...new Set(sorted)];
    if (unique.length !== count) {
        return { straight: false, high: null };
    }
    const first = unique[0];
    const expected = Array.from({ length: count }, (_, index) => first + index);
    const matches = expected.every((value, index) => value === unique[index]);
    if (matches) {
        return { straight: true, high: unique[unique.length - 1] };
    }
    if (count === 5) {
        const wheel = [2, 3, 4, 5, 14];
        const isWheel = wheel.every((value, index) => unique[index] === value);
        if (isWheel) {
            return { straight: true, high: 5 };
        }
    }
    return { straight: false, high: null };
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
        uniqueValues
    };
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
        return result;
    }
    return {
        id: "high_card",
        label: labels.high_card ?? HAND_LABELS.high_card
    };
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

export function getHighlightIndices(cards, classificationId, handSize) {
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
