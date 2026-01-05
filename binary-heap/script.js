/**
 * BINARY HEAP VISUALIZER
 * Connects C++ WASM Logic to D3.js and Array Visualization
 */

// --- Configuration ---
const CONFIG = {
    animDuration: 750,      // Speed of structural movements (ms)
    colors: {
        default: "#2563eb",     // Blue
        processing: "#f59e0b",  // Amber
        found: "#10b981",       // Green
        error: "#ef4444",       // Red
        stroke: "#ffffff",
        text: "#ffffff"
    },
    nodeRadius: 20
};

// Global State
let svg, g, treeLayout, rootHierarchy;
let currentTreeData = null;
let isWasmReady = false;

// Store previous positions for smooth transitions
let previousNodePositions = new Map();

// --- Initialization ---

window.onload = function () {
    initD3();
    setupEventListeners();

    // Check if Module loaded fast
    if (typeof Module !== 'undefined' && Module.runtimeInitialized) {
        onReady();
    }

    // Setup draggable panels
    makeDraggable(document.getElementById('floatingConsole'), document.getElementById('dragHandle'));
};

function onReady() {
    isWasmReady = true;
    const status = document.getElementById('systemStatus');
    if (status) status.innerHTML = '<span class="status-dot ready"></span> System: Ready';

    logConsole(">> WASM Core Loaded. Binary Heap Ready.");

    // Initialize empty Heap in C++
    // Note: 'initHeap' is the function name in C++ now
    Module.ccall('initHeap', null, [], []);
    updateVisuals(null);
}

function initD3() {
    const container = document.getElementById('tree-canvas');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg = d3.select("#tree-canvas")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom)
        .on("dblclick.zoom", null);

    // Group for the tree
    g = svg.append("g")
        .attr("transform", `translate(${width / 2}, 50)`);

    // Tree Layout function
    treeLayout = d3.tree().nodeSize([60, 80]); // x-spacing, y-spacing
}

// --- Interaction Logic ---

function setupEventListeners() {
    document.getElementById('insertBtn').onclick = handleInsert;
    document.getElementById('extractBtn').onclick = handleExtract; // Renamed from delete
    document.getElementById('generateRandomBtn').onclick = handleRandom;
    document.getElementById('clearBtn').onclick = handleClear;

    document.getElementById('btnClearConsole').onclick = () => {
        document.getElementById('outputConsole').innerHTML = '<div class="log-entry system">>> Console Cleared.</div>';
    };

    // Expose toggle function to global scope for HTML onclick
    window.toggleHeapMode = handleToggleMode;
}

// 1. Toggle Min/Max
function handleToggleMode(mode) {
    if (!isWasmReady) return;
    const type = mode === 1 ? "Min Heap" : "Max Heap";
    logConsole(`>> Switching to ${type}...`);

    // Call C++ to rebuild heap
    Module.ccall('toggleMode', null, ['number'], [mode]);

    // Refresh view
    const jsonStr = Module.ccall('getHeapJSON', 'string', [], []);
    processTreeUpdate(jsonStr);
}

// 2. Insert
function handleInsert() {
    if (!isWasmReady) return;
    const val = parseInt(document.getElementById('nodeValue').value);

    if (isNaN(val)) {
        alert("Please enter a valid number");
        return;
    }

    logConsole(`>> Inserting ${val}...`);
    // Insert and get updated Tree JSON immediately
    const jsonStr = Module.ccall('insertNode', 'string', ['number'], [val]);
    processTreeUpdate(jsonStr);
}

// 3. Extract Root
function handleExtract() {
    if (!isWasmReady) return;
    logConsole(`>> Extracting Root...`);

    // DeleteNode in C++ now acts as ExtractMin/Max
    const jsonStr = Module.ccall('deleteNode', 'string', ['number'], [0]); // 0 is dummy arg
    processTreeUpdate(jsonStr);
}

// 4. Random
function handleRandom() {
    const val = Math.floor(Math.random() * 100);
    document.getElementById('nodeValue').value = val;
    handleInsert();
}

// 5. Clear
function handleClear() {
    Module.ccall('initHeap', null, [], []);
    previousNodePositions.clear();
    processTreeUpdate("null");
    logConsole(">> Heap Cleared.");
}

// --- Visual Updates (Tree + Array) ---

function processTreeUpdate(treeJsonStr) {
    // 1. Update Tree
    if (treeJsonStr === "null") {
        currentTreeData = null;
        updateD3(null);
    } else {
        try {
            currentTreeData = JSON.parse(treeJsonStr);
            updateD3(currentTreeData);
        } catch (e) {
            console.error("JSON Parse Error:", e);
        }
    }

    // 2. Update Array (Fetch separately)
    const arrayJsonStr = Module.ccall('getArrayData', 'string', [], []);
    try {
        const arrayData = JSON.parse(arrayJsonStr);
        renderArray(arrayData);
        updateStats(arrayData.length);
    } catch (e) {
        console.error("Array Parse Error", e);
    }
}

// --- NEW: Array Visualization ---

function renderArray(data) {
    const container = document.getElementById('array-visualizer');
    container.innerHTML = ''; // Clear current

    if (!data || data.length === 0) {
        container.innerHTML = '<span style="color:#9ca3af; font-size:0.8rem; padding-top:8px;">Empty</span>';
        return;
    }

    data.forEach((val, index) => {
        // Wrapper
        const item = document.createElement('div');
        item.className = 'array-item';

        // Value Box
        const box = document.createElement('div');
        box.className = 'array-box';
        box.innerText = val;

        // Index Label (1-based for Heap usually, or 0-based implementation details)
        const idx = document.createElement('div');
        idx.className = 'array-index';
        idx.innerText = index + 1; // Displaying as 1-based index to match C++ logic

        item.appendChild(box);
        item.appendChild(idx);
        container.appendChild(item);
    });
}

// --- Core D3.js Rendering ---

function updateD3(treeData) {
    // 1. Handle Empty Tree
    if (!treeData) {
        g.selectAll("*").transition().duration(CONFIG.animDuration).style("opacity", 0).remove();
        previousNodePositions.clear();
        return;
    }

    // 2. Data Processing (Null Filter Fix)
    rootHierarchy = d3.hierarchy(treeData, d => {
        return d.children ? d.children.filter(c => c !== null) : null;
    });

    // Compute the new X/Y coordinates
    treeLayout(rootHierarchy);

    // --- NODE RENDERING ---

    // Bind Data by VALUE (Key) - Note: In Heaps, duplicates exist, ideally use IDs. 
    // For this demo, assuming unique values or simple behavior.
    const nodes = g.selectAll(".node")
        .data(rootHierarchy.descendants(), d => d.data.value); // If duplicates, this might glitch slightly without unique IDs

    // Join
    nodes.join(
        // ENTER
        enter => {
            const nodeGroup = enter.append("g")
                .attr("class", "node")
                .attr("id", d => `node-${d.data.value}`)
                .attr("transform", d => {
                    const p = d.parent && previousNodePositions.has(d.parent.data.value)
                        ? previousNodePositions.get(d.parent.data.value)
                        : { x: d.x, y: d.y };
                    return `translate(${p.x},${p.y})`;
                })
                .style("opacity", 0);

            nodeGroup.append("circle")
                .attr("r", CONFIG.nodeRadius)
                .style("fill", "#fff")
                .style("stroke", CONFIG.colors.default)
                .style("stroke-width", "2.5px");

            nodeGroup.append("text")
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(d => d.data.value);

            // Removed Height text for Heap (less relevant than index)
            // Added Index text instead
            nodeGroup.append("text")
                .attr("dy", "2.2em")
                .attr("text-anchor", "middle")
                .style("font-size", "10px")
                .style("fill", "#6b7280")
                .text(d => `i:${d.data.index}`);

            return nodeGroup.transition().duration(CONFIG.animDuration)
                .style("opacity", 1)
                .attr("transform", d => `translate(${d.x},${d.y})`);
        },

        // UPDATE
        update => {
            const nodeGroup = update.transition().duration(CONFIG.animDuration)
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .style("opacity", 1);

            // Update index label if node moved in array
            update.select("text:last-child").text(d => `i:${d.data.index}`);

            update.select("circle")
                .style("fill", "#fff")
                .style("stroke", CONFIG.colors.default);

            return nodeGroup;
        },

        // EXIT
        exit => exit.transition().duration(CONFIG.animDuration)
            .style("opacity", 0)
            .attr("transform", d => `translate(${d.x},${d.y + 20})`) // Drop down effect
            .remove()
    );

    // --- LINK RENDERING ---

    const links = g.selectAll(".link")
        .data(rootHierarchy.links(), d => `${d.source.data.value}-${d.target.data.value}`);

    links.join(
        enter => enter.insert("path", ".node")
            .attr("class", "link")
            .attr("d", d => {
                const start = previousNodePositions.has(d.source.data.value)
                    ? previousNodePositions.get(d.source.data.value)
                    : { x: d.source.x, y: d.source.y };
                return diagonal(start, start);
            })
            .transition().duration(CONFIG.animDuration)
            .attr("d", d => diagonal(d.source, d.target)),

        update => update.transition().duration(CONFIG.animDuration)
            .attr("d", d => diagonal(d.source, d.target)),

        exit => exit.transition().duration(CONFIG.animDuration)
            .style("opacity", 0)
            .remove()
    );

    // Stash positions
    previousNodePositions.clear();
    rootHierarchy.descendants().forEach(d => {
        previousNodePositions.set(d.data.value, { x: d.x, y: d.y });
    });
}

// Curved path generator
function diagonal(s, d) {
    return `M ${s.x} ${s.y}
            C ${(s.x + d.x) / 2} ${s.y},
              ${(s.x + d.x) / 2} ${d.y},
              ${d.x} ${d.y}`;
}

// --- Helpers ---

function updateStats(count) {
    document.getElementById('nodeCount').innerText = count || 0;
}

function updateVisuals(data) {
    // Wrapper if needed
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

function makeDraggable(element, handle) {
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;

    if (!element || !handle) return;

    handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        element.classList.add('dragging');
        const rect = element.getBoundingClientRect();
        const parentRect = element.offsetParent ? element.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();

        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        element.style.bottom = 'auto';
        element.style.right = 'auto';
        element.style.width = `${rect.width}px`;

        element.style.left = `${rect.left - parentRect.left}px`;
        element.style.top = `${rect.top - parentRect.top}px`;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const parentRect = element.offsetParent ? element.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();

        let newX = (e.clientX - dragOffsetX) - parentRect.left;
        let newY = (e.clientY - dragOffsetY) - parentRect.top;

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