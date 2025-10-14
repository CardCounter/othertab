const prefetchedHrefs = new Set();

const prefetchLink = (href) => {
  if (!href) {
    return;
  }

  const url = new URL(href, window.location.href);

  if (prefetchedHrefs.has(url.href) || url.origin !== window.location.origin) {
    return;
  }

  fetch(url.href, {
    credentials: 'include',
    headers: {
      Purpose: 'prefetch',
    },
    cache: 'force-cache',
  })
    .then(() => {
      prefetchedHrefs.add(url.href);
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        // Useful in dev to see real failures; AbortError is normal when fast navigating away.
        console.warn(`prefetch for ${url.href} failed`, error);
      }
    });
};

const initializePrefetch = () => {
  const cardLinks = document.querySelectorAll('.card a[href]');

  cardLinks.forEach((anchor) => {
    anchor.addEventListener('mouseenter', () => prefetchLink(anchor.href), {
      passive: true,
    });
    anchor.addEventListener('focus', () => prefetchLink(anchor.href), {
      passive: true,
    });
    anchor.addEventListener('touchstart', () => prefetchLink(anchor.href), {
      passive: true,
    });
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePrefetch);
} else {
  initializePrefetch();
}
