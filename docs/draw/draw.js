window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('color-picker');
    const canvasSizeSelect = document.getElementById('canvas-size');
    const brushSizeInput = document.getElementById('brush-size');
    const clearButton = document.getElementById('clear-button');

    let drawing = false;
    let canvasSize = 16; // Default size
    let brushSizePercent = 10; // Default brush size as percentage (10%)
    let lastPos = null; // Store the last drawing position

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
        drawing = true;
        const pos = getPos(e);
        lastPos = pos;
        drawAtPosition(pos);
        draw(e);
    }

    function draw(e) {
        if (!drawing) return;
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
        // Calculate brush size as percentage of canvas, with minimum of 1 pixel
        const brushSize = Math.max(1, Math.floor(canvasSize * brushSizePercent / 100));
        
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
            ctx.fillStyle = colorPicker.value;
            ctx.fillRect(actualStartX, actualStartY, actualWidth, actualHeight);
        }
    }

    function stop() {
        drawing = false;
        lastPos = null;
    }

    function resizeCanvas(size) {
        canvasSize = size;
        canvas.width = size;
        canvas.height = size;
        // Clear the canvas after resizing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stop);

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', stop);
    canvas.addEventListener('touchcancel', stop);

    // Handle canvas size changes
    canvasSizeSelect.addEventListener('change', (e) => {
        resizeCanvas(parseInt(e.target.value));
    });

    // Handle brush size changes
    brushSizeInput.addEventListener('input', (e) => {
        brushSizePercent = parseInt(e.target.value);
    });

    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Initialize canvas with default size
    resizeCanvas(16);
});
