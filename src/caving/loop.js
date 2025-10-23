const DEFAULT_STEP = 1 / 120;
const MAX_FRAME_DELTA = 0.25;
const MAX_STEPS_PER_FRAME = 5;

export function startGameLoop(update, render, options = {}) {
  const step = typeof options.step === 'number' && options.step > 0 ? options.step : DEFAULT_STEP;
  let lastTime = performance.now();
  let accumulator = 0;
  let rafId = 0;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    let delta = (now - lastTime) / 1000;
    if (!Number.isFinite(delta) || delta < 0) {
      delta = 0;
    }
    if (delta > MAX_FRAME_DELTA) {
      delta = MAX_FRAME_DELTA;
    }
    lastTime = now;
    accumulator += delta;

    let steps = 0;
    while (accumulator >= step && steps < MAX_STEPS_PER_FRAME) {
      update(step);
      accumulator -= step;
      steps += 1;
    }

    render(accumulator / step);
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}
