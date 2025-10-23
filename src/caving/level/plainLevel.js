export function generatePlainLevel(LevelClass, width, height) {
  const level = new LevelClass(width, height);
  const groundY = Math.max(0, height - 1);

  for (let x = 0; x < width; x += 1) {
    level.set(x, groundY, 'ground');
  }

  const towerCount = Math.max(3, Math.floor(width / 16));
  const occupied = new Set();

  for (let i = 0; i < towerCount; i += 1) {
    let baseX = Math.floor(Math.random() * width);
    let guard = 0;
    while (occupied.has(baseX) && guard < 6) {
      baseX = Math.floor(Math.random() * width);
      guard += 1;
    }
    occupied.add(baseX);

    const towerHeight = 2 + Math.floor(Math.random() * 2);
    for (let h = 1; h <= towerHeight; h += 1) {
      const tileY = groundY - h;
      if (tileY >= 0) {
        level.set(baseX, tileY, 'ground');
      }
    }
  }

  level.spawnTile = {
    x: Math.floor(width / 2),
    y: Math.max(0, groundY - 1),
  };

  return level;
}
