import { ROOM_SIZE, TILE_SIZE, createRandomRoom, findDoorByEdge, OPPOSITE_EDGE } from './rooms.js';
import { clampValue, updateMovement } from './movement.js';
import { attemptCreateBullet, updateBullets } from './shooting.js';
import { loadSpriteSheet } from './sprite-sheet.js';
import spriteSheetMeta from './sprites/sheet1.json';
import spriteSheetImageUrl from './sprites/sheet1.png';

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
const SPEED = 100;
const BULLET_SPEED = 10;
const BULLET_SIZE = 2;
const BULLET_HALF = BULLET_SIZE / 2;
const BULLET_LIFETIME = 10;
const BULLET_SPREAD = Math.PI / 10;
const FIRE_RATE = 0.06;

let spriteReady = false;
let spriteMap = new Map();

const getSprite = (name) => spriteMap.get(name) || null;

const loadSprites = async () => {
    spriteMap = await loadSpriteSheet({
        imageUrl: spriteSheetImageUrl,
        meta: spriteSheetMeta,
        spriteSize: SPRITE_SIZE,
    });
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
    room: createRandomRoom({ spriteHalf: SPRITE_HALF, variant: 'open' }),
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
    });

    if (bullet) {
        state.bullets.push(bullet);
    }
};

const transitionToRoomFrom = (edge) => {
    const entryEdge = OPPOSITE_EDGE[edge];
    const variant = Math.random() < 0.5 ? 'closed' : 'open';
    const newRoom = createRandomRoom({
        requiredEdges: [entryEdge],
        spriteHalf: SPRITE_HALF,
        variant,
    });
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
    if (!state.room || !state.room.grid) {
        return;
    }

    const tileSizePx = TILE_SIZE * SCREEN_SCALE;
    ctx.fillStyle = '#000000';

    for (let y = 0; y < state.room.grid.length; y += 1) {
        for (let x = 0; x < state.room.grid[y].length; x += 1) {
            if (state.room.grid[y][x] === 1) {
                ctx.fillRect(x * tileSizePx, y * tileSizePx, tileSizePx, tileSizePx);
            }
        }
    }
};

const renderPlayer = () => {
    if (!spriteReady) {
        return;
    }

    const darkMode = document.body.classList.contains('dark-mode');
    const sprite = getSprite(darkMode ? 'player_d' : 'player') || getSprite('player');
    if (!sprite) {
        return;
    }

    const drawX = Math.round(state.precisePosition.x - SPRITE_HALF);
    const drawY = Math.round(state.precisePosition.y - SPRITE_HALF);
    ctx.drawImage(
        sprite,
        drawX * SCREEN_SCALE,
        drawY * SCREEN_SCALE,
        SPRITE_SIZE * SCREEN_SCALE,
        SPRITE_SIZE * SCREEN_SCALE,
    );
};

const renderDoors = () => {
    if (!spriteReady || !state.room || !Array.isArray(state.room.doors) || state.room.doors.length === 0) {
        return;
    }

    const darkMode = document.body.classList.contains('dark-mode');
    const sprite = getSprite(darkMode ? 'door_d' : 'door') || getSprite('door');
    if (!sprite) {
        return;
    }

    const scaledWidth = SPRITE_SIZE * SCREEN_SCALE;
    const scaledHeight = SPRITE_SIZE * SCREEN_SCALE;

    state.room.doors.forEach((door) => {
        const horizontal = door.edge === 'top' || door.edge === 'bottom';
        const segments = horizontal
            ? Math.max(1, Math.round(door.width / TILE_SIZE))
            : Math.max(1, Math.round(door.height / TILE_SIZE));

        for (let i = 0; i < segments; i += 1) {
            const drawX = door.x + (horizontal ? i * TILE_SIZE : 0);
            const drawY = door.y + (horizontal ? 0 : i * TILE_SIZE);
            ctx.drawImage(
                sprite,
                Math.round(drawX) * SCREEN_SCALE,
                Math.round(drawY) * SCREEN_SCALE,
                scaledWidth,
                scaledHeight,
            );
        }
    });
};

const renderBullets = () => {
    if (state.bullets.length === 0) {
        return;
    }

    const bulletColor = document.body.classList.contains('dark-mode') ? '#ff6666' : '#0044ff';
    ctx.fillStyle = bulletColor;

    for (const bullet of state.bullets) {
        const drawX = Math.round(bullet.x - BULLET_HALF);
        const drawY = Math.round(bullet.y - BULLET_HALF);
        ctx.fillRect(drawX * SCREEN_SCALE, drawY * SCREEN_SCALE, BULLET_SIZE * SCREEN_SCALE, BULLET_SIZE * SCREEN_SCALE);
    }
};

const render = () => {
    fillBackground();
    renderWalls();
    renderDoors();
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
        await loadSprites();
        lastTime = performance.now();
        window.requestAnimationFrame(frame);
    } catch (error) {
        console.error(error);
    }
};

start();
