import {
    DEFAULT_BASE_CHIP_PAYOUT,
    DEFAULT_STREAK_CHIP_MULTIPLIER
} from "./config.js";
import { canAffordChips, formatChipAmount, spendChips, subscribeToChipChanges } from "./chips.js";
import {
    canAffordDice,
    formatDiceAmount,
    spendDice,
    subscribeToDiceChanges
} from "./dice.js";
import {
    canAffordStatus,
    formatStatusAmount,
    spendStatus,
    subscribeToStatusChanges
} from "./status.js";
import { DECK_UPGRADE_CONFIG } from "./upgrade-config.js";

export const UPGRADE_TYPES = {
    BASIC: "basic",
    UNIQUE: "unique"
};

const BASIC_UPGRADE_IDS = ["increase_payout", "increase_streak_multiplier", "decrease_draw_time"];
const BASIC_UPGRADE_ID_SET = new Set(BASIC_UPGRADE_IDS);
const DEFAULT_UNLOCKED_UPGRADE_SLOTS = 5;
const MAX_UPGRADE_SLOT_COUNT = 5;
const UNIQUE_UPGRADE_SLOT_COUNT = 3;
const DEFAULT_UNIQUE_REROLL_COST = 1;
const DEFAULT_UNIQUE_UPGRADE_COST = 10;

const upgradeRegistry = new Map();

function normalizeStringValue(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function registerUpgrade(definition) {
    if (!definition?.id) {
        return;
    }
    upgradeRegistry.set(definition.id, { ...definition });
}

function isUpgradePoolConfig(entry) {
    if (!entry || typeof entry !== "object") {
        return false;
    }
    if (!Array.isArray(entry.entries)) {
        return false;
    }
    return true;
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
            if (!entry) {
                return;
            }
            if (isUpgradePoolConfig(entry)) {
                entry.entries.forEach((poolEntry) => {
                    if (!poolEntry || typeof poolEntry !== "object") {
                        return;
                    }
                    const poolDefinition = poolEntry.definition ?? null;
                    const poolId = poolEntry.id ?? poolDefinition?.id ?? null;
                    if (!poolDefinition || !poolId || seen.has(poolId) || upgradeRegistry.has(poolId)) {
                        return;
                    }
                    seen.add(poolId);
                    registerUpgrade({ id: poolId, ...poolDefinition });
                });
                return;
            }
            if (typeof entry !== "object") {
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
    title: "streak multiplier",
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
    description: "deal hands faster by shortening the shuffle animation.",
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

    const increaseAmountValue = Number.isFinite(overrides.increaseAmount)
        ? overrides.increaseAmount
        : Number.isFinite(overrides.baseAmount)
          ? overrides.baseAmount
          : Number.isFinite(options?.amount)
            ? options.amount
            : Number.isFinite(definition.defaults?.amount)
              ? definition.defaults.amount
              : null;

    const amountResolver =
        typeof overrides.resolveAmount === "function"
            ? overrides.resolveAmount
            : typeof definition.resolveAmount === "function"
              ? definition.resolveAmount
              : null;

    const backgroundColor = normalizeStringValue(
        overrides.backgroundColor != null ? overrides.backgroundColor : definition?.backgroundColor
    );
    const glyph = normalizeStringValue(overrides.glyph != null ? overrides.glyph : definition?.glyph);
    const glyphColor = normalizeStringValue(
        overrides.glyphColor != null ? overrides.glyphColor : definition?.glyphColor
    );
    const resolvedType = resolveUpgradeType(definition, overrides);
    const providedTextSize = normalizeStringValue(
        overrides.textSize != null ? overrides.textSize : definition?.textSize
    );
    const textSize =
        providedTextSize ?? (resolvedType === UPGRADE_TYPES.UNIQUE ? "4rem" : null);
    const baseUniqueCost = Number.isFinite(overrides.uniqueCost)
        ? overrides.uniqueCost
        : Number.isFinite(definition?.uniqueCost)
          ? definition.uniqueCost
          : DEFAULT_UNIQUE_UPGRADE_COST;

    const instance = {
        id,
        type: resolvedType,
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

    if (textSize) {
        instance.textSize = textSize;
    }

    if (resolvedType === UPGRADE_TYPES.UNIQUE) {
        const resolvedUniqueCost =
            Number.isFinite(baseUniqueCost) && baseUniqueCost > 0
                ? Math.ceil(baseUniqueCost)
                : DEFAULT_UNIQUE_UPGRADE_COST;
        instance.uniqueCost = resolvedUniqueCost;
    }

    if (Number.isFinite(increaseAmountValue)) {
        instance.increaseAmount = increaseAmountValue;
    }

    const presentation = {};
    if (backgroundColor) {
        presentation.backgroundColor = backgroundColor;
    }
    if (glyph) {
        presentation.glyph = glyph;
    }
    if (glyphColor) {
        presentation.glyphColor = glyphColor;
    }
    if (textSize) {
        presentation.textSize = textSize;
    }
    if (Object.keys(presentation).length > 0) {
        instance.presentation = presentation;
        if (presentation.backgroundColor) {
            instance.backgroundColor = presentation.backgroundColor;
        }
        if (presentation.glyph) {
            instance.glyph = presentation.glyph;
        }
        if (presentation.glyphColor) {
            instance.glyphColor = presentation.glyphColor;
        }
    }

    return instance;
}

function cloneUpgradeConfig(entry) {
    if (!entry || typeof entry !== "object") {
        return null;
    }
    const clone = { ...entry };
    if (entry.options && typeof entry.options === "object") {
        clone.options = { ...entry.options };
    }
    return clone;
}

function mergeUpgradeConfig(baseEntry, overrideEntry) {
    if (!baseEntry && !overrideEntry) {
        return null;
    }
    if (overrideEntry && overrideEntry.enabled === false) {
        return { enabled: false };
    }
    if (!baseEntry) {
        return cloneUpgradeConfig(overrideEntry);
    }
    if (!overrideEntry) {
        return cloneUpgradeConfig(baseEntry);
    }

    const merged = cloneUpgradeConfig(baseEntry) ?? {};

    Object.entries(overrideEntry).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }
        if (key === "options" && value && typeof value === "object") {
            merged.options = { ...(merged.options ?? {}) };
            Object.entries(value).forEach(([optionKey, optionValue]) => {
                if (optionValue === undefined) {
                    return;
                }
                merged.options[optionKey] = optionValue;
            });
        } else {
            merged[key] = value;
        }
    });

    return merged;
}

function resolveDeckUpgradeProfile(deckId) {
    const defaults = DECK_UPGRADE_CONFIG?.default ?? {};
    const deckSpecific = deckId && DECK_UPGRADE_CONFIG ? DECK_UPGRADE_CONFIG[deckId] : null;
    const deckProfile = deckSpecific ?? {};

    const defaultBasics = defaults.basic ?? {};
    const deckBasics = deckProfile.basic ?? {};

    const combinedBasics = {};
    const basicKeys = new Set([
        ...Object.keys(defaultBasics),
        ...Object.keys(deckBasics)
    ]);
    basicKeys.forEach((id) => {
        const merged = mergeUpgradeConfig(defaultBasics[id], deckBasics[id]);
        if (merged) {
            combinedBasics[id] = merged;
        }
    });

    const defaultUnique = Array.isArray(defaults.unique) ? defaults.unique : [];
    const deckUnique = Array.isArray(deckProfile.unique) ? deckProfile.unique : [];

    const baseChipsAmount = Number.isFinite(deckProfile.baseChipsAmount)
        ? deckProfile.baseChipsAmount
        : Number.isFinite(defaults.baseChipsAmount)
          ? defaults.baseChipsAmount
          : null;
    const baseMultiplierAmount = Number.isFinite(deckProfile.baseMultiplierAmount)
        ? deckProfile.baseMultiplierAmount
        : Number.isFinite(defaults.baseMultiplierAmount)
          ? defaults.baseMultiplierAmount
          : null;
    const baseDrawTime = Number.isFinite(deckProfile.baseDrawTime)
        ? deckProfile.baseDrawTime
        : Number.isFinite(defaults.baseDrawTime)
          ? defaults.baseDrawTime
          : null;
    const baseHandSize = Number.isFinite(deckProfile.baseHandSize)
        ? deckProfile.baseHandSize
        : Number.isFinite(defaults.baseHandSize)
          ? defaults.baseHandSize
          : null;
    const autoDrawBurnCardCost = Number.isFinite(deckProfile.autoDrawBurnCardCost)
        ? deckProfile.autoDrawBurnCardCost
        : Number.isFinite(defaults.autoDrawBurnCardCost)
          ? defaults.autoDrawBurnCardCost
          : null;
    const cardShopValueMultiplier = Number.isFinite(deckProfile.cardShopValueMultiplier)
        ? deckProfile.cardShopValueMultiplier
        : Number.isFinite(defaults.cardShopValueMultiplier)
          ? defaults.cardShopValueMultiplier
          : null;

    return {
        basic: combinedBasics,
        unique: [...defaultUnique, ...deckUnique],
        baseChipsAmount,
        baseMultiplierAmount,
        baseDrawTime,
        baseHandSize,
        autoDrawBurnCardCost,
        cardShopValueMultiplier
    };
}

function normalizeUpgradeEntry(id, config = {}) {
    if (!config) {
        return null;
    }
    if (typeof config === "string") {
        return { id: config };
    }
    if (config.enabled === false) {
        return null;
    }

    const options = { ...(config.options ?? {}) };

    if (config.minimumDuration != null) {
        options.minimumDuration = config.minimumDuration;
    }
    if (config.amount != null) {
        options.amount = config.amount;
    }
    if (config.increaseAmount != null) {
        options.amount ??= config.increaseAmount;
    }
    if (config.baseAmount != null) {
        options.amount ??= config.baseAmount;
    }

    const cost = Number.isFinite(config.cost) ? config.cost : undefined;
    const baseCost = Number.isFinite(config.baseCost) ? config.baseCost : cost;
    const costGrowthRate = Number.isFinite(config.costGrowthRate) ? config.costGrowthRate : undefined;
    const costLinearCoefficient = Number.isFinite(config.costLinearCoefficient)
        ? config.costLinearCoefficient
        : undefined;
    const uniqueCost = Number.isFinite(config.uniqueCost) ? config.uniqueCost : undefined;

    const entry = {
        id,
        cost,
        baseCost,
        costGrowthRate,
        costLinearCoefficient,
        options
    };

    if (uniqueCost != null) {
        entry.uniqueCost = uniqueCost;
    }

    if (config.baseAmount != null) {
        entry.baseAmount = config.baseAmount;
    } else if (config.increaseAmount != null) {
        entry.baseAmount = config.increaseAmount;
    } else if (options.amount != null) {
        entry.baseAmount = options.amount;
    }

    if (config.increaseAmount != null) {
        entry.increaseAmount = config.increaseAmount;
    } else if (entry.baseAmount != null) {
        entry.increaseAmount = entry.baseAmount;
    }

    if (typeof config.resolveAmount === "function") {
        entry.resolveAmount = config.resolveAmount;
    } else if (typeof config.amountResolver === "function") {
        entry.resolveAmount = config.amountResolver;
    }

    if (config.title) {
        entry.title = config.title;
    }
    if (config.description) {
        entry.description = config.description;
    }
    if (config.type) {
        entry.type = config.type;
    }
    if (config.definition) {
        entry.definition = config.definition;
    }

    const backgroundColor = normalizeStringValue(config.backgroundColor);
    if (backgroundColor) {
        entry.backgroundColor = backgroundColor;
    }
    const glyph = normalizeStringValue(config.glyph);
    if (glyph) {
        entry.glyph = glyph;
    }
    const glyphColor = normalizeStringValue(config.glyphColor);
    if (glyphColor) {
        entry.glyphColor = glyphColor;
    }
    const textSize = normalizeStringValue(config.textSize);
    if (textSize) {
        entry.textSize = textSize;
    }

    return entry;
}

function normalizeUpgradePoolDefinition(entry, fallbackIndex) {
    if (!isUpgradePoolConfig(entry)) {
        return null;
    }
    const providedIdCandidates = [entry.poolId, entry.id];
    let poolId = null;
    for (let index = 0; index < providedIdCandidates.length; index += 1) {
        const candidate = providedIdCandidates[index];
        if (typeof candidate === "string" && candidate.trim()) {
            poolId = candidate.trim();
            break;
        }
    }
    if (!poolId) {
        poolId = `upgrade_pool_${fallbackIndex}`;
    }
    const rawDrawCount = Number.isFinite(entry.drawCount)
        ? entry.drawCount
        : Number.isFinite(entry.draw)
            ? entry.draw
            : Number.isFinite(entry.count)
                ? entry.count
                : null;
    const drawCount = Number.isFinite(rawDrawCount) ? Math.max(0, Math.floor(rawDrawCount)) : null;
    let refreshSettings = null;
    if (entry.refreshSettings && typeof entry.refreshSettings === "object") {
        refreshSettings = { ...entry.refreshSettings };
    } else if (entry.refresh && typeof entry.refresh === "object") {
        refreshSettings = { ...entry.refresh };
    } else if (entry.refresh != null) {
        refreshSettings = { value: entry.refresh };
    }
    const entries = Array.isArray(entry.entries) ? entry.entries.filter((item) => item != null) : [];
    return {
        poolId,
        entries,
        drawCount,
        refreshSettings
    };
}

function selectPoolUpgrades(poolDefinition, existingState = null) {
    if (!poolDefinition) {
        return { upgrades: [], state: null };
    }
    const poolEntries = [];
    const seenIds = new Set();
    poolDefinition.entries.forEach((rawEntry) => {
        if (!rawEntry) {
            return;
        }
        if (typeof rawEntry === "string") {
            const instance = createUpgradeInstance(rawEntry);
            if (!instance || seenIds.has(instance.id)) {
                return;
            }
            seenIds.add(instance.id);
            poolEntries.push({ id: instance.id, instance });
            return;
        }
        if (typeof rawEntry !== "object") {
            return;
        }
        const entryId = rawEntry.id;
        if (!entryId) {
            return;
        }
        const normalized = normalizeUpgradeEntry(entryId, rawEntry);
        if (!normalized) {
            return;
        }
        const instance = createUpgradeInstance(normalized);
        if (!instance || seenIds.has(instance.id)) {
            return;
        }
        seenIds.add(instance.id);
        poolEntries.push({ id: instance.id, instance });
    });

    const availableIds = poolEntries.map((entry) => entry.id);
    const maximumSelectable = availableIds.length;
    const configuredDrawCount = Number.isFinite(poolDefinition.drawCount)
        ? Math.max(0, Math.floor(poolDefinition.drawCount))
        : maximumSelectable;
    const drawCount = Math.min(configuredDrawCount, maximumSelectable);

    const previousState = existingState && typeof existingState === "object" ? existingState : null;
    const shouldRefresh = previousState?.refreshRequested === true;
    const preservedSelection = [];

    if (!shouldRefresh && Array.isArray(previousState?.selectedIds)) {
        previousState.selectedIds.forEach((id) => {
            if (preservedSelection.length >= drawCount) {
                return;
            }
            if (!availableIds.includes(id)) {
                return;
            }
            if (preservedSelection.includes(id)) {
                return;
            }
            preservedSelection.push(id);
        });
    }

    const remainingIds = availableIds.filter((id) => !preservedSelection.includes(id));
    while (preservedSelection.length < drawCount && remainingIds.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingIds.length);
        const [nextId] = remainingIds.splice(randomIndex, 1);
        if (nextId != null) {
            preservedSelection.push(nextId);
        }
    }

    const selectedUpgrades = preservedSelection
        .map((id) => poolEntries.find((entry) => entry.id === id)?.instance ?? null)
        .filter(Boolean);

    const poolState = {
        id: poolDefinition.poolId,
        drawCount,
        availableIds,
        selectedIds: preservedSelection,
        refreshRequested: false
    };
    if (poolDefinition.refreshSettings) {
        poolState.refreshSettings = poolDefinition.refreshSettings;
    }

    return {
        upgrades: selectedUpgrades,
        state: poolState
    };
}

function buildDeckUpgradeList(config, existingPoolState = null) {
    const deckId = config?.id ?? null;
    const profile = resolveDeckUpgradeProfile(deckId);
    const basics = [];
    const seenBasics = new Set();

    const addBasicUpgrade = (id, settings) => {
        if (seenBasics.has(id)) {
            return;
        }
        seenBasics.add(id);
        const normalized = normalizeUpgradeEntry(id, settings);
        if (!normalized) {
            return;
        }
        const instance = createUpgradeInstance(normalized);
        if (instance) {
            basics.push(instance);
        }
    };

    BASIC_UPGRADE_IDS.forEach((id) => {
        if (profile.basic && Object.prototype.hasOwnProperty.call(profile.basic, id)) {
            addBasicUpgrade(id, profile.basic[id]);
        }
    });

    if (profile.basic) {
        Object.entries(profile.basic).forEach(([id, settings]) => {
            if (seenBasics.has(id)) {
                return;
            }
            addBasicUpgrade(id, settings);
        });
    }

    const uniqueEntries = Array.isArray(profile.unique) ? profile.unique : [];
    const directUniqueEntries = [];
    const poolDefinitions = [];

    uniqueEntries.forEach((entry, index) => {
        if (isUpgradePoolConfig(entry)) {
            const normalizedPool = normalizeUpgradePoolDefinition(entry, index);
            if (normalizedPool) {
                poolDefinitions.push(normalizedPool);
            }
            return;
        }
        directUniqueEntries.push(entry);
    });

    const extras = directUniqueEntries
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
            const normalized = normalizeUpgradeEntry(entryId, entry);
            if (!normalized) {
                return null;
            }
            return createUpgradeInstance(normalized);
        })
        .filter(Boolean);

    const poolStateResult = {};
    poolDefinitions.forEach((poolDefinition) => {
        const previousState =
            existingPoolState && typeof existingPoolState === "object"
                ? existingPoolState[poolDefinition.poolId]
                : null;
        const { upgrades: selected, state } = selectPoolUpgrades(poolDefinition, previousState);
        if (Array.isArray(selected) && selected.length > 0) {
            extras.push(...selected);
        }
        if (state) {
            poolStateResult[poolDefinition.poolId] = state;
        }
    });

    return {
        upgrades: [...basics, ...extras],
        baseChipsAmount: profile.baseChipsAmount,
        baseMultiplierAmount: profile.baseMultiplierAmount,
        baseDrawTime: profile.baseDrawTime,
        baseHandSize: profile.baseHandSize,
        autoDrawBurnCardCost: profile.autoDrawBurnCardCost,
        cardShopValueMultiplier: profile.cardShopValueMultiplier,
        poolState: poolDefinitions.length > 0 ? poolStateResult : {}
    };
}

function calculateUpgradeCost(upgrade) {
    if (!upgrade) {
        return 0;
    }
    if (upgrade.type === UPGRADE_TYPES.UNIQUE) {
        if (upgrade.purchased) {
            return Number.MAX_SAFE_INTEGER;
        }
        const uniqueCost = Number.isFinite(upgrade.uniqueCost)
            ? Math.ceil(Math.max(0, upgrade.uniqueCost))
            : DEFAULT_UNIQUE_UPGRADE_COST;
        if (!Number.isFinite(uniqueCost) || uniqueCost <= 0) {
            return Number.MAX_SAFE_INTEGER;
        }
        return uniqueCost;
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
    if (upgrade.type === UPGRADE_TYPES.UNIQUE && upgrade.purchased) {
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

function getUpgradePresentation(upgrade) {
    if (!upgrade) {
        return { backgroundColor: null, glyph: "", glyphColor: null, textSize: null };
    }
    const presentation =
        upgrade.presentation && typeof upgrade.presentation === "object" ? upgrade.presentation : {};
    const backgroundColor =
        normalizeStringValue(upgrade.backgroundColor) ?? normalizeStringValue(presentation.backgroundColor);
    const glyph = normalizeStringValue(upgrade.glyph) ?? normalizeStringValue(presentation.glyph);
    const glyphColor =
        normalizeStringValue(upgrade.glyphColor) ?? normalizeStringValue(presentation.glyphColor);
    const textSize =
        normalizeStringValue(upgrade.textSize) ?? normalizeStringValue(presentation.textSize);
    return {
        backgroundColor: backgroundColor ?? null,
        glyph: glyph ?? "",
        glyphColor: glyphColor ?? null,
        textSize: textSize ?? null
    };
}

function getUnlockedUpgradeSlotCount(state) {
    const customCount = Number.isFinite(state?.unlockedUpgradeSlots) ? state.unlockedUpgradeSlots : null;
    const resolved = customCount != null ? customCount : DEFAULT_UNLOCKED_UPGRADE_SLOTS;
    if (!Number.isFinite(resolved) || resolved <= 0) {
        return 0;
    }
    return Math.min(Math.max(Math.floor(resolved), 0), MAX_UPGRADE_SLOT_COUNT);
}

function getPurchasedUpgradesInOrder(state) {
    if (!state?.upgrades) {
        return [];
    }
    const order = Array.isArray(state.purchasedUpgradeOrder) ? state.purchasedUpgradeOrder : [];
    const orderSet = new Set(order);
    const byId = new Map(state.upgrades.map((upgrade) => [upgrade.id, upgrade]));
    const isPurchased = (upgrade) => {
        if (!upgrade) {
            return false;
        }
        if (upgrade.type === UPGRADE_TYPES.UNIQUE) {
            return upgrade.purchased === true;
        }
        return Number.isFinite(upgrade.level) && upgrade.level > 0;
    };

    const ordered = order
        .map((id) => byId.get(id))
        .filter((upgrade) => isPurchased(upgrade));

    state.upgrades.forEach((upgrade) => {
        if (!isPurchased(upgrade)) {
            return;
        }
        if (!orderSet.has(upgrade.id)) {
            ordered.push(upgrade);
        }
    });

    return ordered;
}

function renderUpgradeSlots(state) {
    if (!state?.dom?.upgradeSlots) {
        return;
    }
    const container = state.dom.upgradeSlots;
    const unlockedSlots = getUnlockedUpgradeSlotCount(state);
    const purchasedUpgrades = getPurchasedUpgradesInOrder(state);
    const purchasedUniqueUpgrades = purchasedUpgrades.filter(
        (upgrade) => upgrade?.type === UPGRADE_TYPES.UNIQUE
    );
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < MAX_UPGRADE_SLOT_COUNT; index += 1) {
        const slot = document.createElement("div");
        slot.className = "upgrade-slot";
        slot.setAttribute("role", "listitem");

        if (index >= unlockedSlots) {
            slot.classList.add("locked");
            slot.setAttribute("aria-label", "locked upgrade slot");
            fragment.append(slot);
            continue;
        }

        const upgrade = purchasedUniqueUpgrades[index];
        if (!upgrade) {
            slot.classList.add("empty");
            slot.setAttribute("aria-label", "empty upgrade slot");
            fragment.append(slot);
            continue;
        }

        const { backgroundColor, glyph, glyphColor, textSize } = getUpgradePresentation(upgrade);
        if (backgroundColor || glyph) {
            const visual = document.createElement("div");
            visual.className = "upgrade-slot-visual";
            if (backgroundColor) {
                visual.style.backgroundColor = backgroundColor;
            }
            if (glyph) {
                const glyphElement = document.createElement("span");
                glyphElement.className = "upgrade-slot-glyph";
                glyphElement.textContent = glyph;
                if (glyphColor) {
                    glyphElement.style.color = glyphColor;
                }
                if (textSize) {
                    glyphElement.style.fontSize = textSize;
                }
                visual.append(glyphElement);
            }
            slot.classList.add("upgrade-slot-with-visual");
            slot.append(visual);
        }

        const primaryText =
            typeof upgrade.title === "string"
                ? upgrade.title
                : typeof upgrade.id === "string"
                  ? upgrade.id
                  : typeof upgrade.getCurrentValue === "function"
                    ? upgrade.getCurrentValue(state)
                    : "";
        const trimmed = typeof primaryText === "string" ? primaryText.trim() : "";
        if (trimmed) {
            slot.setAttribute("aria-label", trimmed);
            const tooltip = document.createElement("div");
            tooltip.className = "upgrade-slot-tooltip";
            tooltip.textContent = trimmed;
            tooltip.setAttribute("aria-hidden", "true");
            slot.append(tooltip);
        }

        fragment.append(slot);
    }

    container.replaceChildren(fragment);
}

function createUpgradeCardElement(state, upgrade) {
    if (!state || !upgrade) {
        return null;
    }
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

    const { backgroundColor, glyph, glyphColor, textSize } = getUpgradePresentation(upgrade);
    const isBasicUpgrade = upgrade.type === UPGRADE_TYPES.BASIC;
    const showVisual = !isBasicUpgrade && (backgroundColor || glyph);

    const header = document.createElement("div");
    header.className = "upgrade-card-header";

    const rawTitle =
        typeof upgrade.title === "string"
            ? upgrade.title
            : typeof upgrade.id === "string"
              ? upgrade.id
              : "";
    const titleText = rawTitle.trim();
    const currentValue =
        typeof upgrade.getCurrentValue === "function" ? upgrade.getCurrentValue(state) : null;
    const statText =
        upgrade.type === UPGRADE_TYPES.UNIQUE
            ? titleText || currentValue || rawTitle
            : currentValue || titleText || rawTitle;
    const trimmedStatText = typeof statText === "string" ? statText.trim() : "";
    const rawDescription =
        typeof upgrade.description === "string" ? upgrade.description.trim() : "";
    const descriptionText =
        upgrade.type === UPGRADE_TYPES.BASIC ? "" : rawDescription;
    const displayTitle = trimmedStatText || titleText || rawTitle;
    const accessibleParts = [];
    if (displayTitle) {
        accessibleParts.push(displayTitle);
    }
    if (descriptionText && descriptionText !== displayTitle) {
        accessibleParts.push(descriptionText);
    }
    const accessibleLabel = accessibleParts.join(". ") || displayTitle || descriptionText || "";

    if (showVisual) {
        const visual = document.createElement("div");
        visual.className = "upgrade-card-visual";
        if (backgroundColor) {
            visual.style.backgroundColor = backgroundColor;
        }
        if (glyph) {
            const glyphElement = document.createElement("span");
            glyphElement.className = "upgrade-card-glyph";
            glyphElement.textContent = glyph;
            if (glyphColor) {
                glyphElement.style.color = glyphColor;
            }
            if (textSize) {
                glyphElement.style.fontSize = textSize;
            }
            visual.append(glyphElement);
        } else {
            const fallbackLabel = displayTitle || titleText || rawTitle || upgrade.id;
            if (fallbackLabel) {
                const fallbackElement = document.createElement("span");
                fallbackElement.className = "upgrade-card-visual-label";
                fallbackElement.textContent = fallbackLabel;
                visual.append(fallbackElement);
            }
        }
        header.append(visual);
        card.classList.add("upgrade-card-with-visual");

        const stat = document.createElement("div");
        stat.className = "upgrade-card-stat";
        stat.setAttribute("aria-hidden", "true");
        let hasStatContent = false;
        if (trimmedStatText) {
            stat.textContent = trimmedStatText;
            hasStatContent = true;
        }
        if (descriptionText) {
            const descriptionElement = document.createElement("div");
            descriptionElement.className = "upgrade-card-description";
            descriptionElement.textContent = descriptionText;
            stat.append(descriptionElement);
            hasStatContent = true;
        }
        if (hasStatContent) {
            header.append(stat);
        }
    } else {
        const info = document.createElement("div");
        info.className = "upgrade-card-info";

        const stat = document.createElement("div");
        stat.className = "upgrade-card-stat";
        stat.setAttribute("aria-hidden", "true");
        let hasStatContent = false;
        if (trimmedStatText) {
            stat.textContent = trimmedStatText;
            hasStatContent = true;
        }
        if (descriptionText) {
            const descriptionElement = document.createElement("div");
            descriptionElement.className = "upgrade-card-description";
            descriptionElement.textContent = descriptionText;
            stat.append(descriptionElement);
            hasStatContent = true;
        }
        if (hasStatContent) {
            info.append(stat);
        }

        header.append(info);
    }
    if (accessibleLabel) {
        card.setAttribute("aria-label", accessibleLabel);
    }

    const body = document.createElement("div");
    body.className = "upgrade-card-body";

    const buyButton = document.createElement("button");
    buyButton.type = "button";
    buyButton.className = "upgrade-card-button";
    buyButton.dataset.upgradeId = upgrade.id;
    buyButton.dataset.action = "buy";

    const cost = calculateUpgradeCost(upgrade);
    const amount = calculateUpgradeAmount(state, upgrade);
    const isUniqueUpgrade = upgrade.type === UPGRADE_TYPES.UNIQUE;
    const isMaxed = amount <= 0 || cost <= 0 || !Number.isFinite(cost);
    const hasFunds = isUniqueUpgrade ? canAffordStatus(cost) : canAffordChips(cost);
    const insufficientFunds = !isMaxed && !hasFunds;
    const shouldDisable = isMaxed || insufficientFunds;

    buyButton.disabled = shouldDisable;
    if (isMaxed) {
        buyButton.textContent = "maxed";
    } else if (isUniqueUpgrade) {
        buyButton.textContent = formatStatusAmount(cost);
    } else {
        buyButton.textContent = formatChipAmount(cost);
    }

    upgrade.cost = isMaxed ? 0 : cost;

    const formattedCost = Number.isFinite(cost)
        ? isUniqueUpgrade
            ? formatStatusAmount(cost)
            : formatChipAmount(cost)
        : "";
    const upgradeLabel = displayTitle || titleText || rawTitle || upgrade.id;
    if (isMaxed) {
        buyButton.setAttribute("aria-label", `upgrade ${upgradeLabel} maxed`);
    } else if (insufficientFunds) {
        const insufficiencyLabel = isUniqueUpgrade ? "not enough status" : "not enough chips";
        buyButton.setAttribute("aria-label", `upgrade ${upgradeLabel} for ${formattedCost} (${insufficiencyLabel})`);
    } else {
        buyButton.setAttribute("aria-label", `upgrade ${upgradeLabel} for ${formattedCost}`);
    }

    if (Number.isFinite(cost)) {
        buyButton.dataset.cost = `${cost}`;
    } else {
        delete buyButton.dataset.cost;
    }
    buyButton.dataset.amount = `${amount}`;

    body.append(buyButton);

    if (isBasicUpgrade && BASIC_UPGRADE_ID_SET.has(upgrade.id) && !isMaxed) {
        const maxButton = document.createElement("button");
        maxButton.type = "button";
        maxButton.className = "upgrade-card-button upgrade-card-button-max";
        maxButton.dataset.upgradeId = upgrade.id;
        maxButton.dataset.action = "buy-max";
        maxButton.disabled = shouldDisable;
        maxButton.textContent = "buy max";
        if (insufficientFunds) {
            maxButton.setAttribute(
                "aria-label",
                `buy max ${upgradeLabel} for ${formattedCost} (not enough chips)`
            );
        } else if (formattedCost) {
            maxButton.setAttribute("aria-label", `buy maximum ${upgradeLabel} upgrades starting at ${formattedCost}`);
        } else {
            maxButton.setAttribute("aria-label", `buy maximum ${upgradeLabel} upgrades`);
        }
        maxButton.dataset.amount = `${amount}`;
        body.append(maxButton);
    }

    card.append(header, body);
    return card;
}

function renderUpgrades(state) {
    if (!state?.dom?.upgradeList || !state.dom.upgradeUniqueList) {
        return;
    }

    const basicContainer = state.dom.upgradeList;
    const uniqueContainer = state.dom.upgradeUniqueList;
    const rerollButton = state.dom.upgradeUniqueRerollButton ?? null;
    const uniqueRow = state.dom.upgradeUniqueRow ?? null;

    const upgrades = Array.isArray(state.upgrades) ? state.upgrades : [];
    const upgradesById = new Map();
    upgrades.forEach((upgrade) => {
        if (upgrade?.id) {
            upgradesById.set(upgrade.id, upgrade);
        }
    });
    const basicUpgrades = upgrades.filter((upgrade) => upgrade?.type === UPGRADE_TYPES.BASIC);
    const uniqueCandidates = getUnpurchasedUniqueUpgrades(state);
    const deckHasUniqueUpgrades = upgrades.some((upgrade) => upgrade?.type === UPGRADE_TYPES.UNIQUE);
    const slotIds = ensureUniqueUpgradeSlotState(state);
    const slotUpgrades = slotIds.map((slotId) => {
        if (!slotId) {
            return null;
        }
        const upgrade = upgradesById.get(slotId) ?? null;
        if (!upgrade || upgrade.type !== UPGRADE_TYPES.UNIQUE || upgrade.purchased === true) {
            return null;
        }
        return upgrade;
    });

    const basicFragment = document.createDocumentFragment();
    if (basicUpgrades.length === 0 && uniqueCandidates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "upgrade-empty";
        empty.textContent = "no upgrades available";
        basicFragment.append(empty);
    } else {
        basicUpgrades.forEach((upgrade) => {
            const card = createUpgradeCardElement(state, upgrade);
            if (card) {
                basicFragment.append(card);
            }
        });
    }
    basicContainer.replaceChildren(basicFragment);

    const uniqueFragment = document.createDocumentFragment();
    for (let index = 0; index < slotIds.length; index += 1) {
        const upgrade = slotUpgrades[index];
        if (upgrade) {
            const card = createUpgradeCardElement(state, upgrade);
            if (card) {
                uniqueFragment.append(card);
            }
            continue;
        }
        const placeholder = document.createElement("article");
        placeholder.className = "upgrade-card upgrade-card-placeholder";
        placeholder.setAttribute("role", "listitem");
        placeholder.setAttribute("aria-hidden", "true");
        uniqueFragment.append(placeholder);
    }
    uniqueContainer.replaceChildren(uniqueFragment);

    const hasUpgradePools =
        state.upgradePools && typeof state.upgradePools === "object" && Object.keys(state.upgradePools).length > 0;
    const shouldShowRow = deckHasUniqueUpgrades || hasUpgradePools;
    if (uniqueRow) {
        uniqueRow.hidden = !shouldShowRow;
    }
    if (rerollButton) {
        if (!shouldShowRow) {
            rerollButton.hidden = true;
        } else {
            rerollButton.hidden = false;
            const rerollCost = resolveUniqueUpgradeRerollCost(state);
            const formattedRerollCost = formatDiceAmount(rerollCost);
            const hasCandidates = uniqueCandidates.length > 0;
            const affordable = canAffordDice(rerollCost);
            const disableReroll =
                state.isPurchasingUpgrades === true ||
                state.isRerollingUniqueUpgrades === true ||
                !hasCandidates ||
                !affordable;
            rerollButton.disabled = disableReroll;
            rerollButton.textContent = "reroll: ";
            const diceSpan = document.createElement("span");
            diceSpan.className = "dice-shop-text";
            diceSpan.textContent = formattedRerollCost;
            rerollButton.append(diceSpan);
            rerollButton.dataset.cost = `${rerollCost}`;

            let ariaLabel = `reroll unique upgrades for ${formattedRerollCost}`;
            if (state.isPurchasingUpgrades) {
                ariaLabel = "reroll unavailable while purchasing upgrades";
            } else if (state.isRerollingUniqueUpgrades) {
                ariaLabel = "reroll in progress";
            } else if (!hasCandidates) {
                ariaLabel = "reroll unavailable (no upgrades remaining)";
            } else if (!affordable) {
                ariaLabel = `reroll unique upgrades for ${formattedRerollCost} (not enough dice)`;
            }

            rerollButton.setAttribute("aria-label", ariaLabel);
        }
    }

    renderUpgradeSlots(state);
}

function ensureUniqueUpgradeSlotState(state) {
    if (!state) {
        return [];
    }
    if (!Array.isArray(state.uniqueUpgradeSlots) || state.uniqueUpgradeSlots.length !== UNIQUE_UPGRADE_SLOT_COUNT) {
        state.uniqueUpgradeSlots = new Array(UNIQUE_UPGRADE_SLOT_COUNT).fill(null);
    }
    return state.uniqueUpgradeSlots;
}

function resetUniqueUpgradeSlots(state) {
    if (!state) {
        return;
    }
    state.uniqueUpgradeSlotsInitialized = false;
    state.uniqueUpgradeSlots = new Array(UNIQUE_UPGRADE_SLOT_COUNT).fill(null);
}

function getUnpurchasedUniqueUpgrades(state) {
    if (!state?.upgrades) {
        return [];
    }
    return state.upgrades.filter(
        (upgrade) => upgrade?.type === UPGRADE_TYPES.UNIQUE && upgrade.purchased !== true
    );
}

function shuffleArray(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const temp = copy[index];
        copy[index] = copy[swapIndex];
        copy[swapIndex] = temp;
    }
    return copy;
}

function fillUniqueUpgradeSlots(state, { randomize = false, force = false } = {}) {
    if (!state) {
        return;
    }
    const slots = ensureUniqueUpgradeSlotState(state);
    if (!force && state.uniqueUpgradeSlotsInitialized) {
        return;
    }
    const candidates = getUnpurchasedUniqueUpgrades(state);
    const candidateIds = candidates.map((upgrade) => upgrade.id);
    const orderedIds = randomize ? shuffleArray(candidateIds) : candidateIds;
    for (let index = 0; index < slots.length; index += 1) {
        slots[index] = orderedIds[index] ?? null;
    }
    state.uniqueUpgradeSlotsInitialized = true;
}

function removeUniqueFromSlots(state, upgradeId) {
    if (!state || !Array.isArray(state.uniqueUpgradeSlots) || !upgradeId) {
        return;
    }
    const index = state.uniqueUpgradeSlots.indexOf(upgradeId);
    if (index >= 0) {
        state.uniqueUpgradeSlots[index] = null;
    }
}

function resolveUniqueUpgradeRerollCost(state) {
    if (!state) {
        return DEFAULT_UNIQUE_REROLL_COST;
    }
    const current = Number.isFinite(state.uniqueUpgradeRerollCost)
        ? Math.max(DEFAULT_UNIQUE_REROLL_COST, Math.floor(state.uniqueUpgradeRerollCost))
        : DEFAULT_UNIQUE_REROLL_COST;
    state.uniqueUpgradeRerollCost = current;
    return current;
}

function mergeRerolledUpgrades(state, nextUpgrades) {
    const previous = Array.isArray(state?.upgrades) ? state.upgrades : [];
    const previousById = new Map();
    previous.forEach((upgrade) => {
        if (!upgrade || !upgrade.id) {
            return;
        }
        previousById.set(upgrade.id, upgrade);
    });

    const merged = [];

    nextUpgrades.forEach((upgrade) => {
        if (!upgrade || !upgrade.id) {
            return;
        }
        const existing = previousById.get(upgrade.id);
        const getter = upgradeRegistry.get(upgrade.id)?.getCurrentValue;
        const base = {
            ...upgrade
        };
        if (getter) {
            base.getCurrentValue = getter;
        } else {
            delete base.getCurrentValue;
        }
        if (existing) {
            base.level = Number.isFinite(existing.level) ? existing.level : Number.isFinite(base.level) ? base.level : 0;
            base.purchased = existing.purchased === true || (Number.isFinite(base.level) && base.level > 0);
        } else {
            base.level = Number.isFinite(base.level) ? base.level : 0;
            base.purchased = base.purchased === true && base.level > 0;
        }
        base.cost = calculateUpgradeCost(base);
        merged.push(base);
    });

    previous.forEach((upgrade) => {
        if (!upgrade || !upgrade.id) {
            return;
        }
        if (merged.some((entry) => entry.id === upgrade.id)) {
            return;
        }
        if (upgrade.type === UPGRADE_TYPES.UNIQUE && upgrade.purchased) {
            const getter = upgradeRegistry.get(upgrade.id)?.getCurrentValue;
            if (getter) {
                upgrade.getCurrentValue = getter;
            } else {
                delete upgrade.getCurrentValue;
            }
            upgrade.cost = calculateUpgradeCost(upgrade);
            merged.push(upgrade);
        }
    });

    return merged;
}

function rerollUniqueUpgrades(state) {
    if (!state?.config) {
        return;
    }

    const currentPools =
        state.upgradePools && typeof state.upgradePools === "object" ? state.upgradePools : {};
    const hasUpgradePools = Object.keys(currentPools).length > 0;
    const availableBefore = getUnpurchasedUniqueUpgrades(state);
    if (availableBefore.length === 0 && !hasUpgradePools) {
        return;
    }

    const rerollCost = resolveUniqueUpgradeRerollCost(state);
    if (!spendDice(rerollCost)) {
        // ensure we respect the minimum cost if spending fails
        state.uniqueUpgradeRerollCost = Math.max(rerollCost, DEFAULT_UNIQUE_REROLL_COST);
        renderUpgrades(state);
        return;
    }
    state.uniqueUpgradeRerollCost = rerollCost + 1;
    state.isRerollingUniqueUpgrades = true;

    try {
        if (hasUpgradePools) {
            const refreshState = {};
            Object.entries(currentPools).forEach(([poolId, poolState]) => {
                if (!poolId) {
                    return;
                }
                const clonedState =
                    poolState && typeof poolState === "object" ? { ...poolState } : {};
                clonedState.refreshRequested = true;
                refreshState[poolId] = clonedState;
            });

            const {
                upgrades: nextDeckUpgrades,
                poolState
            } = buildDeckUpgradeList(state.config, refreshState);

            const mergedUpgrades = mergeRerolledUpgrades(state, nextDeckUpgrades);
            state.upgrades = mergedUpgrades;
            state.upgradePools = poolState ?? {};
        }

        if (!Array.isArray(state.purchasedUpgradeOrder)) {
            state.purchasedUpgradeOrder = [];
        }
        const purchaseOrderSet = new Set(state.purchasedUpgradeOrder);
        state.upgrades.forEach((upgrade) => {
            if (!upgrade || !upgrade.purchased) {
                return;
            }
            if (!purchaseOrderSet.has(upgrade.id)) {
                state.purchasedUpgradeOrder.push(upgrade.id);
                purchaseOrderSet.add(upgrade.id);
            }
        });

        fillUniqueUpgradeSlots(state, { randomize: true, force: true });
    } finally {
        state.isRerollingUniqueUpgrades = false;
    }

    renderUpgrades(state);
}

function applyUpgrade(state, upgrade) {
    if (!state || !upgrade || typeof upgrade.applyEffect !== "function") {
        return;
    }
    const amount = calculateUpgradeAmount(state, upgrade);
    if (amount <= 0) {
        return;
    }
    const isUniqueUpgrade = upgrade.type === UPGRADE_TYPES.UNIQUE;
    const previousLevel = Number.isFinite(upgrade.level) ? upgrade.level : 0;
    const wasPurchased = upgrade.purchased === true;
    upgrade.computedAmount = amount;
    upgrade.applyEffect(state, upgrade);
    delete upgrade.computedAmount;
    if (isUniqueUpgrade) {
        upgrade.level = 1;
        upgrade.purchased = true;
        removeUniqueFromSlots(state, upgrade.id);
        if (!wasPurchased) {
            if (!Array.isArray(state.purchasedUpgradeOrder)) {
                state.purchasedUpgradeOrder = [];
            }
            state.purchasedUpgradeOrder.push(upgrade.id);
        }
        upgrade.cost = Number.MAX_SAFE_INTEGER;
        return;
    }
    upgrade.level = previousLevel + 1;
    upgrade.purchased = upgrade.level > 0;
    if (upgrade.level > 0 && previousLevel === 0) {
        if (!Array.isArray(state.purchasedUpgradeOrder)) {
            state.purchasedUpgradeOrder = [];
        }
        state.purchasedUpgradeOrder.push(upgrade.id);
    }
    upgrade.cost = calculateUpgradeCost(upgrade);
}

function purchaseSingleUpgrade(state, upgrade) {
    if (!state || !upgrade) {
        return false;
    }
    const amount = calculateUpgradeAmount(state, upgrade);
    if (amount <= 0) {
        return false;
    }
    const cost = calculateUpgradeCost(upgrade);
    if (!Number.isFinite(cost) || cost <= 0) {
        return false;
    }
    const spendCurrency = upgrade.type === UPGRADE_TYPES.UNIQUE ? spendStatus : spendChips;
    if (!spendCurrency(cost)) {
        return false;
    }
    applyUpgrade(state, upgrade);
    return true;
}

function purchaseUpgradeToMax(state, upgrade) {
    if (!state || !upgrade) {
        return false;
    }
    // prevent re-renders during purchase loop to avoid lag and missed clicks
    state.isPurchasingUpgrades = true;
    let purchasedAny = false;
    try {
        while (true) {
            const amount = calculateUpgradeAmount(state, upgrade);
            if (amount <= 0) {
                break;
            }
            const cost = calculateUpgradeCost(upgrade);
            if (!Number.isFinite(cost) || cost <= 0) {
                break;
            }
            const hasCurrency =
                upgrade.type === UPGRADE_TYPES.UNIQUE ? canAffordStatus(cost) : canAffordChips(cost);
            if (!hasCurrency) {
                break;
            }
            const spendCurrency = upgrade.type === UPGRADE_TYPES.UNIQUE ? spendStatus : spendChips;
            if (!spendCurrency(cost)) {
                break;
            }
            applyUpgrade(state, upgrade);
            purchasedAny = true;
            if (upgrade.type === UPGRADE_TYPES.UNIQUE) {
                break;
            }
        }
    } finally {
        state.isPurchasingUpgrades = false;
    }
    return purchasedAny;
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
    const action = button.dataset.action ?? "buy";
    let purchased = false;
    if (action === "buy-max") {
        purchased = purchaseUpgradeToMax(state, upgrade);
    } else {
        purchased = purchaseSingleUpgrade(state, upgrade);
    }
    if (purchased) {
        renderUpgrades(state);
    }
}

export function setupDeckUpgrades(state) {
    if (!state?.dom?.upgradeList || !state.dom.upgradeSlots || !state.dom.upgradeUniqueList) {
        return;
    }
    const existingPoolState = state.upgradePools ?? null;
    const {
        upgrades: deckUpgrades,
        baseChipsAmount,
        baseMultiplierAmount,
        baseDrawTime,
        baseHandSize,
        autoDrawBurnCardCost,
        cardShopValueMultiplier,
        poolState
    } = buildDeckUpgradeList(state.config, existingPoolState);

    if (Number.isFinite(baseChipsAmount)) {
        state.baseChipReward = baseChipsAmount;
    }
    if (Number.isFinite(baseMultiplierAmount) && baseMultiplierAmount > 0) {
        state.chipStreakMultiplier = baseMultiplierAmount;
    }
    if (Number.isFinite(baseDrawTime) && baseDrawTime > 0) {
        state.animationDuration = baseDrawTime;
    }
    if (Number.isFinite(baseHandSize) && baseHandSize > 0) {
        state.handSize = baseHandSize;
    }
    if (Number.isFinite(autoDrawBurnCardCost) && autoDrawBurnCardCost >= 0) {
        state.autoDrawBurnCardCost = Math.ceil(autoDrawBurnCardCost);
        if (typeof state.updateAutoButton === "function") {
            state.updateAutoButton();
        }
    }
    if (Number.isFinite(cardShopValueMultiplier) && cardShopValueMultiplier > 0) {
        state.cardShopValueMultiplier = cardShopValueMultiplier;
    }

    state.upgradePools = poolState ?? {};

    state.upgrades = deckUpgrades.map((upgrade) => ({
        ...upgrade,
        cost: calculateUpgradeCost(upgrade),
        getCurrentValue: upgradeRegistry.get(upgrade.id)?.getCurrentValue
    }));

    state.uniqueUpgradeRerollCost = DEFAULT_UNIQUE_REROLL_COST;
    state.isRerollingUniqueUpgrades = false;
    resetUniqueUpgradeSlots(state);
    fillUniqueUpgradeSlots(state);

    if (!Array.isArray(state.purchasedUpgradeOrder)) {
        state.purchasedUpgradeOrder = [];
    }
    const purchaseOrderSet = new Set(state.purchasedUpgradeOrder);
    state.upgrades.forEach((upgrade) => {
        if (!upgrade || !Number.isFinite(upgrade.level) || upgrade.level <= 0) {
            return;
        }
        if (!purchaseOrderSet.has(upgrade.id)) {
            state.purchasedUpgradeOrder.push(upgrade.id);
            purchaseOrderSet.add(upgrade.id);
        }
    });

    if (!Number.isFinite(state.unlockedUpgradeSlots) || state.unlockedUpgradeSlots < 0) {
        state.unlockedUpgradeSlots = DEFAULT_UNLOCKED_UPGRADE_SLOTS;
    }

    if (typeof state.unsubscribeChipListener === "function") {
        state.unsubscribeChipListener();
    }
    if (typeof state.unsubscribeDiceListener === "function") {
        state.unsubscribeDiceListener();
    }
    if (typeof state.unsubscribeStatusListener === "function") {
        state.unsubscribeStatusListener();
    }

    state.renderUpgrades = () => renderUpgrades(state);
    state.renderUpgradeSlots = () => renderUpgradeSlots(state);
    state.unsubscribeChipListener = subscribeToChipChanges(() => {
        // skip re-rendering during purchase operations to prevent lag and missed clicks
        if (state.isPurchasingUpgrades) {
            return;
        }
        renderUpgrades(state);
    });
    state.unsubscribeDiceListener = subscribeToDiceChanges(() => {
        if (state.isPurchasingUpgrades || state.isRerollingUniqueUpgrades) {
            return;
        }
        renderUpgrades(state);
    });
    state.unsubscribeStatusListener = subscribeToStatusChanges(() => {
        if (state.isPurchasingUpgrades) {
            return;
        }
        renderUpgrades(state);
    });

    const upgradeClickTarget = state.dom.upgradeColumn ?? state.dom.upgradeList;
    if (upgradeClickTarget && !upgradeClickTarget.dataset.listenerAttached) {
        upgradeClickTarget.dataset.listenerAttached = "true";
        upgradeClickTarget.addEventListener("click", (event) => handleUpgradeClick(state, event));
    }

    if (
        state.dom.upgradeUniqueRerollButton &&
        !state.dom.upgradeUniqueRerollButton.dataset.listenerAttached
    ) {
        state.dom.upgradeUniqueRerollButton.dataset.listenerAttached = "true";
        state.dom.upgradeUniqueRerollButton.addEventListener("click", () => {
            rerollUniqueUpgrades(state);
        });
    }

    state.renderUpgrades();
}

export function getBasicUpgradeIds() {
    return [...BASIC_UPGRADE_IDS];
}
