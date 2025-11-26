const canvas = document.getElementById('osiris-canvas');
const ctx = canvas.getContext('2d');
const resetButton = document.getElementById('reset-button');
const oreConverter = document.getElementById('ore-converter');
const radiusUpgradeSquare = document.getElementById('radius-upgrade');
const strengthUpgradeSquare = document.getElementById('strength-upgrade');
const numUpgradeSquare = document.getElementById('num-upgrade');
const playSurface = document.querySelector('.play-surface');
const resetOverlay = document.getElementById('reset-overlay');
const osirisWrapper = document.querySelector('.osiris-wrapper');
const pointerDot = document.getElementById('pointer-dot');
const timerDisplay = document.getElementById('osiris-timer');
const startOverlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');
const timerOreDisplay = document.getElementById('timer-ore-display');
const timerScoreDisplay = document.getElementById('timer-score-display');
const strengthStatDisplay = document.getElementById('strength-upgrade-stat');
const radiusStatDisplay = document.getElementById('radius-upgrade-stat');
const numStatDisplay = document.getElementById('num-upgrade-stat');
const CURSOR_HIDDEN_CLASS = 'cursor-hidden';
let pointerInsideWrapper = false;
let pointerCircleApplied = false;
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
const POINTER_RING_RADIUS = 5;
const MINING_DAMAGE_PER_SECOND = 10;
const MINING_LASER_LINE_WIDTH = 2;
const POINTER_RING_LINE_WIDTH = 2;
const POINTER_RING_DASH = [6, 6];
const CURSOR_COLLISION_RADIUS = 1;
const POINTER_DOT_COLLISION_RADIUS = CURSOR_COLLISION_RADIUS;
const SPLIT_COUNT = 2;
const SPLIT_DIRECTION_VARIANCE = Math.PI / 6;
const POINTER_COLLECTION_PADDING = 6;
const ORE_CONVERSION_RATE = 1;
const UPGRADE_HOLD_DURATION = 1;
const STRENGTH_INCREMENT = 10;
const RADIUS_INCREMENT = 2;
const LASER_COUNT_BASE = 1;
const ORE_RATIO_UPDATE_INTERVAL = { min: 5000, max: 10000 };
const ORE_RATIO_VALUE_RANGE = { min: 1, max: 5 };
const DIFFICULTY_RAMP_PER_MINUTE = 0.25;
const START_TRIANGLE_TIER_INDEX = 0;
const START_TRIANGLE_HEALTH = 1;
const START_TRIANGLE_ABOVE_TIMER_OFFSET = 40;
const START_TRIANGLE_FALLBACK_OFFSET = 120;

const UPGRADE_CONFIG = {
    num: { increment: 1 },
    strength: { increment: STRENGTH_INCREMENT },
    radius: { increment: RADIUS_INCREMENT },
};
const ZONE_PULSE_CLASS = 'square-pulse';
const ZONE_HOVER_CLASS = 'zone-hovered';

const OSIRIS_TIERS = [
    {
        name: 'triangle',
        sides: 3,
        size: { min: 15, max: 25 },
        speed: { min: 150, max: 300 },
        health: { min: 10, max: 20 },
    },
    {
        name: 'square',
        sides: 4,
        size: { min: 20, max: 35 },
        speed: { min: 120, max: 240 },
        health: { min: 20, max: 30 },
    },
    {
        name: 'pentagon',
        sides: 5,
        size: { min: 25, max: 45 },
        speed: { min: 100, max: 200 },
        health: { min: 30, max: 40 },
    },
    {
        name: 'hexagon',
        sides: 6,
        size: { min: 30, max: 55 },
        speed: { min: 90, max: 180 },
        health: { min: 40, max: 50 },
    },
    {
        name: 'heptagon',
        sides: 7,
        size: { min: 35, max: 75 },
        speed: { min: 70, max: 140 },
        health: { min: 50, max: 60 },
    },
    {
        name: 'octagon',
        sides: 8,
        size: { min: 40, max: 95 },
        speed: { min: 60, max: 120 },
        health: { min: 60, max: 70 },
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
    awaitingStart: false,
    finishReason: null,
    nextSpawnAt: performance.now(),
    mining: {
        targets: new Map(),
    },
    points: 0,
    totalScience: 0,
    ore: 0,
    oreRatio: getRandomOreRatioValue(),
    lastOreRatioUpdate: 0,
    nextOreRatioUpdate: 0,
    gameStartTime: performance.now(),
    frozenAt: null,
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
    starterActive: false,
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

function getRandomOreRatioValue() {
    const { min, max } = ORE_RATIO_VALUE_RANGE;
    const range = max - min + 1;
    return Math.floor(Math.random() * range) + min;
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
    return POINTER_RING_RADIUS * 10 + state.upgrades.radius;
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

function setPlaySurfaceAwaitingStart(waiting) {
    if (!playSurface) return;
    playSurface.classList.toggle('is-awaiting-start', waiting);
}

function showStartOverlay() {
    if (!startOverlay) return;
    startOverlay.setAttribute('aria-hidden', 'false');
    startOverlay.classList.add('visible');
}

function hideStartOverlay() {
    if (!startOverlay) return;
    startOverlay.setAttribute('aria-hidden', 'true');
    startOverlay.classList.remove('visible');
}

function isCursorHoveringWrapper() {
    return Boolean(
        osirisWrapper &&
        typeof osirisWrapper.matches === 'function' &&
        osirisWrapper.matches(':hover')
    );
}

function enterAwaitingStartState() {
    if (state.awaitingStart) return;
    state.awaitingStart = true;
    setPlaySurfaceAwaitingStart(true);
    showStartOverlay();
    resetPointerCircleState();
}

function exitAwaitingStartState() {
    if (!state.awaitingStart) return;
    state.awaitingStart = false;
    setPlaySurfaceAwaitingStart(false);
    hideStartOverlay();
}

function forceCursorReflow() {
    if (!osirisWrapper) return;
    void osirisWrapper.offsetWidth;
}

function showBrowserCursor() {
    if (!osirisWrapper) return;
    osirisWrapper.classList.remove(CURSOR_HIDDEN_CLASS);
    forceCursorReflow();
}

function hideBrowserCursor() {
    if (!osirisWrapper) return;
    osirisWrapper.classList.add(CURSOR_HIDDEN_CLASS);
    forceCursorReflow();
}

function applyPointerCircle() {
    if (pointerCircleApplied) return;
    pointerCircleApplied = true;
    hideBrowserCursor();
    syncPointerDot();
}

function resetPointerCircleState() {
    pointerCircleApplied = false;
    showBrowserCursor();
    if (pointerDot) {
        pointerDot.classList.remove('visible');
    }
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
    const element = zoneElements[zoneKey];
    if (element) {
        element.classList.toggle(ZONE_HOVER_CLASS, hovered);
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
    if (state.awaitingStart) {
        return;
    }
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
    if (timerScoreDisplay) {
        timerScoreDisplay.textContent = `$${state.points}`;
    }
    if (timerOreDisplay) {
        timerOreDisplay.textContent = `${state.ore}⛰`;
    }
    
    // update upgrade zones
    if (strengthUpgradeSquare) {
        const cost = getUpgradeCost('strength');
        strengthUpgradeSquare.innerHTML = createCornerSquareLabel(
            '+1 power',
            `${getPointsLabel()}${cost}`
        );
    }
    if (radiusUpgradeSquare) {
        const cost = getUpgradeCost('radius');
        radiusUpgradeSquare.innerHTML = createCornerSquareLabel(
            '+1 range',
            `${getPointsLabel()}${cost}`
        );
    }
    if (numUpgradeSquare) {
        const cost = getUpgradeCost('num');
        numUpgradeSquare.innerHTML = createCornerSquareLabel(
            '+1 laser',
            `${getPointsLabel()}${cost}`
        );
    }
    // update ore converter with ratio
    if (oreConverter) {
        oreConverter.innerHTML = createCornerSquareLabel(
            'trade',
            `1⛰ : ${getPointsLabel()}${state.oreRatio}`
        );
    }
    updateUpgradeStatDisplays();
}

function createCornerSquareLabel(title, value) {
    return `<span class="square-label"><span class="square-title">${title}</span><span class="square-cost">${value}</span></span>`;
}

function getPointsLabel() {
    return '$';
}

function updateUpgradeStatDisplays() {
    if (strengthStatDisplay) {
        strengthStatDisplay.textContent = `power: ${formatPowerStatValue()}`;
    }
    if (radiusStatDisplay) {
        radiusStatDisplay.textContent = `range: ${formatRangeStatValue()}`;
    }
    if (numStatDisplay) {
        numStatDisplay.textContent = `lasers: ${getLaserCount()}`;
    }
}

function formatRangeStatValue() {
    const rangeLevel = state.upgradeLevels.radius || 1;
    return `${rangeLevel}`;
}

function formatPowerStatValue() {
    const normalizedPower = getMiningDamage() / 10;
    if (Number.isInteger(normalizedPower)) {
        return `${normalizedPower}`;
    }
    return normalizedPower.toFixed(2).replace(/\.?0+$/, '');
}

function formatElapsedTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const remainder = totalSeconds % 3600;
    const minutes = Math.floor(remainder / 60);
    const seconds = remainder % 60;
    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getElapsedTimeMs(now) {
    if (state.awaitingStart) {
        return 0;
    }
    if (state.frozen && state.frozenAt) {
        return state.frozenAt - state.gameStartTime;
    }
    const referenceTime = typeof now === 'number' ? now : performance.now();
    return referenceTime - state.gameStartTime;
}

function updateTimerDisplay(now) {
    if (!timerDisplay) {
        return;
    }
    const elapsed = getElapsedTimeMs(now);
    timerDisplay.textContent = formatElapsedTime(elapsed);
}

function updateShareScoreDisplay(visible) {
    if (!shareScoreMessage) {
        return;
    }
    if (visible) {
        shareScoreMessage.textContent = formatElapsedTime(getElapsedTimeMs());
        shareScoreMessage.classList.remove('hidden');
    } else {
        shareScoreMessage.textContent = '';
        shareScoreMessage.classList.add('hidden');
    }
}

function getWinShareText() {
    const elapsedLabel = formatElapsedTime(getElapsedTimeMs());
    return `OSIRIS\n${elapsedLabel}\n${OSIRIS_SHARE_URL}`;
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
        resetPointerToCenter();
    }
    if (state.starterActive && state.awaitingStart) {
        const starter = state.osirisField.find((osiris) => osiris.isStarter && !osiris.destroyed);
        if (starter) {
            const nextPosition = getStartTrianglePosition(starter.radius);
            starter.x = nextPosition.x;
            starter.y = nextPosition.y;
        }
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

    const rotation =
        typeof options.rotation === 'number'
            ? options.rotation
            : Math.random() * Math.PI * 2;
    const spin =
        typeof options.spin === 'number'
            ? options.spin
            : randRange(OSIRIS_SPIN.min, OSIRIS_SPIN.max);

    return {
        id: osirisIdCounter++,
        tierIndex,
        tierName: tier.name,
        sides: tier.sides,
        x: spawnData.x,
        y: spawnData.y,
        radius,
        rotation,
        spin,
        vx,
        vy,
        health,
        maxHealth: health,
        destroyed: false,
        isStarter: Boolean(options.isStarter),
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

function getStartTrianglePosition(radius) {
    const tier = OSIRIS_TIERS[START_TRIANGLE_TIER_INDEX] || OSIRIS_TIERS[0];
    const clampedRadius = typeof radius === 'number' ? clamp(radius, tier.size.min, tier.size.max) : tier.size.min;
    const fallback = {
        x: width / 2,
        y: Math.max(clampedRadius, height / 2 - START_TRIANGLE_FALLBACK_OFFSET),
    };
    if (!canvas || !timerDisplay) {
        return fallback;
    }
    const timerRect = timerDisplay.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    if (!timerRect || !canvasRect || !timerRect.width || !canvasRect.height) {
        return fallback;
    }
    const centerX = timerRect.left + timerRect.width / 2 - canvasRect.left;
    const centerY = timerRect.top + timerRect.height / 2 - canvasRect.top;
    const targetY = centerY - START_TRIANGLE_ABOVE_TIMER_OFFSET;
    const minX = clampedRadius;
    const maxX = Math.max(minX, width - clampedRadius);
    const minY = clampedRadius;
    const maxY = Math.max(minY, height - clampedRadius);
    return {
        x: clamp(centerX, minX, maxX),
        y: clamp(targetY, minY, maxY),
    };
}

function spawnStarterTriangle() {
    const tier = OSIRIS_TIERS[START_TRIANGLE_TIER_INDEX] || OSIRIS_TIERS[MAX_TIER_INDEX];
    const radius = randRange(tier.size.min, tier.size.max);
    const position = getStartTrianglePosition(radius);
    addOsirisFromTier(START_TRIANGLE_TIER_INDEX, {
        position,
        velocity: { vx: 0, vy: 0 },
        radius,
        health: START_TRIANGLE_HEALTH,
        rotation: Math.random() * Math.PI * 2,
        spin: randRange(OSIRIS_SPIN.min, OSIRIS_SPIN.max),
        isStarter: true,
    });
    state.starterActive = true;
}

function handleStarterDestroyed() {
    if (!state.awaitingStart || !state.starterActive) {
        return;
    }
    state.starterActive = false;
    exitAwaitingStartState();
    const now = performance.now();
    state.gameStartTime = now;
    state.lastOreRatioUpdate = now;
    state.nextOreRatioUpdate = now + getRandomOreRatioIntervalMs();
    spawnOsiris(now);
    updateTimerDisplay(now);
}

function spawnCollectibles(osiris, overrideCount) {
    const count = typeof overrideCount === 'number'
        ? overrideCount
        : Math.max(2, Math.round(randRange(2, 4)));
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
    if (osiris.isStarter) {
        spawnCollectibles(osiris, 1);
        if (state.mining.targets.has(osiris.id)) {
            state.mining.targets.delete(osiris.id);
        }
        handleStarterDestroyed();
        return;
    }
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
    const pointerCollisionRadius = pointerCircleApplied
        ? POINTER_DOT_COLLISION_RADIUS
        : CURSOR_COLLISION_RADIUS;
    for (const osiris of state.osirisField) {
        if (osiris.destroyed) continue;
        const dx = state.pointer.x - osiris.x;
        const dy = state.pointer.y - osiris.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= osiris.radius + pointerCollisionRadius) {
            freezeField('osiris impact');
            return;
        }
    }
}

function handleCollectiblePickup() {
    if (!state.pointer.active || state.frozen || !state.collectibles.length) return;
    const pointerRadius = pointerCircleApplied ? getPointerRadius() : CURSOR_COLLISION_RADIUS;
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
    if (state.awaitingStart) {
        state.oreConversionProgress = 0;
        return;
    }
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
    if (state.frozen || state.awaitingStart) {
        return;
    }

    if (!state.nextOreRatioUpdate) {
        state.nextOreRatioUpdate = now + getRandomOreRatioIntervalMs();
    }

    if (now >= state.nextOreRatioUpdate) {
        state.oreRatio = getRandomOreRatioValue();
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

    const pointerRadius = pointerCircleApplied ? getPointerRadius() : CURSOR_COLLISION_RADIUS;
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
    const waitingForStarter = state.awaitingStart && state.starterActive;
    if (state.frozen || (!waitingForStarter && state.awaitingStart) || !pointerCircleApplied) {
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
    ctx.setLineDash(POINTER_RING_DASH);
    ctx.beginPath();
    ctx.arc(state.pointer.x, state.pointer.y, getPointerRadius(), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    syncPointerDot();
}

function syncPointerDot() {
    if (!pointerDot) return;
    const shouldShow = shouldDisplayPointer();
    if (shouldShow) {
        pointerDot.style.left = `${state.pointer.x}px`;
        pointerDot.style.top = `${state.pointer.y}px`;
    }
    pointerDot.classList.toggle('visible', shouldShow);
}

function resetPointerToCenter() {
    state.pointer.x = width / 2;
    state.pointer.y = height / 2;
    state.pointer.active = false;
    state.pointer.locked = false;
}

function resetGame() {
    const nowTime = performance.now();
    state.osirisField = [];
    state.collectibles = [];
    state.frozen = false;
    state.frozenAt = null;
    setPlaySurfaceFrozen(false);
    resetPointerCircleState();
    state.nextSpawnAt = nowTime;
    lastFrame = nowTime;
    state.points = 0;
    state.totalScience = 0;
    state.ore = 0;
    state.oreRatio = getRandomOreRatioValue();
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
    state.starterActive = false;
    pointerInsideWrapper = isCursorHoveringWrapper();
    syncPointerDot();
    hideResetOverlay();
    spawnStarterTriangle();
    enterAwaitingStartState();
    updateTimerDisplay(nowTime);
}

function freezeField(reason) {
    if (state.frozen) return;
    releasePointerLock();
    state.frozen = true;
    state.frozenAt = performance.now();
    setPlaySurfaceFrozen(true);
    showBrowserCursor();
    state.nextOreRatioUpdate = 0;
    state.finishReason = reason || null;
    showWinShareButton();
    setMiningVisualsTransparent(true);
    clearMiningState();
    deactivateOreConverter();
    stopAllZoneInteractions();
    showResetOverlay();
    syncPointerDot();
    updateTimerDisplay(state.frozenAt);
}

function handleWrapperPointerEnter() {
    pointerInsideWrapper = true;
    syncPointerDot();
}

function handleWrapperPointerLeave(event) {
    if (!osirisWrapper || state.frozen || state.awaitingStart) {
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
    if (state.frozen || state.awaitingStart) return;
    if (!event.relatedTarget && !event.toElement) {
        freezeField('cursor left window');
    }
}

function handleBlur() {
    deactivateOreConverter();
    stopAllZoneInteractions();
    pointerInsideWrapper = false;
    syncPointerDot();
    if (!state.frozen && !state.awaitingStart) {
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
            if (!state.frozen && !state.awaitingStart) {
                freezeField('cursor left osiris wrapper');
            }
            return;
        }
        pointerInsideWrapper = true;
    } else if (locked) {
        pointerInsideWrapper = true;
    }
    updateVirtualPointerFromMouse(event);
    const awaitingStarter = state.awaitingStart && state.starterActive;
    if (!pointerCircleApplied && pointerInsideWrapper && (!state.awaitingStart || awaitingStarter)) {
        applyPointerCircle();
    }
}

function handlePointerLockChange() {
    const locked = document.pointerLockElement === canvas;
    state.pointer.locked = locked;
    if (locked) {
        pointerInsideWrapper = true;
        syncPointerDot();
        return;
    }
    if (!state.frozen && !state.awaitingStart) {
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

function handleStartButtonClick(event) {
    event.preventDefault();
    if (!isCursorHoveringWrapper()) {
        return;
    }
    resetGame();
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
    const canPlay = !state.frozen && !state.awaitingStart;
    const awaitingStarter = !state.frozen && state.awaitingStart && state.starterActive;

    if (canPlay || awaitingStarter) {
        updateOsiriss(delta);
    }

    if (canPlay) {
        updateCollectibles(delta);
        handleMining(delta);
        detectCollisions();
        handleCollectiblePickup();
        removeDestroyedOsiriss();

        if (now >= state.nextSpawnAt) {
            spawnOsiris(now);
        }
    } else if (awaitingStarter) {
        handleMining(delta);
    } else {
        clearMiningState();
    }

    if (canPlay) {
        handleUpgradeZones(delta);
        updateOreRatio(now);
        handleOreConversion(delta);
    }
    drawOsiriss();
    updateTimerDisplay(now);
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
if (startButton) {
    startButton.addEventListener('click', handleStartButtonClick);
}
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
hideStartOverlay();
if (osirisWrapper && typeof osirisWrapper.matches === 'function') {
    pointerInsideWrapper = osirisWrapper.matches(':hover');
}
syncPointerDot();

applyLineWidth(OSIRIS_LINE_WIDTH);
updateResourceDisplays();

resetGame();
requestAnimationFrame(loop);
