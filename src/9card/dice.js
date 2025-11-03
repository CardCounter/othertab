import { DICE_SYMBOL } from "./config.js";

const diceState = {
    total: 0,
    container: null,
    valueElement: null
};

const diceListeners = new Set();

const SCIENTIFIC_NOTATION_THRESHOLD = 100_000_000;

function notifyDiceListeners() {
    diceListeners.forEach((listener) => {
        try {
            listener(diceState.total);
        } catch {
            // ignore listener errors so others still receive updates
        }
    });
}

export function initDiceDisplay() {
    const container = document.getElementById("dice-counter") ?? null;
    diceState.container = container;

    if (!container) {
        diceState.valueElement = null;
        return;
    }

    let valueElement =
        container.querySelector("[data-dice-value]") ??
        container.querySelector(".dice-counter-value");

    if (!valueElement && container instanceof HTMLElement) {
        if (container.dataset?.diceValue === "true" || container.dataset?.diceValue === "") {
            valueElement = container;
        }
    }

    if (valueElement) {
        diceState.valueElement = valueElement;
    } else {
        const span = document.createElement("span");
        span.className = "dice-counter-value";
        span.dataset.diceValue = "true";
        container.appendChild(span);
        diceState.valueElement = span;
    }

    updateDiceDisplay();
}

export function getDiceTotal() {
    return diceState.total;
}

export function subscribeToDiceChanges(listener) {
    if (typeof listener !== "function") {
        return () => {};
    }
    diceListeners.add(listener);
    return () => {
        diceListeners.delete(listener);
    };
}

export function canAffordDice(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    return diceState.total >= cost;
}

export function spendDice(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    if (diceState.total < cost) {
        return false;
    }
    diceState.total = ensureInteger(diceState.total - cost);
    updateDiceDisplay();
    notifyDiceListeners();
    return true;
}

export function awardDice(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        return 0;
    }
    diceState.total = ensureInteger(diceState.total + amount);
    updateDiceDisplay();
    notifyDiceListeners();
    return amount;
}

export function formatDiceAmount(value) {
    const integerValue = ensureInteger(value);
    let formatted;
    if (integerValue >= SCIENTIFIC_NOTATION_THRESHOLD) {
        formatted = integerValue.toExponential(2).replace("e+", "e");
    } else {
        formatted = integerValue.toLocaleString();
    }
    return `${formatted}${DICE_SYMBOL}`;
}

function updateDiceDisplay() {
    if (!diceState.valueElement) {
        return;
    }
    const formatted = formatDiceAmount(diceState.total);
    diceState.valueElement.innerHTML = "";
    const wrapper = document.createElement("span");
    wrapper.className = "dice-text";
    wrapper.textContent = formatted;
    diceState.valueElement.append(wrapper);
    if (diceState.container) {
        diceState.container.setAttribute("aria-label", `dice ${formatted}`);
    }
}

function ensureInteger(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.ceil(Math.max(0, value));
}
