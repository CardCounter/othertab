import {
    CARD_SHOP_SETTINGS,
    CARDS_PER_ROW,
    EXTRA_BOTTOM_SLOTS,
    RANK_DISPLAY_ORDER,
    SUIT_DISPLAY_ORDER,
    TOTAL_MAIN_SLOTS
} from "./config.js";
import { formatChipAmount } from "./chips.js";

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
    cardShopRerollPrice.textContent = formatShopPrice(CARD_SHOP_SETTINGS.rerollPrice);

    cardShopRerollButton.append(cardShopRerollLabel, cardShopRerollPrice);

    const cardShopSlots = document.createElement("div");
    cardShopSlots.className = "card-shop-slots";
    cardShopSlots.setAttribute("role", "list");
    cardShopSlots.setAttribute("aria-label", "shop cards");

    cardShopUpper.append(cardShopDiscard, cardShopRerollButton);
    cardShop.append(cardShopUpper, cardShopSlots);

    deckColumn.append(deckGrid, cardShop);

    const upgradeColumn = document.createElement("div");
    upgradeColumn.className = "upgrade-column";

    const upgradeList = document.createElement("div");
    upgradeList.className = "upgrade-list";
    upgradeList.setAttribute("role", "list");

    upgradeColumn.append(upgradeList);

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
        cardShopUpper,
        cardShopSlots,
        cardShopRerollButton,
        cardShopRerollPrice,
        cardShopDiscardValue,
        upgradeColumn,
        upgradeList
    };
}

export function renderDeckGrid(state) {
    if (!state?.dom?.deckGrid) {
        return;
    }

    const fragment = document.createDocumentFragment();
    for (let suitIndex = 0; suitIndex < SUIT_DISPLAY_ORDER.length; suitIndex += 1) {
        for (let rankIndex = 0; rankIndex < CARDS_PER_ROW; rankIndex += 1) {
            const slotIndex = suitIndex * CARDS_PER_ROW + rankIndex;
            const card = state.deckSlots?.[slotIndex] ?? null;
            const baselineCard = state.deckBaselineSlots?.[slotIndex] ?? null;
            const cell = document.createElement("div");
            cell.className = "deck-cell";
            cell.dataset.slot = `${slotIndex}`;
            const cardToRender =
                card || (baselineCard && baselineCard.isDrawn ? baselineCard : null);
            if (cardToRender) {
                const button = document.createElement("button");
                button.type = "button";
                const drawn = cardToRender.isDrawn === true;
                button.className = buildDeckCardClasses(cardToRender, drawn);
                button.textContent = `${cardToRender.rank}${cardToRender.suit}`;
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
    }

    state.dom.deckGrid.replaceChildren(fragment);
}

export function updateHandDisplay(container, cards, highlightIndices = []) {
    const highlightSet = new Set(highlightIndices);
    container.replaceChildren(
        ...cards.map((card, index) => createHandCardElement(card, highlightSet.has(index)))
    );
}

function formatShopPrice(value) {
    return formatChipAmount(value, { includeSymbol: true });
}
