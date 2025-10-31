import { MIN_DECK_CARD_COUNT, TOTAL_MAIN_SLOTS, TOTAL_SLOTS, CARDS_PER_ROW } from "./config.js";
import {
    getDeckCardCountFromSlots,
    getDeckCardsFromSlots,
    getSlotIndexFromTarget,
    invalidateDeckCache,
    createDeckSlotsFromCards,
    moveCardInSlots,
    snapshotDeckSlots,
    sortDeckCards,
    updateDeckBaseline,
    getSlotIndexForCard
} from "./deck-utils.js";
import { renderDeckGrid } from "./ui.js";
import { updateDiscardDisplay } from "./shop.js";

let activeDeckDelete = null;

export function clearPendingDelete() {
    if (!activeDeckDelete) {
        return;
    }
    const { element } = activeDeckDelete;
    if (element?.isConnected) {
        element.classList.remove("delete-pending");
    }
    activeDeckDelete = null;
}

function setPendingDelete(state, element, slot) {
    if (!state || !element) {
        return;
    }
    clearPendingDelete();
    element.classList.add("delete-pending");
    activeDeckDelete = { state, element, slot };
}

export function resetDeckToBaseline(state) {
    if (!state?.deckBaselineSlots) {
        return;
    }
    state.deckSlots = snapshotDeckSlots(state.deckBaselineSlots);
    state.deckSlots.forEach((card) => {
        if (card) {
            card.isDrawn = false;
        }
    });
    if (Array.isArray(state.deckBaselineSlots)) {
        state.deckBaselineSlots.forEach((card) => {
            if (card) {
                card.isDrawn = false;
            }
        });
    }
    invalidateDeckCache(state);
    renderDeckGrid(state);
}

document.addEventListener("click", (event) => {
    if (!activeDeckDelete) {
        return;
    }
    const { state } = activeDeckDelete;
    if (!state?.dom?.deckGrid?.contains(event.target)) {
        clearPendingDelete();
    }
});

export function setupDeckManagement(state) {
    if (!state?.dom?.deckGrid) {
        return;
    }

    const grid = state.dom.deckGrid;
    state.dragSourceSlot = null;
    state.dragSourceIsDrawn = false;

    renderDeckGrid(state);

    if (state.dom.sortButton) {
        state.dom.sortButton.addEventListener("click", () => {
            clearPendingDelete();
            const slotCount = Array.isArray(state.deckSlots)
                ? state.deckSlots.length
                : TOTAL_SLOTS;
            const newDeckSlots = Array(slotCount).fill(null);
            
            // identify slots occupied by drawn cards (cards in baseline but not in deck at that position)
            const drawnCardSlots = new Set();
            if (Array.isArray(state.deckBaselineSlots) && Array.isArray(state.deckSlots)) {
                state.deckBaselineSlots.forEach((baselineCard, index) => {
                    if (!baselineCard || index >= TOTAL_MAIN_SLOTS) {
                        return;
                    }
                    const deckCard = state.deckSlots[index];
                    // if card is in baseline but not in deck at this position, it's drawn
                    if (baselineCard !== deckCard) {
                        // check if the card exists elsewhere in deckSlots
                        const existsElsewhere = state.deckSlots.some(
                            (card) => card === baselineCard
                        );
                        if (!existsElsewhere) {
                            drawnCardSlots.add(index);
                            // keep the slot empty (drawn cards stay in baseline only)
                        }
                    }
                });
            }
            
            // get all cards currently in deckSlots (non-drawn cards)
            const deckCards = getDeckCardsFromSlots(state.deckSlots);
            const sortedCards = sortDeckCards(deckCards);
            
            const isBlocked = (index) => drawnCardSlots.has(index);
            
            // step 1: place cards at preferred positions
            const usedSlots = new Set();
            const cardsToPlace = [];
            
            sortedCards.forEach((card) => {
                const preferredIndex = getSlotIndexForCard(card);
                if (
                    preferredIndex != null &&
                    preferredIndex < TOTAL_MAIN_SLOTS &&
                    preferredIndex < slotCount &&
                    !isBlocked(preferredIndex) &&
                    !usedSlots.has(preferredIndex)
                ) {
                    newDeckSlots[preferredIndex] = card;
                    usedSlots.add(preferredIndex);
                } else {
                    cardsToPlace.push(card);
                }
            });
            
            // step 2: place remaining cards (duplicates) in first available slots
            let nextSlot = 0;
            cardsToPlace.forEach((card) => {
                while (nextSlot < slotCount) {
                    if (
                        !isBlocked(nextSlot) &&
                        !usedSlots.has(nextSlot) &&
                        newDeckSlots[nextSlot] === null
                    ) {
                        newDeckSlots[nextSlot] = card;
                        usedSlots.add(nextSlot);
                        nextSlot += 1;
                        break;
                    }
                    nextSlot += 1;
                }
            });
            
            // step 3: compact empty slots to the end while preserving preferred positions
            // collect all cards in order
            const allCards = [];
            for (let i = 0; i < slotCount; i += 1) {
                if (i < TOTAL_MAIN_SLOTS && isBlocked(i)) {
                    continue;
                }
                if (newDeckSlots[i] !== null) {
                    allCards.push({
                        card: newDeckSlots[i],
                        preferredIndex: getSlotIndexForCard(newDeckSlots[i])
                    });
                }
            }
            
            // clear all non-blocked slots
            for (let i = 0; i < slotCount; i += 1) {
                if (i < TOTAL_MAIN_SLOTS && isBlocked(i)) {
                    continue;
                }
                newDeckSlots[i] = null;
            }
            
            // place cards back: preferred positions first, then compact remaining
            const finalUsed = new Set();
            const remaining = [];
            
            allCards.forEach(({ card, preferredIndex }) => {
                if (
                    preferredIndex != null &&
                    preferredIndex < TOTAL_MAIN_SLOTS &&
                    preferredIndex < slotCount &&
                    !isBlocked(preferredIndex) &&
                    !finalUsed.has(preferredIndex)
                ) {
                    newDeckSlots[preferredIndex] = card;
                    finalUsed.add(preferredIndex);
                } else {
                    remaining.push(card);
                }
            });
            
            // fill remaining slots compactly from start
            let fillIndex = 0;
            remaining.forEach((card) => {
                while (fillIndex < slotCount) {
                    if (
                        !isBlocked(fillIndex) &&
                        !finalUsed.has(fillIndex) &&
                        newDeckSlots[fillIndex] === null
                    ) {
                        newDeckSlots[fillIndex] = card;
                        finalUsed.add(fillIndex);
                        fillIndex += 1;
                        break;
                    }
                    fillIndex += 1;
                }
            });
            
            state.deckSlots = newDeckSlots;
            invalidateDeckCache(state);
            updateDeckBaseline(state);
            renderDeckGrid(state);
        });
    }

    grid.addEventListener("dragstart", (event) => {
        const card = event.target.closest(".deck-card");
        if (!card) {
            return;
        }
        const slot = Number.parseInt(card.dataset.slot ?? "", 10);
        if (Number.isNaN(slot)) {
            return;
        }
        if (slot >= TOTAL_MAIN_SLOTS) {
            event.preventDefault();
            return;
        }
        clearPendingDelete();
        state.dragSourceSlot = slot;
        const cardObj = state.deckSlots?.[slot] ?? state.deckBaselineSlots?.[slot] ?? null;
        state.dragSourceIsDrawn = cardObj?.isDrawn === true;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${slot}`);
    });

    grid.addEventListener("dragend", (event) => {
        const card = event.target.closest(".deck-card");
        if (card) {
            card.classList.remove("dragging");
        }
        if (state.dragSourceSlot != null) {
            renderDeckGrid(state);
        }
        state.dragSourceSlot = null;
        state.dragSourceIsDrawn = false;
    });

    grid.addEventListener("dragover", (event) => {
        if (state.dragSourceSlot == null) {
            return;
        }
        const toSlot = getSlotIndexFromTarget(event.target);
        if (toSlot != null && toSlot >= TOTAL_MAIN_SLOTS) {
            event.dataTransfer.dropEffect = "none";
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });

    grid.addEventListener("drop", (event) => {
        if (state.dragSourceSlot == null) {
            return;
        }
        event.preventDefault();
        const fromSlot = state.dragSourceSlot;
        const toSlot = getSlotIndexFromTarget(event.target);
        clearPendingDelete();
        if (toSlot != null && toSlot !== fromSlot && toSlot < TOTAL_MAIN_SLOTS) {
            const isDrawn = state.dragSourceIsDrawn;
            if (isDrawn) {
                moveCardInSlots(state.deckBaselineSlots, fromSlot, toSlot);
            } else {
                moveCardInSlots(state.deckSlots, fromSlot, toSlot);
                invalidateDeckCache(state);
                updateDeckBaseline(state);
            }
            renderDeckGrid(state);
        }
        state.dragSourceSlot = null;
        state.dragSourceIsDrawn = false;
    });

    grid.addEventListener("click", (event) => {
        const card = event.target.closest(".deck-card");
        if (!card) {
            return;
        }
        const slot = Number.parseInt(card.dataset.slot ?? "", 10);
        if (Number.isNaN(slot)) {
            return;
        }
        const cardObj = state.deckSlots?.[slot] ?? state.deckBaselineSlots?.[slot] ?? null;
        if (cardObj?.isDrawn === true) {
            return;
        }

        const deckCount = getDeckCardCountFromSlots(state.deckSlots);
        const availableDiscards = state.discards ?? 0;

        if (card.classList.contains("delete-pending")) {
            if (deckCount <= MIN_DECK_CARD_COUNT) {
                clearPendingDelete();
                state.dom.result.textContent = "deck must keep at least 45 cards";
                state.dom.result.classList.remove("success");
                state.dom.result.classList.add("fail");
                return;
            }
            if (availableDiscards <= 0) {
                clearPendingDelete();
                state.dom.result.textContent = "no discards available";
                state.dom.result.classList.remove("success");
                state.dom.result.classList.add("fail");
                return;
            }
            clearPendingDelete();
            state.deckSlots[slot] = null;
            if (Array.isArray(state.deckBaselineSlots) && slot < state.deckBaselineSlots.length) {
                state.deckBaselineSlots[slot] = null;
            }
            state.discards = availableDiscards - 1;
            invalidateDeckCache(state);
            renderDeckGrid(state);
            updateDiscardDisplay(state);
            return;
        }

        if (deckCount <= MIN_DECK_CARD_COUNT) {
            state.dom.result.textContent = "deck must keep at least 45 cards";
            state.dom.result.classList.remove("success");
            state.dom.result.classList.add("fail");
            return;
        }

        if (availableDiscards <= 0) {
            state.dom.result.textContent = "no discards available";
            state.dom.result.classList.remove("success");
            state.dom.result.classList.add("fail");
            return;
        }

        setPendingDelete(state, card, slot);
    });
}
