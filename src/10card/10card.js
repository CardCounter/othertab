const STREAK_TARGET = 10;
const HAND_SIZE = 5;
const RANKS = [
    { symbol: "2", value: 2, name: "two" },
    { symbol: "3", value: 3, name: "three" },
    { symbol: "4", value: 4, name: "four" },
    { symbol: "5", value: 5, name: "five" },
    { symbol: "6", value: 6, name: "six" },
    { symbol: "7", value: 7, name: "seven" },
    { symbol: "8", value: 8, name: "eight" },
    { symbol: "9", value: 9, name: "nine" },
    { symbol: "10", value: 10, name: "ten" },
    { symbol: "J", value: 11, name: "jack" },
    { symbol: "Q", value: 12, name: "queen" },
    { symbol: "K", value: 13, name: "king" },
    { symbol: "A", value: 14, name: "ace" }
];

const SUITS = [
    { symbol: "♠", name: "spades", color: "black" },
    { symbol: "♣", name: "clubs", color: "black" },
    { symbol: "♥", name: "hearts", color: "red" },
    { symbol: "♦", name: "diamonds", color: "red" }
];

const SUIT_DISPLAY_ORDER = ["♠", "♥", "♣", "♦"];
const RANK_DISPLAY_ORDER = [...RANKS].slice().reverse().map((rank) => rank.symbol);
const SUIT_ORDER_INDEX = new Map(SUIT_DISPLAY_ORDER.map((suit, index) => [suit, index]));
const RANK_ORDER_INDEX = new Map(RANK_DISPLAY_ORDER.map((symbol, index) => [symbol, index]));
const CARDS_PER_ROW = RANK_DISPLAY_ORDER.length;
const EXTRA_BOTTOM_SLOTS = 8;
const TOTAL_MAIN_SLOTS = SUIT_DISPLAY_ORDER.length * CARDS_PER_ROW;
const TOTAL_SLOTS = TOTAL_MAIN_SLOTS + EXTRA_BOTTOM_SLOTS;

const HAND_LABELS = {
    high_card: "high card",
    pair: "pair",
    two_pair: "two pair",
    three_kind: "three of a kind",
    straight: "straight",
    flush: "flush",
    full_house: "full house",
    four_kind: "four of a kind",
    straight_flush: "straight flush",
    royal_flush: "royal flush"
};

const DECKS = [
    {
        id: "high_card",
        title: "high card deck",
        subtitle: "draw ten pure high card hands.",
        target: "high_card",
        successNoun: "high cards"
    },
    {
        id: "pair",
        title: "pair deck",
        subtitle: "collect ten pairs back to back.",
        target: "pair",
        successNoun: "pairs"
    },
    {
        id: "two_pair",
        title: "two pair deck",
        subtitle: "double up ten times in a row.",
        target: "two_pair",
        successNoun: "two pairs"
    },
    {
        id: "three_kind",
        title: "three of a kind deck",
        subtitle: "triplets only, ten consecutive hits.",
        target: "three_kind",
        successNoun: "three of a kind hands"
    },
    {
        id: "straight",
        title: "straight deck",
        subtitle: "line up ten straights without slipping.",
        target: "straight",
        successNoun: "straights"
    },
    {
        id: "flush",
        title: "flush deck",
        subtitle: "ten flushes or the streak resets.",
        target: "flush",
        successNoun: "flushes"
    },
    {
        id: "full_house",
        title: "full house deck",
        subtitle: "stack ten full houses in order.",
        target: "full_house",
        successNoun: "full houses"
    },
    {
        id: "four_kind",
        title: "four of a kind deck",
        subtitle: "four of a kind, ten times straight.",
        target: "four_kind",
        successNoun: "four of a kind hands"
    },
    {
        id: "straight_flush",
        title: "straight flush deck",
        subtitle: "ten straight flushes before you blink.",
        target: "straight_flush",
        successNoun: "straight flushes"
    },
    {
        id: "royal_flush",
        title: "royal flush deck",
        subtitle: "ten royal flushes. perfection only.",
        target: "royal_flush",
        successNoun: "royal flushes"
    }
];

function createStandardDeck() {
    const deck = [];
    RANKS.forEach((rank) => {
        SUITS.forEach((suit) => {
            deck.push({
                rank: rank.symbol,
                value: rank.value,
                rankName: rank.name,
                suit: suit.symbol,
                suitName: suit.name,
                color: suit.color,
                label: `${rank.name} of ${suit.name}`
            });
        });
    });
    return deck;
}

function createRankFilteredDeck(allowedRanks) {
    const rankSet = new Set(allowedRanks);
    return createStandardDeck().filter((card) => rankSet.has(card.rank));
}

function createSuitFilteredDeck(allowedSuits, allowedRanks = RANKS.map((rank) => rank.symbol)) {
    const suitSet = new Set(Array.isArray(allowedSuits) ? allowedSuits : [allowedSuits]);
    const rankSet = new Set(allowedRanks);
    return createStandardDeck().filter(
        (card) => suitSet.has(card.suit) && rankSet.has(card.rank)
    );
}

function sortDeckCards(cards) {
    return [...cards].sort((a, b) => {
        const suitA = SUIT_ORDER_INDEX.get(a.suit) ?? Number.MAX_SAFE_INTEGER;
        const suitB = SUIT_ORDER_INDEX.get(b.suit) ?? Number.MAX_SAFE_INTEGER;
        if (suitA !== suitB) {
            return suitA - suitB;
        }
        const rankA = RANK_ORDER_INDEX.get(a.rank) ?? Number.MAX_SAFE_INTEGER;
        const rankB = RANK_ORDER_INDEX.get(b.rank) ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
    });
}

function getSlotIndexForCard(card) {
    const suitIndex = card?.suit ? SUIT_ORDER_INDEX.get(card.suit) : undefined;
    const rankIndex = card?.rank ? RANK_ORDER_INDEX.get(card.rank) : undefined;
    if (suitIndex == null || rankIndex == null) {
        return null;
    }
    return suitIndex * CARDS_PER_ROW + rankIndex;
}

function createDeckSlotsFromCards(cards) {
    const slots = Array(TOTAL_SLOTS).fill(null);
    cards.forEach((card) => {
        const slotIndex = getSlotIndexForCard(card);
        if (slotIndex == null) {
            const fallbackIndex = slots.findIndex((entry) => entry === null);
            if (fallbackIndex !== -1) {
                slots[fallbackIndex] = card;
            }
            return;
        }
        if (slots[slotIndex]) {
            const fallbackIndex = slots.findIndex((entry, index) => entry === null && index !== slotIndex);
            if (fallbackIndex !== -1) {
                slots[fallbackIndex] = card;
            }
            return;
        }
        slots[slotIndex] = card;
    });
    return slots;
}

function getDeckCardsFromSlots(slots) {
    return slots.filter((card) => card);
}

function getCachedDeckCards(state) {
    if (!state._cachedDeckArray) {
        state._cachedDeckArray = getDeckCardsFromSlots(state.deckSlots);
    }
    return state._cachedDeckArray;
}

function invalidateDeckCache(state) {
    if (state) {
        state._cachedDeckArray = null;
    }
}

function getDeckCardCountFromSlots(slots) {
    return slots.reduce((count, card) => (card ? count + 1 : count), 0);
}

function getSlotIndexFromTarget(target) {
    if (!target) {
        return null;
    }
    const slotEl = target.closest("[data-slot]");
    if (!slotEl) {
        return null;
    }
    const slotIndex = Number.parseInt(slotEl.dataset.slot ?? "", 10);
    if (Number.isNaN(slotIndex)) {
        return null;
    }
    return slotIndex;
}

function getInitialDeckForChallenge(deckId) {
    return sortDeckCards(createStandardDeck());
}

function drawHandFromDeck(deck, handSize = HAND_SIZE) {
    if (!Array.isArray(deck) || deck.length < handSize) {
        return [];
    }
    const pool = [...deck];
    const hand = [];
    for (let i = 0; i < handSize; i += 1) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        hand.push(pool[randomIndex]);
        pool[randomIndex] = pool[pool.length - 1];
        pool.pop();
    }
    return hand;
}

function isStraight(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const unique = [...new Set(sorted)];
    if (unique.length !== 5) {
        return { straight: false, high: null };
    }
    const first = unique[0];
    const expected = Array.from({ length: 5 }, (_, index) => first + index);
    const matches = expected.every((value, index) => value === unique[index]);
    if (matches) {
        return { straight: true, high: unique[4] };
    }
    const wheel = [2, 3, 4, 5, 14];
    const isWheel = wheel.every((value, index) => unique[index] === value);
    if (isWheel) {
        return { straight: true, high: 5 };
    }
    return { straight: false, high: null };
}

function classifyHand(cards) {
    const suits = cards.map((card) => card.suit);
    const values = cards.map((card) => card.value);
    const flush = suits.every((suit) => suit === suits[0]);
    const { straight, high } = isStraight(values);

    const counts = new Map();
    values.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    const countValues = Array.from(counts.values()).sort((a, b) => b - a);

    if (straight && flush) {
        if (high === 14) {
            return { id: "royal_flush", label: HAND_LABELS.royal_flush };
        }
        return { id: "straight_flush", label: HAND_LABELS.straight_flush };
    }

    if (countValues[0] === 4) {
        return { id: "four_kind", label: HAND_LABELS.four_kind };
    }

    if (countValues[0] === 3 && countValues[1] === 2) {
        return { id: "full_house", label: HAND_LABELS.full_house };
    }

    if (flush) {
        return { id: "flush", label: HAND_LABELS.flush };
    }

    if (straight) {
        return { id: "straight", label: HAND_LABELS.straight };
    }

    if (countValues[0] === 3) {
        return { id: "three_kind", label: HAND_LABELS.three_kind };
    }

    if (countValues[0] === 2) {
        const pairCount = countValues.filter((count) => count === 2).length;
        if (pairCount === 2) {
            return { id: "two_pair", label: HAND_LABELS.two_pair };
        }
        return { id: "pair", label: HAND_LABELS.pair };
    }

    return { id: "high_card", label: HAND_LABELS.high_card };
}

function createHandCardElement(card, highlighted) {
    const span = document.createElement("span");
    const classes = ["poker-hand-card"];
    if (card.color === "red") {
        classes.push("red");
    }
    classes.push(`suit-${card.suitName}`);
    if (highlighted) {
        classes.push("scoring");
    }
    span.className = classes.join(" ");
    span.textContent = `${card.rank}${card.suit}`;
    span.title = card.label;
    return span;
}

function createDeckElement(config) {
    const root = document.createElement("article");
    root.className = "poker-card";
    root.dataset.hand = config.id;
    root.id = `${config.id}-deck`;

    const row = document.createElement("div");
    row.className = "poker-row";

    const button = document.createElement("button");
    button.className = "poker-button";
    button.type = "button";
    button.textContent = "draw hand";

    const handContainer = document.createElement("div");
    handContainer.className = "poker-hand";
    handContainer.setAttribute("aria-live", "polite");

    row.append(button, handContainer);

    const result = document.createElement("p");
    result.className = "poker-result";
    result.setAttribute("aria-live", "polite");
    result.textContent = "";

    const managementSection = document.createElement("section");
    managementSection.className = "poker-card-management";

    const deckColumn = document.createElement("div");
    deckColumn.className = "deck-column";

    const deckGrid = document.createElement("div");
    deckGrid.className = "deck-grid";
    deckGrid.setAttribute("role", "list");
    deckGrid.setAttribute("aria-label", "deck cards");

    const sortButton = document.createElement("button");
    sortButton.type = "button";
    sortButton.className = "deck-sort-button";
    sortButton.textContent = "sort deck";

    const cardShop = document.createElement("div");
    cardShop.className = "card-shop";
    cardShop.textContent = "card shop";

    deckColumn.append(deckGrid, cardShop);

    const upgradeColumn = document.createElement("div");
    upgradeColumn.className = "upgrade-column";
    upgradeColumn.textContent = "upgrades";

    managementSection.append(deckColumn, upgradeColumn);

    root.append(row, result, managementSection);

    return {
        root,
        button,
        handContainer,
        result,
        deckGrid,
        sortButton,
        cardShop,
        upgradeColumn
    };
}

function buildDeckCardClasses(card) {
    const classes = ["deck-card", `suit-${card.suitName}`];
    if (card.color === "red") {
        classes.push("red");
    }
    return classes.join(" ");
}

function moveCardInSlots(slots, fromSlot, toSlot) {
    if (
        !Array.isArray(slots) ||
        fromSlot === toSlot ||
        fromSlot == null ||
        toSlot == null ||
        fromSlot < 0 ||
        toSlot < 0 ||
        fromSlot >= slots.length ||
        toSlot >= slots.length
    ) {
        return;
    }
    const fromCard = slots[fromSlot];
    if (!fromCard) {
        return;
    }
    const toCard = slots[toSlot] ?? null;
    slots[toSlot] = fromCard;
    slots[fromSlot] = toCard;
}

function renderDeckGrid(state) {
    if (!state?.dom?.deckGrid) {
        return;
    }

    const fragment = document.createDocumentFragment();
    for (let suitIndex = 0; suitIndex < SUIT_DISPLAY_ORDER.length; suitIndex += 1) {
        for (let rankIndex = 0; rankIndex < CARDS_PER_ROW; rankIndex += 1) {
            const slotIndex = suitIndex * CARDS_PER_ROW + rankIndex;
            const card = state.deckSlots?.[slotIndex] ?? null;
            const cell = document.createElement("div");
            cell.className = "deck-cell";
            cell.dataset.slot = `${slotIndex}`;
            if (card) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = buildDeckCardClasses(card);
                button.textContent = `${card.rank}${card.suit}`;
                button.title = card.label;
                button.dataset.slot = `${slotIndex}`;
                button.draggable = true;
                cell.classList.add("has-card");
                cell.append(button);
            } else {
                cell.classList.add("deck-slot");
            }
            fragment.append(cell);
        }
    }

    for (let extraIndex = 0; extraIndex < EXTRA_BOTTOM_SLOTS; extraIndex += 1) {
        const slotIndex = TOTAL_MAIN_SLOTS + extraIndex;
        const card = state.deckSlots?.[slotIndex] ?? null;
        const cell = document.createElement("div");
        cell.className = "deck-cell";
        cell.dataset.slot = `${slotIndex}`;
        if (card) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = buildDeckCardClasses(card);
            button.textContent = `${card.rank}${card.suit}`;
            button.title = card.label;
            button.dataset.slot = `${slotIndex}`;
            button.draggable = true;
            cell.classList.add("has-card");
            cell.append(button);
        } else {
            cell.classList.add("deck-slot");
        }
        fragment.append(cell);
    }

    if (state.dom.sortButton) {
        const sortButton = state.dom.sortButton;
        const startCol = RANK_DISPLAY_ORDER.indexOf("6") + 1;
        const endCol = RANK_DISPLAY_ORDER.indexOf("2") + 2;
        const actionCell = document.createElement("div");
        actionCell.className = "deck-cell deck-action-cell";
        actionCell.style.gridRow = `${SUIT_DISPLAY_ORDER.length + 1}`;
        actionCell.style.gridColumn = `${startCol} / ${endCol}`;
        actionCell.append(sortButton);
        fragment.append(actionCell);
    }

    state.dom.deckGrid.replaceChildren(fragment);
}

let activeDeckDelete = null;

function clearPendingDelete() {
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

document.addEventListener("click", (event) => {
    if (!activeDeckDelete) {
        return;
    }
    const { state } = activeDeckDelete;
    if (!state?.dom?.deckGrid?.contains(event.target)) {
        clearPendingDelete();
    }
});

function setupKeyboardControls(state) {
    if (!state?.dom?.button) {
        return;
    }

    const pressedKeys = new Set();
    let repeatInterval = null;
    const ACTIVE_KEYS = new Set(["Enter", " "]);
    const REPEAT_DELAY = 100; // Initial delay before repeat starts (ms)
    const REPEAT_INTERVAL = 50; // Interval between repeats while held (ms)

    const triggerDraw = () => {
        // Only trigger if button is visible (active deck) and not disabled
        if (state.dom.button.disabled || state.dom.button.offsetParent === null) {
            return;
        }
        handleDraw(state);
    };

    const startRepeating = () => {
        // If already repeating, don't start another interval
        if (repeatInterval) {
            return;
        }

        // Set up interval for repeating (initial trigger already happened on keydown)
        repeatInterval = setInterval(() => {
            triggerDraw();
        }, REPEAT_INTERVAL);
    };

    const stopRepeating = () => {
        if (repeatInterval) {
            clearInterval(repeatInterval);
            repeatInterval = null;
        }
    };

    const handleKeyDown = (event) => {
        // Only handle Enter and Space
        if (!ACTIVE_KEYS.has(event.key)) {
            return;
        }

        // Only process if button is visible (active deck)
        if (state.dom.button.offsetParent === null) {
            return;
        }

        // Prevent default to avoid scrolling (Space) or form submission (Enter)
        // But allow if user is typing in an input/textarea
        const activeElement = document.activeElement;
        const isTypingInput = activeElement && (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
        );
        
        if (!isTypingInput) {
            event.preventDefault();
        }

        // If key already pressed, ignore (prevents duplicate triggers)
        if (pressedKeys.has(event.key)) {
            return;
        }

        pressedKeys.add(event.key);

        // Start repeating if not already active
        if (pressedKeys.size === 1) {
            // Delay before starting repeat to allow single trigger
            setTimeout(() => {
                if (pressedKeys.size > 0) {
                    startRepeating();
                }
            }, REPEAT_DELAY);
        }

        // Trigger immediately on first key press (but only if not typing)
        if (!isTypingInput) {
            triggerDraw();
        }
    };

    const handleKeyUp = (event) => {
        if (!ACTIVE_KEYS.has(event.key)) {
            return;
        }

        pressedKeys.delete(event.key);

        // Stop repeating if all keys are released
        if (pressedKeys.size === 0) {
            stopRepeating();
        }
    };

    // Listen for keyboard events on window to catch keys even when button not focused
    // This works for both focused and unfocused button states
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Clean up on page unload (handled by removing from window listeners)
    // Store cleanup function if needed later
    state._keyboardCleanup = () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        stopRepeating();
    };
}

function setupDeckManagement(state) {
    if (!state?.dom?.deckGrid) {
        return;
    }

    const grid = state.dom.deckGrid;
    state.dragSourceSlot = null;

    renderDeckGrid(state);

    if (state.dom.sortButton) {
        state.dom.sortButton.addEventListener("click", () => {
            clearPendingDelete();
            const sortedCards = sortDeckCards(getDeckCardsFromSlots(state.deckSlots));
            state.deckSlots = createDeckSlotsFromCards(sortedCards);
            invalidateDeckCache(state);
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
        clearPendingDelete();
        state.dragSourceSlot = slot;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${slot}`);
    });

    grid.addEventListener("dragend", (event) => {
        const card = event.target.closest(".deck-card");
        if (card) {
            card.classList.remove("dragging");
        }
        state.dragSourceSlot = null;
    });

    grid.addEventListener("dragover", (event) => {
        if (state.dragSourceSlot == null) {
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
        if (toSlot != null) {
            moveCardInSlots(state.deckSlots, fromSlot, toSlot);
            invalidateDeckCache(state);
        }
        state.dragSourceSlot = null;
        renderDeckGrid(state);
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

        if (card.classList.contains("delete-pending")) {
            if (getDeckCardCountFromSlots(state.deckSlots) <= HAND_SIZE) {
                clearPendingDelete();
                state.dom.result.textContent = "deck must keep at least five cards";
                state.dom.result.classList.remove("success");
                state.dom.result.classList.add("fail");
                return;
            }
            clearPendingDelete();
            state.deckSlots[slot] = null;
            invalidateDeckCache(state);
            renderDeckGrid(state);
            return;
        }

        if (getDeckCardCountFromSlots(state.deckSlots) <= HAND_SIZE) {
            state.dom.result.textContent = "deck must keep at least five cards";
            state.dom.result.classList.remove("success");
            state.dom.result.classList.add("fail");
            return;
        }

        setPendingDelete(state, card, slot);
    });
}

function updateHandDisplay(container, cards, highlightIndices = []) {
    const highlightSet = new Set(highlightIndices);
    container.replaceChildren(
        ...cards.map((card, index) => createHandCardElement(card, highlightSet.has(index)))
    );
}

function getHighlightIndices(cards, classificationId) {
    const values = cards.map((card) => card.value);
    const indexMap = new Map();
    values.forEach((value, index) => {
        const list = indexMap.get(value);
        if (list) {
            list.push(index);
        } else {
            indexMap.set(value, [index]);
        }
    });

    switch (classificationId) {
        case "high_card": {
            const maxValue = Math.max(...values);
            return indexMap.get(maxValue) ?? [];
        }
        case "pair": {
            const pair = [...indexMap.values()].find((indices) => indices.length === 2);
            return pair ?? [];
        }
        case "two_pair": {
            return [...indexMap.values()]
                .filter((indices) => indices.length === 2)
                .flat();
        }
        case "three_kind": {
            const triple = [...indexMap.values()].find((indices) => indices.length === 3);
            return triple ?? [];
        }
        case "four_kind": {
            const quad = [...indexMap.values()].find((indices) => indices.length === 4);
            return quad ?? [];
        }
        case "full_house":
        case "straight":
        case "flush":
        case "straight_flush":
        case "royal_flush":
            return [0, 1, 2, 3, 4];
        default:
            return [];
    }
}

function buildResultMessage({ success, classification, streak, permanentlyCompleted }) {
    if (success) {
        if (permanentlyCompleted || streak >= STREAK_TARGET) {
            return `hit ${classification.label}, streak: ${streak}`;
        }
        return `hit ${classification.label} ${streak}/${STREAK_TARGET}`;
    }
    return `missed (${classification.label})`;
}

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
        const frameDelay = state.animationFrameDelay ?? 0; // Delay between updates in ms (0 = no delay, max speed)
        let lastUpdateTime = startTime;
        
        // Reuse existing card elements instead of recreating them
        let cardElements = Array.from(container.children);
        if (cardElements.length !== HAND_SIZE) {
            // Create elements if they don't exist or don't match hand size
            container.replaceChildren();
            cardElements = [];
            for (let i = 0; i < HAND_SIZE; i++) {
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

            // Throttle updates based on frameDelay
            const timeSinceLastUpdate = currentTime - lastUpdateTime;
            if (timeSinceLastUpdate >= frameDelay) {
                // Draw a random hand without checking score
                const randomCards = drawHandFromDeck(deck, HAND_SIZE);
                if (randomCards.length === HAND_SIZE) {
                    // Update existing elements efficiently - only change what's different
                    randomCards.forEach((card, index) => {
                        const element = cardElements[index];
                        if (!element) return;
                        
                        // Build class string efficiently
                        let classes = "poker-hand-card";
                        if (card.color === "red") {
                            classes += " red";
                        }
                        classes += ` suit-${card.suitName}`;
                        // No highlighting during animation (no "scoring" class)
                        
                        // Only update if changed
                        if (element.className !== classes) {
                            element.className = classes;
                        }
                        
                        // Update text content only if changed
                        const textContent = `${card.rank}${card.suit}`;
                        if (element.textContent !== textContent) {
                            element.textContent = textContent;
                        }
                        
                        // Update title only if changed
                        if (element.title !== card.label) {
                            element.title = card.label;
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

async function handleDraw(state) {
    if (!state) {
        return;
    }

    // Prevent overlapping actions - check both animation and pending states
    if (state.isAnimating || state.pendingDraw) {
        return;
    }

    // Check deck size first
    const deck = getCachedDeckCards(state);
    if (deck.length < HAND_SIZE) {
        state.dom.result.textContent = "need at least five cards in the deck";
        state.dom.result.classList.remove("success");
        state.dom.result.classList.add("fail");
        return;
    }

    // Set states to prevent overlapping actions
    state.isAnimating = true;
    state.pendingDraw = true;
    state.dom.button.disabled = true;

    try {
        // Run shuffling animation
        await animateShuffle(state, state.animationDuration);

        // After animation, perform the actual draw
        const cards = drawHandFromDeck(deck, HAND_SIZE);
        if (cards.length < HAND_SIZE) {
            state.dom.result.textContent = "need at least five cards in the deck";
            state.dom.result.classList.remove("success");
            state.dom.result.classList.add("fail");
            return;
        }

        const classification = classifyHand(cards);
        const success = classification.id === state.config.target;

        if (success) {
            state.streak += 1;
            if (state.streak >= STREAK_TARGET) {
                state.permanentlyCompleted = true;
                state.navButton.classList.add("completed");
            }
        } else {
            state.streak = 0;
            // Only remove completed class if not permanently completed
            if (!state.permanentlyCompleted) {
                state.navButton.classList.remove("completed");
            }
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
        // Re-enable button and clear animation state
        state.isAnimating = false;
        state.pendingDraw = false;
        state.dom.button.disabled = false;
    }
}

function initPokerPage() {
    const tabList = document.getElementById("poker-tabs");
    const display = document.getElementById("poker-display");
    if (!tabList || !display) {
        return;
    }

    const deckStates = [];

    const activateDeck = (state) => {
        if (!state) {
            return;
        }
        clearPendingDelete();
        display.replaceChildren(state.dom.root);
        deckStates.forEach((entry) => {
            const isActive = entry === state;
            entry.navButton.classList.toggle("active", isActive);
            entry.navButton.setAttribute("aria-pressed", isActive ? "true" : "false");
            // Check permanent completion state, not just current streak
            if (entry.permanentlyCompleted) {
                entry.navButton.classList.add("completed");
            } else {
                entry.navButton.classList.remove("completed");
            }
        });
    };

    DECKS.forEach((config, index) => {
        const dom = createDeckElement(config);
        const navButton = document.createElement("button");
        navButton.type = "button";
        navButton.className = "poker-tab-button";
        navButton.textContent = HAND_LABELS[config.id] ?? config.title;
        navButton.setAttribute("aria-controls", dom.root.id);
        navButton.setAttribute("aria-pressed", "false");

        const initialCards = getInitialDeckForChallenge(config.id);
        const state = {
            config,
            dom,
            navButton,
            streak: 0,
            permanentlyCompleted: false,
            deckSlots: createDeckSlotsFromCards(initialCards),
            dragSourceSlot: null,
            isAnimating: false,
            animationDuration: 2000, // Can be upgraded to reduce time between draws
            animationFrameDelay: 70, // Delay between frame updates in ms (0 = max speed, higher = slower)
            pendingDraw: false // Track if a draw is queued to prevent overlapping actions
        };

        setupDeckManagement(state);

        navButton.addEventListener("click", () => activateDeck(state));
        
        // Set up button click handler
        state.dom.button.addEventListener("click", () => handleDraw(state));
        
        // Set up keyboard handlers for Enter and Space
        setupKeyboardControls(state);
        
        tabList.append(navButton);
        deckStates.push(state);

        if (index === 0) {
            activateDeck(state);
        }
    });
}

initPokerPage();
