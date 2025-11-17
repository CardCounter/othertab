import { STREAK_TARGET, TOTAL_MAIN_SLOTS, TOTAL_SLOTS } from "./config.js";
import { formatDiceAmount } from "./dice.js";

function isCardDrawn(state, card) {
    if (!card) {
        return false;
    }
    return card.isDrawn === true;
}

function buildDeckCardClasses(card, isDrawn = false) {
    const classes = ["deck-card", `suit-${card.suitName}`];
    if (isDrawn) {
        classes.push("drawn");
    }
    if (card.color === "red") {
        classes.push("red");
    }
    return classes.join(" ");
}

export function createHandCardElement(card, highlighted) {
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
    return span;
}

export function createDeckElement(config) {
    const root = document.createElement("article");
    root.className = "poker-card";
    root.dataset.hand = config.id;
    root.id = `${config.id}-deck`;

    const row = document.createElement("div");
    row.className = "poker-row";

    const button = document.createElement("button");
    button.className = "poker-button";
    button.type = "button";
    button.textContent = "deal hand";

    const controlsGroup = document.createElement("div");
    controlsGroup.className = "poker-controls-group";

    const streakDisplay = document.createElement("span");
    streakDisplay.className = "poker-streak-counter";
    streakDisplay.textContent = `streak: 0/${STREAK_TARGET}`;

    const handContainer = document.createElement("div");
    handContainer.className = "poker-hand";
    handContainer.setAttribute("aria-live", "polite");

    const autoButton = document.createElement("button");
    autoButton.className = "poker-button auto-draw-toggle";
    autoButton.type = "button";
    autoButton.textContent = "auto: off";
    autoButton.setAttribute("aria-pressed", "false");

    controlsGroup.append(button, handContainer, autoButton);

    const result = document.createElement("p");
    result.className = "poker-result";
    result.setAttribute("aria-live", "polite");
    result.textContent = "";

    const controlsColumn = document.createElement("div");
    controlsColumn.className = "poker-controls-column";
    controlsColumn.append(streakDisplay, controlsGroup, result);

    const upgradeSlotBar = document.createElement("div");
    upgradeSlotBar.className = "upgrade-slot-bar";

    row.append(controlsColumn, upgradeSlotBar);

    const managementSection = document.createElement("section");
    managementSection.className = "poker-card-management";

    const deckColumn = document.createElement("div");
    deckColumn.className = "deck-column";

    const deckGrid = document.createElement("div");
    deckGrid.className = "deck-grid";
    deckGrid.setAttribute("role", "list");
    deckGrid.setAttribute("aria-label", "deck cards");

    const cardShop = document.createElement("section");
    cardShop.className = "card-shop";

    const cardShopUpper = document.createElement("div");
    cardShopUpper.className = "card-shop-upper";

    const cardShopDiscard = document.createElement("div");
    cardShopDiscard.className = "card-shop-discard";

    const cardShopDiscardButton = document.createElement("button");
    cardShopDiscardButton.type = "button";
    cardShopDiscardButton.className = "card-shop-discard-button";
    cardShopDiscardButton.setAttribute("aria-pressed", "false");
    cardShopDiscardButton.disabled = true;

    const cardShopDiscardLabel = document.createElement("span");
    cardShopDiscardLabel.className = "card-shop-discard-label";
    cardShopDiscardLabel.textContent = "discards:";

    const cardShopDiscardValue = document.createElement("span");
    cardShopDiscardValue.className = "card-shop-discard-value";
    cardShopDiscardValue.textContent = "0";

    cardShopDiscardButton.append(cardShopDiscardLabel, cardShopDiscardValue);
    const cardShopSortButton = document.createElement("button");
    cardShopSortButton.type = "button";
    cardShopSortButton.className = "card-shop-sort-button";
    cardShopSortButton.textContent = "sort deck";
    cardShopSortButton.setAttribute("aria-label", "sort deck");

    cardShopDiscard.append(cardShopSortButton, cardShopDiscardButton);

    const cardShopRerollButton = document.createElement("button");
    cardShopRerollButton.type = "button";
    cardShopRerollButton.className = "card-shop-reroll";

    const cardShopRerollLabel = document.createElement("span");
    cardShopRerollLabel.className = "card-shop-reroll-label";
    cardShopRerollLabel.textContent = "reroll:";

    const cardShopRerollPrice = document.createElement("span");
    cardShopRerollPrice.className = "card-shop-reroll-price";
    const initialReroll = document.createElement("span");
    initialReroll.className = "dice-shop-text";
    initialReroll.textContent = formatDiceAmount(0);
    cardShopRerollPrice.append(initialReroll);

    cardShopRerollButton.append(cardShopRerollLabel, cardShopRerollPrice);

    const cardShopSlots = document.createElement("div");
    cardShopSlots.className = "card-shop-slots";
    cardShopSlots.setAttribute("role", "list");
    cardShopSlots.setAttribute("aria-label", "shop cards");

    cardShopUpper.append(cardShopDiscard, cardShopRerollButton);
    cardShop.append(cardShopUpper, cardShopSlots);

    deckColumn.append(deckGrid, cardShop);

    const upgradeArea = document.createElement("div");
    upgradeArea.className = "upgrade-area";

    const upgradeSlots = document.createElement("div");
    upgradeSlots.className = "upgrade-slots";
    upgradeSlots.setAttribute("role", "list");
    upgradeSlots.setAttribute("aria-label", "equipped upgrades");
    upgradeSlotBar.append(upgradeSlots);

    const upgradeColumn = document.createElement("div");
    upgradeColumn.className = "upgrade-column";

    const upgradeList = document.createElement("div");
    upgradeList.className = "upgrade-list";
    upgradeList.setAttribute("role", "list");

    const upgradeUniqueRow = document.createElement("div");
    upgradeUniqueRow.className = "unique-upgrade-row";

    const upgradeUniqueList = document.createElement("div");
    upgradeUniqueList.className = "unique-upgrade-list";
    upgradeUniqueList.setAttribute("role", "list");
    upgradeUniqueList.setAttribute("aria-label", "unique upgrades");

    const upgradeUniqueRerollButton = document.createElement("button");
    upgradeUniqueRerollButton.type = "button";
    upgradeUniqueRerollButton.className = "unique-upgrade-reroll";
    upgradeUniqueRerollButton.textContent = "reroll";

    upgradeUniqueRow.append(upgradeUniqueList, upgradeUniqueRerollButton);
    upgradeColumn.append(upgradeList, upgradeUniqueRow);
    upgradeArea.append(upgradeColumn);

    managementSection.append(deckColumn, upgradeArea);

    root.append(row, managementSection);

    return {
        root,
        button,
        handContainer,
        result,
        deckGrid,
        cardShop,
        cardShopUpper,
        cardShopSlots,
        cardShopRerollButton,
        cardShopRerollPrice,
        cardShopDiscard,
        cardShopDiscardButton,
        cardShopSortButton,
        cardShopDiscardValue,
        upgradeArea,
        upgradeColumn,
        upgradeSlots,
        upgradeList,
        upgradeUniqueRow,
        upgradeUniqueList,
        upgradeUniqueRerollButton,
        autoButton,
        streakDisplay
    };
}

function ensureDeckGridStructure(state) {
    if (!state?.dom?.deckGrid) {
        return null;
    }
    if (
        Array.isArray(state.dom.deckGridCells) &&
        state.dom.deckGridCells.length === TOTAL_SLOTS
    ) {
        return state.dom.deckGridCells;
    }

    const fragment = document.createDocumentFragment();
    const cells = [];

    for (let slotIndex = 0; slotIndex < TOTAL_SLOTS; slotIndex += 1) {
        const cell = document.createElement("div");
        cell.className = "deck-cell deck-slot";
        cell.dataset.slot = `${slotIndex}`;
        if (slotIndex >= TOTAL_MAIN_SLOTS) {
            cell.classList.add("deck-slot-extra");
        }
        fragment.append(cell);
        cells.push(cell);
    }

    state.dom.deckGrid.replaceChildren(fragment);
    state.dom.deckGridCells = cells;
    state.dom.deckCardButtons = new Array(TOTAL_SLOTS).fill(null);

    return cells;
}

export function renderDeckGrid(state) {
    if (!state?.dom?.deckGrid) {
        return;
    }

    const cells = ensureDeckGridStructure(state);
    if (!Array.isArray(cells) || cells.length === 0) {
        return;
    }

    if (!Array.isArray(state.dom.deckCardButtons)) {
        state.dom.deckCardButtons = new Array(TOTAL_SLOTS).fill(null);
    }

    for (let slotIndex = 0; slotIndex < cells.length; slotIndex += 1) {
        const cell = cells[slotIndex];
        if (!cell) {
            continue;
        }

        cell.dataset.slot = `${slotIndex}`;
        cell.classList.remove("has-card");
        cell.classList.add("deck-slot");

        const card = state.deckSlots?.[slotIndex] ?? null;
        const baselineCard = state.deckBaselineSlots?.[slotIndex] ?? null;
        const cardToRender =
            card || (baselineCard && baselineCard.isDrawn ? baselineCard : null);

        if (cardToRender) {
            cell.classList.add("has-card");
            cell.classList.remove("deck-slot");

            let button = state.dom.deckCardButtons[slotIndex];
            if (!button) {
                button = document.createElement("button");
                button.type = "button";
                state.dom.deckCardButtons[slotIndex] = button;
            }
            const drawn = cardToRender.isDrawn === true;
            const isAnimating = state.isAnimating === true || state.pendingDraw === true;
            const allowDrag =
                state.deckDiscardActive !== true && !drawn && !isAnimating;
            button.dataset.slot = `${slotIndex}`;
            button.draggable = allowDrag;
            if (allowDrag) {
                button.setAttribute("aria-grabbed", "false");
            } else {
                button.removeAttribute("aria-grabbed");
            }
            const classes = buildDeckCardClasses(cardToRender, drawn);
            if (button.className !== classes) {
                button.className = classes;
            }

            const textContent = `${cardToRender.rank}${cardToRender.suit}`;
            if (button.textContent !== textContent) {
                button.textContent = textContent;
            }

            // apply text size if specified
            const textSize = cardToRender.deckTextSize ?? cardToRender.textSize ?? null;
            if (textSize) {
                button.style.fontSize = textSize;
            } else {
                button.style.fontSize = "";
            }

            if (button.parentNode !== cell) {
                cell.append(button);
            }
        } else {
            const existingButton = state.dom.deckCardButtons[slotIndex];
            if (existingButton && existingButton.parentNode === cell) {
                cell.removeChild(existingButton);
            }
        }
    }
}

export function updateHandDisplay(container, cards, highlightIndices = [], handSize = cards.length) {
    const highlightSet = new Set(highlightIndices);
    const total = Number.isFinite(handSize) ? Math.floor(handSize) : cards.length;
    const elements = [];
    for (let index = 0; index < total; index += 1) {
        const card = cards[index];
        if (card) {
            elements.push(createHandCardElement(card, highlightSet.has(index)));
        } else {
            const span = document.createElement("span");
            span.className = "poker-hand-card";
            elements.push(span);
        }
    }
    container.replaceChildren(...elements);
}

export function updateStreakDisplay(state) {
    if (!state?.dom?.streakDisplay) {
        return;
    }
    const streakTarget = Number.isFinite(state?.streakTarget)
        ? Math.max(1, Math.floor(state.streakTarget))
        : STREAK_TARGET;
    const streakValue = Number.isFinite(state?.streak) ? Math.max(0, state.streak) : 0;
    const completed = state?.permanentlyCompleted === true || streakValue >= streakTarget;
    state.dom.streakDisplay.textContent = completed
        ? `streak: ${streakValue}`
        : `streak: ${streakValue}/${streakTarget}`;
    state.dom.streakDisplay.classList.toggle("active", streakValue > 0);
}
