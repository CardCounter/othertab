import { STREAK_TARGET } from "./config.js";
import {
    drawHandFromDeck,
    getCachedDeckCards,
    removeCardsFromDeck
} from "./deck-utils.js";
import {
    buildResultMessage,
    getHighlightIndices
} from "./hand-evaluation.js";
import { clearPendingDelete, resetDeckToBaseline } from "./deck-management.js";
import { renderDeckGrid, updateHandDisplay } from "./ui.js";
import { awardChips } from "./chips.js";
import { awardDice } from "./dice.js";
import { getDefaultDeckEvaluator } from "./evaluators/index.js";

function scheduleNextAutoDraw(state) {
    if (!state?.autoDrawEnabled || state.autoDrawScheduled) {
        return;
    }
    state.autoDrawScheduled = true;
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
        handleDraw(state);
    }, 0);
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
                const randomCards = drawHandFromDeck(deck, handSize);
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

export async function handleDraw(state) {
    if (!state) {
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

    clearPendingDelete();

    state.isAnimating = true;
    state.pendingDraw = true;
    state.dom.button.disabled = true;

    try {
        await animateShuffle(state, state.animationDuration, handSize);

        const cards = drawHandFromDeck(deck, handSize);
        if (cards.length < handSize) {
            state.dom.result.textContent = `need at least ${handSize} cards in the deck`;
            state.dom.result.classList.remove("success");
            state.dom.result.classList.add("fail");
            if (state.autoDrawEnabled && typeof state.setAutoDrawEnabled === "function") {
                state.setAutoDrawEnabled(false);
            }
            return;
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
        if (success) {
            state.streak += 1;
            const chipRewardMultiplier =
                Number.isFinite(state?.chipRewardMultiplier) && state.chipRewardMultiplier > 0
                    ? state.chipRewardMultiplier
                    : 1;
            const baseChipAmount = Number.isFinite(state.baseChipReward) ? state.baseChipReward : 0;
            payout = awardChips({
                baseAmount: baseChipAmount * chipRewardMultiplier,
                streak: state.streak,
                streakMultiplier: state.chipStreakMultiplier
            });
            const diceRewardMultiplier =
                Number.isFinite(state?.diceRewardMultiplier) && state.diceRewardMultiplier > 0
                    ? Math.max(1, Math.ceil(state.diceRewardMultiplier))
                    : 1;
            diceAwarded = awardDice(diceRewardMultiplier);
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

        const highlightIndices = success ? getHighlightIndices(classification, cards, handSize) : [];
        updateHandDisplay(state.dom.handContainer, cards, highlightIndices, handSize);

        const message = buildResultMessage({
            success,
            classification,
            streak: state.streak,
            permanentlyCompleted: state.permanentlyCompleted,
            payout,
            diceAwarded
        });

        state.dom.result.textContent = message;
        state.dom.result.classList.toggle("success", success);
        state.dom.result.classList.toggle("fail", !success);
    } finally {
        state.isAnimating = false;
        state.pendingDraw = false;
        state.dom.button.disabled = false;
        if (state.autoDrawEnabled) {
            scheduleNextAutoDraw(state);
        }
    }
}
