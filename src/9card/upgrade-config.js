import defaultDeck from "./upgrade-config/default.js";
import flush from "./upgrade-config/flush.js";
import fourKind from "./upgrade-config/four-kind.js";
import fullHouse from "./upgrade-config/full-house.js";
import highCard from "./upgrade-config/high-card.js";
import pair from "./upgrade-config/pair.js";
import royalFlush from "./upgrade-config/royal-flush.js";
import straight from "./upgrade-config/straight.js";
import straightFlush from "./upgrade-config/straight-flush.js";
import threeKind from "./upgrade-config/three-kind.js";
import twoPair from "./upgrade-config/two-pair.js";

export const DECK_UPGRADE_CONFIG = {
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
