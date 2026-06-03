import { StatusDictionary, ActiveStatus, StatusTarget } from './StatusDictionary';
import { ServerPlayer } from '../Player';

/**
 * StatusManager — manages all active status effects for a single entity.
 * Both ServerPlayer and ServerEnemy will own one instance.
 */
export class StatusManager {
    private target: StatusTarget;
    /** Map of statusId → active state */
    public active: Map<string, ActiveStatus> = new Map();
    /** Map of statusId → immunity timer remaining (ms) */
    private immunities: Map<string, number> = new Map();

    constructor(target: StatusTarget) {
        this.target = target;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Apply (or refresh/stack) a status effect.
     * @param id         Key in StatusDictionary
     * @param durationMs Duration in ms (0 = use dictionary default)
     * @param intensity  Damage per tick, slow amount, etc. Meaning is status-specific.
     * @param instigator Player who applied the status (for damage attribution)
     */
    applyStatus(id: string, durationMs = 0, intensity = 0, instigator: ServerPlayer | null = null): boolean {
        const def = StatusDictionary[id];
        if (!def) return false;

        // Check CC immunity
        if (def.type === 'CC' && this.immunities.has(id)) return false;

        let duration = durationMs > 0 ? durationMs : def.defaultDuration;
        const existing = this.active.get(id);

        let maxStacks = def.maxStacks;
        if (instigator && (instigator as any).loadoutItems) {
            if (def.type === 'CC' && (instigator as any).loadoutItems.includes('relogio_triangular')) {
                duration += 500;
            }
            if ((id === 'poison' || id === 'toxic') && (instigator as any).loadoutItems.includes('frasco_veneno')) {
                maxStacks += 2;
            }
            if ((id === 'root' || id === 'rooted') && (instigator as any).loadoutItems.includes('grilhoes_cansaco')) {
                // Wait for next tick to avoid recursion or just apply directly.
                // We'll apply it directly with double duration.
                this.applyStatus('exhaust', duration * 2, 0, instigator);
            }
            if (id === 'plague' && (instigator as any).loadoutItems.includes('epidemia_acida')) {
                // In epidemia acida, when plague spreads on death it applies acid.
                // This is a bit tricky, but we can store it in the state.
            }
        }

        if (existing) {
            // Refresh timer, stack if possible
            existing.timer = Math.max(existing.timer, duration);
            if (maxStacks > 1) {
                existing.stacks = Math.min(existing.stacks + 1, maxStacks);
            }
            if (intensity > existing.intensity) existing.intensity = intensity;
            if (instigator) existing.instigator = instigator;
        } else {
            const state: ActiveStatus = {
                stacks: 1,
                timer: duration,
                tickTimer: def.tickRateMs > 0 ? def.tickRateMs : 0,
                intensity,
                instigator,
                immune: false,
            };
            this.active.set(id, state);
            def.onApply?.(this.target, state);
        }
        return true;
    }

    /**
     * Remove a status immediately (calls onRemove and applies immunity).
     */
    removeStatus(id: string): void {
        const def = StatusDictionary[id];
        const state = this.active.get(id);
        if (!state || !def) return;
        def.onRemove?.(this.target, state);
        this.active.delete(id);
        if (def.immunityAfterMs && def.immunityAfterMs > 0) {
            this.immunities.set(id, def.immunityAfterMs);
        }
    }

    /** Returns true if the entity currently has this status active */
    hasStatus(id: string): boolean {
        return this.active.has(id);
    }

    /** Returns current stack count (0 if not active) */
    getStacks(id: string): number {
        return this.active.get(id)?.stacks ?? 0;
    }

    /** Returns intensity value for a status (0 if not active) */
    getIntensity(id: string): number {
        return this.active.get(id)?.intensity ?? 0;
    }

    /** Returns remaining timer in ms (0 if not active) */
    getTimer(id: string): number {
        return this.active.get(id)?.timer ?? 0;
    }

    /**
     * Clears all negative effects (used by abilities like cleanse).
     * Does not clear Buff type entries.
     */
    clearNegative(): void {
        for (const [id, _state] of this.active) {
            const def = StatusDictionary[id];
            if (!def || def.type === 'Buff') continue;
            this.removeStatus(id);
        }
    }

    /**
     * Main update loop — call once per game tick with deltaTime in seconds.
     * Returns true if any CC is blocking movement (stun/freeze/root/prison).
     */
    update(dt: number): boolean {
        const ms = dt * 1000;
        let isHardCC = false;

        // Update immunity timers
        for (const [id, rem] of this.immunities) {
            const next = rem - ms;
            if (next <= 0) this.immunities.delete(id);
            else this.immunities.set(id, next);
        }

        // Update active statuses
        for (const [id, state] of this.active) {
            const def = StatusDictionary[id];
            if (!def) { this.active.delete(id); continue; }

            state.timer -= ms;

            // Handle continuous DoTs (tickRateMs === 0 means per-frame scaled)
            if (def.type === 'DoT' && def.tickRateMs === 0 && def.onTick) {
                def.onTick(this.target, state);
            }

            // Handle interval ticks for DoTs and timed buffs such as regen
            if (def.tickRateMs > 0) {
                state.tickTimer -= ms;
                if (state.tickTimer <= 0) {
                    state.tickTimer += def.tickRateMs; // advance, not reset, to keep consistent timing
                    def.onTick?.(this.target, state);
                }
            }

            // Hard CC check
            if (def.type === 'CC' && state.timer > 0) {
                if (['stunned', 'stun', 'frozen', 'freeze', 'rooted', 'root', 'fear', 'lichKingPrison'].includes(id)) {
                    isHardCC = true;
                }
            }

            // Expiry
            if (state.timer <= 0) {
                this.removeStatus(id);
            }
        }

        return isHardCC;
    }

    /**
     * Serialize active statuses for network transmission.
     * Returns array of { id, stacks } to send in snapshot.
     */
    toSnapshot(): { id: string; stacks: number }[] {
        const result: { id: string; stacks: number }[] = [];
        for (const [id, state] of this.active) {
            result.push({ id, stacks: state.stacks });
        }
        return result;
    }

    /**
     * Serialize timers for buffTimers map.
     */
    toTimers(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [id, state] of this.active) {
            result[id] = state.timer;
        }
        return result;
    }
}
