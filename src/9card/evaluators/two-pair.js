import { HAND_LABELS } from "../config.js";
import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const CLOSE_ENOUGH_STATE_FLAG = "closeEnoughPairAceActive";
const ACE_VALUE = 14;
const baseEvaluateHand = createStandardEvaluator();

function findAceIndex(cards, excludeIndices) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return null;
    }
    const excluded = new Set(Array.isArray(excludeIndices) ? excludeIndices : []);
    for (let index = 0; index < cards.length; index += 1) {
        if (excluded.has(index)) {
            continue;
        }
        if (Number.isFinite(cards[index]?.value) && cards[index].value === ACE_VALUE) {
            return index;
        }
    }
    return null;
}

function shouldUpgradeHand(context, baseResult, highlightIndices) {
    if (!baseResult || baseResult.id !== "pair") {
        return false;
    }
    if (context?.state?.[CLOSE_ENOUGH_STATE_FLAG] !== true) {
        return false;
    }
    if (!Array.isArray(highlightIndices) || highlightIndices.length < 2) {
        return false;
    }
    return true;
}

function evaluateHand(cards, handSize, context) {
    const baseResult = baseEvaluateHand(cards, handSize, context);
    if (!baseResult) {
        return baseResult;
    }
    const existingHighlights = Array.isArray(baseResult.highlightIndices)
        ? [...baseResult.highlightIndices]
        : [];
    if (!shouldUpgradeHand(context, baseResult, existingHighlights)) {
        return baseResult;
    }
    const aceIndex = findAceIndex(cards, existingHighlights);
    if (aceIndex == null) {
        return baseResult;
    }
    const highlightSet = new Set(existingHighlights);
    highlightSet.add(aceIndex);
    const highlightIndices = Array.from(highlightSet);
    return {
        ...baseResult,
        id: "two_pair",
        label: HAND_LABELS.two_pair,
        highlightIndices
    };
}

registerDeckEvaluator("two_pair", evaluateHand);

export default evaluateHand;
