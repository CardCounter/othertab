import {
    CHIP_SYMBOL,
    DEFAULT_BASE_CHIP_PAYOUT,
    DEFAULT_STREAK_CHIP_MULTIPLIER
} from "./config.js";

const chipState = {
    total: 0,
    basePayout: DEFAULT_BASE_CHIP_PAYOUT,
    streakMultiplier: DEFAULT_STREAK_CHIP_MULTIPLIER,
    container: null,
    valueElement: null
};

const chipListeners = new Set();

const SCIENTIFIC_NOTATION_THRESHOLD = 100_000_000;

function notifyChipListeners() {
    chipListeners.forEach((listener) => {
        try {
            listener(chipState.total);
        } catch {
            // ignore listener errors to avoid disrupting other subscribers
        }
    });
}

export function initChipDisplay(options = {}) {
    if (Number.isFinite(options.basePayout) && options.basePayout >= 0) {
        chipState.basePayout = options.basePayout;
    }
    if (Number.isFinite(options.streakMultiplier) && options.streakMultiplier > 0) {
        chipState.streakMultiplier = options.streakMultiplier;
    }

    const container = document.getElementById("chip-counter") ?? null;
    chipState.container = container;

    if (!container) {
        chipState.valueElement = null;
        return;
    }

    const valueElement =
        container.querySelector("[data-chip-value]") ??
        container.querySelector(".chip-counter-value");

    if (valueElement) {
        chipState.valueElement = valueElement;
    } else {
        const span = document.createElement("span");
        span.className = "chip-counter-value";
        span.dataset.chipValue = "true";
        container.appendChild(span);
        chipState.valueElement = span;
    }

    updateChipDisplay();
}

export function getChipTotal() {
    return chipState.total;
}

export function subscribeToChipChanges(listener) {
    if (typeof listener !== "function") {
        return () => {};
    }
    chipListeners.add(listener);
    return () => {
        chipListeners.delete(listener);
    };
}

export function canAffordChips(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    return chipState.total >= cost;
}

export function spendChips(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    if (chipState.total < cost) {
        return false;
    }
    chipState.total = ensureInteger(chipState.total - cost);
    updateChipDisplay();
    notifyChipListeners();
    return true;
}

export function setBaseChipPayout(value) {
    if (!Number.isFinite(value) || value < 0) {
        return;
    }
    chipState.basePayout = value;
}

export function setStreakChipMultiplier(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return;
    }
    chipState.streakMultiplier = value;
}

export function getChipSettings() {
    return {
        basePayout: chipState.basePayout,
        streakMultiplier: chipState.streakMultiplier
    };
}

export function calculateChipReward({
    baseAmount,
    streak,
    streakMultiplier
} = {}) {
    const streakCount = Number.isFinite(streak) ? Math.max(0, streak) : 0;
    if (streakCount <= 0) {
        return 0;
    }

    const base = resolveBaseAmount(baseAmount);
    const multiplierBase = resolveStreakMultiplier(streakMultiplier);
    const multiplier = streakCount > 1 ? Math.pow(multiplierBase, streakCount - 1) : 1;
    const rawReward = base * multiplier;
    return Math.ceil(Math.max(0, rawReward));
}

export function awardChips(options = {}) {
    const reward = calculateChipReward(options);
    if (reward <= 0) {
        return 0;
    }

    chipState.total = ensureInteger(chipState.total + reward);
    updateChipDisplay();
    notifyChipListeners();
    return reward;
}

function resolveBaseAmount(baseAmount) {
    if (Number.isFinite(baseAmount) && baseAmount >= 0) {
        return baseAmount;
    }
    if (Number.isFinite(chipState.basePayout) && chipState.basePayout >= 0) {
        return chipState.basePayout;
    }
    return DEFAULT_BASE_CHIP_PAYOUT;
}

function resolveStreakMultiplier(streakMultiplier) {
    if (Number.isFinite(streakMultiplier) && streakMultiplier > 0) {
        return streakMultiplier;
    }
    if (
        Number.isFinite(chipState.streakMultiplier) &&
        chipState.streakMultiplier > 0
    ) {
        return chipState.streakMultiplier;
    }
    return DEFAULT_STREAK_CHIP_MULTIPLIER;
}

function updateChipDisplay() {
    if (!chipState.valueElement) {
        return;
    }
    const formattedWithSymbol = formatChipAmount(chipState.total, { includeSymbol: true });
    chipState.valueElement.textContent = formattedWithSymbol;
    if (chipState.container) {
        const formattedNumber = formatChipAmount(chipState.total, { includeSymbol: false });
        chipState.container.setAttribute("aria-label", `chips ${formattedNumber}`);
    }
}

export function formatChipAmount(value, { includeSymbol = true } = {}) {
    const integerValue = ensureInteger(value);
    let formatted;
    if (integerValue >= SCIENTIFIC_NOTATION_THRESHOLD) {
        formatted = integerValue.toExponential(2).replace("e+", "e");
    } else {
        formatted = integerValue.toLocaleString();
    }
    return includeSymbol ? `${formatted}${CHIP_SYMBOL}` : formatted;
}

function ensureInteger(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.ceil(Math.max(0, value));
}
