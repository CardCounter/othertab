const APPEARANCE_KEY = 'othertab-appearance';
const VALID_APPEARANCES = new Set(['light', 'dark', 'auto']);
const LEGACY_KEYS = ['darkMode', 'dark-mode', 'dark-mode-mobile', 'theme'];
const COLOR_SCHEME_META = 'color-scheme';

const safeGet = (key) => {
    try {
        return window.localStorage.getItem(key);
    } catch (_) {
        return null;
    }
};

const safeSet = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch (_) {
        /* no-op */
    }
};

const safeRemove = (key) => {
    try {
        window.localStorage.removeItem(key);
    } catch (_) {
        /* no-op */
    }
};

const migrateLegacyPreference = () => {
    for (const key of LEGACY_KEYS) {
        const value = safeGet(key);
        if (value === 'true') {
            return 'dark';
        }
        if (value === 'false') {
            return 'light';
        }
        if (value === 'dark' || value === 'light') {
            return value;
        }
    }
    return null;
};

const resolveStoredAppearance = () => {
    const stored = safeGet(APPEARANCE_KEY);
    if (VALID_APPEARANCES.has(stored)) {
        return stored;
    }
    const migrated = migrateLegacyPreference();
    if (migrated) {
        safeSet(APPEARANCE_KEY, migrated);
        LEGACY_KEYS.forEach(safeRemove);
        return migrated;
    }
    return 'auto';
};

const systemMedia = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const readSystemTheme = () => (systemMedia && systemMedia.matches) ? 'dark' : 'light';

let currentAppearance = resolveStoredAppearance();
let currentTheme = readSystemTheme();

const ensureMetaColorScheme = (theme) => {
    if (typeof document === 'undefined') {
        return;
    }

    let meta = document.querySelector(`meta[name="${COLOR_SCHEME_META}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = COLOR_SCHEME_META;
        document.head && document.head.appendChild(meta);
    }
    meta.setAttribute('content', theme === 'dark' ? 'dark light' : 'light dark');
};

const applyBodyClass = () => {
    if (!document.body) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyBodyClass, { once: true });
        }
        return;
    }
    document.body.classList.toggle('dark-mode', currentTheme === 'dark');
};

const dispatchChangeEvent = () => {
    document.dispatchEvent(new CustomEvent('darkmodechange', {
        detail: {
            appearance: currentAppearance,
            theme: currentTheme
        }
    }));
};

const resolveTheme = (appearance) => {
    if (appearance === 'light' || appearance === 'dark') {
        return appearance;
    }
    return readSystemTheme();
};

const applyTheme = () => {
    currentTheme = resolveTheme(currentAppearance);
    const root = document.documentElement;
    if (root) {
        root.setAttribute('data-theme', currentTheme);
        root.setAttribute('data-appearance', currentAppearance);
    }
    applyBodyClass();
    ensureMetaColorScheme(currentTheme);
    dispatchChangeEvent();
};

const setAppearance = (nextAppearance) => {
    const normalized = (nextAppearance || '').toString().toLowerCase();
    const next = VALID_APPEARANCES.has(normalized) ? normalized : 'auto';
    currentAppearance = next;
    safeSet(APPEARANCE_KEY, currentAppearance);
    LEGACY_KEYS.forEach(safeRemove);
    applyTheme();
};

const getAppearance = () => currentAppearance;
const getTheme = () => currentTheme;

const themeController = {
    getAppearance,
    getTheme,
    setAppearance,
    isAuto: () => currentAppearance === 'auto',
    isDark: () => currentTheme === 'dark',
    isLight: () => currentTheme === 'light'
};

if (typeof window !== 'undefined') {
    window.othertabTheme = themeController;
}

applyTheme();

if (systemMedia) {
    const handleSystemChange = () => {
        if (currentAppearance === 'auto') {
            applyTheme();
        }
    };
    if (typeof systemMedia.addEventListener === 'function') {
        systemMedia.addEventListener('change', handleSystemChange);
    } else if (typeof systemMedia.addListener === 'function') {
        systemMedia.addListener(handleSystemChange);
    }
}

export { themeController };
