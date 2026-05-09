import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';
import { EnemyRegistry } from '../../data/EnemyRegistry';

/** PurpleCube - basic ranged enemy that chases and shoots */
export class PurpleCubeEnemy extends ServerEnemy {
    private attackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    public pendingProjectiles: { dir: Vec3; damage: number }[] = [];

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
            this.maxHp = c.BASE_HP * globalMultiplier;
            this.hp = this.maxHp;
            this.damage = c.BASE_DAMAGE * globalMultiplier;
            this.speed = c.SPEED;
            this.originalSpeed = c.SPEED;
            this.attackRange = c.ATTACK_RANGE;
            this.attackCooldown = c.ATTACK_COOLDOWN;
            this.xp = c.XP;
            this.score = c.SCORE;
            this.hitboxRadius = c.HITBOX_RADIUS;
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
            if (now > this.lastAttackTime + this.attackCooldown) {
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
    public projectileCount: number = 1;
    private lastProjectileIncreaseTime: number = 0;
    public pendingProjectiles: { dir: Vec3; damage: number }[] = [];

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'RedCone';
        this.name = 'Red Cone';
        const c = CONFIG.RED_CONE;
        this.maxHp = c.BASE_HP * globalMultiplier;
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMultiplier;
        this.speed = 0;
        this.originalSpeed = 0;
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
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
            if (now > this.lastAttackTime + this.attackCooldown) {
                this.lastAttackTime = now;
                const baseDir = target.position.clone().sub(this.position);
                baseDir.y = 0; baseDir.normalize();
                const coneAngle = Math.PI / 6;
                for (let i = 0; i < this.projectileCount; i++) {
                    const offset = this.projectileCount > 1 ? (i - (this.projectileCount - 1) / 2) * (coneAngle / (this.projectileCount - 1)) : 0;
                    const dir = baseDir.clone().applyAxisAngleY(offset);
                    this.pendingProjectiles.push({ dir, damage: this.damage });
                }
            }
        }
    }
}

/** EnemyTower - static tower with ranged attacks, respawns after destruction */
export class EnemyTowerEnemy extends ServerEnemy {
    private attackRange: number;
    private attackCooldown: number;
    private lastAttackTime: number = 0;
    public pendingProjectiles: { dir: Vec3; damage: number }[] = [];
    public respawnDelay: number = CONFIG.ENEMY_TOWER.RESPAWN_DELAY;
    public respawnTimer: number = 0;
    public isWaitingRespawn: boolean = false;

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'EnemyTower';
        this.name = 'Enemy Tower';
        const c = CONFIG.ENEMY_TOWER;
        this.maxHp = c.BASE_HP * globalMultiplier;
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMultiplier;
        this.speed = 0;
        this.originalSpeed = 0;
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.position.y = 2;
    }

    getDamage(targetDist: number): number {
        const bonus = 1 + Math.max(0, (this.attackRange - targetDist) / this.attackRange);
        return this.damage * bonus;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        if (dist <= this.attackRange) {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown) {
                this.lastAttackTime = now;
                const start = this.position.clone(); start.y = 3;
                const dir = target.position.clone().sub(start);
                dir.normalize();
                this.pendingProjectiles.push({ dir, damage: this.getDamage(dist) });
            }
        }
    }

    respawn(): void {
        this.hp = this.maxHp;
        this.isDestroyed = false;
        this.isWaitingRespawn = false;
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
        this.maxHp = c.BASE_HP * globalMultiplier * (isElite ? 20 : 1);
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMultiplier;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.stunCooldown = c.STUN_COOLDOWN;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
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
            if (now > this.lastAttackTime + this.attackCooldown) {
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
        this.maxHp = c.BASE_HP * globalMultiplier * (isElite ? 20 : 1);
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMultiplier;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.attackRange = c.ATTACK_RANGE;
        this.minAttackRange = c.MIN_ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.freezeCooldown = c.FREEZE_COOLDOWN;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
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
        this.maxHp = c.BASE_HP * globalMultiplier * (isElite ? 20 : 1);
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMultiplier;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.attackRange = c.ATTACK_RANGE;
        this.attackCooldown = c.ATTACK_COOLDOWN;
        this.idealDistance = c.IDEAL_DISTANCE;
        this.retreatDistance = c.RETREAT_DISTANCE;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
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
            if (now > this.lastAttackTime + this.attackCooldown) {
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
