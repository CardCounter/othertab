const ALL_RED_FLAG = "flushAllRedActive";
const ALL_BLACK_FLAG = "flushAllBlackActive";

function createUniqueFlushDefinition({ id, flag, title, description, backgroundColor, glyph, glyphColor }) {
    return {
        id,
        cost: 300,
        costGrowthRate: 1,
        costLinearCoefficient: 0,
        title,
        description,
        rarity: "rare",
        definition: {
            id,
            type: "unique",
            defaults: {
                amount: 1
            },
            apply(state) {
                if (!state) {
                    return;
                }
                state[flag] = true;
            },
            getCurrentValue(state) {
                return state?.[flag]
                    ? `${title.toLowerCase()} active`
                    : `${title.toLowerCase()} inactive`;
            },
            resolveAmount(state, upgrade) {
                return upgrade?.purchased ? 0 : 1;
            }
        },
        backgroundColor,
        glyph,
        glyphColor
    };
}

export default {
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 6,
    basic: {},
    unique: [
        createUniqueFlushDefinition({
            id: "flush_all_red",
            flag: ALL_RED_FLAG,
            title: "all red",
            description: "hearts and diamonds count as the same suit",
            backgroundColor: "#fee2e2",
            glyph: "♥",
            glyphColor: "#991b1b"
        }),
        createUniqueFlushDefinition({
            id: "flush_all_black",
            flag: ALL_BLACK_FLAG,
            title: "all black",
            description: "spades and clubs count as the same suit",
            backgroundColor: "#e2e8f0",
            glyph: "♠",
            glyphColor: "#0f172a"
        })
    ]
};
