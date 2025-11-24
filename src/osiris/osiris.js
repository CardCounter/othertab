const canvas = document.getElementById('osiris-canvas');
const ctx = canvas.getContext('2d');
const resetButton = document.getElementById('reset-button');
const scoreDisplay = document.getElementById('score-display');
const oreDisplay = document.getElementById('ore-display');
const oreConverter = document.getElementById('ore-converter');
const radiusUpgradeSquare = document.getElementById('radius-upgrade');
const strengthUpgradeSquare = document.getElementById('strength-upgrade');
const numUpgradeSquare = document.getElementById('num-upgrade');
const playSurface = document.querySelector('.play-surface');
const resetOverlay = document.getElementById('reset-overlay');
const osirisWrapper = document.querySelector('.osiris-wrapper');
const pointerDot = document.getElementById('pointer-dot');
const CURSOR_VISIBLE_CLASS = 'cursor-visible';
let pointerInsideWrapper = false;
const zoneElements = {
    ore: oreConverter,
    radius: radiusUpgradeSquare,
    strength: strengthUpgradeSquare,
    num: numUpgradeSquare,
};
const shareButton = document.getElementById('share-button');
const shareScoreMessage = document.getElementById('share-score');
const OSIRIS_SHARE_URL = 'https://othertab.com/osiris/';
let shareButtonResetTimeout = null;
let currentWinShareText = '';

const SPAWN_INTERVAL = { min: 3000, max: 6000 };
const OSIRIS_SPIN = { min: -2.2, max: 2.2 };
const OSIRIS_LINE_WIDTH = 3;
const POINTER_RING_RADIUS = 50;
const MINING_DAMAGE_PER_SECOND = 100;
const MINING_LASER_LINE_WIDTH = 2;
const POINTER_RING_LINE_WIDTH = 2;
const SPLIT_COUNT = 2;
const SPLIT_DIRECTION_VARIANCE = Math.PI / 6;
const POINTER_COLLECTION_PADDING = 6;
const ORE_CONVERSION_RATE = 1;
const UPGRADE_HOLD_DURATION = 1;
const STRENGTH_INCREMENT = 50;
const RADIUS_INCREMENT = 10;
const LASER_COUNT_BASE = 1;
const ORE_RATIO_UPDATE_INTERVAL = { min: 5000, max: 10000 };
const DIFFICULTY_RAMP_PER_MINUTE = 0.25;

const UPGRADE_CONFIG = {
    num: { increment: 1 },
    strength: { increment: STRENGTH_INCREMENT },
    radius: { increment: RADIUS_INCREMENT },
};
const ZONE_PULSE_CLASS = 'square-pulse';

const OSIRIS_TIERS = [
    {
        name: 'triangle',
        sides: 3,
        size: { min: 14, max: 24 },
        speed: { min: 220, max: 360 },
        health: { min: 100, max: 200 },
    },
    {
        name: 'square',
        sides: 4,
        size: { min: 20, max: 34 },
        speed: { min: 180, max: 320 },
        health: { min: 150, max: 250 },
    },
    {
        name: 'pentagon',
        sides: 5,
        size: { min: 26, max: 44 },
        speed: { min: 150, max: 280 },
        health: { min: 200, max: 300 },
    },
    {
        name: 'hexagon',
        sides: 6,
        size: { min: 30, max: 56 },
        speed: { min: 130, max: 240 },
        health: { min: 250, max: 350 },
    },
    {
        name: 'heptagon',
        sides: 7,
        size: { min: 34, max: 72 },
        speed: { min: 110, max: 210 },
        health: { min: 300, max: 400 },
    },
    {
        name: 'octagon',
        sides: 8,
        size: { min: 40, max: 90 },
        speed: { min: 90, max: 180 },
        health: { min: 350, max: 450 },
    },
];

const TIER_SPAWN_WEIGHTS = OSIRIS_TIERS.map((_, idx) => Math.pow(idx + 1, 2));
const TOTAL_TIER_WEIGHT = TIER_SPAWN_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const MAX_TIER_INDEX = OSIRIS_TIERS.length - 1;
const INITIAL_TIER_INDICES = [0, 1, 2];
const COLLECTIBLE_SPEED = { min: 80, max: 150 };
const COLLECTIBLE_SIZE = { min: 6, max: 11 };

const state = {
    osirisField: [],
    collectibles: [],
    pointer: {
        x: 0,
        y: 0,
        active: false,
        locked: false,
    },
    frozen: false,
    finishReason: null,
    nextSpawnAt: performance.now(),
    mining: {
        targets: new Map(),
    },
    points: 0,
    totalScience: 0,
    ore: 0,
    oreRatio: 1,
    lastOreRatioUpdate: 0,
    nextOreRatioUpdate: 0,
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
    hasSpawnedInitialOsiris: false,
};

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;
let lastFrame = performance.now();
let osirisIdCounter = 0;
let collectibleIdCounter = 0;

function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomOreRatioIntervalMs() {
    return randRange(ORE_RATIO_UPDATE_INTERVAL.min, ORE_RATIO_UPDATE_INTERVAL.max);
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

function chooseInitialTierIndex() {
    const idx = Math.floor(Math.random() * INITIAL_TIER_INDICES.length);
    return INITIAL_TIER_INDICES[idx];
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

function getOsirisRadiusInDirection(osiris, dirX, dirY) {
    const dirLength = Math.hypot(dirX, dirY);
    if (dirLength === 0) {
        return osiris.radius;
    }
    const nx = dirX / dirLength;
    const ny = dirY / dirLength;
    const step = (Math.PI * 2) / osiris.sides;
    let closest = Infinity;
    for (let i = 0; i < osiris.sides; i++) {
        const nextIndex = (i + 1) % osiris.sides;
        const angCurrent = osiris.rotation + i * step;
        const angNext = osiris.rotation + nextIndex * step;
        const ax = Math.cos(angCurrent) * osiris.radius;
        const ay = Math.sin(angCurrent) * osiris.radius;
        const bx = Math.cos(angNext) * osiris.radius;
        const by = Math.sin(angNext) * osiris.radius;
        const ex = bx - ax;
        const ey = by - ay;
        const denom = nx * ey - ny * ex;
        if (Math.abs(denom) < 1e-6) {
            continue;
        }
        const t = (ax * ey - ay * ex) / denom;
        const u = (ax * ny - ay * nx) / denom;
        if (t >= 0 && u >= 0 && u <= 1) {
            closest = Math.min(closest, t);
        }
    }
    if (!isFinite(closest) || closest <= 0) {
        return osiris.radius;
    }
    return closest;
}

function applyLineWidth(widthValue) {
    document.documentElement.style.setProperty('--osiris-line-width', widthValue);
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

function setPlaySurfaceFrozen(frozen) {
    if (!playSurface) return;
    playSurface.classList.toggle('is-frozen', frozen);
}

function showCursor() {
    if (!osirisWrapper) return;
    osirisWrapper.classList.add(CURSOR_VISIBLE_CLASS);
}

function hideCursor() {
    if (!osirisWrapper) return;
    osirisWrapper.classList.remove(CURSOR_VISIBLE_CLASS);
}

function showResetOverlay() {
    if (!resetOverlay) return;
    resetOverlay.setAttribute('aria-hidden', 'false');
    resetOverlay.classList.add('visible');
}

function hideResetOverlay() {
    if (!resetOverlay) return;
    resetOverlay.setAttribute('aria-hidden', 'true');
    resetOverlay.classList.remove('visible');
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
        const stillExists = state.osirisField.some(
            (osiris) => !osiris.destroyed && osiris.id === id
        );
        if (!stillExists) {
            state.mining.targets.delete(id);
        }
    }
}

function updateResourceDisplays() {
    if (scoreDisplay) {
        scoreDisplay.textContent = `${state.points}${getPointsLabel()}`;
    }
    if (oreDisplay) {
        oreDisplay.textContent = `${state.ore}⛰`;
    }
    
    // update upgrade zones
    if (strengthUpgradeSquare) {
        const cost = getUpgradeCost('strength');
        const val = MINING_DAMAGE_PER_SECOND + state.upgrades.strength;
        strengthUpgradeSquare.innerHTML = `<span class="square-label">strength: ${val}<br>${cost}${getPointsLabel()}</span>`;
    }
    if (radiusUpgradeSquare) {
        const cost = getUpgradeCost('radius');
        const val = POINTER_RING_RADIUS + state.upgrades.radius;
        radiusUpgradeSquare.innerHTML = `<span class="square-label">range: ${val}<br>${cost}${getPointsLabel()}</span>`;
    }
    if (numUpgradeSquare) {
        const cost = getUpgradeCost('num');
        const val = state.upgrades.num;
        numUpgradeSquare.innerHTML = `<span class="square-label">lasers: ${val}<br>${cost}${getPointsLabel()}</span>`;
    }
    // update ore converter with ratio
    if (oreConverter) {
        oreConverter.innerHTML = `<span class="square-label">research<br>1⛰ : ${state.oreRatio}${getPointsLabel()}</span>`;
    }
}

function getPointsLabel() {
    return '⌬';
}

function updateShareScoreDisplay(visible) {
    if (!shareScoreMessage) {
        return;
    }
    if (visible) {
        shareScoreMessage.textContent = `${state.totalScience}${getPointsLabel()}`;
        shareScoreMessage.classList.remove('hidden');
    } else {
        shareScoreMessage.textContent = '';
        shareScoreMessage.classList.add('hidden');
    }
}

function getWinShareText() {
    const label = getPointsLabel();
    return `OSIRIS\n${state.totalScience}${label}\n${OSIRIS_SHARE_URL}`;
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

function releasePointerLock() {
    if (document.pointerLockElement === canvas && typeof document.exitPointerLock === 'function') {
        document.exitPointerLock();
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
    const rect = playSurface ? playSurface.getBoundingClientRect() : null;
    const rootFontSize =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    width = rect && rect.width ? rect.width : 30 * rootFontSize;
    height = rect && rect.height ? rect.height : 20 * rootFontSize;
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.pointer.active) {
        state.pointer.x = width / 2;
        state.pointer.y = height / 2;
    }
}

function computeEdgeSpawn(radius) {
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;
    let angle;

    switch (side) {
        case 0:
            x = randRange(radius, Math.max(radius, width - radius));
            y = -radius;
            angle = randRange(Math.PI / 6, (5 * Math.PI) / 6);
            break;
        case 1:
            x = width + radius;
            y = randRange(radius, Math.max(radius, height - radius));
            angle = randRange((2 * Math.PI) / 3, (4 * Math.PI) / 3);
            break;
        case 2:
            x = randRange(radius, Math.max(radius, width - radius));
            y = height + radius;
            angle = randRange((7 * Math.PI) / 6, (11 * Math.PI) / 6);
            break;
        default:
            x = -radius;
            y = randRange(radius, Math.max(radius, height - radius));
            angle = randRange(-Math.PI / 6, Math.PI / 6);
            break;
    }

    return { x, y, angle };
}

function createOsirisFromTier(tierIndex, options = {}) {
    const tier = OSIRIS_TIERS[tierIndex] || OSIRIS_TIERS[MAX_TIER_INDEX];
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
        id: osirisIdCounter++,
        tierIndex,
        tierName: tier.name,
        sides: tier.sides,
        x: spawnData.x,
        y: spawnData.y,
        radius,
        rotation: Math.random() * Math.PI * 2,
        spin: randRange(OSIRIS_SPIN.min, OSIRIS_SPIN.max),
        vx,
        vy,
        health,
        maxHealth: health,
        destroyed: false,
    };
}

function addOsirisFromTier(tierIndex, options = {}) {
    const osiris = createOsirisFromTier(tierIndex, options);
    state.osirisField.push(osiris);
    return osiris;
}

function spawnOsiris(now = performance.now()) {
    const tierIndex = state.hasSpawnedInitialOsiris
        ? chooseSpawnTierIndex()
        : chooseInitialTierIndex();
    addOsirisFromTier(tierIndex);
    state.hasSpawnedInitialOsiris = true;
    state.nextSpawnAt = now + randRange(SPAWN_INTERVAL.min, SPAWN_INTERVAL.max);
}

function spawnCollectibles(osiris) {
    const count = Math.max(2, Math.round(randRange(2, 4)));
    for (let i = 0; i < count; i++) {
        const radius = randRange(COLLECTIBLE_SIZE.min, COLLECTIBLE_SIZE.max);
        const speed = randRange(COLLECTIBLE_SPEED.min, COLLECTIBLE_SPEED.max);
        const angle = Math.random() * Math.PI * 2;
        state.collectibles.push({
            id: collectibleIdCounter++,
            x: osiris.x,
            y: osiris.y,
            radius,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            value: 1,
        });
    }
}

function breakOsiris(osiris) {
    if (osiris.destroyed) return;
    osiris.destroyed = true;
    const nextTierIndex = osiris.tierIndex - 1;
    if (nextTierIndex >= 0) {
        const difficultyMultiplier = 1 + ((performance.now() - state.gameStartTime) / 60000) * DIFFICULTY_RAMP_PER_MINUTE;
        const tier = OSIRIS_TIERS[nextTierIndex];
        const speedMin = tier.speed.min * difficultyMultiplier;
        const speedMax = tier.speed.max * difficultyMultiplier;

        const parentSpeed = Math.hypot(osiris.vx, osiris.vy);
        const parentHasMomentum = parentSpeed > 0;
        const clampedParentSpeed = parentHasMomentum
            ? clamp(parentSpeed, speedMin, speedMax)
            : 0;
        const baseHeading = parentHasMomentum
            ? Math.atan2(osiris.vy, osiris.vx)
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
            const offsetDistance = randRange(0, osiris.radius * 0.4);
            addOsirisFromTier(nextTierIndex, {
                position: {
                    x: osiris.x + Math.cos(offsetAngle) * offsetDistance,
                    y: osiris.y + Math.sin(offsetAngle) * offsetDistance,
                },
                velocity: {
                    vx: Math.cos(heading) * speed,
                    vy: Math.sin(heading) * speed,
                },
                parentRadius: osiris.radius,
            });
        }
    } else {
        spawnCollectibles(osiris);
    }
    if (state.mining.targets.has(osiris.id)) {
        state.mining.targets.delete(osiris.id);
    }
}

function updateOsiriss(delta) {
    for (const osiris of state.osirisField) {
        if (osiris.destroyed) {
            continue;
        }
        osiris.x += osiris.vx * delta;
        osiris.y += osiris.vy * delta;
        osiris.rotation += osiris.spin * delta;
        wrapEntity(osiris, osiris.radius);
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
    for (const osiris of state.osirisField) {
        if (osiris.destroyed) continue;
        const dx = state.pointer.x - osiris.x;
        const dy = state.pointer.y - osiris.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= osiris.radius) {
            freezeField('osiris impact');
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
        const scienceGained = wholeUnits * state.oreRatio;
        state.points += scienceGained;
        state.totalScience += scienceGained;
        state.oreConversionProgress -= wholeUnits;
        updateResourceDisplays();
        triggerZonePulse('ore');
    }
}

function updateOreRatio(now) {
    if (state.frozen) {
        return;
    }

    if (!state.nextOreRatioUpdate) {
        state.nextOreRatioUpdate = now + getRandomOreRatioIntervalMs();
    }

    if (now >= state.nextOreRatioUpdate) {
        state.oreRatio = Math.floor(Math.random() * 5) + 1; // values range from one to ten
        state.lastOreRatioUpdate = now;
        state.nextOreRatioUpdate = now + getRandomOreRatioIntervalMs();
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

    for (const osiris of state.osirisField) {
        if (osiris.destroyed) continue;
        const dx = state.pointer.x - osiris.x;
        const dy = state.pointer.y - osiris.y;
        const distance = Math.hypot(dx, dy);
        const maxDistance = osiris.radius + pointerRadius;
        if (distance <= maxDistance) {
            const overlap = maxDistance - distance;
            candidates.push({ osiris, overlap });
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
        const target = entry.osiris;
        let record = state.mining.targets.get(target.id);
        if (!record) {
            record = { beamLength: 0 };
        }

        const dx = target.x - state.pointer.x;
        const dy = target.y - state.pointer.y;
        const distanceToCenter = Math.hypot(dx, dy);
        const centerToPointerX = state.pointer.x - target.x;
        const centerToPointerY = state.pointer.y - target.y;
        const directionRadius = getOsirisRadiusInDirection(
            target,
            centerToPointerX,
            centerToPointerY
        );
        let distanceToSurface = 0;
        if (distanceToCenter >= directionRadius) {
            distanceToSurface = distanceToCenter - directionRadius;
        } else {
            distanceToSurface = directionRadius - distanceToCenter;
        }

        record.beamLength = distanceToSurface;

        if (
            distanceToSurface <= 0.5 ||
            record.beamLength >= distanceToSurface - 0.5
        ) {
            target.health -= getMiningDamage() * delta;
            if (target.health <= 0) {
                breakOsiris(target);
                continue;
            }
        }

        updatedTargets.set(target.id, record);
    }

    state.mining.targets = updatedTargets;
}

function removeDestroyedOsiriss() {
    if (!state.osirisField.length) return;
    const hasDestroyed = state.osirisField.some((osiris) => osiris.destroyed);
    if (!hasDestroyed) return;
    state.osirisField = state.osirisField.filter((osiris) => !osiris.destroyed);
    purgeInvalidMiningTargets();
}

function drawOsiriss() {
    ctx.clearRect(0, 0, width, height);
    const bodyStyle = getComputedStyle(document.body);
    const rootStyle = getComputedStyle(document.documentElement);
    ctx.lineWidth =
        parseFloat(bodyStyle.getPropertyValue('--osiris-line-width')) ||
        parseFloat(rootStyle.getPropertyValue('--osiris-line-width')) ||
        OSIRIS_LINE_WIDTH;
    const strokeColor =
        (bodyStyle.getPropertyValue('--osiris-stroke') ||
            rootStyle.getPropertyValue('--osiris-stroke') ||
            rootStyle.getPropertyValue('--osiris-accent') ||
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
        (bodyStyle.getPropertyValue('--osiris-text') ||
            rootStyle.getPropertyValue('--osiris-text') ||
            strokeColor)
            .trim();

    for (const osiris of state.osirisField) {
        if (osiris.destroyed) continue;
        const step = (Math.PI * 2) / osiris.sides;
        const points = [];

        for (let i = 0; i < osiris.sides; i++) {
            const ang = osiris.rotation + i * step;
            const px = osiris.x + Math.cos(ang) * osiris.radius;
            const py = osiris.y + Math.sin(ang) * osiris.radius;
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
        const target = state.osirisField.find((osiris) => osiris.id === targetId);
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

function shouldDisplayPointer() {
    if (state.frozen) {
        return false;
    }
    if (!state.pointer.active) {
        return true;
    }
    return pointerInsideWrapper;
}

function drawPointerCircle(color) {
    if (!shouldDisplayPointer()) {
        syncPointerDot();
        return;
    }
    ctx.save();
    ctx.strokeStyle = color || '#f00';
    ctx.lineWidth = POINTER_RING_LINE_WIDTH;
    ctx.beginPath();
    ctx.arc(state.pointer.x, state.pointer.y, getPointerRadius(), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    syncPointerDot();
}

function syncPointerDot() {
    if (!pointerDot) return;
    pointerDot.style.left = `${state.pointer.x}px`;
    pointerDot.style.top = `${state.pointer.y}px`;
    const shouldShow = shouldDisplayPointer();
    pointerDot.classList.toggle('visible', shouldShow);
}

function resetGame() {
    const nowTime = performance.now();
    state.osirisField = [];
    state.collectibles = [];
    state.frozen = false;
    setPlaySurfaceFrozen(false);
    hideCursor();
    state.nextSpawnAt = nowTime;
    lastFrame = nowTime;
    state.points = 0;
    state.totalScience = 0;
    state.ore = 0;
    state.oreRatio = 1;
    state.gameStartTime = nowTime;
    state.lastOreRatioUpdate = nowTime;
    state.nextOreRatioUpdate = nowTime + getRandomOreRatioIntervalMs();
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
    state.hasSpawnedInitialOsiris = false;
    pointerInsideWrapper = false;
    syncPointerDot();
    hideResetOverlay();
}

function freezeField(reason) {
    if (state.frozen) return;
    releasePointerLock();
    state.frozen = true;
    setPlaySurfaceFrozen(true);
    showCursor();
    state.nextOreRatioUpdate = 0;
    state.finishReason = reason || null;
    showWinShareButton();
    setMiningVisualsTransparent(true);
    clearMiningState();
    deactivateOreConverter();
    stopAllZoneInteractions();
    showResetOverlay();
    syncPointerDot();
}

function handleWrapperPointerEnter() {
    pointerInsideWrapper = true;
    syncPointerDot();
}

function handleWrapperPointerLeave(event) {
    if (!osirisWrapper || state.frozen) {
        return;
    }
    if (document.pointerLockElement === canvas) {
        return;
    }
    const nextTarget = event.relatedTarget;
    if (nextTarget && osirisWrapper.contains(nextTarget)) {
        return;
    }
    pointerInsideWrapper = false;
    syncPointerDot();
    freezeField('cursor left osiris wrapper');
}

function handleWindowLeave(event) {
    deactivateOreConverter();
    stopAllZoneInteractions();
    pointerInsideWrapper = false;
    syncPointerDot();
    if (state.frozen) return;
    if (!event.relatedTarget && !event.toElement) {
        freezeField('cursor left window');
    }
}

function handleBlur() {
    deactivateOreConverter();
    stopAllZoneInteractions();
    pointerInsideWrapper = false;
    syncPointerDot();
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

function isPointerWithinWrapper(clientX, clientY) {
    if (!osirisWrapper || typeof clientX !== 'number' || typeof clientY !== 'number') {
        return true;
    }
    const rect = osirisWrapper.getBoundingClientRect();
    if (!rect) {
        return true;
    }
    return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
    );
}

function handlePointerMovement(event) {
    const locked = document.pointerLockElement === canvas;
    if (!locked && osirisWrapper) {
        const inside = isPointerWithinWrapper(event.clientX, event.clientY);
        if (!inside) {
            pointerInsideWrapper = false;
            syncPointerDot();
            if (!state.frozen) {
                freezeField('cursor left osiris wrapper');
            }
            return;
        }
        pointerInsideWrapper = true;
    } else if (locked) {
        pointerInsideWrapper = true;
    }
    updateVirtualPointerFromMouse(event);
}

function handlePointerLockChange() {
    const locked = document.pointerLockElement === canvas;
    state.pointer.locked = locked;
    if (locked) {
        pointerInsideWrapper = true;
        syncPointerDot();
        return;
    }
    if (!state.frozen) {
        pointerInsideWrapper = false;
        syncPointerDot();
        freezeField('cursor left osiris wrapper');
    }
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
        updateOsiriss(delta);
        updateCollectibles(delta);
        handleMining(delta);
        detectCollisions();
        handleCollectiblePickup();
        removeDestroyedOsiriss();

        if (now >= state.nextSpawnAt) {
            spawnOsiris(now);
        }
    } else {
        clearMiningState();
    }

    handleUpgradeZones(delta);
    updateOreRatio(now);
    handleOreConversion(delta);
    drawOsiriss();
    requestAnimationFrame(loop);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
if (osirisWrapper) {
    osirisWrapper.addEventListener('pointerenter', handleWrapperPointerEnter, { passive: true });
    osirisWrapper.addEventListener('pointerleave', handleWrapperPointerLeave, { passive: true });
}
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

hideResetOverlay();
if (osirisWrapper && typeof osirisWrapper.matches === 'function') {
    pointerInsideWrapper = osirisWrapper.matches(':hover');
}
syncPointerDot();

applyLineWidth(OSIRIS_LINE_WIDTH);
updateResourceDisplays();

requestAnimationFrame(loop);
