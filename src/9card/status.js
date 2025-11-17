import { STATUS_SYMBOL } from "./config.js";

const statusState = {
    total: 0,
    container: null,
    valueElement: null
};

const statusListeners = new Set();

const SCIENTIFIC_NOTATION_THRESHOLD = 100_000_000;

function ensureInteger(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.ceil(Math.max(0, value));
}

function notifyStatusListeners() {
    statusListeners.forEach((listener) => {
        try {
            listener(statusState.total);
        } catch {
            // ignore listener failures so remaining subscribers still fire
        }
    });
}

function updateStatusDisplay() {
    if (!statusState.valueElement) {
        return;
    }
    const formatted = formatStatusAmount(statusState.total);
    statusState.valueElement.textContent = formatted;
    if (statusState.container) {
        const formattedNumber = formatStatusAmount(statusState.total, { includeSymbol: false });
        statusState.container.setAttribute("aria-label", `status ${formattedNumber}`);
    }
}

export function initStatusDisplay() {
    const container = document.getElementById("status-counter") ?? null;
    statusState.container = container;

    if (!container) {
        statusState.valueElement = null;
        return;
    }

    let valueElement =
        container.querySelector("[data-status-value]") ??
        container.querySelector(".status-counter-value");

    if (!valueElement && container instanceof HTMLElement) {
        if (container.dataset?.statusValue === "true" || container.dataset?.statusValue === "") {
            valueElement = container;
        }
    }

    if (valueElement) {
        statusState.valueElement = valueElement;
    } else {
        const span = document.createElement("span");
        span.className = "status-counter-value";
        span.dataset.statusValue = "true";
        container.appendChild(span);
        statusState.valueElement = span;
    }

    updateStatusDisplay();
}

export function getStatusTotal() {
    return statusState.total;
}

export function subscribeToStatusChanges(listener) {
    if (typeof listener !== "function") {
        return () => {};
    }
    statusListeners.add(listener);
    return () => {
        statusListeners.delete(listener);
    };
}

export function canAffordStatus(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    return statusState.total >= cost;
}

export function spendStatus(amount) {
    if (!Number.isFinite(amount)) {
        return false;
    }
    if (amount <= 0) {
        return true;
    }
    const cost = Math.ceil(Math.max(0, amount));
    if (statusState.total < cost) {
        return false;
    }
    statusState.total = ensureInteger(statusState.total - cost);
    updateStatusDisplay();
    notifyStatusListeners();
    return true;
}

export function awardStatus(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        return 0;
    }
    statusState.total = ensureInteger(statusState.total + amount);
    updateStatusDisplay();
    notifyStatusListeners();
    return amount;
}

export function formatStatusAmount(value, { includeSymbol = true } = {}) {
    const integerValue = ensureInteger(value);
    let formatted;
    if (integerValue >= SCIENTIFIC_NOTATION_THRESHOLD) {
        formatted = integerValue.toExponential(2).replace("e+", "e");
    } else {
        formatted = integerValue.toLocaleString();
    }
    return includeSymbol ? `${formatted}${STATUS_SYMBOL}` : formatted;
}
