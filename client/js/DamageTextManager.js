/**
 * DamageTextManager - Floating damage numbers system (Ragnarok Online style)
 * Uses an Object Pool of pre-allocated <div> elements to avoid GC pressure.
 * Converts 3D world positions to 2D screen coordinates via THREE.js camera projection.
 */

import * as THREE from 'three';

// ─── CSS Injection ─────────────────────────────────────────────────────────────
const DMG_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

#damage-text-layer {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 500;
    overflow: hidden;
}

.dmg-text {
    position: absolute;
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    font-weight: 400;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    display: none;
    text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
    will-change: transform, opacity;
    transform: translateX(-50%);
}

.dmg-text.dmg-normal { color: #ffffff; }
.dmg-text.dmg-heal   { color: #00ff44; font-size: 13px; }
.dmg-text.dmg-shield { color: #ffd700; }
.dmg-text.dmg-toxic  { color: #39ff14; font-size: 13px; font-weight: bold; }
.dmg-text.dmg-thorns { color: #ff7700; font-size: 11px; }
.dmg-text.dmg-spellvamp { color: #bc13fe; font-size: 11px; }
.dmg-text.dmg-lifesteal { color: #ff1493; font-size: 11px; }
.dmg-text.dmg-crit { color: #ff3333; font-size: 19px; font-weight: bold; }

.dmg-text.dmg-active {
    display: block;
    animation: dmgFloatUp 1.25s ease-out forwards;
}

.dmg-text.dmg-crit.dmg-active {
    animation: dmgCritFloat 1.25s ease-out forwards;
}

@keyframes dmgFloatUp {
    0%   { opacity: 1;   transform: translateX(-50%) translateY(0px)    scale(1.15); }
    15%  { opacity: 1;   transform: translateX(-50%) translateY(-12px)  scale(1.0);  }
    100% { opacity: 0;   transform: translateX(-50%) translateY(-80px)  scale(0.85); }
}

@keyframes dmgCritFloat {
    0%   { opacity: 1;   transform: translateX(-50%) translateY(0px)    scale(1.5); }
    15%  { opacity: 1;   transform: translateX(-50%) translateY(-15px)  scale(1.3); }
    100% { opacity: 0;   transform: translateX(-50%) translateY(-100px) scale(0.9); }
}
`;

function injectStyles() {
    if (document.getElementById('dmg-text-styles')) return;
    const style = document.createElement('style');
    style.id = 'dmg-text-styles';
    style.textContent = DMG_STYLE;
    document.head.appendChild(style);
}

// ─── Main Class ────────────────────────────────────────────────────────────────
export class DamageTextManager {
    /**
     * @param {HTMLElement} containerEl - The #damage-text-layer div
     * @param {number} poolSize - Number of pre-allocated divs (default 50)
     */
    constructor(containerEl, poolSize = 50) {
        this.container = containerEl;
        this.pool = [];          // inactive divs
        this.active = new Set(); // currently animating divs

        injectStyles();
        this._buildPool(poolSize);
    }

    // ── Pool Management ──────────────────────────────────────────────────────

    _buildPool(size) {
        for (let i = 0; i < size; i++) {
            const div = document.createElement('div');
            div.className = 'dmg-text';
            this.container.appendChild(div);
            this.pool.push(div);

            // When animation ends, return div to pool
            div.addEventListener('animationend', () => {
                this._returnToPool(div);
            });
        }
    }

    _getFromPool() {
        return this.pool.pop() || null; // null = pool exhausted (rare)
    }

    _returnToPool(div) {
        div.classList.remove('dmg-active', 'dmg-normal', 'dmg-heal', 'dmg-shield', 'dmg-toxic', 'dmg-thorns', 'dmg-spellvamp', 'dmg-lifesteal', 'dmg-crit');
        div.style.display = 'none';
        div.style.left = '-9999px';
        div.style.top  = '-9999px';
        this.active.delete(div);
        this.pool.push(div);
    }

    // ── 3D → 2D Projection ───────────────────────────────────────────────────

    /**
     * Projects a world-space Vec3 to canvas-space (x, y) pixels.
     * Returns null if the point is behind the camera.
     */
    _worldToScreen(worldX, worldY, worldZ, camera, rendererCanvas) {
        const vec = new THREE.Vector3(worldX, worldY, worldZ);
        vec.project(camera); // transforms to NDC (-1..1)

        // If behind camera, don't show
        if (vec.z > 1) return null;

        const w = rendererCanvas.clientWidth  || rendererCanvas.width;
        const h = rendererCanvas.clientHeight || rendererCanvas.height;

        return {
            x: Math.round((vec.x *  0.5 + 0.5) * w),
            y: Math.round((vec.y * -0.5 + 0.5) * h),
        };
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Spawn a floating damage number at a 3D world position.
     * @param {number} worldX
     * @param {number} worldY  - already offset by caller (entity height)
     * @param {number} worldZ
     * @param {number} value   - The damage / heal amount (integer)
     * @param {'NORMAL'|'HEAL'|'SHIELD'} type
     * @param {THREE.Camera} camera
     * @param {HTMLCanvasElement} rendererCanvas
     */
    showDamage(worldX, worldY, worldZ, value, type, camera, rendererCanvas) {
        if (!camera || !rendererCanvas) return;

        const screen = this._worldToScreen(worldX, worldY, worldZ, camera, rendererCanvas);
        if (!screen) return;

        const div = this._getFromPool();
        if (!div) return; // pool exhausted, skip silently

        // Add slight random horizontal jitter so overlapping numbers don't stack perfectly
        const jitter = (Math.random() - 0.5) * 20;

        // Format value: compact for large numbers
        let text;
        if (value === 0 || type === 'MISS') {
            text = 'MISS';
        } else if (value >= 1_000_000) {
            text = (value / 1_000_000).toFixed(1) + 'M';
        } else if (value >= 10_000) {
            text = Math.round(value / 1000) + 'K';
        } else {
            text = value.toString();
        }

        // Format based on type
        if (type === 'HEAL' && text !== 'MISS') text = '+' + text;
        else if (type === 'TOXIC' && text !== 'MISS') text = '☠️ ' + text;
        else if (type === 'THORNS' && text !== 'MISS') text = 'REFLECT: ' + text;
        else if (type === 'SPELLVAMP' && text !== 'MISS') text = 'VAMP: +' + text;
        else if (type === 'LIFESTEAL' && text !== 'MISS') text = 'LIFE: +' + text;
        else if (type === 'CRIT' && text !== 'MISS') text = text + '!';

        // Position
        div.style.left = `${screen.x + jitter}px`;
        div.style.top  = `${screen.y}px`;
        div.textContent = text;

        // Type class
        const typeClass = type === 'HEAL' ? 'dmg-heal'
                        : type === 'SHIELD' ? 'dmg-shield'
                        : type === 'TOXIC' ? 'dmg-toxic'
                        : type === 'THORNS' ? 'dmg-thorns'
                        : type === 'SPELLVAMP' ? 'dmg-spellvamp'
                        : type === 'LIFESTEAL' ? 'dmg-lifesteal'
                        : type === 'CRIT' ? 'dmg-crit'
                        : 'dmg-normal';

        // Reset animation by removing and re-adding the active class
        div.classList.remove('dmg-active', 'dmg-normal', 'dmg-heal', 'dmg-shield', 'dmg-toxic', 'dmg-thorns', 'dmg-spellvamp', 'dmg-lifesteal', 'dmg-crit');
        div.style.display = 'block';

        // Force reflow to restart CSS animation
        void div.offsetWidth;

        div.classList.add(typeClass, 'dmg-active');
        this.active.add(div);
    }
}
