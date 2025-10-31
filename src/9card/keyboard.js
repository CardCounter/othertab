export function setupKeyboardControls(state, onDraw) {
    if (!state?.dom?.button || typeof onDraw !== "function") {
        return;
    }

    const pressedKeys = new Set();
    let repeatInterval = null;
    const ACTIVE_KEYS = new Set(["Enter", " "]);
    const REPEAT_DELAY = 100;
    const REPEAT_INTERVAL = 50;

    const triggerDraw = () => {
        if (state.dom.button.disabled || state.dom.button.offsetParent === null) {
            return;
        }
        onDraw();
    };

    const startRepeating = () => {
        if (repeatInterval) {
            return;
        }
        repeatInterval = setInterval(() => {
            triggerDraw();
        }, REPEAT_INTERVAL);
    };

    const stopRepeating = () => {
        if (repeatInterval) {
            clearInterval(repeatInterval);
            repeatInterval = null;
        }
    };

    const handleKeyDown = (event) => {
        if (!ACTIVE_KEYS.has(event.key)) {
            return;
        }
        if (state.dom.button.offsetParent === null) {
            return;
        }
        const activeElement = document.activeElement;
        const isTypingInput =
            activeElement &&
            (activeElement.tagName === "INPUT" ||
                activeElement.tagName === "TEXTAREA" ||
                activeElement.isContentEditable);

        if (!isTypingInput) {
            event.preventDefault();
        }

        if (pressedKeys.has(event.key)) {
            return;
        }

        pressedKeys.add(event.key);

        if (pressedKeys.size === 1) {
            setTimeout(() => {
                if (pressedKeys.size > 0) {
                    startRepeating();
                }
            }, REPEAT_DELAY);
        }

        if (!isTypingInput) {
            triggerDraw();
        }
    };

    const handleKeyUp = (event) => {
        if (!ACTIVE_KEYS.has(event.key)) {
            return;
        }

        pressedKeys.delete(event.key);

        if (pressedKeys.size === 0) {
            stopRepeating();
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    state._keyboardCleanup = () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        stopRepeating();
    };
}
