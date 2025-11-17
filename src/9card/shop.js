import {
    CARD_SHOP_POOL_WEIGHTS,
    CARD_SHOP_SETTINGS,
    RANKS,
    DEFAULT_REROLL_DICE_COST,
    DEFAULT_REROLL_DICE_INCREMENT
} from "./config.js";
import { CARD_SHOP_CONFIG } from "./card-shop-config.js";
import { createStandardDeck, invalidateDeckCache, updateDeckBaseline } from "./deck-utils.js";
import { renderDeckGrid } from "./ui.js";
import { formatChipAmount } from "./chips.js";
import { formatStatusAmount } from "./status.js";
import { getUnpurchasedUniqueUpgrades, purchaseUpgradeById } from "./upgrades.js";

const DISCARD_SHOP_ITEM = {
    id: "discard",
    type: "discard",
    rarity: "uncommon",
    price: CARD_SHOP_SETTINGS.cardPrice,
    label: "discard",
    icon: "X",
    textSize: "3rem"
};

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
        cards: [DISCARD_SHOP_ITEM]
    },
    rare: {
        id: "rare",
        label: "rare pool",
        cards: []
    }
};

function buildUpgradeOfferTemplates(state) {
    const upgrades = getUnpurchasedUniqueUpgrades(state);
    if (!Array.isArray(upgrades) || upgrades.length === 0) {
        return [];
    }
    return upgrades
        .map((upgrade) => {
            if (!upgrade?.id) {
                return null;
            }
            const price = Number.isFinite(upgrade.cost)
                ? upgrade.cost
                : Number.isFinite(upgrade.uniqueCost)
                  ? upgrade.uniqueCost
                  : 0;
            const label =
                typeof upgrade.title === "string" && upgrade.title.trim()
                    ? upgrade.title.trim()
                    : upgrade.id;
            const description =
                typeof upgrade.description === "string" && upgrade.description.trim()
                    ? upgrade.description.trim()
                    : "";
            const presentation =
                upgrade.presentation && typeof upgrade.presentation === "object"
                    ? upgrade.presentation
                    : {};
            const glyph =
                typeof presentation.glyph === "string" && presentation.glyph
                    ? presentation.glyph
                    : typeof upgrade.glyph === "string" && upgrade.glyph
                      ? upgrade.glyph
                      : null;
            const glyphColor =
                typeof presentation.glyphColor === "string" && presentation.glyphColor
                    ? presentation.glyphColor
                    : typeof upgrade.glyphColor === "string" && upgrade.glyphColor
                      ? upgrade.glyphColor
                      : null;
            const backgroundColor =
                typeof presentation.backgroundColor === "string" && presentation.backgroundColor
                    ? presentation.backgroundColor
                    : typeof upgrade.backgroundColor === "string" && upgrade.backgroundColor
                      ? upgrade.backgroundColor
                      : null;
            const textSize =
                typeof presentation.textSize === "string" && presentation.textSize
                    ? presentation.textSize
                    : typeof upgrade.textSize === "string" && upgrade.textSize
                      ? upgrade.textSize
                      : null;
            const borderColor =
                typeof presentation.borderColor === "string" && presentation.borderColor
                    ? presentation.borderColor
                    : typeof upgrade.borderColor === "string" && upgrade.borderColor
                      ? upgrade.borderColor
                      : null;
            return {
                type: "upgrade",
                upgradeId: upgrade.id,
                rarity: "uncommon",
                price,
                priceCurrency: "status",
                label,
                description,
                glyph,
                glyphColor,
                backgroundColor,
                textSize,
                borderColor
            };
        })
        .filter(Boolean);
}

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

function resolveDeckCardShopProfile() {
    const baseConfig = CARD_SHOP_CONFIG ?? {};

    const pools = buildDeckCardPoolMap(baseConfig, null);
    const poolWeights = normalizePoolWeights(baseConfig?.poolWeights) ?? CARD_SHOP_POOL_WEIGHTS;
    const slotCount = resolvePositiveInteger(baseConfig?.slotCount) ?? CARD_SHOP_SETTINGS.slotCount;
    const cardPrice =
        resolveNonNegativeNumber(baseConfig?.cardPrice) ?? CARD_SHOP_SETTINGS.cardPrice;
    const rerollCost = resolveNonNegativeInteger(baseConfig?.rerollCost) ?? null;
    const rerollIncrement = resolveNonNegativeInteger(baseConfig?.rerollIncrement) ?? null;

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
        if (!pool || !Array.isArray(pool.cards) || pool.cards.length === 0) {
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

function formatOfferPrice(offer) {
    if (!offer) {
        return formatChipPrice(0);
    }
    const price = Number.isFinite(offer.price) ? offer.price : 0;
    const currency = offer.priceCurrency ?? "chips";
    if (currency === "status") {
        return formatStatusAmount(price);
    }
    return formatChipPrice(price);
}

function resolveCardShopValueMultiplier(state) {
    if (!Number.isFinite(state?.cardShopValueMultiplier)) {
        return 1;
    }
    return state.cardShopValueMultiplier > 0 ? state.cardShopValueMultiplier : 1;
}

function resolveCardOfferPrice(state, template) {
    const baseCardPrice = state?.cardShop?.cardPrice ?? CARD_SHOP_SETTINGS.cardPrice;
    const templatePrice = Number.isFinite(template?.price) ? template.price : null;
    const type = template?.type ?? "card";
    if (type === "card") {
        const value = Number.isFinite(template?.value) ? template.value : null;
        if (value != null) {
            const multiplier = resolveCardShopValueMultiplier(state);
            return Math.max(0, Math.ceil(value * multiplier));
        }
    }
    return templatePrice ?? baseCardPrice;
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
        textSize: card.textSize ?? null,
        deckTextSize: card.deckTextSize ?? null
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

function generateCardShopOffer(state, context = {}) {
    const selection = selectPoolByWeight(resolveCardShopPoolOdds(state));
    const pool = selection?.pool;
    if (!pool) {
        return null;
    }
    let candidates = Array.isArray(pool.cards) ? [...pool.cards] : [];
    if (
        pool.id === "uncommon" &&
        Array.isArray(context.upgradeTemplates) &&
        context.upgradeTemplates.length > 0
    ) {
        candidates = candidates.concat(context.upgradeTemplates);
    }
    const template = getRandomArrayItem(candidates);
    if (!template) {
        return null;
    }
    const type = template.type ?? "card";
    const rarity = template.rarity ?? pool.id;
    const price = resolveCardOfferPrice(state, template);
    const textSize = template.textSize ?? null;

    if (type === "discard") {
        return {
            type,
            poolId: pool.id,
            rarity,
            price,
            priceCurrency: "chips",
            label: template.label ?? "discard",
            icon: template.icon ?? "X",
            textSize
        };
    }

    if (type === "upgrade" && template.upgradeId) {
        if (Array.isArray(context.upgradeTemplates)) {
            const templateIndex = context.upgradeTemplates.indexOf(template);
            if (templateIndex >= 0) {
                context.upgradeTemplates.splice(templateIndex, 1);
            }
        }
        return {
            type: "upgrade",
            upgradeId: template.upgradeId,
            rarity: rarity ?? "uncommon",
            price: Number.isFinite(template.price) ? template.price : 0,
            priceCurrency: template.priceCurrency ?? "status",
            label: template.label ?? template.upgradeId,
            description: template.description ?? "",
            glyph: template.glyph ?? null,
            glyphColor: template.glyphColor ?? null,
            backgroundColor: template.backgroundColor ?? null,
            textSize: template.textSize ?? null
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
        textSize,
        deckTextSize: template.deckTextSize ?? null
    };

    return {
        type: "card",
        card,
        rarity,
        price,
        priceCurrency: "chips",
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
    const availableUpgradeIds = new Set(
        getUnpurchasedUniqueUpgrades(state).map((upgrade) => upgrade.id)
    );

    for (let index = 0; index < cardShop.slots.length; index += 1) {
        let offer = cardShop.slots[index];
        if (offer?.type === "upgrade" && offer.upgradeId && !availableUpgradeIds.has(offer.upgradeId)) {
            state.cardShop.slots[index] = null;
            offer = null;
        }
        const slotWrapper = document.createElement("div");
        slotWrapper.className = "card-shop-slot-wrapper";

        const slot = document.createElement("div");
        slot.className = "card-shop-slot";
        slot.dataset.slot = `${index}`;

        if (offer) {
            slot.classList.add("has-offer");
            const cardButton = document.createElement("button");
            cardButton.type = "button";
            cardButton.className = "card-shop-card card-shop-object";
            cardButton.dataset.source = "shop";
            cardButton.dataset.slot = `${index}`;

            const offerType = offer.type ?? "card";
            cardButton.dataset.offerType = offerType;
            cardButton.draggable = offerType === "card";

            const rarity = getOfferRarity(offer);
            if (rarity) {
                cardButton.dataset.rarity = rarity;
                if (rarity !== "common" && offerType !== "discard") {
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
                cardButton.style.borderColor = "transparent";

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
            } else if (offerType === "upgrade") {
                cardButton.classList.add("card-shop-card-upgrade");
                const glyph = offer.glyph ?? null;
                const labelText = offer.label ?? "upgrade";
                const description = offer.description ?? "";
                cardButton.textContent = glyph ?? labelText;
                const upgradeOutlineColor = offer.borderColor ?? "currentColor";
                cardButton.style.setProperty("--card-shop-upgrade-outline-color", upgradeOutlineColor);
                cardButton.style.borderColor = "transparent";
                if (offer.backgroundColor) {
                    cardButton.style.backgroundColor = offer.backgroundColor;
                }
                if (offer.glyphColor) {
                    cardButton.style.color = offer.glyphColor;
                }
                descriptionText = description ? `${labelText}: ${description}` : labelText;
            } else {
                cardButton.textContent = offer.icon ?? "X";
                cardButton.classList.add("card-shop-card-discard");
                descriptionText = "+1 discard";
                cardButton.style.borderColor = "transparent";
            }

            // apply text size if specified (after all classes are set)
            const textSize = offer.textSize ?? offer.card?.textSize ?? null;
            if (textSize) {
                cardButton.style.setProperty("font-size", textSize, "important");
            }
            if (!textSize) {
                cardButton.style.removeProperty("font-size");
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
            const formattedPrice = formatOfferPrice(offer);
            price.textContent = formattedPrice;
            price.dataset.currency = offer.priceCurrency ?? "chips";

            cardContainer.append(cardButton, description);

            slot.append(cardContainer, price);
            slotWrapper.append(slot);
        } else {
            slot.classList.add("empty");
            slotWrapper.append(slot);
        }

        slotsFragment.append(slotWrapper);
    }

    state.dom.cardShopSlots.replaceChildren(slotsFragment);
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
    const isPending = state.deckDiscardActivationRequested === true && !isActive;

    if (discardButton) {
        discardButton.disabled = !hasDiscards;
        discardButton.setAttribute("aria-pressed", isActive ? "true" : "false");
        discardButton.classList.toggle("is-active", isActive);
        discardButton.setAttribute("aria-label", `discards: ${count}`);
        if (isPending) {
            discardButton.setAttribute("aria-busy", "true");
        } else {
            discardButton.removeAttribute("aria-busy");
        }
        if (!hasDiscards) {
            state.deckDiscardActive = false;
            state.deckDiscardActivationRequested = false;
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
    const context = {
        upgradeTemplates: buildUpgradeOfferTemplates(state)
    };
    for (let index = 0; index < state.cardShop.slots.length; index += 1) {
        state.cardShop.slots[index] = generateCardShopOffer(state, context);
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
    if (offerType === "upgrade") {
        if (offer.upgradeId) {
            const purchased = purchaseUpgradeById(state, offer.upgradeId);
            if (purchased && slotIndex != null && slotIndex >= 0) {
                state.cardShop.slots[slotIndex] = null;
                renderCardShop(state);
            }
        }
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

    const deckShopProfile = resolveDeckCardShopProfile();
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
        cardPrice: deckShopProfile.cardPrice ?? CARD_SHOP_SETTINGS.cardPrice,
        pools: deckShopProfile.pools,
        poolWeights: deckShopProfile.poolWeights,
        draggingOffer: null,
        baseRerollDiceCost: baseRerollCost,
        rerollDiceCost: baseRerollCost,
        rerollDiceIncrement: rerollIncrement
    };
    state.refreshCardShopOdds = () => {
        rerollCardShop(state, { silent: true });
    };
    state.rerollCardShopOffers = () => {
        rerollCardShop(state);
    };

    state.uniqueUpgradeRerollCost = state.cardShop.rerollDiceCost;
    if (typeof state.renderUpgrades === "function") {
        state.renderUpgrades();
    }

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
        if (source !== "shop") {
            return;
        }

        const slotIndexValue = Number.parseInt(card.dataset.slot ?? "", 10);
        if (Number.isNaN(slotIndexValue)) {
            return;
        }
        const offer = state.cardShop.slots[slotIndexValue];
        if (!offer) {
            return;
        }
        const payload = { source: "shop", slotIndex: slotIndexValue, offer };

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
        }
        clearDragState();
    });

    rerollCardShop(state, { silent: true });
}
