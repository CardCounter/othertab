import {
    CARDS_PER_ROW,
    EXTRA_BOTTOM_SLOTS,
    RANK_DISPLAY_ORDER,
    SUIT_DISPLAY_ORDER,
    TOTAL_MAIN_SLOTS
} from "./config.js";
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
    button.textContent = "draw hand";

    const controlsGroup = document.createElement("div");
    controlsGroup.className = "poker-controls-group";

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
    controlsColumn.append(controlsGroup, result);

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

    const sortButton = document.createElement("button");
    sortButton.type = "button";
    sortButton.className = "deck-sort-button";
    sortButton.textContent = "sort deck";

    const cardShop = document.createElement("section");
    cardShop.className = "card-shop";

    const cardShopUpper = document.createElement("div");
    cardShopUpper.className = "card-shop-upper";

    const cardShopDiscard = document.createElement("div");
    cardShopDiscard.className = "card-shop-discard";

    const cardShopDiscardLabel = document.createElement("span");
    cardShopDiscardLabel.className = "card-shop-discard-label";
    cardShopDiscardLabel.textContent = "discards:";

    const cardShopDiscardValue = document.createElement("span");
    cardShopDiscardValue.className = "card-shop-discard-value";
    cardShopDiscardValue.textContent = "0";

    cardShopDiscard.append(cardShopDiscardLabel, cardShopDiscardValue);

    const cardShopRerollButton = document.createElement("button");
    cardShopRerollButton.type = "button";
    cardShopRerollButton.className = "card-shop-reroll";

    const cardShopRerollLabel = document.createElement("span");
    cardShopRerollLabel.className = "card-shop-reroll-label";
    cardShopRerollLabel.textContent = "reroll:";

    const cardShopRerollPrice = document.createElement("span");
    cardShopRerollPrice.className = "card-shop-reroll-price";
    const initialReroll = document.createElement("span");
    initialReroll.className = "dice-text";
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
        sortButton,
        cardShop,
        cardShopUpper,
        cardShopSlots,
        cardShopRerollButton,
        cardShopRerollPrice,
        cardShopDiscardValue,
        upgradeArea,
        upgradeColumn,
        upgradeSlots,
        upgradeList,
        upgradeUniqueRow,
        upgradeUniqueList,
        upgradeUniqueRerollButton,
        autoButton
    };
}

function ensureDeckGridStructure(state) {
    if (!state?.dom?.deckGrid) {
        return null;
    }
    if (
        Array.isArray(state.dom.deckGridMainCells) &&
        state.dom.deckGridMainCells.length === TOTAL_MAIN_SLOTS
    ) {
        return state.dom.deckGridMainCells;
    }

    const fragment = document.createDocumentFragment();
    const mainCells = [];

    for (let slotIndex = 0; slotIndex < TOTAL_MAIN_SLOTS; slotIndex += 1) {
        const cell = document.createElement("div");
        cell.className = "deck-cell deck-slot";
        cell.dataset.slot = `${slotIndex}`;
        fragment.append(cell);
        mainCells.push(cell);
    }

    for (let extraIndex = 0; extraIndex < EXTRA_BOTTOM_SLOTS; extraIndex += 1) {
        const slotIndex = TOTAL_MAIN_SLOTS + extraIndex;
        const cell = document.createElement("div");
        cell.className = "deck-cell deck-slot deck-slot-locked";
        cell.dataset.slot = `${slotIndex}`;
        cell.setAttribute("aria-label", "locked slot (upgrade required)");
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
        state.dom.sortButtonCell = actionCell;
    }

    state.dom.deckGrid.replaceChildren(fragment);
    state.dom.deckGridMainCells = mainCells;
    state.dom.deckCardButtons = new Array(TOTAL_MAIN_SLOTS).fill(null);

    return mainCells;
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
        state.dom.deckCardButtons = new Array(TOTAL_MAIN_SLOTS).fill(null);
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
            button.dataset.slot = `${slotIndex}`;
            button.draggable = true;

            const drawn = cardToRender.isDrawn === true;
            const classes = buildDeckCardClasses(cardToRender, drawn);
            if (button.className !== classes) {
                button.className = classes;
            }

            const textContent = `${cardToRender.rank}${cardToRender.suit}`;
            if (button.textContent !== textContent) {
                button.textContent = textContent;
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
