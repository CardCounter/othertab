import {
    DECKS,
    HAND_LABELS,
    HAND_SIZE,
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
            handSize: config.handSize ?? HAND_SIZE,
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
            defaultAnimationDuration: 1000,
            defaultAnimationFrameDelay: 70,
            autoDrawEnabled: false,
            autoDrawScheduled: false,
            autoDrawTimerId: null,
            autoDrawInterval: 0,
            baseChipReward: config.baseChipReward ?? DEFAULT_BASE_CHIP_PAYOUT,
            chipStreakMultiplier:
                config.chipStreakMultiplier ?? DEFAULT_STREAK_CHIP_MULTIPLIER
        };

        setupDeckManagement(state);
        setupCardShop(state);
        setupDeckUpgrades(state);

        const updateAutoButton = () => {
            state.dom.autoButton.classList.toggle("auto-draw-enabled", state.autoDrawEnabled);
            state.dom.autoButton.textContent = state.autoDrawEnabled ? "auto: on" : "auto: off";
            state.dom.autoButton.setAttribute("aria-pressed", state.autoDrawEnabled ? "true" : "false");
        };

        const cancelScheduledAutoDraw = () => {
            if (state.autoDrawTimerId !== null) {
                clearTimeout(state.autoDrawTimerId);
                state.autoDrawTimerId = null;
            }
            state.autoDrawScheduled = false;
        };

        const setAutoDrawEnabled = (enabled) => {
            if (state.autoDrawEnabled === enabled) {
                return;
            }
            state.autoDrawEnabled = enabled;
            if (enabled) {
                state.animationDuration = 0;
                state.animationFrameDelay = 0;
                updateAutoButton();
                if (!state.pendingDraw && !state.isAnimating) {
                    handleDraw(state);
                }
            } else {
                state.animationDuration = state.defaultAnimationDuration;
                state.animationFrameDelay = state.defaultAnimationFrameDelay;
                cancelScheduledAutoDraw();
                updateAutoButton();
            }
        };

        state.setAutoDrawEnabled = setAutoDrawEnabled;

        navButton.addEventListener("click", () => activateDeck(state));
        state.dom.button.addEventListener("click", () => handleDraw(state));
        updateAutoButton();
        state.dom.autoButton.addEventListener("click", () =>
            setAutoDrawEnabled(!state.autoDrawEnabled)
        );
        setupKeyboardControls(state, () => handleDraw(state));

        tabList.append(navButton);
        deckStates.push(state);

        if (index === 0) {
            activateDeck(state);
        }
    });
}
