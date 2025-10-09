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

    window.mobileAndTabletCheck = function () {
        let check = false;
        (function (a) {
            if (
                /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) ||
                /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))
            )
                check = true;
        })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    };

    // Manual overrides: allow forcing desktop via query or localStorage
    const forceDesktop = /(^|[?&])desktop=1(&|$)/.test(location.search) || localStorage.getItem('forceDesktop') === '1';
    const forceMobile = /(^|[?&])mobile=1(&|$)/.test(location.search) || localStorage.getItem('forceMobile') === '1';

    const detectMobile = typeof window.mobileAndTabletCheck === 'function' ? window.mobileAndTabletCheck() : false;

    // Final decision: regex detection unless overridden
    const isMobileDevice = (forceMobile || detectMobile) && !forceDesktop;

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
        darkToggle.textContent = 'd_m';
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
        darkToggle.style.border = 'none';
        darkToggle.style.outline = 'none';

        // --- Dark mode wiring (self-contained, compatible with darkmode.js / darkmode-check.js) ---
        function getCurrentMode() {
            const t = localStorage.getItem('theme');
            if (t === 'dark' || t === 'light') return t;
            const dm = localStorage.getItem('dark-mode');
            if (dm === 'true' || dm === 'false') return dm === 'true' ? 'dark' : 'light';
            return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }

        function setThemeColor(color) {
            let meta = document.querySelector('meta[name="theme-color"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', 'theme-color');
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', color);
        }

        function applyOverlayTheme(mode) {
            overlay.style.backgroundColor = mode === 'dark' ? '#000000' : '#ffffff';
            overlay.style.color = mode === 'dark' ? '#ffffff' : '#000000';
            setThemeColor(mode === 'dark' ? '#000000' : '#ffffff');
            darkToggle.style.color = mode === 'dark' ? '#ffffff' : '#000000';
            darkToggle.textContent = mode === 'dark' ? 'l_m' : 'd_m';
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
