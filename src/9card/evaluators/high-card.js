import { HAND_LABELS } from "../config.js";
import { createStandardEvaluator, getHighlightIndices } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const FORCE_HIGH_CARD_SUIT = "hcplus";
const FORCE_HIGH_CARD_LABEL = "hc+";
const FORCE_HIGH_CARD_RANK = "hc";
const FORCE_HIGH_CARD_SUIT_SYMBOL = "+";

const baseEvaluateHand = createStandardEvaluator();

function hasForceHighCard(cards) {
    if (!Array.isArray(cards)) {
        return false;
    }
    return cards.some((card) => {
        if (!card) {
            return false;
        }
        const suitName = typeof card.suitName === "string" ? card.suitName.toLowerCase() : "";
        const label = typeof card.label === "string" ? card.label.toLowerCase() : "";
        const rank = typeof card.rank === "string" ? card.rank.toLowerCase() : "";
        const suitSymbol = typeof card.suit === "string" ? card.suit : "";
        return (
            suitName === FORCE_HIGH_CARD_SUIT ||
            label === FORCE_HIGH_CARD_LABEL ||
            rank === FORCE_HIGH_CARD_RANK ||
            suitSymbol === FORCE_HIGH_CARD_SUIT_SYMBOL
        );
    });
}

function evaluateHand(cards, handSize, context) {
    const result = baseEvaluateHand(cards, handSize, context);
    if (!hasForceHighCard(cards)) {
        return result;
    }
    if (result?.id === "high_card") {
        return result;
    }
    const highlightIndices = getHighlightIndices({ id: "high_card" }, cards, handSize);
    return {
        ...result,
        id: "high_card",
        label: HAND_LABELS.high_card,
        highlightIndices
    };
}

registerDeckEvaluator("high_card", evaluateHand);

export default evaluateHand;
