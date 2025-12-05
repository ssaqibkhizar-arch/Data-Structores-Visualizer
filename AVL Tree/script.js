/**
 * AVL TREE VISUALIZER
 * Connects C++ WASM Logic to D3.js Visualization
 */

// --- Configuration ---
const CONFIG = {
    animDuration: 750,      // Speed of structural movements (ms)
    stepDelay: 800,         // Speed of traversal steps (ms)
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
let currentTreeData = null; // JSON object from C++
let isWasmReady = false;


// Store previous positions for smooth transitions
let previousNodePositions = new Map();

// --- Initialization ---

window.onload = function() {
    initD3();
    setupEventListeners();

    // Check if Module loaded fast
    if (typeof Module !== 'undefined' && Module.runtimeInitialized) {
        onReady();
    }
    
    // Setup draggable panels
    makeDraggable(document.getElementById('floatingConsole'), document.getElementById('dragHandle'));
    makeDraggable(document.getElementById('outputPanel'), document.getElementById('outputDragHandle'));
};

function onReady() {
    isWasmReady = true;
    const status = document.getElementById('systemStatus');
    if (status) status.innerHTML = '<span class="status-dot ready"></span> System: Ready';
    
    logConsole(">> WASM Core Loaded. AVL Tree Ready.");
    
    // Initialize empty tree in C++
    Module.ccall('initTree', null, [], []);
    updateStats();
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
    document.getElementById('deleteBtn').onclick = handleDelete;
    document.getElementById('searchBtn').onclick = handleSearch;
    document.getElementById('generateRandomBtn').onclick = handleRandom;
    document.getElementById('clearBtn').onclick = handleClear;

    document.getElementById('inOrderBtn').onclick = () => handleTraversal(1);
    document.getElementById('preOrderBtn').onclick = () => handleTraversal(0);
    document.getElementById('postOrderBtn').onclick = () => handleTraversal(2);
    
    document.getElementById('btnClearOutput').onclick = () => {
        document.getElementById('outputBody').innerHTML = '<div class="log-entry system">Cleared.</div>';
    };
    
    document.getElementById('btnClearConsole').onclick = () => {
        document.getElementById('outputConsole').innerHTML = '<div class="log-entry system">>> Console Cleared.</div>';
    };
}

function handleInsert() {
    if (!isWasmReady) return;
    const val = parseInt(document.getElementById('nodeValue').value);
    
    if (isNaN(val)) {
        alert("Please enter a valid number");
        return;
    }

    logConsole(`>> Inserting ${val}...`);
    const jsonStr = Module.ccall('insertNode', 'string', ['number'], [val]);
    processTreeUpdate(jsonStr);
    logConsole(`>> Node ${val} inserted.`);
}

function handleDelete() {
    if (!isWasmReady) return;
    const val = parseInt(document.getElementById('nodeValue').value);
    
    if (isNaN(val)) return;

    logConsole(`>> Deleting ${val}...`);
    const jsonStr = Module.ccall('deleteNode', 'string', ['number'], [val]);
    processTreeUpdate(jsonStr);
    logConsole(`>> Node ${val} deleted (if existed).`);
}

function handleSearch() {
    if (!isWasmReady || !currentTreeData) return;
    const val = parseInt(document.getElementById('nodeValue').value);
    if (isNaN(val)) return;

    resetNodeVisuals();
    const found = Module.ccall('searchNode', 'number', ['number'], [val]);
    logConsole(`>> Searching for ${val}...`);
    animateSearchPath(currentTreeData, val, found === 1);
}

function handleTraversal(type) {
    if (!isWasmReady) return;
    const types = ["PreOrder", "InOrder", "PostOrder"];
    const name = types[type];
    
    logConsole(`>> Running ${name} Traversal...`);
    resetNodeVisuals();

    const resultStr = Module.ccall('getTraversal', 'string', ['number'], [type]);
    
    if (!resultStr || resultStr.trim() === "") {
        updateOutputPanel("Tree is empty.");
        return;
    }

    const arr = resultStr.trim().split(" ");
    const formattedHtml = arr.join(' <span style="color:#6b7280">→</span> ');
    updateOutputPanel(`<div class="log-entry system">>> ${name}:</div><div class="log-entry">${formattedHtml}</div>`);
    animateSequence(arr);
}

function handleRandom() {
    const val = Math.floor(Math.random() * 100);
    document.getElementById('nodeValue').value = val;
    handleInsert();
}

function handleClear() {
    Module.ccall('initTree', null, [], []);
    previousNodePositions.clear();
    processTreeUpdate("null");
    logConsole(">> Tree Cleared.");
    updateOutputPanel("Tree cleared.");
}

// --- Core D3.js Rendering (Fixed Logic) ---

function processTreeUpdate(jsonStr) {
    if (jsonStr === "null") {
        currentTreeData = null;
        updateD3(null);
        updateStats();
        return;
    }

    try {
        currentTreeData = JSON.parse(jsonStr);
        updateD3(currentTreeData);
        updateStats();
    } catch (e) {
        console.error("JSON Parse Error:", e);
        logConsole(">> Error parsing tree data.");
    }
}

function updateD3(treeData) {
    // 1. Handle Empty Tree
    if (!treeData) {
        g.selectAll("*").transition().duration(CONFIG.animDuration).style("opacity", 0).remove();
        previousNodePositions.clear();
        return;
    }

    // 2. Data Processing
    // Create the hierarchy from JSON
    rootHierarchy = d3.hierarchy(treeData);
    
    // Compute the new X/Y coordinates
    treeLayout(rootHierarchy);

    // --- NODE RENDERING ---

    // Select existing nodes and Bind Data by VALUE (Key)
    // This tells D3: "This data object belongs to the node with this specific ID"
    const nodes = g.selectAll(".node")
        .data(rootHierarchy.descendants(), d => d.data.value);

    // Handle Enter, Update, Exit with .join()
    nodes.join(
        // ENTER: New nodes appearing
        enter => {
            const nodeGroup = enter.append("g")
                .attr("class", "node")
                .attr("id", d => `node-${d.data.value}`)
                .attr("transform", d => {
                    // Start at the PARENT'S previous position (creates the "sprouting" effect)
                    // If no parent (root), or parent wasn't there, default to current location
                    const p = d.parent && previousNodePositions.has(d.parent.data.value)
                        ? previousNodePositions.get(d.parent.data.value) 
                        : { x: d.x, y: d.y };
                    return `translate(${p.x},${p.y})`;
                })
                .style("opacity", 0); // Fade in

            // Add Circle
            nodeGroup.append("circle")
                .attr("r", CONFIG.nodeRadius)
                .style("fill", "#fff")
                .style("stroke", CONFIG.colors.default)
                .style("stroke-width", "2.5px");

            // Add Value Text
            nodeGroup.append("text")
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(d => d.data.value);

            // Add Height Label
            nodeGroup.append("text")
                .attr("dy", "2.2em")
                .attr("text-anchor", "middle")
                .style("font-size", "10px")
                .style("fill", "#6b7280")
                .text(d => `h:${d.data.height}`);

            return nodeGroup.transition().duration(CONFIG.animDuration)
                .style("opacity", 1)
                .attr("transform", d => `translate(${d.x},${d.y})`);
        },
        
        // UPDATE: Existing nodes moving to new spots (Rotations)
        update => {
            const nodeGroup = update.transition().duration(CONFIG.animDuration)
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .style("opacity", 1);
            
            // Update the Height Text (it might change during balancing)
            update.select("text:last-child")
                .text(d => `h:${d.data.height}`);
            
            // Reset colors (in case they were highlighted red/green previously)
            update.select("circle")
                .style("fill", "#fff")
                .style("stroke", CONFIG.colors.default);

            return nodeGroup;
        },

        // EXIT: Nodes being deleted
        exit => exit.transition().duration(CONFIG.animDuration)
            .style("opacity", 0)
            .attr("transform", d => {
                // Shrink towards parent if possible
                const target = d.parent ? d.parent : d;
                return `translate(${target.x},${target.y}) scale(0.1)`;
            })
            .remove()
    );

    // --- LINK RENDERING ---

    const links = g.selectAll(".link")
        .data(rootHierarchy.links(), d => `${d.source.data.value}-${d.target.data.value}`);

    links.join(
        // ENTER Links
        enter => enter.insert("path", ".node") // Insert behind nodes
            .attr("class", "link")
            .attr("d", d => {
                // Start drawing link from the Source's PREVIOUS position
                const start = previousNodePositions.has(d.source.data.value)
                    ? previousNodePositions.get(d.source.data.value)
                    : { x: d.source.x, y: d.source.y };
                return diagonal(start, start); // Start as a zero-length line
            })
            .transition().duration(CONFIG.animDuration)
            .attr("d", d => diagonal(d.source, d.target)),
        
        // UPDATE Links
        update => update.transition().duration(CONFIG.animDuration)
            .attr("d", d => diagonal(d.source, d.target)),

        // EXIT Links
        exit => exit.transition().duration(CONFIG.animDuration)
            .style("opacity", 0)
            .remove()
    );

    // --- STASH POSITIONS FOR NEXT FRAME ---
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

// --- Animation Routines ---

function resetNodeVisuals() {
    d3.selectAll(".node circle")
        .transition().duration(300)
        .style("stroke", CONFIG.colors.default)
        .style("fill", "#fff")
        .style("stroke-width", "2.5px");
}

function animateSearchPath(node, targetVal, exists) {
    if (!node) return;

    const domNode = d3.select(`#node-${node.value} circle`);
    
    domNode.transition().duration(300)
        .style("stroke", CONFIG.colors.processing)
        .style("fill", "#fffbeb")
        .style("stroke-width", "4px");

    setTimeout(() => {
        if (node.value === targetVal) {
            domNode.transition().duration(300)
                .style("stroke", CONFIG.colors.found)
                .style("fill", "#ecfdf5")
                .style("stroke-width", "5px");
            logConsole(`>> Found ${targetVal}!`);
        } else if (targetVal < node.value) {
            if (node.left) {
                animateSearchPath(node.left, targetVal, exists);
            } else {
                if(!exists) logConsole(`>> ${targetVal} not found.`);
            }
        } else {
            if (node.right) {
                animateSearchPath(node.right, targetVal, exists);
            } else {
                if(!exists) logConsole(`>> ${targetVal} not found.`);
            }
        }
    }, CONFIG.stepDelay);
}

function animateSequence(values) {
    let i = 0;
    
    function next() {
        if (i >= values.length) {
            logConsole(">> Animation Complete.");
            setTimeout(resetNodeVisuals, 2000);
            return;
        }

        const val = values[i];
        const domNode = d3.select(`#node-${val} circle`);
        
        domNode.transition().duration(300)
            .style("stroke", CONFIG.colors.processing)
            .style("fill", "#fffbeb")
            .transition().delay(300).duration(300)
            .style("stroke", CONFIG.colors.found)
            .style("fill", "#ecfdf5");

        i++;
        setTimeout(next, CONFIG.stepDelay);
    }
    next();
}

// --- Helpers ---

function updateStats() {
    if (!currentTreeData) {
        document.getElementById('treeHeight').innerText = "0";
        document.getElementById('nodeCount').innerText = "0";
        return;
    }
    document.getElementById('treeHeight').innerText = currentTreeData.height;
    document.getElementById('nodeCount').innerText = rootHierarchy.descendants().length;
}

function updateOutputPanel(htmlContent) {
    const panel = document.getElementById('outputBody');
    if (panel) panel.innerHTML = htmlContent;
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