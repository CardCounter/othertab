const THE_FAMILY_ID = "the_family";
const THE_FAMILY_STATE_FLAG = "familyThreeKindActive";

export default {
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 4,
    basic: {},
    unique: [
        {
            id: THE_FAMILY_ID,
            cost: 150,
            costGrowthRate: 1,
            costLinearCoefficient: 0,
            title: "the family",
            description: "a hand containing K Q J counts as three of a kind",
            rarity: "rare",
            definition: {
                id: THE_FAMILY_ID,
                type: "unique",
                defaults: {
                    amount: 1,
                    flag: THE_FAMILY_STATE_FLAG
                },
                apply(state) {
                    if (!state) {
                        return;
                    }
                    state[THE_FAMILY_STATE_FLAG] = true;
                },
                getCurrentValue(state) {
                    return state?.[THE_FAMILY_STATE_FLAG]
                        ? "K Q J count as three of a kind"
                        : "needs K, Q and J to trigger";
                },
                resolveAmount(state, upgrade) {
                    return upgrade?.purchased ? 0 : 1;
                }
            },
            backgroundColor: "#f97316",
            glyph: "F",
            glyphColor: "#1f1f1f"
        }
    ]
};
