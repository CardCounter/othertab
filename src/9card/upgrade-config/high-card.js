export default {
    baseChipsAmount: 100000000000000000,
    baseMultiplierAmount: 1.0,
    baseDrawTime: 2000,
    basic: {
        increase_payout: {
            cost: 5,
            costGrowthRate: 1.2,
            costLinearCoefficient: 0.22,
            increaseAmount: 1
        },
        increase_streak_multiplier: {
            cost: 50,
            costGrowthRate: 2.2,
            costLinearCoefficient: 0.25,
            increaseAmount: 0.1
        },
        decrease_draw_time: {
            cost: 500,
            costGrowthRate: 1.2,
            costLinearCoefficient: 0.35,
            increaseAmount: 50,
            options: {
                minimumDuration: 50
            }
        }
    },
    unique: []
};
