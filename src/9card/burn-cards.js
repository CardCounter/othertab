import { UNIQUE_TOKEN_SYMBOL } from "./config.js";

const UNIQUE_SYMBOL = UNIQUE_TOKEN_SYMBOL;
const SCIENTIFIC_NOTATION_THRESHOLD = 100_000_000;

const burnCardState = {
    total: 0,
    container: null,
    valueElement: null
};

const burnCardListeners = new Set();

function ensureInteger(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.ceil(Math.max(0, value));
}

function notifyBurnCardListeners() {
    burnCardListeners.forEach((listener) => {
        try {
            listener(burnCardState.total);
        } catch {
            // ignore listener failures so other subscribers are not impacted
        }
    });
}

function updateBurnCardDisplay() {
    if (!burnCardState.valueElement) {
        return;
    }
    const formatted = formatBurnCardAmount(burnCardState.total);
    burnCardState.valueElement.innerHTML = "";
    const wrapper = document.createElement("span");
    wrapper.className = "burn-card-text";
    wrapper.textContent = formatted;
    burnCardState.valueElement.append(wrapper);
    if (burnCardState.container) {
        const formattedNumber = formatBurnCardAmount(burnCardState.total, { includeSymbol: false });
        burnCardState.container.setAttribute("aria-label", `burn cards ${formattedNumber}`);
    }
}

export function initBurnCardDisplay() {
    const container = document.getElementById("burn-card-counter") ?? null;
    burnCardState.container = container;

    if (!container) {
        burnCardState.valueElement = null;
        return;
    }

    let valueElement =
        container.querySelector("[data-burn-card-value]") ??
        container.querySelector(".burn-card-counter-value");

    if (!valueElement && container instanceof HTMLElement) {
        if (container.dataset?.burnCardValue === "true" || container.dataset?.burnCardValue === "") {
            valueElement = container;
        }
    }

    if (valueElement) {
        burnCardState.valueElement = valueElement;
    } else {
        const span = document.createElement("span");
        span.className = "burn-card-counter-value";
        span.dataset.burnCardValue = "true";
        container.appendChild(span);
        burnCardState.valueElement = span;
    }

    updateBurnCardDisplay();
}

export function getBurnCardTotal() {
    return burnCardState.total;
}

export function subscribeToBurnCardChanges(listener) {
    if (typeof listener !== "function") {
        return () => {};
    }
    burnCardListeners.add(listener);
    return () => {
        burnCardListeners.delete(listener);
    };
}

export function canAffordBurnCards(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    return burnCardState.total >= cost;
}

export function spendBurnCards(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    if (burnCardState.total < cost) {
        return false;
    }
    burnCardState.total = ensureInteger(burnCardState.total - cost);
    updateBurnCardDisplay();
    notifyBurnCardListeners();
    return true;
}

export function awardBurnCards(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        return 0;
    }
    burnCardState.total = ensureInteger(burnCardState.total + amount);
    updateBurnCardDisplay();
    notifyBurnCardListeners();
    return amount;
}

export function formatBurnCardAmount(value, { includeSymbol = true } = {}) {
    const integerValue = ensureInteger(value);
    let formatted;
    if (integerValue >= SCIENTIFIC_NOTATION_THRESHOLD) {
        formatted = integerValue.toExponential(2).replace("e+", "e");
    } else {
        formatted = integerValue.toLocaleString();
    }
    return includeSymbol ? `${formatted}${UNIQUE_SYMBOL}` : formatted;
}
