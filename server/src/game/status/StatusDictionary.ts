import { ServerPlayer } from '../Player';

/**
 * Defines the shape of an entity that can receive status effects.
 * Both ServerPlayer and ServerEnemy implement this interface implicitly.
 */
export interface StatusTarget {
    hp: number;
    maxHp: number;
    speed: number;
    originalSpeed: number;
    isDead?: boolean;
    isDestroyed?: boolean;
    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive?: boolean): void;
}

/** Data stored per active status on an entity */
export interface ActiveStatus {
    stacks: number;
    timer: number;       // remaining ms
    tickTimer: number;   // ms until next tick fires
    intensity: number;   // damage, slow amount, etc.
    instigator: ServerPlayer | null;
    immune: boolean;     // true = currently immune (CC only)
}

/** Full definition of a status from the dictionary */
export interface StatusDef {
    /** 'DoT' | 'CC' | 'Debuff' | 'Buff' */
    type: 'DoT' | 'CC' | 'Debuff' | 'Buff';
    maxStacks: number;
    /** Default duration in ms when none supplied */
    defaultDuration: number;
    /** Tick interval in ms (DoTs only). 0 = continuous (every frame) */
    tickRateMs: number;
    /** Called once when the status is freshly applied or refreshed */
    onApply?: (target: StatusTarget, state: ActiveStatus) => void;
    /** Called every tick (when tickTimer hits 0). Return damage for logging. */
    onTick?: (target: StatusTarget, state: ActiveStatus) => void;
    /** Called once when the status expires or is removed */
    onRemove?: (target: StatusTarget, state: ActiveStatus) => void;
    /** CC immunity window in ms after removal (to prevent stunlock) */
    immunityAfterMs?: number;
    /** Visual hint sent to client */
    visual: { color: string; shape: 'sphere' | 'cube' | 'pyramid' | 'ring' | 'none'; behavior: 'pulse' | 'spin' | 'enclose' | 'float' | 'static' };
}

// ─── Helper to compute poison tick damage (hybrid formula) ──────────────────
function calcPoisonDmg(state: ActiveStatus): number {
    const playerAttack = state.instigator ? state.instigator.getDamage(false, true) : 40;
    const playerLevel  = state.instigator ? state.instigator.level : 1;
    const E = 0.1; // 10% of attack per stack
    return Math.round((playerAttack * E + playerLevel) * state.stacks);
}

// ─── Helper for bleed / burn tick damage ────────────────────────────────────
function calcDoTDmg(state: ActiveStatus, isBleed = false): number {
    let dmg = state.intensity * state.stacks;
    if (isBleed && state.instigator && (state.instigator as any).loadoutItems && (state.instigator as any).loadoutItems.includes('frasco_sangue')) {
        dmg *= 1.15;
    }
    return Math.round(dmg);
}

function applyStatusDamage(target: StatusTarget, state: ActiveStatus, amount: number, statusId: string): void {
    const anyTarget = target as any;
    if (anyTarget.damageTracker) {
        anyTarget.takeDamage(amount, state.instigator, false, false, {
            directSourceName: statusId,
            primarySourceName: state.instigator?.name || statusId,
            sourceType: 'status',
            abilityName: statusId,
            isContinuous: true,
            isStatus: true,
            isSummoned: false,
        });
        return;
    }
    target.takeDamage(amount, state.instigator, false);
}

function healTarget(target: StatusTarget, amount: number): void {
    const anyTarget = target as any;
    if (typeof anyTarget.heal === 'function') {
        anyTarget.heal(amount);
        return;
    }
    target.hp = Math.min(target.maxHp, target.hp + amount);
}

function multiplyTargetDamage(target: StatusTarget, key: string, multiplier: number): void {
    const anyTarget = target as any;
    if (typeof anyTarget.damage !== 'number') return;
    anyTarget.__statusDamageMultipliers = anyTarget.__statusDamageMultipliers || {};
    if (anyTarget.__statusDamageMultipliers[key]) return;
    anyTarget.__statusDamageMultipliers[key] = multiplier;
    anyTarget.damage *= multiplier;
}

function restoreTargetDamage(target: StatusTarget, key: string): void {
    const anyTarget = target as any;
    const multiplier = anyTarget.__statusDamageMultipliers?.[key];
    if (!multiplier || typeof anyTarget.damage !== 'number') return;
    anyTarget.damage /= multiplier;
    delete anyTarget.__statusDamageMultipliers[key];
}

/**
 * Central Status Dictionary — single source of truth for all 14 status effects.
 * New statuses can be added here without touching any entity class.
 */
export const StatusDictionary: Record<string, StatusDef> = {

    // ── DoTs ─────────────────────────────────────────────────────────────────

    poison: {
        type: 'DoT',
        maxStacks: 5,
        defaultDuration: 3000,
        tickRateMs: 1000,
        onTick(target, state) {
            const dmg = calcPoisonDmg(state);
            applyStatusDamage(target, state, dmg, 'poison');
        },
        visual: { color: '#22c55e', shape: 'sphere', behavior: 'pulse' },
    },

    bleeding: {
        type: 'DoT',
        maxStacks: 1,
        defaultDuration: 4000,
        tickRateMs: 1000,
        onTick(target, state) {
            applyStatusDamage(target, state, calcDoTDmg(state, true), 'bleeding');
        },
        visual: { color: '#dc2626', shape: 'sphere', behavior: 'pulse' },
    },

    burning: {
        type: 'DoT',
        maxStacks: 5,
        defaultDuration: 4000,
        tickRateMs: 1000,
        onTick(target, state) {
            applyStatusDamage(target, state, calcDoTDmg(state), 'burning');
        },
        visual: { color: '#f97316', shape: 'pyramid', behavior: 'spin' },
    },

    lichKingLifeDrain: {
        type: 'DoT',
        maxStacks: 1,
        defaultDuration: 999999, // manually removed
        tickRateMs: 0, // continuous
        onTick(target, state) {
            // intensity = damagePerSecond; dt passed via tickTimer hack (intensity * dt handled externally)
            // kept for completeness; actual damage is in StatusManager via continuous tick
        },
        visual: { color: '#8b5cf6', shape: 'ring', behavior: 'pulse' },
    },

    // ── CCs ──────────────────────────────────────────────────────────────────

    stunned: {
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 2000,
        tickRateMs: 0,
        onApply(target) {
            target.speed = 0;
        },
        onRemove(target) {
            target.speed = target.originalSpeed;
        },
        immunityAfterMs: 1000,
        visual: { color: '#facc15', shape: 'ring', behavior: 'spin' },
    },

    frozen: {
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 2000,
        tickRateMs: 0,
        onApply(target) {
            target.speed = 0;
        },
        onRemove(target) {
            target.speed = target.originalSpeed;
        },
        immunityAfterMs: 2000,
        visual: { color: '#7dd3fc', shape: 'cube', behavior: 'enclose' },
    },

    rooted: {
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        onApply(target) {
            target.speed = 0;
        },
        onRemove(target) {
            target.speed = target.originalSpeed;
        },
        immunityAfterMs: 500,
        visual: { color: '#86efac', shape: 'ring', behavior: 'static' },
    },

    lichKingPrison: {
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        onApply(target) {
            target.speed = 0;
        },
        onRemove(target) {
            target.speed = target.originalSpeed;
        },
        immunityAfterMs: 1000,
        visual: { color: '#a855f7', shape: 'cube', behavior: 'enclose' },
    },

    // ── Debuffs ───────────────────────────────────────────────────────────────

    slowed: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 2000,
        tickRateMs: 0,
        onApply(target, state) {
            target.speed = target.originalSpeed * (1 - state.intensity);
        },
        onRemove(target) {
            target.speed = target.originalSpeed;
        },
        visual: { color: '#93c5fd', shape: 'ring', behavior: 'float' },
    },

    disoriented: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        visual: { color: '#fde68a', shape: 'ring', behavior: 'spin' },
    },

    blind: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 2000,
        tickRateMs: 0,
        visual: { color: '#374151', shape: 'sphere', behavior: 'pulse' },
    },

    silenced: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        visual: { color: '#6b7280', shape: 'sphere', behavior: 'static' },
    },

    attackSpeedSlow: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        visual: { color: '#60a5fa', shape: 'cube', behavior: 'float' },
    },

    armorFracture: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 5000,
        tickRateMs: 0,
        visual: { color: '#f59e0b', shape: 'cube', behavior: 'pulse' },
    },

    invertedControls: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        visual: { color: '#e879f9', shape: 'ring', behavior: 'spin' },
    },

    marcaDaAlma: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 5000,
        tickRateMs: 0,
        visual: { color: '#f43f5e', shape: 'pyramid', behavior: 'pulse' },
    },

    // ── Missing Loadout Statuses ──────────────────────────────────────────────
    acid: {
        type: 'DoT',
        maxStacks: 5,
        defaultDuration: 4000,
        tickRateMs: 1000,
        onTick(target, state) {
            applyStatusDamage(target, state, calcDoTDmg(state), 'acid');
        },
        visual: { color: '#84cc16', shape: 'cube', behavior: 'pulse' },
    },

    plague: {
        type: 'DoT',
        maxStacks: 3,
        defaultDuration: 6000,
        tickRateMs: 1000,
        onTick(target, state) {
            applyStatusDamage(target, state, calcDoTDmg(state), 'plague');
        },
        visual: { color: '#d946ef', shape: 'sphere', behavior: 'spin' },
    },

    ignite: { // Alias for burning
        type: 'DoT',
        maxStacks: 5,
        defaultDuration: 3000,
        tickRateMs: 1000,
        onTick(target, state) {
            applyStatusDamage(target, state, calcDoTDmg(state), 'ignite');
        },
        visual: { color: '#f97316', shape: 'pyramid', behavior: 'spin' },
    },
    
    bleed: { // Alias for bleeding
        type: 'DoT',
        maxStacks: 1,
        defaultDuration: 5000,
        tickRateMs: 1000,
        onTick(target, state) {
            applyStatusDamage(target, state, calcDoTDmg(state, true), 'bleed');
        },
        visual: { color: '#dc2626', shape: 'sphere', behavior: 'pulse' },
    },
    
    freeze: { // Alias for frozen
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 1000,
        tickRateMs: 0,
        onApply(target) { target.speed = 0; },
        onRemove(target) { target.speed = target.originalSpeed; },
        immunityAfterMs: 2000,
        visual: { color: '#7dd3fc', shape: 'cube', behavior: 'enclose' },
    },
    
    stun: { // Alias for stunned
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 1500,
        tickRateMs: 0,
        onApply(target) { target.speed = 0; },
        onRemove(target) { target.speed = target.originalSpeed; },
        immunityAfterMs: 1000,
        visual: { color: '#facc15', shape: 'ring', behavior: 'spin' },
    },
    
    root: { // Alias for rooted
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 2000,
        tickRateMs: 0,
        onApply(target) { target.speed = 0; },
        onRemove(target) { target.speed = target.originalSpeed; },
        immunityAfterMs: 500,
        visual: { color: '#86efac', shape: 'ring', behavior: 'static' },
    },

    slow: { // Alias for slowed
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        onApply(target, state) { target.speed = target.originalSpeed * (1 - state.intensity); },
        onRemove(target) { target.speed = target.originalSpeed; },
        visual: { color: '#93c5fd', shape: 'ring', behavior: 'float' },
    },

    silence: { // Alias for silenced
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        visual: { color: '#6b7280', shape: 'sphere', behavior: 'static' },
    },
    
    confusion: { // Behaves like disoriented
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 2000,
        tickRateMs: 0,
        visual: { color: '#fde68a', shape: 'ring', behavior: 'spin' },
    },

    fear: {
        type: 'CC',
        maxStacks: 1,
        defaultDuration: 2000,
        tickRateMs: 0,
        visual: { color: '#4b5563', shape: 'ring', behavior: 'float' },
    },

    vulnerable: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 4000,
        tickRateMs: 0,
        visual: { color: '#fb7185', shape: 'pyramid', behavior: 'float' },
    },

    weakness: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 4000,
        tickRateMs: 0,
        onApply(target) {
            multiplyTargetDamage(target, 'weakness', 0.80);
        },
        onRemove(target) {
            restoreTargetDamage(target, 'weakness');
        },
        visual: { color: '#a3a3a3', shape: 'sphere', behavior: 'pulse' },
    },

    exhaust: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 4000,
        tickRateMs: 0,
        visual: { color: '#cbd5e1', shape: 'cube', behavior: 'spin' },
    },

    marked: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 5000,
        tickRateMs: 0,
        onApply(target) {
            (target as any).mark?.();
        },
        onRemove(target) {
            (target as any).unmark?.();
        },
        visual: { color: '#ef4444', shape: 'pyramid', behavior: 'static' },
    },

    mortalWounds: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 4000,
        tickRateMs: 0,
        visual: { color: '#b91c1c', shape: 'cube', behavior: 'static' },
    },

    taunt: {
        type: 'Debuff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        visual: { color: '#dc2626', shape: 'ring', behavior: 'pulse' },
    },
    
    thornsBuff: {
        type: 'Buff',
        maxStacks: 1,
        defaultDuration: 5000,
        tickRateMs: 0,
        visual: { color: '#00ff44', shape: 'pyramid', behavior: 'pulse' }
    },

    regen: {
        type: 'Buff',
        maxStacks: 1,
        defaultDuration: 10000,
        tickRateMs: 1000,
        onTick(target, state) {
            const pct = state.intensity > 0 ? state.intensity : 0.015;
            healTarget(target, target.maxHp * pct);
        },
        visual: { color: '#22c55e', shape: 'sphere', behavior: 'pulse' },
    },

    haste: {
        type: 'Buff',
        maxStacks: 1,
        defaultDuration: 10000,
        tickRateMs: 0,
        visual: { color: '#ffffff', shape: 'ring', behavior: 'float' },
    },

    enrage: {
        type: 'Buff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        onApply(target) {
            multiplyTargetDamage(target, 'enrage', 1.25);
        },
        onRemove(target) {
            restoreTargetDamage(target, 'enrage');
        },
        visual: { color: '#b91c1c', shape: 'pyramid', behavior: 'pulse' },
    },

    aegis: {
        type: 'Buff',
        maxStacks: 1,
        defaultDuration: 3000,
        tickRateMs: 0,
        visual: { color: '#facc15', shape: 'ring', behavior: 'enclose' },
    },
};
