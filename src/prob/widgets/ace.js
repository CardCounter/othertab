import { credits } from "../core/credits.js";
import { createCooldownTimer, formatNumber } from "../core/helpers.js";

const ACE_OF_SPADES = "A♠";
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

const COSTS = {
    payout(level) {
        return Math.ceil(6 * Math.pow(1.5, level));
    },
    speed(level) {
        return Math.ceil(14 * Math.pow(1.4, level));
    }
};

const DELETE_CARD_COST = 8;
const ADD_ACE_COST = 12;

function buildInitialDeck() {
    const deck = [];
    SUITS.forEach((suit) => {
        RANKS.forEach((rank) => {
            deck.push(`${rank}${suit}`);
        });
    });
    return deck;
}

function getAvailableIndices(deck) {
    const indices = [];
    deck.forEach((card, index) => {
        if (card) {
            indices.push(index);
        }
    });
    return indices;
}

function countCard(deck, target) {
    return deck.reduce((total, card) => (card === target ? total + 1 : total), 0);
}

function getDeckSize(deck) {
    return deck.reduce((total, card) => (card ? total + 1 : total), 0);
}

function hasEmptySlot(deck) {
    return deck.some((card) => !card);
}

export function createAceWidget() {
    const main = document.querySelector(".prob-main");
    const dom = {
        section: document.getElementById("ace-widget-section"),
        payoutValue: document.getElementById("ace-payout-value"),
        payoutUpgrade: document.getElementById("ace-upgrade-payout"),
        speedUpgrade: document.getElementById("ace-upgrade-speed"),
        chanceValue: document.getElementById("ace-chance"),
        streakStatus: document.getElementById("ace-streak"),
        drawButton: document.getElementById("ace-draw"),
        results: Array.from(document.querySelectorAll(".ace-result-card")),
        seeDeck: document.getElementById("ace-see-deck"),
        deckPage: document.getElementById("ace-deck-view"),
        deckGrid: document.getElementById("deck-grid"),
        deckClose: document.getElementById("deck-close"),
        deleteUpgrade: document.getElementById("deck-upgrade-delete"),
        addUpgrade: document.getElementById("deck-upgrade-add"),
        modeIndicator: document.getElementById("deck-mode-indicator")
    };

    const state = {
        payout: 2,
        payoutLevel: 0,
        speedLevel: 0,
        streak: 0,
        bestStreak: 0,
        targetStreak: 10,
        baseInterval: 3500,
        minInterval: 600,
        intervalDecay: 0.82,
        isAnimating: false,
        pendingMode: null,
        pendingCost: 0,
        deck: buildInitialDeck(),
        history: ["–", "–", "–"]
    };

    const cooldown = createCooldownTimer(dom.drawButton, { label: "draw" });
    let animationId = null;
    let unsubscribeCredits = null;
    let deckCells = [];
    let indicatorTimeout = null;

    function getCurrentInterval() {
        const interval = state.baseInterval * Math.pow(state.intervalDecay, state.speedLevel);
        return Math.max(state.minInterval, Math.round(interval));
    }

    function updateChanceDisplay() {
        if (!dom.chanceValue) {
            return;
        }
        const deckSize = getDeckSize(state.deck);
        const aceCount = countCard(state.deck, ACE_OF_SPADES);
        const chance = deckSize === 0 ? 0 : (aceCount / deckSize) * 100;
        const percentText = chance.toFixed(2).replace(/\.00$/, "");
        dom.chanceValue.textContent = `${percentText}% chance of ${ACE_OF_SPADES}`;
        updateDrawAvailability(deckSize > 0);
    }

    function updateDrawAvailability(hasCards) {
        if (!dom.drawButton) {
            return;
        }
        const available = typeof hasCards === "boolean" ? hasCards : getDeckSize(state.deck) > 0;
        dom.drawButton.disabled = !available;
        if (!available) {
            dom.drawButton.textContent = "draw";
        }
    }

    function updateStreakDisplay() {
        if (!dom.streakStatus) {
            return;
        }
        if (state.bestStreak >= state.targetStreak) {
            dom.streakStatus.textContent = `longest streak: ${state.bestStreak}`;
        } else {
            dom.streakStatus.textContent = `${state.streak}/${state.targetStreak} ${ACE_OF_SPADES} in a row`;
        }
    }

    function updateResultsDisplay() {
        dom.results.forEach((element, index) => {
            const value = state.history[index] ?? "–";
            element.textContent = value;
            if (value && value !== "–") {
                element.dataset.card = value;
            } else {
                delete element.dataset.card;
            }
        });
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
        dom.speedUpgrade.textContent = improves ? `increase draws/sec (${cost}φ)` : "increase draws/sec (max)";
        dom.speedUpgrade.disabled = !improves || !credits.canAfford(cost);
        dom.speedUpgrade.title = improves
            ? `next draw interval: ${(nextInterval / 1000).toFixed(2)}s`
            : "maximum draw speed reached";
    }

    function updateDeckModeIndicator(text = "", options = {}) {
        if (!dom.modeIndicator) {
            return;
        }
        dom.modeIndicator.textContent = text;
        if (indicatorTimeout) {
            clearTimeout(indicatorTimeout);
            indicatorTimeout = null;
        }
        const { autoClear = false } = options ?? {};
        if (autoClear) {
            const timeoutMs = typeof autoClear === "number" ? autoClear : 1800;
            indicatorTimeout = window.setTimeout(() => {
                indicatorTimeout = null;
                if (!state.pendingMode) {
                    dom.modeIndicator.textContent = "";
                }
            }, timeoutMs);
        }
    }

    function updateDeckUpgradeButtons() {
        if (dom.deleteUpgrade) {
            dom.deleteUpgrade.textContent = `delete card (${DELETE_CARD_COST}φ)`;
            dom.deleteUpgrade.disabled = !credits.canAfford(DELETE_CARD_COST) || getDeckSize(state.deck) === 0;
        }
        if (dom.addUpgrade) {
            dom.addUpgrade.textContent = `add ${ACE_OF_SPADES} (${ADD_ACE_COST}φ)`;
            dom.addUpgrade.disabled = !credits.canAfford(ADD_ACE_COST) || !hasEmptySlot(state.deck);
        }
    }

    function refreshUpgradeStates() {
        updatePayoutDisplay();
        updateSpeedDisplay();
        updateDeckUpgradeButtons();
    }

    function renderDeckGrid() {
        if (!dom.deckGrid) {
            return;
        }
        dom.deckGrid.innerHTML = "";
        deckCells = [];
        SUITS.forEach((suit, suitIndex) => {
            RANKS.forEach((rank, rankIndex) => {
                const index = suitIndex * RANKS.length + rankIndex;
                const button = document.createElement("button");
                button.type = "button";
                button.className = "deck-cell";
                button.dataset.index = String(index);
                button.setAttribute("role", "gridcell");
                button.setAttribute("aria-label", `${rank}${suit}`);
                dom.deckGrid.appendChild(button);
                deckCells.push(button);
            });
        });
        updateDeckCells();
    }

    function updateDeckCells() {
        deckCells.forEach((cell, index) => {
            const card = state.deck[index];
            if (!cell) {
                return;
            }
            if (card) {
                cell.textContent = card;
                cell.classList.remove("deck-cell-empty");
                cell.removeAttribute("data-empty");
                cell.setAttribute("aria-label", card);
            } else {
                cell.textContent = "–";
                cell.classList.add("deck-cell-empty");
                cell.dataset.empty = "true";
                cell.setAttribute("aria-label", "empty slot");
            }
        });
    }

    function stopDrawAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        state.isAnimating = false;
    }

    function startDrawAnimation(swapInterval = 80) {
        if (!dom.drawButton) {
            return;
        }
        stopDrawAnimation();
        state.isAnimating = true;
        const roll = () => {
            const available = state.deck.filter(Boolean);
            const randomCard =
                available.length > 0 ? available[Math.floor(Math.random() * available.length)] : "–";
            dom.results.forEach((element) => {
                element.textContent = randomCard;
                if (randomCard && randomCard !== "–") {
                    element.dataset.card = randomCard;
                } else {
                    delete element.dataset.card;
                }
            });
        };
        roll();
        let lastSwap = performance.now();
        const loop = (now) => {
            if (now - lastSwap >= swapInterval) {
                lastSwap = now;
                roll();
            }
            animationId = requestAnimationFrame(loop);
        };
        animationId = requestAnimationFrame(loop);
    }

    function pushHistory(card) {
        state.history.unshift(card ?? "–");
        state.history = state.history.slice(0, dom.results.length);
        updateResultsDisplay();
    }

    function resetDeckModes() {
        state.pendingMode = null;
        state.pendingCost = 0;
        if (indicatorTimeout) {
            clearTimeout(indicatorTimeout);
            indicatorTimeout = null;
        }
        updateDeckModeIndicator("");
        updateDeckUpgradeButtons();
        dom.deckPage?.classList.remove("deck-mode-delete", "deck-mode-add");
    }

    function openDeckView() {
        if (!main) {
            return;
        }
        main.classList.add("deck-view-active");
        resetDeckModes();
        updateDeckCells();
        updateDeckUpgradeButtons();
    }

    function closeDeckView() {
        if (!main) {
            return;
        }
        main.classList.remove("deck-view-active");
        resetDeckModes();
        updateDeckCells();
    }

    function handleDraw() {
        if (state.isAnimating || cooldown.isActive() || (dom.drawButton && dom.drawButton.disabled)) {
            return;
        }
        const availableIndices = getAvailableIndices(state.deck);
        if (availableIndices.length === 0) {
            return;
        }
        if (dom.drawButton) {
            dom.drawButton.disabled = true;
            dom.drawButton.textContent = "drawing...";
        }

        startDrawAnimation();

        cooldown.start(getCurrentInterval(), () => {
            stopDrawAnimation();
            const indices = getAvailableIndices(state.deck);
            if (indices.length === 0) {
                pushHistory("–");
                updateStreakDisplay();
                refreshUpgradeStates();
                return;
            }
            const index = indices[Math.floor(Math.random() * indices.length)];
            const card = state.deck[index];
            pushHistory(card);

            if (card === ACE_OF_SPADES) {
                state.streak += 1;
                if (state.streak > state.bestStreak) {
                    state.bestStreak = state.streak;
                }
                credits.add(state.payout);
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
        state.payout += 1;
        state.payoutLevel += 1;
        refreshUpgradeStates();
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
        } else if (dom.drawButton && !state.isAnimating) {
            dom.drawButton.textContent = "draw";
        }
    }

    function handleDeleteUpgrade() {
        if (getDeckSize(state.deck) === 0 || !credits.canAfford(DELETE_CARD_COST)) {
            return;
        }
        state.pendingMode = "delete";
        state.pendingCost = DELETE_CARD_COST;
        updateDeckModeIndicator(`select a card to delete (${DELETE_CARD_COST}φ)`);
        dom.deckPage?.classList.remove("deck-mode-add");
        dom.deckPage?.classList.add("deck-mode-delete");
    }

    function handleAddUpgrade() {
        if (!hasEmptySlot(state.deck)) {
            return;
        }
        if (!credits.canAfford(ADD_ACE_COST)) {
            return;
        }
        state.pendingMode = "add";
        state.pendingCost = ADD_ACE_COST;
        updateDeckModeIndicator(`select an empty slot to add ${ACE_OF_SPADES} (${ADD_ACE_COST}φ)`);
        dom.deckPage?.classList.remove("deck-mode-delete");
        dom.deckPage?.classList.add("deck-mode-add");
    }

    function handleDeckCellClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (!target.dataset.index) {
            return;
        }
        const index = Number.parseInt(target.dataset.index, 10);
        if (Number.isNaN(index)) {
            return;
        }
        if (state.pendingMode === "delete") {
            if (!state.deck[index]) {
                return;
            }
            if (credits.spend(state.pendingCost)) {
                state.deck[index] = null;
                updateDeckCells();
                updateChanceDisplay();
                updateDeckUpgradeButtons();
                resetDeckModes();
            } else {
                updateDeckModeIndicator("not enough credits", { autoClear: 2000 });
                state.pendingMode = null;
                state.pendingCost = 0;
                updateDeckUpgradeButtons();
                dom.deckPage?.classList.remove("deck-mode-delete", "deck-mode-add");
            }
            return;
        }
        if (state.pendingMode === "add") {
            if (state.deck[index]) {
                return;
            }
            if (credits.spend(state.pendingCost)) {
                state.deck[index] = ACE_OF_SPADES;
                updateDeckCells();
                updateChanceDisplay();
                updateDeckUpgradeButtons();
                resetDeckModes();
            } else {
                updateDeckModeIndicator("not enough credits", { autoClear: 2000 });
                state.pendingMode = null;
                state.pendingCost = 0;
                updateDeckUpgradeButtons();
                dom.deckPage?.classList.remove("deck-mode-delete", "deck-mode-add");
            }
        }
    }

    function bindEvents() {
        dom.drawButton?.addEventListener("click", handleDraw);
        dom.payoutUpgrade?.addEventListener("click", handlePayoutUpgrade);
        dom.speedUpgrade?.addEventListener("click", handleSpeedUpgrade);
        dom.seeDeck?.addEventListener("click", openDeckView);
        dom.deckClose?.addEventListener("click", closeDeckView);
        dom.deleteUpgrade?.addEventListener("click", handleDeleteUpgrade);
        dom.addUpgrade?.addEventListener("click", handleAddUpgrade);
        dom.deckGrid?.addEventListener("click", handleDeckCellClick);
    }

    function init() {
        updateChanceDisplay();
        updateStreakDisplay();
        updateResultsDisplay();
        refreshUpgradeStates();
        renderDeckGrid();
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
        updateResultsDisplay();
        refreshUpgradeStates();
    }

    function hide() {
        stopDrawAnimation();
        cooldown.cancel();
        closeDeckView();
    }

    return {
        id: "ace",
        section: dom.section,
        init,
        show,
        hide
    };
}
