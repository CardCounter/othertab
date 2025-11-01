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
    unique: []
};
