const appDom = {
    creditsTotal: document.getElementById("credits-total"),
    widgetPrev: document.getElementById("widget-prev"),
    widgetNext: document.getElementById("widget-next")
};

const appState = {
    credits: 0
};

const creditListeners = new Set();

function notifyCredits() {
    creditListeners.forEach((listener) => {
        try {
            listener(appState.credits);
        } catch {
            // ignore listener errors
        }
    });
}

function formatNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "");
}

function updateCreditsDisplay() {
    if (!appDom.creditsTotal) {
        return;
    }
    appDom.creditsTotal.textContent = formatNumber(appState.credits);
}

function setCredits(value) {
    appState.credits = value;
    updateCreditsDisplay();
    notifyCredits();
}

const credits = {
    get() {
        return appState.credits;
    },
    add(amount) {
        setCredits(appState.credits + amount);
        return appState.credits;
    },
    canAfford(cost) {
        return appState.credits >= cost;
    },
    spend(cost) {
        if (!this.canAfford(cost)) {
            return false;
        }
        setCredits(appState.credits - cost);
        return true;
    },
    subscribe(listener) {
        if (typeof listener !== "function") {
            return () => {};
        }
        creditListeners.add(listener);
        return () => creditListeners.delete(listener);
    }
};

function createCooldownTimer(button, { label = "action" } = {}) {
    let endTime = 0;
    let rafId = null;
    let completion = null;
    let active = false;

    if (button) {
        button.disabled = false;
        button.textContent = label;
    }

    function clearTimer() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        active = false;
        completion = null;
        if (button) {
            button.disabled = false;
            button.textContent = label;
        }
    }

    function tick(timestamp) {
        if (!button) {
            return;
        }
        const remaining = Math.max(0, endTime - timestamp);
        if (remaining <= 0) {
            const pending = completion;
            clearTimer();
            if (typeof pending === "function") {
                pending();
            }
            return;
        }
        button.disabled = true;
        button.textContent = `${label} (${(remaining / 1000).toFixed(1)}s)`;
        rafId = requestAnimationFrame(tick);
    }

    return {
        start(durationMs, onComplete) {
            if (!button) {
                if (typeof onComplete === "function") {
                    setTimeout(onComplete, durationMs);
                }
                return;
            }
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            active = true;
            completion = onComplete;
            endTime = performance.now() + durationMs;
            button.disabled = true;
            tick(performance.now());
        },
        shorten(durationMs) {
            if (!active || !button) {
                return;
            }
            const now = performance.now();
            const remaining = Math.max(0, endTime - now);
            endTime = now + Math.min(remaining, durationMs);
            button.disabled = true;
            button.textContent = `${label} (${(Math.max(0, endTime - now) / 1000).toFixed(1)}s)`;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            tick(performance.now());
        },
        cancel() {
            clearTimer();
        },
        isActive() {
            return active;
        }
    };
}

const coinWidget = (() => {
    const dom = {
        section: document.getElementById("coin-widget-section"),
        payoutValue: document.getElementById("coin-payout-value"),
        payoutUpgrade: document.getElementById("coin-upgrade-payout"),
        speedUpgrade: document.getElementById("coin-upgrade-speed"),
        chanceValue: document.getElementById("coin-chance"),
        streakStatus: document.getElementById("coin-streak"),
        resultsWrapper: document.getElementById("coin-results-wrapper"),
        resultPrimary: document.getElementById("coin-result-primary"),
        resultSecondary: document.getElementById("coin-result-secondary"),
        dualUpgrade: document.getElementById("coin-upgrade-dual"),
        bestStart: document.getElementById("coin-best-start"),
        bestEnd: document.getElementById("coin-best-end"),
        flipButton: document.getElementById("coin-flip"),
        historyTrack: document.getElementById("coin-history-track")
    };

    const state = {
        payout: 1,
        payoutLevel: 0,
        speedLevel: 0,
        chance: 0.5,
        streak: 0,
        bestStreak: 0,
        targetStreak: 10,
        history: [],
        baseInterval: 3000,
        minInterval: 500,
        intervalDecay: 0.82,
        isAnimating: false,
        extraCoinUnlocked: false
    };

    const COSTS = {
        payout(level) {
            return Math.ceil(3 * Math.pow(1.4, level));
        },
        speed(level) {
            return Math.ceil(10 * Math.pow(1.45, level));
        }
    };

    const DUAL_COIN_COST = 10;

    const cooldown = createCooldownTimer(dom.flipButton, { label: "flip" });
    let flipAnimationId = null;

    function getCurrentInterval() {
        const interval = state.baseInterval * Math.pow(state.intervalDecay, state.speedLevel);
        return Math.max(state.minInterval, Math.round(interval));
    }

    function updateChanceDisplay() {
        if (!dom.chanceValue) {
            return;
        }
        const percentText = (state.chance * 100).toFixed(1).replace(/\.0$/, "");
        dom.chanceValue.textContent = `${percentText}% chance of heads`;
    }

    function updateStreakDisplay() {
        if (!dom.streakStatus) {
            return;
        }
        if (state.bestStreak >= state.targetStreak) {
            dom.streakStatus.textContent = `longest streak: ${state.bestStreak}`;
        } else {
            dom.streakStatus.textContent = `${state.streak}/${state.targetStreak} heads in a row`;
        }
    }

    function renderHistory() {
        if (!dom.historyTrack) {
            return;
        }
        dom.historyTrack.innerHTML = "";
        const fragment = document.createDocumentFragment();
        state.history.forEach((entry) => {
            const span = document.createElement("span");
            span.textContent = entry;
            if (entry === "h") {
                span.classList.add("flip-heads");
            }
            fragment.appendChild(span);
        });
        dom.historyTrack.appendChild(fragment);
    }

    function clearCoinElement(element) {
        if (!element) {
            return;
        }
        element.textContent = "–";
        delete element.dataset.result;
    }

    function getActiveCoinElements() {
        const elements = [];
        if (dom.resultPrimary) {
            elements.push(dom.resultPrimary);
        }
        if (state.extraCoinUnlocked && dom.resultSecondary) {
            elements.push(dom.resultSecondary);
        }
        return elements;
    }

    function setCoinResults(symbols) {
        const elements = getActiveCoinElements();
        if (elements.length === 0) {
            return;
        }
        const fallback = symbols[0] ?? "–";
        elements.forEach((element, index) => {
            const symbol = symbols[index] ?? fallback;
            element.textContent = symbol;
            if (symbol === "–") {
                delete element.dataset.result;
            } else {
                element.dataset.result = symbol;
            }
        });
        if (state.extraCoinUnlocked && dom.resultSecondary) {
            dom.resultSecondary.setAttribute("aria-hidden", "false");
        }
        if (!state.extraCoinUnlocked && dom.resultSecondary) {
            clearCoinElement(dom.resultSecondary);
            dom.resultSecondary.setAttribute("aria-hidden", "true");
        }
    }

    function updatePayoutDisplay() {
        if (!dom.payoutValue || !dom.payoutUpgrade) {
            return;
        }
        dom.payoutValue.textContent = formatNumber(state.payout);
        const cost = COSTS.payout(state.payoutLevel);
        dom.payoutUpgrade.textContent = `upgrade payout (${cost}φ)`;
        dom.payoutUpgrade.disabled = !credits.canAfford(cost);
        dom.payoutUpgrade.title = `increase payout to ${formatNumber(state.payout + 1)}φ`;
    }

    function updateSpeedDisplay() {
        if (!dom.speedUpgrade) {
            return;
        }
        const cost = COSTS.speed(state.speedLevel);
        const currentInterval = getCurrentInterval();
        const nextInterval = Math.max(
            state.minInterval,
            Math.round(state.baseInterval * Math.pow(state.intervalDecay, state.speedLevel + 1))
        );
        const improves = nextInterval < currentInterval;
        dom.speedUpgrade.textContent = improves
            ? `increase flips/sec (${cost}φ)`
            : "increase flips/sec (max)";
        dom.speedUpgrade.disabled = !improves || !credits.canAfford(cost);
        dom.speedUpgrade.title = improves
            ? `next flip interval: ${(nextInterval / 1000).toFixed(2)}s`
            : "maximum speed reached";
    }

    function updateDualCoinDisplay() {
        const unlocked = state.extraCoinUnlocked;
        if (dom.dualUpgrade) {
            if (unlocked) {
                dom.dualUpgrade.textContent = "dual coin unlocked";
                dom.dualUpgrade.disabled = true;
            } else {
                dom.dualUpgrade.textContent = `add dual coin (${DUAL_COIN_COST}φ)`;
                dom.dualUpgrade.disabled = !credits.canAfford(DUAL_COIN_COST);
            }
        }
        if (dom.resultsWrapper) {
            dom.resultsWrapper.classList.toggle("coin-results-extra", unlocked);
        }
        if (dom.resultSecondary) {
            dom.resultSecondary.setAttribute("aria-hidden", unlocked ? "false" : "true");
            if (!unlocked) {
                clearCoinElement(dom.resultSecondary);
            }
        }
        if (dom.bestStart) {
            dom.bestStart.setAttribute("aria-hidden", unlocked ? "false" : "true");
        }
        if (dom.bestEnd) {
            dom.bestEnd.setAttribute("aria-hidden", unlocked ? "false" : "true");
        }
    }

    function refreshUpgradeStates() {
        updatePayoutDisplay();
        updateSpeedDisplay();
        updateDualCoinDisplay();
    }

    function addHistoryEntry(result) {
        state.history.unshift(result);
        if (state.history.length > 20) {
            state.history.pop();
        }
        renderHistory();
    }

    function startFlipAnimation(swapInterval = 80) {
        if (!dom.flipButton) {
            return;
        }
        if (flipAnimationId) {
            cancelAnimationFrame(flipAnimationId);
            flipAnimationId = null;
        }
        state.isAnimating = true;
        const randomize = () => {
            const elements = getActiveCoinElements();
            if (elements.length === 0) {
                return;
            }
            elements.forEach((element) => {
                const symbol = Math.random() < 0.5 ? "h" : "t";
                element.textContent = symbol;
                element.dataset.result = symbol;
            });
        };
        randomize();
        let lastSwap = performance.now();

        const loop = (now) => {
            if (now - lastSwap >= swapInterval) {
                lastSwap = now;
                randomize();
            }
            flipAnimationId = requestAnimationFrame(loop);
        };

        flipAnimationId = requestAnimationFrame(loop);
    }

    function stopFlipAnimation() {
        if (flipAnimationId) {
            cancelAnimationFrame(flipAnimationId);
            flipAnimationId = null;
        }
        state.isAnimating = false;
    }

    function awardCredits(amount) {
        credits.add(amount);
        refreshUpgradeStates();
    }

    function handleFlip() {
        if (state.isAnimating || cooldown.isActive() || (dom.flipButton && dom.flipButton.disabled)) {
            return;
        }

        const coinCount = state.extraCoinUnlocked ? 2 : 1;
        const results = Array.from({ length: coinCount }, () => Math.random() < state.chance);
        const finalIsHeads = results.some(Boolean);
        const coinSymbols = results.map((isHeads) => (isHeads ? "h" : "t"));
        const historySymbol = finalIsHeads ? "h" : "t";

        if (dom.flipButton) {
            dom.flipButton.disabled = true;
            dom.flipButton.textContent = "flipping...";
        }

        startFlipAnimation();

        cooldown.start(getCurrentInterval(), () => {
            stopFlipAnimation();
            setCoinResults(coinSymbols);

            if (finalIsHeads) {
                state.streak += 1;
                if (state.streak > state.bestStreak) {
                    state.bestStreak = state.streak;
                }
                awardCredits(state.payout);
            } else {
                state.streak = 0;
            }

            addHistoryEntry(historySymbol);
            updateStreakDisplay();
            refreshUpgradeStates();
        });
    }

    function handlePayoutUpgrade() {
        const cost = COSTS.payout(state.payoutLevel);
        if (!credits.spend(cost)) {
            return;
        }
        state.payoutLevel += 1;
        state.payout += 1;
        refreshUpgradeStates();
    }

    function handleDualCoinUpgrade() {
        if (state.extraCoinUnlocked) {
            return;
        }
        if (!credits.spend(DUAL_COIN_COST)) {
            return;
        }
        state.extraCoinUnlocked = true;
        refreshUpgradeStates();
        if (dom.resultSecondary) {
            clearCoinElement(dom.resultSecondary);
            dom.resultSecondary.setAttribute("aria-hidden", "false");
        }
        const primarySymbol =
            dom.resultPrimary && dom.resultPrimary.textContent ? dom.resultPrimary.textContent : "–";
        setCoinResults([primarySymbol, "–"]);
    }

    function handleSpeedUpgrade() {
        const cost = COSTS.speed(state.speedLevel);
        const currentInterval = getCurrentInterval();
        const nextInterval = Math.max(
            state.minInterval,
            Math.round(state.baseInterval * Math.pow(state.intervalDecay, state.speedLevel + 1))
        );
        if (nextInterval >= currentInterval) {
            return;
        }
        if (!credits.spend(cost)) {
            return;
        }
        state.speedLevel += 1;
        refreshUpgradeStates();
        if (cooldown.isActive()) {
            cooldown.shorten(getCurrentInterval());
        } else if (dom.flipButton && !state.isAnimating) {
            dom.flipButton.textContent = "flip";
        }
    }

    function bindEvents() {
        if (dom.flipButton) {
            dom.flipButton.addEventListener("click", handleFlip);
        }
        if (dom.payoutUpgrade) {
            dom.payoutUpgrade.addEventListener("click", handlePayoutUpgrade);
        }
        if (dom.speedUpgrade) {
            dom.speedUpgrade.addEventListener("click", handleSpeedUpgrade);
        }
        if (dom.dualUpgrade) {
            dom.dualUpgrade.addEventListener("click", handleDualCoinUpgrade);
        }
    }

    function init() {
        updateChanceDisplay();
        updateStreakDisplay();
        renderHistory();
        refreshUpgradeStates();
        setCoinResults(["–", "–"]);
        cooldown.cancel();
        bindEvents();
        credits.subscribe(() => refreshUpgradeStates());
    }

    function show() {
        updateChanceDisplay();
        updateStreakDisplay();
        renderHistory();
        refreshUpgradeStates();
    }

    function hide() {
        const wasAnimating = state.isAnimating;
        stopFlipAnimation();
        cooldown.cancel();
        if (wasAnimating) {
            setCoinResults(["–", "–"]);
        }
    }

    return {
        id: "coin",
        init,
        show,
        hide
    };
})();

const diceWidget = (() => {
    const dom = {
        section: document.getElementById("dice-widget-section"),
        chanceValue: document.getElementById("dice-chance"),
        streakStatus: document.getElementById("dice-streak"),
        results: document.getElementById("dice-results"),
        rollButton: document.getElementById("dice-roll"),
        addDieButton: document.getElementById("dice-upgrade-add"),
        historyTrack: document.getElementById("dice-history-track")
    };

    const state = {
        diceCount: 1,
        maxDice: 3,
        targetStreak: 10,
        streak: 0,
        bestStreak: 0,
        history: [],
        rollInterval: 3000,
        isAnimating: false
    };

    const cooldown = createCooldownTimer(dom.rollButton, { label: "roll" });
    let diceFaces = [];
    let animationId = null;

    function getSuccessChance() {
        return 1 - Math.pow(5 / 6, state.diceCount);
    }

    function getNextDieCost() {
        if (state.diceCount >= state.maxDice) {
            return null;
        }
        return 15 * state.diceCount;
    }

    function ensureDiceFaces() {
        if (!dom.results) {
            return;
        }
        if (diceFaces.length === state.diceCount) {
            return;
        }
        dom.results.innerHTML = "";
        diceFaces = [];
        for (let i = 0; i < state.diceCount; i += 1) {
            const face = document.createElement("div");
            face.className = "dice-face";
            face.textContent = "–";
            dom.results.appendChild(face);
            diceFaces.push(face);
        }
    }

    function updateChanceDisplay() {
        if (!dom.chanceValue) {
            return;
        }
        const percentText = (getSuccessChance() * 100).toFixed(1).replace(/\.0$/, "");
        dom.chanceValue.textContent = `${percentText}% chance of a six`;
    }

    function updateStreakDisplay() {
        if (!dom.streakStatus) {
            return;
        }
        if (state.bestStreak >= state.targetStreak) {
            dom.streakStatus.textContent = `longest streak: ${state.bestStreak}`;
        } else {
            dom.streakStatus.textContent = `${state.streak}/${state.targetStreak} sixes in a row`;
        }
    }

    function renderHistory() {
        if (!dom.historyTrack) {
            return;
        }
        dom.historyTrack.innerHTML = "";
        const fragment = document.createDocumentFragment();
        state.history.forEach((entry) => {
            const span = document.createElement("span");
            span.textContent = entry.success ? "6" : "×";
            span.classList.add(entry.success ? "success" : "failure");
            span.title = entry.values.join(", ");
            fragment.appendChild(span);
        });
        dom.historyTrack.appendChild(fragment);
    }

    function updateAddDieDisplay() {
        if (!dom.addDieButton) {
            return;
        }
        const cost = getNextDieCost();
        if (cost === null) {
            dom.addDieButton.textContent = "max dice unlocked";
            dom.addDieButton.disabled = true;
            return;
        }
        dom.addDieButton.textContent = `add die (${cost}φ)`;
        dom.addDieButton.disabled = !credits.canAfford(cost);
    }

    function refreshUpgradeStates() {
        updateAddDieDisplay();
    }

    function setDiceResults(values) {
        ensureDiceFaces();
        for (let i = 0; i < diceFaces.length; i += 1) {
            const face = diceFaces[i];
            const value = values[i] ?? "–";
            face.textContent = value;
            const isSuccess = Number(value) === 6;
            face.classList.toggle("success", isSuccess);
        }
    }

    function startRollAnimation(swapInterval = 90) {
        ensureDiceFaces();
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        state.isAnimating = true;

        const randomize = () => {
            diceFaces.forEach((face) => {
                const value = Math.floor(Math.random() * 6) + 1;
                face.textContent = value;
                face.classList.toggle("success", value === 6);
            });
        };

        randomize();
        let lastSwap = performance.now();

        const loop = (now) => {
            if (now - lastSwap >= swapInterval) {
                lastSwap = now;
                randomize();
            }
            animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);
    }

    function stopRollAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        state.isAnimating = false;
    }

    function addHistoryEntry(entry) {
        state.history.unshift(entry);
        if (state.history.length > 20) {
            state.history.pop();
        }
        renderHistory();
    }

    function handleRoll() {
        if (state.isAnimating || cooldown.isActive() || (dom.rollButton && dom.rollButton.disabled)) {
            return;
        }
        const results = Array.from({ length: state.diceCount }, () => Math.floor(Math.random() * 6) + 1);
        const success = results.some((value) => value === 6);

        if (dom.rollButton) {
            dom.rollButton.disabled = true;
            dom.rollButton.textContent = "rolling...";
        }

        startRollAnimation();

        cooldown.start(state.rollInterval, () => {
            stopRollAnimation();
            setDiceResults(results);

            if (success) {
                state.streak += 1;
                if (state.streak > state.bestStreak) {
                    state.bestStreak = state.streak;
                }
            } else {
                state.streak = 0;
            }

            addHistoryEntry({ success, values: results });
            updateStreakDisplay();
            refreshUpgradeStates();
        });
    }

    function handleAddDieUpgrade() {
        const cost = getNextDieCost();
        if (cost === null) {
            return;
        }
        if (!credits.spend(cost)) {
            return;
        }
        state.diceCount += 1;
        ensureDiceFaces();
        setDiceResults(Array(state.diceCount).fill("–"));
        updateChanceDisplay();
        refreshUpgradeStates();
    }

    function bindEvents() {
        if (dom.rollButton) {
            dom.rollButton.addEventListener("click", handleRoll);
        }
        if (dom.addDieButton) {
            dom.addDieButton.addEventListener("click", handleAddDieUpgrade);
        }
    }

    function show() {
        ensureDiceFaces();
        updateChanceDisplay();
        updateStreakDisplay();
        renderHistory();
        refreshUpgradeStates();
    }

    function hide() {
        const wasAnimating = state.isAnimating;
        stopRollAnimation();
        cooldown.cancel();
        if (wasAnimating) {
            setDiceResults(Array(state.diceCount).fill("–"));
        }
    }

    function init() {
        ensureDiceFaces();
        setDiceResults(Array(state.diceCount).fill("–"));
        updateChanceDisplay();
        updateStreakDisplay();
        renderHistory();
        refreshUpgradeStates();
        cooldown.cancel();
        bindEvents();
        credits.subscribe(() => refreshUpgradeStates());
    }

    return {
        id: "dice",
        init,
        show,
        hide
    };
})();

const widgetManager = (() => {
    const registry = {
        coin: coinWidget,
        dice: diceWidget
    };
    const order = Object.keys(registry);
    const sections = {
        coin: document.getElementById("coin-widget-section"),
        dice: document.getElementById("dice-widget-section")
    };
    const navButtons = Array.from(document.querySelectorAll(".carousel-item[data-widget]"));
    let active = null;

    function updateNavButtons() {
        navButtons.forEach((button) => {
            const { widget } = button.dataset;
            button.classList.toggle("active", widget === active);
        });
    }

    function setActive(name) {
        if (!registry[name]) {
            return;
        }
        if (active === name) {
            registry[name].show();
            updateNavButtons();
            return;
        }
        if (active && registry[active]) {
            registry[active].hide();
        }
        active = name;
        Object.entries(sections).forEach(([key, section]) => {
            if (!section) {
                return;
            }
            section.classList.toggle("widget-hidden", key !== name);
        });
        registry[name].show();
        updateNavButtons();
    }

    function cycle(delta) {
        if (!order.length) {
            return;
        }
        const currentIndex = active ? order.indexOf(active) : 0;
        const nextIndex = (currentIndex + delta + order.length) % order.length;
        setActive(order[nextIndex]);
    }

    function init() {
        navButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const { widget } = button.dataset;
                setActive(widget);
            });
        });
        if (appDom.widgetPrev) {
            appDom.widgetPrev.disabled = order.length <= 1;
            appDom.widgetPrev.addEventListener("click", () => cycle(-1));
        }
        if (appDom.widgetNext) {
            appDom.widgetNext.disabled = order.length <= 1;
            appDom.widgetNext.addEventListener("click", () => cycle(1));
        }
        setActive(order[0]);
    }

    return {
        init,
        setActive
    };
})();

function initializeApp() {
    updateCreditsDisplay();
    coinWidget.init();
    diceWidget.init();
    widgetManager.init();
}

initializeApp();
