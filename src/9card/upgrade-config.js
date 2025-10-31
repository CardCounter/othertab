export const BASIC_UPGRADE_SETTINGS = {
    increase_payout: {
        cost: 25,
        costGrowthRate: 1.35,
        costLinearCoefficient: 0.25,
        options: {
            amount: 1
        }
    },
    increase_streak_multiplier: {
        cost: 50,
        costGrowthRate: 1.4,
        costLinearCoefficient: 0.3,
        options: {
            amount: 0.25
        }
    },
    decrease_draw_time: {
        cost: 100,
        costGrowthRate: 1.5,
        costLinearCoefficient: 0.4,
        options: {
            amount: 150,
            minimumDuration: 250
        }
    }
};

/**
 * Deck-specific upgrade overrides.
 *
 * Shape:
 * {
 *   default: { basic, unique },
 *   high_card: { basic, unique },
 *   ...
 * }
 *
 * - basic      : map of upgrade id -> overrides
 *                Set { enabled: false } to remove a basic upgrade for that deck.
 *                Any property (cost, costGrowthRate, costLinearCoefficient, amount, etc.)
 *                can be overridden per deck.
 * - unique     : array of upgrade configs. Each entry is only available to that deck.
 *                You can reference an existing upgrade id (registered via registerUpgrade)
 *                or provide a `definition` to register a new deck-only upgrade.
 *
 * Unique entry shape:
 * {
 *   id: "unique_upgrade_id",
 *   definition: { ...optional definition to register if not already declared },
 *   cost: ...,
 *   costGrowthRate: ...,
 *   costLinearCoefficient: ...,
 *   baseAmount: ...,
 *   options: { ... },
 *   resolveAmount: (state, upgrade) => number
 * }
 *
 * A minimal override can just specify { cost: 200 } to tweak pricing.
 */
export const DECK_UPGRADE_CONFIG = {
    default: {
        basic: {
            increase_payout: {},
            increase_streak_multiplier: {},
            decrease_draw_time: {}
        },
        unique: []
    },
    high_card: {
        basic: {
            increase_payout: {
                cost: 25,
                costGrowthRate: 1.3,
                costLinearCoefficient: 0.22,
                options: {
                    amount: 1
                }
            },
            increase_streak_multiplier: {
                cost: 45,
                costGrowthRate: 1.28,
                costLinearCoefficient: 0.25
            },
            decrease_draw_time: {
                cost: 110,
                costGrowthRate: 1.45,
                costLinearCoefficient: 0.35
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
                baseAmount: 5,
                options: {
                    amount: 5
                }
            },
            increase_streak_multiplier: {
                cost: 65,
                costGrowthRate: 1.4,
                costLinearCoefficient: 0.32,
                baseAmount: 0.35,
                options: {
                    amount: 0.35
                }
            },
            decrease_draw_time: {
                cost: 160,
                costGrowthRate: 1.6,
                costLinearCoefficient: 0.5,
                baseAmount: 120,
                options: {
                    amount: 120,
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
        basic: {},
        unique: []
    }
};
