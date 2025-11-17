import { DEFAULT_AUTO_DRAW_BURN_CARD_COST, STREAK_TARGET } from "./config.js";
import {
    dealHandFromDeck,
    getCachedDeckCards,
    removeCardsFromDeck
} from "./deck-utils.js";
import {
    buildResultMessage,
    getHighlightIndices
} from "./hand-evaluation.js";
import {
    clearPendingDelete,
    fulfillPendingDiscardActivation,
    resetDeckToBaseline
} from "./deck-management.js";
import { renderDeckGrid, updateHandDisplay, updateStreakDisplay } from "./ui.js";
import { awardChips, calculateChipReward } from "./chips.js";
import { awardDice } from "./dice.js";
import { awardStatus } from "./status.js";
import {
    awardBurnCards,
    canAffordBurnCards,
    spendBurnCards,
    formatBurnCardAmount
} from "./burn-cards.js";
import { getDefaultDeckEvaluator } from "./evaluators/index.js";

const MIN_AUTO_DRAW_DELAY_MS = 50;

const SUIT_TO_RESOURCE = {
    "♦": "chips",
    "♠": "dice",
    "♣": "burnCard",
    "♥": "status"
};

const RESOURCE_SUIT_SYMBOL = {
    chips: "♦",
    dice: "♠",
    status: "♥",
    burnCard: "♣"
};

function createSuitBonusState() {
    return {
        chips: { multiplier: 1, count: 0, suitSymbol: RESOURCE_SUIT_SYMBOL.chips },
        dice: { multiplier: 1, count: 0, suitSymbol: RESOURCE_SUIT_SYMBOL.dice },
        status: { multiplier: 1, count: 0, suitSymbol: RESOURCE_SUIT_SYMBOL.status },
        burnCard: { multiplier: 1, count: 0, suitSymbol: RESOURCE_SUIT_SYMBOL.burnCard }
    };
}

function applySuitBonusBoostsFromState(bonuses, state) {
    if (!bonuses || !state) {
        return bonuses;
    }
    const boosts = state.suitBonusBoosts && typeof state.suitBonusBoosts === "object" ? state.suitBonusBoosts : null;
    if (!boosts) {
        return bonuses;
    }
    Object.entries(bonuses).forEach(([key, entry]) => {
        if (!entry) {
            return;
        }
        const boost = Number.isFinite(boosts[key]) && boosts[key] > 0 ? boosts[key] : 1;
        entry.multiplier *= boost;
    });
    return bonuses;
}

function calculateSuitBonusMultipliers(cards, highlightIndices, state) {
    const bonuses = createSuitBonusState();
    if (!Array.isArray(cards) || !Array.isArray(highlightIndices)) {
        return applySuitBonusBoostsFromState(bonuses, state);
    }
    highlightIndices.forEach((index) => {
        if (!Number.isInteger(index) || index < 0 || index >= cards.length) {
            return;
        }
        const card = cards[index];
        const suit = card?.suit;
        const resourceKey = suit ? SUIT_TO_RESOURCE[suit] : null;
        if (!resourceKey || !bonuses[resourceKey]) {
            return;
        }
        const entry = bonuses[resourceKey];
        entry.multiplier *= 2;
        entry.count += 1;
    });
    return applySuitBonusBoostsFromState(bonuses, state);
}

function getAutoDrawCost(state) {
    if (!state) {
        return DEFAULT_AUTO_DRAW_BURN_CARD_COST;
    }
    const candidate = Number.isFinite(state.autoDrawBurnCardCost)
        ? Math.max(0, Math.ceil(state.autoDrawBurnCardCost))
        : DEFAULT_AUTO_DRAW_BURN_CARD_COST;
    return candidate;
}

function disableAutoDueToBurnCardShortage(state, cost) {
    if (!state) {
        return;
    }
    if (state.autoDrawEnabled && typeof state.setAutoDrawEnabled === "function") {
        state.setAutoDrawEnabled(false);
    }
}

function resolveAutoDrawDelay(state) {
    if (!state) {
        return MIN_AUTO_DRAW_DELAY_MS;
    }
    if (Number.isFinite(state.autoDrawInterval) && state.autoDrawInterval > 0) {
        return Math.max(MIN_AUTO_DRAW_DELAY_MS, Math.floor(state.autoDrawInterval));
    }
    return MIN_AUTO_DRAW_DELAY_MS;
}

function scheduleNextAutoDraw(state) {
    if (!state?.autoDrawEnabled || state.autoDrawScheduled) {
        return;
    }
    state.autoDrawScheduled = true;
    const delay = resolveAutoDrawDelay(state);
    state.autoDrawTimerId = setTimeout(() => {
        state.autoDrawScheduled = false;
        state.autoDrawTimerId = null;
        if (!state.autoDrawEnabled) {
            return;
        }
        if (state.pendingDraw || state.isAnimating || state.dom.button.disabled) {
            scheduleNextAutoDraw(state);
            return;
        }
        handleDraw(state, { auto: true });
    }, delay);
}

function resolveHandSize(state) {
    const candidate = Number.isFinite(state?.handSize) ? Math.floor(state.handSize) : null;
    if (candidate != null && candidate > 0) {
        return candidate;
    }
    const configSize = Number.isFinite(state?.config?.handSize)
        ? Math.floor(state.config.handSize)
        : null;
    if (configSize != null && configSize > 0) {
        return configSize;
    }
    return 5;
}

function animateShuffle(state, durationMs, handSize) {
    return new Promise((resolve) => {
        if (!state || durationMs <= 0) {
            resolve();
            return;
        }

        const deck = getCachedDeckCards(state);
        if (deck.length < handSize) {
            resolve();
            return;
        }

        const startTime = performance.now();
        let animationFrameId = null;
        const container = state.dom.handContainer;
        const frameDelay = state.animationFrameDelay ?? 0;
        let lastUpdateTime = startTime;

        let cardElements = Array.from(container.children);
        if (cardElements.length !== handSize) {
            container.replaceChildren();
            cardElements = [];
            for (let i = 0; i < handSize; i += 1) {
                const span = document.createElement("span");
                span.className = "poker-hand-card";
                container.appendChild(span);
                cardElements.push(span);
            }
        }

        const updateAnimation = (currentTime) => {
            const elapsed = currentTime - startTime;
            if (elapsed >= durationMs) {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                resolve();
                return;
            }

            const timeSinceLastUpdate = currentTime - lastUpdateTime;
            if (timeSinceLastUpdate >= frameDelay) {
                const randomCards = dealHandFromDeck(deck, handSize);
                if (randomCards.length === handSize) {
                    randomCards.forEach((card, index) => {
                        const element = cardElements[index];
                        if (!element) {
                            return;
                        }
                        let classes = "poker-hand-card";
                        if (card.color === "red") {
                            classes += " red";
                        }
                        classes += ` suit-${card.suitName}`;
                        if (element.className !== classes) {
                            element.className = classes;
                        }
                        const textContent = `${card.rank}${card.suit}`;
                        if (element.textContent !== textContent) {
                            element.textContent = textContent;
                        }
                    });
                }
                lastUpdateTime = currentTime;
            }

            animationFrameId = requestAnimationFrame(updateAnimation);
        };

        animationFrameId = requestAnimationFrame(updateAnimation);
    });
}

function collectActiveUpgradeFlags(state) {
    if (!state?.upgrades) {
        return new Set();
    }
    const flags = new Set();
    state.upgrades.forEach((upgrade) => {
        if (!upgrade || !Number.isFinite(upgrade.level) || upgrade.level <= 0) {
            return;
        }
        const optionFlag = typeof upgrade.options?.flag === "string" ? upgrade.options.flag : null;
        if (optionFlag) {
            flags.add(optionFlag);
        }
        if (typeof upgrade.id === "string" && upgrade.id) {
            flags.add(upgrade.id);
        }
    });
    return flags;
}

export async function handleDraw(state, options = {}) {
    if (!state) {
        return;
    }
    const isAutoDraw = options?.auto === true;
    const discardEngaged =
        state.deckDiscardActive === true || state.deckDiscardActivationRequested === true;

    if (discardEngaged) {
        if (!isAutoDraw && state.dom?.result) {
            state.dom.result.textContent = "finish discarding cards before drawing";
            state.dom.result.classList.remove("success");
            state.dom.result.classList.remove("fail");
        }
        return;
    }

    if (state.isAnimating || state.pendingDraw) {
        return;
    }

    const handSize = resolveHandSize(state);
    const deck = getCachedDeckCards(state);
    if (deck.length < handSize) {
        state.dom.result.textContent = `need at least ${handSize} cards in the deck`;
        state.dom.result.classList.remove("success");
        state.dom.result.classList.add("fail");
        if (state.autoDrawEnabled && typeof state.setAutoDrawEnabled === "function") {
            state.setAutoDrawEnabled(false);
        }
        return;
    }

    if (isAutoDraw) {
        const autoCost = getAutoDrawCost(state);
        if (autoCost > 0) {
            if (!canAffordBurnCards(autoCost) || !spendBurnCards(autoCost)) {
                disableAutoDueToBurnCardShortage(state, autoCost);
                return;
            }
        }
    }

    clearPendingDelete();

    state.isAnimating = true;
    state.pendingDraw = true;
    state.dom.button.disabled = true;

    try {
        await animateShuffle(state, state.animationDuration, handSize);

        const cards = dealHandFromDeck(deck, handSize);
        if (cards.length < handSize) {
            state.dom.result.textContent = `need at least ${handSize} cards in the deck`;
            state.dom.result.classList.remove("success");
            state.dom.result.classList.add("fail");
            if (state.autoDrawEnabled && typeof state.setAutoDrawEnabled === "function") {
                state.setAutoDrawEnabled(false);
            }
            return;
        }
        if (typeof state.setAutoDrawVisible === "function") {
            state.setAutoDrawVisible(true);
        }

        const evaluator = typeof state.evaluateHand === "function"
            ? state.evaluateHand
            : getDefaultDeckEvaluator();
        const upgradeFlags = collectActiveUpgradeFlags(state);
        const classification = evaluator(cards, handSize, {
            flags: upgradeFlags,
            flagList: [...upgradeFlags],
            upgrades: state.upgrades ?? [],
            state
        });
        const success = classification.id === state.config.target;

        removeCardsFromDeck(state, cards);

        let reachedTarget = false;
        let payout = 0;
        let diceAwarded = 0;
        let statusAwarded = 0;
        let burnCardAwarded = 0;
        const highlightIndices = success ? getHighlightIndices(classification, cards, handSize) : [];
        let rewardBreakdown = null;
        if (success) {
            state.streak += 1;
            const chipRewardMultiplier =
                Number.isFinite(state?.chipRewardMultiplier) && state.chipRewardMultiplier > 0
                    ? state.chipRewardMultiplier
                    : 1;
            const baseChipAmount = Number.isFinite(state.baseChipReward) ? state.baseChipReward : 0;
            const chipBaseAmount = baseChipAmount * chipRewardMultiplier;
            const chipRewardOptions = {
                baseAmount: chipBaseAmount,
                streak: state.streak,
                streakMultiplier: state.chipStreakMultiplier
            };
            const suitBonuses = calculateSuitBonusMultipliers(cards, highlightIndices, state);
            const chipBaseReward = calculateChipReward(chipRewardOptions);
            payout = awardChips({
                ...chipRewardOptions,
                baseAmount: chipBaseAmount * suitBonuses.chips.multiplier
            });
            const diceRewardMultiplier =
                Number.isFinite(state?.diceRewardMultiplier) && state.diceRewardMultiplier > 0
                    ? Math.max(1, Math.ceil(state.diceRewardMultiplier))
                    : 1;
            diceAwarded = awardDice(diceRewardMultiplier * suitBonuses.dice.multiplier);
            const statusBaseAmount = 1;
            statusAwarded = awardStatus(statusBaseAmount * suitBonuses.status.multiplier);
            const burnCardBaseAmount = state.streak;
            burnCardAwarded = awardBurnCards(burnCardBaseAmount * suitBonuses.burnCard.multiplier);
            rewardBreakdown = {
                chips: {
                    baseAmount: chipBaseReward,
                    finalAmount: payout,
                    suitCount: suitBonuses.chips.count,
                    suitSymbol: suitBonuses.chips.suitSymbol
                },
                dice: {
                    baseAmount: diceRewardMultiplier,
                    finalAmount: diceAwarded,
                    suitCount: suitBonuses.dice.count,
                    suitSymbol: suitBonuses.dice.suitSymbol
                },
                status: {
                    baseAmount: statusBaseAmount,
                    finalAmount: statusAwarded,
                    suitCount: suitBonuses.status.count,
                    suitSymbol: suitBonuses.status.suitSymbol
                },
                burnCard: {
                    baseAmount: burnCardBaseAmount,
                    finalAmount: burnCardAwarded,
                    suitCount: suitBonuses.burnCard.count,
                    suitSymbol: suitBonuses.burnCard.suitSymbol
                }
            };
            if (state.streak >= STREAK_TARGET) {
                reachedTarget = true;
                state.permanentlyCompleted = true;
                state.navButton.classList.add("completed");
            }
        } else {
            state.streak = 0;
            if (!state.permanentlyCompleted) {
                state.navButton.classList.remove("completed");
            }
        }

        if (!success || reachedTarget) {
            resetDeckToBaseline(state);
        } else {
            renderDeckGrid(state);
        }

        updateHandDisplay(state.dom.handContainer, cards, highlightIndices, handSize);

        const message = buildResultMessage({
            success,
            classification,
            permanentlyCompleted: state.permanentlyCompleted,
            payout,
            diceAwarded,
            statusAwarded,
            burnCardAwarded,
            rewardBreakdown
        });

        state.dom.result.innerHTML = message;
        state.dom.result.classList.toggle("success", success);
        state.dom.result.classList.toggle("fail", !success);
        updateStreakDisplay(state);
    } finally {
        state.isAnimating = false;
        state.pendingDraw = false;
        state.dom.button.disabled = false;
        fulfillPendingDiscardActivation(state);
        if (state.autoDrawEnabled) {
            scheduleNextAutoDraw(state);
        }
    }
}
