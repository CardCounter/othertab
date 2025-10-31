import {
    DECKS,
    HAND_LABELS,
    DEFAULT_BASE_CHIP_PAYOUT,
    DEFAULT_STREAK_CHIP_MULTIPLIER
} from "./config.js";
import {
    createDeckSlotsFromCards,
    getInitialDeckForChallenge,
    snapshotDeckSlots
} from "./deck-utils.js";
import { createDeckElement } from "./ui.js";
import { clearPendingDelete, setupDeckManagement } from "./deck-management.js";
import { setupCardShop } from "./shop.js";
import { handleDraw } from "./draw.js";
import { setupKeyboardControls } from "./keyboard.js";
import { initChipDisplay } from "./chips.js";
import { setupDeckUpgrades } from "./upgrades.js";

export function initPokerPage() {
    const tabList = document.getElementById("poker-tabs");
    const display = document.getElementById("poker-display");
    if (!tabList || !display) {
        return;
    }

    const deckStates = [];

    initChipDisplay();

    const activateDeck = (state) => {
        if (!state) {
            return;
        }
        clearPendingDelete();
        deckStates.forEach((entry) => {
            const isActive = entry === state;
            entry.navButton.classList.toggle("active", isActive);
            entry.navButton.setAttribute("aria-pressed", isActive ? "true" : "false");
            if (entry.permanentlyCompleted) {
                entry.navButton.classList.add("completed");
            } else {
                entry.navButton.classList.remove("completed");
            }
        });
        display.replaceChildren(state.dom.root);
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
        const deckSlots = createDeckSlotsFromCards(initialCards);
        const state = {
            config,
            dom,
            navButton,
            streak: 0,
            permanentlyCompleted: false,
            deckSlots,
            deckBaselineSlots: snapshotDeckSlots(deckSlots),
            dragSourceSlot: null,
            dragSourceIsDrawn: false,
            isAnimating: false,
            animationDuration: 1000,
            animationFrameDelay: 70,
            pendingDraw: false,
            baseChipReward: config.baseChipReward ?? DEFAULT_BASE_CHIP_PAYOUT,
            chipStreakMultiplier:
                config.chipStreakMultiplier ?? DEFAULT_STREAK_CHIP_MULTIPLIER
        };

        setupDeckManagement(state);
        setupCardShop(state);
        setupDeckUpgrades(state);

        navButton.addEventListener("click", () => activateDeck(state));
        state.dom.button.addEventListener("click", () => handleDraw(state));
        setupKeyboardControls(state, () => handleDraw(state));

        tabList.append(navButton);
        deckStates.push(state);

        if (index === 0) {
            activateDeck(state);
        }
    });
}
