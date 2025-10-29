const STREAK_TARGET = 10;

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

function createDeck() {
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

function drawHand() {
    const deck = createDeck();
    for (let i = 0; i < 5; i += 1) {
        const swapIndex = i + Math.floor(Math.random() * (deck.length - i));
        const temp = deck[i];
        deck[i] = deck[swapIndex];
        deck[swapIndex] = temp;
    }
    return deck.slice(0, 5);
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

    root.append(row, result);

    return {
        root,
        button,
        handContainer,
        result
    };
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

function buildResultMessage({ success, classification, streak }) {
    if (success) {
        return `hit ${classification.label} ${streak}/${STREAK_TARGET}`;
    }
    return "missed";
}

function handleDraw(state) {
    if (!state) {
        return;
    }
    const cards = drawHand();
    const classification = classifyHand(cards);
    const success = classification.id === state.config.target;

    if (success) {
        state.streak += 1;
    } else {
        state.streak = 0;
    }

    const highlightIndices = success ? getHighlightIndices(cards, classification.id) : [];
    updateHandDisplay(state.dom.handContainer, cards, highlightIndices);

    const message = buildResultMessage({
        success,
        classification,
        streak: state.streak
    });

    state.dom.result.textContent = message;
    state.dom.result.classList.toggle("success", success);
    state.dom.result.classList.toggle("fail", !success);

    if (state.streak >= STREAK_TARGET) {
        state.dom.button.disabled = true;
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
        display.replaceChildren(state.dom.root);
        deckStates.forEach((entry) => {
            const isActive = entry === state;
            entry.navButton.classList.toggle("active", isActive);
            entry.navButton.setAttribute("aria-pressed", isActive ? "true" : "false");
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

        const state = {
            config,
            dom,
            navButton,
            streak: 0
        };

        navButton.addEventListener("click", () => activateDeck(state));
        state.dom.button.addEventListener("click", () => handleDraw(state));
        tabList.append(navButton);
        deckStates.push(state);

        if (index === 0) {
            activateDeck(state);
        }
    });
}

initPokerPage();
