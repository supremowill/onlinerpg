/**
 * VisualStatusRegistry — client-side status effect renderer.
 * 
 * Maps status IDs to visual effects using pure HTML/CSS 3D transforms
 * (no textures — only geometry shapes as per project rules).
 * 
 * Usage:
 *   import { VisualStatusRegistry } from './VisualStatusRegistry.js';
 *   VisualStatusRegistry.update(enemyEl, statusEffects);  // call every frame
 */

/** Visual definition per status */
export const STATUS_VISUALS = {
    poison: {
        label: '☠',
        color: '#22c55e',
        shape: 'sphere',
        behavior: 'pulse',
        isBuff: false,
    },
    bleeding: {
        label: '🩸',
        color: '#dc2626',
        shape: 'sphere',
        behavior: 'pulse',
        isBuff: false,
    },
    burning: {
        label: '🔥',
        color: '#f97316',
        shape: 'pyramid',
        behavior: 'spin',
        isBuff: false,
    },
    stunned: {
        label: '⭐',
        color: '#facc15',
        shape: 'ring',
        behavior: 'spin',
        isBuff: false,
    },
    frozen: {
        label: '❄',
        color: '#7dd3fc',
        shape: 'cube',
        behavior: 'enclose',
        isBuff: false,
    },
    rooted: {
        label: '🕸',
        color: '#86efac',
        shape: 'ring',
        behavior: 'static',
        isBuff: false,
    },
    lichKingPrison: {
        label: '⛓',
        color: '#a855f7',
        shape: 'cube',
        behavior: 'enclose',
        isBuff: false,
    },
    slowed: {
        label: '❄',
        color: '#93c5fd',
        shape: 'ring',
        behavior: 'float',
        isBuff: false,
    },
    disoriented: {
        label: '🌀',
        color: '#fde68a',
        shape: 'ring',
        behavior: 'spin',
        isBuff: false,
    },
    blind: {
        label: '👁',
        color: '#374151',
        shape: 'sphere',
        behavior: 'pulse',
        isBuff: false,
    },
    silenced: {
        label: '🔇',
        color: '#6b7280',
        shape: 'sphere',
        behavior: 'static',
        isBuff: false,
    },
    attackSpeedSlow: {
        label: '⏳',
        color: '#60a5fa',
        shape: 'cube',
        behavior: 'float',
        isBuff: false,
    },
    armorFracture: {
        label: '💔',
        color: '#f59e0b',
        shape: 'cube',
        behavior: 'pulse',
        isBuff: false,
    },
    invertedControls: {
        label: '🔄',
        color: '#e879f9',
        shape: 'ring',
        behavior: 'spin',
        isBuff: false,
    },
    marcaDaAlma: {
        label: '✨',
        color: '#f43f5e',
        shape: 'pyramid',
        behavior: 'pulse',
        isBuff: false,
    },
    thornsBuff: {
        label: '🌵',
        color: '#00ff44',
        shape: 'pyramid',
        behavior: 'pulse',
        isBuff: true,
    },
    acid: { label: 'AC', color: '#84cc16', shape: 'cube', behavior: 'pulse', isBuff: false },
    plague: { label: 'PL', color: '#d946ef', shape: 'sphere', behavior: 'spin', isBuff: false },
    ignite: { label: 'IG', color: '#f97316', shape: 'pyramid', behavior: 'spin', isBuff: false },
    bleed: { label: 'BL', color: '#dc2626', shape: 'sphere', behavior: 'pulse', isBuff: false },
    freeze: { label: 'FR', color: '#7dd3fc', shape: 'cube', behavior: 'enclose', isBuff: false },
    stun: { label: 'ST', color: '#facc15', shape: 'ring', behavior: 'spin', isBuff: false },
    root: { label: 'RT', color: '#86efac', shape: 'ring', behavior: 'static', isBuff: false },
    slow: { label: 'SL', color: '#93c5fd', shape: 'ring', behavior: 'float', isBuff: false },
    silence: { label: 'SI', color: '#6b7280', shape: 'sphere', behavior: 'static', isBuff: false },
    confusion: { label: 'CF', color: '#fde68a', shape: 'ring', behavior: 'spin', isBuff: false },
    fear: { label: 'FE', color: '#4b5563', shape: 'ring', behavior: 'float', isBuff: false },
    vulnerable: { label: 'VU', color: '#fb7185', shape: 'pyramid', behavior: 'float', isBuff: false },
    weakness: { label: 'WK', color: '#a3a3a3', shape: 'sphere', behavior: 'pulse', isBuff: false },
    exhaust: { label: 'EX', color: '#cbd5e1', shape: 'cube', behavior: 'spin', isBuff: false },
    marked: { label: 'MK', color: '#ef4444', shape: 'pyramid', behavior: 'static', isBuff: false },
    mortalWounds: { label: 'MW', color: '#b91c1c', shape: 'cube', behavior: 'static', isBuff: false },
    taunt: { label: 'TA', color: '#dc2626', shape: 'ring', behavior: 'pulse', isBuff: false },
    regen: { label: 'RG', color: '#22c55e', shape: 'sphere', behavior: 'pulse', isBuff: true },
    haste: { label: 'HA', color: '#ffffff', shape: 'ring', behavior: 'float', isBuff: true },
    enrage: { label: 'EN', color: '#b91c1c', shape: 'pyramid', behavior: 'pulse', isBuff: true },
    aegis: { label: 'AG', color: '#facc15', shape: 'ring', behavior: 'enclose', isBuff: true },
    lichKingLifeDrain: { label: 'LD', color: '#8b5cf6', shape: 'ring', behavior: 'pulse', isBuff: false },
};

/** Cache: entityId → Map<statusId, element> */
const _elementCache = new Map();

/**
 * Creates a geometric CSS 3D element for the given status.
 * @param {string} statusId
 * @param {number} stacks
 * @returns {HTMLElement}
 */
function createStatusElement(statusId, stacks) {
    const def = STATUS_VISUALS[statusId];
    if (!def) return null;

    const el = document.createElement('div');
    el.className = `status-vfx status-vfx--${statusId} status-vfx--${def.shape} status-vfx--${def.behavior}`;
    el.dataset.statusId = statusId;

    // Base geometric shape styles
    const size = 10;
    el.style.cssText = `
        position: absolute;
        top: -${size + 4}px;
        left: 50%;
        transform: translateX(-50%);
        width: ${size}px;
        height: ${size}px;
        background: ${def.color};
        opacity: 0.85;
        pointer-events: none;
        z-index: 10;
        border-radius: ${def.shape === 'sphere' ? '50%' : def.shape === 'ring' ? '50%' : '0'};
        border: ${def.shape === 'ring' ? `2px solid ${def.color}; background: transparent` : 'none'};
        box-shadow: 0 0 6px ${def.color};
        animation: status-${def.behavior} 1s infinite ease-in-out;
        font-size: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
    `;

    // Stack indicator
    if (stacks > 1) {
        const badge = document.createElement('span');
        badge.className = 'status-vfx-badge';
        badge.textContent = stacks;
        badge.style.cssText = `
            position: absolute;
            top: -6px;
            right: -6px;
            background: rgba(0,0,0,0.8);
            color: ${def.color};
            font-size: 7px;
            font-weight: bold;
            border-radius: 3px;
            padding: 1px 2px;
            line-height: 1;
            border: 1px solid ${def.color};
        `;
        badge.textContent = stacks;
        el.appendChild(badge);
    }

    return el;
}

/**
 * Inject the required CSS animations once into the document head.
 */
function injectStyles() {
    if (document.getElementById('visual-status-registry-styles')) return;
    const style = document.createElement('style');
    style.id = 'visual-status-registry-styles';
    style.textContent = `
        @keyframes status-pulse {
            0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.85; }
            50% { transform: translateX(-50%) scale(1.3); opacity: 1; }
        }
        @keyframes status-spin {
            0% { transform: translateX(-50%) rotate(0deg); }
            100% { transform: translateX(-50%) rotate(360deg); }
        }
        @keyframes status-float {
            0%, 100% { transform: translateX(-50%) translateY(0); }
            50% { transform: translateX(-50%) translateY(-4px); }
        }
        @keyframes status-enclose {
            0%, 100% { box-shadow: 0 0 6px currentColor; }
            50% { box-shadow: 0 0 14px currentColor; }
        }
        @keyframes status-static {
            0%, 100% { opacity: 0.85; }
        }
        .status-vfx-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}

export const VisualStatusRegistry = {
    /**
     * Update visual status effects for a given enemy DOM element.
     * Call this once per rendered entity per frame.
     * 
     * @param {string} entityId - Unique entity ID (enemy.id)
     * @param {HTMLElement} entityEl - The DOM element for the entity model
     * @param {Array<{id: string, stacks: number}>} statusEffects - From snapshot
     */
    update(entityId, entityEl, statusEffects = []) {
        injectStyles();

        // Get or create the VFX container for this entity
        let container = entityEl.querySelector('.status-vfx-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'status-vfx-container';
            entityEl.appendChild(container);
        }

        // Get or create entity-level cache
        if (!_elementCache.has(entityId)) {
            _elementCache.set(entityId, new Map());
        }
        const cache = _elementCache.get(entityId);

        // Build the set of currently active status IDs
        const activeIds = new Set(statusEffects.map(se => se.id));

        // Remove VFX for statuses that have expired
        for (const [sid, el] of cache) {
            if (!activeIds.has(sid)) {
                el.remove(); // Garbage collect DOM node
                cache.delete(sid);
            }
        }

        // Create or update VFX for active statuses
        for (const { id, stacks } of statusEffects) {
            if (cache.has(id)) {
                // Update stacks badge if needed
                const el = cache.get(id);
                const badge = el.querySelector('.status-vfx-badge');
                if (stacks > 1) {
                    if (badge) {
                        badge.textContent = stacks;
                    } else {
                        const def = STATUS_VISUALS[id];
                        const newBadge = document.createElement('span');
                        newBadge.className = 'status-vfx-badge';
                        newBadge.textContent = stacks;
                        newBadge.style.cssText = `
                            position: absolute; top: -6px; right: -6px;
                            background: rgba(0,0,0,0.8); color: ${def?.color || '#fff'};
                            font-size: 7px; font-weight: bold; border-radius: 3px;
                            padding: 1px 2px; line-height: 1; border: 1px solid ${def?.color || '#fff'};
                        `;
                        el.appendChild(newBadge);
                    }
                } else if (badge) {
                    badge.remove();
                }
            } else {
                // Create new VFX element
                const el = createStatusElement(id, stacks);
                if (el) {
                    // Offset horizontally so multiple statuses don't overlap
                    const offset = cache.size * 14;
                    el.style.left = `calc(50% + ${offset - 14}px)`;
                    container.appendChild(el);
                    cache.set(id, el);
                }
            }
        }
    },

    /**
     * Remove all VFX for a given entity (call when entity is destroyed).
     * @param {string} entityId
     */
    cleanup(entityId) {
        const cache = _elementCache.get(entityId);
        if (cache) {
            for (const el of cache.values()) {
                el.remove();
            }
            _elementCache.delete(entityId);
        }
    },

    /**
     * Returns display info for a status ID (for HUD cards).
     * @param {string} statusId
     * @returns {{ label: string, color: string, isBuff: boolean } | null}
     */
    getInfo(statusId) {
        return STATUS_VISUALS[statusId] || null;
    },
};
