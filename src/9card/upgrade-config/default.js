import { HAND_SIZE } from "../config.js";

export default {
    baseChipsAmount: 1,
    baseMultiplierAmount: 1.0,
    baseDrawTime: 2000,
    baseHandSize: HAND_SIZE,
    basic: {
        increase_payout: {
            cost: 25,
            costGrowthRate: 1.35,
            costLinearCoefficient: 0.25,
            increaseAmount: 1,
            backgroundColor: "#fef08a",
            glyph: "✶",
            glyphColor: "#92400e"
        },
        increase_streak_multiplier: {
            cost: 50,
            costGrowthRate: 1.4,
            costLinearCoefficient: 0.3,
            increaseAmount: 0.25,
            backgroundColor: "#e0e7ff",
            glyph: "⨉",
            glyphColor: "#312e81"
        },
        decrease_draw_time: {
            cost: 100,
            costGrowthRate: 1.5,
            costLinearCoefficient: 0.4,
            increaseAmount: 150,
            options: {
                minimumDuration: 250
            },
            backgroundColor: "#fde2e4",
            glyph: "⏱",
            glyphColor: "#9f1239"
        }
    },
    unique: [
        {
            id: "auto_draw_unlock",
            cost: 250,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "auto draw",
            definition: {
                id: "auto_draw_unlock",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    if (typeof state.setAutoDrawUnlocked === "function") {
                        state.setAutoDrawUnlocked(true);
                        return;
                    }
                    state.autoDrawUnlocked = true;
                    if (typeof state.updateAutoButton === "function") {
                        state.updateAutoButton();
                    }
                },
                getCurrentValue(state) {
                    // Change these strings to update the hover description
                    return state?.autoDrawUnlocked
                        ? "auto draw unlocked"
                        : "auto draw hand";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "grey",
            glyph: "A",
            glyphColor: "black"
        },
        {
            id: "double_dice_rewards",
            cost: 350,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "double dice",
            definition: {
                id: "double_dice_rewards",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    const current =
                        Number.isFinite(state.diceRewardMultiplier) && state.diceRewardMultiplier > 0
                            ? state.diceRewardMultiplier
                            : 1;
                    state.diceRewardMultiplier = Math.max(current, 2);
                },
                getCurrentValue(state) {
                    // Change these strings to update the hover description
                    return Number.isFinite(state?.diceRewardMultiplier) && state.diceRewardMultiplier >= 2
                        ? "dice rewards doubled"
                        : "double dice rewards";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "pink",
            glyph: "⚂",
            glyphColor: "purple"
        },
        {
            id: "double_chip_rewards",
            cost: 450,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "double chips",
            definition: {
                id: "double_chip_rewards",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    const current =
                        Number.isFinite(state.chipRewardMultiplier) && state.chipRewardMultiplier > 0
                            ? state.chipRewardMultiplier
                            : 1;
                    state.chipRewardMultiplier = Math.max(current, 2);
                },
                getCurrentValue(state) {
                    // Change these strings to update the hover description
                    return Number.isFinite(state?.chipRewardMultiplier) && state.chipRewardMultiplier >= 2
                        ? "chip rewards doubled" // bought hover description
                        : "double chip rewards";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "gold",
            glyph: "⛁",
            glyphColor: "brown"
        },
        {
            id: "enhanced_card_rarity",
            cost: 300,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "rarity boost",
            definition: {
                id: "enhanced_card_rarity",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    state.cardShopRarityBoost = true;
                    if (typeof state.refreshCardShopOdds === "function") {
                        state.refreshCardShopOdds();
                    }
                },
                getCurrentValue(state) {
                    // Change these strings to update the hover description
                    return state?.cardShopRarityBoost
                        ? "rarity odds increased"
                        : "more uncommon and rare cards";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "lavender",
            glyph: "☆",
            glyphColor: "navy"
        }
    ]
};
