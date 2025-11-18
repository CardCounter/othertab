const CLOSE_ENOUGH_ID = "close_enough";
const CLOSE_ENOUGH_STATE_FLAG = "closeEnoughPairAceActive";

export default {
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 3,
    basic: {},
    unique: [
        {
            id: CLOSE_ENOUGH_ID,
            cost: 150,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "close enough",
            description: "a pair plus an ace counts as two pair",
            rarity: "rare",
            definition: {
                id: CLOSE_ENOUGH_ID,
                type: "unique",
                defaults: {
                    amount: 1,
                    flag: CLOSE_ENOUGH_STATE_FLAG
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    state[CLOSE_ENOUGH_STATE_FLAG] = true;
                },
                getCurrentValue(state) {
                    return state?.[CLOSE_ENOUGH_STATE_FLAG]
                        ? "pair + ace counts as two pair"
                        : "looks for two pairs";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#2563eb",
            glyph: "≈",
            glyphColor: "#ffffff"
        }
    ]
};
