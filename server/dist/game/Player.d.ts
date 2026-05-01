import { Vec3 } from '../utils/Vector3';
import { InputState, PlayerSnapshot } from '../network/Protocol';
/**
 * Server-side Player state — full authority
 */
export declare class ServerPlayer {
    id: string;
    name: string;
    position: Vec3;
    targetPosition?: Vec3;
    rotationY: number;
    color: number;
    hp: number;
    maxHp: number;
    speed: number;
    originalSpeed: number;
    isDead: boolean;
    level: number;
    xp: number;
    xpToNextLevel: number;
    score: number;
    kills: number;
    orbsCollected: number;
    attackCooldownMs: number;
    originalAttackCooldownMs: number;
    lastAttackTime: number;
    isAttacking: boolean;
    attackHitCounter: number;
    justDied: boolean;
    hitboxRadius: number;
    skillLevels: {
        q: number;
        w: number;
        e: number;
        r: number;
        passive: number;
    };
    skills: {
        q: {
            cooldown: number;
            lastUsed: number;
            duration: number;
            timer: number;
            isDashing: boolean;
            dashSpeed: number;
        };
        w: {
            cooldown: number;
            lastUsed: number;
        };
        e: {
            cooldown: number;
            lastUsed: number;
            duration: number;
            timer: number;
            isActive: boolean;
            shieldHp: number;
            maxShieldHp: number;
            damageAbsorbed: number;
        };
        r: {
            cooldown: number;
            lastUsed: number;
            duration: number;
            timer: number;
            isActive: boolean;
        };
    };
    activeBuff: {
        type: string | null;
        timer: number;
        duration: number;
        attackCounter: number;
    };
    tempBuff: {
        type: string | null;
        timer: number;
        magnitude: number;
    };
    timedBuffs: {
        type: string;
        timer: number;
        effects: any;
    }[];
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
    }[];
    pendingZones: {
        type: string;
        x: number;
        z: number;
        radius: number;
        damage: number;
    }[];
    statusEffects: {
        stunned: {
            isActive: boolean;
            timer: number;
        };
        frozen: {
            isActive: boolean;
            timer: number;
        };
        bleeding: {
            isActive: boolean;
            timer: number;
            damage: number;
            lastTick: number;
            tickInterval: number;
        };
        slowed: {
            isActive: boolean;
            timer: number;
            amount: number;
        };
        rooted: {
            isActive: boolean;
            timer: number;
        };
        attackSpeedSlow: {
            isActive: boolean;
            timer: number;
            amount: number;
        };
        disoriented: {
            isActive: boolean;
            timer: number;
        };
        blind: {
            isActive: boolean;
            timer: number;
        };
        silenced: {
            isActive: boolean;
            timer: number;
        };
        burning: {
            isActive: boolean;
            timer: number;
            damagePerTick: number;
            lastTick: number;
            tickInterval: number;
            stacks: number;
        };
        armorFracture: {
            isActive: boolean;
            timer: number;
            amount: number;
        };
        marcaDaAlma: {
            isActive: boolean;
            timer: number;
        };
        lichKingPrison: {
            isActive: boolean;
            timer: number;
        };
        lichKingLifeDrain: {
            isActive: boolean;
            timer: number;
            damagePerSecond: number;
        };
        freezingConeHits: {
            count: number;
            timer: number;
        };
    };
    input: InputState;
    platform: 'pc' | 'mobile';
    pendingUpgrade: number | null;
    lastPingTime: number;
    isConnected: boolean;
    private facingDirection;
    private static PLAYER_COLORS;
    private static nextColorIndex;
    constructor(id: string, name: string);
    getDamage(isAbility?: boolean): number;
    getEffectiveAttackCooldown(): number;
    getEffectiveSkillCooldown(key: 'q' | 'w' | 'e' | 'r'): number;
    setFacingDirection(targetX: number, targetZ: number): void;
    /** Updates only the projectile direction, leaving rotationY (visual) untouched */
    setFacingDirectionOnly(targetX: number, targetZ: number): void;
    /** Sets facingDirection directly from normalized screen-space x/z (fallback when no raycaster) */
    setFacingDirectionFromScreen(sx: number, sz: number): void;
    setTargetPosition(targetX: number, targetZ: number): void;
    getFacingDirection(): Vec3;
    update(dt: number, now: number): void;
    handleMovement(dt: number): void;
    updateStatusEffects(dt: number, now: number): void;
    updateBuffs(dt: number): void;
    updateSkills(dt: number): void;
    takeDamage(amount: number, fromProjectile?: boolean, isTrueDamage?: boolean): void;
    heal(amount: number): void;
    die(): void;
    addXp(amount: number): void;
    levelUp(): void;
    collectOrb(): void;
    upgradeSkill(key: string): void;
    skipUpgrade(): void;
    activateDash(): void;
    activateShield(): void;
    activateUltimate(): void;
    finishDash(): void;
    canUseSkill(key: 'q' | 'w' | 'e' | 'r', now: number): boolean;
    canAttack(now: number): boolean;
    applyBuff(type: string): void;
    clearBuff(): void;
    applyTimedBuff(type: string, durSec: number, effects: any): void;
    applyTemporaryBuff(type: string, durSec: number, mag: number): void;
    applyStun(d: number): void;
    applyFreeze(d: number): void;
    applySlow(d: number, a: number): void;
    applyRoot(d: number): void;
    applyBleed(d: number, dmg: number): void;
    applyBurn(d: number, dmg: number, s?: number): void;
    applyArmorFracture(d: number, a: number): void;
    applyAttackSpeedSlow(d: number, a: number): void;
    applyDisorientation(d: number): void;
    applyBlindness(d: number): void;
    applySilence(d: number): void;
    applyMarcaDaAlma(d: number): void;
    applyLichKingPrison(d: number): void;
    clearNegativeEffects(): void;
    toSnapshot(now: number): PlayerSnapshot;
}
//# sourceMappingURL=Player.d.ts.map