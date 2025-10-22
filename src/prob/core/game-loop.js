const loopTasks = new Set();
let running = false;
let lastTime = 0;

function runLoop(now) {
    const delta = now - lastTime;
    lastTime = now;
    loopTasks.forEach((task) => {
        try {
            task(now, delta);
        } catch {
            // ignore task errors to keep loop alive
        }
    });
    requestAnimationFrame(runLoop);
}

export function addGameLoopTask(task) {
    if (typeof task !== "function") {
        return () => {};
    }
    loopTasks.add(task);
    return () => loopTasks.delete(task);
}

export function startGameLoop() {
    if (running) {
        return;
    }
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(runLoop);
}

