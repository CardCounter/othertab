import { MIN_DECK_CARD_COUNT } from "./config.js";
import {
    getDeckCardCountFromSlots,
    getSlotIndexFromTarget,
    invalidateDeckCache,
    snapshotDeckSlots,
    sortDeckState,
    updateDeckBaseline
} from "./deck-utils.js";
import { renderDeckGrid } from "./ui.js";
import { updateDiscardDisplay } from "./shop.js";

const discardMode = {
    state: null
};

function isDrawInProgress(state) {
    return state?.pendingDraw === true || state?.isAnimating === true;
}

function disableAutoDraw(state) {
    if (!state) {
        return;
    }
    if (state.autoDrawEnabled && typeof state.setAutoDrawEnabled === "function") {
        state.setAutoDrawEnabled(false);
    }
}

function finalizeDiscardActivation(state) {
    if (!state?.dom?.deckGrid) {
        return false;
    }
    if ((state.discards ?? 0) <= 0) {
        state.deckDiscardActivationRequested = false;
        updateDiscardDisplay(state);
        return false;
    }
    if (discardMode.state && discardMode.state !== state) {
        deactivateDiscardMode(discardMode.state);
    }
    discardMode.state = state;
    state.deckDiscardActivationRequested = false;
    setDeckDiscardActive(state, true);
    updateDiscardDisplay(state);
    return true;
}

function getDiscardButton(state) {
    return state?.dom?.cardShopDiscardButton ?? null;
}

function setDeckDiscardActive(state, active) {
    if (!state?.dom?.deckGrid) {
        return;
    }
    if (active) {
        state.dom.deckGrid.classList.add("deck-discard-active");
    } else {
        state.dom.deckGrid.classList.remove("deck-discard-active");
    }
    state.deckDiscardActive = active === true;
}

function activateDiscardMode(state) {
    if (!state?.dom?.deckGrid) {
        return;
    }
    if ((state.discards ?? 0) <= 0) {
        return;
    }
    state.deckDiscardActivationRequested = true;
    disableAutoDraw(state);
    const activated = fulfillPendingDiscardActivation(state);
    if (!activated && state.dom?.result) {
        state.dom.result.textContent = "discard mode will activate after the draw finishes";
        state.dom.result.classList.remove("success");
        state.dom.result.classList.remove("fail");
    }
}

function deactivateDiscardMode(state = discardMode.state) {
    if (!state) {
        return;
    }
    state.deckDiscardActivationRequested = false;
    setDeckDiscardActive(state, false);
    if (discardMode.state === state) {
        discardMode.state = null;
    }
    updateDiscardDisplay(state);
}

export function fulfillPendingDiscardActivation(state) {
    if (!state || state.deckDiscardActivationRequested !== true) {
        return false;
    }
    if (!state.dom?.deckGrid) {
        state.deckDiscardActivationRequested = false;
        return false;
    }
    if (isDrawInProgress(state)) {
        return false;
    }
    return finalizeDiscardActivation(state);
}

export function clearPendingDelete(state = discardMode.state) {
    deactivateDiscardMode(state);
}

export function resetDeckToBaseline(state) {
    if (!state?.deckBaselineSlots) {
        return;
    }
    clearPendingDelete(state);
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
    const activeState = discardMode.state;
    if (!activeState || activeState.deckDiscardActive !== true) {
        return;
    }
    const deckGrid = activeState.dom?.deckGrid ?? null;
    const discardButton = getDiscardButton(activeState);
    const target = event.target;
    if (deckGrid?.contains(target)) {
        return;
    }
    if (discardButton?.contains(target)) {
        return;
    }
    deactivateDiscardMode(activeState);
});

export function setupDeckManagement(state) {
    if (!state?.dom?.deckGrid) {
        return;
    }

    const grid = state.dom.deckGrid;
    const discardButton = getDiscardButton(state);
    const sortButton = state.dom?.cardShopSortButton ?? null;
    const sortAndRenderDeck = () => {
        sortDeckState(state);
        renderDeckGrid(state);
    };

    state.sortDeckAndRender = sortAndRenderDeck;
    setDeckDiscardActive(state, false);
    state.deckDiscardActivationRequested = false;
    if (discardMode.state === state) {
        discardMode.state = null;
    }

    renderDeckGrid(state);

    let dragOverSlot = null;
    let dragSourceButton = null;

    const clearDropTarget = () => {
        if (dragOverSlot == null) {
            return;
        }
        const cells = state.dom?.deckGridCells ?? null;
        const cell = Array.isArray(cells) ? cells[dragOverSlot] : null;
        if (cell) {
            cell.classList.remove("deck-drop-target");
        }
        dragOverSlot = null;
    };

    const setDropTarget = (slotIndex) => {
        if (dragOverSlot === slotIndex) {
            return;
        }
        clearDropTarget();
        if (slotIndex == null || slotIndex === state.dragSourceSlot) {
            return;
        }
        const cells = state.dom?.deckGridCells ?? null;
        const cell = Array.isArray(cells) ? cells[slotIndex] : null;
        if (cell) {
            cell.classList.add("deck-drop-target");
            dragOverSlot = slotIndex;
        }
    };

    const resetDragState = () => {
        clearDropTarget();
        state.dragSourceSlot = null;
        state.dragSourceIsDrawn = false;
        if (dragSourceButton) {
            dragSourceButton.classList.remove("deck-card-dragging");
            dragSourceButton.setAttribute("aria-grabbed", "false");
            dragSourceButton = null;
        }
        grid.classList.remove("deck-dragging");
    };

    const handleDragStart = (event) => {
        if (state.deckDiscardActive === true) {
            event.preventDefault();
            return;
        }
        if (state.isAnimating === true || state.pendingDraw === true) {
            event.preventDefault();
            return;
        }
        const button = event.target.closest(".deck-card");
        if (!button) {
            return;
        }
        const slotIndex = Number.parseInt(button.dataset.slot ?? "", 10);
        if (Number.isNaN(slotIndex)) {
            return;
        }
        const deckCard = Array.isArray(state.deckSlots)
            ? state.deckSlots[slotIndex]
            : null;
        if (!deckCard || deckCard.isDrawn === true) {
            event.preventDefault();
            return;
        }
        state.dragSourceSlot = slotIndex;
        state.dragSourceIsDrawn = deckCard.isDrawn === true;
        dragSourceButton = button;
        button.classList.add("deck-card-dragging");
        button.setAttribute("aria-grabbed", "true");
        grid.classList.add("deck-dragging");
        try {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", `${slotIndex}`);
        } catch (error) {
            // ignore dataTransfer errors (e.g. unsupported browsers)
        }
    };

    const handleDragEnd = () => {
        resetDragState();
    };

    const handleDragOver = (event) => {
        if (state.dragSourceSlot == null) {
            return;
        }
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
        const targetSlot = getSlotIndexFromTarget(event.target);
        setDropTarget(targetSlot);
    };

    const handleDragLeave = (event) => {
        if (state.dragSourceSlot == null) {
            return;
        }
        if (!grid.contains(event.relatedTarget)) {
            setDropTarget(null);
        }
    };

    const handleDrop = (event) => {
        if (state.dragSourceSlot == null) {
            return;
        }
        event.preventDefault();
        const sourceSlot = state.dragSourceSlot;
        const targetSlot = getSlotIndexFromTarget(event.target);
        if (targetSlot == null || sourceSlot === targetSlot) {
            resetDragState();
            return;
        }
        const deck = Array.isArray(state.deckSlots) ? state.deckSlots : [];
        const sourceCard = deck[sourceSlot] ?? null;
        const targetCard = deck[targetSlot] ?? null;
        if (!sourceCard || sourceCard.isDrawn === true) {
            resetDragState();
            return;
        }
        deck[sourceSlot] = targetCard ?? null;
        deck[targetSlot] = sourceCard;
        invalidateDeckCache(state);
        updateDeckBaseline(state);
        resetDragState();
        renderDeckGrid(state);
    };

    if (grid.dataset.deckDragHandlersAttached !== "true") {
        grid.addEventListener("dragstart", handleDragStart);
        grid.addEventListener("dragend", handleDragEnd);
        grid.addEventListener("dragover", handleDragOver);
        grid.addEventListener("drop", handleDrop);
        grid.addEventListener("dragleave", handleDragLeave);
        grid.dataset.deckDragHandlersAttached = "true";
    }

    const handleDeckCardClick = (event) => {
        const card = event.target.closest(".deck-card");
        if (!card) {
            return;
        }
        const slot = Number.parseInt(card.dataset.slot ?? "", 10);
        if (Number.isNaN(slot)) {
            return;
        }
        const cardObj =
            state.deckSlots?.[slot] ?? state.deckBaselineSlots?.[slot] ?? null;
        if (!cardObj || cardObj.isDrawn === true) {
            return;
        }

        if (state.deckDiscardActive !== true) {
            return;
        }

        const deckCount = getDeckCardCountFromSlots(state.deckSlots);
        const availableDiscards = state.discards ?? 0;

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
            deactivateDiscardMode(state);
            return;
        }

        state.deckSlots[slot] = null;
        if (
            Array.isArray(state.deckBaselineSlots) &&
            slot < state.deckBaselineSlots.length
        ) {
            state.deckBaselineSlots[slot] = null;
        }
        state.discards = availableDiscards - 1;

        if (state.dom?.result) {
            state.dom.result.textContent = "";
            state.dom.result.classList.remove("fail");
            state.dom.result.classList.remove("success");
        }

        invalidateDeckCache(state);
        updateDeckBaseline(state);
        renderDeckGrid(state);

        if ((state.discards ?? 0) > 0) {
            updateDiscardDisplay(state);
        } else {
            deactivateDiscardMode(state);
        }
    };

    if (grid.dataset.deckDiscardHandlerAttached !== "true") {
        grid.addEventListener("click", handleDeckCardClick);
        grid.dataset.deckDiscardHandlerAttached = "true";
    }

    if (discardButton && discardButton.dataset.deckDiscardButtonAttached !== "true") {
        discardButton.addEventListener("click", (event) => {
            event.preventDefault();
            if ((state.discards ?? 0) <= 0) {
                if (state.dom?.result) {
                    state.dom.result.textContent = "no discards available";
                    state.dom.result.classList.remove("success");
                    state.dom.result.classList.add("fail");
                }
                updateDiscardDisplay(state);
                return;
            }
            const discardEngaged =
                state.deckDiscardActive === true || state.deckDiscardActivationRequested === true;
            if (discardEngaged) {
                deactivateDiscardMode(state);
            } else {
                activateDiscardMode(state);
            }
        });
        discardButton.dataset.deckDiscardButtonAttached = "true";
    }

    if (sortButton && sortButton.dataset.deckSortButtonAttached !== "true") {
        sortButton.addEventListener("click", (event) => {
            event.preventDefault();
            sortAndRenderDeck();
            deactivateDiscardMode(state);
        });
        sortButton.dataset.deckSortButtonAttached = "true";
    }
}
