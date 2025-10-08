// Detect preferred theme early and expose via data attribute for FOUC handling
(function () {
    const root = document.documentElement;
    if (!root) return;

    let mode = 'light';

    try {
        const stored = window.localStorage.getItem('darkMode');
        if (stored === 'true') {
            mode = 'dark';
        } else if (stored === 'false') {
            mode = 'light';
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            mode = 'dark';
        }
    } catch (_) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            mode = 'dark';
        }
    }

    root.setAttribute('data-fouc-theme', mode);
})();
