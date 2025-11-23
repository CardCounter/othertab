const canvas = document.getElementById('asteroid-canvas');
const ctx = canvas.getContext('2d');
const resetButton = document.getElementById('reset-button');
const scoreDisplay = document.getElementById('score-display');
const oreDisplay = document.getElementById('ore-display');
const oreConverter = document.getElementById('ore-converter');
const radiusUpgradeSquare = document.getElementById('radius-upgrade');
const strengthUpgradeSquare = document.getElementById('strength-upgrade');
const numUpgradeSquare = document.getElementById('num-upgrade');
const zoneElements = {
    ore: oreConverter,
    radius: radiusUpgradeSquare,
    strength: strengthUpgradeSquare,
    num: numUpgradeSquare,
};
const shareButton = document.getElementById('share-button');
const shareScoreMessage = document.getElementById('share-score');
const ASTEROID_SHARE_URL = 'https://othertab.com/asteroid/';
let shareButtonResetTimeout = null;
let currentWinShareText = '';

const SPAWN_INTERVAL = { min: 3000, max: 6000 };
const ASTEROID_SPIN = { min: -2.2, max: 2.2 }; // radians per second
const OUT_OF_BOUNDS_MARGIN = 160;
const ASTEROID_LINE_WIDTH = 3;
const POINTER_RING_RADIUS = 50;
const LASER_SPEED = 1000; // px per second
const MINING_DAMAGE_PER_SECOND = 100; // health per second
const MINING_LASER_LINE_WIDTH = 2;
const POINTER_RING_LINE_WIDTH = 1.5;
const SPLIT_COUNT = 2;
const SPLIT_DIRECTION_VARIANCE = Math.PI / 6;
const POINTER_COLLECTION_PADDING = 6;
const ORE_CONVERSION_RATE = 1; // ore per second converted to points
const UPGRADE_HOLD_DURATION = 1; // seconds to stay in zone before purchase
const STRENGTH_INCREMENT = 50;
const RADIUS_INCREMENT = 10;
const LASER_COUNT_BASE = 1;
const ORE_RATIO_UPDATE_INTERVAL = 10000;
const DIFFICULTY_RAMP_PER_MINUTE = 0.25;

const UPGRADE_CONFIG = {
    num: { increment: 1 },
    strength: { increment: STRENGTH_INCREMENT },
    radius: { increment: RADIUS_INCREMENT },
};
const ZONE_PULSE_CLASS = 'square-pulse';

const ASTEROID_TIERS = [
    {
        name: 'triangle',
        sides: 3,
        size: { min: 14, max: 24 },
        speed: { min: 220, max: 360 },
        health: { min: 100, max: 250 },
    },
    {
        name: 'square',
        sides: 4,
        size: { min: 20, max: 34 },
        speed: { min: 180, max: 320 },
        health: { min: 150, max: 300 },
    },
    {
        name: 'pentagon',
        sides: 5,
        size: { min: 26, max: 44 },
        speed: { min: 150, max: 280 },
        health: { min: 250, max: 400 },
    },
    {
        name: 'hexagon',
        sides: 6,
        size: { min: 30, max: 56 },
        speed: { min: 130, max: 240 },
        health: { min: 350, max: 500 },
    },
    {
        name: 'heptagon',
        sides: 7,
        size: { min: 34, max: 72 },
        speed: { min: 110, max: 210 },
        health: { min: 350, max: 500 },
    },
    {
        name: 'octagon',
        sides: 8,
        size: { min: 40, max: 90 },
        speed: { min: 90, max: 180 },
        health: { min: 400, max: 600 },
    },
];

const TIER_SPAWN_WEIGHTS = ASTEROID_TIERS.map((_, idx) => Math.pow(idx + 1, 2));
const TOTAL_TIER_WEIGHT = TIER_SPAWN_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const MAX_TIER_INDEX = ASTEROID_TIERS.length - 1;
const COLLECTIBLE_SPEED = { min: 80, max: 150 };
const COLLECTIBLE_SIZE = { min: 6, max: 11 };

const state = {
    asteroids: [],
    collectibles: [],
    pointer: {
        x: 0,
        y: 0,
        active: false,
        locked: false,
    },
    frozen: false,
    finishReason: null,
    nextSpawnAt: performance.now() + randRange(SPAWN_INTERVAL.min, SPAWN_INTERVAL.max),
    mining: {
        targets: new Map(),
    },
    points: 0,
    ore: 0,
    oreRatio: 1,
    lastOreRatioUpdate: 0,
    gameStartTime: performance.now(),
    oreConversionActive: false,
    oreConversionProgress: 0,
    upgrades: {
        num: LASER_COUNT_BASE,
        strength: 0,
        radius: 0,
    },
    upgradeLevels: {
        num: 1,
        strength: 1,
        radius: 1,
    },
    zoneInteractions: {
        ore: { hovered: false, progress: 0 },
        radius: { hovered: false, progress: 0 },
        strength: { hovered: false, progress: 0 },
        num: { hovered: false, progress: 0 },
    },
};

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;
let lastFrame = performance.now();
let asteroidIdCounter = 0;
let collectibleIdCounter = 0;

function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getLaserCount() {
    const config = UPGRADE_CONFIG.num || {};
    const cap = typeof config.maxValue === 'number' ? config.maxValue : Infinity;
    return Math.min(cap, state.upgrades.num);
}

function getMiningDamage() {
    return MINING_DAMAGE_PER_SECOND + state.upgrades.strength;
}

function getPointerRadius() {
    return POINTER_RING_RADIUS + state.upgrades.radius;
}

function chooseSpawnTierIndex() {
    let roll = Math.random() * TOTAL_TIER_WEIGHT;
    for (let i = 0; i < TIER_SPAWN_WEIGHTS.length; i++) {
        roll -= TIER_SPAWN_WEIGHTS[i];
        if (roll <= 0) {
            return i;
        }
    }
    return MAX_TIER_INDEX;
}

function wrapEntity(entity, radius) {
    if (entity.x < -radius) {
        entity.x = width + radius;
    } else if (entity.x > width + radius) {
        entity.x = -radius;
    }

    if (entity.y < -radius) {
        entity.y = height + radius;
    } else if (entity.y > height + radius) {
        entity.y = -radius;
    }
}

function applyLineWidth(widthValue) {
    document.documentElement.style.setProperty('--asteroid-line-width', widthValue);
}

function clearMiningState() {
    state.mining.targets.clear();
}

function deactivateOreConverter() {
    state.oreConversionActive = false;
    state.oreConversionProgress = 0;
    if (oreConverter) {
        oreConverter.classList.remove('active');
    }
}

function triggerZonePulse(zoneKey) {
    const element = zoneElements[zoneKey];
    if (!element) return;
    element.classList.remove(ZONE_PULSE_CLASS);
    // Force reflow so the animation can restart consistently.
    void element.offsetWidth;
    element.classList.add(ZONE_PULSE_CLASS);
}

function attachPulseReset(element) {
    if (!element) return;
    element.addEventListener('animationend', (event) => {
        if (event.animationName === 'square-pulse') {
            element.classList.remove(ZONE_PULSE_CLASS);
        }
    });
}

function setZoneHover(zoneKey, hovered) {
    const zoneState = state.zoneInteractions[zoneKey];
    if (!zoneState) return;
    zoneState.hovered = hovered;
    if (!hovered) {
        zoneState.progress = 0;
    }
}

function stopAllZoneInteractions() {
    Object.values(state.zoneInteractions).forEach((zone) => {
        zone.hovered = false;
        zone.progress = 0;
    });
}

function getUpgradeCost(zoneKey) {
    return state.upgradeLevels[zoneKey] || 1;
}

function hasReachedUpgradeLimit(zoneKey, config) {
    if (!config || typeof config.maxValue !== 'number') {
        return false;
    }
    if (zoneKey === 'num') {
        return getLaserCount() >= config.maxValue;
    }
    return state.upgrades[zoneKey] >= config.maxValue;
}

function applyUpgrade(zoneKey) {
    const config = UPGRADE_CONFIG[zoneKey];
    if (!config) return false;
    
    const cost = getUpgradeCost(zoneKey);
    if (state.points < cost) return false;
    if (hasReachedUpgradeLimit(zoneKey, config)) return false;

    state.points -= cost;
    state.upgradeLevels[zoneKey] = (state.upgradeLevels[zoneKey] || 0) + 1;

    switch (zoneKey) {
        case 'num':
            state.upgrades.num = Math.min(
                state.upgrades.num + config.increment,
                typeof config.maxValue === 'number' ? config.maxValue : state.upgrades.num + config.increment
            );
            break;
        case 'strength':
            state.upgrades.strength += config.increment;
            break;
        case 'radius':
            state.upgrades.radius += config.increment;
            break;
        default:
            break;
    }
    updateResourceDisplays();
    triggerZonePulse(zoneKey);
    return true;
}

function handleUpgradeZones(delta) {
    for (const [zoneKey, zoneState] of Object.entries(state.zoneInteractions)) {
        if (!zoneState.hovered || state.frozen) {
            zoneState.progress = 0;
            continue;
        }
        zoneState.progress += delta;
        if (zoneState.progress < UPGRADE_HOLD_DURATION) {
            continue;
        }
        zoneState.progress = 0;
        if (zoneKey === 'ore') {
            activateOreConversion();
            continue;
        }
        const config = UPGRADE_CONFIG[zoneKey];
        const cost = getUpgradeCost(zoneKey);

        if (!config || state.points < cost) {
            continue;
        }
        if (hasReachedUpgradeLimit(zoneKey, config)) {
            continue;
        }
        applyUpgrade(zoneKey);
    }
}

function purgeInvalidMiningTargets() {
    const ids = Array.from(state.mining.targets.keys());
    for (const id of ids) {
        const stillExists = state.asteroids.some(
            (asteroid) => !asteroid.destroyed && asteroid.id === id
        );
        if (!stillExists) {
            state.mining.targets.delete(id);
        }
    }
}

function updateResourceDisplays() {
    if (scoreDisplay) {
        scoreDisplay.textContent = `§${state.points}`;
    }
    if (oreDisplay) {
        oreDisplay.textContent = `ore: ${state.ore}`;
    }
    
    // Update upgrade zones
    if (strengthUpgradeSquare) {
        const cost = getUpgradeCost('strength');
        const val = MINING_DAMAGE_PER_SECOND + state.upgrades.strength;
        strengthUpgradeSquare.innerHTML = `<span class="square-label">strength: ${val}<br>§${cost}</span>`;
    }
    if (radiusUpgradeSquare) {
        const cost = getUpgradeCost('radius');
        const val = POINTER_RING_RADIUS + state.upgrades.radius;
        radiusUpgradeSquare.innerHTML = `<span class="square-label">radius: ${val}<br>§${cost}</span>`;
    }
    if (numUpgradeSquare) {
        const cost = getUpgradeCost('num');
        const val = state.upgrades.num;
        numUpgradeSquare.innerHTML = `<span class="square-label">lasers: ${val}<br>§${cost}</span>`;
    }
    // Update ore converter with ratio
    if (oreConverter) {
        oreConverter.innerHTML = `<span class="square-label">ore<br>1 : ${state.oreRatio}</span>`;
    }
}

function getPointsLabel() {
    return '§';
}

function updateShareScoreDisplay(visible) {
    if (!shareScoreMessage) {
        return;
    }
    if (visible) {
        shareScoreMessage.textContent = `${getPointsLabel()}${state.points}`;
        shareScoreMessage.classList.remove('hidden');
    } else {
        shareScoreMessage.textContent = '';
        shareScoreMessage.classList.add('hidden');
    }
}

function getWinShareText() {
    const label = getPointsLabel();
    return `ASTEROID\n${label}${state.points}\n${ASTEROID_SHARE_URL}`;
}

function showWinShareButton() {
    if (!shareButton) {
        return;
    }
    currentWinShareText = getWinShareText();
    if (shareButtonResetTimeout) {
        clearTimeout(shareButtonResetTimeout);
        shareButtonResetTimeout = null;
    }
    shareButton.textContent = 'share';
    shareButton.classList.remove('hidden');
    updateShareScoreDisplay(true);
}

function hideWinShareButton() {
    if (!shareButton) {
        return;
    }
    if (shareButtonResetTimeout) {
        clearTimeout(shareButtonResetTimeout);
        shareButtonResetTimeout = null;
    }
    shareButton.textContent = 'share';
    shareButton.classList.add('hidden');
    currentWinShareText = '';
    updateShareScoreDisplay(false);
}

function handleShareButtonClick() {
    if (!shareButton || !currentWinShareText) {
        return;
    }

    const finalizeCopyFeedback = () => {
        if (!shareButton) {
            return;
        }
        shareButton.textContent = 'copied';
        if (shareButtonResetTimeout) {
            clearTimeout(shareButtonResetTimeout);
        }
        shareButtonResetTimeout = setTimeout(() => {
            if (shareButton) {
                shareButton.textContent = 'share';
            }
            shareButtonResetTimeout = null;
        }, 1000);
    };

    const clipboard = navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
        clipboard.writeText(currentWinShareText).then(finalizeCopyFeedback, finalizeCopyFeedback);
    } else {
        finalizeCopyFeedback();
    }
}

function setMiningVisualsTransparent(hidden) {
    const root = document.documentElement;
    if (!root) return;

    if (hidden) {
        root.style.setProperty('--pointer-circle-color', 'transparent');
        root.style.setProperty('--pointer-laser-color', 'transparent');
        if (document.body) {
            document.body.style.setProperty('--pointer-circle-color', 'transparent');
            document.body.style.setProperty('--pointer-laser-color', 'transparent');
        }
    } else {
        root.style.removeProperty('--pointer-circle-color');
        root.style.removeProperty('--pointer-laser-color');
        if (document.body) {
            document.body.style.removeProperty('--pointer-circle-color');
            document.body.style.removeProperty('--pointer-laser-color');
        }
    }
}

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function computeEdgeSpawn(radius) {
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;
    let angle;

    switch (side) {
        case 0: // top
            x = randRange(-OUT_OF_BOUNDS_MARGIN, width + OUT_OF_BOUNDS_MARGIN);
            y = -radius - 10;
            angle = randRange(Math.PI / 4, (3 * Math.PI) / 4);
            break;
        case 1: // right
            x = width + radius + 10;
            y = randRange(-OUT_OF_BOUNDS_MARGIN, height + OUT_OF_BOUNDS_MARGIN);
            angle = randRange((3 * Math.PI) / 4, (5 * Math.PI) / 4);
            break;
        case 2: // bottom
            x = randRange(-OUT_OF_BOUNDS_MARGIN, width + OUT_OF_BOUNDS_MARGIN);
            y = height + radius + 10;
            angle = randRange((5 * Math.PI) / 4, (7 * Math.PI) / 4);
            break;
        default: // left
            x = -radius - 10;
            y = randRange(-OUT_OF_BOUNDS_MARGIN, height + OUT_OF_BOUNDS_MARGIN);
            angle = randRange(-Math.PI / 4, Math.PI / 4);
            break;
    }

    return { x, y, angle };
}

function createAsteroidFromTier(tierIndex, options = {}) {
    const tier = ASTEROID_TIERS[tierIndex] || ASTEROID_TIERS[MAX_TIER_INDEX];
    const parentRadius = options.parentRadius;
    let radius = options.radius ?? randRange(tier.size.min, tier.size.max);
    if (parentRadius) {
        radius = Math.min(radius, parentRadius * 0.75);
    }
    radius = clamp(radius, tier.size.min, tier.size.max);

    let spawnData;
    if (options.position) {
        spawnData = {
            x: options.position.x,
            y: options.position.y,
            angle: options.angle,
        };
    } else {
        spawnData = computeEdgeSpawn(radius);
    }

    const difficultyMultiplier = 1 + ((performance.now() - state.gameStartTime) / 60000) * DIFFICULTY_RAMP_PER_MINUTE;

    let vx;
    let vy;
    if (options.velocity) {
        vx = options.velocity.vx;
        vy = options.velocity.vy;
    } else {
        const heading =
            typeof spawnData.angle === 'number'
                ? spawnData.angle
                : Math.random() * Math.PI * 2;
        const speedMin = tier.speed.min * difficultyMultiplier;
        const speedMax = tier.speed.max * difficultyMultiplier;
        const speed = options.speed ?? randRange(speedMin, speedMax);
        vx = Math.cos(heading) * speed;
        vy = Math.sin(heading) * speed;
    }

    const healthMin = tier.health.min * difficultyMultiplier;
    const healthMax = tier.health.max * difficultyMultiplier;
    const health = options.health ?? randRange(healthMin, healthMax);

    return {
        id: asteroidIdCounter++,
        tierIndex,
        tierName: tier.name,
        sides: tier.sides,
        x: spawnData.x,
        y: spawnData.y,
        radius,
        rotation: Math.random() * Math.PI * 2,
        spin: randRange(ASTEROID_SPIN.min, ASTEROID_SPIN.max),
        vx,
        vy,
        health,
        maxHealth: health,
        destroyed: false,
    };
}

function addAsteroidFromTier(tierIndex, options = {}) {
    const asteroid = createAsteroidFromTier(tierIndex, options);
    state.asteroids.push(asteroid);
    return asteroid;
}

function spawnAsteroid(now = performance.now()) {
    const tierIndex = chooseSpawnTierIndex();
    addAsteroidFromTier(tierIndex);
    state.nextSpawnAt = now + randRange(SPAWN_INTERVAL.min, SPAWN_INTERVAL.max);
}

function spawnCollectibles(asteroid) {
    const count = Math.max(2, Math.round(randRange(2, 4)));
    for (let i = 0; i < count; i++) {
        const radius = randRange(COLLECTIBLE_SIZE.min, COLLECTIBLE_SIZE.max);
        const speed = randRange(COLLECTIBLE_SPEED.min, COLLECTIBLE_SPEED.max);
        const angle = Math.random() * Math.PI * 2;
        state.collectibles.push({
            id: collectibleIdCounter++,
            x: asteroid.x,
            y: asteroid.y,
            radius,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            value: 1,
        });
    }
}

function breakAsteroid(asteroid) {
    if (asteroid.destroyed) return;
    asteroid.destroyed = true;
    const nextTierIndex = asteroid.tierIndex - 1;
    if (nextTierIndex >= 0) {
        const difficultyMultiplier = 1 + ((performance.now() - state.gameStartTime) / 60000) * DIFFICULTY_RAMP_PER_MINUTE;
        const tier = ASTEROID_TIERS[nextTierIndex];
        const speedMin = tier.speed.min * difficultyMultiplier;
        const speedMax = tier.speed.max * difficultyMultiplier;

        const parentSpeed = Math.hypot(asteroid.vx, asteroid.vy);
        const parentHasMomentum = parentSpeed > 0;
        const clampedParentSpeed = parentHasMomentum
            ? clamp(parentSpeed, speedMin, speedMax)
            : 0;
        const baseHeading = parentHasMomentum
            ? Math.atan2(asteroid.vy, asteroid.vx)
            : Math.random() * Math.PI * 2;

        for (let i = 0; i < SPLIT_COUNT; i++) {
            const heading =
                baseHeading + randRange(-SPLIT_DIRECTION_VARIANCE, SPLIT_DIRECTION_VARIANCE);
            const speed = parentHasMomentum
                ? clamp(
                      clampedParentSpeed * randRange(0.9, 1.1),
                      speedMin,
                      speedMax
                  )
                : randRange(speedMin, speedMax);
            const offsetAngle = Math.random() * Math.PI * 2;
            const offsetDistance = randRange(0, asteroid.radius * 0.4);
            addAsteroidFromTier(nextTierIndex, {
                position: {
                    x: asteroid.x + Math.cos(offsetAngle) * offsetDistance,
                    y: asteroid.y + Math.sin(offsetAngle) * offsetDistance,
                },
                velocity: {
                    vx: Math.cos(heading) * speed,
                    vy: Math.sin(heading) * speed,
                },
                parentRadius: asteroid.radius,
            });
        }
    } else {
        spawnCollectibles(asteroid);
    }
    if (state.mining.targets.has(asteroid.id)) {
        state.mining.targets.delete(asteroid.id);
    }
}

function updateAsteroids(delta) {
    for (const asteroid of state.asteroids) {
        if (asteroid.destroyed) {
            continue;
        }
        asteroid.x += asteroid.vx * delta;
        asteroid.y += asteroid.vy * delta;
        asteroid.rotation += asteroid.spin * delta;
        wrapEntity(asteroid, asteroid.radius);
    }
    purgeInvalidMiningTargets();
}

function updateCollectibles(delta) {
    if (!state.collectibles.length) return;
    for (const collectible of state.collectibles) {
        collectible.x += collectible.vx * delta;
        collectible.y += collectible.vy * delta;
        wrapEntity(collectible, collectible.radius);
    }
}

function detectCollisions() {
    if (!state.pointer.active || state.frozen) return;
    for (const asteroid of state.asteroids) {
        if (asteroid.destroyed) continue;
        const dx = state.pointer.x - asteroid.x;
        const dy = state.pointer.y - asteroid.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= asteroid.radius) {
            freezeField('asteroid impact');
            return;
        }
    }
}

function handleCollectiblePickup() {
    if (!state.pointer.active || state.frozen || !state.collectibles.length) return;
    const pointerRadius = getPointerRadius();
    const collectedIds = new Set();

    for (const collectible of state.collectibles) {
        const dx = state.pointer.x - collectible.x;
        const dy = state.pointer.y - collectible.y;
        const distance = Math.hypot(dx, dy);
        const threshold = pointerRadius + collectible.radius;
        if (distance <= threshold) {
            collectedIds.add(collectible.id);
            state.ore += collectible.value;
        }
    }

    if (collectedIds.size) {
        state.collectibles = state.collectibles.filter(
            (collectible) => !collectedIds.has(collectible.id)
        );
        updateResourceDisplays();
    }
}

function handleOreConversion(delta) {
    if (!state.oreConversionActive || state.ore <= 0) {
        state.oreConversionProgress = 0;
        return;
    }
    state.oreConversionProgress += ORE_CONVERSION_RATE * delta;
    const wholeUnits = Math.min(
        state.ore,
        Math.floor(state.oreConversionProgress)
    );
    if (wholeUnits > 0) {
        state.ore -= wholeUnits;
        state.points += wholeUnits * state.oreRatio;
        state.oreConversionProgress -= wholeUnits;
        updateResourceDisplays();
        triggerZonePulse('ore');
    }
}

function updateOreRatio(now) {
    if (now - state.lastOreRatioUpdate > ORE_RATIO_UPDATE_INTERVAL) {
        state.oreRatio = Math.floor(Math.random() * 6) + 1; // 1 to 6
        state.lastOreRatioUpdate = now;
        updateResourceDisplays();
    }
}

function activateOreConversion() {
    if (state.oreConversionActive) {
        return;
    }
    state.oreConversionActive = true;
    if (oreConverter) {
        oreConverter.classList.add('active');
    }
    state.oreConversionProgress = Math.max(state.oreConversionProgress, ORE_CONVERSION_RATE);
}

function handleMining(delta) {
    if (!state.pointer.active) {
        clearMiningState();
        return;
    }

    const pointerRadius = getPointerRadius();
    const candidates = [];

    for (const asteroid of state.asteroids) {
        if (asteroid.destroyed) continue;
        const dx = state.pointer.x - asteroid.x;
        const dy = state.pointer.y - asteroid.y;
        const distance = Math.hypot(dx, dy);
        const maxDistance = asteroid.radius + pointerRadius;
        if (distance <= maxDistance) {
            const overlap = maxDistance - distance;
            candidates.push({ asteroid, overlap });
        }
    }

    if (!candidates.length) {
        clearMiningState();
        return;
    }

    candidates.sort((a, b) => b.overlap - a.overlap);
    const maxTargets = getLaserCount();
    const selected = candidates.slice(0, maxTargets);
    const updatedTargets = new Map();

    for (const entry of selected) {
        const target = entry.asteroid;
        let record = state.mining.targets.get(target.id);
        if (!record) {
            record = { beamLength: 0 };
        }

        const dx = target.x - state.pointer.x;
        const dy = target.y - state.pointer.y;
        const distanceToCenter = Math.hypot(dx, dy);
        let distanceToSurface = 0;
        if (distanceToCenter > 0) {
            if (distanceToCenter >= target.radius) {
                distanceToSurface = distanceToCenter - target.radius;
            } else {
                distanceToSurface = target.radius - distanceToCenter;
            }
        } else {
            distanceToSurface = target.radius;
        }

        record.beamLength = Math.min(
            distanceToSurface,
            record.beamLength + LASER_SPEED * delta
        );

        if (
            distanceToSurface <= 0.5 ||
            record.beamLength >= distanceToSurface - 0.5
        ) {
            target.health -= getMiningDamage() * delta;
            if (target.health <= 0) {
                breakAsteroid(target);
                continue;
            }
        }

        updatedTargets.set(target.id, record);
    }

    state.mining.targets = updatedTargets;
}

function removeDestroyedAsteroids() {
    if (!state.asteroids.length) return;
    const hasDestroyed = state.asteroids.some((asteroid) => asteroid.destroyed);
    if (!hasDestroyed) return;
    state.asteroids = state.asteroids.filter((asteroid) => !asteroid.destroyed);
    purgeInvalidMiningTargets();
}

function drawAsteroids() {
    ctx.clearRect(0, 0, width, height);
    const bodyStyle = getComputedStyle(document.body);
    const rootStyle = getComputedStyle(document.documentElement);
    ctx.lineWidth =
        parseFloat(bodyStyle.getPropertyValue('--asteroid-line-width')) ||
        parseFloat(rootStyle.getPropertyValue('--asteroid-line-width')) ||
        ASTEROID_LINE_WIDTH;
    const strokeColor =
        (bodyStyle.getPropertyValue('--asteroid-stroke') ||
            rootStyle.getPropertyValue('--asteroid-stroke') ||
            rootStyle.getPropertyValue('--asteroid-accent') ||
            '#000')
            .trim();
    ctx.strokeStyle = strokeColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const laserColor =
        (bodyStyle.getPropertyValue('--pointer-laser-color') ||
            rootStyle.getPropertyValue('--pointer-laser-color') ||
            bodyStyle.getPropertyValue('--laser-color') ||
            rootStyle.getPropertyValue('--laser-color') ||
            bodyStyle.getPropertyValue('--mining-circle-color') ||
            rootStyle.getPropertyValue('--mining-circle-color') ||
            '#f00')
            .trim();
    const pointerColor =
        (bodyStyle.getPropertyValue('--pointer-circle-color') ||
            rootStyle.getPropertyValue('--pointer-circle-color') ||
            laserColor)
            .trim();
    const collectibleColor =
        (bodyStyle.getPropertyValue('--asteroid-text') ||
            rootStyle.getPropertyValue('--asteroid-text') ||
            strokeColor)
            .trim();

    for (const asteroid of state.asteroids) {
        if (asteroid.destroyed) continue;
        const step = (Math.PI * 2) / asteroid.sides;
        const points = [];

        for (let i = 0; i < asteroid.sides; i++) {
            const ang = asteroid.rotation + i * step;
            const px = asteroid.x + Math.cos(ang) * asteroid.radius;
            const py = asteroid.y + Math.sin(ang) * asteroid.radius;
            points.push([px, py]);
        }

        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();
        ctx.stroke();
    }
    drawCollectibles(collectibleColor);
    drawMiningLaser(laserColor);
    drawPointerCircle(pointerColor);
}

function drawCollectibles(color) {
    if (!state.collectibles.length) return;
    ctx.save();
    ctx.fillStyle = color || '#000';
    for (const collectible of state.collectibles) {
        ctx.beginPath();
        ctx.arc(collectible.x, collectible.y, collectible.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawMiningLaser(color) {
    if (!state.pointer.active || !state.mining.targets.size) {
        return;
    }

    ctx.save();
    ctx.strokeStyle = color || '#f00';
    ctx.lineWidth = MINING_LASER_LINE_WIDTH;
    for (const [targetId, targetState] of state.mining.targets.entries()) {
        if (!targetState || targetState.beamLength <= 0) continue;
        const target = state.asteroids.find((asteroid) => asteroid.id === targetId);
        if (!target || target.destroyed) continue;
        const dx = target.x - state.pointer.x;
        const dy = target.y - state.pointer.y;
        const distanceToCenter = Math.hypot(dx, dy);
        if (distanceToCenter === 0) continue;
        const pointerOutside = distanceToCenter >= target.radius;
        const directionSign = pointerOutside ? 1 : -1;
        const ux = (dx / distanceToCenter) * directionSign;
        const uy = (dy / distanceToCenter) * directionSign;
        const beamLength = targetState.beamLength;
        const endX = state.pointer.x + ux * beamLength;
        const endY = state.pointer.y + uy * beamLength;

        ctx.beginPath();
        ctx.moveTo(state.pointer.x, state.pointer.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPointerCircle(color) {
    if (!state.pointer.active) return;
    ctx.save();
    ctx.strokeStyle = color || '#f00';
    ctx.lineWidth = POINTER_RING_LINE_WIDTH;
    ctx.beginPath();
    ctx.arc(state.pointer.x, state.pointer.y, getPointerRadius(), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function resetGame() {
    state.asteroids = [];
    state.collectibles = [];
    state.frozen = false;
    state.nextSpawnAt = performance.now() + randRange(SPAWN_INTERVAL.min, SPAWN_INTERVAL.max);
    lastFrame = performance.now();
    state.points = 0;
    state.ore = 0;
    state.oreRatio = 1;
    state.gameStartTime = performance.now();
    state.lastOreRatioUpdate = performance.now();
    state.oreConversionProgress = 0;
    state.upgrades.num = LASER_COUNT_BASE;
    state.upgrades.strength = 0;
    state.upgrades.radius = 0;
    state.upgradeLevels = {
        num: 1,
        strength: 1,
        radius: 1,
    };
    stopAllZoneInteractions();
    updateResourceDisplays();
    clearMiningState();
    state.finishReason = null;
    hideWinShareButton();
    setMiningVisualsTransparent(false);
    collectibleIdCounter = 0;
}

function freezeField(reason) {
    if (state.frozen) return;
    state.frozen = true;
    state.finishReason = reason || null;
    const lossReason = reason === 'asteroid impact' || reason === 'cursor left window';
    if (lossReason) {
        showWinShareButton();
        setMiningVisualsTransparent(true);
    }
    clearMiningState();
    deactivateOreConverter();
    stopAllZoneInteractions();
}

function handleWindowLeave(event) {
    deactivateOreConverter();
    stopAllZoneInteractions();
    if (state.frozen) return;
    if (!event.relatedTarget && !event.toElement) {
        freezeField('cursor left window');
    }
}

function handleBlur() {
    deactivateOreConverter();
    stopAllZoneInteractions();
    if (!state.frozen) {
        freezeField('cursor left window');
    }
}

function updateVirtualPointerFromMouse(event) {
    if (!canvas) return;
    const locked = document.pointerLockElement === canvas;
    let nextX = state.pointer.x;
    let nextY = state.pointer.y;

    if (locked && typeof event.movementX === 'number' && typeof event.movementY === 'number') {
        nextX += event.movementX;
        nextY += event.movementY;
    } else {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const normalizedX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            const normalizedY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
            nextX = normalizedX * width;
            nextY = normalizedY * height;
        } else {
            nextX = clamp(event.clientX, 0, width);
            nextY = clamp(event.clientY, 0, height);
        }
    }

    state.pointer.x = clamp(nextX, 0, width);
    state.pointer.y = clamp(nextY, 0, height);
    state.pointer.active = true;
    state.pointer.locked = locked;
}

function handlePointerMovement(event) {
    updateVirtualPointerFromMouse(event);
}

function handlePointerLockChange() {
    state.pointer.locked = document.pointerLockElement === canvas;
}

function requestPointerLock() {
    if (canvas && canvas.requestPointerLock && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    }
}

function handleContextMenu(event) {
    event.preventDefault();
}

function handleResetKeys(event) {
    if (event.repeat) return;
    const isResetKey =
        event.code === 'Enter' ||
        event.code === 'NumpadEnter' ||
        event.code === 'KeyR';
    if (!isResetKey) return;
    event.preventDefault();
    resetGame();
}

function loop(now) {
    const delta = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (!state.frozen) {
        updateAsteroids(delta);
        updateCollectibles(delta);
        handleMining(delta);
        detectCollisions();
        handleCollectiblePickup();
        removeDestroyedAsteroids();

        if (now >= state.nextSpawnAt) {
            spawnAsteroid(now);
        }
    } else {
        clearMiningState();
    }

    handleUpgradeZones(delta);
    updateOreRatio(now);
    handleOreConversion(delta);
    drawAsteroids();
    requestAnimationFrame(loop);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('mousemove', handlePointerMovement, { passive: true });
document.addEventListener('mouseleave', handleWindowLeave, { passive: true });
window.addEventListener('blur', handleBlur);
document.addEventListener('pointerlockchange', handlePointerLockChange);
if (canvas) {
    canvas.addEventListener('pointerdown', requestPointerLock);
}
window.addEventListener('contextmenu', handleContextMenu);
window.addEventListener('keydown', handleResetKeys);
resetButton.addEventListener('click', resetGame);
if (shareButton) {
    shareButton.addEventListener('click', handleShareButtonClick);
}
if (oreConverter) {
    oreConverter.addEventListener('pointerenter', () => setZoneHover('ore', true));
    oreConverter.addEventListener('pointerleave', () => {
        setZoneHover('ore', false);
        deactivateOreConverter();
    });
}

const upgradeSquares = {
    radius: radiusUpgradeSquare,
    strength: strengthUpgradeSquare,
    num: numUpgradeSquare,
};

for (const [zoneKey, element] of Object.entries(upgradeSquares)) {
    if (!element) continue;
    element.addEventListener('pointerenter', () => setZoneHover(zoneKey, true));
    element.addEventListener('pointerleave', () => setZoneHover(zoneKey, false));
}

for (const element of Object.values(zoneElements)) {
    attachPulseReset(element);
}

applyLineWidth(ASTEROID_LINE_WIDTH);
updateResourceDisplays();

requestAnimationFrame(loop);
