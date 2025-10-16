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
    };
};

export const updateBullets = (bullets, delta, options) => {
    const { bulletSize, worldSize, padding = 0 } = options;

    return bullets.filter((bullet) => {
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;
        bullet.life -= delta;

        const insideBounds =
            bullet.x >= -padding &&
            bullet.x <= worldSize + padding &&
            bullet.y >= -padding &&
            bullet.y <= worldSize + padding;

        return bullet.life > 0 && insideBounds;
    });
};
