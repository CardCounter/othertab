// prevents fouc, hide style as loading html
window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('js-loading');
});