const randomInRange = (min, max) => Math.random() * (max - min) + min;

export const attemptCreateBullet = (options) => {
    const {
        origin,
        target,
        spriteHalf,
        bulletHalf,
        bulletSpeed,
        bulletLifetime,
        spreadAngle = 0,
        lineLength = 12,
    } = options;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
        return null;
    }

    let angle = Math.atan2(dy, dx);
    if (spreadAngle > 0) {
        const half = spreadAngle / 2;
        angle += randomInRange(-half, half);
    }

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    return {
        x: origin.x + dirX * (spriteHalf + bulletHalf),
        y: origin.y + dirY * (spriteHalf + bulletHalf),
        vx: dirX * bulletSpeed,
        vy: dirY * bulletSpeed,
        life: bulletLifetime,
        angle,
        length: lineLength,
    };
};

export const updateBullets = (bullets, delta, options) => {
    const { bulletSize, worldSize, padding = 0 } = options;
    const thickness = bulletSize;

    return bullets.filter((bullet) => {
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;
        bullet.life -= delta;

        const angle = bullet.angle ?? 0;
        const length = bullet.length ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const tailX = bullet.x - cos * length;
        const tailY = bullet.y - sin * length;

        const minX = Math.min(bullet.x, tailX) - thickness - padding;
        const maxX = Math.max(bullet.x, tailX) + thickness + padding;
        const minY = Math.min(bullet.y, tailY) - thickness - padding;
        const maxY = Math.max(bullet.y, tailY) + thickness + padding;

        const insideBounds =
            maxX >= 0 &&
            minX <= worldSize &&
            maxY >= 0 &&
            minY <= worldSize;

        return bullet.life > 0 && insideBounds;
    });
};
