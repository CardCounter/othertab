import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const evaluateHand = createStandardEvaluator();

registerDeckEvaluator("full_house", evaluateHand);

export default evaluateHand;
