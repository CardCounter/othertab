const CARD_IMAGE_SELECTOR = 'img.card-image[data-light-src]';

const resolveTheme = () => {
    const root = document.documentElement;
    return (root && root.getAttribute('data-theme')) === 'dark' ? 'dark' : 'light';
};

const setImageSource = (img, theme) => {
    const lightSrc = img.getAttribute('data-light-src');
    const darkSrc = img.getAttribute('data-dark-src');
    const nextSrc = theme === 'dark' ? (darkSrc || lightSrc) : (lightSrc || darkSrc);
    if (!nextSrc) {
        return;
    }
    if (img.getAttribute('src') !== nextSrc) {
        img.setAttribute('src', nextSrc);
    }
};

const updateCardImages = (theme = resolveTheme()) => {
    document.querySelectorAll(CARD_IMAGE_SELECTOR).forEach((img) => setImageSource(img, theme));
};

const initCardImages = () => {
    updateCardImages();
    document.addEventListener('darkmodechange', (event) => {
        const detail = event?.detail;
        updateCardImages(detail && detail.theme ? detail.theme : resolveTheme());
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCardImages, { once: true });
} else {
    initCardImages();
}

