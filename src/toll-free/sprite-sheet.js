const loadImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (error) => reject(error);
        image.src = url;
    });

const coerceSpriteMap = (meta) => {
    if (!meta) {
        return {};
    }

    if (Array.isArray(meta)) {
        return meta;
    }

    if (meta.sprites) {
        return meta.sprites;
    }

    return meta;
};

export const loadSpriteSheet = async ({
    imageUrl,
    spriteSize = 8,
    meta,
    jsonUrl,
} = {}) => {
    if (!imageUrl) {
        throw new Error('sprite sheet requires an imageUrl');
    }
    if (!meta && !jsonUrl) {
        throw new Error('sprite sheet requires metadata via meta or jsonUrl');
    }

    const fetchMeta = async () => {
        if (meta) {
            return coerceSpriteMap(meta);
        }

        const response = await fetch(jsonUrl);
        if (!response.ok) {
            throw new Error(`failed to load sprite json: ${response.status}`);
        }
        const data = await response.json();
        return coerceSpriteMap(data);
    };

    const [sheetMeta, sheetImage] = await Promise.all([fetchMeta(), loadImage(imageUrl)]);

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = sheetImage.width;
    sourceCanvas.height = sheetImage.height;
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) {
        throw new Error('failed to create sprite sheet context');
    }
    sourceCtx.imageSmoothingEnabled = false;
    sourceCtx.drawImage(sheetImage, 0, 0);

    const columns = Math.max(1, Math.floor(sheetImage.width / spriteSize));
    const sprites = new Map();

    for (const [key, name] of Object.entries(sheetMeta)) {
        const index = Number.parseInt(key, 10) - 1;
        if (!name || Number.isNaN(index) || index < 0) {
            continue;
        }

        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = column * spriteSize;
        const y = row * spriteSize;

        if (x + spriteSize > sheetImage.width || y + spriteSize > sheetImage.height) {
            continue;
        }

        const spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = spriteSize;
        spriteCanvas.height = spriteSize;
        const spriteCtx = spriteCanvas.getContext('2d');
        if (!spriteCtx) {
            continue;
        }
        spriteCtx.imageSmoothingEnabled = false;
        spriteCtx.drawImage(
            sourceCanvas,
            x,
            y,
            spriteSize,
            spriteSize,
            0,
            0,
            spriteSize,
            spriteSize,
        );
        sprites.set(name, spriteCanvas);
    }

    return sprites;
};
