import {
    DECKS,
    HAND_LABELS,
    HAND_SIZE,
    DEFAULT_BASE_CHIP_PAYOUT,
    DEFAULT_STREAK_CHIP_MULTIPLIER,
    DEFAULT_AUTO_DRAW_BURN_CARD_COST,
    STREAK_TARGET
} from "./config.js";
import {
    createDeckSlotsFromCards,
    getInitialDeckForChallenge,
    snapshotDeckSlots
} from "./deck-utils.js";
import { createDeckElement, updateStreakDisplay } from "./ui.js";
import { clearPendingDelete, setupDeckManagement } from "./deck-management.js";
import { setupCardShop } from "./shop.js";
import { handleDraw } from "./draw.js";
import { setupKeyboardControls } from "./keyboard.js";
import { initChipDisplay } from "./chips.js";
import { initDiceDisplay } from "./dice.js";
import { initStatusDisplay } from "./status.js";
import { formatBurnCardAmount, initBurnCardDisplay } from "./burn-cards.js";
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
    initStatusDisplay();
    initBurnCardDisplay();

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
        const hasPokerHandTarget = typeof config.target === "string" && config.target.length > 0;
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
            autoDrawUnlocked: hasPokerHandTarget,
            autoDrawVisible: false,
            autoDrawScheduled: false,
            autoDrawTimerId: null,
            autoDrawInterval: 0,
            autoDrawBurnCardCost: DEFAULT_AUTO_DRAW_BURN_CARD_COST,
            hasPokerHandTarget,
            chipRewardMultiplier: 1,
            diceRewardMultiplier: 1,
            suitBonusBoosts: {
                chips: 1,
                dice: 1,
                status: 1,
                burnCard: 1
            },
            cardShopRarityBoost: false,
            cardShopValueMultiplier: 1,
            baseChipReward: config.baseChipReward ?? DEFAULT_BASE_CHIP_PAYOUT,
            chipStreakMultiplier:
                config.chipStreakMultiplier ?? DEFAULT_STREAK_CHIP_MULTIPLIER,
            evaluateHand: getDeckEvaluator(config.id),
            streakTarget: STREAK_TARGET
        };

        const formatAutoDealLabel = () => {
            const rawCost = Number.isFinite(state.autoDrawBurnCardCost)
                ? Math.max(0, Math.ceil(state.autoDrawBurnCardCost))
                : DEFAULT_AUTO_DRAW_BURN_CARD_COST;
            return `auto deal: ${formatBurnCardAmount(rawCost)}`;
        };

        function updateAutoButton() {
            const button = state.dom.autoButton;
            if (!button) {
                return;
            }
            const hasPokerHand = state.hasPokerHandTarget === true;
            const label = formatAutoDealLabel();
            const isVisible = state.autoDrawVisible === true;
            if (!hasPokerHand || !isVisible) {
                button.hidden = true;
                button.setAttribute("aria-hidden", "true");
                button.tabIndex = -1;
                button.disabled = true;
                button.classList.remove("auto-draw-enabled");
                button.setAttribute("aria-pressed", "false");
                button.textContent = label;
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
                button.textContent = label;
                return;
            }
            button.classList.toggle("auto-draw-enabled", state.autoDrawEnabled);
            button.textContent = label;
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
            if (!state.hasPokerHandTarget || !state.autoDrawVisible) {
                if (state.autoDrawEnabled) {
                    cancelScheduledAutoDraw();
                    state.autoDrawEnabled = false;
                }
                updateAutoButton();
                return;
            }
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
                    handleDraw(state, { auto: true });
                }
                return;
            }
            cancelScheduledAutoDraw();
            updateAutoButton();
        }

        function setAutoDrawVisible(visible) {
            const nextVisible = visible === true && state.hasPokerHandTarget;
            if (!nextVisible && state.autoDrawEnabled) {
                cancelScheduledAutoDraw();
                state.autoDrawEnabled = false;
            }
            if (state.autoDrawVisible === nextVisible) {
                updateAutoButton();
                return;
            }
            state.autoDrawVisible = nextVisible;
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
        state.setAutoDrawVisible = setAutoDrawVisible;
        state.setAutoDrawUnlocked = setAutoDrawUnlocked;

        setAutoDrawUnlocked(state.hasPokerHandTarget);
        setAutoDrawVisible(false);

        setupDeckManagement(state);
        setupDeckUpgrades(state);
        setupCardShop(state);
        updateStreakDisplay(state);

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
