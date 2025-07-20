window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const viewCtx = canvas.getContext('2d', { willReadFrequently: true });
    let layers = [];
    let activeLayer = 0;
    let ctx;
    const canvasSizeSelect = document.getElementById('canvas-size');
    const colorPalette = document.getElementById('color-palette');
    const editButton = document.getElementById('edit-button');
    const resetButton = document.getElementById('reset-button');
    const clearButton = document.getElementById('clear-button');
    const saveButton = document.getElementById('save-button');
    const saveInputContainer = document.getElementById('save-input-container');
    const saveFilename = document.getElementById('save-filename');
    const saveConfirm = document.getElementById('save-confirm');
    const saveCancel = document.getElementById('save-cancel');
    const saveError = document.getElementById('save-error');
    const addLayerButton = document.getElementById('add-layer');
    const layersContainer = document.getElementById('layers');

    let drawing = false;
    let canvasSize = 16; // Default size
    let brushSize = 1; // Default brush size in pixels
    let lastPos = null; // Store the last drawing position
    let selectedColor = '#000000'; // Default color
    let editMode = false; // Track edit mode state
    let canvasHistory = []; // Store canvas states for undo
    let currentHistoryIndex = -1; // Track current position in history
    let selectedBrushType = 'square'; // Default brush type
    let isFilling = false; // Flag to prevent multiple fill operations
    let prevBrushType = null; // Store previous brush when right-click erasing
    let rightClickErasing = false; // Track right click erase state

    function createLayer(size = 16) {
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        return { canvas: off, ctx: off.getContext('2d', { willReadFrequently: true }), size, alpha: 1 };
    }

    function renderLayers() {
        const maxSize = Math.max(...layers.map(l => l.size));
        canvas.width = maxSize;
        canvas.height = maxSize;
        viewCtx.clearRect(0, 0, maxSize, maxSize);
        layers.forEach(layer => {
            if (layer.alpha <= 0) return;
            viewCtx.globalAlpha = layer.alpha;
            viewCtx.drawImage(layer.canvas, 0, 0, layer.size, layer.size, 0, 0, maxSize, maxSize);
        });
        viewCtx.globalAlpha = 1;
    }

    function setActiveLayer(index) {
        activeLayer = index;
        ctx = layers[index].ctx;
        canvasSize = layers[index].size;
        renderLayerUI();
    }

    function renderLayerUI() {
        layersContainer.innerHTML = '';
        layers.forEach((layer, i) => {
            const row = document.createElement('div');
            row.className = 'layer-row';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'active-layer';
            radio.checked = i === activeLayer;
            radio.addEventListener('change', () => setActiveLayer(i));

            const dec = document.createElement('button');
            dec.textContent = '-';
            dec.addEventListener('click', () => changeLayerSize(i, layer.size / 2));

            const inc = document.createElement('button');
            inc.textContent = '+';
            inc.addEventListener('click', () => changeLayerSize(i, layer.size * 2));

            const alpha = document.createElement('input');
            alpha.type = 'range';
            alpha.min = 0;
            alpha.max = 1;
            alpha.step = 0.1;
            alpha.value = layer.alpha;
            alpha.addEventListener('input', () => { layer.alpha = parseFloat(alpha.value); renderLayers(); });

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 's';
            saveBtn.addEventListener('click', () => saveSingleLayer(i));

            row.append(radio, document.createTextNode(`L${i+1}`), dec, inc, alpha, saveBtn);
            layersContainer.appendChild(row);
        });
    }

    function changeLayerSize(index, newSize) {
        newSize = Math.max(16, Math.min(1024, Math.round(newSize / 16) * 16));
        const layer = layers[index];
        const temp = document.createElement('canvas');
        temp.width = newSize;
        temp.height = newSize;
        temp.getContext('2d').drawImage(layer.canvas, 0, 0, newSize, newSize);
        layer.canvas = temp;
        layer.ctx = temp.getContext('2d', { willReadFrequently: true });
        layer.size = newSize;
        if (index === activeLayer) {
            ctx = layer.ctx;
            canvasSize = newSize;
        }
        renderLayerUI();
        renderLayers();
    }

    function saveSingleLayer(index) {
        const layer = layers[index];
        const link = document.createElement('a');
        link.download = `layer${index + 1}.png`;
        link.href = layer.canvas.toDataURL('image/png');
        link.click();
    }

    layers.push(createLayer(16));
    setActiveLayer(0);
    renderLayers();

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let x, y;
        if (e.touches) {
            const t = e.touches[0];
            x = t.clientX - rect.left;
            y = t.clientY - rect.top;
        } else {
            x = e.offsetX;
            y = e.offsetY;
        }
        // Scale coordinates to match the canvas size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { 
            x: Math.floor(x * scaleX), 
            y: Math.floor(y * scaleY) 
        };
    }

    function start(e) {
        if (e.button === 2) {
            rightClickErasing = true;
            prevBrushType = selectedBrushType;
            if (selectedBrushType !== 'eraser') {
                setActiveBrushType('eraser');
            }
        }
        drawing = true;
        const pos = getPos(e);
        const layerPos = {
            x: Math.floor(pos.x * canvasSize / canvas.width),
            y: Math.floor(pos.y * canvasSize / canvas.height)
        };
        lastPos = layerPos;
        drawAtPosition(layerPos);
        draw(e);
    }

    function draw(e) {
        if (!drawing) return;
        const pos = getPos(e);
        const layerPos = {
            x: Math.floor(pos.x * canvasSize / canvas.width),
            y: Math.floor(pos.y * canvasSize / canvas.height)
        };

        if (lastPos) {
            // Draw line between last position and current position
            drawLine(lastPos, layerPos);
        }

        lastPos = layerPos;
        renderLayers();
    }

    function drawLine(from, to) {
        // Bresenham's line algorithm for smooth line drawing
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
            drawAtPosition({ x: x0, y: y0 });
            
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
    }

    function drawAtPosition(pos) {
        switch (selectedBrushType) {
            case 'square':
                drawSquareBrush(pos);
                break;
            case 'circle':
                drawCircleBrush(pos);
                break;
            case 'spray':
                drawSprayBrush(pos);
                break;
            case 'fill':
                drawFillTool(pos);
                break;
            case 'back-slash':
                drawBackSlashBrush(pos);
                break;
            case 'eraser':
                drawEraser(pos);
                break;
            case 'custom1':
            case 'custom2':
                // Placeholder for future custom brushes
                drawSquareBrush(pos);
                break;
            default:
                drawSquareBrush(pos);
        }
    }

    function drawSquareBrush(pos) {
        // Calculate the top-left corner of the brush (center the brush on the cursor)
        const halfBrush = Math.floor(brushSize / 2);
        const startX = pos.x - halfBrush;
        const startY = pos.y - halfBrush;
        
        // Calculate the actual brush size to draw (may be smaller near edges)
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

    function drawCircleBrush(pos) {
        const radius = Math.max(0.5, brushSize / 4);
        const centerX = pos.x;
        const centerY = pos.y;
        
        // Draw filled circle
        ctx.fillStyle = selectedColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    function drawSprayBrush(pos) {
        const radius = Math.floor(brushSize / 2);
        const centerX = pos.x;
        const centerY = pos.y;
        
        // Reduced number of particles for lighter spray
        const particleCount = Math.max(5, brushSize);
        
        ctx.fillStyle = selectedColor;
        
        for (let i = 0; i < particleCount; i++) {
            // Use square root distribution for more even spread
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.sqrt(Math.random()) * radius; // Square root for even distribution
            
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // Only draw if within canvas bounds
            if (x >= 0 && x < canvasSize && y >= 0 && y < canvasSize) {
                // Set alpha for each individual particle
                ctx.globalAlpha = Math.random() * 0.4 + 0.1; // Random alpha between 0.1 and 0.5
                
                // Smaller particle size for lighter spray
                const particleSize = Math.random() * 1 + 0.3;
                ctx.fillRect(x, y, particleSize, particleSize);
            }
        }
        
        // Reset global alpha to 1.0 after spray operation
        ctx.globalAlpha = 1.0;
    }

    function drawFillTool(pos) {
        // Prevent multiple fill operations from running simultaneously
        if (isFilling) {
            return;
        }
        
        isFilling = true;
        
        // Get the entire canvas data once
        const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
        const data = imageData.data;
        
        // Get the target color at clicked position
        const index = (pos.y * canvasSize + pos.x) * 4;
        const targetColor = {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2],
            a: data[index + 3]
        };
        
        // Get fill color
        const fillColor = hexToRgb(selectedColor);
        
        // Check if we're filling transparent/background area
        const isTransparent = targetColor.a === 0;
        
        // Flood fill algorithm with optimized pixel access
        const stack = [{x: pos.x, y: pos.y}];
        const visited = new Set();
        
        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key) || x < 0 || x >= canvasSize || y < 0 || y >= canvasSize) {
                continue;
            }
            
            visited.add(key);
            
            // Get current pixel data directly from array
            const currentIndex = (y * canvasSize + x) * 4;
            const currentColor = {
                r: data[currentIndex],
                g: data[currentIndex + 1],
                b: data[currentIndex + 2],
                a: data[currentIndex + 3]
            };
            
            // Check if pixel should be filled
            let shouldFill = false;
            
            if (isTransparent) {
                // Filling transparent/background area
                shouldFill = currentColor.a === 0;
            } else {
                // Filling a specific color
                shouldFill = currentColor.r === targetColor.r && currentColor.g === targetColor.g && 
                    currentColor.b === targetColor.b && currentColor.a === targetColor.a;
            }
            
            if (shouldFill) {
                // Fill this pixel in the data array
                data[currentIndex] = fillColor.r;
                data[currentIndex + 1] = fillColor.g;
                data[currentIndex + 2] = fillColor.b;
                data[currentIndex + 3] = 255; // Full opacity
                
                // Add neighboring pixels to stack
                stack.push({x: x + 1, y: y});
                stack.push({x: x - 1, y: y});
                stack.push({x: x, y: y + 1});
                stack.push({x: x, y: y - 1});
            }
        }
        
        // Put the modified image data back to canvas once
        ctx.putImageData(imageData, 0, 0);
        
        // Reset the filling flag
        isFilling = false;
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
        // Remove or replace invalid characters for filenames
        return filename
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters with underscore
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/^\.+/, '') // Remove leading dots
            .replace(/\.+$/, '') // Remove trailing dots
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .substring(0, 50); // Limit length
    }

    function showSaveInput() {
        saveInputContainer.style.display = 'flex';
        saveError.style.display = 'none'; // Hide any previous error
        
        // Position the input directly above the save button
        const saveButton = document.getElementById('save-button');
        const buttonRect = saveButton.getBoundingClientRect();
        
        // Calculate position: input should be above the button
        const inputTop = buttonRect.top - 40; // 40px above the button
        const inputLeft = buttonRect.left;
        
        saveInputContainer.style.position = 'fixed';
        saveInputContainer.style.top = inputTop + 'px';
        saveInputContainer.style.left = inputLeft + 'px';
        saveInputContainer.style.zIndex = '1000';
        
        saveFilename.focus();
        saveFilename.select();
    }

    function hideSaveInput() {
        saveInputContainer.style.display = 'none';
        saveFilename.value = '';
        saveError.style.display = 'none'; // Hide error message
        
        // Reset positioning
        saveInputContainer.style.position = '';
        saveInputContainer.style.bottom = '';
        saveInputContainer.style.left = '';
        saveInputContainer.style.zIndex = '';
    }

    function saveCanvas() {
        const userInput = saveFilename.value.trim();
        
        // Validate input
        if (!userInput) {
            saveError.style.display = 'block';
            return;
        }
        
        // Sanitize filename
        const sanitizedFilename = sanitizeFilename(userInput);
        
        const maxSize = Math.max(...layers.map(l => l.size));
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maxSize;
        tempCanvas.height = maxSize;
        const tempCtx = tempCanvas.getContext('2d');

        layers.forEach(layer => {
            if (layer.alpha <= 0) return;
            tempCtx.globalAlpha = layer.alpha;
            tempCtx.drawImage(layer.canvas, 0, 0, layer.size, layer.size, 0, 0, maxSize, maxSize);
        });
        tempCtx.globalAlpha = 1;
        
        // Convert to PNG and download
        tempCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Add .png extension if not already present
            const finalFilename = sanitizedFilename.endsWith('.png') ? sanitizedFilename : `${sanitizedFilename}.png`;
            a.download = finalFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Hide the input after successful save
            hideSaveInput();
        }, 'image/png');
    }

    function drawBackSlashBrush(pos) {
        const size = brushSize;
        const centerX = pos.x;
        const centerY = pos.y;
        
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = Math.max(1, Math.floor(size / 4));
        ctx.beginPath();
        ctx.moveTo(centerX + size/2, centerY - size/2);
        ctx.lineTo(centerX - size/2, centerY + size/2);
        ctx.stroke();
    }

    function drawEraser(pos) {
        // Calculate the top-left corner of the eraser (center the eraser on the cursor)
        const halfBrush = Math.floor(brushSize / 2);
        const startX = pos.x - halfBrush;
        const startY = pos.y - halfBrush;
        
        // Calculate the actual eraser size to draw (may be smaller near edges)
        const endX = Math.min(startX + brushSize, canvasSize);
        const endY = Math.min(startY + brushSize, canvasSize);
        const actualStartX = Math.max(0, startX);
        const actualStartY = Math.max(0, startY);
        const actualWidth = endX - actualStartX;
        const actualHeight = endY - actualStartY;
        
        if (actualWidth > 0 && actualHeight > 0) {
            // Clear the area (eraser effect) - checkerboard shows through automatically
            ctx.clearRect(actualStartX, actualStartY, actualWidth, actualHeight);
        }
    }

    function createColorPalette() {
        const fixedColors = [
            '#000000', '#FFFFFF', '#808080', '#FF0000', 
            '#0000FF', '#00FF00', '#FFFF00', '#FFA500'
        ];

        // Create 12 cells (4x3 grid)
        for (let i = 0; i < 12; i++) {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.index = i;
            
            if (i < 8) {
                // Fixed colors for first 8 cells
                const color = fixedColors[i];
                swatch.style.backgroundColor = color;
                swatch.dataset.color = color;
                
                // Select black by default
                if (color === '#000000') {
                    swatch.classList.add('selected');
                }
                
                swatch.addEventListener('click', (e) => {
                    if (editMode) {
                        e.stopPropagation(); // Prevent click from bubbling up
                        makeProgrammable(swatch);
                    } else {
                        selectColor(swatch, color);
                    }
                });
                
                // Add hover events for edit mode
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
                // Programmable cells for last 4 cells
                swatch.style.backgroundColor = '#CCCCCC';
                swatch.dataset.color = '#CCCCCC';
                swatch.dataset.programmable = 'true';
                
                swatch.addEventListener('click', (e) => {
                    if (editMode) {
                        e.stopPropagation(); // Prevent click from bubbling up
                        makeProgrammable(swatch);
                    } else if (swatch.dataset.programmable === 'true') {
                        openColorPicker(swatch);
                    } else {
                        // Color has been set, just select it
                        selectColor(swatch, swatch.dataset.color);
                    }
                });
                
                // Add hover events for edit mode
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
        // Remove selection from all swatches
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        // Add selection to clicked swatch
        swatch.classList.add('selected');
        selectedColor = color;
        // Update palette background to match selected color
        colorPalette.style.backgroundColor = color;
    }

    function openColorPicker(swatch) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = swatch.dataset.color;
        
        input.addEventListener('change', (e) => {
            const newColor = e.target.value;
            swatch.style.backgroundColor = newColor;
            swatch.dataset.color = newColor;
            swatch.dataset.programmable = 'false'; // Mark as no longer programmable
            selectColor(swatch, newColor);
        });
        
        input.click();
    }

    function makeProgrammable(swatch) {
        swatch.style.backgroundColor = '#CCCCCC';
        swatch.dataset.color = '#CCCCCC';
        swatch.dataset.programmable = 'true';
        
        // Remove existing click listener and add new one for programmable behavior
        swatch.replaceWith(swatch.cloneNode(true));
        
        // Get the new swatch reference
        const newSwatch = document.querySelector(`[data-index="${swatch.dataset.index}"]`);
        
        // Add the programmable click behavior
        newSwatch.addEventListener('click', (e) => {
            if (editMode) {
                e.stopPropagation(); // Prevent click from bubbling up
                makeProgrammable(newSwatch);
            } else if (newSwatch.dataset.programmable === 'true') {
                openColorPicker(newSwatch);
            } else {
                // Color has been set, just select it
                selectColor(newSwatch, newSwatch.dataset.color);
            }
        });
        
        // Add hover events for edit mode
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
        // Remove any existing overlay
        const existingOverlay = document.querySelector('.edit-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'edit-overlay';
        overlay.textContent = 'X';
        
        // Calculate inverted color
        const currentColor = swatch.dataset.color;
        const invertedColor = getInvertedColor(currentColor);
        overlay.style.color = invertedColor;
        
        // Position overlay at mouse cursor
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
        // Convert hex to RGB
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        // Calculate brightness
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        // Use black or white based on brightness for better contrast
        if (brightness > 128) {
            return '#000000'; // Black text for light backgrounds
        } else {
            return '#FFFFFF'; // White text for dark backgrounds
        }
    }

    function stop(e) {
        if (drawing) {
            // Save canvas state when drawing ends
            saveCanvasState();
        }
        drawing = false;
        lastPos = null;

        // Restore brush type if we were right-click erasing
        if (rightClickErasing) {
            rightClickErasing = false;
            if (prevBrushType) {
                setActiveBrushType(prevBrushType);
            }
        }
    }

    function resizeCanvas(size) {
        const oldSize = canvasSize;
        const oldData = ctx.getImageData(0, 0, oldSize, oldSize);

        canvasSize = size;
        layers[activeLayer].canvas.width = size;
        layers[activeLayer].canvas.height = size;

        const newImageData = ctx.createImageData(size, size);

        if (size > oldSize) {
            // Scale up: keep old pixels centred and add empty space around
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
            // Scale down: majority pixel of the corresponding block
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
            // Same size
            newImageData.data.set(oldData.data);
        }

        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.putImageData(newImageData, 0, 0);

        updateBrushSize('5');
        canvasHistory = [];
        currentHistoryIndex = -1;
        saveCanvasState();
        renderLayers();
    }

    function saveCanvasState() {
        // Save current canvas state
        const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
        
        // Remove any states after current index (for redo functionality)
        canvasHistory = canvasHistory.slice(0, currentHistoryIndex + 1);
        
        // Add new state
        canvasHistory.push(imageData);
        currentHistoryIndex++;
        
        // Limit history size to prevent memory issues
        if (canvasHistory.length > 50) {
            canvasHistory.shift();
            currentHistoryIndex--;
        }
    }

    function undo() {
        if (currentHistoryIndex > 0) {
            currentHistoryIndex--;
            const previousState = canvasHistory[currentHistoryIndex];
            ctx.putImageData(previousState, 0, 0);
        }
    }

    function redo() {
        if (currentHistoryIndex < canvasHistory.length - 1) {
            currentHistoryIndex++;
            const nextState = canvasHistory[currentHistoryIndex];
            ctx.putImageData(nextState, 0, 0);
        }
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', stop);
    canvas.addEventListener('touchcancel', stop);

    // Handle canvas size changes
    canvasSizeSelect.addEventListener('change', (e) => {
        resizeCanvas(parseInt(e.target.value));
    });

    // Handle brush size selection
    document.querySelectorAll('.brush-size').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all brush size buttons
            document.querySelectorAll('.brush-size').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            // Update brush size based on canvas size
            updateBrushSize(button.dataset.size);
        });
    });

    function updateBrushSize(sizeType) {
        const smallSize = 1; // S is always 1 pixel
        const xlSize = Math.floor(canvasSize / 4); // XL is always 1/4 of canvas size
        
        // Logarithmic scaling between S (1px) and XL (1/4 canvas size)
        const logRange = Math.log(xlSize) - Math.log(smallSize);
        
        switch(sizeType) {
            case '5': // S
                brushSize = smallSize;
                break;
            case '10': // M
                brushSize = Math.floor(Math.exp(Math.log(smallSize) + logRange * 0.33) + 1);
                break;
            case '15': // L
                brushSize = Math.floor(Math.exp(Math.log(smallSize) + logRange * 0.67) + 1);
                break;
            case '25': // XL
                brushSize = xlSize;
                break;
            default:
                brushSize = smallSize;
        }
    }

    function setActiveBrushType(type) {
        document.querySelectorAll('.brush-type').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        selectedBrushType = type;
    }

    // Handle brush type selection
    document.querySelectorAll('.brush-type').forEach(button => {
        button.addEventListener('click', () => {
            setActiveBrushType(button.dataset.type);
        });
    });

    // Initialize canvas with default size
    resizeCanvas(16);
    
    // Set initial brush size
    updateBrushSize('5'); // Start with S size
    
    // Create the color palette
    createColorPalette();
    

    
    // Set initial palette background to match default selected color (black)
    colorPalette.style.backgroundColor = selectedColor;
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Check for Ctrl+Z (Windows) or Cmd+Z (Mac) - Undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault(); // Prevent default browser behavior
            undo();
        }
        
        // Check for Shift+Ctrl+Z (Windows) or Shift+Cmd+Z (Mac) - Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
            e.preventDefault(); // Prevent default browser behavior
            redo();
        }
    });
    
    // Edit button functionality
    editButton.addEventListener('click', () => {
        editMode = !editMode;
        editButton.textContent = editMode ? 'done' : 'edit';
        // editButton.style.background = editMode ? '#ffcccc' : '#f0f0f0';
        
        if (!editMode) {
            // Remove all edit overlays when exiting edit mode
            document.querySelectorAll('.edit-overlay').forEach(overlay => overlay.remove());
        }
    });

    // Click outside color palette to exit edit mode
    document.addEventListener('click', (e) => {
        if (editMode) {
            // Check if click is outside the color palette and not on the edit button
            const colorPalette = document.getElementById('color-palette');
            const isClickInPalette = colorPalette.contains(e.target);
            const isClickOnEditButton = editButton.contains(e.target);
            
            if (!isClickInPalette && !isClickOnEditButton) {
                // Exit edit mode
                editMode = false;
                editButton.textContent = 'edit';
                // Remove all edit overlays
                document.querySelectorAll('.edit-overlay').forEach(overlay => overlay.remove());
            }
        }
    });
    
    // Reset button functionality
    resetButton.addEventListener('click', () => {
        // Clear the palette
        colorPalette.innerHTML = '';
        // Recreate the palette
        createColorPalette();
        // Reset edit mode
        editMode = false;
        editButton.textContent = 'edit';
        // editButton.style.background = '#f0f0f0';
        // Set initial palette background
        colorPalette.style.backgroundColor = selectedColor;
    });

    // Clear canvas functionality
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        renderLayers();
        saveCanvasState();
    });

    // Add layer functionality
    addLayerButton.addEventListener('click', () => {
        if (layers.length >= 5) return;
        layers.push(createLayer(canvasSize));
        setActiveLayer(layers.length - 1);
        renderLayers();
    });

    // Save canvas functionality
    saveButton.addEventListener('click', showSaveInput);

    // Save confirm button
    saveConfirm.addEventListener('click', saveCanvas);

    // Save cancel button
    saveCancel.addEventListener('click', hideSaveInput);

    // Handle Enter key in save input
    saveFilename.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveCanvas();
        } else if (e.key === 'Escape') {
            hideSaveInput();
        }
    });

    // Hide save input when clicking outside
    document.addEventListener('click', (e) => {
        if (!saveInputContainer.contains(e.target) && !saveButton.contains(e.target)) {
            hideSaveInput();
        }
    });
});

// todo:
// add zoom
// add select
// add type
