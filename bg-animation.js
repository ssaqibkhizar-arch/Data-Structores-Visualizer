/**
 * DATA_STRUCTURES_VISUALIZER // BACKGROUND_ENGINE
 * A high-performance, physics-based particle network.
 * * Features:
 * - High-DPI (Retina) Rendering Support
 * - Spatial Mouse Interaction (Magnetic Pull)
 * - Dynamic "Hero" Node Coloring based on brand palette
 * - Distance-based Opacity interpolation
 */

const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIGURATION ---
const CONFIG = {
    particleCount: 0, // Calculated dynamically based on screen size
    connectionDist: 140,
    mouseDist: 200,
    baseSpeed: 0.4,
    colors: {
        base: 'rgba(148, 163, 184)', // Slate-400
        // Brand colors for "Hero" nodes: Hash, Graph, AVL, Heap
        heroes: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'] 
    }
};

let width, height;
let particles = [];
let mouse = { x: null, y: null };

// --- HIGH-DPI SETUP ---
// This ensures crisp lines on Retina/4K displays
function setupCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    
    // Calculate proper density
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual size in memory (scaled to account for extra pixels)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Normalize coordinate system to use css pixels
    ctx.scale(dpr, dpr);
    
    // Set visible size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Calculate optimal particle count: 1 particle per 15,000 pixels
    const area = width * height;
    CONFIG.particleCount = Math.floor(area / 15000);
    
    initParticles();
}

// --- PARTICLE CLASS ---
class Particle {
    constructor() {
        this.reset(true);
    }

    reset(randomizePosition = false) {
        this.x = randomizePosition ? Math.random() * width : Math.random() * width;
        this.y = randomizePosition ? Math.random() * height : Math.random() * height;
        
        // Physics properties
        this.vx = (Math.random() - 0.5) * CONFIG.baseSpeed;
        this.vy = (Math.random() - 0.5) * CONFIG.baseSpeed;
        
        // Visual properties
        this.size = Math.random() * 2 + 1;
        
        // 15% chance to be a "Hero Node" (Colored), otherwise standard Slate
        const isHero = Math.random() < 0.15;
        this.color = isHero 
            ? CONFIG.colors.heroes[Math.floor(Math.random() * CONFIG.colors.heroes.length)]
            : CONFIG.colors.base;
            
        this.isHero = isHero;
    }

    update() {
        // 1. Base Movement
        this.x += this.vx;
        this.y += this.vy;

        // 2. Mouse Interaction (Magnetic Pull)
        if (mouse.x != null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            // If mouse is close, gently accelerate particle towards it
            if (distance < CONFIG.mouseDist) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (CONFIG.mouseDist - distance) / CONFIG.mouseDist;
                
                // "Pull" strength
                const pull = 0.8; 
                this.vx += forceDirectionX * force * 0.03 * pull;
                this.vy += forceDirectionY * force * 0.03 * pull;
            }
        }

        // 3. Friction (Damping) - Keeps particles from accelerating infinitely
        this.vx *= 0.99; 
        this.vy *= 0.99;

        // 4. Boundary Wrap (Pac-Man style)
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        // Hero nodes get full opacity, base nodes are subtle
        ctx.fillStyle = this.isHero ? this.color : `${this.color}, 0.5)`;
        ctx.fill();
    }
}

// --- INITIALIZATION ---
function initParticles() {
    particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
        particles.push(new Particle());
    }
}

// --- RENDER LOOP ---
function animate() {
    ctx.clearRect(0, 0, width, height);

    // O(N^2) loop is acceptable for N < 150. 
    // We update and draw in the same pass for efficiency.
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.update();
        p.draw();

        // Check connections
        // We start j at i so we don't draw lines twice or connect to self
        for (let j = i; j < particles.length; j++) {
            let p2 = particles[j];
            let dx = p.x - p2.x;
            let dy = p.y - p2.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < CONFIG.connectionDist) {
                ctx.beginPath();
                
                // Opacity based on distance (closer = stronger)
                let opacity = 1 - (dist / CONFIG.connectionDist);
                
                // If either node is a Hero, tint the line slightly
                if (p.isHero || p2.isHero) {
                    ctx.strokeStyle = `rgba(139, 92, 246, ${opacity * 0.2})`; // Subtle Violet tint
                } else {
                    ctx.strokeStyle = `rgba(148, 163, 184, ${opacity * 0.15})`; // Slate Gray
                }
                
                ctx.lineWidth = 1;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }

        // Connect to Mouse (Extra Visual Feedback)
        if (mouse.x != null) {
            let dx = mouse.x - p.x;
            let dy = mouse.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < CONFIG.mouseDist) {
                let opacity = 1 - (dist / CONFIG.mouseDist);
                ctx.beginPath();
                ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.5})`; // Brand Blue
                ctx.lineWidth = 1;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(animate);
}

// --- EVENT LISTENERS ---

// Mouse Tracking
window.addEventListener('mousemove', (e) => {
    // Correct mouse position for any scrolling/offsets
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

// Clear mouse when leaving window to stop stuck effects
window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

// Handle Window Resize with Debounce (Performance)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(setupCanvas, 100);
});

// Start Engine
setupCanvas();
animate();