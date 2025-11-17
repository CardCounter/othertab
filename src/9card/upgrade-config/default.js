import { HAND_SIZE, DEFAULT_AUTO_DRAW_BURN_CARD_COST } from "../config.js";

function ensureSuitBonusBoosts(state) {
    if (!state) {
        return null;
    }
    if (!state.suitBonusBoosts || typeof state.suitBonusBoosts !== "object") {
        state.suitBonusBoosts = {
            chips: 1,
            dice: 1,
            status: 1,
            burnCard: 1
        };
    }
    return state.suitBonusBoosts;
}

export default {
    baseChipsAmount: 1,
    baseMultiplierAmount: 1.0,
    baseDrawTime: 2000,
    autoDrawBurnCardCost: DEFAULT_AUTO_DRAW_BURN_CARD_COST,
    baseHandSize: HAND_SIZE,
    cardShopValueMultiplier: 1,
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
            id: "better_diamonds",
            cost: 400,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "better diamonds",
            description: "doubles the effect of diamonds on chips payout.",
            rarity: "uncommon",
            definition: {
                id: "better_diamonds",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    const boosts = ensureSuitBonusBoosts(state);
                    if (!boosts) {
                        return;
                    }
                    const current = Number.isFinite(boosts.chips) && boosts.chips > 0 ? boosts.chips : 1;
                    boosts.chips = Math.max(current, 2);
                },
                getCurrentValue(state) {
                    const current = Number.isFinite(state?.suitBonusBoosts?.chips)
                        ? state.suitBonusBoosts.chips
                        : 1;
                    return current >= 2 ? "diamond effect doubled" : "double diamond effects";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#fee2e2",
            glyph: "♦",
            glyphColor: "#be123c"
        },
        {
            id: "better_spades",
            cost: 350,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "better spades",
            description: "doubles the effect of spades on dice payout.",
            rarity: "uncommon",
            definition: {
                id: "better_spades",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    const boosts = ensureSuitBonusBoosts(state);
                    if (!boosts) {
                        return;
                    }
                    const current = Number.isFinite(boosts.dice) && boosts.dice > 0 ? boosts.dice : 1;
                    boosts.dice = Math.max(current, 2);
                },
                getCurrentValue(state) {
                    const current = Number.isFinite(state?.suitBonusBoosts?.dice)
                        ? state.suitBonusBoosts.dice
                        : 1;
                    return current >= 2 ? "spade effect doubled" : "double spade effects";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#e2e8f0",
            glyph: "♠",
            glyphColor: "#0f172a"
        },
        {
            id: "better_hearts",
            cost: 325,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "better hearts",
            description: "doubles the effect of hearts on status payout.",
            rarity: "uncommon",
            definition: {
                id: "better_hearts",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    const boosts = ensureSuitBonusBoosts(state);
                    if (!boosts) {
                        return;
                    }
                    const current = Number.isFinite(boosts.status) && boosts.status > 0 ? boosts.status : 1;
                    boosts.status = Math.max(current, 2);
                },
                getCurrentValue(state) {
                    const current = Number.isFinite(state?.suitBonusBoosts?.status)
                        ? state.suitBonusBoosts.status
                        : 1;
                    return current >= 2 ? "heart effect doubled" : "double heart effects";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#ffe4e6",
            glyph: "♥",
            glyphColor: "#be123c"
        },
        {
            id: "better_clubs",
            cost: 300,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "better clubs",
            description: "doubles the effect of clubs on burn card payout.",
            rarity: "uncommon",
            definition: {
                id: "better_clubs",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    const boosts = ensureSuitBonusBoosts(state);
                    if (!boosts) {
                        return;
                    }
                    const current =
                        Number.isFinite(boosts.burnCard) && boosts.burnCard > 0 ? boosts.burnCard : 1;
                    boosts.burnCard = Math.max(current, 2);
                },
                getCurrentValue(state) {
                    const current = Number.isFinite(state?.suitBonusBoosts?.burnCard)
                        ? state.suitBonusBoosts.burnCard
                        : 1;
                    return current >= 2 ? "club effect doubled" : "double club effects";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#dcfce7",
            glyph: "♣",
            glyphColor: "#166534"
        }
    ]
};
