function sanitizeSegment(segment){
    return (segment || '').replace(/^\/+|\/+$/g, '');
}

function buildCanonicalPath(pathname, appSegment){
    const cleanSegment = sanitizeSegment(appSegment);
    if (!cleanSegment){
        return pathname || '/';
    }
    const segments = (pathname || '').split('/').filter(Boolean);
    const matchIndex = segments.indexOf(cleanSegment);
    if (matchIndex === -1){
        return `/${cleanSegment}/`;
    }
    const base = segments.slice(0, matchIndex + 1);
    return `/${base.join('/')}/`;
}

export function replaceUrlPathWithSeed(appSegment, seed){
    if (typeof window === 'undefined' || !window.history || typeof window.history.replaceState !== 'function'){
        return;
    }
    const url = new URL(window.location.href);
    url.pathname = buildCanonicalPath(url.pathname, appSegment);
    url.search = seed ? `?${seed}` : '';
    const relative = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', relative);
}
