import {
    CARD_SHOP_POOL_WEIGHTS,
    CARD_SHOP_SETTINGS,
    TOTAL_MAIN_SLOTS,
    RANKS
} from "./config.js";
import { createStandardDeck, invalidateDeckCache } from "./deck-utils.js";
import { renderDeckGrid } from "./ui.js";
import { formatChipAmount } from "./chips.js";

const DISCARD_SHOP_ITEM = {
    id: "discard",
    type: "discard",
    rarity: "uncommon",
    price: CARD_SHOP_SETTINGS.cardPrice,
    label: "discard",
    icon: "X"
};

const UNCOMMON_TESTER_CARDS = [
    {
        rank: "U1",
        value: 20,
        rankName: "tester u1",
        suit: "★",
        suitName: "star",
        color: "black",
        label: "tester star",
        rarity: "uncommon",
        price: CARD_SHOP_SETTINGS.cardPrice
    },
    {
        rank: "U2",
        value: 21,
        rankName: "tester u2",
        suit: "★",
        suitName: "star",
        color: "black",
        label: "tester comet",
        rarity: "uncommon",
        price: CARD_SHOP_SETTINGS.cardPrice
    }
];

const RARE_TESTER_CARDS = [
    {
        rank: "R1",
        value: 30,
        rankName: "tester r1",
        suit: "✦",
        suitName: "nova",
        color: "red",
        label: "tester nova",
        rarity: "rare",
        price: CARD_SHOP_SETTINGS.cardPrice
    },
    {
        rank: "R2",
        value: 31,
        rankName: "tester r2",
        suit: "✦",
        suitName: "nova",
        color: "red",
        label: "tester supernova",
        rarity: "rare",
        price: CARD_SHOP_SETTINGS.cardPrice
    }
];

const CARD_SHOP_POOLS = {
    common: {
        id: "common",
        label: "common pool",
        cards: createStandardDeck().map((card) => ({
            ...card,
            rarity: "common",
            price: CARD_SHOP_SETTINGS.cardPrice
        }))
    },
    uncommon: {
        id: "uncommon",
        label: "uncommon pool",
        cards: [...UNCOMMON_TESTER_CARDS, DISCARD_SHOP_ITEM]
    },
    rare: {
        id: "rare",
        label: "rare pool",
        cards: RARE_TESTER_CARDS
    }
};

const CARD_SHOP_POOL_ODDS = CARD_SHOP_POOL_WEIGHTS.map(({ id, weight }) => {
    const pool = CARD_SHOP_POOLS[id];
    return pool ? { pool, weight } : null;
}).filter(Boolean);

const RANK_SYMBOL_NAME_MAP = new Map(RANKS.map(({ symbol, name }) => [symbol, name]));

function formatChipPrice(value) {
    return formatChipAmount(value, { includeSymbol: true });
}

function getOfferRarity(offer) {
    if (!offer) {
        return "common";
    }
    const raw = offer.rarity ?? offer.poolId ?? "common";
    return typeof raw === "string" ? raw : "common";
}

function cloneCardForDeck(card, poolId) {
    if (!card) {
        return null;
    }
    return {
        rank: card.rank,
        value: card.value,
        rankName: card.rankName,
        suit: card.suit,
        suitName: card.suitName,
        color: card.color,
        label: card.label,
        rarity: card.rarity ?? poolId,
        sourcePool: poolId,
        isDrawn: false
    };
}

function getRandomArrayItem(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return null;
    }
    const index = Math.floor(Math.random() * list.length);
    return list[index] ?? null;
}

function selectPoolByWeight(poolOdds) {
    if (!Array.isArray(poolOdds) || poolOdds.length === 0) {
        return null;
    }
    const totalWeight = poolOdds.reduce((sum, entry) => sum + (entry?.weight ?? 0), 0);
    if (totalWeight <= 0) {
        return null;
    }
    let threshold = Math.random() * totalWeight;
    for (let index = 0; index < poolOdds.length; index += 1) {
        const entry = poolOdds[index];
        const weight = entry?.weight ?? 0;
        if (weight <= 0) {
            continue;
        }
        threshold -= weight;
        if (threshold <= 0) {
            return entry;
        }
    }
    return poolOdds[poolOdds.length - 1] ?? null;
}

function generateCardShopOffer() {
    const selection = selectPoolByWeight(CARD_SHOP_POOL_ODDS);
    const pool = selection?.pool;
    if (!pool) {
        return null;
    }
    const template = getRandomArrayItem(pool.cards);
    if (!template) {
        return null;
    }
    const type = template.type ?? "card";
    const rarity = template.rarity ?? pool.id;
    const price = template.price ?? CARD_SHOP_SETTINGS.cardPrice;

    if (type === "discard") {
        return {
            type,
            poolId: pool.id,
            rarity,
            price,
            label: template.label ?? "discard",
            icon: template.icon ?? "X"
        };
    }

    const card = {
        rank: template.rank,
        value: template.value,
        rankName: template.rankName,
        suit: template.suit,
        suitName: template.suitName,
        color: template.color,
        label: template.label
    };

    return {
        type: "card",
        card,
        rarity,
        price,
        poolId: pool.id
    };
}

function getRankDescription(rankSymbol) {
    if (!rankSymbol) {
        return "";
    }
    if (/^\d+$/.test(rankSymbol)) {
        return `${rankSymbol}`;
    }
    const name = RANK_SYMBOL_NAME_MAP.get(rankSymbol);
    if (name) {
        return name;
    }
    return `${rankSymbol}`;
}

function renderCardShop(state) {
    if (!state?.cardShop || !state?.dom?.cardShopSlots) {
        return;
    }

    const { cardShop } = state;
    const slotsFragment = document.createDocumentFragment();

    const frozenSlotIndex = cardShop.frozenOffer?.fromSlotIndex ?? null;

    for (let index = 0; index < cardShop.slots.length; index += 1) {
        const offer = cardShop.slots[index];
        const slotWrapper = document.createElement("div");
        slotWrapper.className = "card-shop-slot-wrapper";

        const slot = document.createElement("div");
        slot.className = "card-shop-slot";
        slot.dataset.slot = `${index}`;

        if (offer) {
            slot.classList.add("has-offer");

            const freezeButton = document.createElement("button");
            freezeButton.type = "button";
            freezeButton.className = "card-shop-freeze-button button";
            freezeButton.dataset.slot = `${index}`;

            if (frozenSlotIndex === index) {
                freezeButton.textContent = "unfreeze";
                freezeButton.classList.add("frozen");
            } else {
                freezeButton.textContent = "freeze";
                if (frozenSlotIndex != null) {
                    freezeButton.classList.add("card-shop-freeze-button--placeholder");
                }
            }

            const cardButton = document.createElement("button");
            cardButton.type = "button";
            cardButton.className = "card-shop-card";
            cardButton.dataset.source = "shop";
            cardButton.dataset.slot = `${index}`;

            const offerType = offer.type ?? "card";
            cardButton.dataset.offerType = offerType;
            cardButton.draggable = offerType !== "discard";

            const rarity = getOfferRarity(offer);
            if (rarity) {
                cardButton.dataset.rarity = rarity;
                if (rarity !== "common" && offerType === "card") {
                    cardButton.classList.add(`rarity-${rarity}`);
                }
            }

            let descriptionText = "";
            if (offerType === "card") {
                const suitName = offer.card?.suitName ?? "";
                if (suitName) {
                    cardButton.dataset.suit = suitName;
                    cardButton.classList.add(`suit-${suitName}`);
                }

                const rank = offer.card?.rank ?? "?";
                const suit = offer.card?.suit ?? "";
                cardButton.textContent = `${rank}${suit}`;

                const cardLabel = offer.card?.label ?? offer.label ?? "";
                if (offer.card) {
                    const rankDescription = getRankDescription(rank);
                    if (rankDescription && suitName) {
                        descriptionText = `${rankDescription} of ${suitName}`;
                    } else if (rankDescription) {
                        descriptionText = rankDescription;
                    }
                }
                if (!descriptionText && cardLabel) {
                    descriptionText = cardLabel;
                }
            } else {
                cardButton.textContent = offer.icon ?? "X";
                cardButton.classList.add("card-shop-card-discard");
                descriptionText = "+1 discard";
            }

            if (!descriptionText) {
                descriptionText = offer.label ?? "card";
            }
            cardButton.setAttribute("aria-label", descriptionText);

            const cardContainer = document.createElement("div");
            cardContainer.className = "card-shop-card-container";

            const description = document.createElement("div");
            description.className = "card-shop-card-description";
            description.textContent = descriptionText;
            description.setAttribute("aria-hidden", "true");

            const price = document.createElement("div");
            price.className = "card-shop-card-price";
            price.textContent = formatChipPrice(offer.price);

            cardContainer.append(cardButton, description);

            slot.append(cardContainer, price);

            slotWrapper.append(slot, freezeButton);
        } else {
            slot.classList.add("empty");
            slotWrapper.append(slot);
        }

        slotsFragment.append(slotWrapper);
    }

    state.dom.cardShopSlots.replaceChildren(slotsFragment);

    if (state.dom.cardShopRerollPrice) {
        state.dom.cardShopRerollPrice.textContent = formatChipPrice(cardShop.rerollPrice);
    }
}

export function updateDiscardDisplay(state) {
    if (!state?.dom?.cardShopDiscardValue) {
        return;
    }
    const count = state.discards ?? 0;
    state.dom.cardShopDiscardValue.textContent = `${count}`;
}

function rerollCardShop(state, { silent = false } = {}) {
    if (!state?.cardShop) {
        return;
    }
    state.cardShop.draggingOffer = null;
    const frozenSlotIndex = state.cardShop.frozenOffer?.fromSlotIndex ?? null;
    for (let index = 0; index < state.cardShop.slots.length; index += 1) {
        if (frozenSlotIndex !== index) {
            state.cardShop.slots[index] = generateCardShopOffer();
        }
    }
    renderCardShop(state);
}

function handleCardShopPurchase(state, source, slotIndex = null) {
    if (!state?.cardShop) {
        return;
    }
    let offer = null;
    if (source === "shop" && slotIndex != null && slotIndex >= 0) {
        offer = state.cardShop.slots[slotIndex] ?? null;
    }
    if (!offer) {
        return;
    }
    const frozenSlotIndex = state.cardShop.frozenOffer?.fromSlotIndex ?? null;
    if (frozenSlotIndex === slotIndex) {
        return;
    }
    const offerType = offer.type ?? "card";
    if (offerType === "discard") {
        state.discards = (state.discards ?? 0) + 1;
        updateDiscardDisplay(state);
        if (slotIndex != null && slotIndex >= 0) {
            state.cardShop.slots[slotIndex] = null;
        }
        renderCardShop(state);
        return;
    }

    const openSlot = state.deckSlots.findIndex((card, index) => {
        if (index >= TOTAL_MAIN_SLOTS) {
            return false;
        }
        if (card !== null) {
            return false;
        }
        const baselineCard = state.deckBaselineSlots?.[index] ?? null;
        return baselineCard === null;
    });
    if (openSlot === -1) {
        return;
    }
    const newCard = cloneCardForDeck(offer.card, offer.poolId);
    if (!newCard) {
        return;
    }
    newCard.shopPrice = offer.price;
    state.deckSlots[openSlot] = newCard;
    invalidateDeckCache(state);
    if (Array.isArray(state.deckBaselineSlots) && openSlot < state.deckBaselineSlots.length) {
        state.deckBaselineSlots[openSlot] = newCard;
    }
    renderDeckGrid(state);
    if (slotIndex != null && slotIndex >= 0) {
        state.cardShop.slots[slotIndex] = null;
    }
    renderCardShop(state);
}

export function setupCardShop(state) {
    if (!state?.dom?.cardShop || !state.dom.cardShopSlots) {
        return;
    }

    state.cardShop = {
        slots: Array.from({ length: CARD_SHOP_SETTINGS.slotCount }, () => null),
        frozenOffer: null,
        rerollPrice: CARD_SHOP_SETTINGS.rerollPrice,
        cardPrice: CARD_SHOP_SETTINGS.cardPrice,
        draggingOffer: null
    };

    if (state.discards == null) {
        state.discards = 0;
    }
    updateDiscardDisplay(state);

    const clearDragState = () => {
        if (state?.cardShop) {
            state.cardShop.draggingOffer = null;
        }
        if (state?.dom?.cardShop) {
            state.dom.cardShop.classList.remove("card-shop-dragging");
        }
    };

    const handleDragStart = (event) => {
        if (!state?.cardShop) {
            return;
        }
        const card = event.target.closest(".card-shop-card");
        if (!card) {
            return;
        }
        const source = card.dataset.source;
        let payload = null;
        if (source === "shop") {
            const slotIndexValue = Number.parseInt(card.dataset.slot ?? "", 10);
            if (Number.isNaN(slotIndexValue)) {
                return;
            }
            const offer = state.cardShop.slots[slotIndexValue];
            if (!offer) {
                return;
            }
            payload = { source: "shop", slotIndex: slotIndexValue, offer };
        } else if (source === "freeze") {
            const offer = state.cardShop.frozenOffer?.offer ?? null;
            if (!offer) {
                return;
            }
            payload = { source: "freeze", offer };
        }

        if (!payload) {
            return;
        }

        state.cardShop.draggingOffer = payload;
        state.dom.cardShop.classList.add("card-shop-dragging");
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        try {
            event.dataTransfer.setData("text/plain", "card");
        } catch (error) {
            // Ignore setData failures (Safari)
        }
    };

    const handleDragEnd = (event) => {
        const card = event.target.closest(".card-shop-card");
        if (card) {
            card.classList.remove("dragging");
        }
        clearDragState();
    };

    state.dom.cardShopSlots.addEventListener("click", (event) => {
        const freezeButton = event.target.closest(".card-shop-freeze-button");
        if (freezeButton) {
            event.stopPropagation();
            const slotIndexValue = Number.parseInt(freezeButton.dataset.slot ?? "", 10);
            if (Number.isNaN(slotIndexValue)) {
                return;
            }
            const currentFrozenIndex = state.cardShop.frozenOffer?.fromSlotIndex ?? null;
            if (currentFrozenIndex === slotIndexValue) {
                state.cardShop.frozenOffer = null;
                renderCardShop(state);
            } else if (currentFrozenIndex == null) {
                const offer = state.cardShop.slots[slotIndexValue];
                if (offer) {
                    state.cardShop.frozenOffer = { offer, fromSlotIndex: slotIndexValue };
                    renderCardShop(state);
                }
            }
            return;
        }

        const card = event.target.closest(".card-shop-card");
        if (!card) {
            return;
        }
        const slotIndexValue = Number.parseInt(card.dataset.slot ?? "", 10);
        if (Number.isNaN(slotIndexValue)) {
            return;
        }
        if (typeof card.blur === "function") {
            card.blur();
        }
        handleCardShopPurchase(state, "shop", slotIndexValue);
    });

    state.dom.cardShopSlots.addEventListener("dragstart", handleDragStart);
    state.dom.cardShopSlots.addEventListener("dragend", handleDragEnd);
    state.dom.cardShopSlots.addEventListener("dragover", (event) => {
        if (!state?.cardShop?.draggingOffer) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });
    state.dom.cardShopSlots.addEventListener("drop", (event) => {
        if (!state?.cardShop?.draggingOffer) {
            return;
        }
        event.preventDefault();
        const slotElement = event.target.closest(".card-shop-slot");
        if (!slotElement) {
            clearDragState();
            return;
        }
        const targetSlot = Number.parseInt(slotElement.dataset.slot ?? "", 10);
        if (Number.isNaN(targetSlot)) {
            clearDragState();
            return;
        }
        const drag = state.cardShop.draggingOffer;
        if (drag.source === "shop") {
            if (drag.slotIndex !== targetSlot) {
                const current = state.cardShop.slots[targetSlot] ?? null;
                state.cardShop.slots[targetSlot] = drag.offer;
                state.cardShop.slots[drag.slotIndex] = current;
                renderCardShop(state);
            }
        } else if (drag.source === "freeze") {
            const current = state.cardShop.slots[targetSlot] ?? null;
            state.cardShop.slots[targetSlot] = drag.offer;
            if (current) {
                state.cardShop.frozenOffer = { offer: current, fromSlotIndex: targetSlot };
            } else {
                state.cardShop.frozenOffer = null;
            }
            renderCardShop(state);
        }
        clearDragState();
    });

    if (state.dom.cardShopRerollButton) {
        state.dom.cardShopRerollButton.addEventListener("click", () => {
            rerollCardShop(state);
        });
    }

    rerollCardShop(state, { silent: true });
}
