export const TILE_SIZE = 8;
const ATLAS_TILE_SIZE = 8;
export const SHEET_COLUMNS = 16;
export const SHEET_ROWS = 16;
export const TOTAL_TILES = SHEET_COLUMNS * SHEET_ROWS;
export const SPRITE_FALLBACK = 'tile_0_0';

const SPRITE_URLS = Object.freeze({
  light: new URL('./sprites/sprites_light.png', import.meta.url).href,
  dark: new URL('./sprites/sprites_dark.png', import.meta.url).href,
});

const sheetCache = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Failed to load sprite sheet: ${url}`));
    img.src = url;
  });
}

function createTileEntry(index, col, row) {
  return Object.freeze({
    key: `tile_${row}_${col}`,
    index,
    col,
    row,
    sx: col * ATLAS_TILE_SIZE,
    sy: row * ATLAS_TILE_SIZE,
    width: ATLAS_TILE_SIZE,
    height: ATLAS_TILE_SIZE,
  });
}

const keyedTiles = {};
const indexedTiles = new Array(TOTAL_TILES);
let pointer = 1;
for (let row = 0; row < SHEET_ROWS; row += 1) {
  for (let col = 0; col < SHEET_COLUMNS; col += 1) {
    const entry = createTileEntry(pointer, col, row);
    keyedTiles[entry.key] = entry;
    indexedTiles[pointer - 1] = entry;
    pointer += 1;
  }
}

Object.freeze(keyedTiles);
Object.freeze(indexedTiles);

export const SPRITES_BY_KEY = keyedTiles;
export const SPRITES_BY_INDEX = indexedTiles;

function safeGetLocalStorage(key) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch (error) {
    return null;
  }
}

function tileFromCoords(col, row) {
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    col < 0 ||
    row < 0 ||
    col >= SHEET_COLUMNS ||
    row >= SHEET_ROWS
  ) {
    return null;
  }
  return SPRITES_BY_INDEX[row * SHEET_COLUMNS + col];
}

function resolveTileIndex(col, row, fallback) {
  const tile = tileFromCoords(col, row);
  if (tile) return tile.index;

  if (typeof fallback === 'string') {
    const fallbackTile = SPRITES_BY_KEY[fallback];
    if (fallbackTile) return fallbackTile.index;
  }

  return SPRITES_BY_INDEX[0].index;
}

function createSpriteAliases() {
  const atlas = {};
  const assign = (name, col, row) => {
    atlas[name] = resolveTileIndex(col, row, SPRITE_FALLBACK);
    return atlas[name];
  };
  // player
  assign('player', 1, 0);
  assign('player_max_speed', 3, 1);
  assign('player_attack', 2, 0);
  assign('player_dash', 7, 15);
  assign('player_attack_weapon', 8, 5);

  // env tiles
  assign('tile_ground', 11, 13);

  return Object.freeze(atlas);
}

class SpriteSheet {
  constructor(image) {
    this.image = image;
    this.tileSize = ATLAS_TILE_SIZE;
  }

  draw(ctx, index, dx, dy, options = {}) {
    if (!Number.isInteger(index)) return;
    const tile = SPRITES_BY_INDEX[index - 1];
    if (!tile) return;

  const scale = options.scale ?? 1;
    const flip = options.flip ?? false;

    ctx.save();
    ctx.translate(dx, dy);
    if (flip) {
      ctx.scale(-1, 1);
      ctx.translate(-tile.width * scale, 0);
    }

    ctx.drawImage(
      this.image,
      tile.sx,
      tile.sy,
      tile.width,
      tile.height,
      0,
      0,
      tile.width * scale,
      tile.height * scale,
    );
    ctx.restore();
  }
}

function prefersDarkMode() {
  if (typeof document !== 'undefined' && document.body.classList.contains('dark-mode')) {
    return true;
  }

  const savedPreference = safeGetLocalStorage('darkMode');
  if (savedPreference === 'true') return true;
  if (savedPreference === 'false') return false;

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (error) {
      return false;
    }
  }
  return false;
}

async function getSheetForMode(mode = 'light') {
  const key = mode === 'dark' ? 'dark' : 'light';
  if (sheetCache.has(key)) {
    return sheetCache.get(key);
  }

  const image = await loadImage(SPRITE_URLS[key]);
  const sheet = new SpriteSheet(image);
  sheetCache.set(key, sheet);
  return sheet;
}

export async function loadSpriteResources() {
  const initialMode = prefersDarkMode() ? 'dark' : 'light';
  const sheet = await getSheetForMode(initialMode);
  const sprites = createSpriteAliases();

  return {
    sheet,
    sprites,
    lookup: SPRITES_BY_KEY,
    getSheetForMode,
  };
}

export { SpriteSheet };
