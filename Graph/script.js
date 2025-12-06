/**
 * GRAPH ALGORITHMS VISUALIZER
 * Connects C++ WASM Logic to HTML5 Canvas
 */

// --- Configuration & State ---
const CONFIG = {
    radius: 20,           // Node radius
    animDelay: 800,       // Delay in ms between steps
    colors: {
        default: "#2563eb",    // Blue
        processing: "#f59e0b", // Amber (Reading)
        visited: "#10b981",    // Green (Done)
        highlight: "#ef4444",  // Red (Active Edge)
        text: "#ffffff",
        edge: "#cbd5e1",
        edgeHighlight: "#ef4444"
    }
};

// Global State
let canvas, ctx;
let nodes = [];       // Visual data {id, x, y, edges: []}
let isWeighted = true;
let isGraphReady = false;

// --- REMOVED "var Module" FROM HERE ---
// It is already defined in index.html. We just use the global one.

// --- Initialization ---
window.onload = function() {
    canvas = document.getElementById('graphCanvas');
    ctx = canvas.getContext('2d');

    if(document.getElementById('btnInitGraph')) document.getElementById('btnInitGraph').onclick = initGraph;
    if(document.getElementById('btnAddEdge')) document.getElementById('btnAddEdge').onclick = addEdge;
    if(document.getElementById('btnShowAdjList')) document.getElementById('btnShowAdjList').onclick = renderAdjList;
    if(document.getElementById('btnShowAdjMatrix')) document.getElementById('btnShowAdjMatrix').onclick = renderAdjMatrix;
    // UI Event Listeners
    if(document.getElementById('btnInitGraph')) document.getElementById('btnInitGraph').onclick = initGraph;
    if(document.getElementById('btnAddEdge')) document.getElementById('btnAddEdge').onclick = addEdge;
    // NEW: Listeners for Output Panel
    if(document.getElementById('btnShowAdjList')) document.getElementById('btnShowAdjList').onclick = renderAdjList;
    if(document.getElementById('btnShowAdjMatrix')) document.getElementById('btnShowAdjMatrix').onclick = renderAdjMatrix;
    if(document.getElementById('btnClearOutput')) document.getElementById('btnClearOutput').onclick = () => {
        document.getElementById('outputBody').innerHTML = '<div class="log-entry system">Cleared.</div>';
    };

// Update Draggable Logic to handle both panels
makeDraggable(document.getElementById('floatingConsole'), document.getElementById('dragHandle'));
makeDraggable(document.getElementById('outputPanel'), document.getElementById('outputDragHandle'));
    

setupCanvasInteractions();

    // Weight Toggle Logic
    const toggle = document.getElementById('toggleWeight');
    const weightInput = document.getElementById('weightInputGroup');
    
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            isWeighted = e.target.checked;
            if (isWeighted) {
                weightInput.classList.remove('hidden');
            } else {
                weightInput.classList.add('hidden');
            }
            logConsole(`>> Graph mode set to: ${isWeighted ? "Weighted" : "Unweighted"}`);
        });
    }

    // Algorithm Buttons (Delegation)
    document.querySelectorAll('.algo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const algoType = e.target.dataset.algo;
            runAlgorithm(algoType);
        });
    });

    // Initial Message
    drawPlaceholder();
    
    // Check if Module is already ready (in case it loaded fast)
    if (typeof Module !== 'undefined' && Module.runtimeInitialized) {
        onReady();
    }
};

// Helper called when system is ready (triggered by HTML script)
function onReady() {
    const status = document.getElementById('systemStatus');
    if (status) {
        status.innerHTML = '<span class="status-dot ready"></span> System: Ready';
    }
    logConsole(">> WebAssembly Core Loaded. Ready to Initialize.");
}

// --- Core Logic ---

function initGraph() {
    const vCount = parseInt(document.getElementById('vertexCount').value);
    
    // 1. Call C++ Backend
    try {
        if (typeof Module === 'undefined' || typeof Module.ccall === 'undefined') {
            throw new Error("WASM not loaded");
        }
        
        Module.ccall('initGraph', null, ['number'], [vCount]);
        
        // 2. Setup Visual Nodes (Circular Layout)
        nodes = [];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const layoutRadius = 200;

        for (let i = 0; i < vCount; i++) {
            const angle = (i * 2 * Math.PI) / vCount - (Math.PI / 2);
            nodes.push({
                id: i,
                x: centerX + layoutRadius * Math.cos(angle),
                y: centerY + layoutRadius * Math.sin(angle),
                state: 'default', // default, processing, visited
                edges: []
            });
        }

        isGraphReady = true;
        drawGraph();
        clearConsole();
        logConsole(`>> Graph initialized with ${vCount} nodes.`);
        updateComplexity("Ready", "---");

    } catch (e) {
        console.error(e);
        alert("System not ready. Wait for 'System: Ready' indicator.");
    }
}

function addEdge() {
    if (!isGraphReady) { alert("Please Initialize Graph first."); return; }

    const u = parseInt(document.getElementById('edgeSource').value);
    const v = parseInt(document.getElementById('edgeDest').value);
    // If unweighted, force weight to 1
    const w = isWeighted ? (parseInt(document.getElementById('edgeWeight').value) || 1) : 1;

    // Validate inputs
    if (isNaN(u) || isNaN(v) || u < 0 || v < 0 || u >= nodes.length || v >= nodes.length) {
        logConsole(">> Error: Invalid Node IDs.");
        return;
    }

    // 1. Call C++
    Module.ccall('addEdge', null, ['number', 'number', 'number'], [u, v, w]);

    // 2. Update Visuals
    // Check if edge exists to avoid visual duplicates
    const existing = nodes[u].edges.find(e => e.to === v);
    if (!existing) {
        nodes[u].edges.push({ to: v, weight: w });
        nodes[v].edges.push({ to: u, weight: w }); // Visual Undirected
    }

    drawGraph();
    logConsole(`>> Edge Added: ${u} --[${w}]--> ${v}`);
}

function runAlgorithm(type) {
    if (!isGraphReady) return;

    // --- Validation Checks ---
    if ((type === 'prim' || type === 'dijkstra') && !isWeighted) {
        alert("Error: This algorithm requires a Weighted Graph.");
        return;
    }

    const startNode = parseInt(document.getElementById('startNode').value) || 0;
    if (startNode < 0 || startNode >= nodes.length) {
        alert("Invalid Start Node");
        return;
    }

    if (!isGraphConnected(startNode)) {
        alert("Error: The graph is disconnected!");
        return;
    }

    // --- Reset ---
    nodes.forEach(n => n.state = 'default');
    drawGraph();
    clearConsole();

    // --- Execution ---
    try {
        const vCount = nodes.length;
        // 1. Get Pointer to C++ Result Array
        const bufferPtr = Module.ccall('getResultBuffer', 'number', [], []);

        if (type === 'bfs') {
            // A. Run C++ Logic
            Module.ccall('runBFS', null, ['number'], [startNode]);
            updateComplexity("BFS", "O(V + E)");
            logConsole(`>> Starting BFS from Node ${startNode}...`);

            // B. Get Result & Show in Output Panel (FIXED)
            const visitOrder = readBuffer(bufferPtr, vCount);
            updateOutputPanel(`<div class="log-entry system">>> BFS Result (Order):</div><div class="log-entry">${visitOrder.join(' <span class="adj-arrow">-></span> ')}</div>`);

            // C. Animation
            showDSPanel("QUEUE");
            const snapshots = getBFSSnapshots(startNode);
            animateSnapshots(snapshots, 'bfs');
        } 
        else if (type === 'dfs') {
            // A. Run C++ Logic
            Module.ccall('runDFS', null, ['number'], [startNode]);
            updateComplexity("DFS", "O(V + E)");
            logConsole(`>> Starting DFS from Node ${startNode}...`);

            // B. Get Result & Show in Output Panel (FIXED)
            const visitOrder = readBuffer(bufferPtr, vCount);
            updateOutputPanel(`<div class="log-entry system">>> DFS Result (Order):</div><div class="log-entry">${visitOrder.join(' <span class="adj-arrow">-></span> ')}</div>`);

            // C. Animation
            showDSPanel("STACK");
            const snapshots = getDFSSnapshots(startNode);
            animateSnapshots(snapshots, 'dfs');
        }
        else if (type === 'prim') {
            hideDSPanel();
            Module.ccall('runPrims', null, ['number'], [startNode]);
            updateComplexity("Prim's MST", "O(E log V)");
            logConsole(`>> Starting Prim's MST...`);

            const parentArray = readBuffer(bufferPtr, vCount);
            animateMST(parentArray);
        }
        else if (type === 'dijkstra') {
            hideDSPanel();
            Module.ccall('runDijkstra', null, ['number'], [startNode]);
            updateComplexity("Dijkstra", "O(E + V log V)");
            
            const distArray = readBuffer(bufferPtr, vCount);
            logConsole(">> Shortest Paths Calculated.");
            displayDijkstraTable(distArray);
        }

    } catch (e) {
        console.error(e);
        logConsole(">> Algorithm Execution Failed.");
    }
}

function animateSnapshots(snapshots, algoType) {
    let step = 0;
    
    function nextFrame() {
        if (step >= snapshots.length) {
            logConsole(">> Algorithm Complete.");
            setTimeout(hideDSPanel, 2000); 
            return;
        }

        const state = snapshots[step];
        
        // --- VISUAL STATE LOGIC ---
        if (state.node !== null && state.node !== undefined) {
            
            // 1. Check for "Finished" status (Applies to both BFS and DFS now)
            if (state.text.includes("Finished")) {
                nodes[state.node].state = 'visited'; // Green
            } 
            // 2. Check for "Popped" or generic processing
            else if (state.text.includes("Popped") || state.text.includes("Visiting")) {
                nodes[state.node].state = 'processing'; // Yellow
            }
            // 3. For any other step (like "Pushed" or "Queued"), keep the node Yellow
            else {
                // Ensure the current node stays yellow while we are working on its neighbors
                if (nodes[state.node].state !== 'visited') {
                    nodes[state.node].state = 'processing';
                }
            }
        }

        // Update Bottom Panel (Stack/Queue)
        updateDSView(state.struct, state.node);

        // Draw Canvas
        drawGraph();

        step++;
        setTimeout(nextFrame, CONFIG.animDelay); 
    }

    nextFrame();
}

// --- Animation Logic ---

function animateTraversal(visitOrder) {
    let step = 0;

    function nextFrame() {
        if (step >= visitOrder.length) {
            logConsole(">> Traversal Complete.");
            return;
        }

        const nodeId = visitOrder[step];
        // Skip garbage values if buffer wasn't fully filled
        if (nodeId < 0 || nodeId >= nodes.length) {
             step++;
             nextFrame();
             return;
        }

        const node = nodes[nodeId];

        // 1. Mark previous as visited (Green)
        if (step > 0) {
            const prevId = visitOrder[step - 1];
            if (prevId >= 0 && prevId < nodes.length) {
                nodes[prevId].state = 'visited';
            }
        }

        // 2. Mark current as processing (Amber)
        if (node) {
            node.state = 'processing';
            logConsole(`>> Visiting Node ${nodeId}`);
        }

        // 3. Draw
        drawGraph();

        // 4. Loop
        step++;
        setTimeout(nextFrame, CONFIG.animDelay);
    }

    nextFrame();
}

function animateMST(parentArray) {
    let edgesToAnimate = [];
    
    parentArray.forEach((parent, child) => {
        // Filter valid parents
        if (parent !== -1 && parent !== 2147483647 && parent >= 0 && parent < nodes.length) {
            edgesToAnimate.push({ u: parent, v: child });
        }
    });

    let step = 0;
    let activeMSTEdges = []; 

    function nextFrame() {
        if (step >= edgesToAnimate.length) {
            logConsole(">> MST Construction Complete.");
            return;
        }

        const edge = edgesToAnimate[step];
        activeMSTEdges.push(edge);

        // Highlight nodes involved
        nodes[edge.u].state = 'visited';
        nodes[edge.v].state = 'visited';

        logConsole(`>> MST Edge Added: ${edge.u} - ${edge.v}`);

        drawGraph(activeMSTEdges);

        step++;
        setTimeout(nextFrame, CONFIG.animDelay);
    }
    
    nextFrame();
}

function displayDijkstraTable(distArray) {
    let html = '<div class="log-entry system">>> Shortest Paths from Source:</div>';
    html += '<table class="matrix-table"><thead><tr><th>Node</th><th>Distance</th></tr></thead><tbody>';

    distArray.forEach((d, i) => {
        const val = (d > 1000000) ? "∞" : d;
        html += `<tr><td>${i}</td><td>${val}</td></tr>`;
        
        // Keep the visual node coloring logic
        if(val !== "∞") nodes[i].state = 'visited';
    });
    
    html += '</tbody></table>';
    updateOutputPanel(html); // Send to new panel
    drawGraph();
}


// --- Rendering ---

function drawGraph(highlightEdges = []) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Edges
    nodes.forEach(node => {
        node.edges.forEach(edge => {
            const target = nodes[edge.to];
            
            let strokeColor = CONFIG.colors.edge;
            let lineWidth = 2;

            const isHighlighted = highlightEdges.some(h => 
                (h.u === node.id && h.v === edge.to) || 
                (h.u === edge.to && h.v === node.id)
            );

            if (isHighlighted) {
                strokeColor = CONFIG.colors.edgeHighlight;
                lineWidth = 4;
            }

            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            // Draw Weight
            if (isWeighted) {
                const midX = (node.x + target.x) / 2;
                const midY = (node.y + target.y) / 2;
                
                ctx.fillStyle = "white";
                ctx.beginPath();
                ctx.arc(midX, midY, 10, 0, 2*Math.PI);
                ctx.fill();

                ctx.fillStyle = "#666";
                ctx.font = "12px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(edge.weight, midX, midY);
            }
        });
    });

    // 2. Draw Nodes
    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, CONFIG.radius, 0, 2 * Math.PI);
        
        if (node.state === 'processing') {
            ctx.fillStyle = CONFIG.colors.processing;
        } else if (node.state === 'visited') {
            ctx.fillStyle = CONFIG.colors.visited;
        } else {
            ctx.fillStyle = CONFIG.colors.default;
        }
        
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = CONFIG.colors.text;
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.id, node.x, node.y);
    });
}

function drawPlaceholder() {
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText("Initialize Graph to Begin", canvas.width/2, canvas.height/2);
}

// --- Helpers ---

function readBuffer(ptr, length) {
    const data = [];
    const offset = ptr / 4; 
    for (let i = 0; i < length; i++) {
        data.push(Module.HEAP32[offset + i]);
    }
    return data;
}

function updateComplexity(algo, text) {
    document.querySelector('.algo-name').textContent = algo;
    document.querySelector('.big-o').textContent = text;
}

function logConsole(msg) {
    const consoleBody = document.getElementById('outputConsole');
    if (consoleBody) {
        const line = document.createElement('div');
        line.className = 'log-entry';
        line.innerText = msg;
        consoleBody.appendChild(line);
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }
}

// Helper: Simple BFS in JS to check if all nodes are reachable
function isGraphConnected(startNode) {
    if (nodes.length === 0) return false;
    
    let visitedCount = 0;
    let visited = new Array(nodes.length).fill(false);
    let queue = [startNode];
    
    visited[startNode] = true;
    visitedCount++;
    
    while (queue.length > 0) {
        let u = queue.shift();
        
        // Look at visual edges
        nodes[u].edges.forEach(edge => {
            if (!visited[edge.to]) {
                visited[edge.to] = true;
                visitedCount++;
                queue.push(edge.to);
            }
        });
    }
    
    // If we visited equal nodes to total nodes, it is connected
    return visitedCount === nodes.length;
}

function clearConsole() {
    const consoleBody = document.getElementById('outputConsole');
    if (consoleBody) consoleBody.innerHTML = '<div class="log-entry system">> Console Cleared.</div>';
}

// --- NEW: Reusable Draggable Logic ---
function makeDraggable(element, handle) {
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    if (!element || !handle) return;

    handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        element.classList.add('dragging');

        const rect = element.getBoundingClientRect();
        // If offsetParent is null (hidden), fallback to body
        const parentRect = element.offsetParent ? element.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();

        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        // Convert to absolute positioning relative to container
        element.style.bottom = 'auto';
        element.style.right = 'auto';
        element.style.width = `${rect.width}px`;
        
        // Calculate initial left/top relative to parent
        element.style.left = `${rect.left - parentRect.left}px`;
        element.style.top = `${rect.top - parentRect.top}px`;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const parentRect = element.offsetParent ? element.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();

        let newX = (e.clientX - dragOffsetX) - parentRect.left;
        let newY = (e.clientY - dragOffsetY) - parentRect.top;

        // Boundaries
        const maxX = parentRect.width - element.offsetWidth;
        const maxY = parentRect.height - element.offsetHeight;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        element.classList.remove('dragging');
    });
}

// --- Data Structure Simulation (Generates Snapshots for UI) ---
function getBFSSnapshots(startNode) {
    let snapshots = [];
    let queue = [startNode];
    let visited = new Array(nodes.length).fill(false);
    visited[startNode] = true;

    // Snapshot 0: Initial State
    snapshots.push({ node: null, struct: [...queue], text: "Start" });

    while (queue.length > 0) {
        // Peek/Dequeue
        let u = queue.shift();
        
        // Snapshot: Processing Node u
        snapshots.push({ node: u, struct: [u, ...queue], text: `Visiting ${u}` });

        nodes[u].edges.forEach(edge => {
            if (!visited[edge.to]) {
                visited[edge.to] = true;
                queue.push(edge.to);
                // Snapshot: Enqueue Neighbor
                snapshots.push({ node: u, struct: [u, ...queue], text: `Queued ${edge.to}` });
            }
        });

        // Snapshot: Finished processing u, removed from queue
        snapshots.push({ node: u, struct: [...queue], text: `Finished ${u}` });
    }
    return snapshots;
}

function getDFSSnapshots(startNode) {
    let snapshots = [];
    let stack = [startNode];
    let visited = new Array(nodes.length).fill(false);

    // Initial Snapshot
    snapshots.push({ node: null, struct: [...stack], text: "Start" });

    while (stack.length > 0) {
        let u = stack.pop();

        if (!visited[u]) {
            visited[u] = true;
            
            // 1. POP = Processing (Yellow)
            snapshots.push({ node: u, struct: [...stack, u], text: `Popped ${u}` });

            // Sort and Reverse neighbors (to ensure numerical order 1->2->3)
            let neighbors = nodes[u].edges
                .filter(e => !visited[e.to])
                .map(e => e.to);
            
            neighbors.sort((a, b) => a - b);
            neighbors.reverse();

            neighbors.forEach(v => {
                stack.push(v);
                // Push Neighbor action
                snapshots.push({ node: u, struct: [...stack], text: `Pushed ${v}` });
            });

            // 2. NEW STEP: Finished = Visited (Green)
            // We add this snapshot to tell the renderer we are done with Node U
            snapshots.push({ node: u, struct: [...stack], text: `Finished ${u}` });
        }
    }
    return snapshots;
}

/* --- NEW: Output Panel Logic --- */

function updateOutputPanel(htmlContent) {
    const panel = document.getElementById('outputBody');
    if (!panel) return;
    // Clear automatically before showing new result
    panel.innerHTML = htmlContent;
}

function renderAdjList() {
    if (!isGraphReady) { alert("Initialize graph first."); return; }
    
    let html = '<div class="log-entry system">>> Adjacency List:</div>';
    
    nodes.forEach(node => {
        let line = `<div class="adj-list-item"><strong>Node ${node.id}</strong>`;
        
        if (node.edges.length === 0) {
            line += ` <span style="opacity:0.5">-> null</span>`;
        } else {
            node.edges.forEach(edge => {
                line += `<span class="adj-arrow">-></span>${edge.to}`;
                if (isWeighted) line += `<span style="font-size:0.8em; color:#aaa;">(w:${edge.weight})</span>`;
            });
        }
        line += '</div>';
        html += line;
    });

    updateOutputPanel(html);
}

function renderAdjMatrix() {
    if (!isGraphReady) { alert("Initialize graph first."); return; }

    let html = '<div class="log-entry system">>> Adjacency Matrix:</div>';
    html += '<table class="matrix-table"><thead><tr><th></th>';

    // Header Row
    for (let i = 0; i < nodes.length; i++) {
        html += `<th>${i}</th>`;
    }
    html += '</tr></thead><tbody>';

    // Body
    for (let i = 0; i < nodes.length; i++) {
        html += `<tr><th>${i}</th>`; // Row Header
        for (let j = 0; j < nodes.length; j++) {
            // Check connection in our JS state
            const edge = nodes[i].edges.find(e => e.to === j);
            if (edge) {
                html += `<td class="active-cell">${edge.weight}</td>`;
            } else {
                html += `<td>0</td>`;
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table>';

    updateOutputPanel(html);
}

// --- NEW: Data Structure Visualizer Logic ---

function showDSPanel(type) {
    const panel = document.getElementById('ds-visualizer');
    const label = document.getElementById('ds-type-label');
    const hint = document.querySelector('.ds-hint');
    
    label.innerText = type; // "STACK" or "QUEUE"
    hint.innerText = (type === 'STACK') ? "(Top Right)" : "(Front ← → Rear)";
    
    panel.classList.add('active');
}

function hideDSPanel() {
    const panel = document.getElementById('ds-visualizer');
    panel.classList.remove('active');
}

function updateDSView(dataArray, activeNode) {
    const container = document.getElementById('ds-content-area');
    container.innerHTML = ''; // Clear current

    dataArray.forEach(val => {
        const block = document.createElement('div');
        block.className = 'ds-block';
        block.innerText = val;
        
        // Highlight the node currently being processed
        if (val === activeNode) {
            block.classList.add('highlight');
        }
        
        container.appendChild(block);
    });
}

// --- NEW: Interactive Node Dragging ---

function setupCanvasInteractions() {
    let isDragging = false;
    let draggedNodeId = null;

    // 1. Mouse Down: Hit detection
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Check if mouse is inside any node
        // Loop backwards to catch "top" nodes first if they overlap
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const dist = Math.sqrt((mouseX - node.x) ** 2 + (mouseY - node.y) ** 2);

            if (dist <= CONFIG.radius) {
                isDragging = true;
                draggedNodeId = i;
                canvas.style.cursor = 'grabbing';
                return; // Stop checking
            }
        }
    });

    // 2. Mouse Move: Update position
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (isDragging && draggedNodeId !== null) {
            // Update node coordinates
            nodes[draggedNodeId].x = mouseX;
            nodes[draggedNodeId].y = mouseY;
            
            // Re-render immediately
            drawGraph();
        } else {
            // Hover effect: Change cursor to 'grab' if over a node
            let isHovering = false;
            for (let i = 0; i < nodes.length; i++) {
                const dist = Math.sqrt((mouseX - nodes[i].x) ** 2 + (mouseY - nodes[i].y) ** 2);
                if (dist <= CONFIG.radius) {
                    isHovering = true;
                    break;
                }
            }
            canvas.style.cursor = isHovering ? 'grab' : 'default';
        }
    });

    // 3. Mouse Up: Stop dragging
    // We attach to 'window' so dragging stops even if you release outside canvas
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            draggedNodeId = null;
            canvas.style.cursor = 'default';
        }
    });
}