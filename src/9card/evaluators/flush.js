import { HAND_LABELS } from "../config.js";
import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const ALL_RED_FLAG = "flushAllRedActive";
const ALL_BLACK_FLAG = "flushAllBlackActive";
const RED_SUITS = new Set(["♥", "♦"]);
const BLACK_SUITS = new Set(["♠", "♣"]);
const baseEvaluateHand = createStandardEvaluator();

function suitsMatchAllowed(cards, allowedSuitSet) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return false;
    }
    return cards.every((card) => allowedSuitSet.has(card?.suit));
}

function highlightAllCards(cards) {
    if (!Array.isArray(cards)) {
        return [];
    }
    return cards.map((_, index) => index);
}

function evaluateHand(cards, handSize, context) {
    const baseResult = baseEvaluateHand(cards, handSize, context);
    if (!baseResult) {
        return baseResult;
    }
    const allowAllRed = context?.state?.[ALL_RED_FLAG] === true;
    const allowAllBlack = context?.state?.[ALL_BLACK_FLAG] === true;
    if (!allowAllRed && !allowAllBlack) {
        return baseResult;
    }
    const isRedFlush = allowAllRed && suitsMatchAllowed(cards, RED_SUITS);
    const isBlackFlush = allowAllBlack && suitsMatchAllowed(cards, BLACK_SUITS);
    if (!isRedFlush && !isBlackFlush) {
        return baseResult;
    }
    if (baseResult.id === "flush") {
        return baseResult;
    }
    return {
        ...baseResult,
        id: "flush",
        label: HAND_LABELS.flush,
        highlightIndices: highlightAllCards(cards)
    };
}

registerDeckEvaluator("flush", evaluateHand);

export default evaluateHand;
