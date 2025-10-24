export function generatePlainLevel(LevelClass, width, height) {
  const level = new LevelClass(width, height);
  const groundY = Math.max(0, height - 1);

  // Build a flat ground.
  for (let x = 0; x < width; x += 1) {
    level.set(x, groundY, 'ground');
  }

  // Add solid walls on both ends.
  const wallHeight = Math.min(groundY + 1, height);
  for (let y = groundY; y >= groundY - wallHeight + 1; y -= 1) {
    if (y >= 0) {
      level.set(0, y, 'stone');
      level.set(width - 1, y, 'stone');
    }
  }

  level.spawnTile = {
    x: Math.floor(width / 2),
    y: Math.max(0, groundY - 1),
  };

  addPlatforms(level, groundY, width);

  return level;
}

function addPlatforms(level, groundY, width) {
  if (width < 20) {
    return;
  }

  const platformConfigs = [
    {
      startX: Math.floor(width * 0.25) - 1,
      lowerWidth: 3,
      lowerHeight: 2,
      upperOffset: 1,
      upperWidth: 2,
      upperHeight: 3,
    },
    {
      startX: Math.floor(width * 0.65) - 1,
      lowerWidth: 4,
      lowerHeight: 2,
      upperOffset: 2,
      upperWidth: 3,
      upperHeight: 4,
    },
  ];

  for (const config of platformConfigs) {
    placeTwoTierPlatform(level, groundY, width, config);
  }
}

function placeTwoTierPlatform(level, groundY, width, config) {
  const { startX, lowerWidth, lowerHeight, upperOffset, upperWidth, upperHeight } = config;
  const lowerLeft = Math.max(1, Math.min(width - 2 - lowerWidth, startX));
  const lowerTop = groundY - lowerHeight;
  if (lowerTop < 0) return;

  for (let x = lowerLeft; x < lowerLeft + lowerWidth; x += 1) {
    for (let y = lowerTop; y < groundY; y += 1) {
      level.set(x, y, 'ground');
    }
  }

  const upperLeft = Math.max(1, Math.min(width - 2 - upperWidth, lowerLeft + upperOffset));
  const upperTop = lowerTop - upperHeight;
  if (upperTop < 0) return;

  for (let x = upperLeft; x < upperLeft + upperWidth; x += 1) {
    for (let y = upperTop; y < lowerTop; y += 1) {
      level.set(x, y, 'ground');
    }
  }
}
