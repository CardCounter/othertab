function toggleSectionVisibility(widget, visible) {
    if (!widget || !widget.section) {
        return;
    }
    widget.section.classList.toggle("widget-hidden", !visible);
}

export function createWidgetManager({ widgets = [], navSelector } = {}) {
    const registry = new Map();
    widgets.forEach((widget) => {
        if (widget && widget.id) {
            registry.set(widget.id, widget);
        }
    });

    const navButtons = navSelector
        ? Array.from(document.querySelectorAll(navSelector))
        : [];
    let activeId = null;

    function updateNavButtons() {
        navButtons.forEach((button) => {
            const { widget } = button.dataset;
            button.classList.toggle("active", widget === activeId);
        });
    }

    function setActive(id) {
        if (!registry.has(id)) {
            return;
        }
        if (activeId === id) {
            const current = registry.get(id);
            current?.show?.();
            updateNavButtons();
            return;
        }

        if (activeId && registry.has(activeId)) {
            const previous = registry.get(activeId);
            previous?.hide?.();
            toggleSectionVisibility(previous, false);
        }

        activeId = id;
        const next = registry.get(activeId);
        toggleSectionVisibility(next, true);
        next?.show?.();
        updateNavButtons();
    }

    function init() {
        widgets.forEach((widget) => {
            toggleSectionVisibility(widget, false);
        });

        navButtons.forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                const { widget } = button.dataset;
                setActive(widget);
            });
        });

        const initial = widgets[0]?.id;
        if (initial) {
            setActive(initial);
        }
    }

    return {
        init,
        setActive,
        getActive() {
            return activeId;
        }
    };
}

