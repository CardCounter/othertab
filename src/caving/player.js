import { TILE_SIZE } from './sprites.js';

export const KEY_MAP = {
  LEFT: 'KeyA',
  RIGHT: 'KeyD',
  UP: 'KeyW',
  DOWN: 'KeyS',
  JUMP: 'Space',
  ATTACK: 'KeyJ',
  DASH_LEFT: 'ShiftLeft',
  DASH_RIGHT: 'ShiftRight',
};

export const JUMP_BUFFER_TIME = 0.18;

const MOVE_MIN_SPEED = 60;
const RUN_ACCEL_SPEED = 40;
const GROUND_RUN_MAX_SPEED = 150;
const MOVE_MAX_SPEED = 200;
const JUMP_SPEED = 210;
const DASH_SPEED = 130;
const DASH_DURATION = 0.2;

const CLIMB_SPEED = 55;

const GRAVITY = 900;
const TERMINAL_VELOCITY = 1100;
const COYOTE_TIME = 0.1;

const JUMP_CUT_MULTIPLIER = 0.35;
const JUMP_CUT_MIN_VELOCITY = -60;
const WALL_KICK_HORIZONTAL_SPEED = 220;
const WALL_KICK_DIRECTION_LOCK_TIME = 0.2;

const MAX_WALL_KICKS_BEFORE_GROUND = 2;
const WALL_KICK_COOLDOWN = 0.15;
const WALL_KICK_BUNNY_WINDOW = 0.12;
const WALL_RUN_REVERSE_GRACE = 0.12;

const GROUND_ACCEL = 3200;
const AIR_ACCEL = 1800;
const EDGE_COOLDOWN = 0.15;
const EDGE_VERTICAL_SNAP = TILE_SIZE * 0.75;
const EDGE_MIN_FALL_SPEED = 40;
const EDGE_GRAB_VERTICAL_WINDOW = TILE_SIZE * 0.35;
const ATTACK_FREEZE_DURATION = 0.17;
const ATTACK_ANIM_DURATION = 0.2;

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
    currentMoveSpeed: MOVE_MIN_SPEED,
    attackFreezeCharged: false,
    attackTimer: 0,
    dashTrigger: false,
    dashActive: false,
    dashVectorX: 0,
    dashVectorY: 0,
    dashTimer: 0,
    dashAvailable: true,
    retainMoveSpeed: false,
    attackFreezeBeforeDash: false,
    dashIsHorizontal: false,
    facing: 1,
    onGround: false,
    onLadder: false,
    onEdge: false,
    onWall: false,
    wallDir: 0,
    edgeSide: null,
    edgeCooldown: 0,
    coyoteTimer: 0,
    jumpBuffer: 0,
    jumpTrigger: false,
    canCutJump: false,
    jumpHeld: false,
    wallKickCooldown: 0,
    wallKickCount: 0,
    wallRunActive: false,
    wallRunDirection: 0,
    wallRunHopWindow: 0,
    wallRunReverseGrace: 0,
    wallKickDirectionLock: 0,
    wallKickDirectionLockTimer: 0,
    animTimer: 0,
  };
}

export function updatePlayer(dt, state) {
  const { player, level, tileDefs, keys } = state;
  const wasGrounded = player.onGround;

  player.animTimer += dt;
  if (player.attackTimer > 0) {
    player.attackTimer = Math.max(0, player.attackTimer - dt);
  }
  if (player.dashActive) {
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    if (player.dashTimer <= 0) {
      player.dashActive = false;
      player.dashVectorX = 0;
      player.dashVectorY = 0;
      if (player.retainMoveSpeed && player.dashIsHorizontal) {
        player.currentMoveSpeed = MOVE_MAX_SPEED;
        player.attackFreezeCharged = true;
      } else {
        const moveSpeedCap = player.onGround ? GROUND_RUN_MAX_SPEED : MOVE_MAX_SPEED;
        player.currentMoveSpeed = Math.min(player.currentMoveSpeed, moveSpeedCap);
      }
      player.retainMoveSpeed = false;
      player.attackFreezeBeforeDash = false;
      player.dashIsHorizontal = false;
    }
  }
  if (player.wallKickDirectionLockTimer > 0) {
    player.wallKickDirectionLockTimer = Math.max(0, player.wallKickDirectionLockTimer - dt);
    if (player.wallKickDirectionLockTimer <= 0) {
      player.wallKickDirectionLock = 0;
    }
  }

  if (player.wallKickCooldown > 0) {
    player.wallKickCooldown = Math.max(0, player.wallKickCooldown - dt);
  }
  if (player.jumpBuffer > 0) {
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    if (player.jumpBuffer <= 0) {
      player.jumpTrigger = false;
    }
  } else {
    player.jumpTrigger = false;
  }
  if (player.coyoteTimer > 0) {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }
  if (player.edgeCooldown > 0) {
    player.edgeCooldown = Math.max(0, player.edgeCooldown - dt);
  }
  if (player.wallRunHopWindow > 0) {
    player.wallRunHopWindow = Math.max(0, player.wallRunHopWindow - dt);
  }
  if (player.wallRunReverseGrace > 0) {
    player.wallRunReverseGrace = Math.max(0, player.wallRunReverseGrace - dt);
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
  const jump = keys.has(KEY_MAP.JUMP);
  const justReleasedJump = player.jumpHeld && !jump;
  const rawHorizontalInput = (right ? 1 : 0) - (left ? 1 : 0);
  const rawVerticalInput = (down ? 1 : 0) - (up ? 1 : 0);
  if (player.dashTrigger) {
    if (!player.dashActive) {
      tryStartDash(player, rawHorizontalInput, rawVerticalInput);
    }
    player.dashTrigger = false;
  }

  let horizontalDir = rawHorizontalInput;
  if (player.wallKickDirectionLockTimer > 0 && horizontalDir !== 0) {
    if (horizontalDir !== player.wallKickDirectionLock) {
      horizontalDir = 0;
    }
  }
  if (
    player.wallRunActive &&
    horizontalDir !== 0 &&
    horizontalDir !== player.wallRunDirection &&
    state.freezeTimer <= 0 &&
    player.wallRunReverseGrace <= 0
  ) {
    endWallRun(player);
  }
  if (!player.dashActive) {
    const moveSpeedCap = wasGrounded ? GROUND_RUN_MAX_SPEED : MOVE_MAX_SPEED;
    if (horizontalDir !== 0) {
      if (player.attackFreezeCharged && player.currentMoveSpeed >= MOVE_MAX_SPEED - 0.01) {
        player.currentMoveSpeed = MOVE_MAX_SPEED;
      } else {
        player.currentMoveSpeed = clamp(
          player.currentMoveSpeed + RUN_ACCEL_SPEED * dt,
          MOVE_MIN_SPEED,
          moveSpeedCap,
        );
        if (
          wasGrounded &&
          !player.attackFreezeCharged &&
          moveSpeedCap - player.currentMoveSpeed < 0.01
        ) {
          player.attackFreezeCharged = true;
        }
      }
    } else {
      player.currentMoveSpeed = MOVE_MIN_SPEED;
      player.attackFreezeCharged = false;
    }
    let maxSpeed = player.currentMoveSpeed;
    const wallRunBoostActive =
      player.wallRunActive && horizontalDir !== 0 && horizontalDir === player.wallRunDirection;
    if (wallRunBoostActive) {
      maxSpeed = MOVE_MAX_SPEED;
      player.currentMoveSpeed = MOVE_MAX_SPEED;
    }
    const targetSpeed = maxSpeed * horizontalDir;
    const acceleration = player.onGround ? GROUND_ACCEL : AIR_ACCEL;
    player.vx = approach(player.vx, targetSpeed, acceleration * dt);

    if (wallRunBoostActive) {
      player.vx = MOVE_MAX_SPEED * horizontalDir;
    }
  } else {
    player.vx = player.dashVectorX;
  }

  if (player.vx !== 0) {
    player.facing = Math.sign(player.vx);
  }

  player.onGround = false;
  player.onLadder = player.dashActive ? false : checkLadderContact(player, level, tileDefs);
  if (player.onLadder && player.wallRunActive) {
    endWallRun(player);
  }

  if (player.onLadder) {
    player.vy = 0;
    const climbDir = (down ? 1 : 0) - (up ? 1 : 0);
    if (climbDir !== 0) {
      player.vy = climbDir * CLIMB_SPEED;
      player.y += player.vy * dt;
    }
  } else if (player.dashActive) {
    player.vy = player.dashVectorY;
  } else {
    player.vy = clamp(player.vy + GRAVITY * dt, -Infinity, TERMINAL_VELOCITY);
  }

  const wallContact = detectWallContact(player, level, tileDefs);
  const canStickToWall =
    player.wallKickCooldown <= 0 &&
    !wasGrounded &&
    !player.onLadder &&
    !player.onEdge &&
    wallContact.onWall;
  if (canStickToWall) {
    player.onWall = true;
    player.wallDir = wallContact.wallDir;
  } else if (!player.onEdge) {
    player.onWall = false;
    player.wallDir = 0;
  }

  const inputTowardWall =
    (player.wallDir === -1 && left) || (player.wallDir === 1 && right);

  if (player.jumpTrigger) {
    const wantsWallKick =
      player.onWall &&
      player.wallKickCooldown <= 0 &&
      inputTowardWall &&
      player.wallKickCount < MAX_WALL_KICKS_BEFORE_GROUND;
    const groundJumpAttempt =
      !wantsWallKick && (player.coyoteTimer > 0 || player.onLadder);
    if (player.onGround || player.coyoteTimer > 0 || player.onLadder || wantsWallKick) {
      player.vy = -JUMP_SPEED;
      player.onGround = false;
      player.onLadder = false;
      player.jumpBuffer = 0;
      player.jumpTrigger = false;
      player.coyoteTimer = 0;
      player.canCutJump = true;
      if (wantsWallKick) {
        const launchDir = player.wallDir === -1 ? 1 : -1;
        player.vx = launchDir * WALL_KICK_HORIZONTAL_SPEED;
        player.currentMoveSpeed = Math.min(Math.abs(player.vx), MOVE_MAX_SPEED);
        player.facing = player.vx >= 0 ? 1 : -1;
        player.wallKickCooldown = WALL_KICK_COOLDOWN;
        player.wallKickCount += 1;
        player.wallRunActive = true;
        player.wallRunDirection = launchDir;
        player.wallRunHopWindow = 0;
        player.wallRunReverseGrace = WALL_RUN_REVERSE_GRACE;
        player.wallKickDirectionLock = launchDir;
        player.wallKickDirectionLockTimer = WALL_KICK_DIRECTION_LOCK_TIME;
        player.onWall = false;
        player.wallDir = 0;
      } else if (player.wallRunActive && groundJumpAttempt) {
        if (player.wallRunHopWindow > 0) {
          player.wallRunHopWindow = 0;
        } else {
          endWallRun(player);
        }
      }
    }
  }

  if (justReleasedJump && player.canCutJump && player.vy < 0) {
    player.vy = Math.max(player.vy * JUMP_CUT_MULTIPLIER, JUMP_CUT_MIN_VELOCITY);
    player.canCutJump = false;
  }

  if (player.vy >= 0) {
    player.canCutJump = false;
  }

  player.x += player.vx * dt;
  resolveHorizontalCollisions(player, level, tileDefs);

  player.y += player.vy * dt;
  const landed = resolveVerticalCollisions(player, level, tileDefs);
  if (landed) {
    player.animTimer = 0;
    player.wallKickCooldown = 0;
    player.wallKickDirectionLock = 0;
    player.wallKickDirectionLockTimer = 0;
    if (player.wallRunActive) {
      if (!wasGrounded) {
        player.wallRunHopWindow = WALL_KICK_BUNNY_WINDOW;
      }
    } else {
      player.wallRunHopWindow = 0;
    }
  }

  const postWallContact = detectWallContact(player, level, tileDefs);
  const canStickAfterMove =
    player.wallKickCooldown <= 0 &&
    !player.onGround &&
    !player.onLadder &&
    !player.onEdge &&
    postWallContact.onWall;
  if (canStickAfterMove) {
    player.onWall = true;
    player.wallDir = postWallContact.wallDir;
  } else if (!player.onEdge) {
    player.onWall = false;
    player.wallDir = 0;
  }

  if (player.wallRunActive && player.onGround && player.wallRunHopWindow <= 0) {
    endWallRun(player);
  }

  if (player.onGround) {
    player.dashAvailable = true;
    player.attackFreezeBeforeDash = false;
    player.dashIsHorizontal = false;
  }

  player.jumpHeld = jump;

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
    player.currentMoveSpeed = MOVE_MIN_SPEED;
    player.attackFreezeCharged = false;
    player.attackTimer = 0;
    player.wallKickDirectionLock = 0;
    player.wallKickDirectionLockTimer = 0;
    player.dashTrigger = false;
    player.dashActive = false;
    player.dashVectorX = 0;
    player.dashVectorY = 0;
    player.dashTimer = 0;
    player.dashAvailable = true;
    player.retainMoveSpeed = false;
    player.attackFreezeBeforeDash = false;
    player.dashIsHorizontal = false;
    player.onEdge = false;
    player.edgeSide = null;
    player.canCutJump = false;
    player.jumpTrigger = false;
    player.jumpHeld = false;
    player.onWall = false;
    player.wallDir = 0;
    player.wallKickCooldown = 0;
    player.wallKickCount = 0;
    endWallRun(player);
  }
}

function updateEdgeHold(state) {
  const { player, keys } = state;
  player.prevX = player.x;
  player.prevY = player.y;
  player.vx = 0;
  player.vy = 0;
  player.currentMoveSpeed = MOVE_MIN_SPEED;
  player.attackFreezeCharged = false;
  player.attackTimer = 0;
  player.onGround = false;
  player.wallKickCooldown = 0;
  player.jumpTrigger = false;
  endWallRun(player);
  player.onWall = false;
  player.wallDir = 0;
  player.wallKickDirectionLock = 0;
  player.wallKickDirectionLockTimer = 0;
  player.dashTrigger = false;
  player.dashActive = false;
  player.dashVectorX = 0;
  player.dashVectorY = 0;
  player.dashTimer = 0;
  player.retainMoveSpeed = false;
  player.attackFreezeBeforeDash = false;
  player.dashIsHorizontal = false;
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
  player.vx = dir * MOVE_MAX_SPEED;
  player.currentMoveSpeed = MOVE_MAX_SPEED;
  player.canCutJump = true;
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
    const sampleX =
      side === 1 ? player.x + player.width + 0.1 : player.x - 0.1;
    const tileX = Math.floor(sampleX / TILE_SIZE);
    for (let ty = topTile; ty <= bottomTile; ty += 1) {
      if (!isSolid(tileDefs, level.get(tileX, ty))) {
        continue;
      }
      if (isSolid(tileDefs, level.get(tileX, ty - 1))) {
        continue;
      }
      const tileTop = ty * TILE_SIZE;
      if (player.y > tileTop + EDGE_GRAB_VERTICAL_WINDOW) {
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
  const buffer = 0.001;

  if (side === 'left') {
    player.x = tileRight + buffer;
  } else {
    player.x = tileLeft - player.width - buffer;
  }

  player.y = tileTop - player.height + EDGE_VERTICAL_SNAP;
  player.prevX = player.x;
  player.prevY = player.y;
  player.vx = 0;
  player.vy = 0;
  player.currentMoveSpeed = MOVE_MIN_SPEED;
  player.attackFreezeCharged = false;
  player.attackTimer = 0;
  player.onEdge = true;
  player.edgeSide = side;
  player.coyoteTimer = 0;
  player.jumpBuffer = 0;
  player.jumpTrigger = false;
  player.canCutJump = false;
  player.jumpHeld = false;
  player.onWall = false;
  player.wallDir = 0;
  player.wallKickCooldown = 0;
  player.wallKickDirectionLock = 0;
  player.wallKickDirectionLockTimer = 0;
  player.dashTrigger = false;
  player.dashActive = false;
  player.dashVectorX = 0;
  player.dashVectorY = 0;
  player.dashTimer = 0;
  player.retainMoveSpeed = false;
  player.attackFreezeBeforeDash = false;
  player.dashIsHorizontal = false;
  endWallRun(player);
  player.animTimer = 0;
}

function endWallRun(player) {
  player.wallRunActive = false;
  player.wallRunDirection = 0;
  player.wallRunHopWindow = 0;
  player.wallRunReverseGrace = 0;
}

function tryStartDash(player, horizontalInput, verticalInput) {
  if (!player.dashAvailable) {
    return false;
  }
  const horizontalDir = Math.sign(horizontalInput);
  const verticalDir = Math.sign(verticalInput);
  if (horizontalDir === 0 && verticalDir === 0) {
    return false;
  }
  const magnitude = Math.hypot(horizontalDir, verticalDir) || 1;
  const normX = horizontalDir / magnitude;
  const normY = verticalDir / magnitude;
  player.dashAvailable = false;
  player.dashActive = true;
  player.dashTimer = DASH_DURATION;
  player.dashVectorX = normX * DASH_SPEED;
  player.dashVectorY = normY * DASH_SPEED;
  player.dashIsHorizontal = verticalDir === 0;
  player.currentMoveSpeed = Math.max(player.currentMoveSpeed, GROUND_RUN_MAX_SPEED);
  player.vx = player.dashVectorX;
  player.vy = player.dashVectorY;
  player.onLadder = false;
  player.canCutJump = false;
  player.attackTimer = 0;
  endWallRun(player);
  if (normX !== 0) {
    player.facing = normX > 0 ? 1 : -1;
  }
  return true;
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
        player.canCutJump = false;
        player.wallKickCount = 0;
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
        player.canCutJump = false;
        break;
      }
    }
  }
  return landed;
}

function detectWallContact(player, level, tileDefs) {
  const { y0, y1 } = rectToTiles(player.x, player.y, player.width, player.height);
  const leftTileX = Math.floor((player.x - 0.01) / TILE_SIZE);
  const rightTileX = Math.floor((player.x + player.width + 0.01) / TILE_SIZE);

  for (let ty = y0; ty <= y1; ty += 1) {
    if (isSolid(tileDefs, level.get(leftTileX, ty))) {
      return { onWall: true, wallDir: -1 };
    }
  }

  for (let ty = y0; ty <= y1; ty += 1) {
    if (isSolid(tileDefs, level.get(rightTileX, ty))) {
      return { onWall: true, wallDir: 1 };
    }
  }

  return { onWall: false, wallDir: 0 };
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
  player.attackTimer = ATTACK_ANIM_DURATION;
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  const now = performance.now();
  const duration = 160;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      // Skip the center tile (where player is)
      if (dx === 0 && dy === 0) {
        continue;
      }
      const tileX = Math.floor((centerX + dx * TILE_SIZE) / TILE_SIZE);
      const tileY = Math.floor((centerY + dy * TILE_SIZE) / TILE_SIZE);
      const tile = level.get(tileX, tileY);
      if (!isSolid(tileDefs, tile)) {
        attackMarks.push({
          offsetX: dx * TILE_SIZE - TILE_SIZE / 2,
          offsetY: dy * TILE_SIZE - TILE_SIZE / 2,
          until: now + duration,
        });
      }
    }
  }

  const airborneFreezeReady =
    state.freezeTimer <= 0 &&
    !player.onGround &&
    Math.abs(player.vx) >= MOVE_MAX_SPEED - 1 &&
    player.attackFreezeCharged;
  const wallRunFreezeReady =
    state.freezeTimer <= 0 &&
    player.wallRunActive &&
    !player.onGround &&
    Math.abs(player.vx) >= MOVE_MAX_SPEED - 1;

  if (airborneFreezeReady || wallRunFreezeReady) {
    state.freezeTimer = ATTACK_FREEZE_DURATION;
    state.freezeAllowsDirectionSwap = true;
    state.freezeStoredDirection =
      player.wallRunDirection || Math.sign(player.vx) || state.freezeStoredDirection || 0;
    state.freezeAtMaxSpeed = player.currentMoveSpeed >= MOVE_MAX_SPEED - 0.01;
    if (airborneFreezeReady) {
      player.attackFreezeCharged = false;
    }
  }
}

export function pickPlayerSprite(player, sprites, keys) {
  if (player.dashActive) {
    return sprites.player_dash ?? sprites.player;
  }
  if (player.attackTimer > 0) {
    return sprites.player_attack ?? sprites.player;
  }
  if (Math.abs(player.vx) >= MOVE_MAX_SPEED - 1) {
    return sprites.player_max_speed ?? sprites.player;
  }
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
