import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';
import { EnemyRegistry } from '../../data/EnemyRegistry';
import { EnemySnapshot } from '../../network/Protocol';

export type EnemyTowerKind = 'ballistic' | 'inferno' | 'shock' | 'gravity';

/** PurpleCube - basic ranged enemy that chases and shoots */
export class PurpleCubeEnemy extends ServerEnemy {
    private attackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'PurpleCube';
        this.name = 'Purple Cube';

        // Data-driven path: EnemyRegistry (O(1) lookup)
        const def = EnemyRegistry.get('PurpleCube');
        if (def) {
            const s = def.stats;
            this.maxHp = s.hp * globalMultiplier;
            this.hp = this.maxHp;
            this.damage = s.damage * globalMultiplier;
            this.speed = s.speed;
            this.originalSpeed = s.speed;
            this.attackRange = s.attackRange;
            this.attackCooldown = s.attackCooldown;
            this.xp = s.xp;
            this.score = s.score;
            this.hitboxRadius = s.hitboxRadius;
        } else {
            // Fallback: CONFIG legado (será removido após migração completa)
            const c = CONFIG.PURPLE_CUBE;
            this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier;
            this.hp = this.maxHp;
            this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMultiplier;
            this.speed = this.getRegSpeed(c.SPEED);
            this.originalSpeed = this.getRegSpeed(c.SPEED);
            this.attackRange = c.ATTACK_RANGE;
            this.attackCooldown = c.ATTACK_COOLDOWN;
            this.xp = this.getRegXp(c.XP);
            this.score = this.getRegScore(c.SCORE);
            this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        }
        this.position.y = 0.4;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        if (dist > this.attackRange) {
            this.moveTowards(target.position, dt);
        } else {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown && this.canUseAbility()) {
                this.lastAttackTime = now;
                const dir = target.position.clone().sub(this.position);
                dir.y = 0;
                dir.normalize();
                this.pendingProjectiles.push({ dir, damage: this.damage });
            }
        }
        this.lookAt(target.position);
    }
}

/** RedCone - stationary turret that fires spreads of projectiles */
export class RedConeEnemy extends ServerEnemy {
    private attackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    private attackVisualUntil: number = 0;
    private attackSequence: number = 0;
    public projectileCount: number = 1;
    private lastProjectileIncreaseTime: number = 0;
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'RedCone';
        this.name = 'Red Cone';
        const c = CONFIG.RED_CONE;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMultiplier;
        this.speed = 0;
        this.originalSpeed = 0;
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 0.75;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;

        this.lastProjectileIncreaseTime += dt;
        if (this.lastProjectileIncreaseTime > 5) {
            this.lastProjectileIncreaseTime = 0;
            this.projectileCount++;
        }

        this.lookAt(target.position);
        if (this.position.distanceToXZ(target.position) <= this.attackRange) {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown && this.canUseAbility()) {
                this.lastAttackTime = now;
                this.attackVisualUntil = now + 450;
                this.attackSequence++;
                const baseDir = target.position.clone().sub(this.position);
                baseDir.y = 0; baseDir.normalize();
                const coneAngle = Math.PI / 6;
                for (let i = 0; i < this.projectileCount; i++) {
                    const offset = this.projectileCount > 1 ? (i - (this.projectileCount - 1) / 2) * (coneAngle / (this.projectileCount - 1)) : 0;
                    const dir = baseDir.clone().applyAxisAngleY(offset);
                    this.pendingProjectiles.push({ dir, damage: this.damage, specialEffect: 'red_cone_fireball' });
                }
            }
        }
    }

    toSnapshot(): any {
        const snap = super.toSnapshot();
        snap.isChanneling = Date.now() < this.attackVisualUntil;
        snap.attackSequence = this.attackSequence;
        return snap;
    }
}

/** EnemyTower - static tower with ranged attacks, respawns after destruction */
export class EnemyTowerEnemy extends ServerEnemy {
    private attackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    public towerKind: EnemyTowerKind;
    public currentStage: number = 1;
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number; hitboxRadius?: number; params?: any }[] = [];
    public pendingAbilities: any[] = [];
    public respawnDelay: number = CONFIG.ENEMY_TOWER.RESPAWN_DELAY;
    public respawnTimer: number = 0;
    public isWaitingRespawn: boolean = false;

    private attackSequence: number = 0;
    private delayedBallisticShots: { timer: number; dir: Vec3; damage: number; specialEffect: string; speed: number; hitboxRadius?: number; params?: any }[] = [];

    private infernoTargetId: string | null = null;
    private infernoLockTime = 0;
    private infernoTickTimer = 0;
    private infernoLostTime = 0;
    private infernoOverheatReadyAt = 0;

    private shockStacks: Map<string, number> = new Map();
    private shockStackTimer: Map<string, number> = new Map();
    private shockStackExpiry: Map<string, number> = new Map();
    public lastShockStun: Map<string, number> = new Map();
    private shockOverloadReadyAt: Map<string, number> = new Map();

    private gravityMarks: Map<string, number> = new Map();
    private gravityMarkTimers: Map<string, number> = new Map();
    private gravityCooldown = 0;

    constructor(pos: Vec3, globalMultiplier: number, towerKind: EnemyTowerKind = 'ballistic') {
        super(pos);
        this.type = 'EnemyTower';
        this.name = this.getTowerName(towerKind);
        this.towerKind = towerKind;
        const c = CONFIG.ENEMY_TOWER;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMultiplier;
        this.speed = 0;
        this.originalSpeed = 0;
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 2;
    }

    private getTowerName(kind: EnemyTowerKind): string {
        switch (kind) {
            case 'inferno': return 'Torre Foco Infernal';
            case 'shock': return 'Torre Bobina de Choque';
            case 'gravity': return 'Torre Vortice Gravitacional';
            default: return 'Torre Sentinela Balistica';
        }
    }

    private getTowerStage(gameTime: number, playerLevel: number): number {
        const minute = gameTime / 60;
        if (minute >= 10 || playerLevel >= 20) return 4;
        if (minute >= 6 || playerLevel >= 15) return 3;
        if (minute >= 3 || playerLevel >= 10) return 2;
        return 1;
    }

    private getHighestPlayerLevel(players: ServerPlayer[]): number {
        return players.reduce((best, player) => Math.max(best, player.level || 1), 1);
    }

    getDamage(targetDist: number): number {
        const bonus = 1 + Math.max(0, (this.attackRange - targetDist) / this.attackRange);
        return this.damage * bonus;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const livePlayers = players.filter(p => !p.isDead);
        if (!livePlayers.length) return;
        this.currentStage = this.getTowerStage(gameTime, this.getHighestPlayerLevel(livePlayers));

        switch (this.towerKind) {
            case 'inferno':
                this.updateInferno(dt, livePlayers);
                break;
            case 'shock':
                this.updateShock(dt, livePlayers);
                break;
            case 'gravity':
                this.updateGravity(dt, livePlayers);
                break;
            default:
                this.updateBallistic(dt, livePlayers);
                break;
        }
    }

    private updateBallistic(dt: number, players: ServerPlayer[]): void {
        this.flushDelayedBallisticShots(dt);
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        if (dist <= this.attackRange) {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown && this.canUseAbility()) {
                this.lastAttackTime = now;
                this.attackSequence++;
                const heavy = this.currentStage >= 4 && this.attackSequence % 4 === 0;
                this.fireBallisticAt(target, dist, heavy);
                if (this.currentStage >= 3 && !heavy) {
                    const followUp = this.buildBallisticShot(target, dist, false);
                    followUp.timer = 250;
                    this.delayedBallisticShots.push(followUp);
                }
            }
        }
        this.lookAt(target.position);
    }

    private buildBallisticShot(target: ServerPlayer, dist: number, heavy: boolean) {
        const start = this.position.clone();
        start.y = 3;
        const dir = target.position.clone().sub(start);
        dir.normalize();
        const stage = this.currentStage;
        const normalSlowChance = stage >= 4 ? 0.25 : stage >= 3 ? 0.20 : stage >= 2 ? 0.10 : 0;
        const baseSpeed = 18 * (stage >= 2 ? 1.15 : 1);
        return {
            timer: 0,
            dir,
            damage: this.getDamage(dist) * (heavy ? 1.6 : 1),
            specialEffect: heavy ? 'tower_ballistic_heavy' : 'tower_ballistic',
            speed: heavy ? 17 : baseSpeed,
            hitboxRadius: heavy ? 0.34 : 0.22,
            params: {
                slowChance: heavy ? 1 : normalSlowChance,
                slowAmount: heavy ? 0.35 : 0.20,
                slowDuration: heavy ? 1500 : 1000,
                damageCapPercent: heavy ? 0.18 : undefined,
            },
        };
    }

    private fireBallisticAt(target: ServerPlayer, dist: number, heavy: boolean): void {
        this.pendingProjectiles.push(this.buildBallisticShot(target, dist, heavy));
    }

    private flushDelayedBallisticShots(dt: number): void {
        for (let i = this.delayedBallisticShots.length - 1; i >= 0; i--) {
            const shot = this.delayedBallisticShots[i];
            shot.timer -= dt * 1000;
            if (shot.timer <= 0) {
                this.pendingProjectiles.push(shot);
                this.delayedBallisticShots.splice(i, 1);
            }
        }
    }

    private updateInferno(dt: number, players: ServerPlayer[]): void {
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        const stage = this.currentStage;
        const resetGrace = stage >= 3 ? 0.45 : 0.70;

        if (dist > this.attackRange) {
            this.infernoLostTime += dt;
            if (this.infernoLostTime > resetGrace) this.resetInfernoLock();
            return;
        }

        if (this.infernoTargetId !== target.id) {
            this.infernoTargetId = target.id;
            this.infernoLockTime = 0;
            this.infernoTickTimer = 0;
        }
        this.infernoLostTime = 0;
        this.infernoLockTime += dt;
        this.infernoTickTimer += dt;
        this.lookAt(target.position);

        const lockDelay = stage >= 3 ? 0 : stage >= 2 ? 0.6 : 0.8;
        if (this.infernoLockTime < lockDelay) return;

        if (this.infernoTickTimer >= 0.25) {
            this.infernoTickTimer -= 0.25;
            const secondsLocked = this.infernoLockTime + (stage >= 4 ? 1.0 : 0);
            let multiplier = stage >= 3 ? 0.75 : 0.50;
            if (secondsLocked >= 1) multiplier = stage >= 2 ? 1.00 : 0.90;
            if (secondsLocked >= 2) multiplier = 1.40;
            if (secondsLocked >= 3) multiplier = 2.10;
            if (secondsLocked >= 4) multiplier = 3.00;
            this.pendingAbilities.push({
                type: 'tower_inferno_tick',
                targetId: target.id,
                x: this.position.x,
                z: this.position.z,
                targetX: target.position.x,
                targetZ: target.position.z,
                damage: this.damage * multiplier * 0.25,
                lockTime: this.infernoLockTime,
                sourceId: this.id,
            });
        }

        const now = Date.now();
        if (stage >= 4 && this.infernoLockTime >= 5 && now >= this.infernoOverheatReadyAt) {
            this.infernoOverheatReadyAt = now + 8000;
            this.pendingAbilities.push({
                type: 'tower_inferno_overheat',
                targetId: target.id,
                x: target.position.x,
                z: target.position.z,
                damage: this.damage * 2.5,
                slowAmount: 0.40,
                slowDuration: 2000,
                sourceId: this.id,
            });
        }
    }

    private resetInfernoLock(): void {
        this.infernoTargetId = null;
        this.infernoLockTime = 0;
        this.infernoTickTimer = 0;
        this.infernoLostTime = 0;
    }

    private updateShock(dt: number, players: ServerPlayer[]): void {
        const now = Date.now();
        for (const [id, expiry] of [...this.shockStackExpiry.entries()]) {
            const next = expiry - dt;
            if (next <= 0) {
                this.shockStacks.delete(id);
                this.shockStackTimer.delete(id);
                this.shockStackExpiry.delete(id);
            } else {
                this.shockStackExpiry.set(id, next);
            }
        }

        for (const p of players) {
            if (p.position.distanceToXZ(this.position) > this.attackRange) continue;
            const nextTimer = (this.shockStackTimer.get(p.id) || 0) - dt;
            if (nextTimer <= 0) {
                const stacks = Math.min(5, (this.shockStacks.get(p.id) || 0) + 1);
                this.shockStacks.set(p.id, stacks);
                this.shockStackTimer.set(p.id, 1.0);
                this.shockStackExpiry.set(p.id, 3.0);
                const overloadReady = this.shockOverloadReadyAt.get(p.id) || 0;
                if (stacks >= 5 && now >= overloadReady) {
                    this.shockStacks.set(p.id, 0);
                    this.shockOverloadReadyAt.set(p.id, now + 7000);
                    this.pendingAbilities.push({
                        type: 'tower_shock_overload',
                        targetId: p.id,
                        x: p.position.x,
                        z: p.position.z,
                        damage: this.damage * 2.0,
                        slowAmount: 0.40,
                        slowDuration: 2000,
                        stunDuration: 550,
                        sourceId: this.id,
                    });
                }
            } else {
                this.shockStackTimer.set(p.id, nextTimer);
            }
        }

        const target = this.getClosestPlayer(players);
        if (!target || this.position.distanceToXZ(target.position) > this.attackRange) return;
        this.lookAt(target.position);
        if (now <= this.lastAttackTime + 2200 || !this.canUseAbility()) return;
        this.lastAttackTime = now;

        const stacks = this.shockStacks.get(target.id) || 0;
        const stunChance = this.currentStage >= 4 ? 0.45 : this.currentStage >= 3 ? 0.35 : this.currentStage >= 2 ? 0.25 : 0.15;
        this.pendingAbilities.push({
            type: 'tower_shock_pulse',
            targetId: target.id,
            x: target.position.x,
            z: target.position.z,
            damage: this.damage * 0.85 * (1 + stacks * 0.08),
            slowAmount: 0.20,
            slowDuration: 800,
            stunChance,
            stunDuration: 180,
            sourceId: this.id,
        });
    }

    private updateGravity(dt: number, players: ServerPlayer[]): void {
        for (const [id, timer] of [...this.gravityMarkTimers.entries()]) {
            const next = timer - dt;
            if (next <= 0) {
                this.gravityMarks.delete(id);
                this.gravityMarkTimers.delete(id);
            } else {
                this.gravityMarkTimers.set(id, next);
            }
        }

        this.gravityCooldown -= dt;
        const target = this.getClosestPlayer(players);
        if (!target || this.position.distanceToXZ(target.position) > this.attackRange) return;
        this.lookAt(target.position);
        if (this.gravityCooldown > 0 || !this.canUseAbility()) return;
        this.gravityCooldown = 3.2;

        const nextMarks = Math.min(3, (this.gravityMarks.get(target.id) || 0) + 1);
        this.gravityMarks.set(target.id, nextMarks);
        this.gravityMarkTimers.set(target.id, 6);
        const vortexCenter = target.position.clone();
        const towardTower = this.position.clone().sub(target.position);
        towardTower.y = 0;
        if (towardTower.lengthSq() > 0.01) {
            vortexCenter.add(towardTower.normalize().multiplyScalar(2.5));
        }

        this.pendingAbilities.push({
            type: 'tower_gravity_pulse',
            targetId: target.id,
            x: vortexCenter.x,
            z: vortexCenter.z,
            radius: 5,
            damage: this.damage * 0.90,
            slowAmount: 0.25,
            slowDuration: 1200,
            pullForce: 8,
            sourceId: this.id,
        });

        if (nextMarks >= 3) {
            this.gravityMarks.set(target.id, 0);
            this.pendingAbilities.push({
                type: 'tower_gravity_rupture',
                targetId: target.id,
                x: vortexCenter.x,
                z: vortexCenter.z,
                radius: 5,
                damage: this.damage * 2.4,
                slowAmount: 0.45,
                slowDuration: 1800,
                knockbackForce: 14,
                residue: this.currentStage >= 4,
                residueDamagePerSec: this.damage * 0.35,
                sourceId: this.id,
            });
        }
    }

    toSnapshot(): EnemySnapshot {
        const snap = super.toSnapshot();
        return {
            ...snap,
            towerKind: this.towerKind,
            towerStage: this.currentStage,
            towerCharge: this.towerKind === 'shock' ? Math.max(0, ...this.shockStacks.values()) : undefined,
            towerHeat: this.towerKind === 'inferno' ? this.infernoLockTime : undefined,
        };
    }

    respawn(): void {
        this.hp = this.maxHp;
        this.isDestroyed = false;
        this.isWaitingRespawn = false;
        this.delayedBallisticShots = [];
        this.resetInfernoLock();
        this.shockStacks.clear();
        this.shockStackTimer.clear();
        this.shockStackExpiry.clear();
        this.gravityMarks.clear();
        this.gravityMarkTimers.clear();
        this.gravityCooldown = 0;
    }
}

/** GuardianGuerreiro - melee warrior with stun */
export class GuardianGuerreiroEnemy extends ServerEnemy {
    private attackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    private stunCooldown: number;
    private lastStunTime: number = 0;
    public isElite: boolean;
    public pendingMeleeAttacks: { targetId: string; damage: number; stun?: number }[] = [];

    constructor(pos: Vec3, globalMultiplier: number, isElite = false) {
        super(pos);
        this.isElite = isElite;
        this.type = 'GuardianGuerreiro';
        this.name = (isElite ? 'Guardião de Elite' : 'Guardião') + ' Guerreiro';
        const c = CONFIG.GUARDIAN_GUERREIRO;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier * (isElite ? 20 : 1);
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMultiplier;
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.stunCooldown = c.STUN_COOLDOWN;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 0.75;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        if (dist > this.attackRange) {
            this.moveTowards(target.position, dt);
        } else {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown && this.canUseAbility()) {
                this.lastAttackTime = now;
                let dmg = this.damage;
                if (this.isElite) dmg = 300 * 1 + (target.hp * 0.05);
                let stun: number | undefined;
                if (now > this.lastStunTime + this.stunCooldown) {
                    this.lastStunTime = now;
                    stun = 2000;
                }
                this.pendingMeleeAttacks.push({ targetId: target.id, damage: dmg, stun });
            }
        }
        this.lookAt(target.position);
    }
}

/** GuardianMago - ranged mage that repositions, freeze ability */
export class GuardianMagoEnemy extends ServerEnemy {
    private attackRange: number;
    private minAttackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    private freezeCooldown: number;
    private lastFreezeTime: number = 0;
    private state: 'repositioning' | 'casting' = 'repositioning';
    private stateTimer: number;
    private targetPosition: Vec3 | null = null;
    private castDuration: number = 1000;
    public isElite: boolean;
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; explosionRadius?: number }[] = [];

    constructor(pos: Vec3, globalMultiplier: number, isElite = false) {
        super(pos);
        this.isElite = isElite;
        this.type = 'GuardianMago';
        this.name = (isElite ? 'Guardião de Elite' : 'Guardião') + ' Mago';
        const c = CONFIG.GUARDIAN_MAGO;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier * (isElite ? 20 : 1);
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMultiplier;
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.attackRange = c.ATTACK_RANGE;
        this.minAttackRange = c.MIN_ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.freezeCooldown = c.FREEZE_COOLDOWN;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.stateTimer = 2000 + Math.random() * 2000;
        this.position.y = 1.25;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        this.stateTimer -= dt * 1000;

        if (this.state === 'casting') {
            if (this.stateTimer <= 0) {
                const now = Date.now();
                this.lastAttackTime = now;
                const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
                let dmg = this.damage;
                if (this.isElite) dmg = 300 * 1 + (target.hp * 0.05);
                let fx: string | undefined;
                if (now > this.lastFreezeTime + this.freezeCooldown) { this.lastFreezeTime = now; fx = 'freeze'; }
                this.pendingProjectiles.push({ dir, damage: dmg, specialEffect: fx, explosionRadius: 2.0 });
                this.state = 'repositioning';
                this.stateTimer = 2000 + Math.random() * 2000;
                this.targetPosition = null;
            }
            return;
        }

        // Repositioning
        const dist = this.position.distanceToXZ(target.position);
        if (this.stateTimer <= 0 || (this.targetPosition && this.position.distanceToXZ(this.targetPosition) < 1.0)) {
            this.state = 'casting';
            this.stateTimer = this.castDuration;
            return;
        }
        if (!this.targetPosition || dist < this.minAttackRange) {
            const angle = Math.random() * Math.PI * 2;
            const r = this.minAttackRange + Math.random() * 5;
            this.targetPosition = target.position.clone().add(new Vec3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
        }
        this.moveTowards(this.targetPosition, dt);
        this.lookAt(target.position);
    }
}

/** GuardianArqueiro - ranged archer with bleed, maintains ideal distance */
export class GuardianArqueiroEnemy extends ServerEnemy {
    private attackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    private idealDistance: number;
    private retreatDistance: number;
    public isElite: boolean;
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; bleedDamage?: number }[] = [];

    constructor(pos: Vec3, globalMultiplier: number, isElite = false) {
        super(pos);
        this.isElite = isElite;
        this.type = 'GuardianArqueiro';
        this.name = (isElite ? 'Guardião de Elite' : 'Guardião') + ' Arqueiro';
        const c = CONFIG.GUARDIAN_ARQUEIRO;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier * (isElite ? 20 : 1);
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMultiplier;
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.idealDistance = c.IDEAL_DISTANCE;
        this.retreatDistance = c.RETREAT_DISTANCE;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.25;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        let moveDir = new Vec3();
        if (dist < this.retreatDistance) {
            moveDir = this.position.clone().sub(target.position); moveDir.y = 0; moveDir.normalize();
        } else if (dist > this.idealDistance) {
            moveDir = target.position.clone().sub(this.position); moveDir.y = 0; moveDir.normalize();
        } else {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown && this.canUseAbility()) {
                this.lastAttackTime = now;
                const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
                let dmg = this.damage;
                if (this.isElite) dmg = 300 + (target.hp * 0.05);
                this.pendingProjectiles.push({ dir, damage: dmg, specialEffect: 'bleed', bleedDamage: 5 });
            }
        }
        if (moveDir.lengthSq() > 0) this.position.add(moveDir.multiplyScalar(this.speed * dt));
        this.lookAt(target.position);
    }
}
