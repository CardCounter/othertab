const ROYAL_PAIR_ID = "royal_pair";

export default {
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 2,
    basic: {},
    unique: [
        {
            id: ROYAL_PAIR_ID,
            cost: 150,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "royal pair",
            description: "pairs can be made with royal cards (J, Q, K, A). e.g. J and A count as a pair",
            rarity: "rare",
            definition: {
                id: ROYAL_PAIR_ID,
                type: "unique",
                defaults: {
                    amount: 1
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    state.royalPairCardsCountAsPair = true;
                },
                getCurrentValue(state) {
                    return state?.royalPairCardsCountAsPair
                        ? "royal cards form pairs"
                        : "royal cards count as high cards";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#eab308",
            glyph: "R",
            glyphColor: "#1f1f1f"
        }
    ]
};
