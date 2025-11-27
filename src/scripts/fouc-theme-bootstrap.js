// Detect preferred theme early and expose via data attribute for FOUC handling
(function () {
    const root = document.documentElement;
    if (!root) return;

    const UA = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
    const IS_FIREFOX = /\b(firefox|iceweasel|icecat|waterfox|seamonkey|palemoon)\b/i.test(UA);
    if (!IS_FIREFOX) return;

    // NOTE: Load this script synchronously in <head> (no defer/async) and before main CSS for reliable first paint in Firefox.

    const DARK = '#000000';
    const LIGHT = '#ffffff';
    const STORAGE_STATUS_ATTR = 'data-fouc-storage-status';

    const APPEARANCE_KEY = 'othertab-appearance';
    const LEGACY_KEYS = ['darkMode', 'dark-mode', 'dark-mode-mobile', 'theme'];

    const detectFromStoredPreference = () => {
        try {
            const stored = window.localStorage.getItem(APPEARANCE_KEY);
            if (stored === 'dark' || stored === 'light') {
                return { mode: stored, status: `hit-${stored}` };
            }
            if (stored === 'auto') {
                const system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                return { mode: system, status: 'hit-auto' };
            }
            for (const key of LEGACY_KEYS) {
                const legacy = window.localStorage.getItem(key);
                if (legacy === 'true') return { mode: 'dark', status: `legacy-${key}` };
                if (legacy === 'false') return { mode: 'light', status: `legacy-${key}` };
                if (legacy === 'dark' || legacy === 'light') {
                    return { mode: legacy, status: `legacy-${key}` };
                }
            }
            return { mode: null, status: 'miss' };
        } catch (_) {
            return { mode: null, status: 'error' };
        }
    };

    const detectPreferredTheme = () => {
        const stored = detectFromStoredPreference();
        if (stored.status) {
            root.setAttribute(STORAGE_STATUS_ATTR, stored.status);
        }
        if (stored.mode) {
            return stored.mode;
        }

        root.setAttribute(STORAGE_STATUS_ATTR, 'system-default');
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    };

    const STYLE_ID = 'fouc-wait-style';
    const META_ID = 'fouc-color-scheme';
    const applyWaitPalette = (mode) => {
        const theme = mode === 'dark' ? 'dark' : 'light';
        root.setAttribute('data-fouc-theme', theme);

        // Ensure <meta name="color-scheme"> is present so form controls pre-paint correctly
        let meta = document.getElementById(META_ID);
        if (!meta) {
            meta = document.createElement('meta');
            meta.id = META_ID;
            meta.name = 'color-scheme';
            document.head && document.head.appendChild(meta);
        }
        meta.setAttribute('content', theme === 'dark' ? 'dark light' : 'light dark');

        // Force initial paint on both html and body (Firefox sometimes paints body first)
        let styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            document.head && document.head.appendChild(styleEl);
        }
        styleEl.textContent = theme === 'dark'
            ? 'html,body{background-color:#000;color:#fff;}'
            : 'html,body{background-color:#fff;color:#000;}';
    };

    applyWaitPalette(detectPreferredTheme());
})();
