import { HAND_LABELS } from "../config.js";
import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const ROYAL_PAIR_FLAG = "royalPairCardsCountAsPair";
const ROYAL_VALUES = new Set([11, 12, 13, 14]);
const baseEvaluateHand = createStandardEvaluator();

function findRoyalPairIndices(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return null;
    }
    const indices = [];
    for (let index = 0; index < cards.length; index += 1) {
        const value = Number.isFinite(cards[index]?.value) ? cards[index].value : null;
        if (value != null && ROYAL_VALUES.has(value)) {
            indices.push(index);
            if (indices.length >= 2) {
                break;
            }
        }
    }
    if (indices.length < 2) {
        return null;
    }
    return indices.slice(0, 2);
}

function evaluateHand(cards, handSize, context) {
    const baseResult = baseEvaluateHand(cards, handSize, context);
    if (!baseResult) {
        return baseResult;
    }
    const allowRoyalPair = context?.state?.[ROYAL_PAIR_FLAG] === true;
    if (!allowRoyalPair || baseResult.id !== "high_card") {
        return baseResult;
    }
    const highlightIndices = findRoyalPairIndices(cards);
    if (!highlightIndices) {
        return baseResult;
    }
    return {
        ...baseResult,
        id: "pair",
        label: HAND_LABELS.pair,
        highlightIndices
    };
}

registerDeckEvaluator("pair", evaluateHand);

export default evaluateHand;
