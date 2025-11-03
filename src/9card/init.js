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
import { initDiceDisplay } from "./dice.js";
import { setupDeckUpgrades } from "./upgrades.js";
import { getDeckEvaluator } from "./evaluators/index.js";

export function initPokerPage() {
    const tabList = document.getElementById("poker-tabs");
    const display = document.getElementById("poker-display");
    if (!tabList || !display) {
        return;
    }

    const deckStates = [];

    initChipDisplay();
    initDiceDisplay();

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
            autoDrawUnlocked: false,
            autoDrawScheduled: false,
            autoDrawTimerId: null,
            autoDrawInterval: 0,
            chipRewardMultiplier: 1,
            diceRewardMultiplier: 1,
            cardShopRarityBoost: false,
            baseChipReward: config.baseChipReward ?? DEFAULT_BASE_CHIP_PAYOUT,
            chipStreakMultiplier:
                config.chipStreakMultiplier ?? DEFAULT_STREAK_CHIP_MULTIPLIER,
            evaluateHand: getDeckEvaluator(config.id)
        };

        function updateAutoButton() {
            const button = state.dom.autoButton;
            if (!button) {
                return;
            }
            const unlocked = state.autoDrawUnlocked === true;
            button.hidden = !unlocked;
            if (unlocked) {
                button.removeAttribute("aria-hidden");
                button.tabIndex = 0;
            } else {
                button.setAttribute("aria-hidden", "true");
                button.tabIndex = -1;
            }
            button.disabled = !unlocked;
            if (!unlocked) {
                button.classList.remove("auto-draw-enabled");
                button.setAttribute("aria-pressed", "false");
                button.textContent = "auto: off";
                return;
            }
            button.classList.toggle("auto-draw-enabled", state.autoDrawEnabled);
            button.textContent = state.autoDrawEnabled ? "auto: on" : "auto: off";
            button.setAttribute("aria-pressed", state.autoDrawEnabled ? "true" : "false");
        }

        function cancelScheduledAutoDraw() {
            if (state.autoDrawTimerId !== null) {
                clearTimeout(state.autoDrawTimerId);
                state.autoDrawTimerId = null;
            }
            state.autoDrawScheduled = false;
        }

        function setAutoDrawEnabled(enabled) {
            const nextEnabled = enabled === true;
            if (nextEnabled && !state.autoDrawUnlocked) {
                updateAutoButton();
                return;
            }
            if (state.autoDrawEnabled === nextEnabled) {
                updateAutoButton();
                return;
            }
            state.autoDrawEnabled = nextEnabled;
            if (nextEnabled) {
                updateAutoButton();
                if (!state.pendingDraw && !state.isAnimating) {
                    handleDraw(state);
                }
                return;
            }
            cancelScheduledAutoDraw();
            updateAutoButton();
        }

        function setAutoDrawUnlocked(unlocked) {
            const nextUnlocked = unlocked === true;
            if (!nextUnlocked && state.autoDrawEnabled) {
                state.autoDrawEnabled = false;
                cancelScheduledAutoDraw();
            }
            if (state.autoDrawUnlocked === nextUnlocked) {
                updateAutoButton();
                return;
            }
            state.autoDrawUnlocked = nextUnlocked;
            updateAutoButton();
        }

        state.updateAutoButton = updateAutoButton;
        state.setAutoDrawEnabled = setAutoDrawEnabled;
        state.setAutoDrawUnlocked = setAutoDrawUnlocked;

        setAutoDrawUnlocked(false);

        setupDeckManagement(state);
        setupCardShop(state);
        setupDeckUpgrades(state);

        const autoDrawUpgrade = state.upgrades?.find((upgrade) => upgrade?.id === "auto_draw_unlock");
        const autoDrawPurchased =
            autoDrawUpgrade?.purchased === true ||
            (Number.isFinite(autoDrawUpgrade?.level) && autoDrawUpgrade.level > 0);
        setAutoDrawUnlocked(autoDrawPurchased);

        navButton.addEventListener("click", () => activateDeck(state));
        state.dom.button.addEventListener("click", () => handleDraw(state));
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
