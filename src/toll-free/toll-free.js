import { ROOM_SIZE, DOOR_DEPTH, createRandomRoom, findDoorByEdge, OPPOSITE_EDGE } from './rooms.js';
import { clampValue, updateMovement } from './movement.js';
import { attemptCreateBullet, updateBullets } from './shooting.js';

const canvas = document.getElementById('toll-free-canvas');
const ctx = canvas?.getContext('2d');

if (!canvas || !ctx) {
    throw new Error('toll free canvas failed to initialize');
}

ctx.imageSmoothingEnabled = false;

const VIRTUAL_SIZE = ROOM_SIZE;
const SCREEN_SCALE = canvas.width / VIRTUAL_SIZE;

if (!Number.isInteger(SCREEN_SCALE)) {
    throw new Error('canvas width must be an integer multiple of the virtual grid');
}

const SPRITE_SIZE = 8;
const SPRITE_HALF = SPRITE_SIZE / 2;
const SPRITE_SOURCE_SIZE = 512;
const ANGLE_STEPS = 32;
const TWO_PI = Math.PI * 2;

const SPEED = 200;
const BULLET_SPEED = 600;
const BULLET_SIZE = 2;
const BULLET_HALF = BULLET_SIZE / 2;
const BULLET_LIFETIME = 0.8;
const BULLET_SPREAD = Math.PI / 10;
const BULLET_LENGTH = 18;
const FIRE_RATE = 0.06;

const COLOR_PALETTE = [0xffffff, 0x000000];

const baseSpriteCanvas = document.createElement('canvas');
baseSpriteCanvas.width = SPRITE_SOURCE_SIZE;
baseSpriteCanvas.height = SPRITE_SOURCE_SIZE;
const baseSpriteCtx = baseSpriteCanvas.getContext('2d', { willReadFrequently: true });

const rotatedSpriteCanvas = document.createElement('canvas');
rotatedSpriteCanvas.width = SPRITE_SOURCE_SIZE;
rotatedSpriteCanvas.height = SPRITE_SOURCE_SIZE;
const rotatedSpriteCtx = rotatedSpriteCanvas.getContext('2d', { willReadFrequently: true });

if (!baseSpriteCtx || !rotatedSpriteCtx) {
    throw new Error('toll free sprite contexts unavailable');
}

baseSpriteCtx.imageSmoothingEnabled = false;
rotatedSpriteCtx.imageSmoothingEnabled = false;

const snapColorToPalette = (color) => {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    let best = COLOR_PALETTE[0];
    let bestDistance = Infinity;

    for (const paletteColor of COLOR_PALETTE) {
        const pr = (paletteColor >> 16) & 0xff;
        const pg = (paletteColor >> 8) & 0xff;
        const pb = paletteColor & 0xff;
        const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = paletteColor;
        }
    }

    return best;
};

const downsampleImageData2x2 = (sourceData, width) => {
    const targetWidth = width / 2;
    const colors = new Int32Array(targetWidth * targetWidth).fill(-1);

    for (let y = 0; y < targetWidth; y += 1) {
        for (let x = 0; x < targetWidth; x += 1) {
            const startX = x * 2;
            const startY = y * 2;
            const votes = new Map();
            let bestColor = -1;
            let bestWeight = 0;

            for (let by = 0; by < 2; by += 1) {
                for (let bx = 0; bx < 2; bx += 1) {
                    const srcX = startX + bx;
                    const srcY = startY + by;
                    const index = (srcY * width + srcX) * 4;
                    const alpha = sourceData[index + 3];

                    if (alpha < 16) {
                        continue;
                    }

                    const r = sourceData[index];
                    const g = sourceData[index + 1];
                    const b = sourceData[index + 2];
                    const snapped = snapColorToPalette((r << 16) | (g << 8) | b);
                    const weight = (votes.get(snapped) || 0) + alpha;
                    votes.set(snapped, weight);

                    if (weight > bestWeight) {
                        bestWeight = weight;
                        bestColor = snapped;
                    }
                }
            }

            colors[y * targetWidth + x] = bestColor;
        }
    }

    return {
        width: targetWidth,
        colors,
    };
};

const downsampleColors2x2 = (sourceColors, width) => {
    const targetWidth = width / 2;
    const colors = new Int32Array(targetWidth * targetWidth).fill(-1);

    for (let y = 0; y < targetWidth; y += 1) {
        for (let x = 0; x < targetWidth; x += 1) {
            const startX = x * 2;
            const startY = y * 2;
            const votes = new Map();
            let bestColor = -1;
            let bestWeight = 0;

            for (let by = 0; by < 2; by += 1) {
                for (let bx = 0; bx < 2; bx += 1) {
                    const srcX = startX + bx;
                    const srcY = startY + by;
                    const color = sourceColors[srcY * width + srcX];

                    if (color === -1) {
                        continue;
                    }

                    const weight = (votes.get(color) || 0) + 1;
                    votes.set(color, weight);

                    if (weight > bestWeight) {
                        bestWeight = weight;
                        bestColor = color;
                    }
                }
            }

            colors[y * targetWidth + x] = bestColor;
        }
    }

    return {
        width: targetWidth,
        colors,
    };
};

const preRotatedFrames = [];
let spriteReady = false;

const loadSpriteBlueprint = async () => {
    const spriteUrl = new URL('./sprites/player.png', import.meta.url);
    const image = new Image();
    image.src = spriteUrl.toString();
    await image.decode();

    baseSpriteCtx.clearRect(0, 0, SPRITE_SOURCE_SIZE, SPRITE_SOURCE_SIZE);
    baseSpriteCtx.drawImage(image, 0, 0, SPRITE_SOURCE_SIZE, SPRITE_SOURCE_SIZE);
};

const buildSpriteFrames = () => {
    preRotatedFrames.length = ANGLE_STEPS;

    for (let step = 0; step < ANGLE_STEPS; step += 1) {
        const angle = (step / ANGLE_STEPS) * TWO_PI;

        rotatedSpriteCtx.setTransform(1, 0, 0, 1, 0, 0);
        rotatedSpriteCtx.clearRect(0, 0, SPRITE_SOURCE_SIZE, SPRITE_SOURCE_SIZE);
        rotatedSpriteCtx.save();
        rotatedSpriteCtx.translate(SPRITE_SOURCE_SIZE / 2, SPRITE_SOURCE_SIZE / 2);
        rotatedSpriteCtx.rotate(angle);
        rotatedSpriteCtx.drawImage(baseSpriteCanvas, -SPRITE_SOURCE_SIZE / 2, -SPRITE_SOURCE_SIZE / 2);
        rotatedSpriteCtx.restore();

        const data = rotatedSpriteCtx.getImageData(0, 0, SPRITE_SOURCE_SIZE, SPRITE_SOURCE_SIZE).data;
        let reduced = downsampleImageData2x2(data, SPRITE_SOURCE_SIZE);

        while (reduced.width > SPRITE_SIZE) {
            reduced = downsampleColors2x2(reduced.colors, reduced.width);
        }

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = SPRITE_SIZE;
        frameCanvas.height = SPRITE_SIZE;
        const frameCtx = frameCanvas.getContext('2d');
        if (!frameCtx) {
            throw new Error('failed to create sprite frame context');
        }
        frameCtx.imageSmoothingEnabled = false;

        const frameImage = frameCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
        for (let y = 0; y < SPRITE_SIZE; y += 1) {
            for (let x = 0; x < SPRITE_SIZE; x += 1) {
                const index = y * SPRITE_SIZE + x;
                const color = reduced.colors[index];
                const offset = index * 4;
                if (color === -1) {
                    frameImage.data[offset + 3] = 0;
                    continue;
                }
                frameImage.data[offset] = (color >> 16) & 0xff;
                frameImage.data[offset + 1] = (color >> 8) & 0xff;
                frameImage.data[offset + 2] = color & 0xff;
                frameImage.data[offset + 3] = 255;
            }
        }
        frameCtx.putImageData(frameImage, 0, 0);
        preRotatedFrames[step] = frameCanvas;
    }

    spriteReady = true;
};

const getCanvasPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const rawX = (event.clientX - rect.left) * scaleX;
    const rawY = (event.clientY - rect.top) * scaleY;

    return {
        x: rawX / SCREEN_SCALE,
        y: rawY / SCREEN_SCALE,
    };
};

const state = {
    precisePosition: {
        x: VIRTUAL_SIZE / 2,
        y: VIRTUAL_SIZE / 2,
    },
    drawPosition: {
        x: Math.round(VIRTUAL_SIZE / 2),
        y: Math.round(VIRTUAL_SIZE / 2),
    },
    angle: 0,
    keys: new Set(),
    mouse: {
        x: VIRTUAL_SIZE / 2,
        y: VIRTUAL_SIZE / 2,
        inside: false,
    },
    bullets: [],
    room: createRandomRoom({ spriteHalf: SPRITE_HALF }),
    firing: {
        active: false,
        cooldown: 0,
    },
};

const snapToGrid = (value) => Math.round(value);

const updateDrawPosition = () => {
    state.drawPosition.x = snapToGrid(state.precisePosition.x);
    state.drawPosition.y = snapToGrid(state.precisePosition.y);
};

const updateAngleFromMouse = () => {
    const dx = state.mouse.x - state.precisePosition.x;
    const dy = state.mouse.y - state.precisePosition.y;

    if (dx === 0 && dy === 0) {
        return;
    }

    state.angle = Math.atan2(dy, dx);
};

const shoot = () => {
    if (!spriteReady) {
        return;
    }

    const bullet = attemptCreateBullet({
        origin: state.precisePosition,
        target: state.mouse,
        spriteHalf: SPRITE_HALF,
        bulletHalf: BULLET_HALF,
        bulletSpeed: BULLET_SPEED,
        bulletLifetime: BULLET_LIFETIME,
        spreadAngle: BULLET_SPREAD,
        lineLength: BULLET_LENGTH,
    });

    if (bullet) {
        state.bullets.push(bullet);
    }
};

const transitionToRoomFrom = (edge) => {
    const entryEdge = OPPOSITE_EDGE[edge];
    const newRoom = createRandomRoom({ requiredEdges: [entryEdge], spriteHalf: SPRITE_HALF });
    const entryDoor = findDoorByEdge(newRoom, entryEdge);
    if (!entryDoor) {
        return;
    }

    state.room = newRoom;
    state.precisePosition.x = entryDoor.spawn.x;
    state.precisePosition.y = entryDoor.spawn.y;
    state.mouse.x = entryDoor.spawn.x;
    state.mouse.y = entryDoor.spawn.y;
    state.bullets = [];
    updateDrawPosition();
};

const attemptRoomTransition = (dirX, dirY) => {
    if (!state.room) {
        return;
    }

    const { precisePosition } = state;

    if (dirY > 0 && precisePosition.y >= VIRTUAL_SIZE - SPRITE_HALF) {
        const door = findDoorByEdge(state.room, 'bottom');
        if (door && precisePosition.x >= door.x && precisePosition.x <= door.x + door.width) {
            transitionToRoomFrom('bottom');
            return;
        }
    }

    if (dirY < 0 && precisePosition.y <= SPRITE_HALF) {
        const door = findDoorByEdge(state.room, 'top');
        if (door && precisePosition.x >= door.x && precisePosition.x <= door.x + door.width) {
            transitionToRoomFrom('top');
            return;
        }
    }

    if (dirX < 0 && precisePosition.x <= SPRITE_HALF) {
        const door = findDoorByEdge(state.room, 'left');
        if (door && precisePosition.y >= door.y && precisePosition.y <= door.y + door.height) {
            transitionToRoomFrom('left');
            return;
        }
    }

    if (dirX > 0 && precisePosition.x >= VIRTUAL_SIZE - SPRITE_HALF) {
        const door = findDoorByEdge(state.room, 'right');
        if (door && precisePosition.y >= door.y && precisePosition.y <= door.y + door.height) {
            transitionToRoomFrom('right');
        }
    }
};

const handleKeyDown = (event) => {
    if (!event.code || !/^Key[WSAD]$/.test(event.code)) {
        return;
    }
    event.preventDefault();
    state.keys.add(event.code);
};

const handleKeyUp = (event) => {
    if (!event.code || !/^Key[WSAD]$/.test(event.code)) {
        return;
    }
    event.preventDefault();
    state.keys.delete(event.code);
};

const applyMousePoint = (point) => {
    state.mouse.x = clampValue(point.x, 0, VIRTUAL_SIZE);
    state.mouse.y = clampValue(point.y, 0, VIRTUAL_SIZE);
};

const handleMouseMove = (event) => {
    const point = getCanvasPoint(event);
    applyMousePoint(point);
    state.mouse.inside = true;
    if ((event.buttons & 1) === 1) {
        state.firing.active = true;
    }
    updateAngleFromMouse();
};

const handleMouseEnter = (event) => {
    const point = getCanvasPoint(event);
    applyMousePoint(point);
    state.mouse.inside = true;
    if ((event.buttons & 1) === 1) {
        state.firing.active = true;
    }
    updateAngleFromMouse();
};

const handleMouseLeave = () => {
    state.mouse.inside = false;
    state.firing.active = false;
    state.firing.cooldown = 0;
};

const handleMouseDown = (event) => {
    if (event.button !== 0) {
        return;
    }
    const point = getCanvasPoint(event);
    applyMousePoint(point);
    state.mouse.inside = true;
    updateAngleFromMouse();
    state.firing.active = true;
    shoot();
    state.firing.cooldown = FIRE_RATE;
};

const handleMouseUp = (event) => {
    if (event.button !== 0) {
        return;
    }
    state.firing.active = false;
    state.firing.cooldown = 0;
};

const clearKeys = () => {
    state.keys.clear();
};

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
window.addEventListener('blur', clearKeys);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        clearKeys();
    }
});
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseenter', handleMouseEnter);
canvas.addEventListener('mouseleave', handleMouseLeave);
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
window.addEventListener('mouseup', handleMouseUp);

const update = (delta) => {
    const { dirX, dirY } = updateMovement(state, delta, {
        speed: SPEED,
        spriteHalf: SPRITE_HALF,
        worldSize: VIRTUAL_SIZE,
        room: state.room,
    });

    updateDrawPosition();

    if (state.mouse.inside) {
        updateAngleFromMouse();
    }

    if (state.firing.active) {
        state.firing.cooldown -= delta;
        while (state.firing.cooldown <= 0) {
            shoot();
            state.firing.cooldown += FIRE_RATE;
        }
    } else {
        state.firing.cooldown = 0;
    }

    state.bullets = updateBullets(state.bullets, delta, {
        bulletSize: BULLET_SIZE,
        worldSize: VIRTUAL_SIZE,
    });

    attemptRoomTransition(dirX, dirY);
};

const fillBackground = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const renderWalls = () => {
    if (!state.room) {
        return;
    }

    const thickness = DOOR_DEPTH * SCREEN_SCALE;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, thickness);
    ctx.fillRect(0, canvas.height - thickness, canvas.width, thickness);
    ctx.fillRect(0, 0, thickness, canvas.height);
    ctx.fillRect(canvas.width - thickness, 0, thickness, canvas.height);

    ctx.fillStyle = '#ffffff';
    for (const door of state.room.doors) {
        ctx.fillRect(door.x * SCREEN_SCALE, door.y * SCREEN_SCALE, door.width * SCREEN_SCALE, door.height * SCREEN_SCALE);
    }
};

const renderBullets = () => {
    if (state.bullets.length === 0) {
        return;
    }

    const bulletColor = document.body.classList.contains('dark-mode') ? '#ff6666' : '#0044ff';
    ctx.save();
    ctx.strokeStyle = bulletColor;
    ctx.lineWidth = BULLET_SIZE * SCREEN_SCALE;
    ctx.lineCap = 'round';

    for (const bullet of state.bullets) {
        const angle = bullet.angle ?? 0;
        const length = bullet.length ?? 0;
        const headX = bullet.x * SCREEN_SCALE;
        const headY = bullet.y * SCREEN_SCALE;
        const tailX = headX - Math.cos(angle) * length * SCREEN_SCALE;
        const tailY = headY - Math.sin(angle) * length * SCREEN_SCALE;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
    }
    ctx.restore();
};

const renderPlayer = () => {
    if (!spriteReady) {
        return;
    }

    const frame = preRotatedFrames[0];
    if (!frame) {
        return;
    }

    const drawX = Math.round(state.precisePosition.x - SPRITE_HALF);
    const drawY = Math.round(state.precisePosition.y - SPRITE_HALF);
    ctx.drawImage(frame, drawX * SCREEN_SCALE, drawY * SCREEN_SCALE, SPRITE_SIZE * SCREEN_SCALE, SPRITE_SIZE * SCREEN_SCALE);
};

const render = () => {
    fillBackground();
    renderWalls();
    renderBullets();
    renderPlayer();
};

let lastTime = 0;

const frame = (timestamp) => {
    const delta = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    update(delta);
    render();
    window.requestAnimationFrame(frame);
};

const start = async () => {
    try {
        await loadSpriteBlueprint();
        buildSpriteFrames();
        lastTime = performance.now();
        window.requestAnimationFrame(frame);
    } catch (error) {
        console.error(error);
    }
};

start();
