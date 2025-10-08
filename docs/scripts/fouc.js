// prevents fouc, hide style as loading html
(function () {
    const removeLoadingClass = () => {
        document.documentElement.classList.remove('js-loading');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeLoadingClass, { once: true });
    } else {
        removeLoadingClass();
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            removeLoadingClass();
        }
    });
})();
