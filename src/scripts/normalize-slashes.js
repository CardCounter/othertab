(function normalizePathname(){
    if (typeof window === 'undefined' || !window.location) {
        return;
    }
    try {
        const { origin = '', pathname = '', search = '', hash = '' } = window.location;
        if (!pathname) {
            return;
        }
        const normalizedPath = pathname.replace(/\/{2,}/g, '/');
        if (normalizedPath !== pathname) {
            window.location.replace(`${origin}${normalizedPath}${search}${hash}`);
        }
    }
    catch (error) {
        console.error('normalize pathname failed', error);
    }
})();
