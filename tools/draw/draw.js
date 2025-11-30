window.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-stack');
    const canvasSizeSelect = document.getElementById('canvas-size');
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

    let layers = [];
    let activeLayerIndex = 0;
    let canvas;
    let ctx;

    let drawing = false;
    let canvasSize = 16;
    let brushSize = 1;
    let lastPos = null;
    let selectedColor = '#000000';
    let editMode = false;
    let selectedBrushType = 'square';
    let isFilling = false;
    let prevBrushType = null;
    let rightClickErasing = false;
    let lineStartPos = null;
    let ghostCanvas = null;
    let ghostCtx = null;

    let color1 = '#000000';
    let color2 = '#FFFFFF';
    let activeColorSlot = 1;

    let currentBrushSizeType = '5';

    let strokeDirX = 1;
    let strokeDirY = 0;
    let hasStrokeDir = false;
    let strokePhase = 0;


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

    function createLayer() {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = canvasSize;
        layerCanvas.height = canvasSize;
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
        dropZone.style.height = '8px';
        dropZone.style.margin = '0';
        dropZone.style.padding = '0';
        dropZone.style.background = 'transparent';


        const ctx = layerCanvas.getContext('2d', { willReadFrequently: true });
        const blankImageData = ctx.createImageData(canvasSize, canvasSize);
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.putImageData(blankImageData, 0, 0);


        const layer = {
            canvas: layerCanvas,
            ctx,
            preview,
            previewCtx,
            alphaInput,
            toggleButton,
            item,
            dropZone,
            size: canvasSize,
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
        updateBrushSize(currentBrushSizeType);
        layers[index].canvas.style.pointerEvents = 'auto';
        layers[index].item.classList.add('active');
        canvasSizeSelect.value = canvasSize.toString();

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

    function initGhostCanvas() {
        if (!ghostCanvas) {
            ghostCanvas = document.createElement('canvas');
            ghostCanvas.width = canvas.width;
            ghostCanvas.height = canvas.height;
            ghostCanvas.style.position = 'absolute';
            ghostCanvas.style.pointerEvents = 'none';
            ghostCanvas.style.zIndex = '10';
            ghostCanvas.style.opacity = '0.5';
            

            const canvasRect = canvas.getBoundingClientRect();
            ghostCanvas.style.top = canvasRect.top + 'px';
            ghostCanvas.style.left = canvasRect.left + 'px';
            ghostCanvas.style.width = canvasRect.width + 'px';
            ghostCanvas.style.height = canvasRect.height + 'px';
            

            ghostCanvas.style.imageRendering = 'pixelated';
            ghostCanvas.style.imageRendering = '-moz-crisp-edges';
            ghostCanvas.style.imageRendering = 'crisp-edges';
            
            document.body.appendChild(ghostCanvas);
            ghostCtx = ghostCanvas.getContext('2d');
            ghostCtx.imageSmoothingEnabled = false;
        } else {

            const canvasRect = canvas.getBoundingClientRect();
            ghostCanvas.style.top = canvasRect.top + 'px';
            ghostCanvas.style.left = canvasRect.left + 'px';
            ghostCanvas.style.width = canvasRect.width + 'px';
            ghostCanvas.style.height = canvasRect.height + 'px';
        }
    }

    function clearGhostCanvas() {
        if (ghostCtx) {
            ghostCtx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
        }
    }

    function drawGhostLine(start, end) {
        if (!ghostCtx) {
            return;
        }
        
        clearGhostCanvas();
        

        let x0 = start.x;
        let y0 = start.y;
        let x1 = end.x;
        let y1 = end.y;
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        

        ghostCtx.fillStyle = selectedColor;
        ghostCtx.globalAlpha = 0.6;
        
        while (true) {

            const halfBrush = Math.floor(brushSize / 2);
            const startX = x0 - halfBrush;
            const startY = y0 - halfBrush;
            const endX = Math.min(startX + brushSize, canvasSize);
            const endY = Math.min(startY + brushSize, canvasSize);
            const actualStartX = Math.max(0, startX);
            const actualStartY = Math.max(0, startY);
            const actualWidth = endX - actualStartX;
            const actualHeight = endY - actualStartY;
            
            if (actualWidth > 0 && actualHeight > 0) {
                ghostCtx.fillRect(actualStartX, actualStartY, actualWidth, actualHeight);
            }
            
            if (x0 === x1 && y0 === y1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
        
        ghostCtx.globalAlpha = 1.0;
    }

    function start(e) {

        const pos = getPos(e);
        lastPos = pos;


        if (selectedBrushType === 'fill') {
            drawFillTool(pos);
            return;
        }

        drawing = true;

        hasStrokeDir = false;
        strokePhase = Math.random() * Math.PI * 2;

        if (selectedBrushType === 'line') {
            lineStartPos = pos;
            initGhostCanvas();
        }
        drawAtPosition(pos);
        draw(e);
    }

    function draw(e) {
        if (!drawing) return;
        const pos = getPos(e);
        

        if (selectedBrushType === 'line') {
            lastPos = pos;
            if (lineStartPos) {
                drawGhostLine(lineStartPos, pos);
            }
            return;
        }
        
        if (lastPos) {
            const dx = pos.x - lastPos.x;
            const dy = pos.y - lastPos.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
                strokeDirX = dx / len;
                strokeDirY = dy / len;
                hasStrokeDir = true;
            }
            drawLine(lastPos, pos);
        }
        
        lastPos = pos;
    }

    function drawLine(from, to) {

        let x0 = from.x;
        let y0 = from.y;
        let x1 = to.x;
        let y1 = to.y;
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        while (true) {

            if (selectedBrushType === 'line') {
                drawSquareBrush({ x: x0, y: y0 });
            } else {
                drawAtPosition({ x: x0, y: y0 });
            }
            
            if (x0 === x1 && y0 === y1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }

        updatePreview(layers[activeLayerIndex]);
    }

    function drawAtPosition(pos) {
        switch (selectedBrushType) {
            case 'square':
                drawSquareBrush(pos);
                break;
            case 'flock':
                drawFlockBrush(pos);
                break;
            case 'line':
                drawLineTool(pos);
                break;
            case 'fill':
                drawFillTool(pos);
                break;
            case 'eraser':
                drawEraser(pos);
                break;
            default:
                drawSquareBrush(pos);
        }
        updatePreview(layers[activeLayerIndex]);
    }

    function drawSquareBrush(pos) {

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
            ctx.fillStyle = selectedColor;
            ctx.fillRect(actualStartX, actualStartY, actualWidth, actualHeight);
        }
    }

    function drawFlockBrush(pos) {
        let radius = Math.max(1, brushSize / 2);
        const highRes = canvasSize >= 512;
        const isMediumBrush = highRes && currentBrushSizeType === '10';
        const paddingMultiplier = isMediumBrush ? 0.35 : 0.15;

        if (isMediumBrush) {
            radius = Math.max(radius * 1.45, brushSize);
        }

        const padding = Math.max(2, Math.ceil(radius * paddingMultiplier));
        const startX = Math.max(0, Math.floor(pos.x - radius - padding));
        const startY = Math.max(0, Math.floor(pos.y - radius - padding));
        const endX = Math.min(canvasSize, Math.ceil(pos.x + radius + padding));
        const endY = Math.min(canvasSize, Math.ceil(pos.y + radius + padding));
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
        if (!hasStrokeDir) {
            dirX = 1;
            dirY = 0;
        }

        let textureDensity = highRes ? 0.9 : 0.7;
        let waxStrength = highRes ? 0.75 : 0.6;
        let jitterRange = Math.max(0.4, radius * 0.1);
        let highlightMin = 0.9;
        let highlightRange = 0.25;
        let stripeFrequency = isMediumBrush ? 10 : 6;

        if (isMediumBrush) {
            textureDensity = 0.97;
            waxStrength = 0.85;
            jitterRange = Math.max(0.3, radius * 0.06);
            highlightMin = 0.98;
            highlightRange = 0.18;
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = (startX + x) - pos.x;
                const dy = (startY + y) - pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const jitter = (Math.random() - 0.5) * jitterRange;

                if (distance + jitter > radius) {
                    continue;
                }

                const along = dx * dirX + dy * dirY;
                const across = -dx * dirY + dy * dirX;
                const normAcross = Math.min(1, Math.abs(across) / radius);
                const coreFactor = Math.max(0, 1 - distance / radius);

                const stripe = 0.5 + 0.5 * Math.sin((along / radius) * stripeFrequency + strokePhase);

                let coverage = textureDensity;
                coverage *= 0.6 + 0.4 * stripe;
                coverage *= 0.5 + 0.5 * coreFactor;
                coverage *= 0.85 + 0.3 * (1 - normAcross);

                if (Math.random() > coverage) {
                    continue;
                }

                const idx = (y * width + x) * 4;
                const highlight = highlightMin + Math.random() * highlightRange;
                const targetR = Math.min(255, rgb.r * highlight);
                const targetG = Math.min(255, rgb.g * highlight);
                const targetB = Math.min(255, rgb.b * highlight);
                const mix = Math.min(0.95, Math.max(0.25, waxStrength + (Math.random() - 0.5) * 0.25));
                const inv = 1 - mix;

                data[idx] = Math.round(targetR * mix + data[idx] * inv);
                data[idx + 1] = Math.round(targetG * mix + data[idx + 1] * inv);
                data[idx + 2] = Math.round(targetB * mix + data[idx + 2] * inv);
                data[idx + 3] = Math.min(255, data[idx + 3] * (1 - mix * 0.15) + 255 * mix);
            }
        }

        ctx.putImageData(imageData, startX, startY);
    }

    function drawLineTool(pos) {


        drawSquareBrush(pos);
    }

    function drawFillTool(pos) {

        if (isFilling) {
            return;
        }
        
        isFilling = true;
        

        const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
        const data = imageData.data;
        

        const index = (pos.y * canvasSize + pos.x) * 4;
        const targetColor = {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2],
            a: data[index + 3]
        };
        

        const fillColor = hexToRgb(selectedColor);
        

        const isTransparent = targetColor.a === 0;
        

        const stack = [{x: pos.x, y: pos.y}];
        const visited = new Set();
        
        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key) || x < 0 || x >= canvasSize || y < 0 || y >= canvasSize) {
                continue;
            }
            
            visited.add(key);
            

            const currentIndex = (y * canvasSize + x) * 4;
            const currentColor = {
                r: data[currentIndex],
                g: data[currentIndex + 1],
                b: data[currentIndex + 2],
                a: data[currentIndex + 3]
            };
            

            let shouldFill = false;
            
            if (isTransparent) {

                shouldFill = currentColor.a === 0;
            } else {

                shouldFill = currentColor.r === targetColor.r && currentColor.g === targetColor.g && 
                    currentColor.b === targetColor.b && currentColor.a === targetColor.a;
            }
            
            if (shouldFill) {

                data[currentIndex] = fillColor.r;
                data[currentIndex + 1] = fillColor.g;
                data[currentIndex + 2] = fillColor.b;
                data[currentIndex + 3] = 255;
                

                stack.push({x: x + 1, y: y});
                stack.push({x: x - 1, y: y});
                stack.push({x: x, y: y + 1});
                stack.push({x: x, y: y - 1});
            }
        }
        

        ctx.putImageData(imageData, 0, 0);
        

        isFilling = false;

        updatePreview(layers[activeLayerIndex]);

        saveCanvasState();
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
        

        const outputSize = canvasSize < 512 ? 512 : canvasSize;
        

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
            

            const sizes = Array.from(canvasSizeSelect.options).map(opt => parseInt(opt.value));
            let bestSize;
            
            if (width === height && sizes.includes(width)) {

                bestSize = width;
            } else {

                const minSide = Math.min(width, height);
                let closest = sizes[0];
                for (const s of sizes) {
                    if (Math.abs(s - minSide) < Math.abs(closest - minSide)) {
                        closest = s;
                    }
                }
                bestSize = closest;
            }
            

            resizeLayer(activeLayer, bestSize);
            

            canvasSizeSelect.value = bestSize.toString();
            

            activeLayer.ctx.clearRect(0, 0, bestSize, bestSize);
            activeLayer.ctx.drawImage(img, 0, 0, width, height, 0, 0, bestSize, bestSize);
            

            updatePreview(activeLayer);
            

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

            ctx.clearRect(actualStartX, actualStartY, actualWidth, actualHeight);
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

            if (selectedBrushType === 'line' && lineStartPos && lastPos) {
                drawLine(lineStartPos, lastPos);
                clearGhostCanvas();
            }
            

            saveCanvasState();
        }
        drawing = false;
        lastPos = null;
        lineStartPos = null;
        clearGhostCanvas();


        restoreBrushFromErase();
    }

    function resizeLayer(layer, size) {
        const oldSize = layer.size;
        const oldData = layer.ctx.getImageData(0, 0, oldSize, oldSize);

        layer.size = size;
        layer.canvas.width = size;
        layer.canvas.height = size;


        if (ghostCanvas) {
            ghostCanvas.width = size;
            ghostCanvas.height = size;
            

            const canvasRect = canvas.getBoundingClientRect();
            ghostCanvas.style.top = canvasRect.top + 'px';
            ghostCanvas.style.left = canvasRect.left + 'px';
            ghostCanvas.style.width = canvasRect.width + 'px';
            ghostCanvas.style.height = canvasRect.height + 'px';
            

            ghostCanvas.style.imageRendering = 'pixelated';
            ghostCanvas.style.imageRendering = '-moz-crisp-edges';
            ghostCanvas.style.imageRendering = 'crisp-edges';
        }
      
        const newImageData = layer.ctx.createImageData(size, size);

        if (size > oldSize) {

            const offset = Math.floor((size - oldSize) / 2);
            for (let y = 0; y < oldSize; y++) {
                for (let x = 0; x < oldSize; x++) {
                    const oldIndex = (y * oldSize + x) * 4;
                    const newIndex = ((y + offset) * size + (x + offset)) * 4;
                    newImageData.data[newIndex] = oldData.data[oldIndex];
                    newImageData.data[newIndex + 1] = oldData.data[oldIndex + 1];
                    newImageData.data[newIndex + 2] = oldData.data[oldIndex + 2];
                    newImageData.data[newIndex + 3] = oldData.data[oldIndex + 3];
                }
            }
        } else if (size < oldSize) {

            const ratio = oldSize / size;
            for (let ny = 0; ny < size; ny++) {
                for (let nx = 0; nx < size; nx++) {
                    const startX = Math.floor(nx * ratio);
                    const startY = Math.floor(ny * ratio);
                    const endX = Math.floor((nx + 1) * ratio);
                    const endY = Math.floor((ny + 1) * ratio);
                    const colorCount = {};
                    for (let y = startY; y < endY; y++) {
                        for (let x = startX; x < endX; x++) {
                            const idx = (y * oldSize + x) * 4;
                            const r = oldData.data[idx];
                            const g = oldData.data[idx + 1];
                            const b = oldData.data[idx + 2];
                            const a = oldData.data[idx + 3];
                            const key = `${r},${g},${b},${a}`;
                            colorCount[key] = (colorCount[key] || 0) + 1;
                        }
                    }
                    let max = 0;
                    let chosen = '0,0,0,0';
                    for (const key in colorCount) {
                        if (colorCount[key] > max) {
                            max = colorCount[key];
                            chosen = key;
                        }
                    }
                    const [r, g, b, a] = chosen.split(',').map(Number);
                    const newIndex = (ny * size + nx) * 4;
                    newImageData.data[newIndex] = r;
                    newImageData.data[newIndex + 1] = g;
                    newImageData.data[newIndex + 2] = b;
                    newImageData.data[newIndex + 3] = a;
                }
            }
        } else {

            newImageData.data.set(oldData.data);
        }

        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.putImageData(newImageData, 0, 0);

        updateBrushSize(currentBrushSizeType);


        saveCanvasState();
        updatePreview(layer);
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


    canvasSizeSelect.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value);
        const layer = layers[activeLayerIndex];
        resizeLayer(layer, newSize);
        canvasSize = newSize;
        updateBrushSize(currentBrushSizeType);
        

        const blankImageData = layer.ctx.createImageData(newSize, newSize);
        layer.history = [blankImageData];
        layer.historyIndex = 0;


        updatePreview(layer);
    });


    document.querySelectorAll('.brush-size').forEach(button => {
        button.addEventListener('click', () => {

            document.querySelectorAll('.brush-size').forEach(btn => btn.classList.remove('active'));

            button.classList.add('active');

            currentBrushSizeType = button.dataset.size;
            updateBrushSize(button.dataset.size);
        });
    });

    function updateBrushSize(sizeType) {
        const smallSize = 1;
        const xlSize = Math.max(1, Math.floor(canvasSize / 4));
        

        if (canvasSize <= 16) {
            switch(sizeType) {
                case '5':
                    brushSize = 1;
                    break;
                case '10':
                    brushSize = Math.max(1, Math.floor(canvasSize / 8));
                    break;
                case '15':
                    brushSize = Math.max(1, Math.floor(canvasSize / 4));
                    break;
                case '25':
                    brushSize = Math.max(1, Math.floor(canvasSize / 2));
                    break;
                default:
                    brushSize = 1;
            }
        } else {

            const logRange = Math.log(xlSize) - Math.log(smallSize);
            
            switch(sizeType) {
                case '5':
                    brushSize = smallSize;
                    break;
                case '10':
                    brushSize = Math.floor(Math.exp(Math.log(smallSize) + logRange * 0.33) + 1);
                    break;
                case '15':
                    brushSize = Math.floor(Math.exp(Math.log(smallSize) + logRange * 0.67) + 1);
                    break;
                case '25':
                    brushSize = xlSize;
                    break;
                default:
                    brushSize = smallSize;
            }
        }
    }

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


    canvasSizeSelect.value = canvasSize.toString();
    

    updateBrushSize('5');
    

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

        if (key === '1') { 
            currentBrushSizeType = '5';
            updateBrushSize('5'); 
            document.querySelectorAll('.brush-size').forEach(btn => btn.classList.remove('active'));
            const btn = document.querySelector('.brush-size[data-size="5"]');
            if (btn) btn.classList.add('active');
            e.preventDefault(); return; 
        }
        if (key === '2') { 
            currentBrushSizeType = '10';
            updateBrushSize('10'); 
            document.querySelectorAll('.brush-size').forEach(btn => btn.classList.remove('active'));
            const btn = document.querySelector('.brush-size[data-size="10"]');
            if (btn) btn.classList.add('active');
            e.preventDefault(); return; 
        }
        if (key === '3') { 
            currentBrushSizeType = '15';
            updateBrushSize('15'); 
            document.querySelectorAll('.brush-size').forEach(btn => btn.classList.remove('active'));
            const btn = document.querySelector('.brush-size[data-size="15"]');
            if (btn) btn.classList.add('active');
            e.preventDefault(); return; 
        }
        if (key === '4') { 
            currentBrushSizeType = '25';
            updateBrushSize('25'); 
            document.querySelectorAll('.brush-size').forEach(btn => btn.classList.remove('active'));
            const btn = document.querySelector('.brush-size[data-size="25"]');
            if (btn) btn.classList.add('active');
            e.preventDefault(); return; 
        }

        if (key === 'w') { setActiveBrushType('square'); e.preventDefault(); return; }
        if (key === 'a') { setActiveBrushType('flock'); e.preventDefault(); return; }
        if (key === 'e') { setActiveBrushType('eraser'); e.preventDefault(); return; }
        if (key === 's') { setActiveBrushType('line'); e.preventDefault(); return; }
        if (key === 'd') { setActiveBrushType('fill'); e.preventDefault(); return; }


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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveCanvasState();
        updatePreview(layers[activeLayerIndex]);
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
