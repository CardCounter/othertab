import {
    DEFAULT_BASE_CHIP_PAYOUT,
    DEFAULT_STREAK_CHIP_MULTIPLIER
} from "./config.js";
import { formatChipAmount } from "./chips.js";

export const UPGRADE_TYPES = {
    BASIC: "basic",
    UNIQUE: "unique"
};

const BASIC_UPGRADE_IDS = ["increase_payout", "increase_streak_multiplier", "decrease_draw_time"];

const upgradeRegistry = new Map();

function registerUpgrade(definition) {
    if (!definition?.id) {
        return;
    }
    upgradeRegistry.set(definition.id, { ...definition });
}

registerUpgrade({
    id: "increase_payout",
    type: UPGRADE_TYPES.BASIC,
    title: "payout",
    description: "raise this deck's base chip reward.",
    cost: 25,
    defaults: {
        amount: 1
    },
    apply(state, upgrade) {
        if (!state) {
            return;
        }
        const increase = Number.isFinite(upgrade?.options?.amount) ? upgrade.options.amount : 1;
        const currentBase = Number.isFinite(state.baseChipReward)
            ? state.baseChipReward
            : DEFAULT_BASE_CHIP_PAYOUT;
        state.baseChipReward = currentBase + increase;
    },
    getCurrentValue(state) {
        const currentBase = Number.isFinite(state?.baseChipReward)
            ? state.baseChipReward
            : DEFAULT_BASE_CHIP_PAYOUT;
        return `payout: ${formatChipAmount(currentBase)}`;
    }
});

registerUpgrade({
    id: "increase_streak_multiplier",
    type: UPGRADE_TYPES.BASIC,
    title: "multiplier",
    description: "boost the chip payout multiplier for streaks.",
    cost: 50,
    defaults: {
        amount: 0.25
    },
    apply(state, upgrade) {
        if (!state) {
            return;
        }
        const increase = Number.isFinite(upgrade?.options?.amount) ? upgrade.options.amount : 0;
        const currentMultiplier = Number.isFinite(state.chipStreakMultiplier)
            ? state.chipStreakMultiplier
            : DEFAULT_STREAK_CHIP_MULTIPLIER;
        const nextMultiplier = currentMultiplier + increase;
        state.chipStreakMultiplier = Math.max(nextMultiplier, 0);
    },
    getCurrentValue(state) {
        const multiplier = Number.isFinite(state?.chipStreakMultiplier)
            ? state.chipStreakMultiplier
            : DEFAULT_STREAK_CHIP_MULTIPLIER;
        return `multiplier: ${multiplier.toFixed(2)}x`;
    }
});

registerUpgrade({
    id: "decrease_draw_time",
    type: UPGRADE_TYPES.BASIC,
    title: "draw speed",
    description: "draw hands faster by shortening the shuffle animation.",
    cost: 100,
    defaults: {
        amount: 150,
        minimumDuration: 250
    },
    apply(state, upgrade) {
        if (!state) {
            return;
        }
        const decrease = Number.isFinite(upgrade?.options?.amount) ? upgrade.options.amount : 0;
        const minimum = Number.isFinite(upgrade?.options?.minimumDuration)
            ? upgrade.options.minimumDuration
            : 250;
        const currentDuration = Number.isFinite(state.animationDuration)
            ? state.animationDuration
            : 1000;
        const nextDuration = Math.max(minimum, currentDuration - decrease);
        state.animationDuration = nextDuration;
    },
    getCurrentValue(state) {
        const duration = Number.isFinite(state?.animationDuration) ? state.animationDuration : 1000;
        const seconds = Math.round((duration / 1000) * 10) / 10;
        return `draw speed: ${seconds}s`;
    }
});

function resolveUpgradeType(definition, overrides = {}) {
    if (typeof overrides.type === "string") {
        return overrides.type;
    }
    if (definition?.type) {
        return definition.type;
    }
    return UPGRADE_TYPES.BASIC;
}

function createUpgradeInstance(entry) {
    if (!entry) {
        return null;
    }

    const id = typeof entry === "string" ? entry : entry.id;
    if (!id) {
        return null;
    }

    const definition = upgradeRegistry.get(id);
    if (!definition) {
        return null;
    }

    const overrides = typeof entry === "string" ? {} : { ...entry };
    if (overrides.id) {
        delete overrides.id;
    }

    const options = {
        ...(definition.defaults ?? {}),
        ...(overrides.options ?? {})
    };

    const instance = {
        id,
        type: resolveUpgradeType(definition, overrides),
        title: overrides.title ?? definition.title ?? id,
        description: overrides.description ?? definition.description ?? "",
        cost: overrides.cost ?? definition.cost ?? 0,
        options,
        purchased: false,
        applyEffect: definition.apply
    };

    return instance;
}

function buildDeckUpgradeList(config) {
    const base = BASIC_UPGRADE_IDS.map((id) => createUpgradeInstance(id)).filter(Boolean);
    const extras = [];

    const rawExtras = Array.isArray(config?.upgrades)
        ? config.upgrades
        : Array.isArray(config?.uniqueUpgrades)
          ? config.uniqueUpgrades
          : [];

    rawExtras.forEach((entry) => {
        const instance = createUpgradeInstance(entry);
        if (instance) {
            extras.push(instance);
        }
    });

    return [...base, ...extras];
}

function renderUpgrades(state) {
    if (!state?.dom?.upgradeList) {
        return;
    }

    const list = state.dom.upgradeList;
    const fragment = document.createDocumentFragment();

    if (!Array.isArray(state.upgrades) || state.upgrades.length === 0) {
        const empty = document.createElement("p");
        empty.className = "upgrade-empty";
        empty.textContent = "no upgrades available";
        fragment.append(empty);
        list.replaceChildren(fragment);
        return;
    }

    state.upgrades.forEach((upgrade) => {
        const card = document.createElement("article");
        card.className = "upgrade-card";
        card.dataset.upgradeId = upgrade.id;
        card.setAttribute("role", "listitem");
        if (upgrade.type === UPGRADE_TYPES.UNIQUE) {
            card.classList.add("upgrade-card-unique");
        }
        if (upgrade.purchased) {
            card.classList.add("upgrade-card-purchased");
        }

        const stat = document.createElement("div");
        stat.className = "upgrade-card-stat";
        stat.textContent =
            typeof upgrade.getCurrentValue === "function"
                ? upgrade.getCurrentValue(state)
                : typeof upgrade.title === "string"
                  ? upgrade.title
                  : upgrade.id;

        const body = document.createElement("div");
        body.className = "upgrade-card-body";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "upgrade-card-button";
        button.dataset.upgradeId = upgrade.id;
        button.disabled = upgrade.purchased;

        if (upgrade.purchased) {
            button.textContent = "active";
            button.classList.add("upgrade-card-button-active");
        } else if (upgrade.cost > 0) {
            button.textContent = formatChipAmount(upgrade.cost);
        } else {
            button.textContent = "unlock";
        }

        body.append(button);

        card.append(stat, body);
        fragment.append(card);
    });

    list.replaceChildren(fragment);
}

function applyUpgrade(state, upgrade) {
    if (!state || !upgrade || typeof upgrade.applyEffect !== "function") {
        return;
    }
    if (typeof upgrade.applyEffect === "function") {
        upgrade.applyEffect(state, upgrade);
    }
    upgrade.purchased = true;
}

function handleUpgradeClick(state, event) {
    const button = event.target.closest(".upgrade-card-button");
    if (!button) {
        return;
    }
    const id = button.dataset.upgradeId;
    if (!id) {
        return;
    }
    const upgrade = state.upgrades?.find((entry) => entry.id === id);
    if (!upgrade || upgrade.purchased) {
        return;
    }
    applyUpgrade(state, upgrade);
    renderUpgrades(state);
}

export function setupDeckUpgrades(state) {
    if (!state?.dom?.upgradeColumn || !state.dom.upgradeList) {
        return;
    }
    state.upgrades = buildDeckUpgradeList(state.config).map((upgrade) => ({
        ...upgrade,
        getCurrentValue: upgradeRegistry.get(upgrade.id)?.getCurrentValue
    }));

    if (!state.dom.upgradeList.dataset.listenerAttached) {
        state.dom.upgradeList.dataset.listenerAttached = "true";
        state.dom.upgradeList.addEventListener("click", (event) => handleUpgradeClick(state, event));
    }

    renderUpgrades(state);
}

export function getBasicUpgradeIds() {
    return [...BASIC_UPGRADE_IDS];
}
