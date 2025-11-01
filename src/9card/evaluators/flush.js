import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const evaluateHand = createStandardEvaluator();

registerDeckEvaluator("flush", evaluateHand);

export default evaluateHand;
