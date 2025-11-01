import {
    DEFAULT_BASE_CHIP_PAYOUT,
    DEFAULT_STREAK_CHIP_MULTIPLIER
} from "./config.js";
import { canAffordChips, formatChipAmount, spendChips, subscribeToChipChanges } from "./chips.js";
import { DECK_UPGRADE_CONFIG } from "./upgrade-config.js";

export const UPGRADE_TYPES = {
    BASIC: "basic",
    UNIQUE: "unique"
};

const BASIC_UPGRADE_IDS = ["increase_payout", "increase_streak_multiplier", "decrease_draw_time"];
const DEFAULT_UNLOCKED_UPGRADE_SLOTS = 6;
const MAX_UPGRADE_SLOT_COUNT = 7;

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

        const uniquePools = deckConfig.uniquePools;
        const poolConfigs = Array.isArray(uniquePools)
            ? uniquePools
            : uniquePools && typeof uniquePools === "object"
              ? Object.values(uniquePools)
              : [];

        poolConfigs.forEach((poolConfig) => {
            const entries = extractPoolEntriesFromConfig(poolConfig);
            entries.forEach((entry) => {
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

    if (Number.isFinite(increaseAmountValue)) {
        instance.increaseAmount = increaseAmountValue;
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

function extractPoolEntriesFromConfig(poolConfig) {
    if (!poolConfig || typeof poolConfig !== "object") {
        return [];
    }
    if (Array.isArray(poolConfig.entries)) {
        return poolConfig.entries;
    }
    if (Array.isArray(poolConfig.upgrades)) {
        return poolConfig.upgrades;
    }
    return [];
}

function cloneUpgradePoolEntries(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return entry;
            }
            const clone = { ...entry };
            if (entry.options && typeof entry.options === "object") {
                clone.options = { ...entry.options };
            }
            if (entry.definition && typeof entry.definition === "object") {
                clone.definition = { ...entry.definition };
            }
            return clone;
        })
        .filter((entry) => entry !== undefined);
}

function cloneUpgradePoolConfig(entry) {
    if (!entry || typeof entry !== "object") {
        return null;
    }
    const clone = { ...entry };
    clone.entries = cloneUpgradePoolEntries(extractPoolEntriesFromConfig(entry));
    delete clone.upgrades;
    if (entry.replaceEntries != null) {
        clone.replaceEntries = entry.replaceEntries;
    }
    return clone;
}

function mergeUpgradePoolConfig(baseEntry, overrideEntry) {
    if (!baseEntry && !overrideEntry) {
        return null;
    }
    if (overrideEntry && overrideEntry.enabled === false) {
        return { enabled: false };
    }
    if (!baseEntry) {
        return cloneUpgradePoolConfig(overrideEntry);
    }
    if (!overrideEntry) {
        return cloneUpgradePoolConfig(baseEntry);
    }

    const merged = cloneUpgradePoolConfig(baseEntry) ?? {};
    const overrideClone = cloneUpgradePoolConfig(overrideEntry) ?? {};

    const overrideEntries = Array.isArray(overrideClone.entries) ? overrideClone.entries : [];
    if (overrideEntries.length > 0 || overrideClone.replaceEntries === true) {
        const baseEntries = Array.isArray(merged.entries) ? merged.entries : [];
        merged.entries =
            overrideClone.replaceEntries === true
                ? cloneUpgradePoolEntries(overrideEntries)
                : [...baseEntries, ...cloneUpgradePoolEntries(overrideEntries)];
    }

    Object.entries(overrideClone).forEach(([key, value]) => {
        if (key === "entries" || key === "replaceEntries") {
            return;
        }
        if (value === undefined) {
            return;
        }
        merged[key] = value;
    });

    return merged;
}

function getPoolEntriesFromConfig(source) {
    if (!source) {
        return [];
    }
    if (Array.isArray(source)) {
        return source
            .map((entry) => {
                if (!entry) {
                    return null;
                }
                if (typeof entry === "string") {
                    return { id: entry };
                }
                if (typeof entry !== "object") {
                    return null;
                }
                if (!entry.id) {
                    return null;
                }
                const clone = cloneUpgradePoolConfig(entry) ?? { ...entry };
                clone.id = entry.id;
                return clone;
            })
            .filter(Boolean);
    }
    if (typeof source === "object") {
        return Object.entries(source)
            .map(([id, config]) => {
                if (config === undefined) {
                    return null;
                }
                if (config === false) {
                    return { id, enabled: false };
                }
                if (typeof config === "string") {
                    return { id: config };
                }
                if (!config) {
                    return null;
                }
                if (typeof config !== "object") {
                    return null;
                }
                const clone = cloneUpgradePoolConfig(config) ?? { ...config };
                clone.id = clone.id ?? id;
                return clone;
            })
            .filter((entry) => entry && entry.id);
    }
    return [];
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

    const defaultUniquePools = getPoolEntriesFromConfig(defaults.uniquePools);
    const deckUniquePools = getPoolEntriesFromConfig(deckProfile.uniquePools);

    const poolOrder = [];
    const poolMap = new Map();

    const addPoolEntry = (entry) => {
        if (!entry || !entry.id) {
            return;
        }
        const existing = poolMap.get(entry.id);
        const merged = mergeUpgradePoolConfig(existing, entry);
        poolMap.set(entry.id, merged);
        if (!existing) {
            poolOrder.push(entry.id);
        }
    };

    defaultUniquePools.forEach(addPoolEntry);
    deckUniquePools.forEach(addPoolEntry);

    const combinedPools = poolOrder
        .map((id) => {
            const config = poolMap.get(id);
            if (!config || config.enabled === false) {
                return null;
            }
            const normalized = cloneUpgradePoolConfig(config) ?? {};
            normalized.id = id;
            if (normalized.replaceEntries !== undefined) {
                delete normalized.replaceEntries;
            }
            return normalized;
        })
        .filter((pool) => pool && Array.isArray(pool.entries) && pool.entries.length > 0);

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

    return {
        basic: combinedBasics,
        unique: [...defaultUnique, ...deckUnique],
        uniquePools: combinedPools,
        baseChipsAmount,
        baseMultiplierAmount,
        baseDrawTime
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

    const entry = {
        id,
        cost,
        baseCost,
        costGrowthRate,
        costLinearCoefficient,
        options
    };

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

    return entry;
}

function ensurePoolStateContainer(state) {
    if (!state) {
        return null;
    }
    if (!state.upgradePoolState || typeof state.upgradePoolState !== "object") {
        state.upgradePoolState = {};
    }
    return state.upgradePoolState;
}

function getNormalizedPoolEntries(pool) {
    if (!pool || typeof pool !== "object") {
        return [];
    }
    const entries = Array.isArray(pool.entries) ? pool.entries : [];
    return entries
        .map((entry) => {
            if (!entry) {
                return null;
            }
            if (typeof entry === "string") {
                return normalizeUpgradeEntry(entry, entry);
            }
            const entryId = entry.id ?? null;
            if (!entryId) {
                return null;
            }
            return normalizeUpgradeEntry(entryId, entry);
        })
        .filter(Boolean);
}

function selectRandomPoolEntries(entries, count) {
    if (!Array.isArray(entries) || entries.length === 0 || count <= 0) {
        return [];
    }
    const clonedEntries = entries
        .map((entry) => cloneUpgradeConfig(entry))
        .filter(Boolean);
    if (count >= clonedEntries.length) {
        return clonedEntries;
    }
    const pool = [...clonedEntries];
    for (let index = pool.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        const temp = pool[index];
        pool[index] = pool[randomIndex];
        pool[randomIndex] = temp;
    }
    return pool.slice(0, Math.min(count, pool.length));
}

function shouldRefreshPoolSelection(stored, normalizedEntries, drawCount, refreshMode, refreshToken) {
    if (!stored) {
        return true;
    }
    if (refreshMode === "always") {
        return true;
    }
    if ((stored.refreshToken ?? null) !== (refreshToken ?? null)) {
        return true;
    }
    if ((stored.drawCount ?? null) !== drawCount) {
        return true;
    }
    const storedSelection = Array.isArray(stored.selection) ? stored.selection : [];
    if (storedSelection.length !== drawCount) {
        return true;
    }
    const normalizedById = new Map(normalizedEntries.map((entry) => [entry.id, entry]));
    for (let index = 0; index < storedSelection.length; index += 1) {
        const entry = storedSelection[index];
        if (!entry?.id || !normalizedById.has(entry.id)) {
            return true;
        }
    }
    return false;
}

function rehydrateStoredSelection(storedSelection, normalizedEntries) {
    if (!Array.isArray(storedSelection)) {
        return [];
    }
    const normalizedById = new Map(normalizedEntries.map((entry) => [entry.id, entry]));
    const result = [];
    storedSelection.forEach((entry) => {
        if (!entry?.id) {
            return;
        }
        const normalized = normalizedById.get(entry.id);
        if (!normalized) {
            return;
        }
        result.push(cloneUpgradeConfig(normalized) ?? normalized);
    });
    return result;
}

function resolveUpgradePoolUpgrades(state, pools) {
    if (!Array.isArray(pools) || pools.length === 0) {
        return [];
    }

    const upgrades = [];
    const poolState = ensurePoolStateContainer(state);

    pools.forEach((pool) => {
        if (!pool) {
            return;
        }
        const normalizedEntries = getNormalizedPoolEntries(pool);
        if (normalizedEntries.length === 0) {
            if (pool.id && poolState) {
                delete poolState[pool.id];
            }
            return;
        }

        const requestedDrawCount = Number.isFinite(pool.drawCount)
            ? Math.max(Math.floor(pool.drawCount), 0)
            : normalizedEntries.length;
        const resolvedDrawCount = Math.min(requestedDrawCount, normalizedEntries.length);
        if (resolvedDrawCount <= 0) {
            if (pool.id && poolState) {
                const refreshMode = typeof pool.refreshMode === "string" ? pool.refreshMode : "session";
                poolState[pool.id] = {
                    selection: [],
                    drawCount: resolvedDrawCount,
                    refreshMode,
                    refreshToken: pool.refreshToken ?? null
                };
            }
            return;
        }

        const poolId = pool.id ?? null;
        const stored = poolId && poolState ? poolState[poolId] : null;
        const refreshMode = typeof pool.refreshMode === "string"
            ? pool.refreshMode
            : stored?.refreshMode ?? "session";
        const refreshToken = pool.refreshToken ?? stored?.refreshToken ?? null;

        let selectedEntries;
        if (!poolId || !poolState) {
            selectedEntries = selectRandomPoolEntries(normalizedEntries, resolvedDrawCount);
        } else {
            const needsRefresh = shouldRefreshPoolSelection(
                stored,
                normalizedEntries,
                resolvedDrawCount,
                refreshMode,
                refreshToken
            );
            if (needsRefresh) {
                selectedEntries = selectRandomPoolEntries(normalizedEntries, resolvedDrawCount);
            } else {
                selectedEntries = rehydrateStoredSelection(stored.selection, normalizedEntries);
                if (selectedEntries.length !== resolvedDrawCount) {
                    selectedEntries = selectRandomPoolEntries(normalizedEntries, resolvedDrawCount);
                }
            }

            poolState[poolId] = {
                selection: selectedEntries
                    .map((entry) => cloneUpgradeConfig(entry))
                    .filter(Boolean),
                drawCount: resolvedDrawCount,
                refreshMode,
                refreshToken
            };
        }

        selectedEntries.forEach((entry) => {
            const instance = createUpgradeInstance(entry);
            if (instance) {
                upgrades.push(instance);
            }
        });
    });

    return upgrades;
}

function buildDeckUpgradeList(config, state) {
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

    const uniqueUpgrades = profile.unique
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

    const poolUpgrades = resolveUpgradePoolUpgrades(state, profile.uniquePools);

    if (state && state.upgradePoolState && typeof state.upgradePoolState === "object") {
        const activePoolIds = new Set((profile.uniquePools ?? []).map((pool) => pool.id));
        Object.keys(state.upgradePoolState).forEach((poolId) => {
            if (!activePoolIds.has(poolId)) {
                delete state.upgradePoolState[poolId];
            }
        });
    }

    return {
        upgrades: [...basics, ...uniqueUpgrades, ...poolUpgrades],
        baseChipsAmount: profile.baseChipsAmount,
        baseMultiplierAmount: profile.baseMultiplierAmount,
        baseDrawTime: profile.baseDrawTime
    };
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

    const ordered = order
        .map((id) => byId.get(id))
        .filter((upgrade) => upgrade && Number.isFinite(upgrade.level) && upgrade.level > 0);

    state.upgrades.forEach((upgrade) => {
        if (!upgrade || !Number.isFinite(upgrade.level) || upgrade.level <= 0) {
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
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < MAX_UPGRADE_SLOT_COUNT; index += 1) {
        const slot = document.createElement("div");
        slot.className = "upgrade-slot";
        slot.setAttribute("role", "listitem");

        if (index >= unlockedSlots) {
            slot.classList.add("locked");
            slot.setAttribute("aria-label", "locked upgrade slot");
            const label = document.createElement("span");
            label.className = "upgrade-slot-title";
            label.textContent = "locked";
            slot.append(label);
            fragment.append(slot);
            continue;
        }

        const upgrade = purchasedUpgrades[index];
        if (!upgrade) {
            slot.classList.add("empty");
            slot.setAttribute("aria-label", "empty upgrade slot");
            fragment.append(slot);
            continue;
        }

        const primaryText =
            typeof upgrade.getCurrentValue === "function"
                ? upgrade.getCurrentValue(state)
                : upgrade.title ?? upgrade.id;

        const title = document.createElement("span");
        title.className = "upgrade-slot-title";
        title.textContent = primaryText;
        slot.append(title);

        const level = Number.isFinite(upgrade.level) ? Math.max(0, upgrade.level) : 0;
        const detailText = level > 0 ? `lv ${level}` : "";
        if (detailText) {
            const detail = document.createElement("span");
            detail.className = "upgrade-slot-detail";
            detail.textContent = detailText;
            slot.append(detail);
        }

        const ariaParts = [primaryText.trim()];
        if (detailText) {
            ariaParts.push(detailText);
        }
        slot.setAttribute("aria-label", ariaParts.join(", "));

        fragment.append(slot);
    }

    container.replaceChildren(fragment);
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
        renderUpgradeSlots(state);
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
        const isMaxed = amount <= 0 || cost <= 0 || !Number.isFinite(cost);
        const insufficientFunds = !isMaxed && !canAffordChips(cost);
        const shouldDisable = isMaxed || insufficientFunds;

        button.disabled = shouldDisable;
        button.textContent = isMaxed ? "maxed" : formatChipAmount(cost);

        upgrade.cost = isMaxed ? 0 : cost;

        const formattedCost = Number.isFinite(cost) ? formatChipAmount(cost) : "";
        const upgradeLabel = upgrade.title ?? upgrade.id;
        if (isMaxed) {
            button.setAttribute("aria-label", `upgrade ${upgradeLabel} maxed`);
        } else if (insufficientFunds) {
            button.setAttribute("aria-label", `upgrade ${upgradeLabel} for ${formattedCost} (not enough chips)`);
        } else {
            button.setAttribute("aria-label", `upgrade ${upgradeLabel} for ${formattedCost}`);
        }

        if (Number.isFinite(cost)) {
            button.dataset.cost = `${cost}`;
        } else {
            delete button.dataset.cost;
        }
        button.dataset.amount = `${amount}`;

        body.append(button);

        card.append(stat, body);
        fragment.append(card);
    });

    list.replaceChildren(fragment);
    renderUpgradeSlots(state);
}

function applyUpgrade(state, upgrade) {
    if (!state || !upgrade || typeof upgrade.applyEffect !== "function") {
        return;
    }
    const amount = calculateUpgradeAmount(state, upgrade);
    if (amount <= 0) {
        return;
    }
    const previousLevel = Number.isFinite(upgrade.level) ? upgrade.level : 0;
    upgrade.computedAmount = amount;
    upgrade.applyEffect(state, upgrade);
    delete upgrade.computedAmount;
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
    const cost = Number(button.dataset.cost ?? upgrade.cost ?? 0);
    if (!spendChips(cost)) {
        return;
    }
    applyUpgrade(state, upgrade);
    renderUpgrades(state);
}

export function setupDeckUpgrades(state) {
    if (!state?.dom?.upgradeList || !state.dom.upgradeSlots) {
        return;
    }
    if (!state.upgradePoolState || typeof state.upgradePoolState !== "object") {
        state.upgradePoolState = {};
    }
    const {
        upgrades: deckUpgrades,
        baseChipsAmount,
        baseMultiplierAmount,
        baseDrawTime
    } = buildDeckUpgradeList(state.config, state);

    if (Number.isFinite(baseChipsAmount)) {
        state.baseChipReward = baseChipsAmount;
    }
    if (Number.isFinite(baseMultiplierAmount) && baseMultiplierAmount > 0) {
        state.chipStreakMultiplier = baseMultiplierAmount;
    }
    if (Number.isFinite(baseDrawTime) && baseDrawTime > 0) {
        state.animationDuration = baseDrawTime;
    }

    state.upgrades = deckUpgrades.map((upgrade) => ({
        ...upgrade,
        cost: calculateUpgradeCost(upgrade),
        getCurrentValue: upgradeRegistry.get(upgrade.id)?.getCurrentValue
    }));

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

    state.renderUpgrades = () => renderUpgrades(state);
    state.renderUpgradeSlots = () => renderUpgradeSlots(state);
    state.unsubscribeChipListener = subscribeToChipChanges(() => renderUpgrades(state));

    if (!state.dom.upgradeList.dataset.listenerAttached) {
        state.dom.upgradeList.dataset.listenerAttached = "true";
        state.dom.upgradeList.addEventListener("click", (event) => handleUpgradeClick(state, event));
    }

    state.renderUpgrades();
}

export function getBasicUpgradeIds() {
    return [...BASIC_UPGRADE_IDS];
}
