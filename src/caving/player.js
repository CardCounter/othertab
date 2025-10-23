import { TILE_SIZE } from './sprites.js';

export const KEY_MAP = {
  LEFT: 'KeyA',
  RIGHT: 'KeyD',
  UP: 'KeyW',
  DOWN: 'KeyS',
  JUMP: 'Space',
  SHIFT_LEFT: 'ShiftLeft',
  SHIFT_RIGHT: 'ShiftRight',
  ATTACK: 'Semicolon',
};

export const JUMP_BUFFER_TIME = 0.18;

const WALK_SPEED = 80;
const RUN_SPEED = 115;
const CLIMB_SPEED = 55;
const JUMP_SPEED = 200;
const GRAVITY = 900;
const TERMINAL_VELOCITY = 1100;
const COYOTE_TIME = 0.1;

const GROUND_ACCEL = 3200;
const AIR_ACCEL = 1800;
const EDGE_COOLDOWN = 0.15;
const EDGE_VERTICAL_SNAP = TILE_SIZE * 0.3;
const EDGE_MIN_FALL_SPEED = 40;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function approach(current, target, delta) {
  if (current < target) {
    return Math.min(current + delta, target);
  }
  if (current > target) {
    return Math.max(current - delta, target);
  }
  return target;
}

export function createPlayer() {
  const hitboxWidth = TILE_SIZE;
  const hitboxHeight = TILE_SIZE * 0.95;
  return {
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    width: hitboxWidth,
    height: hitboxHeight,
    drawOffsetX: 0,
    drawOffsetY: hitboxHeight - TILE_SIZE,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    onLadder: false,
    onEdge: false,
    edgeSide: null,
    edgeCooldown: 0,
    coyoteTimer: 0,
    jumpBuffer: 0,
    animTimer: 0,
  };
}

export function updatePlayer(dt, state) {
  const { player, level, tileDefs, keys } = state;

  player.animTimer += dt;

  if (player.jumpBuffer > 0) {
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  }
  if (player.coyoteTimer > 0) {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }
  if (player.edgeCooldown > 0) {
    player.edgeCooldown = Math.max(0, player.edgeCooldown - dt);
  }

  if (player.onEdge) {
    if (updateEdgeHold(state)) {
      return;
    }
  }

  const left = keys.has(KEY_MAP.LEFT);
  const right = keys.has(KEY_MAP.RIGHT);
  const up = keys.has(KEY_MAP.UP);
  const down = keys.has(KEY_MAP.DOWN);
  const shift = keys.has(KEY_MAP.SHIFT_LEFT) || keys.has(KEY_MAP.SHIFT_RIGHT);

  const horizontalDir = (right ? 1 : 0) - (left ? 1 : 0);
  const targetSpeed = (shift ? RUN_SPEED : WALK_SPEED) * horizontalDir;
  const acceleration = player.onGround ? GROUND_ACCEL : AIR_ACCEL;
  player.vx = approach(player.vx, targetSpeed, acceleration * dt);

  if (player.vx !== 0) {
    player.facing = Math.sign(player.vx);
  }

  player.onGround = false;
  player.onLadder = checkLadderContact(player, level, tileDefs);

  if (player.onLadder) {
    player.vy = 0;
    const climbDir = (down ? 1 : 0) - (up ? 1 : 0);
    if (climbDir !== 0) {
      player.vy = climbDir * CLIMB_SPEED;
      player.y += player.vy * dt;
    }
  } else {
    player.vy = clamp(player.vy + GRAVITY * dt, -Infinity, TERMINAL_VELOCITY);
  }

  if (player.jumpBuffer > 0) {
    if (player.onGround || player.coyoteTimer > 0 || player.onLadder) {
      player.vy = -JUMP_SPEED;
      player.onGround = false;
      player.onLadder = false;
      player.jumpBuffer = 0;
      player.coyoteTimer = 0;
    }
  }

  player.x += player.vx * dt;
  resolveHorizontalCollisions(player, level, tileDefs);

  player.y += player.vy * dt;
  const landed = resolveVerticalCollisions(player, level, tileDefs);
  if (landed) {
    player.animTimer = 0;
  }

  if (!player.onEdge) {
    tryEdgeGrab(player, level, tileDefs);
  }

  if (player.y > level.height * TILE_SIZE) {
    player.x = TILE_SIZE * 5;
    player.y = TILE_SIZE * 5;
    player.prevX = player.x;
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.onEdge = false;
    player.edgeSide = null;
  }
}

function updateEdgeHold(state) {
  const { player, keys } = state;
  player.prevX = player.x;
  player.prevY = player.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.animTimer = 0;

  const jumpBuffered = player.jumpBuffer > 0;
  const down = keys.has(KEY_MAP.DOWN);
  const left = keys.has(KEY_MAP.LEFT);
  const right = keys.has(KEY_MAP.RIGHT);

  if (!jumpBuffered) {
    return true;
  }

  player.jumpBuffer = 0;

  if (down) {
    player.onEdge = false;
    player.edgeSide = null;
    player.edgeCooldown = EDGE_COOLDOWN;
    player.vy = EDGE_MIN_FALL_SPEED;
    return false;
  }

  let dir = 0;
  if (left) dir -= 1;
  if (right) dir += 1;
  if (dir === 0) {
    dir = player.edgeSide === 'left' ? -1 : 1;
  }

  player.onEdge = false;
  player.edgeSide = null;
  player.edgeCooldown = EDGE_COOLDOWN;
  player.vy = -JUMP_SPEED;
  player.vx = dir * RUN_SPEED;
  player.coyoteTimer = 0;
  return false;
}

function tryEdgeGrab(player, level, tileDefs) {
  if (player.onGround || player.onLadder || player.onEdge) {
    return false;
  }
  if (player.edgeCooldown > 0) {
    return false;
  }
  if (player.vy <= EDGE_MIN_FALL_SPEED) {
    return false;
  }

  const topTile = Math.floor(player.y / TILE_SIZE);
  const bottomTile = Math.floor((player.y + player.height - 1) / TILE_SIZE);

  for (const side of [-1, 1]) {
    const sampleX = side === 1 ? player.x + player.width : player.x - 1;
    const tileX = Math.floor(sampleX / TILE_SIZE);
    for (let ty = topTile; ty <= bottomTile; ty += 1) {
      if (!isSolid(tileDefs, level.get(tileX, ty))) {
        continue;
      }
      if (isSolid(tileDefs, level.get(tileX, ty - 1))) {
        continue;
      }
      const tileTop = ty * TILE_SIZE;
      if (player.y > tileTop + TILE_SIZE) {
        continue;
      }
      startEdgeGrab(player, side === -1 ? 'left' : 'right', tileX, tileTop);
      return true;
    }
  }

  return false;
}

function startEdgeGrab(player, side, tileX, tileTop) {
  const tileLeft = tileX * TILE_SIZE;
  const tileRight = tileLeft + TILE_SIZE;

  if (side === 'left') {
    player.x = tileRight - player.width - 0.001;
  } else {
    player.x = tileLeft + 0.001;
  }

  player.y = tileTop - player.height + EDGE_VERTICAL_SNAP;
  player.prevX = player.x;
  player.prevY = player.y;
  player.vx = 0;
  player.vy = 0;
  player.onEdge = true;
  player.edgeSide = side;
  player.coyoteTimer = 0;
  player.jumpBuffer = 0;
  player.animTimer = 0;
}

function rectToTiles(x, y, width, height) {
  const x0 = Math.floor(x / TILE_SIZE);
  const x1 = Math.floor((x + width - 0.001) / TILE_SIZE);
  const y0 = Math.floor(y / TILE_SIZE);
  const y1 = Math.floor((y + height - 0.001) / TILE_SIZE);
  return { x0, x1, y0, y1 };
}

function isSolid(tileDefs, tileId) {
  const def = tileDefs[tileId];
  return Boolean(def && def.solid);
}

function isClimbable(tileDefs, tileId) {
  const def = tileDefs[tileId];
  return Boolean(def && def.climbable);
}

function resolveHorizontalCollisions(player, level, tileDefs) {
  const bounds = rectToTiles(player.x, player.y, player.width, player.height);
  if (player.vx > 0) {
    for (let ty = bounds.y0; ty <= bounds.y1; ty += 1) {
      const tile = level.get(bounds.x1, ty);
      if (isSolid(tileDefs, tile)) {
        player.x = bounds.x1 * TILE_SIZE - player.width - 0.001;
        player.vx = 0;
        return;
      }
    }
  } else if (player.vx < 0) {
    for (let ty = bounds.y0; ty <= bounds.y1; ty += 1) {
      const tile = level.get(bounds.x0, ty);
      if (isSolid(tileDefs, tile)) {
        player.x = (bounds.x0 + 1) * TILE_SIZE + 0.001;
        player.vx = 0;
        return;
      }
    }
  }
}

function resolveVerticalCollisions(player, level, tileDefs) {
  let landed = false;
  const bounds = rectToTiles(player.x, player.y, player.width, player.height);
  if (player.vy > 0) {
    for (let tx = bounds.x0; tx <= bounds.x1; tx += 1) {
      const tile = level.get(tx, bounds.y1);
      if (isSolid(tileDefs, tile)) {
        player.y = bounds.y1 * TILE_SIZE - player.height - 0.001;
        player.vy = 0;
        player.onGround = true;
        player.coyoteTimer = COYOTE_TIME;
        landed = true;
        break;
      }
    }
  } else if (player.vy < 0) {
    for (let tx = bounds.x0; tx <= bounds.x1; tx += 1) {
      const tile = level.get(tx, bounds.y0);
      if (isSolid(tileDefs, tile)) {
        player.y = (bounds.y0 + 1) * TILE_SIZE + 0.001;
        player.vy = 0;
        break;
      }
    }
  }
  return landed;
}

function checkLadderContact(player, level, tileDefs) {
  const xStart = Math.floor(player.x / TILE_SIZE);
  const xEnd = Math.floor((player.x + player.width) / TILE_SIZE);
  const yStart = Math.floor(player.y / TILE_SIZE);
  const yEnd = Math.floor((player.y + player.height) / TILE_SIZE);
  for (let x = xStart; x <= xEnd; x += 1) {
    for (let y = yStart; y <= yEnd; y += 1) {
      if (isClimbable(tileDefs, level.get(x, y))) {
        return true;
      }
    }
  }
  return false;
}

export function handleAttack(state) {
  const { player, level, tileDefs, attackMarks } = state;
  const centerTileX = Math.floor((player.x + player.width / 2) / TILE_SIZE);
  const centerTileY = Math.floor((player.y + player.height / 2) / TILE_SIZE);
  const now = performance.now();
  const duration = 160;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const tx = centerTileX + dx;
      const ty = centerTileY + dy;
      const tile = level.get(tx, ty);
      if (!isSolid(tileDefs, tile)) {
        attackMarks.push({
          x: tx,
          y: ty,
          until: now + duration,
        });
      }
    }
  }
}

export function pickPlayerSprite(player, sprites, keys) {
  if (player.onEdge) {
    return sprites.player;
  }
  if (player.onLadder) {
    return sprites.player;
  }
  if (!player.onGround) {
    return sprites.player;
  }
  if (Math.abs(player.vx) > 10) {
    return sprites.player;
  }
  return sprites.player;
}
