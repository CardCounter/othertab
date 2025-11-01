import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const evaluateHand = createStandardEvaluator();

registerDeckEvaluator("straight_flush", evaluateHand);

export default evaluateHand;
