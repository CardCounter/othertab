export default {
    baseChipsAmount: 99999999999999999999,
    baseMultiplierAmount: 1.0,
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 1,
    baseDrawTime: 2000,
    basic: {
        increase_payout: {
            cost: 5,
            costGrowthRate: 1.2,
            costLinearCoefficient: 0.22,
            increaseAmount: 1
        },
        decrease_draw_time: {
            cost: 100,
            costGrowthRate: 1.2,
            costLinearCoefficient: 0.35,
            increaseAmount: 50,
            options: {
                minimumDuration: 50
            }
        }
    },
    unique: [
        {
            id: "highest_card",
            cost: 150,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "highest card",
            description: "hands containing an ace count as high card.",
            rarity: "rare",
            definition: {
                id: "highest_card",
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    state.highCardAceCountsAsHighCard = true;
                },
                getCurrentValue(state) {
                    return state?.highCardAceCountsAsHighCard
                        ? "aces always high cards"
                        : "aces count as high card";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#c084fc",
            glyph: "A",
            glyphColor: "#1f1f1f"
        }
    ]
};
