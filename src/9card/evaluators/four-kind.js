import { createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const evaluateHand = createStandardEvaluator();

registerDeckEvaluator("four_kind", evaluateHand);

export default evaluateHand;
