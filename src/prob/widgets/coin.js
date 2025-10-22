import { credits } from "../core/credits.js";
import { createCooldownTimer, formatNumber } from "../core/helpers.js";

export function createCoinWidget() {
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
        flipButton: document.getElementById("coin-flip")
    };

    const state = {
        payout: 1,
        payoutLevel: 0,
        speedLevel: 0,
        chance: 0.5,
        streak: 0,
        bestStreak: 0,
        targetStreak: 10,
        baseInterval: 2000,
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
    let unsubscribeCredits = null;

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
        dom.speedUpgrade.textContent = improves ? `increase flips/sec (${cost}φ)` : "increase flips/sec (max)";
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
        refreshUpgradeStates();
        setCoinResults(["–", "–"]);
        cooldown.cancel();
        bindEvents();
        if (typeof unsubscribeCredits === "function") {
            unsubscribeCredits();
        }
        unsubscribeCredits = credits.subscribe(() => refreshUpgradeStates());
    }

    function show() {
        updateChanceDisplay();
        updateStreakDisplay();
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
        section: dom.section,
        init,
        show,
        hide
    };
}

