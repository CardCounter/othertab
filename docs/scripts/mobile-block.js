(function () {
    const currentScript = document.currentScript;
    const defaultHeader = 'OTHER TAB';
    const defaultMessage = 'this page isnt really made for mobile, sorry';

    const customHeader =
        (currentScript && currentScript.dataset && currentScript.dataset.header) ||
        (typeof window !== 'undefined' && window.OTHERTAB_MOBILE_HEADER) ||
        defaultHeader;

    const customMessage =
        (currentScript && currentScript.dataset && currentScript.dataset.message) ||
        (typeof window !== 'undefined' && window.OTHERTAB_MOBILE_MESSAGE) ||
        defaultMessage;

    // Prefer capability + media features over UA sniffing
    const isTouchDevice = navigator.maxTouchPoints > 1 || 'ontouchstart' in window || 'onpointerdown' in window;
    const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
    // UA-CH when available (Chromium), fallback to UA regex for Safari/others
    const chMobile =
        (navigator.userAgentData && navigator.userAgentData.mobile === true) ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');

    // Viewport in CSS pixels (visualViewport if available avoids zoom/DPI surprises)
    const cssW = (window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || 0;
    const cssH = (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || 0;

    // Conservative size gate
    const isSmallViewport = cssW <= 900 && cssH <= 600;

    // Manual overrides: allow forcing desktop via query or localStorage
    const forceDesktop = /(^|[?&])desktop=1(&|$)/.test(location.search) || localStorage.getItem('forceDesktop') === '1';
    const forceMobile = /(^|[?&])mobile=1(&|$)/.test(location.search) || localStorage.getItem('forceMobile') === '1';

    // Helper: mobile-like input signals
    const isMobileLikeInput = chMobile || (isCoarsePointer && noHover) || isTouchDevice;

    // Final decision: small viewport AND mobile-like input unless overridden
    const isMobileDevice = (forceMobile || (isSmallViewport && isMobileLikeInput)) && !forceDesktop;

    if (!isMobileDevice) {
        return;
    }

    function showMobileBlocker() {
        const overlay = document.createElement('div');
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-live', 'assertive');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backgroundColor = '#ffffff';
        overlay.style.color = '#000000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.textAlign = 'center';
        overlay.style.fontFamily = "'Times New Roman', Times, serif";
        overlay.style.fontSize = '1.25rem';
        overlay.style.padding = '2rem';
        overlay.style.zIndex = '2147483647';

        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.alignItems = 'center';
        content.style.gap = '1.5rem';
        content.style.width = '100%';
        content.style.maxWidth = '28rem';
        content.style.paddingTop = 'calc(env(safe-area-inset-top, 0px) + 3.5rem)';
        content.style.fontSize = '16px';

        const header = document.createElement('header');
        header.style.width = '100%';
        header.style.position = 'fixed';
        header.style.top = 'env(safe-area-inset-top, 0px)';
        header.style.left = '0';
        header.style.right = '0';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'center';
        header.style.padding = '0.5rem 1rem';
        header.style.background = 'transparent';
        header.style.textAlign = 'center';
        header.style.boxSizing = 'border-box';

        const heading = document.createElement('h2');
        heading.textContent = customHeader;
        heading.style.fontSize = '24px';
        heading.style.margin = '4px auto';
        heading.style.lineHeight = '1';

        const darkToggle = document.createElement('button');
        darkToggle.id = 'dark-toggle';
        darkToggle.textContent = 'dark mode';
        darkToggle.setAttribute('aria-label', 'Toggle dark mode');
        darkToggle.style.position = 'absolute';
        darkToggle.style.right = 'calc(env(safe-area-inset-right, 0px) + 12px)';
        darkToggle.style.top = '50%';
        darkToggle.style.transform = 'translateY(-50%)';
        darkToggle.style.lineHeight = '1';
        darkToggle.style.paddingTop = '4px';
        darkToggle.style.paddingBottom = '4px';
        darkToggle.style.background = 'transparent';
        darkToggle.style.fontFamily = "'Times New Roman', Times, serif";
        darkToggle.style.fontSize = '16px';
        darkToggle.style.cursor = 'pointer';

        // --- Dark mode wiring (self-contained, compatible with darkmode.js / darkmode-check.js) ---
        function getCurrentMode() {
            const t = localStorage.getItem('theme');
            if (t === 'dark' || t === 'light') return t;
            const dm = localStorage.getItem('dark-mode');
            if (dm === 'true' || dm === 'false') return dm === 'true' ? 'dark' : 'light';
            return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }
        function applyOverlayTheme(mode) {
            overlay.style.backgroundColor = mode === 'dark' ? '#000000' : '#ffffff';
            overlay.style.color = mode === 'dark' ? '#ffffff' : '#000000';
            darkToggle.textContent = mode === 'dark' ? 'light mode' : 'dark mode';
        }
        function applyMode(mode) {
            document.documentElement.setAttribute('data-theme', mode);
            if (mode === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('theme', mode);
            localStorage.setItem('dark-mode', mode === 'dark' ? 'true' : 'false');
            applyOverlayTheme(mode);
            // If darkmode.js exposes a hook, call it safely
            if (typeof window.updateDarkMode === 'function') {
                try { window.updateDarkMode(mode); } catch (_) {}
            }
        }
        // Initialize current mode and set UI state
        let __initialMode = getCurrentMode();
        applyMode(__initialMode);
        // Toggle on click
        darkToggle.addEventListener('click', function () {
            const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
            applyMode(isDark ? 'light' : 'dark');
        });
        // --- end dark mode wiring ---


        const message = document.createElement('p');
        message.textContent = customMessage;
        message.style.fontSize = 'clamp(0.95rem, 3.5vw, 1.25rem)';
        message.style.margin = '0';
        message.style.lineHeight = '1.6';

        header.appendChild(heading);
        header.appendChild(darkToggle);
        content.appendChild(header);
        content.appendChild(message);
        overlay.appendChild(content);

        document.body.innerHTML = '';
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Ensure dark mode and FOUC scripts are loaded
        (function ensureScripts() {
            const needed = [
                '../scripts/darkmode-check.js',
                '../scripts/darkmode.js',
                '../scripts/fouc.js'
            ];
            needed.forEach(src => {
                const fname = src.split('/').pop();
                if (!document.querySelector('script[src*="' + fname + '"]')) {
                    const s = document.createElement('script');
                    s.src = src;
                    document.head.appendChild(s);
                }
            });
        })();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showMobileBlocker);
    } else {
        showMobileBlocker();
    }
})();
