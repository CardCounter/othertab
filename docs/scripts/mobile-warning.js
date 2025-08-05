(function() {
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;
    if (localStorage.getItem('mobileWarningDismissed')) return;
    const script = document.currentScript;
    const url = new URL(script.src, window.location.href);
    const root = url.pathname.replace(/\/scripts\/mobile-warning\.js$/, '/');
    window.location.href = root + 'mobile-warning.html';
})();

