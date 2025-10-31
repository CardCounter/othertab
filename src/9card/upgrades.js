import {
    DEFAULT_BASE_CHIP_PAYOUT,
    DEFAULT_STREAK_CHIP_MULTIPLIER
} from "./config.js";
import { formatChipAmount } from "./chips.js";
import { BASIC_UPGRADE_SETTINGS, DECK_UPGRADE_CONFIG } from "./upgrade-config.js";

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

function registerConfigDefinitions(configMap) {
    if (!configMap || typeof configMap !== "object") {
        return;
    }
    const seen = new Set();
    Object.values(configMap).forEach((deckConfig) => {
        if (!deckConfig || typeof deckConfig !== "object") {
            return;
        }
        const uniqueList = Array.isArray(deckConfig.unique) ? deckConfig.unique : [];
        uniqueList.forEach((entry) => {
            if (!entry || typeof entry !== "object") {
                return;
            }
            const definition = entry.definition ?? null;
            const id = entry.id ?? definition?.id ?? null;
            if (!definition || !id || seen.has(id) || upgradeRegistry.has(id)) {
                return;
            }
            seen.add(id);
            registerUpgrade({ id, ...definition });
        });
    });
}

registerUpgrade({
    id: "increase_payout",
    type: UPGRADE_TYPES.BASIC,
    title: "payout",
    description: "raise this deck's base chip reward.",
    cost: 25,
    costGrowthRate: 1.35,
    costLinearCoefficient: 0.25,
    defaults: {
        amount: 1
    },
    apply(state, upgrade) {
        if (!state) {
            return;
        }
        const increase = Number.isFinite(upgrade?.computedAmount)
            ? upgrade.computedAmount
            : Number.isFinite(upgrade?.options?.amount)
              ? upgrade.options.amount
              : 1;
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
    },
    resolveAmount(state, upgrade) {
        return Number.isFinite(upgrade?.baseAmount) ? upgrade.baseAmount : 1;
    }
});

registerConfigDefinitions(DECK_UPGRADE_CONFIG);

registerUpgrade({
    id: "increase_streak_multiplier",
    type: UPGRADE_TYPES.BASIC,
    title: "multiplier",
    description: "boost the chip payout multiplier for streaks.",
    cost: 50,
    costGrowthRate: 1.4,
    costLinearCoefficient: 0.3,
    defaults: {
        amount: 0.25
    },
    apply(state, upgrade) {
        if (!state) {
            return;
        }
        const increase = Number.isFinite(upgrade?.computedAmount)
            ? upgrade.computedAmount
            : Number.isFinite(upgrade?.options?.amount)
              ? upgrade.options.amount
              : 0;
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
    },
    resolveAmount(state, upgrade) {
        return Number.isFinite(upgrade?.baseAmount) ? upgrade.baseAmount : upgrade?.options?.amount ?? 0;
    }
});

registerUpgrade({
    id: "decrease_draw_time",
    type: UPGRADE_TYPES.BASIC,
    title: "draw speed",
    description: "draw hands faster by shortening the shuffle animation.",
    cost: 100,
    costGrowthRate: 1.5,
    costLinearCoefficient: 0.4,
    defaults: {
        amount: 150,
        minimumDuration: 250
    },
    apply(state, upgrade) {
        if (!state) {
            return;
        }
        const decrease = Number.isFinite(upgrade?.computedAmount)
            ? upgrade.computedAmount
            : Number.isFinite(upgrade?.options?.amount)
              ? upgrade.options.amount
              : 0;
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
    },
    resolveAmount(state, upgrade) {
        const base = Number.isFinite(upgrade?.baseAmount) ? upgrade.baseAmount : upgrade?.options?.amount ?? 0;
        if (!Number.isFinite(base) || base <= 0) {
            return 0;
        }
        const currentDuration = Number.isFinite(state?.animationDuration) ? state.animationDuration : 0;
        const minimum = Number.isFinite(upgrade?.options?.minimumDuration)
            ? upgrade.options.minimumDuration
            : 0;
        if (!Number.isFinite(currentDuration) || currentDuration <= 0) {
            return base;
        }
        if (minimum > 0) {
            const nextDuration = Math.max(minimum, currentDuration - base);
            const reduced = currentDuration - nextDuration;
            return reduced > 0 ? reduced : 0;
        }
        return base;
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
    if (overrides.amount != null) {
        options.amount = overrides.amount;
    }
    if (overrides.minimumDuration != null) {
        options.minimumDuration = overrides.minimumDuration;
    }

    const baseCost = Number.isFinite(overrides.baseCost)
        ? overrides.baseCost
        : Number.isFinite(overrides.cost)
          ? overrides.cost
          : Number.isFinite(definition.cost)
            ? definition.cost
            : 0;
    const costGrowthRate = Number.isFinite(overrides.costGrowthRate)
        ? overrides.costGrowthRate
        : Number.isFinite(definition.costGrowthRate)
          ? definition.costGrowthRate
          : 1;
    const costLinearCoefficient = Number.isFinite(overrides.costLinearCoefficient)
        ? overrides.costLinearCoefficient
        : Number.isFinite(definition.costLinearCoefficient)
          ? definition.costLinearCoefficient
          : 0;

    const baseAmountValue = Number.isFinite(overrides.baseAmount)
        ? overrides.baseAmount
        : Number.isFinite(options?.amount)
          ? options.amount
          : Number.isFinite(definition.defaults?.amount)
            ? definition.defaults.amount
            : 0;
    if (Number.isFinite(baseAmountValue)) {
        options.amount = baseAmountValue;
    }

    const amountResolver =
        typeof overrides.resolveAmount === "function"
            ? overrides.resolveAmount
            : typeof definition.resolveAmount === "function"
              ? definition.resolveAmount
              : null;

    const instance = {
        id,
        type: resolveUpgradeType(definition, overrides),
        title: overrides.title ?? definition.title ?? id,
        description: overrides.description ?? definition.description ?? "",
        cost: Math.max(baseCost, 0),
        baseCost: Math.max(baseCost, 0),
        costGrowthRate: costGrowthRate > 0 ? costGrowthRate : 1,
        costLinearCoefficient: Number.isFinite(costLinearCoefficient) ? costLinearCoefficient : 0,
        baseAmount: Number.isFinite(baseAmountValue) ? baseAmountValue : 0,
        options,
        level: 0,
        purchased: false,
        applyEffect: definition.apply,
        amountResolver
    };

    return instance;
}

function resolveDeckUpgradeProfile(deckId) {
    const defaults = DECK_UPGRADE_CONFIG?.default ?? {};
    const deckSpecific = deckId && DECK_UPGRADE_CONFIG ? DECK_UPGRADE_CONFIG[deckId] : null;
    const deckProfile = deckSpecific ?? {};

    const defaultBasics = defaults.basic ?? {};
    const deckBasics = deckProfile.basic ?? {};

    const combinedBasics = { ...defaultBasics, ...deckBasics };

    const defaultUnique = Array.isArray(defaults.unique) ? defaults.unique : [];
    const deckUnique = Array.isArray(deckProfile.unique) ? deckProfile.unique : [];

    return {
        basic: combinedBasics,
        unique: [...defaultUnique, ...deckUnique]
    };
}

function normalizeUpgradeEntry(id, baseSettings = {}, overrides = {}) {
    const baseOptions = { ...(baseSettings.options ?? {}) };
    if (baseSettings.amount != null) {
        baseOptions.amount ??= baseSettings.amount;
    }
    if (baseSettings.minimumDuration != null) {
        baseOptions.minimumDuration ??= baseSettings.minimumDuration;
    }

    const overrideOptions = { ...(overrides.options ?? {}) };
    if (overrides.amount != null) {
        overrideOptions.amount = overrides.amount;
    }
    if (overrides.minimumDuration != null) {
        overrideOptions.minimumDuration = overrides.minimumDuration;
    }

    const options = { ...baseOptions, ...overrideOptions };

    const entry = {
        id,
        cost: overrides.cost ?? baseSettings.cost,
        baseCost: overrides.baseCost ?? overrides.cost ?? baseSettings.baseCost ?? baseSettings.cost,
        costGrowthRate: overrides.costGrowthRate ?? baseSettings.costGrowthRate,
        costLinearCoefficient: overrides.costLinearCoefficient ?? baseSettings.costLinearCoefficient,
        options
    };

    if (overrides.baseAmount != null) {
        entry.baseAmount = overrides.baseAmount;
    } else if (baseSettings.baseAmount != null) {
        entry.baseAmount = baseSettings.baseAmount;
    } else if (options.amount != null) {
        entry.baseAmount = options.amount;
    }

    if (typeof overrides.resolveAmount === "function") {
        entry.resolveAmount = overrides.resolveAmount;
    } else if (typeof overrides.amountResolver === "function") {
        entry.resolveAmount = overrides.amountResolver;
    }

    if (overrides.title) {
        entry.title = overrides.title;
    }
    if (overrides.description) {
        entry.description = overrides.description;
    }
    if (overrides.type) {
        entry.type = overrides.type;
    }

    return entry;
}

function buildDeckUpgradeList(config) {
    const deckId = config?.id ?? null;
    const profile = resolveDeckUpgradeProfile(deckId);
    const basics = BASIC_UPGRADE_IDS.map((id) => {
        const baseSettings = BASIC_UPGRADE_SETTINGS[id] ?? {};
        const overrides = profile.basic?.[id] ?? {};
        const entry = normalizeUpgradeEntry(id, baseSettings, overrides);
        if (!entry) {
            return null;
        }
        return createUpgradeInstance(entry);
    }).filter(Boolean);

    const extras = profile.unique
        .map((entry) => {
            if (!entry) {
                return null;
            }
            if (typeof entry === "string") {
                return createUpgradeInstance(entry);
            }
            const entryId = entry.id;
            if (!entryId) {
                return null;
            }
            const baseSettings = BASIC_UPGRADE_SETTINGS[entryId] ?? {};
            const normalized = normalizeUpgradeEntry(entryId, baseSettings, entry);
            if (!normalized) {
                return null;
            }
            return createUpgradeInstance(normalized);
        })
        .filter(Boolean);

    return [...basics, ...extras];
}

function calculateUpgradeCost(upgrade) {
    if (!upgrade) {
        return 0;
    }
    const baseCost = Number.isFinite(upgrade.baseCost) ? upgrade.baseCost : upgrade.cost ?? 0;
    const level = Number.isFinite(upgrade.level) && upgrade.level > 0 ? upgrade.level : 0;
    const growthRate =
        Number.isFinite(upgrade.costGrowthRate) && upgrade.costGrowthRate > 0
            ? upgrade.costGrowthRate
            : 1;
    const linearCoefficient = Number.isFinite(upgrade.costLinearCoefficient)
        ? upgrade.costLinearCoefficient
        : 0;
    const exponentialPart = Math.pow(growthRate, level);
    const linearPart = 1 + linearCoefficient * level;
    const cost = baseCost * linearPart * exponentialPart;
    if (!Number.isFinite(cost) || cost <= 0) {
        return Number.MAX_SAFE_INTEGER;
    }
    return Math.ceil(cost);
}

function calculateUpgradeAmount(state, upgrade) {
    if (!upgrade) {
        return 0;
    }
    const baseAmount = Number.isFinite(upgrade.baseAmount)
        ? upgrade.baseAmount
        : Number.isFinite(upgrade.options?.amount)
          ? upgrade.options.amount
          : 0;
    const resolver = typeof upgrade.amountResolver === "function" ? upgrade.amountResolver : null;
    if (resolver) {
        const resolved = resolver(state, upgrade);
        if (Number.isFinite(resolved) && resolved >= 0) {
            return resolved;
        }
    }
    return baseAmount;
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
        const level = Number.isFinite(upgrade?.level) ? upgrade.level : 0;
        const card = document.createElement("article");
        card.className = "upgrade-card";
        card.dataset.upgradeId = upgrade.id;
        card.setAttribute("role", "listitem");
        if (upgrade.type === UPGRADE_TYPES.UNIQUE) {
            card.classList.add("upgrade-card-unique");
        }
        if (level > 0) {
            card.classList.add("upgrade-card-purchased");
        }
        card.dataset.level = `${level}`;

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

        const cost = calculateUpgradeCost(upgrade);
        const amount = calculateUpgradeAmount(state, upgrade);
        const shouldDisable = amount <= 0 || cost <= 0 || !Number.isFinite(cost);
        button.disabled = shouldDisable;
        button.textContent = shouldDisable ? "maxed" : formatChipAmount(cost);
        upgrade.cost = shouldDisable ? 0 : cost;
        button.setAttribute(
            "aria-label",
            shouldDisable
                ? `upgrade ${upgrade.title ?? upgrade.id} maxed`
                : `upgrade ${upgrade.title ?? upgrade.id} for ${formatChipAmount(cost)}`
        );
        button.dataset.cost = `${cost}`;
        button.dataset.amount = `${amount}`;

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
    const amount = calculateUpgradeAmount(state, upgrade);
    if (amount <= 0) {
        return;
    }
    upgrade.computedAmount = amount;
    upgrade.applyEffect(state, upgrade);
    delete upgrade.computedAmount;
    upgrade.level = (Number.isFinite(upgrade.level) ? upgrade.level : 0) + 1;
    upgrade.purchased = upgrade.level > 0;
    upgrade.cost = calculateUpgradeCost(upgrade);
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
    if (!upgrade || button.disabled) {
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
        cost: calculateUpgradeCost(upgrade),
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
