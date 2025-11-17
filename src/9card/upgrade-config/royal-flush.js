export default {
    baseChipsAmount: 1,
    baseMultiplierAmount: 1.0,
    baseDrawTime: 2000,
    autoDrawBurnCardCost: 1,
    cardShopValueMultiplier: 10,
    basic: {
        increase_payout: {
            cost: 5,
            costGrowthRate: 1.2,
            costLinearCoefficient: 0.22,
            increaseAmount: 1
        },
        decrease_draw_time: {
            cost: 500,
            costGrowthRate: 3.2,
            costLinearCoefficient: 0.35,
            increaseAmount: 50,
            options: {
                minimumDuration: 1
            }
        }
    },
    unique: []
};
