const ROOMMATES_ID = "roommates";
const ROOMMATES_STATE_FLAG = "roommatesFullHouseActive";

function createRoommatesUpgradeDefinition() {
    return {
        id: ROOMMATES_ID,
        cost: 200,
        costGrowthRate: 1,
        costLinearCoefficient: 0,
        title: "roommates",
        description: "two pair plus an ace counts as a full house",
        rarity: "rare",
        definition: {
            id: ROOMMATES_ID,
            type: "unique",
            defaults: {
                amount: 1,
                flag: ROOMMATES_STATE_FLAG
            },
            apply(state) {
                if (!state) {
                    return;
                }
                state[ROOMMATES_STATE_FLAG] = true;
            },
            getCurrentValue(state) {
                return state?.[ROOMMATES_STATE_FLAG]
                    ? "roommates active"
                    : "waiting on roommates";
            },
            resolveAmount(state, upgrade) {
                return upgrade?.purchased ? 0 : 1;
            }
        },
        backgroundColor: "#ede9fe",
        glyph: "♢",
        glyphColor: "#4c1d95"
    };
}

export default {
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 7,
    basic: {},
    unique: [
        createRoommatesUpgradeDefinition()
    ]
};
