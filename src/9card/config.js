export const STREAK_TARGET = 9;
export const HAND_SIZE = 5;
export const MIN_DECK_CARD_COUNT = 45;
export const DEFAULT_BASE_CHIP_PAYOUT = 1;
export const DEFAULT_STREAK_CHIP_MULTIPLIER = 1;
export const CHIP_SYMBOL = "⛁";
export const DICE_SYMBOL = "⚂";
export const DEFAULT_REROLL_DICE_COST = 1;
export const DEFAULT_REROLL_DICE_INCREMENT = 1;

export const RANKS = [
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

export const SUITS = [
    { symbol: "♠", name: "spades", color: "black" },
    { symbol: "♣", name: "clubs", color: "black" },
    { symbol: "♥", name: "hearts", color: "red" },
    { symbol: "♦", name: "diamonds", color: "red" }
];

export const SUIT_DISPLAY_ORDER = ["♠", "♥", "♣", "♦"];
export const RANK_DISPLAY_ORDER = [...RANKS].slice().reverse().map((rank) => rank.symbol);

export const SUIT_ORDER_INDEX = new Map(
    SUIT_DISPLAY_ORDER.map((suit, index) => [suit, index])
);
export const RANK_ORDER_INDEX = new Map(
    RANK_DISPLAY_ORDER.map((symbol, index) => [symbol, index])
);

export const CARDS_PER_ROW = RANK_DISPLAY_ORDER.length;
export const EXTRA_BOTTOM_SLOTS = 13;
export const TOTAL_MAIN_SLOTS = SUIT_DISPLAY_ORDER.length * CARDS_PER_ROW;
export const TOTAL_SLOTS = TOTAL_MAIN_SLOTS + EXTRA_BOTTOM_SLOTS;

export const HAND_LABELS = {
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

export const DECKS = [
    {
        id: "high_card",
        title: "high card deck",
        subtitle: "draw nine pure high card hands.",
        target: "high_card",
        successNoun: "high cards"
    },
    {
        id: "pair",
        title: "pair deck",
        subtitle: "collect nine pairs back to back.",
        target: "pair",
        successNoun: "pair"
    },
    {
        id: "two_pair",
        title: "two pair deck",
        subtitle: "double up nine times in a row.",
        target: "two_pair",
        successNoun: "two pairs"
    },
    {
        id: "three_kind",
        title: "three of a kind deck",
        subtitle: "triplets only, nine consecutive hits.",
        target: "three_kind",
        successNoun: "three of a kind hands"
    },
    {
        id: "straight",
        title: "straight deck",
        subtitle: "line up nine straights without slipping.",
        target: "straight",
        successNoun: "straights"
    },
    {
        id: "flush",
        title: "flush deck",
        subtitle: "nine flushes or the streak resets.",
        target: "flush",
        successNoun: "flushes"
    },
    {
        id: "full_house",
        title: "full house deck",
        subtitle: "stack nine full houses in order.",
        target: "full_house",
        successNoun: "full houses"
    },
    {
        id: "four_kind",
        title: "four of a kind deck",
        subtitle: "four of a kind, nine times straight.",
        target: "four_kind",
        successNoun: "four of a kind hands"
    },
    {
        id: "straight_flush",
        title: "straight flush deck",
        subtitle: "nine straight flushes before you blink.",
        target: "straight_flush",
        successNoun: "straight flushes"
    },
    {
        id: "royal_flush",
        title: "royal flush deck",
        subtitle: "nine royal flushes. perfection only.",
        target: "royal_flush",
        successNoun: "royal flushes"
    }
];

export const CARD_SHOP_SETTINGS = {
    cardPrice: 0,
    slotCount: 5,
    freezeCapacity: 1
};

export const CARD_SHOP_POOL_WEIGHTS = [
    { id: "common", weight: 0 },
    { id: "uncommon", weight: 50 },
    { id: "rare", weight: 50 }
];
