import { formatNumber } from "./helpers.js";

const creditListeners = new Set();

const creditState = {
    total: 1000000
};

const dom = {
    total: document.getElementById("credits-total")
};

function notifyCredits() {
    creditListeners.forEach((listener) => {
        try {
            listener(creditState.total);
        } catch {
            // ignore listener errors
        }
    });
}

function updateCreditsDisplay() {
    if (!dom.total) {
        return;
    }
    dom.total.textContent = formatNumber(creditState.total);
}

function setCredits(value) {
    creditState.total = value;
    updateCreditsDisplay();
    notifyCredits();
}

function addCredits(amount) {
    setCredits(creditState.total + amount);
    return creditState.total;
}

function canAfford(cost) {
    return creditState.total >= cost;
}

function spendCredits(cost) {
    if (!canAfford(cost)) {
        return false;
    }
    setCredits(creditState.total - cost);
    return true;
}

function subscribeToCredits(listener) {
    if (typeof listener !== "function") {
        return () => {};
    }
    creditListeners.add(listener);
    return () => creditListeners.delete(listener);
}

export function initializeCredits() {
    updateCreditsDisplay();
}

export const credits = {
    get() {
        return creditState.total;
    },
    add: addCredits,
    canAfford,
    spend: spendCredits,
    subscribe: subscribeToCredits,
    set: setCredits
};

