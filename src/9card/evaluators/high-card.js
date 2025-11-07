import { createStandardEvaluator, analyzeHand, allAttainableCategories, detectStandardStraight } from "../hand-evaluation.js";
import { HAND_LABELS } from "../config.js";
import { registerDeckEvaluator } from "./registry.js";

// custom evaluator that prioritizes high_card when wilds are present
function createHighCardEvaluator() {
    const standardEvaluator = createStandardEvaluator();
    
    return (cards, handSize, context = {}) => {
        if (!Array.isArray(cards) || cards.length === 0) {
            return standardEvaluator(cards, handSize, context);
        }
        
        // count wilds and non-wild cards
        const wildCards = cards.filter((card) => card?.isWild === true);
        const nonWildCards = cards.filter((card) => card && card?.isWild !== true);
        const wildCount = wildCards.length;
        
        // if no wilds, use standard evaluator
        if (wildCount === 0) {
            return standardEvaluator(cards, handSize, context);
        }
        
        // check if high_card is attainable (it always is with wilds, but check anyway)
        const attainableCategories = allAttainableCategories(cards);
        const highCardIsAttainable = attainableCategories.includes("high_card");
        
        if (!highCardIsAttainable) {
            return standardEvaluator(cards, handSize, context);
        }
        
        // hacky solution: if we have wilds and high_card is attainable, force high_card
        // by assigning wilds to values that don't create pairs
        
        // get existing card values
        const existingValues = new Set(nonWildCards.map((card) => card.value).filter((v) => Number.isFinite(v)));
        
        // assign wilds to values that don't match existing cards
        // start from 2 and go up, skipping values that already exist
        const assignedValues = [];
        let nextValue = 2;
        for (let i = 0; i < wildCount; i += 1) {
            while (existingValues.has(nextValue) && nextValue <= 14) {
                nextValue += 1;
            }
            if (nextValue <= 14) {
                assignedValues.push(nextValue);
                existingValues.add(nextValue);
                nextValue += 1;
            } else {
                // if we run out of values, just use 2 (shouldnt happen with normal deck)
                assignedValues.push(2);
            }
        }
        
        // create resolved cards with wilds assigned to non-matching values
        let assignmentIndex = 0;
        const resolvedCards = cards.map((card) => {
            if (card?.isWild === true) {
                const assignedValue = assignedValues[assignmentIndex] ?? 2;
                assignmentIndex += 1;
                return {
                    ...card,
                    value: assignedValue,
                    rank: card.rank || String(assignedValue),
                    wildAssigned: true
                };
            }
            return card;
        });
        
        // analyze the resolved hand to get values for highlighting
        const analysis = analyzeHand(resolvedCards, handSize, {
            detectStraight: detectStandardStraight,
            context
        });
        
        // create high_card classification directly
        const values = Array.isArray(analysis.values) ? analysis.values : [];
        const maxValue = values.length > 0 ? Math.max(...values) : null;
        
        // find indices of cards with the highest value
        const highlightIndices = [];
        if (Number.isFinite(maxValue)) {
            resolvedCards.forEach((card, index) => {
                if (Number.isFinite(card?.value) && card.value === maxValue) {
                    highlightIndices.push(index);
                }
            });
        }
        
        return {
            id: "high_card",
            label: HAND_LABELS.high_card ?? "high card",
            highlightIndices
        };
    };
}

const evaluateHand = createHighCardEvaluator();

registerDeckEvaluator("high_card", evaluateHand);

export default evaluateHand;
