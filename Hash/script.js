/**
 * HASH TABLE VISUALIZER
 * Connects C++ WASM Logic to D3.js
 * Supports: Linear Probing, Quadratic Probing, Separate Chaining
 */

// --- Configuration ---
const CONFIG = {
    animSpeed: 600,         // Time per step in ms
    bucketWidth: 60,
    bucketHeight: 60,
    bucketSpacing: 10,
    chainRadius: 20,
    chainSpacing: 40,
    colors: {
        default: "#8b5cf6",    // Violet
        empty: "#ffffff",
        occupied: "#f5f3ff",
        collision: "#ef4444",  // Red
        scanning: "#f59e0b",   // Amber
        success: "#10b981",    // Green
        stroke: "#cbd5e1"
    }
};

// Global State
let svg, g;
let isWasmReady = false;
let currentProbeMode = 1; // 1=Linear, 2=Quadratic, 3=Chaining
let currentCapacity = 12; // Must match C++ default

// Store D3 selections for easier animation access
let bucketSelections = [];

// --- Initialization ---

window.onload = function () {
    initD3();
    setupEventListeners();
    setupDraggable();

    // Check if Module loaded fast
    if (typeof Module !== 'undefined' && Module.runtimeInitialized) {
        onWasmReady();
    }
};

function onWasmReady() {
    isWasmReady = true;
    Module.ccall('initHashTable', null, ['number'], [currentCapacity]);
    const status = document.getElementById('systemStatus');
    if (status) status.innerHTML = '<span class="status-dot ready"></span> System: Ready';

    logConsole(">> WASM Core Loaded. Hash Table (Size 12) Ready.");

    // Initialize Hash Table in C++
    Module.ccall('initHashTable', null, ['number'], [TABLE_CAPACITY]);

    // Initial Render
    refreshTable();
}

function initD3() {
    const container = document.getElementById('hash-table-canvas');
    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    // --- NEW: Define Zoom Behavior ---
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3]) // Allow zooming from 0.1x to 3x
        .on("zoom", (event) => {
            // Transform the group 'g' whenever zoom/pan occurs
            g.attr("transform", event.transform);
        });

    // --- Update SVG Creation ---
    svg = d3.select("#hash-table-canvas")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("overflow", "hidden") // Keep elements inside bounds
        .call(zoom)                  // Attach the zoom listener here
        .on("dblclick.zoom", null);  // Disable double-click zoom (optional)

    // Create the group 'g' that will hold all visual elements
    g = svg.append("g");
}

// --- Interaction Logic ---

function setupEventListeners() {
    document.getElementById('insertBtn').onclick = handleInsert;
    document.getElementById('searchBtn').onclick = handleSearch;
    document.getElementById('generateRandomBtn').onclick = handleRandom;
    document.getElementById('clearBtn').onclick = handleClear;
    document.getElementById('resizeBtn').onclick = handleResize;

    document.getElementById('btnClearConsole').onclick = () => {
        document.getElementById('outputConsole').innerHTML = '<div class="log-entry system">>> Console Cleared.</div>';
    };

    // Expose for HTML radio buttons
    window.updateProbeMode = (mode) => {
        currentProbeMode = mode;
        handleClear(); // Reset table on mode switch to avoid inconsistent state
        let modeName = mode === 1 ? "Linear Probing" : (mode === 2 ? "Quadratic Probing" : "Separate Chaining");
        logConsole(`>> Switched to ${modeName}`);
    };
}

async function handleInsert() {
    if (!isWasmReady) return;
    const input = document.getElementById('nodeValue');
    const val = parseInt(input.value);

    if (isNaN(val)) {
        alert("Please enter a valid number");
        return;
    }

    logConsole(`>> Inserting ${val}...`);

    // Disable buttons during animation
    toggleControls(false);

    // Call C++: Get Animation Log
    const logStr = Module.ccall('insertValue', 'string', ['number', 'number'], [val, currentProbeMode]);
    const steps = JSON.parse(logStr);

    // Animate
    await animateSequence(steps);

    // Refresh to ensure final consistency
    refreshTable();
    toggleControls(true);
    input.value = '';
    input.focus();
}

async function handleSearch() {
    if (!isWasmReady) return;
    const input = document.getElementById('nodeValue');
    const val = parseInt(input.value);

    if (isNaN(val)) return;

    logConsole(`>> Searching for ${val}...`);
    toggleControls(false);

    const logStr = Module.ccall('searchValue', 'string', ['number', 'number'], [val, currentProbeMode]);
    const steps = JSON.parse(logStr);

    await animateSequence(steps);

    // Clean up highlights after a short delay, but don't rebuild entire table
    setTimeout(() => {
        d3.selectAll('.bucket-rect').classed('highlight-found', false).classed('highlight-scan', false);
        d3.selectAll('.chain-node').style('stroke', CONFIG.colors.default).style('fill', '#fff');
        toggleControls(true);
    }, 1000);
}

function handleRandom() {
    const val = Math.floor(Math.random() * 900) + 100; // 3 digit numbers look nice
    document.getElementById('nodeValue').value = val;
    handleInsert();
}

function handleClear() {
    if (!isWasmReady) return;
    Module.ccall('resetTable', null, [], []);
    refreshTable();
    logConsole(">> Table Reset.");
}

// --- Visualization & Animation ---

function refreshTable() {
    const jsonStr = Module.ccall('getTableJSON', 'string', [], []);
    const data = JSON.parse(jsonStr);
    renderTable(data);
    updateStats(data);
}

function renderTable(data) {
    // Clear existing
    g.selectAll("*").remove();

    const totalWidth = currentCapacity * (CONFIG.bucketWidth + CONFIG.bucketSpacing);
    const startX = (svg.node().clientWidth - totalWidth) / 2;
    const startY = 100; // Top margin

    // 1. Draw Indices and Buckets
    const buckets = g.selectAll(".bucket-group")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "bucket-group")
        .attr("id", d => `bucket-${d.index}`)
        .attr("transform", (d, i) => `translate(${startX + i * (CONFIG.bucketWidth + CONFIG.bucketSpacing)}, ${startY})`);

    // Index Label
    buckets.append("text")
        .attr("class", "index-label")
        .attr("x", CONFIG.bucketWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text(d => d.index);

    // Bucket Rectangle
    buckets.append("rect")
        .attr("class", d => `bucket-rect ${d.occupied === "true" ? "occupied" : ""}`)
        .attr("width", CONFIG.bucketWidth)
        .attr("height", CONFIG.bucketHeight)
        .attr("rx", 6)
        .attr("ry", 6);

    // Value Text (For Open Addressing or Head of Chain)
    buckets.append("text")
        .attr("class", d => `bucket-text ${d.value === null ? "placeholder" : ""}`)
        .attr("x", CONFIG.bucketWidth / 2)
        .attr("y", CONFIG.bucketHeight / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(d => d.value !== null ? d.value : "");

    // 2. Draw Chains (If Separate Chaining Mode and chain exists)
    if (currentProbeMode === 3) {
        data.forEach((d, i) => {
            if (d.chain && d.chain.length > 0) {
                const parentGroup = d3.select(`#bucket-${d.index}`);

                // Draw connecting line from bucket to first node
                parentGroup.append("line")
                    .attr("class", "chain-link")
                    .attr("x1", CONFIG.bucketWidth / 2)
                    .attr("y1", CONFIG.bucketHeight)
                    .attr("x2", CONFIG.bucketWidth / 2)
                    .attr("y2", CONFIG.bucketHeight + CONFIG.chainSpacing);

                // Draw Chain Nodes
                d.chain.forEach((val, cIdx) => {
                    const yPos = CONFIG.bucketHeight + CONFIG.chainSpacing + (cIdx * CONFIG.chainSpacing);

                    const chainGroup = parentGroup.append("g")
                        .attr("class", "chain-node-group")
                        .attr("id", `chain-${d.index}-${cIdx}`) // ID for animation
                        .attr("transform", `translate(${CONFIG.bucketWidth / 2}, ${yPos})`);

                    // Link to next node (if exists)
                    if (cIdx < d.chain.length - 1) {
                        parentGroup.append("line")
                            .attr("class", "chain-link")
                            .attr("x1", CONFIG.bucketWidth / 2)
                            .attr("y1", yPos + CONFIG.chainRadius) // bottom of current circle
                            .attr("x2", CONFIG.bucketWidth / 2)
                            .attr("y2", yPos + CONFIG.chainSpacing - CONFIG.chainRadius); // top of next
                    }

                    chainGroup.append("circle")
                        .attr("class", "chain-node")
                        .attr("r", CONFIG.chainRadius);

                    chainGroup.append("text")
                        .attr("class", "chain-text")
                        .attr("dy", ".35em")
                        .attr("text-anchor", "middle")
                        .text(val);
                });
            }
        });
    }
}

// --- Animation Engine ---

async function animateSequence(steps) {
    if (!steps || steps.length === 0) return;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Handle "Full" error case
        if (step.index === -1) {
            logConsole(`Error: Table is full. Cannot insert ${step.val}.`);
            alert("Table is Full!");
            continue;
        }

        const bucketSel = d3.select(`#bucket-${step.index} .bucket-rect`);
        const textSel = d3.select(`#bucket-${step.index} .bucket-text`);

        // Log status
        if (step.status === 'collision') logConsole(`Collision at index ${step.index} (Value: ${step.val})`);
        else if (step.status === 'inserted') logConsole(`Inserted ${step.val} at index ${step.index}`);
        else if (step.status === 'traversing') logConsole(`Traversing chain at index ${step.index}...`);

        // --- Visual Effects based on Status ---

        // 1. Collision (Red Shake)
        if (step.status === 'collision') {
            bucketSel.classed("highlight-collision", true);
            await wait(400);
            bucketSel.classed("highlight-collision", false);
        }

        // 2. Traversing Chain (Highlight Nodes)
        else if (step.status === 'traversing') {
            // Find the specific chain node containing this value or just flash the bucket
            // For simplicity, we flash the bucket to show we are visiting this index
            bucketSel.classed("highlight-scan", true);

            // Try to find the specific node in DOM if it exists (for search)
            // Note: This requires complex matching if values aren't unique, keeping simple for now
            await wait(300);
            bucketSel.classed("highlight-scan", false);
        }

        // 3. Inserted / Inserted Chain (Green Success)
        else if (step.status === 'inserted' || step.status === 'inserted_chain') {
            bucketSel.classed("highlight-found", true);

            if (step.status === 'inserted') {
                // Open Addressing: Update text immediately for visual feedback
                textSel.text(step.val).classed("placeholder", false);
            }
            // For chaining, the full refreshTable() at end of sequence will draw the new node

            await wait(CONFIG.animSpeed);
            bucketSel.classed("highlight-found", false);
        }

        // 4. Found (Green)
        else if (step.status === 'found') {
            bucketSel.classed("highlight-found", true);
            logConsole(`Found ${step.val} at index ${step.index}!`);
            await wait(CONFIG.animSpeed);
        }

        // 5. Empty / Not Found (Amber Fade)
        else if (step.status === 'empty') {
            bucketSel.classed("highlight-scan", true);
            logConsole(`Index ${step.index} is empty.`);
            await wait(300);
            bucketSel.classed("highlight-scan", false);
        }

        await wait(200); // Small pause between steps
    }
}

// --- Helpers ---

function updateStats(data) {
    let occupied = 0;
    // Count occupied buckets
    data.forEach(d => {
        if (d.occupied === "true") occupied++;
        // If chaining, count chain items too? 
        // Load Factor usually just (Items / Capacity). 
        // If chaining, size includes chain nodes.
        if (d.chain) occupied += d.chain.length;
    });

    const loadFactor = (occupied / currentCapacity).toFixed(2);
    const capDisplay = document.getElementById('capacityDisplay'); // Ensure this ID exists in HTML
    if (capDisplay) capDisplay.innerText = currentCapacity;
    document.getElementById('loadFactor').innerText = loadFactor;

    // Update color of load factor based on threshold
    const lfEl = document.getElementById('loadFactor');
    if (loadFactor > 0.7) lfEl.style.color = CONFIG.colors.collision;
    else if (loadFactor > 0.5) lfEl.style.color = CONFIG.colors.scanning;
    else lfEl.style.color = CONFIG.colors.success;
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

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toggleControls(enable) {
    const btns = document.querySelectorAll('button, input');
    btns.forEach(b => b.disabled = !enable);
}

function setupDraggable() {
    const el = document.getElementById('floatingConsole');
    const handle = document.getElementById('dragHandle');
    if (!el || !handle) return;

    let isDragging = false;
    let offset = { x: 0, y: 0 };

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        el.classList.add('dragging');
        offset.x = e.clientX - el.getBoundingClientRect().left;
        offset.y = e.clientY - el.getBoundingClientRect().top;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        el.style.left = (e.clientX - offset.x) + 'px';
        el.style.top = (e.clientY - offset.y) + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        el.classList.remove('dragging');
    });
}
function handleResize() {
    if (!isWasmReady) return;

    const input = document.getElementById('tableCapacity');
    let newSize = parseInt(input.value);

    // Basic validation to prevent breaking the UI
    if (isNaN(newSize) || newSize < 1) {
        alert("Please enter a valid capacity (min 5).");
        return;
    }
    if (newSize > 50) {
        if (!confirm("Large sizes might require scrolling. Continue?")) return;
    }

    currentCapacity = newSize;
    logConsole(`>> Resizing table to ${currentCapacity}...`);

    // Re-initialize C++ Backend with new size
    Module.ccall('initHashTable', null, ['number'], [currentCapacity]);

    // Refresh Visualization
    refreshTable();
}