export default {
    baseChipsAmount: 1,
    baseMultiplierAmount: 1.0,
    baseDrawTime: 2000,
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
                minimumDuration: 250
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
                title: "short straight",
                description: "straights with four consecutive cards now count as wins.",
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
                    return state?.straightFourCardActive
                        ? "4-card straights score"
                        : "unlock 4-card straights";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#f7b731",
            glyph: "4",
            glyphColor: "#1a1a1a",
            textSize: "2rem"
        }
    ]
};
