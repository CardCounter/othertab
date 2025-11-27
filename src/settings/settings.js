const APPEARANCE_ATTR = 'data-appearance-option';
const optionButtons = Array.from(document.querySelectorAll(`[${APPEARANCE_ATTR}]`));

const getThemeController = () => (typeof window !== 'undefined' ? window.othertabTheme : null);

const updateActiveOption = () => {
    const controller = getThemeController();
    if (!controller) {
        return;
    }
    const appearance = controller.getAppearance();
    optionButtons.forEach((button) => {
        const value = button.getAttribute(APPEARANCE_ATTR);
        const isActive = value === appearance;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
};

optionButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const controller = getThemeController();
        if (!controller) {
            return;
        }
        const value = button.getAttribute(APPEARANCE_ATTR);
        controller.setAppearance(value);
    });
});

document.addEventListener('darkmodechange', updateActiveOption);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateActiveOption, { once: true });
} else {
    updateActiveOption();
}
