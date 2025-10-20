
// dont need total plays, total wins, change rest of code accordingly
function createProbState() {
    return {
        credits: 0,
        totalPlays: 0,
        totalWins: 0,
        streak: 0,
        bestStreak: 0,
        probabilityLevel: 0,
        payoutLevel: 0,
        autoLevel: 0,
        history: [],
        lastResultSymbol: "–"
    };
}


function clamp(value, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
    return Math.min(Math.max(value, min), max);
}

function toLabel(value) {
    if (!value) {
        return null;
    }
    const label = value.replace(/[-_]+/g, " ").trim().toLowerCase();
    return label.length > 0 ? label : null;
}

function createProbabilityCalculator(config = {}) {
    const { type = "static", cap = 0.999, base = 0.5 } = config;
    const clampedCap = clamp(cap, { min: 0, max: 0.999999 });

    if (type === "exponential") {
        const decay = config.decay ?? 0.9;
        const start = clamp(config.base ?? base, { min: 0, max: clampedCap });
        return (level) => {
            const probability = 1 - (1 - start) * Math.pow(decay, level);
            return clamp(probability, { min: 0, max: clampedCap });
        };
    }

    if (type === "linear") {
        const step = config.step ?? 0.01;
        const start = clamp(config.base ?? base, { min: 0, max: clampedCap });
        return (level) => clamp(start + step * level, { min: 0, max: clampedCap });
    }

    const value = clamp(config.value ?? base, { min: 0, max: clampedCap });
    return () => value;
}

function createPayoutCalculator(config = {}) {
    const { type = "linear", base = 1 } = config;

    if (type === "exponential") {
        const growth = config.growth ?? 1;
        const start = config.base ?? base;
        return (level) => clamp(start * Math.pow(growth, level), { min: 0 });
    }

    if (type === "static") {
        const value = config.value ?? base;
        return () => clamp(value, { min: 0 });
    }

    const step = config.step ?? 0;
    const start = config.base ?? base;
    return (level) => clamp(start + step * level, { min: 0 });
}

function createAutoCalculator(config = {}) {
    if (!config || !config.type) {
        return () => null;
    }

    if (config.type === "exponential-decay") {
        const base = config.base ?? 5000;
        const decay = config.decay ?? 0.65;
        const min = config.min ?? 250;
        return (level) => {
            if (level === 0) {
                return null;
            }
            const interval = base * Math.pow(decay, level - 1);
            return clamp(interval, { min });
        };
    }

    if (config.type === "linear-decay") {
        const base = config.base ?? 5000;
        const step = config.step ?? 250;
        const min = config.min ?? 250;
        return (level) => {
            if (level === 0) {
                return null;
            }
            const interval = base - step * (level - 1);
            return clamp(interval, { min });
        };
    }

    return () => null;
}

// used in widgit description
function createWinCondition(config = {}, context = {}) {
    const type = config.type ?? "streak";

    if (type === "streak") {
        const goal = config.goal ?? 10;
        const title =
            config.title ??
            config.name ??
            toLabel(config.id) ??
            context.name ??
            "streak target";
        const description =
            config.description ??
            config.summary ??
            `hold a streak of ${goal}.`;
        return {
            id: config.id ?? `streak-${goal}`,
            title,
            description,
            goal,
            getProgress: config.getProgress ?? ((stateRef) => stateRef.streak),
            getBest: config.getBest ?? ((stateRef) => stateRef.bestStreak),
            isComplete: config.isComplete ?? ((stateRef) => stateRef.bestStreak >= goal)
        };
    }

    if (config.custom) {
        return config.custom;
    }

    const fallbackTitle =
        config.title ??
        config.name ??
        toLabel(config.id) ??
        context.name ??
        "goal";
    const fallbackDescription =
        config.description ??
        config.summary ??
        context.description ??
        "complete the listed objective.";

    return {
        id: config.id ?? "undefined-goal",
        title: fallbackTitle,
        description: fallbackDescription,
        goal: config.goal ?? 0,
        getProgress: config.getProgress ?? (() => 0),
        getBest: config.getBest ?? (() => 0),
        isComplete: config.isComplete ?? (() => false)
    };
}

function createProbObject(options) {
    const {
        id,
        name,
        baseProbability,
        payoutScaling,
        speedScaling,
        upgrades = {},
        winCondition = {},
        actionLabel = "flip",
        resultSymbols = { success: "✓", failure: "×" }
    } = options;

    const probabilityFn = createProbabilityCalculator(probabilityScaling);
    const payoutFn = createPayoutCalculator(payoutScaling);
    const autoFn = createAutoCalculator(autoScaling);
    const widget = createWinCondition(winCondition, { name });
    const normalizedResultSymbols = {
        success: resultSymbols.success ?? "✓",
        failure: resultSymbols.failure ?? "×"
    };

    const normalizedUpgrades = {};
    Object.entries(upgrades).forEach(([key, spec]) => {
        const scope = spec.scope ?? "specific";
        normalizedUpgrades[key] = {
            ...spec,
            scope,
            title: spec.title ?? toLabel(key) ?? key,
            description: spec.description ?? "",
            action: spec.action ?? "upgrade",
            maxLevel: spec.maxLevel ?? Number.POSITIVE_INFINITY
        };
    });

    function computeUpgradeCost(spec, level) {
        if (!spec) {
            return Infinity;
        }
        const maxLevel = spec.maxLevel ?? Number.POSITIVE_INFINITY;
        if (level >= maxLevel) {
            return Infinity;
        }
        const baseCost = spec.baseCost ?? 0;
        if (spec.costScaling?.type === "linear") {
            const step = spec.costScaling.step ?? spec.step ?? baseCost;
            const cost = baseCost + step * level;
            return Math.max(1, Math.ceil(cost));
        }

        const growth = spec.costScaling?.growth ?? spec.growth ?? 1;
        const cost = baseCost * Math.pow(growth, level);
        return Math.max(1, Math.ceil(cost));
    }

    return {
        id,
        name,
        widget,
        actionLabel,
        resultSymbols: normalizedResultSymbols,
        upgrades: normalizedUpgrades,
        getProbability: (level) => probabilityFn(level),
        getPayout: (level) => payoutFn(level),
        getAutoInterval: (level) => autoFn(level),
        getUpgradeCost: (type, stateRef) => {
            const spec = normalizedUpgrades[type];
            if (!spec) {
                return Infinity;
            }
            const level = stateRef?.[spec.levelKey] ?? 0;
            return computeUpgradeCost(spec, level);
        }
    };
}

// function createProbObject(options) {
//     const {
//         id,
//         name,
//         probabilityScaling,
//         payoutScaling,
//         autoScaling,
//         upgrades = {},
//         winCondition = {},
//         actionLabel = "flip",
//         resultSymbols = { success: "✓", failure: "×" }
//     } = options;

//     const probabilityFn = createProbabilityCalculator(probabilityScaling);
//     const payoutFn = createPayoutCalculator(payoutScaling);
//     const autoFn = createAutoCalculator(autoScaling);
//     const widget = createWinCondition(winCondition, { name });
//     const normalizedResultSymbols = {
//         success: resultSymbols.success ?? "✓",
//         failure: resultSymbols.failure ?? "×"
//     };

//     const normalizedUpgrades = {};
//     Object.entries(upgrades).forEach(([key, spec]) => {
//         const scope = spec.scope ?? "specific";
//         normalizedUpgrades[key] = {
//             ...spec,
//             scope,
//             title: spec.title ?? toLabel(key) ?? key,
//             description: spec.description ?? "",
//             action: spec.action ?? "upgrade",
//             maxLevel: spec.maxLevel ?? Number.POSITIVE_INFINITY
//         };
//     });

//     function computeUpgradeCost(spec, level) {
//         if (!spec) {
//             return Infinity;
//         }
//         const maxLevel = spec.maxLevel ?? Number.POSITIVE_INFINITY;
//         if (level >= maxLevel) {
//             return Infinity;
//         }
//         const baseCost = spec.baseCost ?? 0;
//         if (spec.costScaling?.type === "linear") {
//             const step = spec.costScaling.step ?? spec.step ?? baseCost;
//             const cost = baseCost + step * level;
//             return Math.max(1, Math.ceil(cost));
//         }

//         const growth = spec.costScaling?.growth ?? spec.growth ?? 1;
//         const cost = baseCost * Math.pow(growth, level);
//         return Math.max(1, Math.ceil(cost));
//     }

//     return {
//         id,
//         name,
//         widget,
//         actionLabel,
//         resultSymbols: normalizedResultSymbols,
//         upgrades: normalizedUpgrades,
//         getProbability: (level) => probabilityFn(level),
//         getPayout: (level) => payoutFn(level),
//         getAutoInterval: (level) => autoFn(level),
//         getUpgradeCost: (type, stateRef) => {
//             const spec = normalizedUpgrades[type];
//             if (!spec) {
//                 return Infinity;
//             }
//             const level = stateRef?.[spec.levelKey] ?? 0;
//             return computeUpgradeCost(spec, level);
//         }
//     };
// }

const probObjects = [
    createProbObject({
        id: "coin-flip",
        name: "coin-flip",
        actionLabel: "flip",
        probabilityScaling: { type: "exponential", base: 0.50, decay: 0.9, cap: 0.999 },
        payoutScaling: { type: "linear", base: 1, growth: 1 },
        autoScaling: { type: "exponential-decay", base: 5000, decay: 0.65, min: 350 },
        resultSymbols: { success: "H", failure: "T" },
        upgrades: {
            payout: {
                scope: "generic",
                baseCost: 50,
                growth: 2.4,
                levelKey: "payoutLevel",
                title: "lucky rake",
                description: "each win pays out more, compounding the improbable winnings.",
                action: "boost credits"
            },
            auto: {
                scope: "generic",
                baseCost: 100,
                growth: 2.5,
                levelKey: "autoLevel",
                title: "auto flipper",
                description: "mechanical patience: hands-free flips at ever-faster tempo.",
                action: "boost cadence"
            },
            probability: {
                baseCost: 25,
                growth: 2.8,
                levelKey: "probabilityLevel",
                title: "bias tweak",
                description: "shave the tails edge. probability inches toward certainty, never quite there.",
                action: "boost chance"
            },
            twinCoin: {
                baseCost: 250,
                costScaling: { type: "linear", step: 250 },
                maxLevel: 1,
                levelKey: "twinCoinLevel",
                title: "twin toss",
                description: "flip a shadow coin alongside yours; if either hits heads, you cash it.",
                action: "add coin"
            }
        },
        winCondition: {
            id: "improbable-run",
            type: "streak",
            goal: 10,
            summary: "flip heads ten times in a row."
        }
    }),
    createProbObject({
        id: "critical-d20",
        name: "critical d20",
        actionLabel: "roll d20",
        probabilityScaling: { type: "exponential", base: 0.50, decay: 0.92, cap: 0.6 },
        payoutScaling: { type: "exponential", base: 5, growth: 1.7 },
        autoScaling: { type: "exponential-decay", base: 6000, decay: 0.7, min: 400 },
        resultSymbols: { success: "20", failure: "·" },
        upgrades: {
            probability: {
                baseCost: 40,
                growth: 2.6,
                levelKey: "probabilityLevel",
                title: "edge aligner",
                description: "fine-tune the die so twenties feel a touch less impossible.",
                action: "hone faces"
            },
            payout: {
                scope: "generic",
                baseCost: 80,
                growth: 2.3,
                levelKey: "payoutLevel",
                title: "critical purse",
                description: "every natural twenty unloads a richer stash of credits.",
                action: "raise payout"
            },
            auto: {
                scope: "generic",
                baseCost: 160,
                growth: 2.4,
                levelKey: "autoLevel",
                title: "clockwork hand",
                description: "clockwork rollers keep tossing the die, each upgrade tightening the rhythm.",
                action: "speed rolls"
            }
        },
        winCondition: {
            id: "perfect-twenties",
            type: "streak",
            goal: 10,
            summary: "roll a natural twenty ten times consecutively."
        }
    })
];

const states = new Map();
const autoIntervals = new Map();
const probLookup = new Map();
const navUI = new Map();

const globals = {
    credits: document.getElementById("credits-total"),
    title: document.getElementById("prob-title"),
    goal: document.getElementById("prob-goal-text"),
    chance: document.getElementById("prob-chance"),
    result: document.getElementById("prob-result"),
    actionButton: document.getElementById("prob-action"),
    historyTrack: document.getElementById("prob-history"),
    specificWrapper: document.getElementById("prob-specific-upgrades"),
    upgradeGrid: document.getElementById("upgrade-grid-body"),
    navList: document.getElementById("prob-nav-list")
};

const upgradeControls = {};
let genericUpgradeTypes = [];

let activeProbId = null;
const HISTORY_LIMIT = 20;
let currentSpecificView = { probId: null, order: [], buttons: new Map() };

const numberFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

function formatNumber(value) {
    return numberFormatter.format(value);
}

function formatUpgradeCostText(cost) {
    return Number.isFinite(cost) ? `cost: ${formatNumber(cost)}` : "maxed";
}

function collectGenericUpgradeTypes() {
    const types = new Set();
    probObjects.forEach((prob) => {
        Object.entries(prob.upgrades).forEach(([type, config]) => {
            if (config.scope === "generic") {
                types.add(type);
            }
        });
    });
    return Array.from(types);
}

initializeUpgradeControls();

if (globals.actionButton) {
    globals.actionButton.addEventListener("click", () => {
        const prob = getActiveProb();
        if (!prob) {
            return;
        }
        performProbAction(prob, false);
    });
}

probObjects.forEach((prob, index) => {
    initializeProb(prob);
    if (index === 0) {
        setActiveProb(prob.id);
    }
});

updateCreditsDisplay();

function initializeUpgradeControls() {
    if (!globals.upgradeGrid) {
        return;
    }
    genericUpgradeTypes = collectGenericUpgradeTypes();
    if (!genericUpgradeTypes.length) {
        return;
    }

    const row = document.createElement("div");
    row.className = "upgrade-grid-row";

    const label = document.createElement("span");
    label.className = "upgrade-grid-label";
    label.textContent = "all challenges";
    row.appendChild(label);

    const orderedTypes = ["auto", "payout"];
    orderedTypes.forEach((type) => {
        if (!genericUpgradeTypes.includes(type)) {
            const spacer = document.createElement("span");
            spacer.className = "upgrade-grid-label";
            spacer.textContent = "";
            row.appendChild(spacer);
            return;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "upgrade-button";
        button.dataset.upgrade = type;
        setUpgradeButton(button, "—", "unavailable", true);
        row.appendChild(button);
        upgradeControls[type] = button;
    });

    globals.upgradeGrid.appendChild(row);

    Object.entries(upgradeControls).forEach(([type, button]) => {
        if (!button) {
            return;
        }
        button.addEventListener("click", () => {
            const prob = getActiveProb();
            if (!prob) {
                return;
            }
            attemptUpgrade(prob, type);
        });
    });
}

function createUpgradePrimary(text) {
    const el = document.createElement("strong");
    el.textContent = text;
    return el;
}

function createUpgradeSecondary(text) {
    const el = document.createElement("span");
    el.textContent = text;
    return el;
}

function setUpgradeButton(button, primaryText, secondaryText, disabled) {
    button.innerHTML = "";
    button.appendChild(createUpgradePrimary(primaryText));
    button.appendChild(createUpgradeSecondary(secondaryText));
    button.disabled = Boolean(disabled);
}

function getUpgradePrimaryLabel(type, config) {
    if (type === "probability") {
        return config?.title ?? "probability";
    }
    if (type === "auto") {
        return "speed + 1";
    }
    if (type === "payout") {
        return "payout + $1";
    }
    return config?.title ?? type;
}

function getActiveProb() {
    if (!activeProbId) {
        return null;
    }
    return probLookup.get(activeProbId) ?? null;
}

function setActiveProb(probId) {
    if (!probLookup.has(probId)) {
        return;
    }
    activeProbId = probId;
    navUI.forEach((ui, id) => {
        if (ui.button) {
            ui.button.classList.toggle("active", id === probId);
        }
    });
    const prob = probLookup.get(probId);
    updateNavDisplay(prob);
    refreshActiveProb(prob);
}

function refreshActiveProb(prob) {
    if (!prob) {
        return;
    }
    const state = getProbState(prob.id);
    if (globals.title) {
        globals.title.textContent = prob.name;
    }
    if (globals.actionButton) {
        globals.actionButton.textContent = prob.actionLabel;
        globals.actionButton.disabled = false;
    }
    if (globals.chance) {
        const chance = getEffectiveProbability(prob, state);
        globals.chance.textContent = `${(chance * 100).toFixed(2)}%`;
    }
    if (globals.result) {
        globals.result.textContent = state.lastResultSymbol ?? "–";
    }
    updateGoalDisplay(prob, state);
    renderHistory(prob);
    ensureSpecificUpgradeView(prob);
    updateUpgradeButtons(prob, state);
    renderSpecificUpgrades(prob);
}

function formatGoalDescriptor(prob) {
    const widget = prob.widget ?? {};
    if (widget.description) {
        return widget.description.replace(/\.$/, "");
    }
    if (widget.title) {
        return widget.title;
    }
    return "goal";
}

function getGoalDetails(prob, state) {
    const widget = prob.widget ?? {};
    const goal = widget.goal ?? 0;
    const getProgress = widget.getProgress ?? ((value) => value.streak);
    const getBest = widget.getBest ?? ((value) => value.bestStreak);
    const progress = getProgress(state);
    const best = getBest(state);
    const isComplete = widget.isComplete ? widget.isComplete(state) : goal > 0 && progress >= goal;
    return { goal, progress, best, isComplete };
}

function formatGoalText(prob, details) {
    const descriptor = formatGoalDescriptor(prob);
    if (!details.goal) {
        return descriptor;
    }
    const progressValue = Math.min(details.progress, details.goal);
    return `${progressValue} / ${details.goal} ${descriptor}`.trim();
}

function updateGoalDisplay(prob, state) {
    if (!globals.goal) {
        return;
    }
    const details = getGoalDetails(prob, state);
    globals.goal.textContent = formatGoalText(prob, details);
    globals.goal.title = `best: ${details.best}`;
}

function getProbState(probId) {
    if (!states.has(probId)) {
        states.set(probId, createProbState());
    }
    return states.get(probId);
}

function sumAllCredits() {
    let total = 0;
    states.forEach((state) => {
        total += state.credits;
    });
    return total;
}

function updateCreditsDisplay() {
    if (globals.credits) {
        globals.credits.textContent = formatNumber(sumAllCredits());
    }
}

function updateUpgradeButtons(prob, state = getProbState(prob.id)) {
    Object.entries(upgradeControls).forEach(([type, button]) => {
        if (!button) {
            return;
        }
        const upgradeConfig = prob.upgrades?.[type];
        if (!upgradeConfig || upgradeConfig.scope !== "generic") {
            setUpgradeButton(button, "—", "unavailable", true);
            button.title = "";
            return;
        }
        const cost = prob.getUpgradeCost(type, state);
        const primaryLabel = getUpgradePrimaryLabel(type, upgradeConfig);
        const costText = formatUpgradeCostText(cost);
        const isMaxed = !Number.isFinite(cost);
        setUpgradeButton(button, primaryLabel, costText, isMaxed || state.credits < cost);
        button.title = upgradeConfig.description ?? "";
    });
}

function getSpecificUpgradeOrder(prob) {
    return Object.entries(prob.upgrades)
        .filter(([, config]) => config.scope !== "generic")
        .map(([type]) => type);
}

function ensureSpecificUpgradeView(prob) {
    if (!globals.specificWrapper) {
        return;
    }
    const order = getSpecificUpgradeOrder(prob);
    if (order.length === 0) {
        globals.specificWrapper.hidden = true;
        globals.specificWrapper.innerHTML = "";
        currentSpecificView = { probId: null, order: [], buttons: new Map() };
        return;
    }

    globals.specificWrapper.hidden = false;

    if (currentSpecificView.probId !== prob.id) {
        globals.specificWrapper.innerHTML = "";
        currentSpecificView = { probId: prob.id, order, buttons: new Map() };
    } else {
        currentSpecificView.order = order;
    }

    renderSpecificUpgrades(prob);
}

function renderSpecificUpgrades(prob) {
    if (!globals.specificWrapper) {
        return;
    }
    if (currentSpecificView.probId !== prob.id) {
        ensureSpecificUpgradeView(prob);
        return;
    }

    const state = getProbState(prob.id);
    const available = currentSpecificView.order.filter((type) => {
        const config = prob.upgrades?.[type];
        if (!config || config.scope === "generic") {
            return false;
        }
        const level = state[config.levelKey] ?? 0;
        const maxLevel = config.maxLevel ?? Number.POSITIVE_INFINITY;
        return level < maxLevel;
    });

    const display = available.slice(0, 3);
    const displaySet = new Set(display);

    currentSpecificView.buttons.forEach((button, type) => {
        if (!displaySet.has(type)) {
            button.remove();
            currentSpecificView.buttons.delete(type);
        }
    });

    display.forEach((type) => {
        const config = prob.upgrades[type];
        if (!config) {
            return;
        }
        let button = currentSpecificView.buttons.get(type);
        if (!button) {
            button = document.createElement("button");
            button.type = "button";
            button.className = "specific-upgrade";
            button.dataset.upgrade = type;

            const titleSpan = document.createElement("span");
            titleSpan.className = "specific-title";
            button.appendChild(titleSpan);

            const costSpan = document.createElement("span");
            costSpan.className = "specific-cost";
            button.appendChild(costSpan);

            button.addEventListener("click", () => attemptUpgrade(prob, type));

            currentSpecificView.buttons.set(type, button);
        }

        globals.specificWrapper.appendChild(button);
        updateSpecificUpgradeButton(prob, state, type, button, config);
    });

    globals.specificWrapper.hidden = display.length === 0;
}

function updateSpecificUpgradeButton(prob, state, type, button, config) {
    const title = button.querySelector(".specific-title");
    const costSpan = button.querySelector(".specific-cost");
    if (title) {
        title.textContent = config.title;
    }
    const cost = prob.getUpgradeCost(type, state);
    const isMaxed = !Number.isFinite(cost);
    costSpan.textContent = formatUpgradeCostText(cost);
    button.disabled = isMaxed || state.credits < cost;
}

function updateNavDisplay(prob) {
    const ui = navUI.get(prob.id);
    if (!ui) {
        return;
    }
    const state = getProbState(prob.id);
    const details = getGoalDetails(prob, state);
    if (ui.progress) {
        ui.progress.textContent = details.goal
            ? `${Math.min(details.progress, details.goal)} / ${details.goal}`
            : formatNumber(details.progress);
    }
    if (ui.button) {
        ui.button.classList.toggle("complete", details.isComplete);
        const tooltip = prob.widget?.description ?? prob.widget?.summary ?? prob.widget?.title ?? prob.name;
        ui.button.title = `${tooltip} • best streak ${details.best}`;
    }
}

function renderHistory(prob) {
    if (activeProbId !== prob.id || !globals.historyTrack) {
        return;
    }
    const state = getProbState(prob.id);
    globals.historyTrack.innerHTML = "";
    state.history.forEach((entry) => {
        const node = document.createElement("span");
        node.className = `history-item ${entry.isSuccess ? "success" : "failure"}`;
        node.textContent = entry.symbol;
        globals.historyTrack.appendChild(node);
    });
}

function updateProbDisplay(prob) {
    updateCreditsDisplay();
    updateNavDisplay(prob);
    if (activeProbId === prob.id) {
        refreshActiveProb(prob);
    }
}

function recordHistory(prob, isSuccess, symbol) {
    const state = getProbState(prob.id);
    state.history.unshift({ isSuccess, symbol });
    if (state.history.length > HISTORY_LIMIT) {
        state.history.length = HISTORY_LIMIT;
    }
    state.lastResultSymbol = symbol;
    renderHistory(prob);
}

function getEffectiveProbability(prob, state) {
    let probability = prob.getProbability(state.probabilityLevel);
    if (prob.id === "unfair-coin") {
        const twinLevel = state.twinCoinLevel ?? 0;
        if (twinLevel > 0) {
            const coinCount = 1 + twinLevel;
            probability = 1 - Math.pow(1 - probability, coinCount);
        }
    }
    return probability;
}

function performProbAction(prob, isAuto = false) {
    const state = getProbState(prob.id);
    const probability = getEffectiveProbability(prob, state);
    const roll = Math.random();
    const isWin = roll < probability;
    const symbol = isWin ? prob.resultSymbols.success : prob.resultSymbols.failure;

    state.totalPlays += 1;
    if (isWin) {
        state.totalWins += 1;
        state.streak += 1;
        state.credits += prob.getPayout(state.payoutLevel);
    } else {
        state.streak = 0;
    }

    if (state.streak > state.bestStreak) {
        state.bestStreak = state.streak;
    }

    recordHistory(prob, isWin, symbol);
    updateProbDisplay(prob);

    if (!isAuto && activeProbId === prob.id && globals.actionButton) {
        globals.actionButton.disabled = true;
        requestAnimationFrame(() => {
            globals.actionButton.disabled = false;
        });
    }
}

function attemptUpgrade(prob, type) {
    const state = getProbState(prob.id);
    const upgradeConfig = prob.upgrades?.[type];
    if (!upgradeConfig) {
        return;
    }
    const cost = prob.getUpgradeCost(type, state);
    if (!Number.isFinite(cost) || state.credits < cost) {
        return;
    }
    state.credits -= cost;
    const nextLevel = (state[upgradeConfig.levelKey] ?? 0) + 1;
    const maxLevel = upgradeConfig.maxLevel ?? Number.POSITIVE_INFINITY;
    state[upgradeConfig.levelKey] = Math.min(nextLevel, maxLevel);

    if (type === "auto") {
        applyAutoInterval(prob);
    }

    updateProbDisplay(prob);
}

function applyAutoInterval(prob) {
    if (autoIntervals.has(prob.id)) {
        clearInterval(autoIntervals.get(prob.id));
        autoIntervals.delete(prob.id);
    }
    const state = getProbState(prob.id);
    const interval = prob.getAutoInterval(state.autoLevel);
    if (interval) {
        const id = setInterval(() => {
            performProbAction(prob, true);
        }, interval);
        autoIntervals.set(prob.id, id);
    }
}

function createNavButton(prob) {
    if (!globals.navList) {
        return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prob-nav-button";
    button.dataset.probId = prob.id;

    const title = document.createElement("span");
    title.className = "nav-title";
    title.textContent = prob.name;

    const progress = document.createElement("span");
    progress.className = "nav-progress";
    progress.textContent = "";

    button.append(title, progress);
    button.addEventListener("click", () => setActiveProb(prob.id));

    globals.navList.appendChild(button);
    navUI.set(prob.id, { button, progress });
}

function initializeProb(prob) {
    probLookup.set(prob.id, prob);
    getProbState(prob.id);
    createNavButton(prob);
    updateNavDisplay(prob);
    applyAutoInterval(prob);
}


/*
todo

have most probabilities relatied to one random number, use bit shift or smth
completely redo prob_obj



*/
