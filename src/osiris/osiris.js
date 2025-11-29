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
const timerDisplay = document.getElementById('osiris-timer');
const startOverlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');
const timerOreDisplay = document.getElementById('timer-ore-display');
const timerScoreDisplay = document.getElementById('timer-score-display');
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

const SPAWN_INTERVAL = { min: 3000, max: 5000 };
const OSIRIS_SPIN = { min: -2.2, max: 2.2 };
const OSIRIS_LINE_WIDTH = 3;
const MINING_DAMAGE_PER_SECOND = 5;
const CURSOR_COLLISION_RADIUS = 1;
const SPLIT_COUNT = 2;
const SPLIT_DIRECTION_VARIANCE = Math.PI / 6;
const ORE_CONVERSION_RATE = 1;
const UPGRADE_HOLD_DURATION = 1;
const STRENGTH_INCREMENT = 5;
const RADIUS_INCREMENT = 4;
const FLOCK_COUNT_BASE = 1;
const ORE_RATIO_UPDATE_INTERVAL = { min: 5000, max: 10000 };
const ORE_RATIO_VALUE_RANGE = { min: 1, max: 5 };
const DIFFICULTY_RAMP = 0.25;
const START_TRIANGLE_TIER_INDEX = 0;
const START_TRIANGLE_HEALTH = 1;
const FLOCK_MEMBER_RADIUS = 4;
const FLOCK_MEMBER_COLOR = '#000';
const FLOCK_MAX_SPEED = 260;
const FLOCK_MAX_FORCE = 520;
const FLOCK_NEIGHBOR_RADIUS = 90;
const FLOCK_SEPARATION_RADIUS = 28;
const FLOCK_COHESION_WEIGHT = 0.4;
const FLOCK_ALIGNMENT_WEIGHT = 0.3;
const FLOCK_SEPARATION_WEIGHT = 0.75;
const FLOCK_POINTER_WEIGHT = 1.2;
const FLOCK_CHASE_LERP = 4;
const FLOCK_OFFSET_RANGE = { min: 12, max: 48 };
const FLOCK_SPAWN_INTERVAL_MS = 1000;
const FLOCK_SENSOR_DISTANCE = 60;
const FLOCK_ATTACH_DISTANCE = 4;
const FLOCK_ATTACH_SURFACE_OFFSET = -FLOCK_MEMBER_RADIUS * 0.5;

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

const TIER_SPAWN_WEIGHTS = OSIRIS_TIERS.map(() => 1);
const TOTAL_TIER_WEIGHT = TIER_SPAWN_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const MAX_TIER_INDEX = OSIRIS_TIERS.length - 1;
const INITIAL_TIER_INDICES = [0, 1, 2];

const state = {
    osirisField: [],
    flockMembers: [],
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
    nextFlockSpawnAt: performance.now(),
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
        num: FLOCK_COUNT_BASE,
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
    starterFlockPending: false,
};

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;
let lastFrame = performance.now();
let osirisIdCounter = 0;
let flockIdCounter = 0;

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

function limitVector(vector, maxMagnitude) {
    const magnitude = Math.hypot(vector.x, vector.y);
    if (magnitude > maxMagnitude && magnitude > 0) {
        const scale = maxMagnitude / magnitude;
        vector.x *= scale;
        vector.y *= scale;
    }
    return vector;
}

function computeSteeringForce(desiredVector, member) {
    const desired = limitVector(
        {
            x: desiredVector.x,
            y: desiredVector.y,
        },
        FLOCK_MAX_SPEED
    );
    const steering = {
        x: desired.x - (member.vx || 0),
        y: desired.y - (member.vy || 0),
    };
    return limitVector(steering, FLOCK_MAX_FORCE);
}

function getFlockSpawnCount() {
    const config = UPGRADE_CONFIG.num || {};
    const cap = typeof config.maxValue === 'number' ? config.maxValue : Infinity;
    return Math.min(cap, state.upgrades.num);
}

function getMiningDamage() {
    return MINING_DAMAGE_PER_SECOND + state.upgrades.strength;
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

function applyLineWidth(widthValue) {
    document.documentElement.style.setProperty('--osiris-line-width', widthValue);
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
}

function exitAwaitingStartState() {
    if (!state.awaitingStart) return;
    state.awaitingStart = false;
    setPlaySurfaceAwaitingStart(false);
    hideStartOverlay();
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
        return getFlockSpawnCount() >= config.maxValue;
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
            '+1 flock',
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
}

function createCornerSquareLabel(title, value) {
    return `<span class="square-label"><span class="square-title">${title}</span><span class="square-cost">${value}</span></span>`;
}

function getPointsLabel() {
    return '$';
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

function getDifficultyMultiplier(now = performance.now()) {
    return 1 + ((now - state.gameStartTime) / 30000) * DIFFICULTY_RAMP;
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

    const difficultyMultiplier = getDifficultyMultiplier();

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
    const spawnInterval = randRange(SPAWN_INTERVAL.min, SPAWN_INTERVAL.max) / getDifficultyMultiplier(now);
    state.nextSpawnAt = now + spawnInterval;
}

function getStartTrianglePosition(radius) {
    const tier = OSIRIS_TIERS[START_TRIANGLE_TIER_INDEX] || OSIRIS_TIERS[0];
    const clampedRadius = typeof radius === 'number' ? clamp(radius, tier.size.min, tier.size.max) : tier.size.min;
    const centerX = width / 2;
    const centerY = height / 2;
    const minX = clampedRadius;
    const maxX = Math.max(minX, width - clampedRadius);
    const minY = clampedRadius;
    const maxY = Math.max(minY, height - clampedRadius);
    return {
        x: clamp(centerX, minX, maxX),
        y: clamp(centerY, minY, maxY),
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

function addOre(amount) {
    if (!Number.isFinite(amount)) {
        return;
    }
    const wholeAmount = Math.max(0, Math.floor(amount));
    if (!wholeAmount) {
        return;
    }
    state.ore += wholeAmount;
    updateResourceDisplays();
}

function awardOreFromOsiris(osiris, overrideCount) {
    if (!osiris) {
        return;
    }
    const oreCount =
        typeof overrideCount === 'number'
            ? overrideCount
            : Math.max(2, Math.round(randRange(2, 4)));
    addOre(oreCount);
}

function breakOsiris(osiris) {
    if (osiris.destroyed) return;
    osiris.destroyed = true;
    if (osiris.isStarter) {
        awardOreFromOsiris(osiris, 1);
        handleStarterDestroyed();
        return;
    }
    const nextTierIndex = osiris.tierIndex - 1;
    if (nextTierIndex >= 0) {
        const difficultyMultiplier = getDifficultyMultiplier();
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
        awardOreFromOsiris(osiris);
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
}

function spawnFlockMembers(count) {
    if (!count || !state.pointer) return;
    const baseX = state.pointer.active ? state.pointer.x : width / 2;
    const baseY = state.pointer.active ? state.pointer.y : height / 2;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = randRange(FLOCK_OFFSET_RANGE.min, FLOCK_OFFSET_RANGE.max);
        state.flockMembers.push({
            id: flockIdCounter++,
            x: clamp(baseX + Math.cos(angle) * distance, 0, width),
            y: clamp(baseY + Math.sin(angle) * distance, 0, height),
            vx: randRange(-20, 20),
            vy: randRange(-20, 20),
            chasingId: null,
            attachedToId: null,
            attachRadius: null,
            attachAngleOffset: null,
            destroyed: false,
        });
    }
}

function maybeSpawnFlockMembers(now) {
    if (
        state.frozen ||
        !state.pointer.active ||
        (state.awaitingStart && state.starterActive)
    ) {
        return;
    }
    if (!state.nextFlockSpawnAt) {
        state.nextFlockSpawnAt = now + FLOCK_SPAWN_INTERVAL_MS;
        return;
    }
    if (now < state.nextFlockSpawnAt) {
        return;
    }
    const spawnCount = Math.max(1, getFlockSpawnCount());
    spawnFlockMembers(spawnCount);
    state.nextFlockSpawnAt = now + FLOCK_SPAWN_INTERVAL_MS;
}

function tryAcquireFlockTarget(member) {
    let best = null;
    let closest = FLOCK_SENSOR_DISTANCE;
    for (const osiris of state.osirisField) {
        if (osiris.destroyed) continue;
        const dx = osiris.x - member.x;
        const dy = osiris.y - member.y;
        const distance = Math.max(0, Math.hypot(dx, dy) - osiris.radius);
        if (distance < closest) {
            closest = distance;
            best = osiris;
        }
    }
    return best;
}

function attachFlockMemberToOsiris(member, osiris) {
    member.attachedToId = osiris.id;
    member.chasingId = null;
    const dx = member.x - osiris.x;
    const dy = member.y - osiris.y;
    const attachRadius = Math.max(1, osiris.radius + FLOCK_ATTACH_SURFACE_OFFSET);
    const baseAngle = Math.atan2(dy, dx);
    member.attachRadius = attachRadius;
    member.attachAngleOffset = baseAngle - osiris.rotation;
    member.x = osiris.x + Math.cos(baseAngle) * attachRadius;
    member.y = osiris.y + Math.sin(baseAngle) * attachRadius;
    member.vx = 0;
    member.vy = 0;
}

function computeBoidAcceleration(member, pointerX, pointerY, pointerActive) {
    const alignment = { x: 0, y: 0 };
    const cohesion = { x: 0, y: 0 };
    const separation = { x: 0, y: 0 };
    let neighborCount = 0;
    let alignmentCount = 0;
    let separationCount = 0;

    for (const other of state.flockMembers) {
        if (other === member || other.destroyed) continue;
        if (typeof other.attachedToId === 'number') continue;
        if (typeof other.chasingId === 'number') continue;
        const dx = other.x - member.x;
        const dy = other.y - member.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0 || distance > FLOCK_NEIGHBOR_RADIUS) {
            continue;
        }
        neighborCount++;
        cohesion.x += other.x;
        cohesion.y += other.y;
        alignment.x += other.vx || 0;
        alignment.y += other.vy || 0;
        alignmentCount++;
        if (distance < FLOCK_SEPARATION_RADIUS) {
            separation.x -= dx / distance;
            separation.y -= dy / distance;
            separationCount++;
        }
    }

    const acceleration = { x: 0, y: 0 };
    if (neighborCount > 0) {
        cohesion.x = cohesion.x / neighborCount - member.x;
        cohesion.y = cohesion.y / neighborCount - member.y;
        const cohesionSteer = computeSteeringForce(
            { x: cohesion.x, y: cohesion.y },
            member
        );
        acceleration.x += cohesionSteer.x * FLOCK_COHESION_WEIGHT;
        acceleration.y += cohesionSteer.y * FLOCK_COHESION_WEIGHT;
    }

    if (alignmentCount > 0) {
        alignment.x /= alignmentCount;
        alignment.y /= alignmentCount;
        const alignmentSteer = computeSteeringForce(
            { x: alignment.x, y: alignment.y },
            member
        );
        acceleration.x += alignmentSteer.x * FLOCK_ALIGNMENT_WEIGHT;
        acceleration.y += alignmentSteer.y * FLOCK_ALIGNMENT_WEIGHT;
    }

    if (separationCount > 0) {
        separation.x /= separationCount;
        separation.y /= separationCount;
        const separationSteer = computeSteeringForce(
            { x: separation.x, y: separation.y },
            member
        );
        acceleration.x += separationSteer.x * FLOCK_SEPARATION_WEIGHT;
        acceleration.y += separationSteer.y * FLOCK_SEPARATION_WEIGHT;
    }

    const pointerDx = pointerX - member.x;
    const pointerDy = pointerY - member.y;
    const pointerDistance = Math.hypot(pointerDx, pointerDy);
    const pointerSteer = computeSteeringForce(
        {
            x: pointerDx,
            y: pointerDy,
        },
        member
    );
    const pointerDistanceScale = clamp(pointerDistance / 150, 0.35, 2.5);
    const pointerWeight = (pointerActive ? FLOCK_POINTER_WEIGHT : FLOCK_POINTER_WEIGHT * 0.4) * pointerDistanceScale;
    acceleration.x += pointerSteer.x * pointerWeight;
    acceleration.y += pointerSteer.y * pointerWeight;
    return acceleration;
}

function updateFlockMembers(delta) {
    if (!state.flockMembers.length) return;
    const pointerX = state.pointer.active ? state.pointer.x : width / 2;
    const pointerY = state.pointer.active ? state.pointer.y : height / 2;
    const pointerActive = state.pointer.active;

    for (const member of state.flockMembers) {
        if (member.destroyed) continue;

        if (typeof member.attachedToId === 'number') {
            const target = state.osirisField.find(
                (osiris) => !osiris.destroyed && osiris.id === member.attachedToId
            );
            if (!target) {
                member.destroyed = true;
                continue;
            }
            if (typeof member.attachRadius !== 'number') {
                member.attachRadius = Math.max(1, target.radius + FLOCK_ATTACH_SURFACE_OFFSET);
            }
            if (typeof member.attachAngleOffset !== 'number') {
                const fallbackDx = member.x - target.x;
                const fallbackDy = member.y - target.y;
                member.attachAngleOffset = Math.atan2(fallbackDy, fallbackDx) - target.rotation;
            }
            const attachAngle = target.rotation + member.attachAngleOffset;
            member.x = target.x + Math.cos(attachAngle) * member.attachRadius;
            member.y = target.y + Math.sin(attachAngle) * member.attachRadius;
            member.vx = 0;
            member.vy = 0;
            target.health -= getMiningDamage() * delta;
            if (target.health <= 0) {
                breakOsiris(target);
                member.destroyed = true;
            }
            continue;
        }

        let chasingTarget = null;
        if (typeof member.chasingId === 'number') {
            chasingTarget = state.osirisField.find(
                (osiris) => !osiris.destroyed && osiris.id === member.chasingId
            );
            if (!chasingTarget) {
                member.chasingId = null;
            }
        }

        if (!chasingTarget) {
            const acquired = tryAcquireFlockTarget(member);
            if (acquired) {
                member.chasingId = acquired.id;
                chasingTarget = acquired;
            }
        }

        if (chasingTarget) {
            const lerpSpeed = Math.min(1, FLOCK_CHASE_LERP * delta);
            const prevX = member.x;
            const prevY = member.y;
            member.x += (chasingTarget.x - member.x) * lerpSpeed;
            member.y += (chasingTarget.y - member.y) * lerpSpeed;
            const dx = chasingTarget.x - member.x;
            const dy = chasingTarget.y - member.y;
            const distance = Math.hypot(dx, dy);
            const surfaceDistance = distance - chasingTarget.radius;
            if (surfaceDistance <= FLOCK_ATTACH_DISTANCE) {
                attachFlockMemberToOsiris(member, chasingTarget);
            } else if (surfaceDistance > FLOCK_SENSOR_DISTANCE * 1.5) {
                member.chasingId = null;
            }
            const safeDelta = delta > 0 ? delta : 1 / 60;
            member.vx = (member.x - prevX) / safeDelta;
            member.vy = (member.y - prevY) / safeDelta;
        } else {
            member.vx = (member.vx || 0);
            member.vy = (member.vy || 0);
            const acceleration = computeBoidAcceleration(member, pointerX, pointerY, pointerActive);
            member.vx += acceleration.x * delta;
            member.vy += acceleration.y * delta;
            const limitedVelocity = limitVector(
                { x: member.vx, y: member.vy },
                FLOCK_MAX_SPEED
            );
            member.vx = limitedVelocity.x;
            member.vy = limitedVelocity.y;
            member.x += member.vx * delta;
            member.y += member.vy * delta;
        }

        member.x = clamp(member.x, 0, width);
        member.y = clamp(member.y, 0, height);
    }

    state.flockMembers = state.flockMembers.filter((member) => !member.destroyed);
}

function detectCollisions() {
    if (!state.pointer.active || state.frozen) return;
    const pointerCollisionRadius = CURSOR_COLLISION_RADIUS;
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

function removeDestroyedOsiriss() {
    if (!state.osirisField.length) return;
    const hasDestroyed = state.osirisField.some((osiris) => osiris.destroyed);
    if (!hasDestroyed) return;
    state.osirisField = state.osirisField.filter((osiris) => !osiris.destroyed);
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
    const rawInnerStrokeOpacity =
        (bodyStyle.getPropertyValue('--osiris-inner-stroke-opacity') ||
            rootStyle.getPropertyValue('--osiris-inner-stroke-opacity') ||
            '1')
            .trim();
    const parsedInnerStrokeOpacity = parseFloat(rawInnerStrokeOpacity);
    const innerStrokeOpacity = Number.isFinite(parsedInnerStrokeOpacity)
        ? clamp(parsedInnerStrokeOpacity, 0, 1)
        : 1;
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
        const prevGlobalAlpha = ctx.globalAlpha;
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = innerStrokeOpacity;
        ctx.fill();
        ctx.globalAlpha = prevGlobalAlpha;
        ctx.stroke();
    }
    drawFlockMembers();
}

function drawFlockMembers() {
    if (!state.flockMembers.length) return;
    ctx.save();
    ctx.fillStyle = FLOCK_MEMBER_COLOR;
    for (const member of state.flockMembers) {
        if (member.destroyed) continue;
        ctx.beginPath();
        ctx.arc(member.x, member.y, FLOCK_MEMBER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function resetPointerToCenter() {
    state.pointer.x = width / 2;
    state.pointer.y = height / 2;
    state.pointer.active = false;
    state.pointer.locked = false;
}

function resetGame() {
    const nowTime = performance.now();
    const cursorInsideWrapper = isCursorHoveringWrapper();
    pointerInsideWrapper = cursorInsideWrapper;
    state.osirisField = [];
    state.flockMembers = [];
    state.starterFlockPending = false;
    if (cursorInsideWrapper || document.pointerLockElement === canvas) {
    spawnFlockMembers(1);
    } else {
        state.starterFlockPending = true;
    }
    state.frozen = false;
    state.frozenAt = null;
    setPlaySurfaceFrozen(false);
    state.nextSpawnAt = nowTime;
    state.nextFlockSpawnAt = nowTime + FLOCK_SPAWN_INTERVAL_MS;
    lastFrame = nowTime;
    state.points = 0;
    state.totalScience = 0;
    state.ore = 0;
    state.oreRatio = getRandomOreRatioValue();
    state.gameStartTime = nowTime;
    state.lastOreRatioUpdate = nowTime;
    state.nextOreRatioUpdate = nowTime + getRandomOreRatioIntervalMs();
    state.oreConversionProgress = 0;
    state.upgrades.num = FLOCK_COUNT_BASE;
    state.upgrades.strength = 0;
    state.upgrades.radius = 0;
    state.upgradeLevels = {
        num: 1,
        strength: 1,
        radius: 1,
    };
    stopAllZoneInteractions();
    updateResourceDisplays();
    state.finishReason = null;
    hideWinShareButton();
    state.hasSpawnedInitialOsiris = false;
    state.starterActive = false;
    pointerInsideWrapper = isCursorHoveringWrapper();
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
    state.nextOreRatioUpdate = 0;
    state.finishReason = reason || null;
    showWinShareButton();
    deactivateOreConverter();
    stopAllZoneInteractions();
    showResetOverlay();
    updateTimerDisplay(state.frozenAt);
}

function maybeSpawnPendingStarterFlock() {
    if (!state.starterFlockPending) {
        return;
    }
    if (!state.awaitingStart || !state.starterActive) {
        state.starterFlockPending = false;
        return;
    }
    if (!pointerInsideWrapper && document.pointerLockElement !== canvas) {
        return;
    }
    spawnFlockMembers(1);
    state.starterFlockPending = false;
}

function handleWrapperPointerEnter() {
    pointerInsideWrapper = true;
    maybeSpawnPendingStarterFlock();
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
    freezeField('cursor left osiris wrapper');
}

function handleWindowLeave(event) {
    deactivateOreConverter();
    stopAllZoneInteractions();
    pointerInsideWrapper = false;
    if (state.frozen || state.awaitingStart) return;
    if (!event.relatedTarget && !event.toElement) {
        freezeField('cursor left window');
    }
}

function handleBlur() {
    deactivateOreConverter();
    stopAllZoneInteractions();
    pointerInsideWrapper = false;
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
            if (!state.frozen && !state.awaitingStart) {
                freezeField('cursor left osiris wrapper');
            }
            return;
        }
        pointerInsideWrapper = true;
        maybeSpawnPendingStarterFlock();
    } else if (locked) {
        pointerInsideWrapper = true;
        maybeSpawnPendingStarterFlock();
    }
    updateVirtualPointerFromMouse(event);
}

function handlePointerLockChange() {
    const locked = document.pointerLockElement === canvas;
    state.pointer.locked = locked;
    if (locked) {
        pointerInsideWrapper = true;
        maybeSpawnPendingStarterFlock();
        return;
    }
    if (!state.frozen && !state.awaitingStart) {
        pointerInsideWrapper = false;
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
        updateFlockMembers(delta);
    }

    if (canPlay) {
        detectCollisions();
        removeDestroyedOsiriss();

        if (now >= state.nextSpawnAt) {
            spawnOsiris(now);
        }
    }

    if (!state.frozen) {
        maybeSpawnFlockMembers(now);
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

applyLineWidth(OSIRIS_LINE_WIDTH);
updateResourceDisplays();

resetGame();
requestAnimationFrame(loop);
