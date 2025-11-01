import { HAND_SIZE } from "./config.js";

/**
 * deck-specific upgrade settings.
 *
 * each deck entry can provide:
 * , baseChipsAmount: starting chip payout for the deck (applied on setup)
 * , baseMultiplierAmount: starting streak multiplier for the deck
 * , baseDrawTime: initial shuffle animation duration in ms
 * , baseHandSize: starting hand size for the deck
 * , basic: map of upgrade id -> config
 * , unique: list of deck only upgrades (id or config objects)
 *
 * upgrade config fields:
 * , cost, costGrowthRate, costLinearCoefficient, baseCost (optional)
 * , increaseAmount / baseAmount to set how much the upgrade changes the stat each purchase
 * , options: arbitrary additional data passed to the upgrade implementation
 * , minimumDuration, amount, etc. can be set directly or inside options
 * , resolveAmount, title, description, type, definition (for unique upgrades)
 */
export const DECK_UPGRADE_CONFIG = {
    default: {
        baseChipsAmount: 1,
        baseMultiplierAmount: 1.0,
        baseDrawTime: 2000,
        baseHandSize: HAND_SIZE,
        basic: {
            increase_payout: {
                cost: 25,
                costGrowthRate: 1.35,
                costLinearCoefficient: 0.25,
                increaseAmount: 1
            },
            increase_streak_multiplier: {
                cost: 50,
                costGrowthRate: 1.4,
                costLinearCoefficient: 0.3,
                increaseAmount: 0.25
            },
            decrease_draw_time: {
                cost: 100,
                costGrowthRate: 1.5,
                costLinearCoefficient: 0.4,
                increaseAmount: 150,
                options: {
                    minimumDuration: 250
                }
            }
        },
        unique: []
    },
    high_card: {
        baseChipsAmount: 1,
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
                costGrowthRate: 3.2,
                costLinearCoefficient: 0.35,
                increaseAmount: 50,
                options: {
                    minimumDuration: 1
                }
            }
        },
        unique: []
    },
    pair: {
        basic: {},
        unique: []
    },
    two_pair: {
        basic: {},
        unique: []
    },
    three_kind: {
        basic: {},
        unique: []
    },
    straight: {
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
        unique: []
    },
    flush: { basic: {}, unique: [] },
    full_house: { basic: {}, unique: [] },
    four_kind: { basic: {}, unique: [] },
    straight_flush: { basic: {}, unique: [] },
    royal_flush: {
        baseChipsAmount: 1,
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
                costGrowthRate: 3.2,
                costLinearCoefficient: 0.35,
                increaseAmount: 50,
                options: {
                    minimumDuration: 1
                }
            }
        },
        unique: []
    }
};
