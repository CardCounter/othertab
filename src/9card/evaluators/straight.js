import { detectStandardStraight, createStandardEvaluator } from "../hand-evaluation.js";
import { registerDeckEvaluator } from "./registry.js";

const SHORT_STACK_FLAG = "straight_four_card_scoring";

function hasShortStackFlag(context) {
    if (!context) {
        return false;
    }
    if (context.state?.straightFourCardActive === true) {
        return true;
    }
    const flags = context.flags;
    if (flags instanceof Set && flags.has(SHORT_STACK_FLAG)) {
        return true;
    }
    if (Array.isArray(flags) && flags.includes(SHORT_STACK_FLAG)) {
        return true;
    }
    const flagList = context.flagList;
    if (Array.isArray(flagList) && flagList.includes(SHORT_STACK_FLAG)) {
        return true;
    }
    return false;
}

function findFourCardStraightRun(values) {
    if (!Array.isArray(values) || values.length < 4) {
        return null;
    }
    const unique = [...new Set(values)].sort((a, b) => a - b);
    const valueSet = new Set(unique);
    let best = null;

    unique.forEach((start) => {
        const sequence = [start, start + 1, start + 2, start + 3];
        const isRun = sequence.every((value) => valueSet.has(value));
        if (!isRun) {
            return;
        }
        const high = sequence[sequence.length - 1];
        if (!best || high > best.high) {
            best = { sequenceValues: sequence, high };
        }
    });

    const wheelSequence = [14, 2, 3, 4];
    const hasWheel = wheelSequence.every((value) => valueSet.has(value));
    if (hasWheel) {
        const wheel = { sequenceValues: wheelSequence, high: 4 };
        if (!best || wheel.high > best.high) {
            best = wheel;
        }
    }

    return best;
}

function detectStraightWithShortStack(values, handSize, context = {}) {
    const standard = detectStandardStraight(values, handSize, context);
    if (standard.straight) {
        return standard;
    }
    if (!hasShortStackFlag(context)) {
        return standard;
    }
    const run = findFourCardStraightRun(values);
    if (!run) {
        return standard;
    }
    return {
        straight: true,
        high: run.high,
        length: run.sequenceValues.length,
        sequenceValues: run.sequenceValues
    };
}

const evaluateHand = createStandardEvaluator({
    detectStraight: detectStraightWithShortStack
});

registerDeckEvaluator("straight", evaluateHand);

export default evaluateHand;
