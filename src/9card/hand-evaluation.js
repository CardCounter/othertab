import { HAND_LABELS, HAND_SIZE, STREAK_TARGET } from "./config.js";
import { formatChipAmount } from "./chips.js";

export function isStraight(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const unique = [...new Set(sorted)];
    if (unique.length !== HAND_SIZE) {
        return { straight: false, high: null };
    }
    const first = unique[0];
    const expected = Array.from({ length: HAND_SIZE }, (_, index) => first + index);
    const matches = expected.every((value, index) => value === unique[index]);
    if (matches) {
        return { straight: true, high: unique[unique.length - 1] };
    }
    const wheel = [2, 3, 4, 5, 14];
    const isWheel = wheel.every((value, index) => unique[index] === value);
    if (isWheel) {
        return { straight: true, high: 5 };
    }
    return { straight: false, high: null };
}

export function classifyHand(cards) {
    const suits = cards.map((card) => card.suit);
    const values = cards.map((card) => card.value);
    const flush = suits.every((suit) => suit === suits[0]);
    const { straight, high } = isStraight(values);

    const counts = new Map();
    values.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    const countValues = Array.from(counts.values()).sort((a, b) => b - a);

    if (straight && flush) {
        if (high === 14) {
            return { id: "royal_flush", label: HAND_LABELS.royal_flush };
        }
        return { id: "straight_flush", label: HAND_LABELS.straight_flush };
    }

    if (countValues[0] === 4) {
        return { id: "four_kind", label: HAND_LABELS.four_kind };
    }

    if (countValues[0] === 3 && countValues[1] === 2) {
        return { id: "full_house", label: HAND_LABELS.full_house };
    }

    if (flush) {
        return { id: "flush", label: HAND_LABELS.flush };
    }

    if (straight) {
        return { id: "straight", label: HAND_LABELS.straight };
    }

    if (countValues[0] === 3) {
        return { id: "three_kind", label: HAND_LABELS.three_kind };
    }

    if (countValues[0] === 2) {
        const pairCount = countValues.filter((count) => count === 2).length;
        if (pairCount === 2) {
            return { id: "two_pair", label: HAND_LABELS.two_pair };
        }
        return { id: "pair", label: HAND_LABELS.pair };
    }

    return { id: "high_card", label: HAND_LABELS.high_card };
}

export function getHighlightIndices(cards, classificationId) {
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
            return Array.from({ length: HAND_SIZE }, (_, index) => index);
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
