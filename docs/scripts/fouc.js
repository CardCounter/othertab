// prevents fouc, hide style as loading html
(function () {
    const root = document.documentElement;
    if (!root) {
        return;
    }

    const WAIT_ATTR = 'data-fouc-wait';
    const TIMEOUT_ATTR = 'data-fouc-timeout';
    const READY_EVENT = 'fouc:ready';
    const THEME_ATTR = 'data-fouc-theme';
    const DEFAULT_TIMEOUT = 500; // might need to increase if having fouc problems for nono
    const UA = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
    const IS_FIREFOX = /\b(firefox|iceweasel|icecat|waterfox|seamonkey|palemoon)\b/i.test(UA);

    const interpretToggleLabel = (label) => {
        if (!label) return null;
        const normalized = label.trim().toLowerCase();
        if (!normalized) return null;
        if (normalized.includes('light')) return 'dark';
        if (normalized.includes('dark')) return 'light';
        return null;
    };

    const detectThemeFromToggle = () => {
        const toggle = document.getElementById('dark-toggle');
        if (!toggle) return null;
        return interpretToggleLabel(toggle.textContent || toggle.getAttribute('aria-label') || '');
    };

    const detectTheme = () => {
        let stored = null;
        try {
            stored = window.localStorage.getItem('darkMode');
        } catch (_) {
            stored = null;
        }

        if (stored === 'true') return 'dark';
        if (stored === 'false') return 'light';

        if (document.body && document.body.classList.contains('dark-mode')) {
            return 'dark';
        }

        const toggleTheme = detectThemeFromToggle();
        if (toggleTheme) return toggleTheme;

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    };

    const DARK = '#000000';
    const LIGHT = '#ffffff';

    const applyWaitPalette = (mode) => {
        const theme = mode === 'dark' ? 'dark' : 'light';
        root.setAttribute(THEME_ATTR, theme);
        if (IS_FIREFOX) {
            root.style.backgroundColor = theme === 'dark' ? DARK : LIGHT;
            root.style.color = theme === 'dark' ? LIGHT : DARK;
        }
    };

    const ensureHoldTheme = () => {
        const existing = root.getAttribute(THEME_ATTR);
        if (existing === 'dark' || existing === 'light') {
            applyWaitPalette(existing);
            return;
        }

        applyWaitPalette(detectTheme());
    };

    const clearHoldTheme = () => {
        if (root.hasAttribute(THEME_ATTR)) {
            root.removeAttribute(THEME_ATTR);
        }
        if (IS_FIREFOX) {
            root.style.removeProperty('background-color');
            root.style.removeProperty('color');
        }
    };

    const waitForReadySignal = (callback) => {
        if (!root.hasAttribute(WAIT_ATTR)) {
            callback();
            return;
        }

        let finished = false;

        const finish = () => {
            if (finished) {
                return;
            }
            finished = true;
            document.removeEventListener(READY_EVENT, handleReady);
            callback();
        };

        const timeoutAttr = root.getAttribute(TIMEOUT_ATTR);
        let timeoutMs = Number(timeoutAttr);
        if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
            timeoutMs = DEFAULT_TIMEOUT;
        }

        const handleReady = () => {
            window.clearTimeout(timeoutId);
            finish();
        };

        document.addEventListener(READY_EVENT, handleReady, { once: true });
        const timeoutId = window.setTimeout(finish, timeoutMs);
    };

    const isNonoPage = () => root.hasAttribute('data-nono-page');

    const waitForNonoLayout = (done) => {
        if (!isNonoPage()) {
            done();
            return;
        }

        const container = document.getElementById('game-container');
        if (!container) {
            done();
            return;
        }

        const hasContent = container.childElementCount > 0 || container.innerHTML.trim() !== '';
        if (hasContent) {
            done();
            return;
        }

        window.requestAnimationFrame(() => waitForNonoLayout(done));
    };

    const removeLoading = () => {
        if (!root.classList.contains('js-loading')) {
            clearHoldTheme();
            return;
        }

        root.classList.remove('js-loading');
        root.removeAttribute(WAIT_ATTR);
        clearHoldTheme();
    };

    const release = () => {
        const finalize = () => {
            removeLoading();
        };

        const finalizeWithFirefoxFrames = () => {
            if (IS_FIREFOX) {
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(finalize);
                });
            } else {
                finalize();
            }
        };

        if (IS_FIREFOX && isNonoPage()) {
            waitForNonoLayout(finalizeWithFirefoxFrames);
        } else {
            finalizeWithFirefoxFrames();
        }
    };

    const schedule = () => {
        ensureHoldTheme();
        waitForReadySignal(release);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedule, { once: true });
    } else {
        schedule();
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            ensureHoldTheme();
            release();
        }
    });
})();
