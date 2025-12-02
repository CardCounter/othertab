const canvas = document.getElementById('flock-canvas');
const ctx = canvas.getContext('2d');
const resetButton = document.getElementById('reset-button');
const playSurface = document.querySelector('.play-surface');
const resetOverlay = document.getElementById('reset-overlay');
const flockWrapper = document.querySelector('.flock-wrapper');
const timerDisplay = document.getElementById('flock-timer');
const shareButton = document.getElementById('share-button');
const shareScoreMessage = document.getElementById('share-score');
const FLOCK_SHARE_URL = 'https://othertab.com/flock/';
let shareButtonResetTimeout = null;
let currentWinShareText = '';

const SPAWN_INTERVAL = { min: 1000, max: 3000 };
const ASTEROID_SPIN = { min: -2.2, max: 2.2 };
const ASTEROID_LINE_WIDTH = 3;
const MINING_DAMAGE_PER_SECOND = 1;
const CURSOR_COLLISION_RADIUS = 1;
const SPLIT_COUNT = 2;
const SPLIT_V_SEPARATION = Math.PI / 3;
const SPLIT_V_VARIANCE = Math.PI / 18;
const FLOCK_COUNT_BASE = 1;
const DIFFICULTY_RAMP = 0.25;
const TRIANGLE_TIER_INDEX = 0;
const TRIANGLE_BREAK_FLOCK_BONUS = 5;
const FLOCK_MEMBER_RADIUS = 4;
const FLOCK_FOLLOW_LERP = 7;
const FLOCK_ORBIT_SPEED = 10;
const FLOCK_CHASE_LERP = 7;
const FLOCK_OFFSET_RANGE = { min: 10, max: 50 };
const FLOCK_SPAWN_INTERVAL_MS = 1000;
const FLOCK_SENSOR_DISTANCE = 60;
const FLOCK_STREAM_INTERVAL_MS = 80;
const FLOCK_ATTACH_SURFACE_OFFSET = -FLOCK_MEMBER_RADIUS * 0.5;
const FLOCK_DAMAGE_BLINK_DURATION = 0.2;
const START_CURSOR_HOLD_MS = 600;
const START_CURSOR_EXTRA_MS = 1800;
const BORDER_BLINK_INTERVAL_MS = 300;

const ASTEROID_TIERS = [
    {
        name: 'triangle',
        sides: 3,
        size: { min: 15, max: 25 },
        speed: { min: 150, max: 300 },
        health: { min: 1, max: 10 },
    },
    {
        name: 'square',
        sides: 4,
        size: { min: 20, max: 35 },
        speed: { min: 120, max: 240 },
        health: { min: 2, max: 12 },
    },
    {
        name: 'pentagon',
        sides: 5,
        size: { min: 25, max: 45 },
        speed: { min: 100, max: 200 },
        health: { min: 4, max: 14 },
    },
    {
        name: 'hexagon',
        sides: 6,
        size: { min: 30, max: 55 },
        speed: { min: 90, max: 180 },
        health: { min: 6, max: 16 },
    },
    {
        name: 'heptagon',
        sides: 7,
        size: { min: 35, max: 75 },
        speed: { min: 70, max: 140 },
        health: { min: 8, max: 18 },
    },
    {
        name: 'octagon',
        sides: 8,
        size: { min: 40, max: 95 },
        speed: { min: 60, max: 120 },
        health: { min: 10, max: 20 },
    },
];

const MAX_TIER_INDEX = ASTEROID_TIERS.length - 1;
const OCTAGON_TIER_INDEX = (() => {
    const idx = ASTEROID_TIERS.findIndex((tier) => tier.name === 'octagon');
    return idx >= 0 ? idx : MAX_TIER_INDEX;
})();

const state = {
    osirisField: [],
    flockMembers: [],
    pointer: {
		x: 0,
		y: 0,
		active: false,
		locked: false,
		attackActive: false,
		attackStreamTimer: 0,
	},
    frozen: false,
    awaitingStart: false,
    finishReason: null,
    nextSpawnAt: performance.now(),
    nextFlockSpawnAt: performance.now(),
    lastFlockSpawnAt: performance.now(),
    gameStartTime: performance.now(),
    frozenAt: null,
    startHoldStartTime: null,
    startBlinkStartTime: null,
    lastBlinkToggleAt: null,
    blinkDashed: false,
};

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;
let pointerInsideWrapper = false;
let lastFrame = performance.now();
let osirisIdCounter = 0;
let flockIdCounter = 0;

function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getFlockSpawnCount() {
    return FLOCK_COUNT_BASE;
}

function getFlockSpawnIntervalMs(now = performance.now()) {
    const spawnRate = Math.max(1, getFlockSpawnCount());
    const difficultyMultiplier = getDifficultyMultiplier(now);
    return (FLOCK_SPAWN_INTERVAL_MS / spawnRate) / difficultyMultiplier;
}

function getMiningDamage() {
    return MINING_DAMAGE_PER_SECOND * getDifficultyMultiplier();
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

function getOsirisVertices(osiris) {
    const vertices = [];
    const step = (Math.PI * 2) / osiris.sides;
    for (let i = 0; i < osiris.sides; i++) {
        const angle = osiris.rotation + i * step;
        vertices.push({
            x: osiris.x + Math.cos(angle) * osiris.radius,
            y: osiris.y + Math.sin(angle) * osiris.radius,
        });
    }
    return vertices;
}

function raySegmentIntersection(origin, direction, start, end) {
    const s1x = end.x - start.x;
    const s1y = end.y - start.y;
    const s2x = direction.x;
    const s2y = direction.y;
    const denominator = -s2x * s1y + s1x * s2y;
    if (Math.abs(denominator) < 1e-8) {
        return null;
    }
    const s =
        (-s1y * (start.x - origin.x) + s1x * (start.y - origin.y)) /
        denominator;
    const t =
        (s2x * (start.y - origin.y) - s2y * (start.x - origin.x)) /
        denominator;
    if (s >= 0 && s <= 1 && t >= 0) {
        return {
            x: origin.x + t * s2x,
            y: origin.y + t * s2y,
            distance: t,
        };
    }
    return null;
}

function getOsirisSurfacePoint(osiris, angle) {
    const direction = {
        x: Math.cos(angle),
        y: Math.sin(angle),
    };
    const vertices = getOsirisVertices(osiris);
    let closestHit = null;
    let minDistance = Infinity;
    for (let i = 0; i < vertices.length; i++) {
        const start = vertices[i];
        const end = vertices[(i + 1) % vertices.length];
        const hit = raySegmentIntersection(osiris, direction, start, end);
        if (hit && hit.distance < minDistance) {
            minDistance = hit.distance;
            closestHit = hit;
        }
    }
    if (closestHit) {
        return closestHit;
    }
    return {
        x: osiris.x + direction.x * Math.max(1, osiris.radius + FLOCK_ATTACH_SURFACE_OFFSET),
        y: osiris.y + direction.y * Math.max(1, osiris.radius + FLOCK_ATTACH_SURFACE_OFFSET),
    };
}

function applyLineWidth(widthValue) {
    document.documentElement.style.setProperty('--flock-line-width', widthValue);
}

function setPlaySurfaceFrozen(frozen) {
    if (!playSurface) return;
    playSurface.classList.toggle('is-frozen', frozen);
}

function setPlaySurfaceLive(live) {
    if (!playSurface) return;
    playSurface.classList.toggle('is-live', live);
}

function setPlaySurfaceAwaitingStart(waiting) {
    if (!playSurface) return;
    playSurface.classList.toggle('is-awaiting-start', waiting);
}

function setPlaySurfaceBlinkStyle(dashed) {
    if (!playSurface) return;
    playSurface.classList.toggle('is-blink-dashed', dashed);
    playSurface.classList.toggle('is-blink-solid', !dashed);
}

function clearPlaySurfaceBlinkStyle() {
    if (!playSurface) return;
    playSurface.classList.remove('is-blink-dashed', 'is-blink-solid');
}

function resetStartCountdown() {
    state.startHoldStartTime = null;
    state.startBlinkStartTime = null;
    state.lastBlinkToggleAt = null;
    state.blinkDashed = false;
    clearPlaySurfaceBlinkStyle();
}

function beginStartBlinking(now) {
    state.startBlinkStartTime = now;
    state.lastBlinkToggleAt = now;
    state.blinkDashed = true;
    setPlaySurfaceBlinkStyle(true);
}

function updateStartBlinking(now) {
    if (!state.startBlinkStartTime) {
        return;
    }
    if (!state.lastBlinkToggleAt) {
        state.lastBlinkToggleAt = now;
    }
    if (now - state.lastBlinkToggleAt >= BORDER_BLINK_INTERVAL_MS) {
        state.blinkDashed = !state.blinkDashed;
        state.lastBlinkToggleAt = now;
        setPlaySurfaceBlinkStyle(state.blinkDashed);
    }
    if (now - state.startBlinkStartTime >= START_CURSOR_EXTRA_MS) {
        startGameplay(now);
    }
}

function updateAwaitingStartCountdown(now) {
    if (!state.awaitingStart) {
        return;
    }
    const pointerReady = pointerInsideWrapper || state.pointer.locked;
    if (!pointerReady) {
        resetStartCountdown();
        return;
    }
    if (!state.startHoldStartTime) {
        state.startHoldStartTime = now;
    }
    if (!state.startBlinkStartTime) {
        if (now - state.startHoldStartTime >= START_CURSOR_HOLD_MS) {
            beginStartBlinking(now);
        }
    } else {
        updateStartBlinking(now);
    }
}

function startGameplay(now = performance.now()) {
    exitAwaitingStartState();
    setPlaySurfaceLive(true);
    const startTime = typeof now === 'number' ? now : performance.now();
    state.gameStartTime = startTime;
    const flockSpawnInterval = getFlockSpawnIntervalMs(startTime);
    state.nextSpawnAt = startTime;
    state.lastFlockSpawnAt = startTime;
    state.nextFlockSpawnAt = startTime + flockSpawnInterval;
    spawnOsiris(startTime);
    spawnFlockMembers(FLOCK_COUNT_BASE);
    updateTimerDisplay(startTime);
}

function isCursorHoveringWrapper() {
    return Boolean(
        flockWrapper &&
        typeof flockWrapper.matches === 'function' &&
        flockWrapper.matches(':hover')
    );
}

function enterAwaitingStartState() {
    state.awaitingStart = true;
    setPlaySurfaceAwaitingStart(true);
    resetStartCountdown();
}

function exitAwaitingStartState() {
    state.awaitingStart = false;
    setPlaySurfaceAwaitingStart(false);
    resetStartCountdown();
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
    return `FLOCK\n${elapsedLabel}\n${FLOCK_SHARE_URL}`;
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

function spawnEdgeOctagons(count) {
    const spawnCount = Math.max(0, Math.floor(count));
    for (let i = 0; i < spawnCount; i++) {
        const spawnData = computeEdgeSpawn(0);
        addOsirisFromTier(OCTAGON_TIER_INDEX, {
            position: {
                x: spawnData.x,
                y: spawnData.y,
            },
            angle: spawnData.angle,
        });
    }
}

function getDifficultyMultiplier(now = performance.now()) {
    return 1 + ((now - state.gameStartTime) / 30000) * DIFFICULTY_RAMP;
}

function createOsirisFromTier(tierIndex, options = {}) {
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

    const health = options.health ?? randRange(tier.health.min, tier.health.max);

    const rotation =
        typeof options.rotation === 'number'
            ? options.rotation
            : Math.random() * Math.PI * 2;
    const spin =
        typeof options.spin === 'number'
            ? options.spin
            : randRange(ASTEROID_SPIN.min, ASTEROID_SPIN.max);

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
    addOsirisFromTier(OCTAGON_TIER_INDEX);
    const spawnInterval = randRange(SPAWN_INTERVAL.min, SPAWN_INTERVAL.max) / getDifficultyMultiplier(now);
    state.nextSpawnAt = now + spawnInterval;
}

function breakOsiris(osiris) {
    if (osiris.destroyed) return;
    osiris.destroyed = true;
    const nextTierIndex = osiris.tierIndex - 1;
    if (nextTierIndex >= 0) {
        const difficultyMultiplier = getDifficultyMultiplier();
        const tier = ASTEROID_TIERS[nextTierIndex];
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
            const spreadIndex =
                SPLIT_COUNT > 1 ? i - (SPLIT_COUNT - 1) / 2 : 0;
            const separation = spreadIndex * SPLIT_V_SEPARATION;
            const jitter = randRange(-SPLIT_V_VARIANCE, SPLIT_V_VARIANCE);
            const heading = baseHeading + separation + jitter;
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
        spawnEdgeOctagons(2);
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
        const orbitSpeed = randRange(-FLOCK_ORBIT_SPEED, FLOCK_ORBIT_SPEED);
        state.flockMembers.push({
            id: flockIdCounter++,
            x: clamp(baseX + Math.cos(angle) * distance, 0, width),
            y: clamp(baseY + Math.sin(angle) * distance, 0, height),
            orbitAngle: angle,
            orbitRadius: distance,
            orbitSpeed,
            chasingId: null,
            attachedToId: null,
            attachRadius: null,
            attachAngleOffset: null,
            damageTickTimer: 0,
            blinkTimer: 0,
            destroyed: false,
        });
    }
}

function maybeSpawnFlockMembers(now) {
    if (
        state.frozen ||
        !state.pointer.active ||
        state.awaitingStart
    ) {
        return;
    }
    const spawnInterval = getFlockSpawnIntervalMs(now);
    if (!state.nextFlockSpawnAt) {
        state.lastFlockSpawnAt = now;
        state.nextFlockSpawnAt = now + spawnInterval;
        return;
    }
    if (
        typeof state.lastFlockSpawnAt === 'number' &&
        state.lastFlockSpawnAt + spawnInterval < state.nextFlockSpawnAt
    ) {
        state.nextFlockSpawnAt = state.lastFlockSpawnAt + spawnInterval;
    }
    if (now < state.nextFlockSpawnAt) {
        return;
    }
    spawnFlockMembers(1);
    state.lastFlockSpawnAt = now;
    state.nextFlockSpawnAt = now + spawnInterval;
}

function tryAcquireFlockTarget(member, maxDistance = FLOCK_SENSOR_DISTANCE) {
    let best = null;
    let closest = maxDistance;
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

function tryAttachOnContact(member) {
    if (typeof member.attachedToId === 'number') {
        return false;
    }
    for (const osiris of state.osirisField) {
        if (osiris.destroyed) continue;
        const dx = osiris.x - member.x;
        const dy = osiris.y - member.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= osiris.radius + FLOCK_MEMBER_RADIUS) {
            attachFlockMemberToOsiris(member, osiris);
            return true;
        }
    }
    return false;
}

function sendRandomMemberToAsteroid() {
    const candidates = state.flockMembers.filter(
        (member) =>
            !member.destroyed &&
            typeof member.attachedToId !== 'number' &&
            typeof member.chasingId !== 'number'
    );
    if (!candidates.length || !state.osirisField.length) {
        return false;
    }
    const member =
        candidates[Math.floor(Math.random() * candidates.length)];
    const target = tryAcquireFlockTarget(member, Infinity);
    if (!target) {
        return false;
    }
    member.chasingId = target.id;
    return true;
}

function alignMemberToOsirisSurface(member, osiris, angleOverride) {
    let angle = angleOverride;
    if (typeof angle !== 'number') {
        const dx = member.x - osiris.x;
        const dy = member.y - osiris.y;
        angle = Math.atan2(dy, dx);
    }
    if (!Number.isFinite(angle)) {
        angle = osiris.rotation;
    }
    const surfacePoint = getOsirisSurfacePoint(osiris, angle);
    const surfaceDistance = Math.hypot(surfacePoint.x - osiris.x, surfacePoint.y - osiris.y);
    const attachRadius = Math.max(1, surfaceDistance + FLOCK_ATTACH_SURFACE_OFFSET);
    member.attachRadius = attachRadius;
    member.attachAngleOffset = angle - osiris.rotation;
    member.x = osiris.x + Math.cos(angle) * attachRadius;
    member.y = osiris.y + Math.sin(angle) * attachRadius;
}

function attachFlockMemberToOsiris(member, osiris) {
    member.attachedToId = osiris.id;
    member.chasingId = null;
    member.damageTickTimer = 1;
    alignMemberToOsirisSurface(member, osiris);
}

function triggerFlockDamageBlink(member) {
    member.blinkTimer = FLOCK_DAMAGE_BLINK_DURATION;
}

function updateFlockMembers(delta) {
    if (!state.flockMembers.length) return;
    const pointerX = state.pointer.active ? state.pointer.x : width / 2;
    const pointerY = state.pointer.active ? state.pointer.y : height / 2;
    const attackActive = !!state.pointer.attackActive;
    if (attackActive) {
        state.pointer.attackStreamTimer -= delta * 1000;
        if (state.pointer.attackStreamTimer <= 0) {
            sendRandomMemberToAsteroid();
            state.pointer.attackStreamTimer = FLOCK_STREAM_INTERVAL_MS;
        }
    } else {
        state.pointer.attackStreamTimer = 0;
    }

    for (const member of state.flockMembers) {
        if (member.destroyed) continue;

        if (typeof member.blinkTimer !== 'number') {
            member.blinkTimer = 0;
        } else if (member.blinkTimer > 0) {
            member.blinkTimer = Math.max(0, member.blinkTimer - delta);
        }
        if (typeof member.damageTickTimer !== 'number') {
            member.damageTickTimer = 0;
        }

        const attachedToOsiris = typeof member.attachedToId === 'number';

        if (attachedToOsiris) {
            const target = state.osirisField.find(
                (osiris) => !osiris.destroyed && osiris.id === member.attachedToId
            );
            if (!target) {
                member.destroyed = true;
                continue;
            }
            if (
                typeof member.attachRadius !== 'number' ||
                typeof member.attachAngleOffset !== 'number'
            ) {
                alignMemberToOsirisSurface(member, target);
            }
            const attachAngle = target.rotation + member.attachAngleOffset;
            member.x = target.x + Math.cos(attachAngle) * member.attachRadius;
            member.y = target.y + Math.sin(attachAngle) * member.attachRadius;
            member.damageTickTimer += delta;
            while (member.damageTickTimer >= 1 && !member.destroyed) {
                member.damageTickTimer -= 1;
                target.health -= getMiningDamage();
                triggerFlockDamageBlink(member);
                if (target.health <= 0) {
                    breakOsiris(target);
                    member.destroyed = true;
                    break;
                }
            }
            continue;
        }

        member.damageTickTimer = 0;

        if (tryAttachOnContact(member)) {
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

        if (chasingTarget) {
            const lerpSpeed = Math.min(1, FLOCK_CHASE_LERP * delta);
            member.x += (chasingTarget.x - member.x) * lerpSpeed;
            member.y += (chasingTarget.y - member.y) * lerpSpeed;
        } else {
            if (typeof member.orbitAngle !== 'number') {
                member.orbitAngle = Math.random() * Math.PI * 2;
            }
            if (typeof member.orbitRadius !== 'number') {
                member.orbitRadius = randRange(FLOCK_OFFSET_RANGE.min, FLOCK_OFFSET_RANGE.max);
            }
            if (typeof member.orbitSpeed !== 'number') {
                member.orbitSpeed = randRange(-FLOCK_ORBIT_SPEED, FLOCK_ORBIT_SPEED);
            }
            member.orbitAngle += member.orbitSpeed * delta;
            const offsetX = Math.cos(member.orbitAngle) * member.orbitRadius;
            const offsetY = Math.sin(member.orbitAngle) * member.orbitRadius;
            const targetX = pointerX + offsetX;
            const targetY = pointerY + offsetY;
            const lerpSpeed = Math.min(1, FLOCK_FOLLOW_LERP * delta);
            member.x += (targetX - member.x) * lerpSpeed;
            member.y += (targetY - member.y) * lerpSpeed;
        }

        if (tryAttachOnContact(member)) {
            continue;
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
            freezeField('flock impact');
            return;
        }
    }
}

function removeDestroyedOsiriss() {
    if (!state.osirisField.length) return;
    const hasDestroyed = state.osirisField.some((osiris) => osiris.destroyed);
    if (!hasDestroyed) return;
    state.osirisField = state.osirisField.filter((osiris) => !osiris.destroyed);
}

function resolveCssValue(bodyStyle, rootStyle, property, fallbackValue) {
    const primary = bodyStyle ? bodyStyle.getPropertyValue(property) : '';
    const secondary = rootStyle ? rootStyle.getPropertyValue(property) : '';
    return (primary && primary.trim()) || (secondary && secondary.trim()) || fallbackValue;
}

function drawOsiriss() {
    ctx.clearRect(0, 0, width, height);
    const bodyStyle = getComputedStyle(document.body);
    const rootStyle = getComputedStyle(document.documentElement);
    ctx.lineWidth =
        parseFloat(bodyStyle.getPropertyValue('--flock-line-width')) ||
        parseFloat(rootStyle.getPropertyValue('--flock-line-width')) ||
        ASTEROID_LINE_WIDTH;
    const strokeColor =
        (bodyStyle.getPropertyValue('--flock-stroke') ||
            rootStyle.getPropertyValue('--flock-stroke') ||
            rootStyle.getPropertyValue('--flock-accent') ||
            '#000')
            .trim();
    ctx.strokeStyle = strokeColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const rawInnerStrokeOpacity =
        (bodyStyle.getPropertyValue('--flock-inner-stroke-opacity') ||
            rootStyle.getPropertyValue('--flock-inner-stroke-opacity') ||
            '1')
            .trim();
    const parsedInnerStrokeOpacity = parseFloat(rawInnerStrokeOpacity);
    const innerStrokeOpacity = Number.isFinite(parsedInnerStrokeOpacity)
        ? clamp(parsedInnerStrokeOpacity, 0, 1)
        : 1;
    const flockTextColor = resolveCssValue(bodyStyle, rootStyle, '--flock-text', '#000');
    const flockBackgroundColor = resolveCssValue(bodyStyle, rootStyle, '--flock-bg', '#fff');
    for (const osiris of state.osirisField) {
        if (osiris.destroyed) continue;
        const points = getOsirisVertices(osiris);

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        const prevGlobalAlpha = ctx.globalAlpha;
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = innerStrokeOpacity;
        ctx.fill();
        ctx.globalAlpha = prevGlobalAlpha;
        ctx.stroke();
    }
    drawFlockMembers(flockTextColor, flockBackgroundColor);
}

function drawFlockMembers(textColor, backgroundColor) {
    if (!state.flockMembers.length) return;
    ctx.save();
    for (const member of state.flockMembers) {
        if (member.destroyed) continue;
        const blinkTimer = typeof member.blinkTimer === 'number' ? member.blinkTimer : 0;
        const showBackground =
            blinkTimer > 0 && blinkTimer > FLOCK_DAMAGE_BLINK_DURATION * 0.5;
        ctx.fillStyle = showBackground ? backgroundColor : textColor;
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
    state.pointer.attackActive = false;
    state.pointer.attackStreamTimer = 0;
}

function resetGame() {
    const nowTime = performance.now();
    pointerInsideWrapper = isCursorHoveringWrapper();
    state.pointer.attackActive = false;
    state.pointer.attackStreamTimer = 0;
    state.osirisField = [];
    state.flockMembers = [];
    state.gameStartTime = nowTime;
    state.frozen = false;
    state.frozenAt = null;
    setPlaySurfaceFrozen(false);
    clearPlaySurfaceBlinkStyle();
    setPlaySurfaceLive(false);
    const flockSpawnInterval = getFlockSpawnIntervalMs(nowTime);
    state.nextSpawnAt = nowTime;
    state.lastFlockSpawnAt = nowTime;
    state.nextFlockSpawnAt = nowTime + flockSpawnInterval;
    lastFrame = nowTime;
    state.finishReason = null;
    hideWinShareButton();
    pointerInsideWrapper = isCursorHoveringWrapper();
    hideResetOverlay();
    enterAwaitingStartState();
    updateTimerDisplay(nowTime);
}

function freezeField(reason) {
    if (state.frozen) return;
    releasePointerLock();
    state.pointer.attackActive = false;
    state.pointer.attackStreamTimer = 0;
    state.frozen = true;
    state.frozenAt = performance.now();
    setPlaySurfaceLive(false);
    setPlaySurfaceFrozen(true);
    setPlaySurfaceAwaitingStart(false);
    resetStartCountdown();
    state.finishReason = reason || null;
    showWinShareButton();
    showResetOverlay();
    updateTimerDisplay(state.frozenAt);
}

function handleWrapperPointerEnter(event) {
    pointerInsideWrapper = true;
    if (
        !state.pointer.locked &&
        event &&
        typeof event.clientX === 'number' &&
        typeof event.clientY === 'number'
    ) {
        updateVirtualPointerFromMouse(event);
    }
    if (state.awaitingStart && !state.startHoldStartTime) {
        state.startHoldStartTime = performance.now();
    }
}

function handleWrapperPointerLeave(event) {
    if (!flockWrapper) {
        return;
    }
    if (document.pointerLockElement === canvas) {
        return;
    }
    const nextTarget = event.relatedTarget;
    if (nextTarget && flockWrapper.contains(nextTarget)) {
        return;
    }
    pointerInsideWrapper = false;
    if (state.awaitingStart) {
        resetStartCountdown();
        return;
    }
    if (state.frozen) {
        return;
    }
    freezeField('cursor left flock wrapper');
}

function handleWindowLeave(event) {
    pointerInsideWrapper = false;
    if (state.awaitingStart) {
        resetStartCountdown();
        return;
    }
    if (state.frozen) return;
    if (!event.relatedTarget && !event.toElement) {
        freezeField('cursor left window');
    }
}

function handleBlur() {
    pointerInsideWrapper = false;
    if (state.awaitingStart) {
        resetStartCountdown();
        return;
    }
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
    if (!flockWrapper || typeof clientX !== 'number' || typeof clientY !== 'number') {
        return true;
    }
    const rect = flockWrapper.getBoundingClientRect();
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
    if (!locked && flockWrapper) {
        const inside = isPointerWithinWrapper(event.clientX, event.clientY);
        if (!inside) {
            pointerInsideWrapper = false;
            if (state.awaitingStart) {
                resetStartCountdown();
            } else if (!state.frozen) {
                freezeField('cursor left flock wrapper');
            }
            return;
        }
        pointerInsideWrapper = true;
        if (state.awaitingStart && !state.startHoldStartTime) {
            state.startHoldStartTime = performance.now();
        }
    } else if (locked) {
        pointerInsideWrapper = true;
        if (state.awaitingStart && !state.startHoldStartTime) {
            state.startHoldStartTime = performance.now();
        }
    }
    updateVirtualPointerFromMouse(event);
}

function handlePointerLockChange() {
    const locked = document.pointerLockElement === canvas;
    state.pointer.locked = locked;
    if (locked) {
        pointerInsideWrapper = true;
        if (state.awaitingStart && !state.startHoldStartTime) {
            state.startHoldStartTime = performance.now();
        }
        return;
    }
    state.pointer.attackActive = false;
    state.pointer.attackStreamTimer = 0;
    pointerInsideWrapper = false;
    if (state.awaitingStart) {
        resetStartCountdown();
        return;
    }
    if (!state.frozen) {
        freezeField('cursor left flock wrapper');
    }
}

function requestPointerLock() {
    if (canvas && canvas.requestPointerLock && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    }
}

function handleCanvasPointerDown(event) {
    if (event.button === 0) {
        state.pointer.attackActive = true;
    }
    requestPointerLock();
}

function handlePointerAttackRelease(event) {
    if (event.button === 0) {
        state.pointer.attackActive = false;
        state.pointer.attackStreamTimer = 0;
    }
}

function handleMouseAttackStart(event) {
    if (event.button !== 0) return;
    if (
        pointerInsideWrapper ||
        document.pointerLockElement === canvas
    ) {
        state.pointer.attackActive = true;
        state.pointer.attackStreamTimer = 0;
    }
}

function handleAttackKeyDown(event) {
    if (event.code !== 'Space') {
        return;
    }
    if (!state.pointer.attackActive) {
        state.pointer.attackActive = true;
        state.pointer.attackStreamTimer = 0;
    }
    event.preventDefault();
}

function handleAttackKeyUp(event) {
    if (event.code === 'Space') {
        state.pointer.attackActive = false;
        state.pointer.attackStreamTimer = 0;
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
    const canPlay = !state.frozen && !state.awaitingStart;
    updateAwaitingStartCountdown(now);

    if (canPlay) {
        updateOsiriss(delta);
    }

    if (!state.frozen) {
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
    drawOsiriss();
    updateTimerDisplay(now);
    requestAnimationFrame(loop);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
if (flockWrapper) {
    flockWrapper.addEventListener('pointerenter', handleWrapperPointerEnter, { passive: true });
    flockWrapper.addEventListener('pointerleave', handleWrapperPointerLeave, { passive: true });
}
window.addEventListener('mousemove', handlePointerMovement, { passive: true });
document.addEventListener('mouseleave', handleWindowLeave, { passive: true });
window.addEventListener('blur', handleBlur);
document.addEventListener('pointerlockchange', handlePointerLockChange);
if (canvas) {
    canvas.addEventListener('pointerdown', handleCanvasPointerDown);
}
window.addEventListener('pointerup', handlePointerAttackRelease, { passive: true });
window.addEventListener('pointercancel', handlePointerAttackRelease, { passive: true });
window.addEventListener('mousedown', handleMouseAttackStart, { passive: true });
window.addEventListener('contextmenu', handleContextMenu);
window.addEventListener('keydown', handleAttackKeyDown);
window.addEventListener('keyup', handleAttackKeyUp);
window.addEventListener('keydown', handleResetKeys);
resetButton.addEventListener('click', resetGame);
if (shareButton) {
    shareButton.addEventListener('click', handleShareButtonClick);
}
hideResetOverlay();
if (flockWrapper && typeof flockWrapper.matches === 'function') {
    pointerInsideWrapper = flockWrapper.matches(':hover');
}

applyLineWidth(ASTEROID_LINE_WIDTH);

resetGame();
requestAnimationFrame(loop);
