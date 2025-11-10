import defaultDeck from "./card-shop-config/default.js";
import flush from "./card-shop-config/flush.js";
import fourKind from "./card-shop-config/four-kind.js";
import fullHouse from "./card-shop-config/full-house.js";
import highCard from "./card-shop-config/high-card.js";
import pair from "./card-shop-config/pair.js";
import royalFlush from "./card-shop-config/royal-flush.js";
import straight from "./card-shop-config/straight.js";
import straightFlush from "./card-shop-config/straight-flush.js";
import threeKind from "./card-shop-config/three-kind.js";
import twoPair from "./card-shop-config/two-pair.js";

export const DECK_CARD_SHOP_CONFIG = {
    default: defaultDeck,
    high_card: highCard,
    pair,
    two_pair: twoPair,
    three_kind: threeKind,
    straight,
    flush,
    full_house: fullHouse,
    four_kind: fourKind,
    straight_flush: straightFlush,
    royal_flush: royalFlush
};
