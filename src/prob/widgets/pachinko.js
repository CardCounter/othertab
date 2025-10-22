import { credits } from "../core/credits.js";
import { formatNumber } from "../core/helpers.js";

const SLOT_COUNT = 7;
const ROW_COUNT = 11;
const WINNING_SLOT = 3;

const PAYOUT_BASE_COST = 7;
const PAYOUT_GROWTH = 1.55;
const SPEED_BASE_COST = 12;
const SPEED_GROWTH = 1.5;

const BASE_PAYOUT = 5;
const BASE_COOLDOWN = 1200;
const MIN_COOLDOWN = 280;

const PHYSICS_FPS = 120;
const PHYSICS_STEP = 1 / PHYSICS_FPS;
const MAX_ACCUMULATOR = 0.5;

const ACCELERATION = 1100;
const FRICTION = 0.995;
const BALL_RADIUS = 8;
const PEG_RADIUS = 4;
const WALL_REBOUND = 0.55;
const PEG_REBOUND = 0.7;

const DROP_ZONE_RATIO = 0;
const SAFETY_TIMEOUT_MS = 5000;
const SLOT_LABELS = ["", "", "", "φ", "", "", ""];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatSeconds(ms) {
    return `${(ms / 1000).toFixed(2)}s`;
}

export function createPachinkoWidget() {
    const dom = {
        section: document.getElementById("pachinko-widget-section"),
        canvas: document.getElementById("pachinko-canvas"),
        payoutValue: document.getElementById("pachinko-payout-value"),
        payoutUpgrade: document.getElementById("pachinko-upgrade-payout"),
        speedUpgrade: document.getElementById("pachinko-upgrade-speed"),
        rate: document.getElementById("pachinko-rate"),
        status: document.getElementById("pachinko-status")
    };

    const state = {
        payout: BASE_PAYOUT,
        payoutLevel: 0,
        speedLevel: 0,
        dropCooldown: BASE_COOLDOWN,
        nextAvailableDrop: 0,
        balls: [],
        pegs: [],
        slots: [],
        barriers: [],
        highlight: null,
        ctx: null,
        canvasSize: { width: 0, height: 0, dropZoneHeight: 0 },
        animationId: null,
        lastFrameTime: performance.now(),
        accumulator: 0,
        lastMovement: performance.now(),
        resizeObserver: null,
        resizeHandler: null,
        safetyInterval: null,
        unsubscribeCredits: null,
        statusTimeout: null
    };

    function updateStatus(message, { duration = 2200 } = {}) {
        if (!dom.status) {
            return;
        }
        dom.status.textContent = message;
        if (state.statusTimeout) {
            clearTimeout(state.statusTimeout);
            state.statusTimeout = null;
        }
        if (message && duration > 0) {
            state.statusTimeout = window.setTimeout(() => {
                state.statusTimeout = null;
                if (dom.status && dom.status.textContent === message) {
                    dom.status.textContent = "";
                }
            }, duration);
        }
    }

    function updatePayoutDisplay() {
        if (!dom.payoutValue || !dom.payoutUpgrade) {
            return;
        }
        dom.payoutValue.textContent = formatNumber(state.payout);
        const cost = Math.ceil(PAYOUT_BASE_COST * Math.pow(PAYOUT_GROWTH, state.payoutLevel));
        dom.payoutUpgrade.textContent = `upgrade payout (${cost}φ)`;
        dom.payoutUpgrade.disabled = !credits.canAfford(cost);
        dom.payoutUpgrade.title = `increase payout to ${formatNumber(state.payout + 1)}φ`;
    }

    function updateSpeedDisplay() {
        if (!dom.speedUpgrade || !dom.rate) {
            return;
        }
        const cost = Math.ceil(SPEED_BASE_COST * Math.pow(SPEED_GROWTH, state.speedLevel));
        const canImprove = state.dropCooldown > MIN_COOLDOWN + 1;
        dom.speedUpgrade.textContent = canImprove
            ? `increase balls/sec (${cost}φ)`
            : "increase balls/sec (max)";
        dom.speedUpgrade.disabled = !canImprove || !credits.canAfford(cost);
        const nextCooldown = Math.max(MIN_COOLDOWN, Math.round(state.dropCooldown * 0.85));
        dom.speedUpgrade.title = canImprove ? `next cooldown: ${formatSeconds(nextCooldown)}` : "maximum rate reached";
        dom.rate.textContent = formatSeconds(state.dropCooldown);
    }

    function refreshUpgradeStates() {
        updatePayoutDisplay();
        updateSpeedDisplay();
    }

    function resetBoard({ silent = false } = {}) {
        state.balls = [];
        state.accumulator = 0;
        state.lastMovement = performance.now();
        state.highlight = null;
        if (state.animationId) {
            cancelAnimationFrame(state.animationId);
            state.animationId = null;
        }
        state.nextAvailableDrop = Date.now();
        if (!silent) {
            updateStatus("board reset", { duration: 1800 });
        }
        render();
    }

    function safetyCheck() {
        if (!state.balls.length) {
            return;
        }
        if (performance.now() - state.lastMovement > SAFETY_TIMEOUT_MS) {
            resetBoard();
        }
    }

    function resizeCanvas() {
        if (!dom.canvas) {
            return;
        }
        const wrapper = dom.canvas.parentElement;
        if (!wrapper) {
            return;
        }
        const cssWidth = Math.max(wrapper.clientWidth, 200);
        const desiredHeight = Math.min(cssWidth * (5 / 3), 360);
        const cssHeight = Math.max(260, desiredHeight);
        dom.canvas.style.width = `${cssWidth}px`;
        dom.canvas.style.height = `${cssHeight}px`;

        const dpr = window.devicePixelRatio || 1;
        dom.canvas.width = Math.round(cssWidth * dpr);
        dom.canvas.height = Math.round(cssHeight * dpr);
        const ctx = dom.canvas.getContext("2d");
        if (!ctx) {
            return;
        }
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        state.ctx = ctx;
        state.canvasSize = {
            width: cssWidth,
            height: cssHeight,
            dropZoneHeight: cssHeight * DROP_ZONE_RATIO
        };
        generatePegs();
        generateSlots();
        render();
    }

    function generatePegs() {
        const { width, height, dropZoneHeight } = state.canvasSize;
        const usableHeight = height - dropZoneHeight - 48;
        const rowSpacing = usableHeight / ROW_COUNT;
        const columnSpacing = width / SLOT_COUNT;
        state.pegs = [];
        for (let row = 0; row < ROW_COUNT; row += 1) {
            const offset = row % 2 === 0 ? 0.5 : 0;
            const y = dropZoneHeight + rowSpacing * (row + 0.8);
            for (let column = 0; column < SLOT_COUNT; column += 1) {
                const x = (column + offset + 0.5) * columnSpacing;
                const clampedX = clamp(x, PEG_RADIUS + 1, width - PEG_RADIUS - 1);
                state.pegs.push({ x: clampedX, y });
            }
        }
    }

    function generateSlots() {
        const { width, height } = state.canvasSize;
        const spacing = width / SLOT_COUNT;
        const radius = Math.min(spacing * 0.35, 20);
        const y = height - radius - 14;
        state.slots = Array.from({ length: SLOT_COUNT }, (_, index) => ({
            x: (index + 0.5) * spacing,
            y,
            radius
        }));
        const barrierTop = y - radius * 1.6;
        state.barriers = Array.from({ length: SLOT_COUNT - 1 }, (_, index) => ({
            x: (index + 1) * spacing,
            top: barrierTop,
            bottom: height - 6
        }));
    }

    function ensureAnimationLoop() {
        if (state.animationId !== null) {
            return;
        }
        state.lastFrameTime = performance.now();
        state.accumulator = 0;
        state.animationId = requestAnimationFrame(loop);
    }

    function physicsStep(step) {
        const { width, height } = state.canvasSize;
        const completed = [];
        state.balls.forEach((ball) => {
            ball.vy += ACCELERATION * step;
            ball.x += ball.vx * step;
            ball.y += ball.vy * step;
            ball.vx *= FRICTION;

            if (ball.x <= BALL_RADIUS) {
                ball.x = BALL_RADIUS;
                ball.vx = Math.abs(ball.vx) * WALL_REBOUND;
            } else if (ball.x >= width - BALL_RADIUS) {
                ball.x = width - BALL_RADIUS;
                ball.vx = -Math.abs(ball.vx) * WALL_REBOUND;
            }

            if (ball.y <= BALL_RADIUS) {
                ball.y = BALL_RADIUS;
                ball.vy = Math.abs(ball.vy) * 0.2;
            }

            state.pegs.forEach((peg) => {
                const dx = ball.x - peg.x;
                const dy = ball.y - peg.y;
                const minDistance = BALL_RADIUS + PEG_RADIUS + 0.5;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq < minDistance * minDistance) {
                    const distance = Math.sqrt(distanceSq) || minDistance;
                    const nx = dx / distance;
                    const ny = dy / distance;
                    ball.x = peg.x + nx * minDistance;
                    ball.y = peg.y + ny * minDistance;
                    const relativeVelocity = ball.vx * nx + ball.vy * ny;
                    if (relativeVelocity < 0) {
                        const impulse = -relativeVelocity * PEG_REBOUND;
                        ball.vx += nx * impulse;
                        ball.vy += ny * impulse;
                        const tangentX = -ny;
                        const tangentY = nx;
                        const spin = (Math.random() - 0.5) * 80;
                        ball.vx += tangentX * spin * step;
                        ball.vy += tangentY * spin * step;
                    }
                }
            });

            state.barriers.forEach((barrier) => {
                if (ball.y + BALL_RADIUS <= barrier.top || ball.y - BALL_RADIUS >= barrier.bottom) {
                    return;
                }
                const halfGap = 2;
                if (ball.x + BALL_RADIUS <= barrier.x - halfGap || ball.x - BALL_RADIUS >= barrier.x + halfGap) {
                    return;
                }
                if (ball.x < barrier.x) {
                    ball.x = barrier.x - halfGap - BALL_RADIUS;
                    ball.vx = -Math.abs(ball.vx) * WALL_REBOUND;
                } else {
                    ball.x = barrier.x + halfGap + BALL_RADIUS;
                    ball.vx = Math.abs(ball.vx) * WALL_REBOUND;
                }
                state.lastMovement = performance.now();
            });

            if (ball.y >= height - BALL_RADIUS - 2) {
                ball.y = height - BALL_RADIUS - 2;
                const slotWidth = width / SLOT_COUNT;
                const slotIndex = clamp(Math.floor(ball.x / slotWidth), 0, SLOT_COUNT - 1);
                completed.push({ ball, slotIndex });
            } else {
                state.lastMovement = performance.now();
            }
        });

        completed.forEach(({ ball, slotIndex }) => {
            state.balls = state.balls.filter((b) => b !== ball);
            if (slotIndex === WINNING_SLOT) {
                credits.add(state.payout);
                updateStatus(`won ${formatNumber(state.payout)}φ`);
            } else {
                updateStatus("missed φ");
            }
            state.highlight = {
                index: slotIndex,
                until: performance.now() + 800
            };
        });
    }

    function render() {
        const ctx = state.ctx;
        if (!ctx) {
            return;
        }
        const { width, height } = state.canvasSize;
        const color = getComputedStyle(dom.section ?? dom.canvas).color;
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = color;
        state.pegs.forEach((peg) => {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = color;
        state.barriers.forEach((barrier) => {
            ctx.fillRect(barrier.x - 1, barrier.top, 2, barrier.bottom - barrier.top);
        });

        state.slots.forEach((slot, index) => {
            const isWinning = index === WINNING_SLOT;
            const highlighted = state.highlight && state.highlight.index === index && state.highlight.until > performance.now();
            ctx.beginPath();
            ctx.fillStyle = highlighted
                ? "rgba(255, 215, 0, 0.7)"
                : isWinning
                  ? "rgba(0, 0, 0, 0.25)"
                  : "rgba(0, 0, 0, 0.1)";
            ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.font = `${Math.min(16, slot.radius)}px 'Inter', sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(SLOT_LABELS[index] ?? `${index}`, slot.x, slot.y);
        });

        if (state.highlight && state.highlight.until <= performance.now()) {
            state.highlight = null;
        }

        ctx.fillStyle = color;
        state.balls.forEach((ball) => {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function loop(now) {
        const deltaSeconds = Math.min((now - state.lastFrameTime) / 1000, MAX_ACCUMULATOR);
        state.lastFrameTime = now;
        state.accumulator = Math.min(state.accumulator + deltaSeconds, MAX_ACCUMULATOR);

        while (state.accumulator >= PHYSICS_STEP) {
            physicsStep(PHYSICS_STEP);
            state.accumulator -= PHYSICS_STEP;
        }

        render();

        if (state.balls.length > 0) {
            state.animationId = requestAnimationFrame(loop);
        } else {
            state.animationId = null;
        }
    }

    function dropBallRandom() {
        const { width } = state.canvasSize;
        const x = BALL_RADIUS + Math.random() * (width - BALL_RADIUS * 2);
        state.balls.push({ x, y: BALL_RADIUS + 4, vx: (Math.random() - 0.5) * 200, vy: 60 });
        state.lastMovement = performance.now();
        updateStatus("ball dropping...", { duration: 800 });
        ensureAnimationLoop();
    }

    function attemptDrop() {
        const now = Date.now();
        if (now < state.nextAvailableDrop) {
            updateStatus("pachinko is cooling down", { duration: 1200 });
            return;
        }
        state.nextAvailableDrop = now + state.dropCooldown;
        dropBallRandom();
    }

    function handleKeyDown(event) {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }
        event.preventDefault();
        attemptDrop();
    }

    function handlePayoutUpgrade() {
        const cost = Math.ceil(PAYOUT_BASE_COST * Math.pow(PAYOUT_GROWTH, state.payoutLevel));
        if (!credits.spend(cost)) {
            return;
        }
        state.payoutLevel += 1;
        state.payout += 1;
        refreshUpgradeStates();
    }

    function handleSpeedUpgrade() {
        const nextCooldown = Math.max(MIN_COOLDOWN, Math.round(state.dropCooldown * 0.85));
        if (nextCooldown >= state.dropCooldown - 1) {
            return;
        }
        const cost = Math.ceil(SPEED_BASE_COST * Math.pow(SPEED_GROWTH, state.speedLevel));
        if (!credits.spend(cost)) {
            return;
        }
        state.speedLevel += 1;
        state.dropCooldown = nextCooldown;
        refreshUpgradeStates();
    }

    function bindEvents() {
        dom.canvas?.addEventListener("keydown", handleKeyDown);
        const dropButton = document.getElementById("pachinko-drop");
        dropButton?.addEventListener("click", attemptDrop);
        dom.payoutUpgrade?.addEventListener("click", handlePayoutUpgrade);
        dom.speedUpgrade?.addEventListener("click", handleSpeedUpgrade);
    }

    function unbindEvents() {
        dom.canvas?.removeEventListener("keydown", handleKeyDown);
        const dropButton = document.getElementById("pachinko-drop");
        dropButton?.removeEventListener("click", attemptDrop);
        dom.payoutUpgrade?.removeEventListener("click", handlePayoutUpgrade);
        dom.speedUpgrade?.removeEventListener("click", handleSpeedUpgrade);
    }

    function init() {
        if (!dom.canvas) {
            return;
        }
        dom.canvas.style.touchAction = "none";
        resizeCanvas();
        refreshUpgradeStates();
        updateStatus("press drop or hit space to launch a ball", { duration: 2600 });
        bindEvents();
        if (state.unsubscribeCredits) {
            state.unsubscribeCredits();
        }
        state.unsubscribeCredits = credits.subscribe(() => refreshUpgradeStates());
        if (state.safetyInterval) {
            clearInterval(state.safetyInterval);
        }
        state.safetyInterval = window.setInterval(safetyCheck, 1000);
        if (state.resizeObserver) {
            state.resizeObserver.disconnect();
        }
        if (typeof ResizeObserver !== "undefined") {
            state.resizeObserver = new ResizeObserver(() => {
                resizeCanvas();
            });
            state.resizeObserver.observe(dom.canvas.parentElement ?? dom.canvas);
        } else {
            state.resizeHandler = () => resizeCanvas();
            window.addEventListener("resize", state.resizeHandler);
        }
        state.nextAvailableDrop = Date.now();
    }

    function show() {
        refreshUpgradeStates();
    }

    function hide() {
        resetBoard({ silent: true });
    }

    function destroy() {
        resetBoard();
        unbindEvents();
        if (state.unsubscribeCredits) {
            state.unsubscribeCredits();
            state.unsubscribeCredits = null;
        }
        if (state.safetyInterval) {
            clearInterval(state.safetyInterval);
            state.safetyInterval = null;
        }
        if (state.resizeObserver) {
            state.resizeObserver.disconnect();
            state.resizeObserver = null;
        }
        if (state.resizeHandler) {
            window.removeEventListener("resize", state.resizeHandler);
            state.resizeHandler = null;
        }
        if (state.statusTimeout) {
            clearTimeout(state.statusTimeout);
            state.statusTimeout = null;
        }
    }

    return {
        id: "pachinko",
        section: dom.section,
        init,
        show,
        hide,
        destroy
    };
}
