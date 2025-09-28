(function () {
    const currentScript = document.currentScript;
    const defaultHeader = 'OTHER TAB';
    const defaultMessage = 'other tab isnt really made for mobile, sorry';

    const customHeader =
        (currentScript && currentScript.dataset && currentScript.dataset.header) ||
        (typeof window !== 'undefined' && window.OTHERTAB_MOBILE_HEADER) ||
        defaultHeader;

    const customMessage =
        (currentScript && currentScript.dataset && currentScript.dataset.message) ||
        (typeof window !== 'undefined' && window.OTHERTAB_MOBILE_MESSAGE) ||
        defaultMessage;

    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;
    const isTouchDevice = navigator.maxTouchPoints > 1 || 'ontouchstart' in window || 'onpointerdown' in window;
    const isSmallViewport = window.matchMedia('(max-width: 900px)').matches;

    const isMobileDevice = mobileRegex.test(navigator.userAgent || '') || (isTouchDevice && isSmallViewport);

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
        overlay.style.fontFamily = "'Courier New', Courier, monospace";
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

        const header = document.createElement('header');
        header.style.width = '100%';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'center';

        const heading = document.createElement('h2');
        heading.textContent = customHeader;
        heading.style.margin = '1rem 0';

        const message = document.createElement('p');
        message.textContent = customMessage;
        message.style.margin = '0';
        message.style.lineHeight = '1.6';

        header.appendChild(heading);
        content.appendChild(header);
        content.appendChild(message);
        overlay.appendChild(content);

        document.body.innerHTML = '';
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showMobileBlocker);
    } else {
        showMobileBlocker();
    }
})();
