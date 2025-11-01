import { createStandardEvaluator } from "../hand-evaluation.js";

const evaluatorRegistry = new Map();
const defaultEvaluator = createStandardEvaluator();

export function registerDeckEvaluator(deckId, evaluator) {
    if (!deckId || typeof evaluator !== "function") {
        return;
    }
    evaluatorRegistry.set(deckId, evaluator);
}

export function getDeckEvaluator(deckId) {
    if (deckId && evaluatorRegistry.has(deckId)) {
        return evaluatorRegistry.get(deckId);
    }
    return defaultEvaluator;
}

export function getDefaultDeckEvaluator() {
    return defaultEvaluator;
}

export function listRegisteredDeckEvaluators() {
    return Array.from(evaluatorRegistry.keys());
}
