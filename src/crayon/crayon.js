window.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-stack');
    const canvasStage = document.getElementById('canvas-stage');
    const colorPalette = document.getElementById('color-palette');
    const editButton = document.getElementById('edit-button');
    const resetButton = document.getElementById('reset-button');
    const clearButton = document.getElementById('clear-button');
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    const loadInput = document.getElementById('load-input');
    const saveInputContainer = document.getElementById('save-input-container');
    const saveFilename = document.getElementById('save-filename');
    const saveError = document.getElementById('save-error');
    const addLayerButton = document.getElementById('add-layer-button');
    const layersList = document.getElementById('layers-list');
    const jitterToggle = document.getElementById('jitter-toggle');
    const jitterFlipCanvas = document.getElementById('jitter-flip-canvas');

    const CANVAS_SIZE = 1024;
    const BRUSH_SIZE = 6;
    const BRUSH_CONCENTRATION = 0.5; // 0=concentrated, 1=grainy
    const BRUSH_PATCHINESS = 0.5; // 0=smooth, 1=patchy
    const BRUSH_WAVINESS = 0.7; // 0=straight, 1=wavy
    const CANVAS_BACKGROUND = '#FFFFFF';

    let layers = [];
    let activeLayerIndex = 0;
    let canvas;
    let ctx;

    let drawing = false;
    let canvasSize = CANVAS_SIZE;
    let brushSize = BRUSH_SIZE;
    let lastPos = null;
    let selectedColor = '#000000';
    let editMode = false;
    let selectedBrushType = 'crayon';
    let prevBrushType = null;
    let rightClickErasing = false;
    let strokeDirX = 1;
    let strokeDirY = 0;
    let strokeSpeed = 0;
    let strokeSeed = Math.random() * 10000;
    let strokeVariant = 0;
    let strokePatchSeed = Math.random() * 5000;
    let strokeWidthVariant = Math.random();
    let strokeWaveSeed = Math.random() * 1000;
    let jitterEnabled = false;
    let jitterFlipCtx = jitterFlipCanvas ? jitterFlipCanvas.getContext('2d', { willReadFrequently: true }) : null;
    let jitterSwapTimer = null;
    let jitterShowingOriginal = true;
    let jitterLastInputPos = null;
    let jitterLastRenderedPos = null;
    let jitterStrokeSeed = Math.random() * 10000;
    let jitterStrokeVariant = Math.random();
    let jitterStrokePatchSeed = Math.random() * 5000;
    let jitterStrokeWidthVariant = Math.random();
    let jitterStrokeWaveSeed = Math.random() * 1000;
    let jitterStrokeDirX = 1;
    let jitterStrokeDirY = 0;
    let jitterStrokeSpeed = 0;
    let jitterStrokeBaseOffsetX = 0;
    let jitterStrokeBaseOffsetY = 0;

    let color1 = '#000000';
    let color2 = '#FFFFFF';
    let activeColorSlot = 1;
    if (canvasStage) {
        canvasStage.classList.add('show-original');
    }

    function restoreBrushFromErase() {
        if (rightClickErasing && prevBrushType) {
            rightClickErasing = false;
            setActiveBrushType(prevBrushType);
            prevBrushType = null;
        }
    }


    function clearAllLayerActiveClasses() {
        layers.forEach(l => l.item.classList.remove('active'));
    }

    function ensureJitterSurfaces() {
        if (!jitterFlipCanvas) return;
        if (jitterFlipCanvas.width !== CANVAS_SIZE || jitterFlipCanvas.height !== CANVAS_SIZE) {
            jitterFlipCanvas.width = CANVAS_SIZE;
            jitterFlipCanvas.height = CANVAS_SIZE;
        }
        if (!jitterFlipCtx && jitterFlipCanvas) {
            jitterFlipCtx = jitterFlipCanvas.getContext('2d', { willReadFrequently: true });
            if (jitterFlipCtx) {
                jitterFlipCtx.imageSmoothingEnabled = false;
            }
        }
    }

    function clearJitterCanvases() {
        if (jitterFlipCtx) {
            jitterFlipCtx.setTransform(1, 0, 0, 1, 0, 0);
            jitterFlipCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            jitterFlipCtx.fillStyle = CANVAS_BACKGROUND;
            jitterFlipCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        }
    }

    function syncJitterCanvasWithLayers() {
        if (!jitterFlipCtx) return;
        jitterFlipCtx.setTransform(1, 0, 0, 1, 0, 0);
        jitterFlipCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        jitterFlipCtx.fillStyle = CANVAS_BACKGROUND;
        jitterFlipCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            if (!layer) continue;
            jitterFlipCtx.globalAlpha = layer.alphaInput ? parseFloat(layer.alphaInput.value) : 1;
            jitterFlipCtx.drawImage(layer.canvas, 0, 0, layer.size, layer.size, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        }
        jitterFlipCtx.globalAlpha = 1;
    }

    function setStageModeToOriginal(showOriginal = true) {
        if (!canvasStage) return;
        canvasStage.classList.toggle('show-original', showOriginal);
        canvasStage.classList.toggle('show-jitter', !showOriginal);
    }

    function startJitterSwapLoop() {
        if (jitterSwapTimer !== null) return;
        jitterSwapTimer = setInterval(() => {
            jitterShowingOriginal = !jitterShowingOriginal;
            setStageModeToOriginal(jitterShowingOriginal);
        }, 120);
    }

    function stopJitterSwapLoop() {
        if (jitterSwapTimer !== null) {
            clearInterval(jitterSwapTimer);
            jitterSwapTimer = null;
        }
        jitterShowingOriginal = true;
        setStageModeToOriginal(true);
    }

    function enableJitterMode() {
        if (jitterEnabled || !jitterFlipCanvas || !canvasStage) return;
        ensureJitterSurfaces();
        clearJitterCanvases();
        syncJitterCanvasWithLayers();
        canvasStage.classList.add('jitter-enabled');
        setStageModeToOriginal(true);
        jitterEnabled = true;
        jitterLastInputPos = null;
        jitterLastRenderedPos = null;
        startJitterSwapLoop();
    }

    function disableJitterMode() {
        if (!jitterEnabled) return;
        jitterEnabled = false;
        stopJitterSwapLoop();
        if (canvasStage) {
            canvasStage.classList.remove('jitter-enabled');
        }
        jitterLastInputPos = null;
        jitterLastRenderedPos = null;
        clearJitterCanvases();
    }

    function withJitterContext(task) {
        if (!jitterFlipCtx || !jitterFlipCanvas) return;
        const prevCtx = ctx;
        const prevCanvas = canvas;
        const prevCanvasSize = canvasSize;
        const prevStrokeSeed = strokeSeed;
        const prevStrokeVariant = strokeVariant;
        const prevStrokePatchSeed = strokePatchSeed;
        const prevStrokeWidthVariant = strokeWidthVariant;
        const prevStrokeWaveSeed = strokeWaveSeed;
        const prevStrokeDirX = strokeDirX;
        const prevStrokeDirY = strokeDirY;
        const prevStrokeSpeed = strokeSpeed;

        ctx = jitterFlipCtx;
        canvas = jitterFlipCanvas;
        canvasSize = CANVAS_SIZE;
        strokeSeed = jitterStrokeSeed;
        strokeVariant = jitterStrokeVariant;
        strokePatchSeed = jitterStrokePatchSeed;
        strokeWidthVariant = jitterStrokeWidthVariant;
        strokeWaveSeed = jitterStrokeWaveSeed;
        strokeDirX = jitterStrokeDirX;
        strokeDirY = jitterStrokeDirY;
        strokeSpeed = jitterStrokeSpeed;

        try {
            task();
        } finally {
            ctx = prevCtx;
            canvas = prevCanvas;
            canvasSize = prevCanvasSize;
            strokeSeed = prevStrokeSeed;
            strokeVariant = prevStrokeVariant;
            strokePatchSeed = prevStrokePatchSeed;
            strokeWidthVariant = prevStrokeWidthVariant;
            strokeWaveSeed = prevStrokeWaveSeed;
            strokeDirX = prevStrokeDirX;
            strokeDirY = prevStrokeDirY;
            strokeSpeed = prevStrokeSpeed;
        }
    }

    function drawJitterCrayon(pos, widthFactor = 1) {
        withJitterContext(() => {
            drawCrayonBrush(pos, widthFactor);
        });
    }

    function drawJitterStrokeCap(pos, widthFactor = 1) {
        withJitterContext(() => {
            drawStrokeCap(pos, widthFactor);
        });
    }

    function drawJitterEraser(pos) {
        withJitterContext(() => {
            drawEraser(pos);
        });
    }

    function getJitterStrokeWidthFactor(pos) {
        const jitter = signedNoise(
            Math.floor(pos.x * 0.15),
            Math.floor(pos.y * 0.15),
            jitterStrokeSeed * 2.1 + jitterStrokePatchSeed * 0.83
        );
        return 1 + jitter * 0.25;
    }

    function drawAtPositionJitter(pos, widthFactor = 1) {
        if (!jitterEnabled || !jitterFlipCtx) return;
        switch (selectedBrushType) {
            case 'crayon':
                drawJitterCrayon(pos, widthFactor);
                break;
            case 'eraser':
                drawJitterEraser(pos);
                break;
            default:
                drawJitterCrayon(pos, widthFactor);
        }
    }

    function jitterizePoint(baseX, baseY, travel, dirX, dirY, perpX, perpY, waveStrength) {
        let x = baseX + jitterStrokeBaseOffsetX;
        let y = baseY + jitterStrokeBaseOffsetY;
        const wavePhase = jitterStrokeWaveSeed * 0.019 + travel * 0.31 + jitterStrokeVariant * 4.7;
        const sinWave = Math.sin(wavePhase) * waveStrength * (0.4 + BRUSH_WAVINESS * 0.6);
        const noiseWave = signedNoise(
            Math.floor((baseX + jitterStrokeWaveSeed) * 0.05),
            Math.floor((baseY + jitterStrokeWaveSeed) * 0.05),
            jitterStrokeSeed * 1.5 + travel * 0.4
        ) * waveStrength * (0.35 + BRUSH_WAVINESS * 0.5);
        const wobble = sinWave + noiseWave;
        x += perpX * wobble;
        y += perpY * wobble;
        const alongNoise = signedNoise(
            Math.floor((baseX - wobble) * 0.07),
            Math.floor((baseY + wobble) * 0.07),
            jitterStrokePatchSeed * 0.9 + jitterStrokeWaveSeed * 0.2
        ) * waveStrength * (0.25 + BRUSH_WAVINESS * 0.3);
        x += dirX * alongNoise;
        y += dirY * alongNoise;
        x += signedNoise(
            Math.floor((baseX + travel) * 0.13),
            Math.floor((baseY - travel) * 0.13),
            jitterStrokeSeed * 2.1
        ) * 1.8;
        y += signedNoise(
            Math.floor(baseX * 0.17),
            Math.floor(baseY * 0.17),
            jitterStrokeSeed * 2.6
        ) * 1.8;
        return { x, y };
    }

    function drawLineJitter(fromRaw, toRaw) {
        if (!jitterEnabled || !jitterFlipCtx || !fromRaw || !toRaw) return;
        const dx = toRaw.x - fromRaw.x;
        const dy = toRaw.y - fromRaw.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0) {
            if (selectedBrushType === 'eraser') {
                drawAtPositionJitter(toRaw, 1);
                jitterLastRenderedPos = { x: toRaw.x, y: toRaw.y };
            } else {
                const dirX = jitterStrokeDirX;
                const dirY = jitterStrokeDirY;
                const perpX = -dirY;
                const perpY = dirX;
                const point = jitterizePoint(toRaw.x, toRaw.y, 0, dirX, dirY, perpX, perpY, 6);
                drawAtPositionJitter(point, getJitterStrokeWidthFactor(point));
                jitterLastRenderedPos = point;
            }
            return;
        }

        if (selectedBrushType === 'eraser') {
            const eraserSteps = Math.max(1, Math.ceil(distance / 0.9));
            for (let i = 0; i <= eraserSteps; i++) {
                const t = eraserSteps === 0 ? 0 : i / eraserSteps;
                const sample = {
                    x: fromRaw.x + dx * t,
                    y: fromRaw.y + dy * t
                };
                drawAtPositionJitter(sample, 1);
            }
            jitterLastRenderedPos = { x: toRaw.x, y: toRaw.y };
            return;
        }

        const stepSize = 0.9;
        const steps = Math.max(1, Math.ceil(distance / stepSize));
        const dirX = dx / distance;
        const dirY = dy / distance;
        const lerp = 0.25;
        jitterStrokeDirX = jitterStrokeDirX * (1 - lerp) + dirX * lerp;
        jitterStrokeDirY = jitterStrokeDirY * (1 - lerp) + dirY * lerp;
        const dirNorm = Math.hypot(jitterStrokeDirX, jitterStrokeDirY) || 1;
        jitterStrokeDirX /= dirNorm;
        jitterStrokeDirY /= dirNorm;
        jitterStrokeSpeed = jitterStrokeSpeed * 0.8 + Math.min(distance, 25) * 0.2;

        const perpX = -jitterStrokeDirY;
        const perpY = jitterStrokeDirX;
        const wavinessLevel = Math.min(1, Math.max(0, BRUSH_WAVINESS));
        const baseWaveStrength = Math.max(0.6, brushSize * (0.25 + jitterStrokeVariant * 0.3));
        const waveStrength = baseWaveStrength * (0.4 + wavinessLevel * 1.4);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const baseX = fromRaw.x + dx * t;
            const baseY = fromRaw.y + dy * t;
            const travel = distance * t;
            const jitterPoint = jitterizePoint(baseX, baseY, travel, jitterStrokeDirX, jitterStrokeDirY, perpX, perpY, waveStrength);
            drawAtPositionJitter(jitterPoint, getJitterStrokeWidthFactor(jitterPoint));
        }
        const finalPoint = jitterizePoint(toRaw.x, toRaw.y, distance, jitterStrokeDirX, jitterStrokeDirY, perpX, perpY, waveStrength);
        jitterLastRenderedPos = finalPoint;
    }

    function beginJitterStroke(pos) {
        if (!jitterEnabled || !jitterFlipCtx) return;
        if (selectedBrushType === 'eraser') {
            jitterLastInputPos = pos;
            jitterLastRenderedPos = pos;
            drawAtPositionJitter(pos, 1);
            return;
        }
        jitterStrokeSeed = Math.random() * 10000;
        jitterStrokeVariant = Math.random();
        jitterStrokePatchSeed = Math.random() * 5000;
        jitterStrokeWidthVariant = Math.random();
        jitterStrokeWaveSeed = Math.random() * 7000;
        const angle = Math.random() * Math.PI * 2;
        jitterStrokeDirX = Math.cos(angle);
        jitterStrokeDirY = Math.sin(angle);
        jitterStrokeSpeed = 0;
        const offsetRange = Math.max(2, brushSize * 0.4);
        jitterStrokeBaseOffsetX = (Math.random() - 0.5) * offsetRange * 2.5;
        jitterStrokeBaseOffsetY = (Math.random() - 0.5) * offsetRange * 2.5;
        jitterLastInputPos = pos;
        const perpX = -jitterStrokeDirY;
        const perpY = jitterStrokeDirX;
        const initialPoint = jitterizePoint(pos.x, pos.y, 0, jitterStrokeDirX, jitterStrokeDirY, perpX, perpY, Math.max(0.6, brushSize * 0.3));
        jitterLastRenderedPos = initialPoint;
        const widthFactor = getJitterStrokeWidthFactor(initialPoint);
        drawAtPositionJitter(initialPoint, widthFactor);
        if (selectedBrushType === 'crayon') {
            drawJitterStrokeCap(initialPoint, widthFactor);
        }
    }

    function endJitterStroke() {
        if (!jitterEnabled || !jitterFlipCtx) return;
        if (jitterLastRenderedPos && selectedBrushType === 'crayon') {
            drawJitterStrokeCap(jitterLastRenderedPos, getJitterStrokeWidthFactor(jitterLastRenderedPos));
        }
        jitterLastInputPos = null;
        jitterLastRenderedPos = null;
    }

    function createLayer() {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = CANVAS_SIZE;
        layerCanvas.height = CANVAS_SIZE;
        layerCanvas.className = 'drawing-layer';
        layerCanvas.style.opacity = '1';
        layerCanvas.style.pointerEvents = 'none';
        layerCanvas.style.zIndex = (layers.length + 1).toString();
        canvasContainer.appendChild(layerCanvas);

        const preview = document.createElement('canvas');
        preview.width = 40;
        preview.height = 40;
        preview.className = 'layer-preview';

        preview.style.imageRendering = 'pixelated';
        preview.style.imageRendering = '-moz-crisp-edges';
        preview.style.imageRendering = 'crisp-edges';
        const previewCtx = preview.getContext('2d');
        previewCtx.imageSmoothingEnabled = false;

        const alphaInput = document.createElement('input');
        alphaInput.type = 'range';
        alphaInput.min = '0';
        alphaInput.max = '1';
        alphaInput.step = '0.01';
        alphaInput.value = '1';

        const toggleButton = document.createElement('button');
        toggleButton.textContent = '>';
        toggleButton.className = 'button layer-toggle-btn';
        toggleButton.style.marginLeft = '4px';
        toggleButton.style.marginRight = '4px';
        toggleButton.title = 'Toggle layer visibility';

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.className = 'button layer-delete-btn';
        deleteButton.style.marginLeft = '4px';
        deleteButton.style.marginRight = '4px';

        const item = document.createElement('div');
        item.className = 'layer-item';
        item.appendChild(toggleButton);
        item.appendChild(preview);
        item.appendChild(alphaInput);
        item.appendChild(deleteButton);


        const dropZone = document.createElement('div');
        dropZone.className = 'layer-drop-zone';
        dropZone.style.height = '3px';
        dropZone.style.margin = '0';
        dropZone.style.padding = '0';
        dropZone.style.background = 'transparent';


        const ctx = layerCanvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = CANVAS_BACKGROUND;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const blankImageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);


        const layer = {
            canvas: layerCanvas,
            ctx,
            preview,
            previewCtx,
            alphaInput,
            toggleButton,
            item,
            dropZone,
            size: CANVAS_SIZE,
            history: [blankImageData],
            historyIndex: 0
        };

        layers.unshift(layer);

        selectLayer(0);



        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIndex = Array.from(layersList.children).indexOf(dropZone.nextSibling);
            if (fromIndex < 0) return;
            let insertIndex = toIndex;
            if (insertIndex < 0) insertIndex = layers.length;
            if (fromIndex === insertIndex || fromIndex + 1 === insertIndex) return;
            const [movedLayer] = layers.splice(fromIndex, 1);
            if (insertIndex > fromIndex) insertIndex--;
            layers.splice(insertIndex, 0, movedLayer);
            layersList.innerHTML = '';
            layers.forEach(l => {
                layersList.appendChild(l.dropZone);
                layersList.appendChild(l.item);
            });
            layers.forEach((l, i) => {
                l.canvas.style.zIndex = (layers.length - i).toString();
            });
            if (activeLayerIndex === fromIndex) {
                activeLayerIndex = insertIndex;
            } else if (fromIndex < activeLayerIndex && insertIndex >= activeLayerIndex) {
                activeLayerIndex--;
            } else if (fromIndex > activeLayerIndex && insertIndex <= activeLayerIndex) {
                activeLayerIndex++;
            }
        });
        layersList.appendChild(dropZone);


        item.draggable = true;
        item.addEventListener('dragstart', (e) => {

            const path = e.composedPath ? e.composedPath() : (e.path || []);
            if (path.includes(alphaInput) || e.target === alphaInput) {
                e.preventDefault();
                return;
            }
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', layers.indexOf(layer));
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            Array.from(layersList.querySelectorAll('.drag-over')).forEach(child => child.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIndex = layers.indexOf(layer);
            if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

            const [movedLayer] = layers.splice(fromIndex, 1);
            layers.splice(toIndex, 0, movedLayer);

            layersList.innerHTML = '';
            layers.forEach(l => {
                layersList.appendChild(l.dropZone);
                layersList.appendChild(l.item);
            });

            layers.forEach((l, i) => {
                l.canvas.style.zIndex = (layers.length - i).toString();
            });

            if (activeLayerIndex === fromIndex) {
                activeLayerIndex = toIndex;
            } else if (fromIndex < activeLayerIndex && toIndex >= activeLayerIndex) {
                activeLayerIndex--;
            } else if (fromIndex > activeLayerIndex && toIndex <= activeLayerIndex) {
                activeLayerIndex++;
            }
        });


        item.addEventListener('click', (e) => {
            if (e.target === item || e.target === preview) {
                selectLayer(layers.indexOf(layer));
            }
        });


        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentOpacity = parseFloat(alphaInput.value);
            if (currentOpacity > 0) {
                layer.savedOpacity = currentOpacity;
                alphaInput.value = '0';
                layerCanvas.style.opacity = '0';
                layer.alpha = 0;
                toggleButton.textContent = '<';
                alphaInput.disabled = true;
            } else {
                const restoreOpacity = layer.savedOpacity || 1;
                alphaInput.value = restoreOpacity.toString();
                layerCanvas.style.opacity = restoreOpacity.toString();
                layer.alpha = restoreOpacity;
                toggleButton.textContent = '>';
                alphaInput.disabled = false;
            }
        });

        alphaInput.addEventListener('input', () => {
            layerCanvas.style.opacity = alphaInput.value;
            layer.alpha = parseFloat(alphaInput.value);
        });


        alphaInput.addEventListener('mousedown', (e) => e.stopPropagation());
        alphaInput.addEventListener('pointerdown', (e) => e.stopPropagation());
        alphaInput.addEventListener('dragstart', (e) => e.stopPropagation());

        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            restoreBrushFromErase();
            const layerIndex = layers.indexOf(layer);
            if (layers.length <= 1) {
                return;
            }
            layer.canvas.remove();
            item.remove();
            dropZone.remove();
            layers.splice(layerIndex, 1);
            if (layerIndex === activeLayerIndex) {
                const newActiveIndex = 0;
                selectLayer(newActiveIndex);
            } else if (layerIndex < activeLayerIndex) {
                activeLayerIndex--;
                selectLayer(activeLayerIndex);
            }
            layers.forEach((remainingLayer, index) => {
                remainingLayer.canvas.style.zIndex = (layers.length - index).toString();
            });
            updateAddLayerButtonVisibility();
            layersList.innerHTML = '';
            layers.forEach(l => {
                layersList.appendChild(l.dropZone);
                layersList.appendChild(l.item);
            });
        });

        updatePreview(layer);
        updateAddLayerButtonVisibility();
        layersList.innerHTML = '';
        layers.forEach(l => {
            layersList.appendChild(l.dropZone);
            layersList.appendChild(l.item);
        });

        updatePreview(layer);


        alphaInput.addEventListener('mousedown', () => { item.draggable = false; });
        alphaInput.addEventListener('touchstart', () => { item.draggable = false; });
        alphaInput.addEventListener('focus', () => { item.draggable = false; });

        alphaInput.addEventListener('mouseup', () => { item.draggable = true; });
        alphaInput.addEventListener('touchend', () => { item.draggable = true; });
        alphaInput.addEventListener('blur', () => { item.draggable = true; });


        alphaInput.style.accentColor = (document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode')) ? 'red' : 'blue';
    }

    function updateAddLayerButtonVisibility() {
        if (layers.length >= 5) {
            addLayerButton.style.display = 'none';
        } else {
            addLayerButton.style.display = 'block';
        }
    }

    function updatePreview(layer) {

        const isDark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode');
        const bg = isDark ? '#202020' : '#e0e0e0';
        layer.previewCtx.clearRect(0, 0, layer.preview.width, layer.preview.height);
        layer.previewCtx.fillStyle = bg;
        layer.previewCtx.fillRect(0, 0, layer.preview.width, layer.preview.height);
        layer.previewCtx.drawImage(layer.canvas, 0, 0, layer.preview.width, layer.preview.height);
    }

    function selectLayer(index) {

        restoreBrushFromErase();
        clearAllLayerActiveClasses();
        if (activeLayerIndex !== undefined && layers[activeLayerIndex]) {
            layers[activeLayerIndex].canvas.style.pointerEvents = 'none';
        }
        activeLayerIndex = index;
        canvas = layers[index].canvas;
        ctx = layers[index].ctx;
        canvasSize = layers[index].size;
        layers[index].canvas.style.pointerEvents = 'auto';
        layers[index].item.classList.add('active');

    }

    function getPos(e) {
        const rect = canvasContainer.getBoundingClientRect();
        let x, y;
        if (e.touches) {
            const t = e.touches[0];
            x = t.clientX - rect.left;
            y = t.clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: Math.floor(x * scaleX),
            y: Math.floor(y * scaleY)
        };
    }

    function start(e) {

        const pos = getPos(e);
        lastPos = pos;

        drawing = true;
        strokeSeed = Math.random() * 10000;
        strokeVariant = Math.random();
        strokePatchSeed = Math.random() * 5000;
        strokeWidthVariant = Math.random();
        strokeWaveSeed = Math.random() * 7000;
        const initialAngle = Math.random() * Math.PI * 2;
        strokeDirX = Math.cos(initialAngle);
        strokeDirY = Math.sin(initialAngle);
        strokeSpeed = 0;

        const widthFactor = getStrokeWidthFactor(pos);
        drawAtPosition(pos, false, widthFactor);
        if (selectedBrushType === 'crayon') {
            drawStrokeCap(pos, widthFactor);
        }
        if (jitterEnabled) {
            beginJitterStroke(pos);
        }
        draw(e);
    }

    function draw(e) {
        if (!drawing) return;
        const pos = getPos(e);
        
        if (lastPos) {
            const dx = pos.x - lastPos.x;
            const dy = pos.y - lastPos.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
                const ndx = dx / len;
                const ndy = dy / len;
                const lerp = 0.25;
                strokeDirX = strokeDirX * (1 - lerp) + ndx * lerp;
                strokeDirY = strokeDirY * (1 - lerp) + ndy * lerp;
                const norm = Math.hypot(strokeDirX, strokeDirY) || 1;
                strokeDirX /= norm;
                strokeDirY /= norm;
                strokeSpeed = strokeSpeed * 0.8 + Math.min(len, 25) * 0.2;
            }
            drawLine(lastPos, pos);
        }
        
        lastPos = pos;
        if (jitterEnabled) {
            if (!jitterLastInputPos) {
                jitterLastInputPos = pos;
            }
            drawLineJitter(jitterLastInputPos, pos);
            jitterLastInputPos = pos;
        }
    }

    function drawLine(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy);

        if (distance === 0) {
            drawAtPosition(from, false, getStrokeWidthFactor(from));
            return;
        }

        const stepSize = 0.9;
        const steps = Math.max(1, Math.ceil(distance / stepSize));
        const dirX = dx / distance;
        const dirY = dy / distance;
        const perpX = -dirY;
        const perpY = dirX;
        const wavinessLevel = Math.min(1, Math.max(0, BRUSH_WAVINESS));
        const baseWaveStrength = Math.max(0.3, brushSize * (0.2 + strokeVariant * 0.15));
        const waveStrength = baseWaveStrength * (0.15 + wavinessLevel * 1.2);
        const sinAmp = 0.4 + wavinessLevel * 0.4;
        const noiseAmp = 0.25 + wavinessLevel * 0.55;
        const alongAmp = 0.12 + wavinessLevel * 0.28;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            let x = from.x + dx * t;
            let y = from.y + dy * t;
            const travel = distance * t;
            const wavePhase = strokeWaveSeed * 0.02 + travel * 0.25 + strokeVariant * 3.3;
            const sinWave = Math.sin(wavePhase) * waveStrength * sinAmp;
            const noiseWave = signedNoise(
                Math.floor((x + strokeWaveSeed) * 0.05),
                Math.floor((y + strokeWaveSeed) * 0.05),
                strokeSeed * 1.5 + travel * 0.3
            ) * waveStrength * noiseAmp;
            const wobble = sinWave + noiseWave;
            x += perpX * wobble;
            y += perpY * wobble;
            const alongNoise = signedNoise(
                Math.floor((x - wobble) * 0.07),
                Math.floor((y + wobble) * 0.07),
                strokePatchSeed * 1.1 + strokeWaveSeed * 0.3
            ) * waveStrength * alongAmp;
            x += dirX * alongNoise;
            y += dirY * alongNoise;
            const sample = { x, y };
            drawAtPosition(sample, true, getStrokeWidthFactor(sample));
        }

        updatePreview(layers[activeLayerIndex]);
    }

    function getStrokeWidthFactor(pos) {
        const jitter = signedNoise(
            Math.floor(pos.x * 0.15),
            Math.floor(pos.y * 0.15),
            strokeSeed * 2.1 + strokePatchSeed * 0.83
        );
        return 1 + jitter * 0.2;
    }

    function drawAtPosition(pos, skipPreview = false, widthFactor = 1) {
        switch (selectedBrushType) {
            case 'crayon':
                drawCrayonBrush(pos, widthFactor);
                break;
            case 'eraser':
                drawEraser(pos);
                break;
            default:
                drawCrayonBrush(pos, widthFactor);
        }
        if (!skipPreview) {
            updatePreview(layers[activeLayerIndex]);
        }
    }

    function drawCrayonBrush(pos, widthFactor = 1) {
        const widthScale = Math.max(0.5, widthFactor);
        const concentrationLevel = Math.min(1, Math.max(0, BRUSH_CONCENTRATION));
        const patchinessLevel = Math.min(1, Math.max(0, BRUSH_PATCHINESS));
        const denseBoost = 1 + (1 - concentrationLevel) * 0.5;
        const patchFalloff = 0.02 + patchinessLevel * 0.35 + concentrationLevel * 0.05;
        const gritFalloff = 0.04 + patchinessLevel * 0.45 + concentrationLevel * 0.05;
        const dropoutBias = (concentrationLevel * 0.1) + (patchinessLevel * 0.15);
        const baseRadius = Math.max(0.2, brushSize * (0.45 + strokeWidthVariant * 0.35) * widthScale);
        const momentum = Math.min(strokeSpeed, 25);
        const parallelRadius = baseRadius * (0.95 + momentum * 0.05);
        const perpRadius = baseRadius * (0.45 + strokeVariant * 0.35);
        const taperFactor = Math.max(0.65, 1 - (momentum * 0.02));
        const margin = Math.ceil(Math.max(parallelRadius, perpRadius) + 3);
        const startX = Math.max(0, Math.floor(pos.x - margin));
        const startY = Math.max(0, Math.floor(pos.y - margin));
        const endX = Math.min(canvasSize, Math.ceil(pos.x + margin));
        const endY = Math.min(canvasSize, Math.ceil(pos.y + margin));
        const width = endX - startX;
        const height = endY - startY;

        if (width <= 0 || height <= 0) {
            return;
        }

        const rgb = hexToRgb(selectedColor);
        const imageData = ctx.getImageData(startX, startY, width, height);
        const data = imageData.data;
        let dirX = strokeDirX;
        let dirY = strokeDirY;
        if (Math.abs(dirX) < 1e-3 && Math.abs(dirY) < 1e-3) {
            const angle = strokeSeed % (Math.PI * 2);
            dirX = Math.cos(angle);
            dirY = Math.sin(angle);
        }
        const streakSpacing = (parallelRadius * (0.5 + strokeVariant)) + 2;
        const crossSpacing = Math.max(2, perpRadius * 0.8);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = (startX + x) - pos.x;
                const dy = (startY + y) - pos.y;
                const parallel = dx * dirX + dy * dirY;
                const perpendicular = -dx * dirY + dy * dirX;
                const absParallel = Math.abs(parallel);
                const absPerp = Math.abs(perpendicular);
                const parallelNoise = signedNoise(Math.floor((startX + x) / 4), Math.floor((startY + y) / 4), strokeSeed * 0.7 + strokeWidthVariant * 2000);
                const dynamicParallelRadius = parallelRadius * (0.85 + parallelNoise * 0.3);
                const widthNoise = signedNoise(Math.floor((startX + x + parallel * 0.2)), Math.floor((startY + y + perpendicular * 0.2)), strokeSeed * 1.3 + strokePatchSeed);
                const dynamicPerpRadius = perpRadius * Math.max(0.35, 0.85 + widthNoise * 0.7);
                const ellip = Math.sqrt(
                    (parallel * parallel) / (dynamicParallelRadius * dynamicParallelRadius) +
                    (perpendicular * perpendicular) / (dynamicPerpRadius * dynamicPerpRadius)
                ) * taperFactor;

                if (ellip > 1.25 + Math.random() * 0.35) {
                    if (Math.random() < 0.3) {
                        continue;
                    }
                }

                const edge = Math.max(0, Math.min(1, ellip));
                const grainBase = 0.76 - edge * (0.42 + strokeVariant * 0.22);
                const directionTexture = Math.sin((absParallel / streakSpacing) * (6 + strokeVariant * 4) + strokeSeed * 0.5) * (0.12 + strokeVariant * 0.05);
                const crossHatch = Math.sin((absPerp / crossSpacing) * (2.5 + momentum * 0.05) + strokeSeed) * 0.05;
                const localNoise = signedNoise(startX + x, startY + y, strokeSeed);
                const clusterNoise = signedNoise(Math.floor((startX + x) / 3), Math.floor((startY + y) / 3), strokeSeed * 1.7);
                const jitter = (Math.random() - 0.5) * (0.35 + momentum * 0.015);
                const patchNoise = signedNoise(Math.floor((startX + x) / 6), Math.floor((startY + y) / 6), strokePatchSeed * 1.9);
                const gritNoise = signedNoise(Math.floor((startX + x) / 2), Math.floor((startY + y) / 2), strokeSeed * 2.6);
                let coverage = grainBase +
                    directionTexture +
                    crossHatch +
                    (localNoise * (0.35 + strokeVariant * 0.2)) +
                    (clusterNoise * 0.15) -
                    jitter;
                coverage *= denseBoost;
                coverage -= Math.abs(patchNoise) * patchFalloff;
                coverage -= Math.max(0, gritNoise) * gritFalloff;
                coverage -= dropoutBias;

                if (coverage <= Math.random()) {
                    continue;
                }

                const idx = (y * width + x) * 4;
                data[idx] = rgb.r;
                data[idx + 1] = rgb.g;
                data[idx + 2] = rgb.b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, startX, startY);
    }

    function drawStrokeCap(pos, widthFactor = 1) {
        const widthScale = Math.max(0.5, widthFactor);
        const radius = Math.max(0.25, brushSize * (0.6 + strokeWidthVariant * 0.4) * widthScale);
        const concentrationLevel = Math.min(1, Math.max(0, BRUSH_CONCENTRATION));
        const patchinessLevel = Math.min(1, Math.max(0, BRUSH_PATCHINESS));
        const capDenseBoost = 1 + (1 - concentrationLevel) * 0.4;
        const capDropout = (concentrationLevel * 0.1) + (patchinessLevel * 0.22);
        const margin = Math.ceil(radius + 3);
        const startX = Math.max(0, Math.floor(pos.x - margin));
        const startY = Math.max(0, Math.floor(pos.y - margin));
        const endX = Math.min(canvasSize, Math.ceil(pos.x + margin));
        const endY = Math.min(canvasSize, Math.ceil(pos.y + margin));
        const width = endX - startX;
        const height = endY - startY;
        if (width <= 0 || height <= 0) return;

        const rgb = hexToRgb(selectedColor);
        const imageData = ctx.getImageData(startX, startY, width, height);
        const data = imageData.data;
        const capSeed = strokeSeed * 2.3 + strokePatchSeed;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = (startX + x) - pos.x;
                const dy = (startY + y) - pos.y;
                const dist = Math.hypot(dx, dy);
                const limit = radius * (1.05 + Math.random() * 0.25);
                if (dist > limit) continue;

                const fade = Math.min(1, dist / radius);
                const ringNoise = signedNoise(startX + x, startY + y, capSeed);
                const microNoise = signedNoise(Math.floor((startX + x) / 2), Math.floor((startY + y) / 2), capSeed * 0.5);
                const jitter = (Math.random() - 0.5) * 0.4;
                let coverage = 0.82 - fade * 0.65 + ringNoise * 0.25 + microNoise * 0.15 - jitter;
                coverage = coverage * capDenseBoost - capDropout;
                if (coverage <= Math.random()) continue;

                const idx = (y * width + x) * 4;
                data[idx] = rgb.r;
                data[idx + 1] = rgb.g;
                data[idx + 2] = rgb.b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, startX, startY);
        updatePreview(layers[activeLayerIndex]);
    }

    function signedNoise(x, y, seed) {
        const val = Math.sin((x * 12.9898 + y * 78.233 + seed * 0.125) * 43758.5453);
        return (val - Math.floor(val)) - 0.5;
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : {r: 0, g: 0, b: 0};
    }

    function sanitizeFilename(filename) {

        return filename
            .replace(/[<>:"/\\|?*]/g, '_') 
            .replace(/\s+/g, '_')
            .replace(/^\.+/, '')
            .replace(/\.+$/, '')
            .replace(/_+/g, '_')
            .substring(0, 50);
    }

    function showSaveInput() {
        saveInputContainer.classList.remove('hidden');
        saveInputContainer.setAttribute('aria-hidden', 'false');
        saveError.classList.add('hidden');
        saveFilename.focus();
        saveFilename.select();
    }

    function hideSaveInput() {
        saveInputContainer.classList.add('hidden');
        saveInputContainer.setAttribute('aria-hidden', 'true');
        saveFilename.value = '';
        saveError.classList.add('hidden');
    }

    function saveCanvas() {
        const userInput = saveFilename.value.trim();
        

        if (!userInput) {
            saveError.classList.remove('hidden');
            return;
        }
        

        const sanitizedFilename = sanitizeFilename(userInput);
        

        const outputSize = Math.max(CANVAS_SIZE, canvasSize);
        

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputSize;
        tempCanvas.height = outputSize;
        const tempCtx = tempCanvas.getContext('2d');
        

        tempCtx.imageSmoothingEnabled = false;
        


        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            

            const opacity = layer.alphaInput ? parseFloat(layer.alphaInput.value) : 1;
            tempCtx.globalAlpha = opacity;
            

            tempCtx.drawImage(layer.canvas, 0, 0, layer.size, layer.size, 0, 0, outputSize, outputSize);
        }
        

        tempCtx.globalAlpha = 1;
        

        tempCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const finalFilename = sanitizedFilename.endsWith('.png') ? sanitizedFilename : `${sanitizedFilename}.png`;
            a.download = finalFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            

            hideSaveInput();
        }, 'image/png');
    }

    function loadImageFromFile(file) {
        const img = new Image();
        const objectURL = URL.createObjectURL(file);
        
        img.onload = () => {

            const activeLayer = layers[activeLayerIndex];
            if (!activeLayer) {
                console.error('No active layer to load image onto');
                URL.revokeObjectURL(objectURL);
                loadInput.value = '';
                return;
            }
            
            const width = img.width;
            const height = img.height;
            

            const targetSize = CANVAS_SIZE;
            activeLayer.size = targetSize;
            canvasSize = targetSize;
            

            activeLayer.ctx.fillStyle = CANVAS_BACKGROUND;
            activeLayer.ctx.fillRect(0, 0, targetSize, targetSize);
            activeLayer.ctx.drawImage(img, 0, 0, width, height, 0, 0, targetSize, targetSize);
            

            updatePreview(activeLayer);
            if (jitterEnabled) {
                syncJitterCanvasWithLayers();
            }
            

            saveCanvasState();
            

            selectLayer(activeLayerIndex);
            URL.revokeObjectURL(objectURL);
            loadInput.value = '';
        };
        
        img.onerror = () => {

            console.error('Failed to load image:', file.name);
            URL.revokeObjectURL(objectURL);
            loadInput.value = '';

        };
        
        img.src = objectURL;
    }

    function drawEraser(pos) {

        const halfBrush = Math.floor(brushSize / 2);
        const startX = pos.x - halfBrush;
        const startY = pos.y - halfBrush;
        

        const endX = Math.min(startX + brushSize, canvasSize);
        const endY = Math.min(startY + brushSize, canvasSize);
        const actualStartX = Math.max(0, startX);
        const actualStartY = Math.max(0, startY);
        const actualWidth = endX - actualStartX;
        const actualHeight = endY - actualStartY;
        
        if (actualWidth > 0 && actualHeight > 0) {
            ctx.fillStyle = CANVAS_BACKGROUND;
            ctx.fillRect(actualStartX, actualStartY, actualWidth, actualHeight);
        }

        updatePreview(layers[activeLayerIndex]);
    }

    function createColorPalette() {
        const fixedColors = [

            '#000000', '#202020', '#404040', '#606060',

            '#A0A0A0', '#C0C0C0', '#E0E0E0', '#FFFFFF',

            '#8B0000', '#FF0000', '#FF4444', '#FF8888',

            '#CC6600', '#FF8C00', '#FFAA44', '#FFCC88',

            '#CCCC00', '#FFD700', '#FFE044', '#FFE888',

            '#006600', '#32CD32', '#44FF44', '#88FF88',

            '#000080', '#0000FF', '#4444FF', '#8888FF',

            '#4B0082', '#800080', '#AA44AA', '#CC88CC',

            '#008080', '#20B2AA', '#00CED1', '#40E0D0',

            '#CCCCCC', '#CCCCCC', '#CCCCCC', '#CCCCCC',

            '#CCCCCC', '#CCCCCC', '#CCCCCC', '#CCCCCC'
        ];


        for (let i = 0; i < 44; i++) {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.index = i;
            
            if (i < 36) {

                const color = fixedColors[i];
                swatch.style.backgroundColor = color;
                swatch.dataset.color = color;
                if (color === '#000000') {
                    swatch.classList.add('selected');
                }
                swatch.addEventListener('click', (e) => {
                    if (editMode) {
                        e.stopPropagation();
                        makeProgrammable(swatch);
                    } else {
                        selectColor(swatch, color);

                        if (activeColorSlot === 1) {
                            color1 = color;
                            selectedColor = color1;
                        } else {
                            color2 = color;
                            selectedColor = color2;
                        }
                        updateColorDisplays();
                    }
                });
                

                swatch.addEventListener('mouseenter', () => {
                    if (editMode) {
                        showEditOverlay(swatch);
                    }
                });
                
                swatch.addEventListener('mouseleave', () => {
                    if (editMode) {
                        hideEditOverlay(swatch);
                    }
                });
            } else {

                swatch.style.backgroundColor = '#CCCCCC';
                swatch.dataset.color = '#CCCCCC';
                swatch.dataset.programmable = 'true';
                
                swatch.addEventListener('click', (e) => {
                    if (editMode) {
                        e.stopPropagation();
                        makeProgrammable(swatch);
                    } else if (swatch.dataset.programmable === 'true') {
                        openColorPicker(swatch);
                    } else {

                        selectColor(swatch, swatch.dataset.color);

                        if (activeColorSlot === 1) {
                            color1 = swatch.dataset.color;
                            selectedColor = color1;
                        } else {
                            color2 = swatch.dataset.color;
                            selectedColor = color2;
                        }
                        updateColorDisplays();
                    }
                });
                

                swatch.addEventListener('mouseenter', () => {
                    if (editMode) {
                        showEditOverlay(swatch);
                    }
                });
                
                swatch.addEventListener('mouseleave', () => {
                    if (editMode) {
                        hideEditOverlay(swatch);
                    }
                });
            }
            
            colorPalette.appendChild(swatch);
        }
    }

    function selectColor(swatch, color) {

        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));

        swatch.classList.add('selected');
        if (activeColorSlot === 1) {
            color1 = color;
            selectedColor = color1;
        } else {
            color2 = color;
            selectedColor = color2;
        }
        colorPalette.style.backgroundColor = selectedColor;
    }

    function openColorPicker(swatch) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = swatch.dataset.color;
        
        input.addEventListener('change', (e) => {
            const newColor = e.target.value;
            swatch.style.backgroundColor = newColor;
            swatch.dataset.color = newColor;
            swatch.dataset.programmable = 'false';

            if (activeColorSlot === 1) {
                color1 = newColor;
                selectedColor = color1;
            } else {
                color2 = newColor;
                selectedColor = color2;
            }
            updateColorDisplays();

            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
            colorPalette.style.backgroundColor = selectedColor;
        });
        
        input.click();
    }

    function makeProgrammable(swatch) {
        swatch.style.backgroundColor = '#CCCCCC';
        swatch.dataset.color = '#CCCCCC';
        swatch.dataset.programmable = 'true';
        

        swatch.replaceWith(swatch.cloneNode(true));
        

        const newSwatch = document.querySelector(`[data-index="${swatch.dataset.index}"]`);
        

        newSwatch.addEventListener('click', (e) => {
            if (editMode) {
                e.stopPropagation();
                makeProgrammable(newSwatch);
            } else if (newSwatch.dataset.programmable === 'true') {
                openColorPicker(newSwatch);
            } else {

                selectColor(newSwatch, newSwatch.dataset.color);
            }
        });
        

        newSwatch.addEventListener('mouseenter', () => {
            if (editMode) {
                showEditOverlay(newSwatch);
            }
        });
        
        newSwatch.addEventListener('mouseleave', () => {
            if (editMode) {
                hideEditOverlay(newSwatch);
            }
        });
    }

    function showEditOverlay(swatch) {

        const existingOverlay = document.querySelector('.edit-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'edit-overlay';
        overlay.textContent = 'X';
        

        const currentColor = swatch.dataset.color;
        const invertedColor = getInvertedColor(currentColor);
        overlay.style.color = invertedColor;
        

        const rect = swatch.getBoundingClientRect();
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';
        
        document.body.appendChild(overlay);
    }

    function hideEditOverlay(swatch) {
        const overlay = document.querySelector('.edit-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    function getInvertedColor(hexColor) {

        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        

        if (brightness > 128) {
            return '#000000';
        } else {
            return '#FFFFFF';
        }
    }

    function stop(e) {
        if (drawing) {
            if (lastPos && selectedBrushType === 'crayon') {
                drawStrokeCap(lastPos, getStrokeWidthFactor(lastPos));
            }
            saveCanvasState();
        }
        drawing = false;
        lastPos = null;
        if (jitterEnabled) {
            endJitterStroke();
        }
        restoreBrushFromErase();
    }

    function saveCanvasState() {

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const layer = layers[activeLayerIndex];

        layer.history = layer.history.slice(0, layer.historyIndex + 1);

        layer.history.push(imageData);
        layer.historyIndex++;

        if (layer.history.length > 50) {
            layer.history.shift();
            layer.historyIndex--;
        }
        updatePreview(layer);
    }

    function isImageDataBlank(imageData) {

        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] !== 0) return false;
        }
        return true;
    }

    function undo() {
        const layer = layers[activeLayerIndex];
        if (layer.historyIndex > 0) {
            layer.historyIndex--;
            const previousState = layer.history[layer.historyIndex];
            ctx.putImageData(previousState, 0, 0);
        } else if (layer.historyIndex === 0 && layer.history.length > 0) {
            ctx.putImageData(layer.history[0], 0, 0);
        }
        const currentState = layer.history[layer.historyIndex];
        if (isImageDataBlank(currentState)) {
            layer.previewCtx.clearRect(0, 0, layer.preview.width, layer.preview.height);
        } else {
            updatePreview(layer);
        }
        if (jitterEnabled) {
            syncJitterCanvasWithLayers();
        }
    }

    function redo() {
        const layer = layers[activeLayerIndex];
        if (layer.historyIndex < layer.history.length - 1) {
            layer.historyIndex++;
            const nextState = layer.history[layer.historyIndex];
            ctx.putImageData(nextState, 0, 0);
        }
        const currentState = layer.history[layer.historyIndex];
        if (isImageDataBlank(currentState)) {
            layer.previewCtx.clearRect(0, 0, layer.preview.width, layer.preview.height);
        } else {
            updatePreview(layer);
        }
        if (jitterEnabled) {
            syncJitterCanvasWithLayers();
        }
    }

    canvasContainer.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            if (selectedBrushType !== 'eraser') {
                prevBrushType = selectedBrushType;
                setActiveBrushType('eraser');
            } else {

                if (prevBrushType) {
                    setActiveBrushType(prevBrushType);
                    prevBrushType = null;
                }
            }
            e.preventDefault();
            return;
        }
        start(e);
    });
    canvasContainer.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stop);
    canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    canvasContainer.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvasContainer.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvasContainer.addEventListener('touchend', stop);
    canvasContainer.addEventListener('touchcancel', stop);
    function setActiveBrushType(type) {
        document.querySelectorAll('.brush-type').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        selectedBrushType = type;
    }


    document.querySelectorAll('.brush-type').forEach(button => {
        button.addEventListener('click', () => {
            setActiveBrushType(button.dataset.type);
        });
    });
    createColorPalette();
    

    colorPalette.style.backgroundColor = selectedColor;
    

    activeLayerIndex = undefined;
    canvas = null;
    ctx = null;


    

    createLayer();



    if (layers.length === 0) {
        createLayer();
    }
    if (layers.length > 0) {
        restoreBrushFromErase();
        clearAllLayerActiveClasses();

        layers[0].item.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    }


    addLayerButton.addEventListener('click', () => {
        if (layers.length < 5) {
            createLayer();

            layersList.innerHTML = '';
            layers.forEach(l => {
                layersList.appendChild(l.dropZone);
                layersList.appendChild(l.item);
            });

            clearAllLayerActiveClasses();
            selectLayer(0);
        }
    });
    

    const color1Display = document.getElementById('color1-display');
    const color2Display = document.getElementById('color2-display');

    function updateColorDisplays() {
        color1Display.style.background = color1;
        color2Display.style.background = color2;
        color1Display.style.borderWidth = activeColorSlot === 1 ? '3px' : '2px';
        color2Display.style.borderWidth = activeColorSlot === 2 ? '3px' : '2px';
        color1Display.style.borderColor = activeColorSlot === 1 ? '#333' : '#000';
        color2Display.style.borderColor = activeColorSlot === 2 ? '#333' : '#000';

        const colorSwitchBg = document.querySelector('.color-switch-bg');
        if (colorSwitchBg) {
            colorSwitchBg.style.backgroundColor = activeColorSlot === 1 ? color1 : color2;
        }
    }


    color1Display.addEventListener('click', () => {
        activeColorSlot = 1;
        selectedColor = color1;
        updateColorDisplays();
    });
    color2Display.addEventListener('click', () => {
        activeColorSlot = 2;
        selectedColor = color2;
        updateColorDisplays();
    });


    function selectColor(swatch, color) {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        if (activeColorSlot === 1) {
            color1 = color;
            selectedColor = color1;
        } else {
            color2 = color;
            selectedColor = color2;
        }
        colorPalette.style.backgroundColor = selectedColor;
    }


    document.addEventListener('keydown', (e) => {

        const tag = document.activeElement.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || document.activeElement.isContentEditable) return;
        if (e.altKey) return;

        const key = e.key.toLowerCase();
        if (key === 'q' && !e.repeat) {

            activeColorSlot = activeColorSlot === 1 ? 2 : 1;
            selectedColor = activeColorSlot === 1 ? color1 : color2;
            updateColorDisplays();
            e.preventDefault();
            return;
        }

        if (key === 'c') { setActiveBrushType('crayon'); e.preventDefault(); return; }
        if (key === 'e') { setActiveBrushType('eraser'); e.preventDefault(); return; }


        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey) {
            e.preventDefault();
            redo();
            return;
        }

        if (key === 'r' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }
        if (key === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            redo();
            return;
        }
    });

    if (jitterToggle) {
        jitterToggle.addEventListener('change', () => {
            if (jitterToggle.checked) {
                enableJitterMode();
            } else {
                disableJitterMode();
            }
        });
    }


    updateColorDisplays();
    

    editButton.addEventListener('click', () => {
        editMode = !editMode;
        editButton.textContent = editMode ? 'done' : 'edit';

        
        if (!editMode) {

            document.querySelectorAll('.edit-overlay').forEach(overlay => overlay.remove());
        }
    });


    document.addEventListener('click', (e) => {
        if (editMode) {

            const colorPalette = document.getElementById('color-palette');
            const isClickInPalette = colorPalette.contains(e.target);
            const isClickOnEditButton = editButton.contains(e.target);
            
            if (!isClickInPalette && !isClickOnEditButton) {

                editMode = false;
                editButton.textContent = 'edit';

                document.querySelectorAll('.edit-overlay').forEach(overlay => overlay.remove());
            }
        }
    });
    

    resetButton.addEventListener('click', () => {

        colorPalette.innerHTML = '';

        createColorPalette();

        editMode = false;
        editButton.textContent = 'edit';


        colorPalette.style.backgroundColor = selectedColor;
    });


    clearButton.addEventListener('click', () => {
        ctx.fillStyle = CANVAS_BACKGROUND;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveCanvasState();
        updatePreview(layers[activeLayerIndex]);
        if (jitterEnabled) {
            syncJitterCanvasWithLayers();
        }
    });


    saveButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (saveInputContainer.classList.contains('hidden')) {
            showSaveInput();
        } else {
            hideSaveInput();
        }
    });


    loadButton.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            loadImageFromFile(e.target.files[0]);
        }
    });


    saveFilename.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveCanvas();
        } else if (e.key === 'Escape') {
            hideSaveInput();
        }
    });

    saveInputContainer.addEventListener('click', (event) => {
        event.stopPropagation();
    });


    document.addEventListener('click', (e) => {
        if (saveInputContainer.classList.contains('hidden')) {
            return;
        }
        if (!saveInputContainer.contains(e.target) && !saveButton.contains(e.target)) {
            hideSaveInput();
        }
    });


    if (layers.length > 0) {
        restoreBrushFromErase();
        clearAllLayerActiveClasses();

        layers[0].item.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    }


    document.addEventListener('darkmodechange', () => {
        layers.forEach(layer => {
            updatePreview(layer);
            layer.alphaInput.style.accentColor = (document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode')) ? 'red' : 'blue';
        });
    });

});
