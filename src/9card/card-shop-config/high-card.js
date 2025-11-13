import { CARD_SHOP_SETTINGS } from "../config.js";

const RARE_HIGH_CARD_POOL = [
    {
        id: "high_card_celestial_king",
        rank: "K",
        value: 13,
        rankName: "king",
        suit: "★",
        suitName: "star",
        color: "black",
        label: "celestial king",
        rarity: "rare",
        price: CARD_SHOP_SETTINGS.cardPrice,
        textSize: "2rem"
    },
    {
        id: "high_card_hc_plus",
        rank: "HC",
        value: 15,
        rankName: "hc plus",
        suit: "+",
        suitName: "hcplus",
        color: "white",
        label: "HC+",
        rarity: "rare",
        price: CARD_SHOP_SETTINGS.cardPrice,
        textSize: "1.65rem",
        deckTextSize: "1rem"
    }
];

export default {
    pools: {
        rare: RARE_HIGH_CARD_POOL
    }
};
