import { ROOM_SIZE, TILE_SIZE, GRID_SIZE } from './rooms.js';

const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
const clampBetween = (value, a, b) => clampValue(value, Math.min(a, b), Math.max(a, b));

const COLLISION_SKIN = 0.4;

const effectiveRadius = (radius) => Math.max(0, radius - COLLISION_SKIN);

export const collidesWithWalls = (grid, x, y, radius) => {
    if (!grid) {
        return false;
    }

    const radiusWithSkin = effectiveRadius(radius);
    const minTileX = clampValue(Math.floor((x - radiusWithSkin) / TILE_SIZE), 0, GRID_SIZE - 1);
    const maxTileX = clampValue(Math.floor((x + radiusWithSkin) / TILE_SIZE), 0, GRID_SIZE - 1);
    const minTileY = clampValue(Math.floor((y - radiusWithSkin) / TILE_SIZE), 0, GRID_SIZE - 1);
    const maxTileY = clampValue(Math.floor((y + radiusWithSkin) / TILE_SIZE), 0, GRID_SIZE - 1);

    for (let ty = minTileY; ty <= maxTileY; ty += 1) {
        for (let tx = minTileX; tx <= maxTileX; tx += 1) {
            if (grid[ty][tx] === 1) {
                const tileLeft = tx * TILE_SIZE;
                const tileRight = tileLeft + TILE_SIZE;
                const tileTop = ty * TILE_SIZE;
                const tileBottom = tileTop + TILE_SIZE;
                const nearestX = clampValue(x, tileLeft, tileRight);
                const nearestY = clampValue(y, tileTop, tileBottom);
                const dx = x - nearestX;
                const dy = y - nearestY;
                if (dx * dx + dy * dy < radiusWithSkin * radiusWithSkin) {
                    return true;
                }
            }
        }
    }

    return false;
};

const sweepAxis = ({ grid, radius, start, target, fixed, axis }) => {
    const delta = target - start;
    if (Math.abs(delta) < 1e-6) {
        return clampBetween(target, start, target);
    }

    let low = 0;
    let high = 1;
    let best = start;
    let collided = false;

    for (let i = 0; i < 6; i += 1) {
        const mid = (low + high) / 2;
        const candidate = start + delta * mid;
        const x = axis === 'x' ? candidate : fixed;
        const y = axis === 'y' ? candidate : fixed;

        if (!collidesWithWalls(grid, x, y, radius)) {
            best = candidate;
            low = mid;
        } else {
            collided = true;
            high = mid;
        }
    }

    if (!collided) {
        return clampBetween(target, start, target);
    }

    const dir = Math.sign(delta);
    const epsilon = 0.01;
    const adjusted = clampBetween(best - dir * epsilon, start, target);
    return adjusted;
};

const attemptResolution = ({ grid, radius, prevX, prevY, targetX, targetY, order }) => {
    let currentX = prevX;
    let currentY = prevY;

    for (const axis of order) {
        if (axis === 'x') {
            const resolved = sweepAxis({
                grid,
                radius,
                start: currentX,
                target: targetX,
                fixed: currentY,
                axis: 'x',
            });
            currentX = clampValue(resolved, radius, ROOM_SIZE - radius);
        } else {
            const resolved = sweepAxis({
                grid,
                radius,
                start: currentY,
                target: targetY,
                fixed: currentX,
                axis: 'y',
            });
            currentY = clampValue(resolved, radius, ROOM_SIZE - radius);
        }
    }

    if (!collidesWithWalls(grid, currentX, currentY, radius)) {
        return {
            x: currentX,
            y: currentY,
        };
    }

    return null;
};

export const resolveMovementCollision = ({
    room,
    radius,
    prevX,
    prevY,
    targetX,
    targetY,
}) => {
    const grid = room?.grid;
    const clampedX = clampValue(targetX, radius, ROOM_SIZE - radius);
    const clampedY = clampValue(targetY, radius, ROOM_SIZE - radius);

    if (!grid) {
        return { x: clampedX, y: clampedY };
    }

    if (!collidesWithWalls(grid, clampedX, clampedY, radius)) {
        return { x: clampedX, y: clampedY };
    }

    const orders = [
        ['x', 'y'],
        ['y', 'x'],
    ];

    for (const order of orders) {
        const resolved = attemptResolution({
            grid,
            radius,
            prevX,
            prevY,
            targetX: clampedX,
            targetY: clampedY,
            order,
        });
        if (resolved) {
            return resolved;
        }
    }

    return {
        x: prevX,
        y: prevY,
    };
};
