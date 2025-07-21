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
    const saveConfirm = document.getElementById('save-confirm');
    const saveCancel = document.getElementById('save-cancel');
    const saveError = document.getElementById('save-error');
    const addLayerButton = document.getElementById('add-layer-button');
    const layersList = document.getElementById('layers-list');

    let layers = [];
    let activeLayerIndex = 0;
    let canvas;
    let ctx;

    let drawing = false;
    let canvasSize = 16; // Default size
    let brushSize = 1; // Default brush size in pixels
    let lastPos = null; // Store the last drawing position
    let selectedColor = '#000000'; // Default color
    let editMode = false; // Track edit mode state
    // Remove global canvasHistory and currentHistoryIndex
    // let canvasHistory = [];
    // let currentHistoryIndex = -1;
    let selectedBrushType = 'square'; // Default brush type
    let isFilling = false; // Flag to prevent multiple fill operations
    let prevBrushType = null; // Store previous brush when right-click erasing
    let rightClickErasing = false; // Track right click erase state
    let lineStartPos = null; // Store line start position for line tool
    let ghostCanvas = null; // Temporary canvas for ghost line preview
    let ghostCtx = null; // Context for ghost canvas

    // Centralized brush restoration function
    function restoreBrushFromErase() {
        if (rightClickErasing && prevBrushType) {
            rightClickErasing = false;
            setActiveBrushType(prevBrushType);
            prevBrushType = null;
        }
    }

    // Centralized brush save function for erasing
    function saveBrushForErase() {
        if (!rightClickErasing) {
            rightClickErasing = true;
            prevBrushType = selectedBrushType;
        }
    }

    // Helper to clear all active classes from layer items
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

        // Create drop zone above this item
        const dropZone = document.createElement('div');
        dropZone.className = 'layer-drop-zone';
        dropZone.style.height = '8px';
        dropZone.style.margin = '0';
        dropZone.style.padding = '0';
        dropZone.style.background = 'transparent';

        // Create initial blank canvas state for the layer's history
        const ctx = layerCanvas.getContext('2d', { willReadFrequently: true });
        const blankImageData = ctx.createImageData(canvasSize, canvasSize);
        ctx.clearRect(0, 0, canvasSize, canvasSize); // Explicitly clear the canvas
        ctx.putImageData(blankImageData, 0, 0); // Ensure the canvas is truly blank

        // Define the layer object BEFORE any event listeners
        const layer = {
            canvas: layerCanvas,
            ctx,
            preview,
            previewCtx: preview.getContext('2d'),
            alphaInput,
            toggleButton,
            item,
            dropZone,
            size: canvasSize,
            history: [blankImageData], // Each layer gets its own history
            historyIndex: 0
        };
        // Insert new layer at the top of the stack
        layers.unshift(layer);
        // Immediately select the new layer to update global canvas/ctx/history
        selectLayer(0);

        // --- Event listeners and logic referencing 'layer' below ---
        // Drop zone logic
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

        // Drag-and-drop for the item itself
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
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
            // Move layer in layers array
            const [movedLayer] = layers.splice(fromIndex, 1);
            layers.splice(toIndex, 0, movedLayer);
            // Re-append all layer items and drop zones in new order
            layersList.innerHTML = '';
            layers.forEach(l => {
                layersList.appendChild(l.dropZone);
                layersList.appendChild(l.item);
            });
            // Update z-index for all layers (topmost = highest z-index)
            layers.forEach((l, i) => {
                l.canvas.style.zIndex = (layers.length - i).toString();
            });
            // Update activeLayerIndex if needed
            if (activeLayerIndex === fromIndex) {
                activeLayerIndex = toIndex;
            } else if (fromIndex < activeLayerIndex && toIndex >= activeLayerIndex) {
                activeLayerIndex--;
            } else if (fromIndex > activeLayerIndex && toIndex <= activeLayerIndex) {
                activeLayerIndex++;
            }
        });

        // Click to select layer
        item.addEventListener('click', (e) => {
            if (e.target === item || e.target === preview) {
                selectLayer(layers.indexOf(layer));
            }
        });

        // Toggle visibility
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
        // After pushing to layers, update the preview to match the blank state
        updatePreview(layer);
    }

    function updateAddLayerButtonVisibility() {
        if (layers.length >= 5) {
            addLayerButton.style.display = 'none';
        } else {
            addLayerButton.style.display = 'block';
        }
    }

    function updatePreview(layer) {
        layer.previewCtx.clearRect(0, 0, layer.preview.width, layer.preview.height);
        layer.previewCtx.drawImage(layer.canvas, 0, 0, layer.preview.width, layer.preview.height);
    }

    function selectLayer(index) {
        // Cancel right-click erasing if switching layers during erase
        restoreBrushFromErase();
        clearAllLayerActiveClasses();
        if (activeLayerIndex !== undefined && layers[activeLayerIndex]) {
            layers[activeLayerIndex].canvas.style.pointerEvents = 'none';
        }
        activeLayerIndex = index;
        canvas = layers[index].canvas;
        ctx = layers[index].ctx;
        canvasSize = layers[index].size;
        updateBrushSize('5');
        layers[index].canvas.style.pointerEvents = 'auto';
        layers[index].item.classList.add('active');
        canvasSizeSelect.value = canvasSize.toString();
        // No more global history assignment
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
            
            // Position exactly over the main canvas
            const canvasRect = canvas.getBoundingClientRect();
            ghostCanvas.style.top = canvasRect.top + 'px';
            ghostCanvas.style.left = canvasRect.left + 'px';
            ghostCanvas.style.width = canvasRect.width + 'px';
            ghostCanvas.style.height = canvasRect.height + 'px';
            
            // Set image rendering to pixelated for crisp pixels
            ghostCanvas.style.imageRendering = 'pixelated';
            ghostCanvas.style.imageRendering = '-moz-crisp-edges';
            ghostCanvas.style.imageRendering = 'crisp-edges';
            
            document.body.appendChild(ghostCanvas);
            ghostCtx = ghostCanvas.getContext('2d');
            ghostCtx.imageSmoothingEnabled = false;
        } else {
            // Update position if ghost canvas already exists
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
            console.log('Ghost context not available');
            return;
        }
        
        clearGhostCanvas();
        
        // Draw ghost line using the same algorithm as regular lines
        let x0 = start.x;
        let y0 = start.y;
        let x1 = end.x;
        let y1 = end.y;
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        // Set ghost line style
        ghostCtx.fillStyle = selectedColor;
        ghostCtx.globalAlpha = 0.6; // Make it more visible for testing
        
        while (true) {
            // Draw ghost pixels
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
        if (e.button === 2) {
            saveBrushForErase();
            if (selectedBrushType !== 'eraser') {
                setActiveBrushType('eraser');
            }
        }
        drawing = true;
        const pos = getPos(e);
        lastPos = pos;
        
        // Store line start position for line tool
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
        
        // For line tool, don't draw continuously - just update position and ghost line
        if (selectedBrushType === 'line') {
            lastPos = pos;
            if (lineStartPos) {
                drawGhostLine(lineStartPos, pos);
            }
            return;
        }
        
        if (lastPos) {
            // Draw line between last position and current position
            drawLine(lastPos, pos);
        }
        
        lastPos = pos;
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
            // For line tool, draw individual pixels; for other tools, use their specific drawing
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
        // Always update preview for the active layer after drawing a line
        updatePreview(layers[activeLayerIndex]);
    }

    function drawAtPosition(pos) {
        switch (selectedBrushType) {
            case 'square':
                drawSquareBrush(pos);
                break;
            case 'line':
                drawLineTool(pos);
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
            default:
                drawSquareBrush(pos);
        }
        // Always update preview for the active layer after drawing
        updatePreview(layers[activeLayerIndex]);
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

    function drawLineTool(pos) {
        // Line tool just draws a single pixel at the current position
        // The line drawing is handled by the main draw() function calling drawLine()
        drawSquareBrush(pos);
    }

    function drawSprayBrush(pos) {
        const radius = Math.floor(brushSize / 2);
        const centerX = pos.x;
        const centerY = pos.y;
        
        // Adjust particle count for small canvases
        const particleCount = canvasSize <= 16 ? Math.max(3, Math.min(brushSize, 8)) : Math.max(5, brushSize);
        
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
        // Always update preview for the active layer after fill
        updatePreview(layers[activeLayerIndex]);
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
            saveSanitize.style.display = 'none'; // Hide sanitize message if showing error
            return;
        }
        
        // Sanitize filename
        const sanitizedFilename = sanitizeFilename(userInput);
        
        // Determine output size - scale up to 1024 if canvas is smaller
        const outputSize = canvasSize < 1024 ? 1024 : canvasSize;
        
        // Create a temporary canvas with the output size
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputSize;
        tempCanvas.height = outputSize;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Disable image smoothing for pixel-perfect scaling
        tempCtx.imageSmoothingEnabled = false;
        
        // Merge all layers from bottom to top (oldest to newest)
        // Start with a transparent background
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        console.log('Saving canvas with', layers.length, 'layers');
        
        // Draw each layer in order (top layer first, bottom layer last)
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            console.log('Drawing layer', i, 'with opacity:', layer.alphaInput ? layer.alphaInput.value : 1, 'layer size:', layer.size);
            
            // Apply layer opacity
            const opacity = layer.alphaInput ? parseFloat(layer.alphaInput.value) : 1;
            tempCtx.globalAlpha = opacity;
            
            // Draw the layer and scale it from its original size to the output size
            tempCtx.drawImage(layer.canvas, 0, 0, layer.size, layer.size, 0, 0, outputSize, outputSize);
        }
        
        // Reset global alpha
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

    function loadImageFromFile(file) {
        const img = new Image();
        const objectURL = URL.createObjectURL(file);
        
        img.onload = () => {
            // Get the currently active layer
            const activeLayer = layers[activeLayerIndex];
            if (!activeLayer) {
                console.error('No active layer to load image onto');
                URL.revokeObjectURL(objectURL);
                loadInput.value = '';
                return;
            }
            
            const width = img.width;
            const height = img.height;
            
            // Determine the best size for the layer based on the image
            const sizes = Array.from(canvasSizeSelect.options).map(opt => parseInt(opt.value));
            let bestSize;
            
            if (width === height && sizes.includes(width)) {
                // Perfect match - use the image's exact size
                bestSize = width;
            } else {
                // Find the closest available size that can accommodate the image
                const minSide = Math.min(width, height);
                let closest = sizes[0];
                for (const s of sizes) {
                    if (Math.abs(s - minSide) < Math.abs(closest - minSide)) {
                        closest = s;
                    }
                }
                bestSize = closest;
            }
            
            // Resize the active layer to the best size
            resizeLayer(activeLayer, bestSize);
            
            // Update canvas size selector to reflect the new layer size
            canvasSizeSelect.value = bestSize.toString();
            
            // Clear the layer and draw the image at full size
            activeLayer.ctx.clearRect(0, 0, bestSize, bestSize);
            activeLayer.ctx.drawImage(img, 0, 0, width, height, 0, 0, bestSize, bestSize);
            
            // Update the layer's preview
            updatePreview(activeLayer);
            
            // Save the layer's state
            saveCanvasState();
            
            URL.revokeObjectURL(objectURL);
            loadInput.value = '';
        };
        
        img.onerror = () => {
            // Handle image loading errors
            console.error('Failed to load image:', file.name);
            URL.revokeObjectURL(objectURL);
            loadInput.value = '';
            // Optionally show user feedback here
        };
        
        img.src = objectURL;
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
        // Always update preview for the active layer after erasing
        updatePreview(layers[activeLayerIndex]);
    }

    function createColorPalette() {
        const fixedColors = [
            // Row 1: Grays and whites
            '#000000', '#808080', '#D3D3D3', '#FFFFFF',
            // Row 2: Reds (dark, medium, light, lighter)
            '#8B0000', '#FF0000', '#FF4444', '#FF8888',
            // Row 3: Oranges (dark, medium, light, lighter)
            '#CC6600', '#FF8C00', '#FFAA44', '#FFCC88',
            // Row 4: Yellows (dark, medium, light, lighter)
            '#CCCC00', '#FFD700', '#FFE044', '#FFE888',
            // Row 5: Greens (dark, medium, light, lighter)
            '#006600', '#32CD32', '#44FF44', '#88FF88',
            // Row 6: Blues (dark, medium, light, lighter)
            '#000080', '#0000FF', '#4444FF', '#8888FF',
            // Row 7: Purples (dark, medium, light, lighter)
            '#4B0082', '#800080', '#AA44AA', '#CC88CC',
            // Row 8: Programmable cells
            '#CCCCCC', '#CCCCCC', '#CCCCCC', '#CCCCCC'
        ];

        // Create 36 cells (4x9 grid)
        for (let i = 0; i < 36; i++) {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.index = i;
            
            if (i < 28) {
                // Fixed colors for first 28 cells
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
                // Programmable cells for last 8 cells
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
            // For line tool, draw the final line from start to end
            if (selectedBrushType === 'line' && lineStartPos && lastPos) {
                drawLine(lineStartPos, lastPos);
                clearGhostCanvas();
            }
            
            // Save canvas state when drawing ends
            saveCanvasState();
        }
        drawing = false;
        lastPos = null;
        lineStartPos = null; // Reset line start position
        clearGhostCanvas(); // Clear any remaining ghost line

        // Restore brush type if we were right-click erasing
        restoreBrushFromErase();
    }

    function resizeLayer(layer, size) {
        const oldSize = layer.size;
        const oldData = layer.ctx.getImageData(0, 0, oldSize, oldSize);

        layer.size = size;
        layer.canvas.width = size;
        layer.canvas.height = size;

        // Update ghost canvas size if it exists
        if (ghostCanvas) {
            ghostCanvas.width = size;
            ghostCanvas.height = size;
            
            // Update position to match new canvas size
            const canvasRect = canvas.getBoundingClientRect();
            ghostCanvas.style.top = canvasRect.top + 'px';
            ghostCanvas.style.left = canvasRect.left + 'px';
            ghostCanvas.style.width = canvasRect.width + 'px';
            ghostCanvas.style.height = canvasRect.height + 'px';
            
            // Ensure pixelated rendering is maintained
            ghostCanvas.style.imageRendering = 'pixelated';
            ghostCanvas.style.imageRendering = '-moz-crisp-edges';
            ghostCanvas.style.imageRendering = 'crisp-edges';
        }
      
        const newImageData = layer.ctx.createImageData(size, size);

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

        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.putImageData(newImageData, 0, 0);

        updateBrushSize('5');
        // canvasHistory = []; // This line is no longer needed
        // currentHistoryIndex = -1; // This line is no longer needed
        saveCanvasState();
        updatePreview(layer);
    }

    function saveCanvasState() {
        // Save current canvas state
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const layer = layers[activeLayerIndex];
        // Remove any states after current index (for redo functionality)
        layer.history = layer.history.slice(0, layer.historyIndex + 1);
        // Add new state
        layer.history.push(imageData);
        layer.historyIndex++;
        // Limit history size to prevent memory issues
        if (layer.history.length > 50) {
            layer.history.shift();
            layer.historyIndex--;
        }
        console.log('saveCanvasState: activeLayerIndex', activeLayerIndex, 'canvasHistory.length', layer.history.length, 'currentHistoryIndex', layer.historyIndex);
        updatePreview(layer);
    }

    function isImageDataBlank(imageData) {
        // Returns true if all alpha values are 0 (fully transparent)
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
        console.log('undo: activeLayerIndex', activeLayerIndex, 'canvasHistory.length', layer.history.length, 'currentHistoryIndex', layer.historyIndex);
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
        console.log('redo: activeLayerIndex', activeLayerIndex, 'canvasHistory.length', layer.history.length, 'currentHistoryIndex', layer.historyIndex);
    }

    canvasContainer.addEventListener('mousedown', start);
    canvasContainer.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stop);
    canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    canvasContainer.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvasContainer.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvasContainer.addEventListener('touchend', stop);
    canvasContainer.addEventListener('touchcancel', stop);

    // Handle canvas size changes
    canvasSizeSelect.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value);
        const layer = layers[activeLayerIndex];
        resizeLayer(layer, newSize);
        canvasSize = newSize; // Update global canvas size for new layers
        updateBrushSize('5');
        
        // Create new initial blank state for the resized layer
        const blankImageData = layer.ctx.createImageData(newSize, newSize);
        layer.history = [blankImageData];
        layer.historyIndex = 0;
        // canvasHistory = layer.history; // This line is no longer needed
        // currentHistoryIndex = layer.historyIndex; // This line is no longer needed
        updatePreview(layer);
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
        const xlSize = Math.max(1, Math.floor(canvasSize / 4)); // XL is 1/4 of canvas size, minimum 1
        
        // For very small canvases (8x8), use simpler scaling
        if (canvasSize <= 16) {
            switch(sizeType) {
                case '5': // S
                    brushSize = 1;
                    break;
                case '10': // M
                    brushSize = Math.max(1, Math.floor(canvasSize / 8));
                    break;
                case '15': // L
                    brushSize = Math.max(1, Math.floor(canvasSize / 4));
                    break;
                case '25': // XL
                    brushSize = Math.max(1, Math.floor(canvasSize / 2));
                    break;
                default:
                    brushSize = 1;
            }
        } else {
            // Logarithmic scaling for larger canvases
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

    // Sync canvas size selector with default size
    canvasSizeSelect.value = canvasSize.toString();
    
    // Set initial brush size
    updateBrushSize('5'); // Start with S size
    
    // Create the color palette
    createColorPalette();
    
    // Set initial palette background to match default selected color (black)
    colorPalette.style.backgroundColor = selectedColor;
    
    // Reset global variables to ensure clean state (like in the working delete-and-recreate test)
    activeLayerIndex = undefined;
    canvas = null;
    ctx = null;
    // canvasHistory = []; // This line is no longer needed
    // currentHistoryIndex = -1; // This line is no longer needed
    
    // Initialize first layer AFTER all other initialization is complete
    createLayer();
    // Do not select the first layer here

    // After all event listeners and setup, ensure at least one layer exists and is selected
    if (layers.length === 0) {
        createLayer();
    }
    if (layers.length > 0) {
        restoreBrushFromErase(); // Ensure clean brush state
        clearAllLayerActiveClasses();
        // Simulate a user click on the first layer's UI item
        layers[0].item.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    }

    // Ensure add layer button works and re-appends drop zones/items
    addLayerButton.addEventListener('click', () => {
        if (layers.length < 5) {
            createLayer();
            // After creating a new layer, re-append all drop zones and items in order
            layersList.innerHTML = '';
            layers.forEach(l => {
                layersList.appendChild(l.dropZone);
                layersList.appendChild(l.item);
            });
            // Always select the new top layer (index 0)
            clearAllLayerActiveClasses();
            selectLayer(0);
        }
    });
    

    
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveCanvasState();
        updatePreview(layers[activeLayerIndex]);
    });

    // Save canvas functionality
    saveButton.addEventListener('click', showSaveInput);

    // Save confirm button
    saveConfirm.addEventListener('click', saveCanvas);

    // Save cancel button
    saveCancel.addEventListener('click', hideSaveInput);

    // Load image functionality
    loadButton.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            loadImageFromFile(e.target.files[0]);
        }
    });

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

    // After all event listeners and setup, select the first layer (if any) by simulating a user click
    if (layers.length > 0) {
        restoreBrushFromErase(); // Ensure clean brush state
        clearAllLayerActiveClasses();
        // Simulate a user click on the first layer's UI item
        layers[0].item.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    }
});

// todo:
// add zoom
// fix fill, make sure to only use it once like click, when click and drag calls to much and crashes
// add quick switcher, q

//// 1234
//// qwe
////  sd
////  xc
//// space

// 12345
// qwert
//  sdf
//  xcv
// space

/// move layers still broke
