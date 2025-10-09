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

    const detectFromStoredPreference = () => {
        try {
            const stored = window.localStorage.getItem('darkMode');
            if (stored === 'true' || stored === 'dark') {
                return { mode: 'dark', status: 'hit-dark' };
            }
            if (stored === 'false' || stored === 'light') {
                return { mode: 'light', status: 'hit-light' };
            }
            return { mode: null, status: 'miss' };
        } catch (_) {
            return { mode: null, status: 'error' };
        }
    };

    const interpretToggleLabel = (label) => {
        if (!label) return null;
        const normalized = label.trim().toLowerCase();
        if (!normalized) return null;
        if (normalized.includes('light')) return 'dark';
        if (normalized.includes('dark')) return 'light';
        return null;
    };

    const detectFromToggle = () => {
        const toggle = document.getElementById('dark-toggle');
        if (!toggle) return null;
        return interpretToggleLabel(toggle.textContent || toggle.getAttribute('aria-label') || '');
    };

    const detectPreferredTheme = () => {
        const stored = detectFromStoredPreference();
        if (stored.status) {
            root.setAttribute(STORAGE_STATUS_ATTR, stored.status);
        }
        if (stored.mode) {
            return stored.mode;
        }

        // If the user has never toggled, prefer a stable light-first paint regardless of system scheme
        // No stored preference yet: hard-default to light to avoid dark-first FOUC on Firefox
        root.setAttribute(STORAGE_STATUS_ATTR, 'default-light');
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
