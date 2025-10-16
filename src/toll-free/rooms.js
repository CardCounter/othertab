const GRID_DIRECTIONS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
];

export const ROOM_SIZE = 256;
export const TILE_SIZE = 8;
export const GRID_SIZE = ROOM_SIZE / TILE_SIZE;
export const DOOR_DEPTH_TILES = 1;
export const DOOR_DEPTH = DOOR_DEPTH_TILES * TILE_SIZE;

export const HALLWAY_TYPES = [
    { id: 'small', minWidthTiles: 2 },
    { id: 'medium', minWidthTiles: 4 },
    { id: 'large', minWidthTiles: 8 },
];

const DEFAULT_HALLWAY_TYPE = HALLWAY_TYPES[0];
const HALLWAY_TYPE_LOOKUP = new Map(HALLWAY_TYPES.map((type) => [type.id, type]));

export const OPPOSITE_EDGE = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
};

const mulberry32 = (seed) => {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

const randomInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;

const createGrid = (value = 1) =>
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(value));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pickRandomHallwayType = (rng) => {
    if (!rng) {
        return DEFAULT_HALLWAY_TYPE;
    }
    const index = Math.floor(rng() * HALLWAY_TYPES.length);
    return HALLWAY_TYPES[index] || DEFAULT_HALLWAY_TYPE;
};

const resolveHallwayType = (rng, requestedType) => {
    if (!requestedType || requestedType === 'random') {
        return pickRandomHallwayType(rng);
    }
    return HALLWAY_TYPE_LOOKUP.get(requestedType) || DEFAULT_HALLWAY_TYPE;
};

const resolveHallwayWidthTiles = (rng, hallwayType) => {
    const target = hallwayType || DEFAULT_HALLWAY_TYPE;
    const min = Math.max(1, Math.floor(target.minWidthTiles));
    const maxConfig = target.maxWidthTiles;
    if (Number.isInteger(maxConfig) && maxConfig >= min && rng) {
        const max = Math.min(GRID_SIZE, Math.floor(maxConfig));
        return clamp(randomInt(rng, min, max), 1, GRID_SIZE);
    }
    return Math.min(GRID_SIZE, min);
};

const normalizeHallwayWidthTiles = (width) => Math.max(1, Math.floor(width || 1));

const centeredDoorRect = (edge, hallwayWidthTiles) => {
    const usableTiles = Math.max(1, Math.min(GRID_SIZE, Math.floor(hallwayWidthTiles)));
    const crossAxisSize = usableTiles * TILE_SIZE;
    const offset = (ROOM_SIZE - crossAxisSize) / 2;
    if (edge === 'top') {
        return {
            edge,
            x: offset,
            y: 0,
            width: crossAxisSize,
            height: DOOR_DEPTH,
        };
    }
    if (edge === 'bottom') {
        return {
            edge,
            x: offset,
            y: ROOM_SIZE - DOOR_DEPTH,
            width: crossAxisSize,
            height: DOOR_DEPTH,
        };
    }
    if (edge === 'left') {
        return {
            edge,
            x: 0,
            y: offset,
            width: DOOR_DEPTH,
            height: crossAxisSize,
        };
    }
    return {
        edge,
        x: ROOM_SIZE - DOOR_DEPTH,
        y: offset,
        width: DOOR_DEPTH,
        height: crossAxisSize,
    };
};

const spawnPointForDoor = (door, spriteHalf) => {
    if (door.edge === 'top') {
        return {
            x: door.x + door.width / 2,
            y: door.y + door.height + spriteHalf,
        };
    }
    if (door.edge === 'bottom') {
        return {
            x: door.x + door.width / 2,
            y: door.y - spriteHalf,
        };
    }
    if (door.edge === 'left') {
        return {
            x: door.x + door.width + spriteHalf,
            y: door.y + door.height / 2,
        };
    }
    return {
        x: door.x - spriteHalf,
        y: door.y + door.height / 2,
    };
};

const ROOM_LAYOUTS = [
    { id: 'dead-end-bottom', doors: ['bottom'] },
    { id: 'dead-end-left', doors: ['left'] },
    { id: 'dead-end-right', doors: ['right'] },
    { id: 'dead-end-top', doors: ['top'] },
    { id: 'bottom-to-top', doors: ['bottom', 'top'] },
    { id: 'bottom-to-left', doors: ['bottom', 'left'] },
    { id: 'bottom-to-right', doors: ['bottom', 'right'] },
    { id: 'left-to-right', doors: ['left', 'right'] },
    { id: 'left-to-top', doors: ['left', 'top'] },
    { id: 'right-to-top', doors: ['right', 'top'] },
    { id: 'three-way-bottom', doors: ['bottom', 'left', 'right'] },
    { id: 'three-way-top', doors: ['top', 'left', 'right'] },
    { id: 'three-way-left', doors: ['left', 'top', 'bottom'] },
    { id: 'three-way-right', doors: ['right', 'top', 'bottom'] },
    { id: 'four-way', doors: ['top', 'bottom', 'left', 'right'] },
];

const doorInteriorTiles = (door) => {
    const tiles = [];
    const startTileX = Math.floor(door.x / TILE_SIZE);
    const endTileX = Math.floor((door.x + door.width - 1) / TILE_SIZE);
    const startTileY = Math.floor(door.y / TILE_SIZE);
    const endTileY = Math.floor((door.y + door.height - 1) / TILE_SIZE);
    const depthTiles = DOOR_DEPTH / TILE_SIZE;

    if (door.edge === 'top') {
        const interiorY = clamp(endTileY + 1, 0, GRID_SIZE - 1);
        for (let x = startTileX; x <= endTileX; x += 1) {
            tiles.push({ x: clamp(x, 0, GRID_SIZE - 1), y: interiorY });
        }
    } else if (door.edge === 'bottom') {
        const interiorY = clamp(startTileY - 1, 0, GRID_SIZE - 1);
        for (let x = startTileX; x <= endTileX; x += 1) {
            tiles.push({ x: clamp(x, 0, GRID_SIZE - 1), y: interiorY });
        }
    } else if (door.edge === 'left') {
        const interiorX = clamp(endTileX + 1, 0, GRID_SIZE - 1);
        for (let y = startTileY; y <= endTileY; y += 1) {
            tiles.push({ x: interiorX, y: clamp(y, 0, GRID_SIZE - 1) });
        }
    } else if (door.edge === 'right') {
        const interiorX = clamp(startTileX - depthTiles, 0, GRID_SIZE - 1);
        for (let y = startTileY; y <= endTileY; y += 1) {
            tiles.push({ x: interiorX, y: clamp(y, 0, GRID_SIZE - 1) });
        }
    }

    return tiles;
};

const doorInteriorCenter = (door) => {
    const tiles = doorInteriorTiles(door);
    if (tiles.length === 0) {
        return { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) };
    }
    const sum = tiles.reduce(
        (acc, tile) => {
            acc.x += tile.x;
            acc.y += tile.y;
            return acc;
        },
        { x: 0, y: 0 },
    );
    return {
        x: Math.round(sum.x / tiles.length),
        y: Math.round(sum.y / tiles.length),
    };
};

const applyDoorOpening = (grid, door) => {
    const startTileX = Math.floor(door.x / TILE_SIZE);
    const endTileX = Math.floor((door.x + door.width - 1) / TILE_SIZE);
    const startTileY = Math.floor(door.y / TILE_SIZE);
    const endTileY = Math.floor((door.y + door.height - 1) / TILE_SIZE);

    if (door.edge === 'top') {
        for (let x = startTileX; x <= endTileX; x += 1) {
            grid[0][clamp(x, 0, GRID_SIZE - 1)] = 0;
            if (GRID_SIZE > 1) {
                grid[1][clamp(x, 0, GRID_SIZE - 1)] = 0;
            }
        }
    } else if (door.edge === 'bottom') {
        const row = GRID_SIZE - 1;
        const interior = GRID_SIZE - 2;
        for (let x = startTileX; x <= endTileX; x += 1) {
            grid[row][clamp(x, 0, GRID_SIZE - 1)] = 0;
            if (interior >= 0) {
                grid[interior][clamp(x, 0, GRID_SIZE - 1)] = 0;
            }
        }
    } else if (door.edge === 'left') {
        for (let y = startTileY; y <= endTileY; y += 1) {
            grid[clamp(y, 0, GRID_SIZE - 1)][0] = 0;
            if (GRID_SIZE > 1) {
                grid[clamp(y, 0, GRID_SIZE - 1)][1] = 0;
            }
        }
    } else if (door.edge === 'right') {
        const col = GRID_SIZE - 1;
        const interior = GRID_SIZE - 2;
        for (let y = startTileY; y <= endTileY; y += 1) {
            grid[clamp(y, 0, GRID_SIZE - 1)][col] = 0;
            if (interior >= 0) {
                grid[clamp(y, 0, GRID_SIZE - 1)][interior] = 0;
            }
        }
    }
};

const ensureDoorInteriorsClear = (grid, doors) => {
    doors.forEach((door) => {
        const tiles = doorInteriorTiles(door);
        tiles.forEach(({ x, y }) => {
            if (y >= 0 && y < GRID_SIZE && x >= 0 && x < GRID_SIZE) {
                grid[y][x] = 0;
            }
        });
    });
};

const hasConnectivity = (grid, doorTiles) => {
    if (doorTiles.length === 0) {
        return true;
    }
    const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    const queue = [];
    const targets = new Set(doorTiles.map(({ x, y }) => `${x},${y}`));

    const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
            return;
        }
        if (visited[y][x] || grid[y][x] === 1) {
            return;
        }
        visited[y][x] = true;
        queue.push([x, y]);
    };

    const first = doorTiles[0];
    enqueue(first.x, first.y);

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        targets.delete(`${x},${y}`);

        GRID_DIRECTIONS.forEach(([dx, dy]) => {
            enqueue(x + dx, y + dy);
        });
    }

    return targets.size === 0;
};

const generateOpenRoomGrid = (rng, doors) => {
    const grid = createGrid(1);

    for (let y = 1; y < GRID_SIZE - 1; y += 1) {
        for (let x = 1; x < GRID_SIZE - 1; x += 1) {
            grid[y][x] = 0;
        }
    }

    doors.forEach((door) => {
        applyDoorOpening(grid, door);
    });
    ensureDoorInteriorsClear(grid, doors);

    const doorTiles = doors.flatMap(doorInteriorTiles);
    const maxObstacles = randomInt(rng, 3, 6);
    let placed = 0;
    let attempts = 0;

    const isDoorTile = (x, y) => doorTiles.some((tile) => tile.x === x && tile.y === y);

    while (placed < maxObstacles && attempts < maxObstacles * 8) {
        attempts += 1;
        const width = randomInt(rng, 2, 4);
        const height = randomInt(rng, 2, 4);
        const x = randomInt(rng, 1, GRID_SIZE - width - 2);
        const y = randomInt(rng, 1, GRID_SIZE - height - 2);

        let valid = true;
        for (let ty = y; ty < y + height && valid; ty += 1) {
            for (let tx = x; tx < x + width; tx += 1) {
                if (isDoorTile(tx, ty)) {
                    valid = false;
                    break;
                }
            }
        }

        if (!valid) {
            continue;
        }

        const affected = [];
        for (let ty = y; ty < y + height; ty += 1) {
            for (let tx = x; tx < x + width; tx += 1) {
                affected.push([tx, ty, grid[ty][tx]]);
                grid[ty][tx] = 1;
            }
        }

        if (!hasConnectivity(grid, doorTiles)) {
            affected.forEach(([tx, ty, previous]) => {
                grid[ty][tx] = previous;
            });
        } else {
            placed += 1;
        }
    }

    return grid;
};

const carveTile = (grid, x, y) => {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
        return;
    }
    grid[y][x] = 0;
};

const carveWideTile = (grid, x, y, widthTiles, axis) => {
    const width = normalizeHallwayWidthTiles(widthTiles);
    const negativeSpan = Math.floor((width - 1) / 2);
    const positiveSpan = width - 1 - negativeSpan;

    if (axis === 'horizontal') {
        for (let offset = -negativeSpan; offset <= positiveSpan; offset += 1) {
            carveTile(grid, x, y + offset);
        }
        return;
    }

    if (axis === 'vertical') {
        for (let offset = -negativeSpan; offset <= positiveSpan; offset += 1) {
            carveTile(grid, x + offset, y);
        }
        return;
    }

    // For junctions, clear a small cross to avoid single-tile pinch points.
    carveWideTile(grid, x, y, width, 'horizontal');
    carveWideTile(grid, x, y, width, 'vertical');
};

const carvePath = (grid, from, to, widthTiles = 1) => {
    let { x, y } = from;
    carveWideTile(grid, x, y, widthTiles);

    while (x !== to.x) {
        x += x < to.x ? 1 : -1;
        carveWideTile(grid, x, y, widthTiles, 'horizontal');
    }

    while (y !== to.y) {
        y += y < to.y ? 1 : -1;
        carveWideTile(grid, x, y, widthTiles, 'vertical');
    }
};

const generateClosedRoomGrid = (rng, doors) => {
    const grid = createGrid(1);

    doors.forEach((door) => {
        applyDoorOpening(grid, door);
    });
    ensureDoorInteriorsClear(grid, doors);

    const doorCenters = doors.map((door) => ({
        center: doorInteriorCenter(door),
        width: normalizeHallwayWidthTiles(door.hallwayWidthTiles),
    }));
    const anchor = {
        x: randomInt(rng, Math.floor(GRID_SIZE * 0.35), Math.ceil(GRID_SIZE * 0.65)),
        y: randomInt(rng, Math.floor(GRID_SIZE * 0.35), Math.ceil(GRID_SIZE * 0.65)),
    };

    doorCenters.forEach(({ center, width }) => {
        carvePath(grid, center, anchor, width);
    });

    // add slight branches for natural variation
    const branches = randomInt(rng, 1, 3);
    const branchWidth = normalizeHallwayWidthTiles(DEFAULT_HALLWAY_TYPE.minWidthTiles);
    for (let i = 0; i < branches; i += 1) {
        const offsetX = randomInt(rng, -3, 3);
        const offsetY = randomInt(rng, -3, 3);
        const target = {
            x: clamp(anchor.x + offsetX, 1, GRID_SIZE - 2),
            y: clamp(anchor.y + offsetY, 1, GRID_SIZE - 2),
        };
        carvePath(grid, anchor, target, branchWidth);
    }

    return grid;
};

const buildDoorData = ({ layout, spriteHalf, rng, hallwayType = 'random' }) => {
    const doors = layout.doors.map((edge) => {
        const resolvedType = resolveHallwayType(rng, hallwayType);
        const hallwayWidthTiles = resolveHallwayWidthTiles(rng, resolvedType);
        const rect = centeredDoorRect(edge, hallwayWidthTiles);
        const door = {
            ...rect,
            hallwayType: resolvedType.id,
            hallwayWidthTiles,
        };
        return {
            ...door,
            spawn: spawnPointForDoor(door, spriteHalf),
        };
    });
    return doors;
};

const buildRoomGrid = (doors, variantChoice, seed) => {
    const doorTiles = doors.flatMap(doorInteriorTiles);

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const rng = mulberry32((seed + attempt) >>> 0);
        const grid =
            variantChoice === 'closed'
                ? generateClosedRoomGrid(rng, doors)
                : generateOpenRoomGrid(rng, doors);

        if (hasConnectivity(grid, doorTiles)) {
            return grid;
        }
    }

    // fallback to open grid if all attempts failed
    const fallbackRng = mulberry32(seed >>> 0);
    return generateOpenRoomGrid(fallbackRng, doors);
};

export const createRandomRoom = (options = {}) => {
    const {
        requiredEdges = [],
        spriteHalf = TILE_SIZE,
        variant = 'random',
        seed = Math.floor(Math.random() * 0xffffffff),
        hallwayType = 'random',
    } = options;

    const rng = mulberry32(seed >>> 0);
    const candidates = ROOM_LAYOUTS.filter((layout) =>
        requiredEdges.every((edge) => layout.doors.includes(edge)),
    );
    const layouts = candidates.length > 0 ? candidates : ROOM_LAYOUTS;
    const layout = layouts[Math.floor(rng() * layouts.length)];

    const variantChoice =
        variant === 'random'
            ? rng() < 0.5
                ? 'open'
                : 'closed'
            : variant;

    const doors = buildDoorData({ layout, spriteHalf, rng, hallwayType });
    const grid = buildRoomGrid(doors, variantChoice, seed);

    return {
        id: layout.id,
        doors,
        grid,
        variant: variantChoice,
        seed,
    };
};

export const findDoorByEdge = (room, edge) => room.doors.find((door) => door.edge === edge) || null;
