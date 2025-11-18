import { HAND_LABELS } from "../config.js";
import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const THREE_KIND_FAMILY_FLAG = "familyThreeKindActive";
const FAMILY_VALUE_ORDER = [13, 12, 11];
const FAMILY_VALUE_SET = new Set(FAMILY_VALUE_ORDER);
const UPGRADE_BASE_IDS = new Set(["high_card", "pair", "two_pair"]);
const baseEvaluateHand = createStandardEvaluator();

function findFamilyIndices(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return null;
    }
    const foundIndices = new Map();
    for (let index = 0; index < cards.length; index += 1) {
        if (foundIndices.size >= FAMILY_VALUE_ORDER.length) {
            break;
        }
        const value = Number.isFinite(cards[index]?.value) ? cards[index].value : null;
        if (value == null || !FAMILY_VALUE_SET.has(value) || foundIndices.has(value)) {
            continue;
        }
        foundIndices.set(value, index);
    }
    if (foundIndices.size < FAMILY_VALUE_ORDER.length) {
        return null;
    }
    const highlightIndices = [];
    for (const value of FAMILY_VALUE_ORDER) {
        const index = foundIndices.get(value);
        if (index == null) {
            return null;
        }
        highlightIndices.push(index);
    }
    return highlightIndices;
}

function evaluateHand(cards, handSize, context) {
    const baseResult = baseEvaluateHand(cards, handSize, context);
    if (!baseResult) {
        return baseResult;
    }
    if (
        context?.state?.[THREE_KIND_FAMILY_FLAG] !== true ||
        !UPGRADE_BASE_IDS.has(baseResult.id)
    ) {
        return baseResult;
    }
    const highlightIndices = findFamilyIndices(cards);
    if (!highlightIndices) {
        return baseResult;
    }
    return {
        ...baseResult,
        id: "three_kind",
        label: HAND_LABELS.three_kind,
        highlightIndices
    };
}

registerDeckEvaluator("three_kind", evaluateHand);

export default evaluateHand;
