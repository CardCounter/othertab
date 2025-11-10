import {
    CARD_SHOP_POOL_WEIGHTS,
    CARD_SHOP_SETTINGS,
    RANKS,
    DEFAULT_REROLL_DICE_COST,
    DEFAULT_REROLL_DICE_INCREMENT
} from "./config.js";
import { DECK_CARD_SHOP_CONFIG } from "./card-shop-config.js";
import { createStandardDeck, invalidateDeckCache, updateDeckBaseline } from "./deck-utils.js";
import { renderDeckGrid } from "./ui.js";
import { formatChipAmount } from "./chips.js";
import { canAffordDice, formatDiceAmount, spendDice, subscribeToDiceChanges } from "./dice.js";

const DISCARD_SHOP_ITEM = {
    id: "discard",
    type: "discard",
    rarity: "uncommon",
    price: CARD_SHOP_SETTINGS.cardPrice,
    label: "discard",
    icon: "X",
    textSize: "3rem"
};

const UNCOMMON_TESTER_CARDS = [
    // {
    //     rank: "U1",
    //     value: 20,
    //     rankName: "tester u1",
    //     suit: "★",
    //     suitName: "star",
    //     color: "black",
    //     label: "tester star",
    //     rarity: "uncommon",
    //     price: CARD_SHOP_SETTINGS.cardPrice
    // },
    // {
    //     rank: "U2",
    //     value: 21,
    //     rankName: "tester u2",
    //     suit: "★",
    //     suitName: "star",
    //     color: "black",
    //     label: "tester comet",
    //     rarity: "uncommon",
    //     price: CARD_SHOP_SETTINGS.cardPrice
    // }
];

const RARE_TESTER_CARDS = [
    {
        id: "rare_qh",
        rank: "E",
        value: 12,
        rankName: "e",
        suit: "♥",
        suitName: "hearts",
        color: "red",
        label: "gilded queen",
        rarity: "rare",
        price: CARD_SHOP_SETTINGS.cardPrice,
        textSize: "2rem"
    }
];

const GENERAL_CARD_SHOP_POOLS = {
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

function clonePoolDefinition(pool) {
    if (!pool) {
        return null;
    }
    return {
        id: pool.id,
        label: pool.label,
        cards: Array.isArray(pool.cards) ? pool.cards.map((card) => ({ ...card })) : []
    };
}

function appendCardsToPool(poolMap, poolId, cards, fallbackLabel) {
    if (!poolId || !Array.isArray(cards) || cards.length === 0) {
        return;
    }
    if (!poolMap[poolId]) {
        poolMap[poolId] = {
            id: poolId,
            label: fallbackLabel ?? `${poolId} pool`,
            cards: []
        };
    }
    cards.forEach((card) => {
        if (card) {
            poolMap[poolId].cards.push({ ...card });
        }
    });
}

function buildDeckCardPoolMap(defaultConfig, deckConfig) {
    const poolMap = {};
    Object.values(GENERAL_CARD_SHOP_POOLS).forEach((pool) => {
        const clone = clonePoolDefinition(pool);
        if (clone) {
            poolMap[clone.id] = clone;
        }
    });

    const applyConfig = (config) => {
        if (!config?.pools || typeof config.pools !== "object") {
            return;
        }
        Object.entries(config.pools).forEach(([poolId, entries]) => {
            appendCardsToPool(poolMap, poolId, Array.isArray(entries) ? entries : [], config.poolLabels?.[poolId]);
        });
    };

    applyConfig(defaultConfig);
    applyConfig(deckConfig);

    return poolMap;
}

function normalizePoolWeights(weights) {
    if (!Array.isArray(weights)) {
        return null;
    }
    const normalized = weights
        .map((entry) => {
            const id = typeof entry?.id === "string" ? entry.id : null;
            const weight = Number.isFinite(entry?.weight) ? entry.weight : null;
            if (!id || weight == null) {
                return null;
            }
            return { id, weight };
        })
        .filter(Boolean);
    return normalized.length > 0 ? normalized : null;
}

function resolvePositiveInteger(candidate) {
    if (!Number.isFinite(candidate)) {
        return null;
    }
    const rounded = Math.ceil(candidate);
    return rounded > 0 ? rounded : null;
}

function resolveNonNegativeInteger(candidate) {
    if (!Number.isFinite(candidate)) {
        return null;
    }
    const rounded = Math.ceil(candidate);
    return rounded >= 0 ? rounded : null;
}

function resolveNonNegativeNumber(candidate) {
    if (!Number.isFinite(candidate)) {
        return null;
    }
    return candidate >= 0 ? candidate : null;
}

function resolveDeckCardShopProfile(deckId) {
    const defaultConfig = DECK_CARD_SHOP_CONFIG?.default ?? {};
    const deckConfig = deckId && DECK_CARD_SHOP_CONFIG ? DECK_CARD_SHOP_CONFIG[deckId] : null;

    const pools = buildDeckCardPoolMap(defaultConfig, deckConfig);
    const poolWeights =
        normalizePoolWeights(deckConfig?.poolWeights) ??
        normalizePoolWeights(defaultConfig?.poolWeights) ??
        CARD_SHOP_POOL_WEIGHTS;
    const slotCount =
        resolvePositiveInteger(deckConfig?.slotCount) ??
        resolvePositiveInteger(defaultConfig?.slotCount) ??
        CARD_SHOP_SETTINGS.slotCount;
    const cardPrice =
        resolveNonNegativeNumber(deckConfig?.cardPrice) ??
        resolveNonNegativeNumber(defaultConfig?.cardPrice) ??
        CARD_SHOP_SETTINGS.cardPrice;
    const rerollCost =
        resolveNonNegativeInteger(deckConfig?.rerollCost) ??
        resolveNonNegativeInteger(defaultConfig?.rerollCost) ??
        null;
    const rerollIncrement =
        resolveNonNegativeInteger(deckConfig?.rerollIncrement) ??
        resolveNonNegativeInteger(defaultConfig?.rerollIncrement) ??
        null;

    return {
        pools,
        poolWeights,
        slotCount,
        cardPrice,
        rerollCost,
        rerollIncrement
    };
}

function resolveCardShopPoolOdds(state) {
    const boostActive = state?.cardShopRarityBoost === true;
    const poolWeights = state?.cardShop?.poolWeights ?? CARD_SHOP_POOL_WEIGHTS;
    const pools = state?.cardShop?.pools ?? GENERAL_CARD_SHOP_POOLS;
    return poolWeights.map(({ id, weight }) => {
        const pool = pools[id];
        if (!pool) {
            return null;
        }
        let adjustedWeight = weight;
        if (boostActive) {
            if (id === "uncommon") {
                adjustedWeight *= 2;
            } else if (id === "rare") {
                adjustedWeight *= 3;
            }
        }
        return adjustedWeight > 0 ? { pool, weight: adjustedWeight } : null;
    }).filter(Boolean);
}

const RANK_SYMBOL_NAME_MAP = new Map(RANKS.map(({ symbol, name }) => [symbol, name]));

function formatChipPrice(value) {
    return formatChipAmount(value, { includeSymbol: true });
}

function resolveRerollCost(state) {
    const cost = state?.cardShop?.rerollDiceCost;
    if (!Number.isFinite(cost) || cost < 0) {
        return 0;
    }
    return Math.ceil(cost);
}

function resolveRerollIncrement(state) {
    const increment = state?.cardShop?.rerollDiceIncrement;
    if (!Number.isFinite(increment) || increment < 0) {
        return 0;
    }
    return Math.ceil(increment);
}

function updateRerollDisplay(state) {
    if (!state?.cardShop) {
        return;
    }
    const cost = resolveRerollCost(state);
    const formattedCost = formatDiceAmount(cost);
    const priceElement = state.dom?.cardShopRerollPrice ?? null;
    if (priceElement) {
        priceElement.textContent = "";
        const span = document.createElement("span");
        span.className = "dice-shop-text";
        span.textContent = formattedCost;
        priceElement.append(span);
    }
    const button = state.dom?.cardShopRerollButton ?? null;
    if (button) {
        const affordable = canAffordDice(cost);
        button.disabled = !affordable;
        button.setAttribute("aria-label", `reroll: ${formattedCost}`);
    }
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
        isDrawn: false,
        textSize: card.textSize ?? null
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

function generateCardShopOffer(state) {
    const selection = selectPoolByWeight(resolveCardShopPoolOdds(state));
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
    const baseCardPrice = state?.cardShop?.cardPrice ?? CARD_SHOP_SETTINGS.cardPrice;
    const price = template.price ?? baseCardPrice;
    const textSize = template.textSize ?? null;

    if (type === "discard") {
        return {
            type,
            poolId: pool.id,
            rarity,
            price,
            label: template.label ?? "discard",
            icon: template.icon ?? "X",
            textSize
        };
    }

    const card = {
        rank: template.rank,
        value: template.value,
        rankName: template.rankName,
        suit: template.suit,
        suitName: template.suitName,
        color: template.color,
        label: template.label,
        textSize
    };

    return {
        type: "card",
        card,
        rarity,
        price,
        poolId: pool.id,
        textSize
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

            // apply text size if specified (after all classes are set)
            const textSize = offer.textSize ?? offer.card?.textSize ?? null;
            if (textSize) {
                cardButton.style.setProperty("font-size", textSize, "important");
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

            const price = document.createElement("button");
            price.type = "button";
            price.className = "card-shop-card-price button";
            price.dataset.slot = `${index}`;
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

    updateRerollDisplay(state);
}

export function updateDiscardDisplay(state) {
    if (!state?.dom) {
        return;
    }
    const count = state.discards ?? 0;
    const discardValue = state.dom.cardShopDiscardValue ?? null;
    if (discardValue) {
        discardValue.textContent = `${count}`;
    }
    const discardButton = state.dom.cardShopDiscardButton ?? null;
    const hasDiscards = count > 0;
    const isActive = state.deckDiscardActive === true && hasDiscards;

    if (discardButton) {
        discardButton.disabled = !hasDiscards;
        discardButton.setAttribute("aria-pressed", isActive ? "true" : "false");
        discardButton.classList.toggle("is-active", isActive);
        discardButton.setAttribute("aria-label", `discards: ${count}`);
        if (!hasDiscards && state.deckDiscardActive) {
            state.deckDiscardActive = false;
        }
    }

    const deckGrid = state.dom.deckGrid ?? null;
    if (deckGrid) {
        const shouldHighlight = state.deckDiscardActive === true && hasDiscards;
        deckGrid.classList.toggle("deck-discard-active", shouldHighlight);
    }
}

function rerollCardShop(state, { silent = false } = {}) {
    if (!state?.cardShop) {
        return;
    }
    state.cardShop.draggingOffer = null;
    const frozenSlotIndex = state.cardShop.frozenOffer?.fromSlotIndex ?? null;
    for (let index = 0; index < state.cardShop.slots.length; index += 1) {
        if (frozenSlotIndex !== index) {
            state.cardShop.slots[index] = generateCardShopOffer(state);
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

    const deckSlots = Array.isArray(state.deckSlots) ? state.deckSlots : [];
    const openSlot = deckSlots.findIndex((card, index) => {
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
    deckSlots[openSlot] = newCard;
    invalidateDeckCache(state);
    updateDeckBaseline(state);
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

    if (typeof state?.cardShop?.diceUnsubscribe === "function") {
        state.cardShop.diceUnsubscribe();
    }

    const deckShopProfile = resolveDeckCardShopProfile(state?.config?.id);
    const slotCount = Math.max(1, deckShopProfile.slotCount ?? CARD_SHOP_SETTINGS.slotCount);

    const baseRerollCostCandidate = Number.isFinite(state?.config?.rerollCost) && state.config.rerollCost >= 0
        ? Math.ceil(state.config.rerollCost)
        : null;
    const incrementCandidate =
        Number.isFinite(state?.config?.rerollIncrement) && state.config.rerollIncrement >= 0
            ? Math.ceil(state.config.rerollIncrement)
            : null;
    const fallbackRerollCost = baseRerollCostCandidate ?? DEFAULT_REROLL_DICE_COST;
    const fallbackRerollIncrement = incrementCandidate ?? DEFAULT_REROLL_DICE_INCREMENT;

    const baseRerollCost = deckShopProfile.rerollCost ?? fallbackRerollCost;
    const rerollIncrement = deckShopProfile.rerollIncrement ?? fallbackRerollIncrement;

    state.cardShop = {
        slots: Array.from({ length: slotCount }, () => null),
        frozenOffer: null,
        cardPrice: deckShopProfile.cardPrice ?? CARD_SHOP_SETTINGS.cardPrice,
        pools: deckShopProfile.pools,
        poolWeights: deckShopProfile.poolWeights,
        draggingOffer: null,
        baseRerollDiceCost: baseRerollCost,
        rerollDiceCost: baseRerollCost,
        rerollDiceIncrement: rerollIncrement,
        diceUnsubscribe: null
    };
    state.cardShop.diceUnsubscribe = subscribeToDiceChanges(() => updateRerollDisplay(state));
    state.refreshCardShopOdds = () => {
        rerollCardShop(state, { silent: true });
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

        const priceButton = event.target.closest(".card-shop-card-price");
        if (priceButton) {
            event.stopPropagation();
            const slotIndexValue = Number.parseInt(priceButton.dataset.slot ?? "", 10);
            if (Number.isNaN(slotIndexValue)) {
                return;
            }
            if (typeof priceButton.blur === "function") {
                priceButton.blur();
            }
            handleCardShopPurchase(state, "shop", slotIndexValue);
            return;
        }
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
            if (!state?.cardShop) {
                return;
            }
            const cost = resolveRerollCost(state);
            if (!canAffordDice(cost)) {
                updateRerollDisplay(state);
                return;
            }
            if (!spendDice(cost)) {
                updateRerollDisplay(state);
                return;
            }
            rerollCardShop(state);
            const increment = resolveRerollIncrement(state);
            const nextCost = Math.max(0, cost + increment);
            state.cardShop.rerollDiceCost = nextCost;
            updateRerollDisplay(state);
        });
    }

    rerollCardShop(state, { silent: true });
    updateRerollDisplay(state);
}
