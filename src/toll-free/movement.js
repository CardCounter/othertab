import { resolveMovementCollision } from './collision.js';

export const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

const movementVectorFromKeys = (keys) => {
    let x = 0;
    let y = 0;

    if (keys.has('KeyW')) y -= 1;
    if (keys.has('KeyS')) y += 1;
    if (keys.has('KeyA')) x -= 1;
    if (keys.has('KeyD')) x += 1;

    const length = Math.hypot(x, y);
    if (length > 0) {
        x /= length;
        y /= length;
    }

    return { dirX: x, dirY: y };
};

export const updateMovement = (state, delta, config) => {
    const { speed, spriteHalf, worldSize, room } = config;
    const { dirX, dirY } = movementVectorFromKeys(state.keys);

    const prevX = state.precisePosition.x;
    const prevY = state.precisePosition.y;
    let nextX = prevX + dirX * speed * delta;
    let nextY = prevY + dirY * speed * delta;

    ({ x: nextX, y: nextY } = resolveMovementCollision({
        room,
        radius: spriteHalf,
        prevX,
        prevY,
        targetX: nextX,
        targetY: nextY,
    }));

    state.precisePosition.x = clampValue(nextX, spriteHalf, worldSize - spriteHalf);
    state.precisePosition.y = clampValue(nextY, spriteHalf, worldSize - spriteHalf);

    return { dirX, dirY };
};
