function loadMatterLibrary() {
    if (window.Matter) {
        return Promise.resolve(window.Matter);
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = true;
        script.src = new URL('../scripts/matter.min.js', import.meta.url).href;
        script.onload = () => resolve(window.Matter);
        script.onerror = () => reject(new Error('failed to load matter.js'));
        document.head.appendChild(script);
    });
}

loadMatterLibrary().then((MatterLib) => {
const canvas = document.getElementById('space-canvas');
const ctx = canvas.getContext('2d');

const { Engine, World, Bodies, Body } = MatterLib;

const creditChip = document.getElementById('credit-chip');
const towerChip = document.getElementById('tower-chip');
const roundChip = document.getElementById('round-chip');
const shareButton = document.getElementById('share-button');
const banner = document.getElementById('banner');
const bannerTitle = document.getElementById('banner-title');
const bannerBody = document.getElementById('banner-body');
const shopPanel = document.getElementById('shop-panel');
const shopCredits = document.getElementById('shop-credits');
const shopRoundLabel = document.getElementById('shop-round-label');
const placementHint = document.getElementById('placement-hint');
const buyTowerButton = document.getElementById('buy-tower');
const startButton = document.getElementById('start-button');
const resetButton = document.getElementById('reset-button');

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;

const shapeOrder = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'heptagon', 'octagon'];
const shapeSides = {
    circle: 32,
    triangle: 3,
    square: 4,
    pentagon: 5,
    hexagon: 6,
    heptagon: 7,
    octagon: 8,
};
const nextShape = {
    octagon: 'heptagon',
    heptagon: 'hexagon',
    hexagon: 'pentagon',
    pentagon: 'square',
    square: 'triangle',
    triangle: 'circle',
};
const shapeRadius = {
    circle: 10,
    triangle: 20,
    square: 30,
    pentagon: 40,
    hexagon: 50,
    heptagon: 75,
    octagon: 100,
};
const baseSpeed = {
    circle: 1,
    triangle: 1,
    square: 1,
    pentagon: 1,
    hexagon: 1,
    heptagon: 1,
    octagon: 1,
};

const player = {
    x: width / 2,
    y: height / 2,
    radius: 12,
    hasMoved: false,
};

const engine = Engine.create();
engine.gravity.x = 0;
engine.gravity.y = 0;

const state = {
    round: 1,
    credits: 0,
    playing: false,
    gameOver: false,
    shopOpen: true,
    pendingTowers: 0,
    asteroids: [],
    towers: [],
    effects: [],
    shareText: '',
};

let lastTime = performance.now();
let bannerTimeout = null;
const FIXED_TIMESTEP = 1 / 60;
const MAX_SUBSTEPS = 5;
let physicsAccumulator = 0;

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function makeId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function spinForShape(shape) {
    const idx = shapeOrder.indexOf(shape);
    const scale = clamp(1 - idx / shapeOrder.length, 0.25, 1);
    return randRange(-1.5, 1.5) * scale;
}

function weightedShapeForRound(round) {
    const maxIndex = Math.min(shapeOrder.length - 1, Math.floor((round + 1) / 2) + 1);
    const weights = [];
    let total = 0;
    for (let i = 0; i <= maxIndex; i++) {
        const shape = shapeOrder[i];
        const progress = clamp(round / 10, 0, 1);
        const largeBoost = 1 + progress * (i / maxIndex) * 1.5;
        const smallTilt = (maxIndex - i + 1) ** 1.4;
        const weight = smallTilt * largeBoost;
        weights.push(weight);
        total += weight;
    }
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
            return shapeOrder[i];
        }
    }
    return shapeOrder[Math.min(maxIndex, shapeOrder.length - 1)];
}

function createAsteroid(shape, x, y, angle, speed) {
    const radius = shapeRadius[shape];
    const sides = shapeSides[shape];
    const options = {
        frictionAir: 0,
        friction: 0,
        frictionStatic: 0,
        restitution: 0.9,
        inertia: Infinity,
        label: `asteroid-${shape}`,
    };
    const body =
        shape === 'circle'
            ? Bodies.circle(x, y, radius, options)
            : Bodies.polygon(x, y, sides, radius, options);

    Body.setVelocity(body, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
    });
    Body.setAngularVelocity(body, spinForShape(shape));
    World.add(engine.world, body);

    return {
        shape,
        body,
        radius,
        wraps: 0,
        collected: false,
        id: makeId(),
    };
}

function spawnAsteroid(shapeOverride) {
    const shape = shapeOverride || weightedShapeForRound(state.round);
    const radius = shapeRadius[shape];
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    const speed = baseSpeed[shape] * randRange(0.9, 1.2) * (1 + (state.round - 1) * 0.07);
    const pushAngle = Math.atan2(height / 2 - randRange(0, height), width / 2 - randRange(0, width));

    switch (side) {
        case 0: // top
            x = randRange(0, width);
            y = -radius - 4;
            break;
        case 1: // bottom
            x = randRange(0, width);
            y = height + radius + 4;
            break;
        case 2: // left
            x = -radius - 4;
            y = randRange(0, height);
            break;
        default: // right
            x = width + radius + 4;
            y = randRange(0, height);
            break;
    }

    const angle = pushAngle + randRange(-0.6, 0.6);
    const asteroid = createAsteroid(shape, x, y, angle, speed);
    state.asteroids.push(asteroid);
}

function spawnWave() {
    clearAsteroids();
    const minCount = 3 + Math.floor((state.round - 1) / 2);
    const maxCount = clamp(Math.floor(5 + state.round * 1.4), minCount + 1, 20);
    const count = clamp(Math.floor(randRange(minCount, maxCount + 1)), minCount, maxCount);

    for (let i = 0; i < count; i++) {
        spawnAsteroid();
    }
}

function destroyAsteroid(asteroid) {
    if (asteroid.dead) {
        return;
    }
    asteroid.dead = true;
    World.remove(engine.world, asteroid.body);
}

function clearAsteroids() {
    state.asteroids.forEach((asteroid) => destroyAsteroid(asteroid));
    state.asteroids.length = 0;
}

function updateChips() {
    creditChip.textContent = `credits: ${state.credits}`;
    shopCredits.textContent = state.credits;
    towerChip.textContent = `towers: ${state.towers.length}`;
    roundChip.textContent = `round ${state.round}`;
    shopRoundLabel.textContent = `round ${state.round} prep`;
}

function setBanner(title, body, duration = 2000) {
    bannerTitle.textContent = title;
    bannerBody.textContent = body;
    banner.classList.remove('hidden');
    if (bannerTimeout) {
        clearTimeout(bannerTimeout);
    }
    bannerTimeout = setTimeout(() => {
        banner.classList.add('hidden');
    }, duration);
}

function openShop({ reason = '', force = false, afterDeath = false } = {}) {
    state.shopOpen = true;
    shopPanel.classList.remove('hidden');
    placementHint.textContent = state.pendingTowers > 0 ? 'click anywhere to drop the new gun' : '';
    startButton.disabled = afterDeath;
    if (afterDeath) {
        startButton.classList.add('subtle');
    } else {
        startButton.classList.remove('subtle');
    }
    if (reason) {
        setBanner('hangar open', reason, 2200);
    }
    if (force) {
        state.pendingTowers = 0;
    }
}

function closeShop() {
    state.shopOpen = false;
    shopPanel.classList.add('hidden');
    placementHint.textContent = '';
}

function resetRun() {
    state.round = 1;
    state.credits = 0;
    clearAsteroids();
    state.effects = [];
    state.towers = [];
    state.pendingTowers = 0;
    state.playing = false;
    state.gameOver = false;
    shareButton.classList.add('hidden');
    setBanner('reset', 'fresh drift loaded');
    updateChips();
    openShop({ reason: 'new seed, round 1', force: true });
}

function breakAsteroid(target) {
    const next = nextShape[target.shape];
    if (!next) {
        return;
    }

    const fragments = 2;
    const origin = { x: target.body.position.x, y: target.body.position.y };

    destroyAsteroid(target);

    for (let i = 0; i < fragments; i++) {
        const angle = randRange(0, Math.PI * 2);
        const mag = randRange(0.65, 1.1);
        const velocityScale = (1 + (state.round - 1) * 0.05);
        const speed = baseSpeed[next] * mag * velocityScale;
        const asteroid = createAsteroid(
            next,
            origin.x + randRange(-3, 3),
            origin.y + randRange(-3, 3),
            angle,
            speed
        );
        state.asteroids.push(asteroid);
    }
}

function fireTower(tower, target) {
    tower.cooldown = 2;
    const pos = target.body.position;
    const beam = {
        type: 'beam',
        x1: tower.x,
        y1: tower.y,
        x2: pos.x,
        y2: pos.y,
        life: 0.2,
    };
    state.effects.push(beam);
    breakAsteroid(target);
}

function updateTowers(dt) {
    if (state.towers.length === 0) {
        return;
    }

    const harmful = state.asteroids.filter((a) => a.shape !== 'circle' && !a.dead);

    for (const tower of state.towers) {
        tower.cooldown -= dt;
        let target = null;
        if (harmful.length > 0) {
            target = harmful.reduce((closest, asteroid) => {
                const pos = asteroid.body.position;
                const dx = pos.x - tower.x;
                const dy = pos.y - tower.y;
                const dist = Math.hypot(dx, dy);
                return !closest || dist < closest.dist ? { asteroid, dist } : closest;
            }, null);
            if (target) {
                const pos = target.asteroid.body.position;
                tower.angle = Math.atan2(pos.y - tower.y, pos.x - tower.x);
                if (tower.cooldown <= 0) {
                    fireTower(tower, target.asteroid);
                }
            }
        }
    }
}

function awardCircle(circle) {
    if (circle.collected) {
        return;
    }
    circle.collected = true;
    state.credits += 1;
    updateChips();
}

function updateAsteroids(dt) {
    physicsAccumulator = Math.min(physicsAccumulator + dt, FIXED_TIMESTEP);
    while (physicsAccumulator >= FIXED_TIMESTEP) {
        Engine.update(engine, FIXED_TIMESTEP * 1000);
        physicsAccumulator -= FIXED_TIMESTEP;
    }

    for (const asteroid of state.asteroids) {
        if (asteroid.dead) continue;
        const { body, radius } = asteroid;
        let wrapped = false;
        let { x, y } = body.position;

        if (x < -radius) {
            Body.setPosition(body, { x: width + radius, y });
            wrapped = true;
        } else if (x > width + radius) {
            Body.setPosition(body, { x: -radius, y });
            wrapped = true;
        }

        ({ x, y } = body.position);

        if (y < -radius) {
            Body.setPosition(body, { x, y: height + radius });
            wrapped = true;
        } else if (y > height + radius) {
            Body.setPosition(body, { x, y: -radius });
            wrapped = true;
        }

        if (wrapped) {
            asteroid.wraps += 1;
            if (asteroid.wraps >= 2) {
                destroyAsteroid(asteroid);
                continue;
            }
        }

        if (state.playing) {
            const dx = body.position.x - player.x;
            const dy = body.position.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius + player.radius) {
                if (asteroid.shape === 'circle') {
                    awardCircle(asteroid);
                } else {
                    handlePlayerDeath('hull breached');
                }
            }
        }
    }

    state.asteroids = state.asteroids.filter((a) => !a.dead);
}

function updateEffects(dt) {
    state.effects.forEach((effect) => {
        effect.life -= dt;
    });
    state.effects = state.effects.filter((effect) => effect.life > 0);
}

function drawBackground() {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 53, 53, 0.015)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

function drawAsteroids() {
    for (const asteroid of state.asteroids) {
        ctx.save();
        const { body } = asteroid;
        ctx.translate(body.position.x, body.position.y);
        ctx.strokeStyle = 'rgba(255, 53, 53, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(255, 53, 53, 0.65)';
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const sides = shapeSides[asteroid.shape];
        if (asteroid.shape === 'circle') {
            ctx.arc(0, 0, asteroid.radius, 0, Math.PI * 2);
        } else {
            for (let i = 0; i <= sides; i++) {
                const angle = body.angle + (i / sides) * Math.PI * 2;
                const x = Math.cos(angle) * asteroid.radius;
                const y = Math.sin(angle) * asteroid.radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }

        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

function drawEffects() {
    for (const effect of state.effects) {
        if (effect.type !== 'beam') continue;
        const alpha = clamp(effect.life / 0.2, 0, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(255, 184, 115, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 184, 115, 0.7)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(effect.x1, effect.y1);
        ctx.lineTo(effect.x2, effect.y2);
        ctx.stroke();
        ctx.restore();
    }
}

function drawTowers() {
    for (const tower of state.towers) {
        ctx.save();
        ctx.translate(tower.x, tower.y);
        ctx.rotate(tower.angle);
        ctx.strokeStyle = 'rgba(255, 53, 53, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(255, 53, 53, 0.6)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(4, -4, 24, 8);
        ctx.stroke();
        ctx.restore();
    }
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.25;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-player.radius * 1.2, 0);
    ctx.lineTo(player.radius * 1.2, 0);
    ctx.moveTo(0, -player.radius * 1.2);
    ctx.lineTo(0, player.radius * 1.2);
    ctx.stroke();
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    drawBackground();
    drawEffects();
    drawAsteroids();
    drawTowers();
    drawPlayer();
}

function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (state.playing) {
        updateAsteroids(dt);
        updateTowers(dt);
        state.asteroids = state.asteroids.filter((a) => !a.dead);
        if (state.asteroids.length === 0) {
            endRound('field emptied');
        } else if (state.asteroids.every((a) => a.shape === 'circle')) {
            // give any unclaimed credits before rolling the round.
            state.asteroids.forEach((a) => awardCircle(a));
            endRound('only circles remain');
        }
    } else {
        updateAsteroids(dt * 0.35);
    }

    updateEffects(dt);
    draw();
    requestAnimationFrame(tick);
}

function startRound() {
    if (state.gameOver) return;
    state.gameOver = false;
    closeShop();
    shareButton.classList.add('hidden');
    state.playing = true;
    clearAsteroids();
    state.effects = [];
    spawnWave();
    setBanner(`round ${state.round}`, 'drift incoming', 1400);
}

function endRound(reason) {
    state.playing = false;
    state.round += 1;
    clearAsteroids();
    setBanner('round cleared', reason, 2000);
    updateChips();
    openShop({ reason });
}

function handlePlayerDeath(reason) {
    if (!state.playing) return;
    state.playing = false;
    state.gameOver = true;
    shareButton.classList.remove('hidden');
    state.shareText = `made it to round ${state.round} with ${state.credits} credits in crayon.`;
    setBanner('game over', reason || 'cursor drift lost', 3200);
    openShop({ reason: 'reset to launch again', afterDeath: true });
}

function placeTower(x, y) {
    state.towers.push({
        x,
        y,
        angle: 0,
        cooldown: randRange(0, 2),
    });
    state.pendingTowers = Math.max(0, state.pendingTowers - 1);
    placementHint.textContent = state.pendingTowers > 0 ? 'placed. click again for the next one.' : '';
    updateChips();
}

function handlePlacement(event) {
    if (!state.shopOpen || state.pendingTowers <= 0) return;
    if (event.target.closest('#shop-panel')) return;
    if (event.target.closest('button')) return;
    placeTower(event.clientX, event.clientY);
}

function handleMouseMove(event) {
    player.x = event.clientX;
    player.y = event.clientY;
    player.hasMoved = true;
}

function handleLeave() {
    if (state.playing) {
        handlePlayerDeath('left the window');
    }
}

function handleVisibility() {
    if (document.visibilityState === 'hidden' && state.playing) {
        handlePlayerDeath('left the window');
    }
}

function shareProgress() {
    if (!state.shareText) return;
    const text = state.shareText;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            setBanner('copied', 'shared progress ready');
        }).catch(() => {
            setBanner('share failed', text, 1800);
        });
    } else {
        setBanner('share copy', text, 2000);
    }
}

function initUI() {
    updateChips();
    openShop({ reason: 'cursor stays alive. towers between rounds.' });

    buyTowerButton.addEventListener('click', () => {
        if (state.credits < 10) {
            placementHint.textContent = `need ${10 - state.credits} more credits`;
            return;
        }
        state.credits -= 10;
        state.pendingTowers += 1;
        placementHint.textContent = 'purchased. click anywhere to drop it.';
        updateChips();
    });

    startButton.addEventListener('click', () => {
        startRound();
    });

    resetButton.addEventListener('click', () => {
        resetRun();
    });

    shareButton.addEventListener('click', shareProgress);
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseleave', handleLeave);
window.addEventListener('blur', handleLeave);
document.addEventListener('visibilitychange', handleVisibility);
window.addEventListener('click', handlePlacement);

resizeCanvas();
initUI();
tick(performance.now());
}).catch((error) => {
    console.error('crayon: unable to start Matter.js scene', error);
    const banner = document.getElementById('banner');
    if (banner) {
        banner.classList.remove('hidden');
        document.getElementById('banner-title').textContent = 'load error';
        document.getElementById('banner-body').textContent = 'matter.js failed to load';
    }
});
