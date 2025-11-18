import { HAND_LABELS } from "../config.js";
import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const ROOMMATES_FLAG = "roommatesFullHouseActive";
const ROOMMATES_ID = "roommates";
const ACE_VALUE = 14;

const baseEvaluateHand = createStandardEvaluator();

function hasRoommatesUpgrade(context) {
    if (!context) {
        return false;
    }
    if (context.state?.[ROOMMATES_FLAG] === true) {
        return true;
    }
    const flags = context.flags;
    if (flags instanceof Set) {
        if (flags.has(ROOMMATES_FLAG) || flags.has(ROOMMATES_ID)) {
            return true;
        }
    } else if (Array.isArray(flags)) {
        if (flags.includes(ROOMMATES_FLAG) || flags.includes(ROOMMATES_ID)) {
            return true;
        }
    }
    const flagList = context.flagList;
    if (Array.isArray(flagList) && (flagList.includes(ROOMMATES_FLAG) || flagList.includes(ROOMMATES_ID))) {
        return true;
    }
    return false;
}

function matchesRoommatesFullHouseHand(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return false;
    }
    const counts = new Map();
    cards.forEach((card) => {
        if (!card) {
            return;
        }
        const value = card.value;
        if (!Number.isFinite(value)) {
            return;
        }
        counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    if (counts.size !== 3) {
        return false;
    }
    const aceCount = counts.get(ACE_VALUE) ?? 0;
    if (aceCount !== 1) {
        return false;
    }
    const pairCount = [...counts.values()].filter((count) => count === 2).length;
    return pairCount === 2;
}

function highlightAllCards(cards) {
    if (!Array.isArray(cards)) {
        return [];
    }
    return cards.map((_, index) => index);
}

function evaluateHand(cards, handSize, context) {
    const baseResult = baseEvaluateHand(cards, handSize, context);
    if (
        !baseResult ||
        baseResult.id !== "two_pair" ||
        !hasRoommatesUpgrade(context) ||
        !matchesRoommatesFullHouseHand(cards)
    ) {
        return baseResult;
    }
    return {
        ...baseResult,
        id: "full_house",
        label: HAND_LABELS.full_house,
        highlightIndices: highlightAllCards(cards)
    };
}

registerDeckEvaluator("full_house", evaluateHand);

export default evaluateHand;
