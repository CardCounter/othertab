import { HAND_SIZE, STREAK_TARGET } from "./config.js";
import {
    drawHandFromDeck,
    getCachedDeckCards,
    removeCardsFromDeck
} from "./deck-utils.js";
import {
    buildResultMessage,
    classifyHand,
    getHighlightIndices
} from "./hand-evaluation.js";
import { clearPendingDelete, resetDeckToBaseline } from "./deck-management.js";
import { renderDeckGrid, updateHandDisplay } from "./ui.js";
import { awardChips } from "./chips.js";

function animateShuffle(state, durationMs) {
    return new Promise((resolve) => {
        if (!state || durationMs <= 0) {
            resolve();
            return;
        }

        const deck = getCachedDeckCards(state);
        if (deck.length < HAND_SIZE) {
            resolve();
            return;
        }

        const startTime = performance.now();
        let animationFrameId = null;
        const container = state.dom.handContainer;
        const frameDelay = state.animationFrameDelay ?? 0;
        let lastUpdateTime = startTime;

        let cardElements = Array.from(container.children);
        if (cardElements.length !== HAND_SIZE) {
            container.replaceChildren();
            cardElements = [];
            for (let i = 0; i < HAND_SIZE; i += 1) {
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
                const randomCards = drawHandFromDeck(deck, HAND_SIZE);
                if (randomCards.length === HAND_SIZE) {
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

export async function handleDraw(state) {
    if (!state) {
        return;
    }

    if (state.isAnimating || state.pendingDraw) {
        return;
    }

    const deck = getCachedDeckCards(state);
    if (deck.length < HAND_SIZE) {
        state.dom.result.textContent = "need at least five cards in the deck";
        state.dom.result.classList.remove("success");
        state.dom.result.classList.add("fail");
        return;
    }

    clearPendingDelete();

    state.isAnimating = true;
    state.pendingDraw = true;
    state.dom.button.disabled = true;

    try {
        await animateShuffle(state, state.animationDuration);

        const cards = drawHandFromDeck(deck, HAND_SIZE);
        if (cards.length < HAND_SIZE) {
            state.dom.result.textContent = "need at least five cards in the deck";
            state.dom.result.classList.remove("success");
            state.dom.result.classList.add("fail");
            return;
        }

        const classification = classifyHand(cards);
        const success = classification.id === state.config.target;

        removeCardsFromDeck(state, cards);

        let reachedTarget = false;
        if (success) {
            state.streak += 1;
            awardChips({
                baseAmount: state.baseChipReward,
                streak: state.streak,
                streakMultiplier: state.chipStreakMultiplier
            });
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

        const highlightIndices = success ? getHighlightIndices(cards, classification.id) : [];
        updateHandDisplay(state.dom.handContainer, cards, highlightIndices);

        const message = buildResultMessage({
            success,
            classification,
            streak: state.streak,
            permanentlyCompleted: state.permanentlyCompleted
        });

        state.dom.result.textContent = message;
        state.dom.result.classList.toggle("success", success);
        state.dom.result.classList.toggle("fail", !success);
    } finally {
        state.isAnimating = false;
        state.pendingDraw = false;
        state.dom.button.disabled = false;
    }
}
