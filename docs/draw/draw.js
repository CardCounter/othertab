window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const canvasSizeSelect = document.getElementById('canvas-size');
    const colorPalette = document.getElementById('color-palette');
    const editButton = document.getElementById('edit-button');
    const resetButton = document.getElementById('reset-button');

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
    let zoomSelecting = false;
    let zoomStart = null;
    let isZoomed = false;
    let zoomImage = null;
    let zoomRegion = null; // Store the zoom region for coordinate mapping

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let x, y;
        if (e.touches) {
            const t = e.touches[0];
            x = t.clientX - rect.left;
            y = t.clientY - rect.top;
        } else {
            // Handle cases where offsetX/Y might be undefined (e.g., mouseup outside canvas)
            if (e.offsetX !== undefined && e.offsetY !== undefined) {
                x = e.offsetX;
                y = e.offsetY;
            } else {
                // Calculate position from client coordinates
                x = e.clientX - rect.left;
                y = e.clientY - rect.top;
            }
        }
        // Scale coordinates to match the canvas size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let pos = { 
            x: Math.floor(x * scaleX), 
            y: Math.floor(y * scaleY) 
        };
        
        // If zoomed, convert screen coordinates to original canvas coordinates
        if (isZoomed && zoomRegion) {
            pos = convertZoomedToOriginal(pos);
        }
        
        return pos;
    }

    function start(e) {
        const pos = getPos(e);
        if (selectedBrushType === 'zoom') {
            // If already zoomed, restore zoom when clicking zoom tool again
            if (isZoomed) {
                restoreZoom();
                return;
            }
            zoomSelecting = true;
            zoomStart = pos;
            return;
        }
        drawing = true;
        lastPos = pos;
        drawAtPosition(pos);
        draw(e);
    }

    function draw(e) {
        if (selectedBrushType === 'zoom' || !drawing) return;
        const pos = getPos(e);
        
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
            case 'zoom':
                // zoom handled separately
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
            
            // If zoomed, update the zoomed display
            if (isZoomed) {
                updateZoomedDisplay();
            }
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
        
        // If zoomed, update the zoomed display
        if (isZoomed) {
            updateZoomedDisplay();
        }
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
        
        // Reset global alpha
        ctx.globalAlpha = 1.0;
        
        // If zoomed, update the zoomed display
        if (isZoomed) {
            updateZoomedDisplay();
        }
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
        
        // If zoomed, update the zoomed display
        if (isZoomed) {
            updateZoomedDisplay();
        }
        
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
            
            // If zoomed, update the zoomed display
            if (isZoomed) {
                updateZoomedDisplay();
            }
        }
    }

    function performZoom(start, end) {
        // Clamp coordinates to canvas boundaries
        const x1 = Math.max(0, Math.min(canvasSize - 1, Math.min(start.x, end.x)));
        const y1 = Math.max(0, Math.min(canvasSize - 1, Math.min(start.y, end.y)));
        const x2 = Math.max(0, Math.min(canvasSize - 1, Math.max(start.x, end.x)));
        const y2 = Math.max(0, Math.min(canvasSize - 1, Math.max(start.y, end.y)));
        
        const w = x2 - x1 + 1;
        const h = y2 - y1 + 1;
        const size = Math.min(w, h);
        
        if (size === 0) return;

        // Store zoom region for coordinate mapping
        zoomRegion = { x1, y1, x2, y2, size };

        // Only save original state if not already zoomed
        if (!isZoomed) {
            zoomImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const offCtx = off.getContext('2d');
        const data = ctx.getImageData(x1, y1, size, size);
        offCtx.putImageData(data, 0, 0);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

        isZoomed = true;
        canvas.classList.add('zoomed');
    }

    function restoreZoom() {
        if (!isZoomed || !zoomImage) return;
        ctx.putImageData(zoomImage, 0, 0);
        isZoomed = false;
        zoomRegion = null;
        canvas.classList.remove('zoomed');
    }

    function convertZoomedToOriginal(screenPos) {
        if (!zoomRegion) return screenPos;
        
        // Convert screen coordinates back to original canvas coordinates
        const scale = zoomRegion.size / canvasSize;
        const originalX = Math.floor(screenPos.x * scale) + zoomRegion.x1;
        const originalY = Math.floor(screenPos.y * scale) + zoomRegion.y1;
        
        return {
            x: Math.max(zoomRegion.x1, Math.min(zoomRegion.x2, originalX)),
            y: Math.max(zoomRegion.y1, Math.min(zoomRegion.y2, originalY))
        };
    }

    function updateZoomedDisplay() {
        if (!isZoomed || !zoomRegion) return;
        
        // Get the current state of the original canvas area
        const currentData = ctx.getImageData(zoomRegion.x1, zoomRegion.y1, zoomRegion.size, zoomRegion.size);
        
        // Create temporary canvas for scaling
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = zoomRegion.size;
        tempCanvas.height = zoomRegion.size;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(currentData, 0, 0);
        
        // Clear and redraw the zoomed view
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
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
        if (zoomSelecting && selectedBrushType === 'zoom') {
            const pos = getPos(e);
            zoomSelecting = false;
            performZoom(zoomStart, pos);
            return;
        }
        if (drawing) {
            // Save canvas state when drawing ends
            saveCanvasState();
        }
        drawing = false;
        lastPos = null;
    }

    function resizeCanvas(size) {
        canvasSize = size;
        canvas.width = size;
        canvas.height = size;
        
        // Clear the canvas after resizing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update brush sizes for new canvas size
        updateBrushSize('5'); // Update to current S size
        
        // Reset history after resize
        canvasHistory = [];
        currentHistoryIndex = -1;
        saveCanvasState();
    }

    function saveCanvasState() {
        // Save current canvas state
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
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

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', (e) => { stop(e); });
    canvas.addEventListener('touchcancel', (e) => { stop(e); });

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

    // Handle brush type selection
    document.querySelectorAll('.brush-type').forEach(button => {
        button.addEventListener('click', () => {
            // If clicking zoom tool while already zoomed, restore zoom
            if (button.dataset.type === 'zoom' && isZoomed) {
                restoreZoom();
            }
            
            // Remove active class from all brush type buttons
            document.querySelectorAll('.brush-type').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            // Update selected brush type
            selectedBrushType = button.dataset.type;
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

        if (e.key === 'Escape') {
            restoreZoom();
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
        if (isZoomed && !canvas.contains(e.target) && !e.target.classList.contains('brush-type')) {
            restoreZoom();
        }
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
});

// todo:
// make right click erase
// add select
// add type
