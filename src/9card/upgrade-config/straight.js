export default {
    baseChipsAmount: 1,
    baseMultiplierAmount: 1.0,
    baseDrawTime: 2000,
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 5,
    basic: {
        increase_payout: {
            cost: 80,
            costGrowthRate: 1.5,
            costLinearCoefficient: 0.42,
            increaseAmount: 5
        },
        increase_streak_multiplier: {
            cost: 65,
            costGrowthRate: 1.4,
            costLinearCoefficient: 0.32,
            increaseAmount: 0.35
        },
        decrease_draw_time: {
            cost: 160,
            costGrowthRate: 1.6,
            costLinearCoefficient: 0.5,
            increaseAmount: 120,
            options: {
                minimumDuration: 50
            }
        }
    },
    unique: [
        {
            id: "straight_four_card_scoring",
            cost: 1,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            definition: {
                id: "straight_four_card_scoring",
                type: "unique",
                defaults: {
                    amount: 1,
                    flag: "straight_four_card_scoring"
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    state.straightFourCardActive = true;
                },
                getCurrentValue(state) {
                    // Change these strings to update the hover description
                    return state?.straightFourCardActive
                        ? "4-card straights score"
                        : "straights can be made with four cards";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "gold",
            glyph: "4",
            glyphColor: "#1a1a1a",
            textSize: "4rem"
        }
    ]
};
