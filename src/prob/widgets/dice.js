import { credits } from "../core/credits.js";
import { createCooldownTimer } from "../core/helpers.js";

export function createDiceWidget() {
    const dom = {
        section: document.getElementById("dice-widget-section"),
        chanceValue: document.getElementById("dice-chance"),
        streakStatus: document.getElementById("dice-streak"),
        results: document.getElementById("dice-results"),
        rollButton: document.getElementById("dice-roll"),
        addDieButton: document.getElementById("dice-upgrade-add")
    };

    const state = {
        diceCount: 1,
        maxDice: 3,
        targetStreak: 10,
        streak: 0,
        bestStreak: 0,
        rollInterval: 3000,
        isAnimating: false
    };

    const cooldown = createCooldownTimer(dom.rollButton, { label: "roll" });
    let diceFaces = [];
    let animationId = null;
    let unsubscribeCredits = null;

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

    function init() {
        ensureDiceFaces();
        setDiceResults(Array(state.diceCount).fill("–"));
        updateChanceDisplay();
        updateStreakDisplay();
        refreshUpgradeStates();
        cooldown.cancel();
        bindEvents();
        if (typeof unsubscribeCredits === "function") {
            unsubscribeCredits();
        }
        unsubscribeCredits = credits.subscribe(() => refreshUpgradeStates());
    }

    function show() {
        ensureDiceFaces();
        updateChanceDisplay();
        updateStreakDisplay();
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

    return {
        id: "dice",
        section: dom.section,
        init,
        show,
        hide
    };
}

