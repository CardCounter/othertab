import {
    RANKS,
    SUITS,
    SUIT_ORDER_INDEX,
    RANK_ORDER_INDEX,
    CARDS_PER_ROW,
    TOTAL_MAIN_SLOTS,
    TOTAL_SLOTS
} from "./config.js";

export function createStandardDeck() {
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
                label: `${rank.name} of ${suit.name}`,
                isDrawn: false
            });
        });
    });
    return deck;
}

export function createRankFilteredDeck(allowedRanks) {
    const rankSet = new Set(allowedRanks);
    return createStandardDeck().filter((card) => rankSet.has(card.rank));
}

export function createSuitFilteredDeck(
    allowedSuits,
    allowedRanks = RANKS.map((rank) => rank.symbol)
) {
    const suitSet = new Set(Array.isArray(allowedSuits) ? allowedSuits : [allowedSuits]);
    const rankSet = new Set(allowedRanks);
    return createStandardDeck().filter(
        (card) => suitSet.has(card.suit) && rankSet.has(card.rank)
    );
}

export function sortDeckCards(cards) {
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

export function getSlotIndexForCard(card) {
    const suitIndex = card?.suit ? SUIT_ORDER_INDEX.get(card.suit) : undefined;
    const rankIndex = card?.rank ? RANK_ORDER_INDEX.get(card.rank) : undefined;
    if (suitIndex == null || rankIndex == null) {
        return null;
    }
    return suitIndex * CARDS_PER_ROW + rankIndex;
}

export function createDeckSlotsFromCards(
    cards,
    { slotCount = TOTAL_SLOTS, blockedSlots = null } = {}
) {
    const size = Math.max(slotCount, 0);
    const slots = Array(size).fill(null);
    const blocked =
        blockedSlots && typeof blockedSlots.has === "function"
            ? blockedSlots
            : blockedSlots == null
              ? null
              : new Set(blockedSlots);

    const isBlocked = (index) => blocked?.has(index) ?? false;

    // first pass: try to place cards at their preferred positions (for non-duplicates)
    const preferredUsed = new Set();
    const unplacedCards = [];
    
    cards.forEach((card) => {
        const slotIndex = getSlotIndexForCard(card);
        if (
            slotIndex != null &&
            slotIndex < TOTAL_MAIN_SLOTS &&
            !isBlocked(slotIndex) &&
            !preferredUsed.has(slotIndex) &&
            slots[slotIndex] === null
        ) {
            slots[slotIndex] = card;
            preferredUsed.add(slotIndex);
        } else {
            unplacedCards.push(card);
        }
    });

    // second pass: place remaining cards (duplicates or cards that couldn't fit at preferred position)
    // compactly fill empty slots from front to back
    let nextIndex = 0;
    unplacedCards.forEach((card) => {
        // find next available slot starting from the beginning
        while (nextIndex < slots.length) {
            if (!isBlocked(nextIndex) && slots[nextIndex] === null) {
                slots[nextIndex] = card;
                nextIndex += 1;
                return;
            }
            nextIndex += 1;
        }
        // if we reach here, all slots are full or blocked, which shouldn't happen normally
        // but if it does, try to find any available slot
        const fallbackIndex = slots.findIndex(
            (entry, index) => entry === null && !isBlocked(index)
        );
        if (fallbackIndex !== -1) {
            slots[fallbackIndex] = card;
        }
    });

    // third pass: compact all cards to push empty slots to the back
    // collect all cards while preserving their exact object references
    const allCards = [];
    for (let i = 0; i < slots.length; i += 1) {
        if (slots[i] && !isBlocked(i)) {
            allCards.push(slots[i]);
        }
    }

    // verify we have all cards (safety check against original input)
    if (allCards.length !== cards.length) {
        // if card counts don't match, something went wrong, log for debugging
        console.warn(`card count mismatch: expected ${cards.length}, collected ${allCards.length}`);
    }

    // clear all non-blocked slots
    for (let i = 0; i < slots.length; i += 1) {
        if (!isBlocked(i)) {
            slots[i] = null;
        }
    }

    // place cards: try preferred positions first (one card per position), then compact rest
    const usedPreferred = new Set();
    const remainingCards = [];
    
    allCards.forEach((card) => {
        const preferredIndex = getSlotIndexForCard(card);
        if (
            preferredIndex != null &&
            preferredIndex < TOTAL_MAIN_SLOTS &&
            !isBlocked(preferredIndex) &&
            slots[preferredIndex] === null &&
            !usedPreferred.has(preferredIndex)
        ) {
            slots[preferredIndex] = card;
            usedPreferred.add(preferredIndex);
        } else {
            remainingCards.push(card);
        }
    });

    // place remaining cards compactly from front, ensuring no gaps
    let nextSlot = 0;
    remainingCards.forEach((card) => {
        while (nextSlot < slots.length) {
            if (!isBlocked(nextSlot) && slots[nextSlot] === null) {
                slots[nextSlot] = card;
                nextSlot += 1;
                break;
            }
            nextSlot += 1;
        }
    });

    // final compaction: shift all cards forward to eliminate gaps while preserving object references
    // collect all cards in their current order, preserving the exact object references
    const finalCards = [];
    for (let i = 0; i < slots.length; i += 1) {
        if (slots[i] && !isBlocked(i)) {
            finalCards.push(slots[i]);
        }
    }

    // verify we still have all cards after final placement
    if (finalCards.length !== cards.length) {
        console.warn(`card count mismatch after placement: expected ${cards.length}, found ${finalCards.length}`);
    }

    // clear all non-blocked slots
    for (let i = 0; i < slots.length; i += 1) {
        if (!isBlocked(i)) {
            slots[i] = null;
        }
    }

    // place cards compactly from front, preserving all object references
    let cardIndex = 0;
    for (let i = 0; i < slots.length && cardIndex < finalCards.length; i += 1) {
        if (!isBlocked(i)) {
            slots[i] = finalCards[cardIndex];
            cardIndex += 1;
        }
    }

    return slots;
}

export function getDeckCardsFromSlots(slots) {
    return slots.filter((card) => card);
}

export function getCachedDeckCards(state) {
    if (!state._cachedDeckArray) {
        state._cachedDeckArray = getDeckCardsFromSlots(state.deckSlots);
    }
    return state._cachedDeckArray;
}

export function invalidateDeckCache(state) {
    if (state) {
        state._cachedDeckArray = null;
    }
}

export function snapshotDeckSlots(slots) {
    return Array.isArray(slots) ? [...slots] : [];
}

export function removeCardsFromDeck(state, cards) {
    if (!state?.deckSlots || !Array.isArray(cards)) {
        return;
    }
    let removedAny = false;
    cards.forEach((card) => {
        const slotIndex = state.deckSlots.findIndex((slotCard) => slotCard === card);
        if (slotIndex !== -1) {
            state.deckSlots[slotIndex] = null;
            if (card) {
                card.isDrawn = true;
            }
            removedAny = true;
        }
    });
    if (removedAny) {
        invalidateDeckCache(state);
    }
}

export function updateDeckBaseline(state) {
    if (!state) {
        return;
    }
    const deckSlots = Array.isArray(state.deckSlots) ? state.deckSlots : [];
    const previousBaseline = Array.isArray(state.deckBaselineSlots)
        ? state.deckBaselineSlots
        : [];
    const slotCount = Math.max(TOTAL_SLOTS, deckSlots.length, previousBaseline.length);
    const newBaseline = Array(slotCount).fill(null);

    for (let index = 0; index < deckSlots.length; index += 1) {
        newBaseline[index] = deckSlots[index] ?? null;
    }

    if (previousBaseline.length === 0) {
        state.deckBaselineSlots = newBaseline;
        return;
    }

    const deckCardSet = new Set(deckSlots.filter((card) => card));
    const occupied = new Set();
    newBaseline.forEach((card, index) => {
        if (card) {
            occupied.add(index);
        }
    });

    const findNextOpenIndex = (startIndex) => {
        for (let i = startIndex; i < slotCount; i += 1) {
            if (!occupied.has(i) && newBaseline[i] == null) {
                return i;
            }
        }
        for (let i = 0; i < startIndex; i += 1) {
            if (!occupied.has(i) && newBaseline[i] == null) {
                return i;
            }
        }
        return -1;
    };

    previousBaseline.forEach((card, index) => {
        if (!card || deckCardSet.has(card)) {
            return;
        }
        let targetIndex = -1;
        if (index < slotCount && newBaseline[index] == null) {
            targetIndex = index;
        }
        if (targetIndex === -1) {
            targetIndex = findNextOpenIndex(index);
        }
        if (targetIndex !== -1) {
            newBaseline[targetIndex] = card;
            occupied.add(targetIndex);
        }
    });

    state.deckBaselineSlots = newBaseline;
}

export function getDeckCardCountFromSlots(slots) {
    return slots.reduce((count, card) => (card ? count + 1 : count), 0);
}

export function getSlotIndexFromTarget(target) {
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

export function getInitialDeckForChallenge(deckId) {
    return sortDeckCards(createStandardDeck());
}

export function drawHandFromDeck(deck, handSize) {
    const count = Number.isFinite(handSize) ? Math.floor(handSize) : 0;
    if (!Array.isArray(deck) || count <= 0 || deck.length < count) {
        return [];
    }
    const pool = [...deck];
    const hand = [];
    for (let i = 0; i < count; i += 1) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        hand.push(pool[randomIndex]);
        pool[randomIndex] = pool[pool.length - 1];
        pool.pop();
    }
    return hand;
}

export function moveCardInSlots(slots, fromSlot, toSlot) {
    if (!Array.isArray(slots)) {
        return;
    }
    const fromCard = slots[fromSlot];
    const toCard = slots[toSlot];
    slots[toSlot] = fromCard;
    slots[fromSlot] = toCard;
}
