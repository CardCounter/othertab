const TEMPLATE_TILE_SIZE = 16;
const SEGMENTS_PER_LEVEL = 4;
const COLOR_THRESHOLD = 32;

const supportsGlob = typeof import.meta.glob === 'function';

const templateModules = supportsGlob
  ? import.meta.glob('./level-templates/*.png', {
      eager: true,
      import: 'default',
    })
  : {};

const FALLBACK_TEMPLATE_URLS = supportsGlob
  ? []
  : [
      // Keep this list in sync with actual template assets when bundler glob is unavailable.
      new URL('./level-templates/level_test.png', import.meta.url).href,
    ];

let templatesPromise = null;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load level template: ${url}`));
    image.src = url;
  });
}

function extractTemplatesFromImage(image) {
  const { width, height } = image;
  if (width < TEMPLATE_TILE_SIZE || height < TEMPLATE_TILE_SIZE) {
    return [];
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return [];
  }

  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  const columns = Math.floor(width / TEMPLATE_TILE_SIZE);
  const rows = Math.floor(height / TEMPLATE_TILE_SIZE);
  const templates = [];

  for (let tileRow = 0; tileRow < rows; tileRow += 1) {
    for (let tileCol = 0; tileCol < columns; tileCol += 1) {
      const originX = tileCol * TEMPLATE_TILE_SIZE;
      const originY = tileRow * TEMPLATE_TILE_SIZE;
      const solidMask = Array.from({ length: TEMPLATE_TILE_SIZE }, () =>
        new Array(TEMPLATE_TILE_SIZE).fill(false),
      );

      for (let y = 0; y < TEMPLATE_TILE_SIZE; y += 1) {
        for (let x = 0; x < TEMPLATE_TILE_SIZE; x += 1) {
          const px = originX + x;
          const py = originY + y;
          const index = (py * width + px) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          const isBlack = r < COLOR_THRESHOLD && g < COLOR_THRESHOLD && b < COLOR_THRESHOLD;
          solidMask[y][x] = a > 0 && isBlack;
        }
      }

      templates.push({
        width: TEMPLATE_TILE_SIZE,
        height: TEMPLATE_TILE_SIZE,
        solid: solidMask,
      });
    }
  }

  return templates;
}

async function loadTemplates() {
  if (!templatesPromise) {
    const urls = supportsGlob
      ? Object.values(templateModules)
      : FALLBACK_TEMPLATE_URLS;
    templatesPromise = Promise.all(
      urls.map(async (url) => {
        const image = await loadImage(url);
        return extractTemplatesFromImage(image);
      }),
    )
      .then((chunks) => chunks.flat())
      .catch((error) => {
        console.error('Failed to load level templates', error);
        return [];
      });
  }
  return templatesPromise;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function findSpawn(level, startX, baseY, segmentHeight) {
  const centerX = clamp(startX, 1, level.width - 2);
  const maxY = Math.min(level.height - 2, baseY + segmentHeight - 1);
  for (let y = baseY; y <= maxY; y += 1) {
    const above = level.get(centerX, y);
    const below = level.get(centerX, y + 1);
    if (above === 'air' && below === 'ground') {
      return { x: centerX, y };
    }
  }
  return {
    x: centerX,
    y: clamp(baseY - 1, 0, level.height - 1),
  };
}

function applyTemplateSegment(level, template, startX, baseY) {
  const segmentWidth = template.width;
  const segmentHeight = template.height;

  for (let y = 0; y < segmentHeight; y += 1) {
    const destY = baseY + y;
    if (destY < 0 || destY >= level.height) continue;
    for (let x = 0; x < segmentWidth; x += 1) {
      const destX = startX + x;
      if (destX < 0 || destX >= level.width) continue;

      if (template.solid[y][x]) {
        level.set(destX, destY, 'ground');
      }
    }
  }
}

function fallbackLevel(level) {
  const groundY = Math.max(0, level.height - 1);
  for (let x = 0; x < level.width; x += 1) {
    level.set(x, groundY, 'ground');
  }

  level.spawnTile = {
    x: Math.floor(level.width / 2),
    y: clamp(groundY - 1, 0, level.height - 1),
  };

  return level;
}

export async function generateSpriteLevel(LevelClass, requestedWidth, height) {
  const templates = await loadTemplates();

  if (!templates.length) {
    const fallback = new LevelClass(requestedWidth, height);
    return fallbackLevel(fallback);
  }

  const segmentWidth = templates[0]?.width ?? TEMPLATE_TILE_SIZE;
  const segmentHeight = templates[0]?.height ?? TEMPLATE_TILE_SIZE;
  const segmentsToUse = SEGMENTS_PER_LEVEL;
  const levelSpan = segmentWidth * segmentsToUse;
  const level = new LevelClass(levelSpan, height);
  const baseY = Math.max(0, level.height - segmentHeight);

  for (let segmentIndex = 0; segmentIndex < segmentsToUse; segmentIndex += 1) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const destX = segmentIndex * segmentWidth;
    applyTemplateSegment(level, template, destX, baseY);
  }

  const spawnCenter = Math.floor(level.width / 2);
  level.spawnTile = findSpawn(level, spawnCenter, baseY, segmentHeight);

  return level;
}
