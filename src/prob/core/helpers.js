export function formatNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "");
}

export function createCooldownTimer(button, { label = "action" } = {}) {
    let endTime = 0;
    let rafId = null;
    let completion = null;
    let active = false;

    if (button) {
        button.disabled = false;
        button.textContent = label;
    }

    function clearTimer() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        active = false;
        completion = null;
        if (button) {
            button.disabled = false;
            button.textContent = label;
        }
    }

    function tick(timestamp) {
        if (!button) {
            return;
        }
        const remaining = Math.max(0, endTime - timestamp);
        if (remaining <= 0) {
            const pending = completion;
            clearTimer();
            if (typeof pending === "function") {
                pending();
            }
            return;
        }
        button.disabled = true;
        button.textContent = `${label} (${(remaining / 1000).toFixed(1)}s)`;
        rafId = requestAnimationFrame(tick);
    }

    return {
        start(durationMs, onComplete) {
            if (!button) {
                if (typeof onComplete === "function") {
                    setTimeout(onComplete, durationMs);
                }
                return;
            }
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            active = true;
            completion = onComplete;
            endTime = performance.now() + durationMs;
            button.disabled = true;
            tick(performance.now());
        },
        shorten(durationMs) {
            if (!active || !button) {
                return;
            }
            const now = performance.now();
            const remaining = Math.max(0, endTime - now);
            endTime = now + Math.min(remaining, durationMs);
            button.disabled = true;
            button.textContent = `${label} (${(Math.max(0, endTime - now) / 1000).toFixed(1)}s)`;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            tick(performance.now());
        },
        cancel() {
            clearTimer();
        },
        isActive() {
            return active;
        }
    };
}

