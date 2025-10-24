import { TILE_SIZE, loadSpriteResources } from './sprites.js';
import { generateSpriteLevel } from './level/generateLevel.js';
import { startGameLoop } from './loop.js';
import {
  KEY_MAP,
  JUMP_BUFFER_TIME,
  createPlayer,
  updatePlayer,
  handleAttack,
  pickPlayerSprite,
} from './player.js';

function installGlobalErrorOverlay() {
  const overlay = (message) => {
    if (!document.body) return;
    const pre = document.createElement('pre');
    pre.style.position = 'fixed';
    pre.style.top = '0';
    pre.style.left = '0';
    pre.style.right = '0';
    pre.style.bottom = '0';
    pre.style.margin = '0';
    pre.style.padding = '1rem';
    pre.style.background = 'rgba(0, 0, 0, 0.85)';
    pre.style.color = '#ff7676';
    pre.style.fontFamily = 'monospace';
    pre.style.fontSize = '14px';
    pre.style.overflow = 'auto';
    pre.textContent = message;
    document.body.innerHTML = '';
    document.body.appendChild(pre);
  };

  window.addEventListener('error', (event) => {
    const stack = event.error?.stack ?? event.message;
    overlay(`Runtime error:\\n${stack}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      typeof reason === 'object' && reason !== null
        ? reason.stack ?? JSON.stringify(reason, null, 2)
        : String(reason);
    console.error('Unhandled promise rejection', reason);
    overlay(`Unhandled promise rejection:\\n${message}`);
  });
}

installGlobalErrorOverlay();

const VIEW_TILES_X = 28;
const VIEW_TILES_Y = 18;
const WORLD_WIDTH = 120;
const WORLD_HEIGHT = 80;

let canvas = null;
let ctx = null;

let devicePixelRatioValue = window.devicePixelRatio || 1;

const state = {
  sheet: null,
  sprites: null,
  lookup: null,
  sheetSelector: null,
  darkModeListener: null,
  backgroundColor: '#ffffff',
  level: null,
  tileDefs: null,
  player: null,
  camera: null,
  keys: new Set(),
  attackMarks: [],
  stopLoop: null,
  freezeTimer: 0,
  freezeAllowsDirectionSwap: false,
  freezeStoredDirection: 0,
  freezeAtMaxSpeed: false,
};

class Level {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: height }, () =>
      new Array(width).fill('air'),
    );
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 'void';
    }
    return this.tiles[y][x];
  }

  set(x, y, value) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.tiles[y][x] = value;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildTileDefinitions(sprites) {
  const atlas = sprites;
  return {
    air: { solid: false },
    void: { solid: true },
    ground: { solid: true, sprite: atlas.tile_ground ?? atlas.tile_soil },
    stone: { solid: true, sprite: atlas.tile_stone ?? atlas.tile_ground },
    ladder: { solid: false, climbable: true, sprite: atlas.tile_ladder ?? atlas.tile_rope },
    rope: { solid: false, climbable: true, sprite: atlas.tile_rope ?? atlas.tile_ladder },
    crate: { solid: true, sprite: atlas.tile_crate ?? atlas.tile_ground },
    treasure: { solid: false, sprite: atlas.tile_treasure ?? atlas.tile_crate },
    torch: { solid: false, sprite: atlas.tile_torch ?? atlas.tile_treasure },
  };
}

function resolveBackgroundColor() {
  const computed = getComputedStyle(document.documentElement).getPropertyValue(
    '--page-background-color',
  );
  const color = computed && computed.trim();
  if (color) return color;
  return document.body.classList.contains('dark-mode') ? '#000000' : '#ffffff';
}

function setupCanvas() {
  canvas = document.getElementById('game');
  if (!canvas) {
    throw new Error('Canvas element with id "game" not found.');
  }
  ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D context for #game canvas.');
  }
  ctx.imageSmoothingEnabled = false;
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  devicePixelRatioValue = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * devicePixelRatioValue);
  canvas.height = Math.round(height * devicePixelRatioValue);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.imageSmoothingEnabled = false;
}

function updateCamera(camera, player, level) {
  const cssWidth = canvas.width / devicePixelRatioValue;
  const cssHeight = canvas.height / devicePixelRatioValue;
  camera.scale = Math.max(
    1,
    Math.floor(
      Math.min(
        cssWidth / (VIEW_TILES_X * TILE_SIZE),
        cssHeight / (VIEW_TILES_Y * TILE_SIZE),
      ),
    ),
  );

  camera.viewportWidth = cssWidth / camera.scale;
  camera.viewportHeight = cssHeight / camera.scale;

  const targetX = player.x + player.width / 2;
  const targetY = player.y + player.height / 2;

  const maxX = level.width * TILE_SIZE - camera.viewportWidth;
  const maxY = level.height * TILE_SIZE - camera.viewportHeight;

  const softZoneWidth = camera.viewportWidth * 0.4;
  const softZoneHeight = camera.viewportHeight * 0.35;
  const zoneLeft = camera.x + (camera.viewportWidth - softZoneWidth) / 2;
  const zoneRight = zoneLeft + softZoneWidth;
  const zoneTop = camera.y + (camera.viewportHeight - softZoneHeight) / 2;
  const zoneBottom = zoneTop + softZoneHeight;

  if (targetX < zoneLeft) {
    camera.x += targetX - zoneLeft;
  } else if (targetX > zoneRight) {
    camera.x += targetX - zoneRight;
  }

  if (targetY < zoneTop) {
    camera.y += targetY - zoneTop;
  } else if (targetY > zoneBottom) {
    camera.y += targetY - zoneBottom;
  }

  camera.x = clamp(camera.x, 0, Math.max(0, maxX));
  camera.y = clamp(camera.y, 0, Math.max(0, maxY));
}

function drawLevel(ctx2d, stateObj) {
  const { level, sheet, tileDefs, camera } = stateObj;

  const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
  const endX = Math.min(level.width, Math.ceil((camera.x + camera.viewportWidth) / TILE_SIZE));
  const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
  const endY = Math.min(level.height, Math.ceil((camera.y + camera.viewportHeight) / TILE_SIZE));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const tileId = level.get(x, y);
      const def = tileDefs[tileId];
      if (def && def.sprite) {
        sheet.draw(ctx2d, def.sprite, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
  }
}

function drawAttackMarks(ctx2d, stateObj) {
  const { attackMarks, camera, sheet, sprites, player } = stateObj;
  const now = performance.now();
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;

  for (let i = attackMarks.length - 1; i >= 0; i -= 1) {
    const mark = attackMarks[i];
    if (mark.until < now) {
      attackMarks.splice(i, 1);
      continue;
    }
    const x = centerX + mark.offsetX;
    const y = centerY + mark.offsetY;
    sheet.draw(ctx2d, sprites.player_attack_weapon, x, y);
  }
}

function drawPlayer(ctx2d, stateObj) {
  const { player, sprites, sheet, keys } = stateObj;
  const spriteName = pickPlayerSprite(player, sprites, keys);
  if (!spriteName) return;
  const drawX = player.x + (player.drawOffsetX ?? 0);
  const drawY = player.y + (player.drawOffsetY ?? 0);
  sheet.draw(ctx2d, spriteName, drawX, drawY, {
    flip: player.facing < 0,
  });
}

function getHorizontalInputDirection(keys) {
  let dir = 0;
  if (keys.has(KEY_MAP.LEFT)) dir -= 1;
  if (keys.has(KEY_MAP.RIGHT)) dir += 1;
  return dir;
}

function resolveFreezeDirection() {
  if (!state.freezeAllowsDirectionSwap) {
    return;
  }

  const player = state.player;
  if (!player) {
    state.freezeAllowsDirectionSwap = false;
    state.freezeStoredDirection = 0;
    state.freezeAtMaxSpeed = false;
    return;
  }

  const direction = getHorizontalInputDirection(state.keys);
  let chosenDirection = direction;
  if (chosenDirection === 0) {
    chosenDirection =
      state.freezeStoredDirection || player.wallRunDirection || 0;
  }

  if (player.wallRunActive && chosenDirection !== 0) {
    player.wallRunDirection = chosenDirection;
  }

  state.freezeAllowsDirectionSwap = false;
  state.freezeStoredDirection = 0;
  state.freezeAtMaxSpeed = false;
}

function stepSimulation(dt) {
  const { player, camera } = state;
  player.prevX = player.x;
  player.prevY = player.y;
  if (state.freezeTimer > 0) {
    if (player.dashTrigger) {
      player.attackFreezeBeforeDash = true;
      player.retainMoveSpeed = state.freezeAtMaxSpeed;
      state.freezeTimer = 0;
      resolveFreezeDirection();
    } else {
      state.freezeTimer = Math.max(0, state.freezeTimer - dt);
      if (state.freezeTimer === 0) {
        resolveFreezeDirection();
      }
      camera.prevX = camera.x;
      camera.prevY = camera.y;
      camera.prevScale = camera.scale;
      return;
    }
  }

  updatePlayer(dt, state);
  camera.prevX = camera.x;
  camera.prevY = camera.y;
  camera.prevScale = camera.scale;
  updateCamera(camera, player, state.level);
}

function renderScene(alpha = 0) {
  const { camera, player } = state;
  const prevCamX = camera.prevX ?? camera.x;
  const prevCamY = camera.prevY ?? camera.y;
  const prevCamScale = camera.prevScale ?? camera.scale;
  const camX = prevCamX + (camera.x - prevCamX) * alpha;
  const camY = prevCamY + (camera.y - prevCamY) * alpha;
  const camScale = prevCamScale + (camera.scale - prevCamScale) * alpha;

  const prevPlayerX = player.prevX ?? player.x;
  const prevPlayerY = player.prevY ?? player.y;
  const playerX = prevPlayerX + (player.x - prevPlayerX) * alpha;
  const playerY = prevPlayerY + (player.y - prevPlayerY) * alpha;

  const renderPlayer = {
    ...player,
    x: playerX,
    y: playerY,
  };

  const renderCamera = {
    ...camera,
    x: camX,
    y: camY,
    scale: camScale,
  };

  const renderState = {
    ...state,
    player: renderPlayer,
    camera: renderCamera,
  };

  ctx.save();
  ctx.setTransform(devicePixelRatioValue, 0, 0, devicePixelRatioValue, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const cssWidth = canvas.width / devicePixelRatioValue;
  const cssHeight = canvas.height / devicePixelRatioValue;
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = renderState.backgroundColor;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.scale(camScale, camScale);
  ctx.translate(-camX, -camY);

  drawLevel(ctx, renderState);
  drawAttackMarks(ctx, renderState);
  drawPlayer(ctx, renderState);

  ctx.restore();
}

function onKeyDown(event) {
  if (
    event.code === KEY_MAP.LEFT ||
    event.code === KEY_MAP.RIGHT ||
    event.code === KEY_MAP.UP ||
    event.code === KEY_MAP.DOWN ||
    event.code === KEY_MAP.JUMP ||
    event.code === KEY_MAP.DASH_LEFT ||
    event.code === KEY_MAP.DASH_RIGHT
  ) {
    event.preventDefault();
  }

  if (event.code === KEY_MAP.DASH_LEFT || event.code === KEY_MAP.DASH_RIGHT) {
    if (!event.repeat) {
      state.player.dashTrigger = true;
    }
  }

  if (event.code === KEY_MAP.ATTACK) {
    if (!event.repeat) {
      handleAttack(state);
    }
    return;
  }

  if (event.code === KEY_MAP.JUMP) {
    if (!event.repeat) {
      state.player.jumpBuffer = JUMP_BUFFER_TIME;
      state.player.jumpTrigger = true;
    }
  }

  state.keys.add(event.code);
}

function onKeyUp(event) {
  if (event.code === KEY_MAP.JUMP) {
    state.player.jumpBuffer = 0;
    state.player.jumpTrigger = false;
  }
  state.keys.delete(event.code);
}

async function init() {
  setupCanvas();
  resizeCanvas();

  const { sheet, lookup, sprites, getSheetForMode } = await loadSpriteResources();
  state.backgroundColor = resolveBackgroundColor();
  const level = await generateSpriteLevel(Level, WORLD_WIDTH, WORLD_HEIGHT);
  const tileDefs = buildTileDefinitions(sprites);
  const player = createPlayer();
  const spawnTile = level.spawnTile ?? { x: 5, y: 10 };
  player.x = spawnTile.x * TILE_SIZE;
  player.y = (spawnTile.y + 1) * TILE_SIZE - player.height;
  player.prevX = player.x;
  player.prevY = player.y;
  const camera = {
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    scale: 3,
    prevScale: 3,
    viewportWidth: 0,
    viewportHeight: 0,
  };

  state.sheet = sheet;
  state.sprites = sprites;
  state.lookup = lookup;
  state.sheetSelector = getSheetForMode;
  state.level = level;
  state.tileDefs = tileDefs;
  state.player = player;
  state.camera = camera;

  updateCamera(camera, player, level);
  camera.prevX = camera.x;
  camera.prevY = camera.y;
  camera.prevScale = camera.scale;

  window.addEventListener('resize', () => {
    resizeCanvas();
    updateCamera(camera, player, level);
    camera.prevX = camera.x;
    camera.prevY = camera.y;
    camera.prevScale = camera.scale;
  });
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);

  const refreshPalette = async () => {
    if (!state.sheetSelector) return;
    const mode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newSheet = await state.sheetSelector(mode);
    if (newSheet) {
      state.sheet = newSheet;
    }
    state.backgroundColor = resolveBackgroundColor();
  };
  state.darkModeListener = refreshPalette;
  document.addEventListener('darkmodechange', refreshPalette);
  state.stopLoop = startGameLoop(stepSimulation, renderScene, { step: 1 / 120 });
  renderScene(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
