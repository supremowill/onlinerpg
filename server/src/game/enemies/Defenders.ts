import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

/** BruxaDoGelo - Ice Witch: freezing cone, blizzard AoE, ice wall (slow), immunity to freeze */
export class BruxaDoGeloEnemy extends ServerEnemy {
    private freezingConeCooldown: number = 8000;
    private lastFreezingCone: number = 0;
    private blizzardCooldown: number = 15000;
    private lastBlizzard: number = 0;
    private iceWallCooldown: number = 20000;
    private lastIceWall: number = 0;
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'BruxaDoGelo';
        this.name = 'Bruxa do Gelo';
        const c = CONFIG.BRUXA_DO_GELO;
        this.maxHp = c.BASE_HP * globalMultiplier;
        this.hp = this.maxHp;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.damage = 15 * globalMultiplier;
        this.position.y = 1.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        const now = Date.now();

        // Maintain distance (~8 units)
        if (dist < 5) {
            const away = this.position.clone().sub(target.position); away.y = 0; away.normalize();
            this.position.add(away.multiplyScalar(this.speed * dt));
        } else if (dist > 12) {
            this.moveTowards(target.position, dt);
        }

        // Freezing Cone: 3 icy projectiles in cone that stack freeze hits
        if (now > this.lastFreezingCone + this.freezingConeCooldown && dist < 10) {
            this.lastFreezingCone = now;
            const baseDir = target.position.clone().sub(this.position); baseDir.y = 0; baseDir.normalize();
            for (let i = -1; i <= 1; i++) {
                const dir = baseDir.clone().applyAxisAngleY(i * 0.25);
                this.pendingProjectiles.push({ dir, damage: this.damage, specialEffect: 'freezingCone' });
            }
        }

        // Blizzard AoE: damage + slow all players in radius
        if (now > this.lastBlizzard + this.blizzardCooldown) {
            this.lastBlizzard = now;
            this.pendingAbilities.push({ type: 'blizzard', x: target.position.x, z: target.position.z, radius: 6, damage: this.damage * 2, duration: 5000, slowAmount: 0.5 });
        }

        // Ice Wall: creates slow zone between witch and closest player
        if (now > this.lastIceWall + this.iceWallCooldown && dist < 15) {
            this.lastIceWall = now;
            const mid = this.position.clone().add(target.position).multiplyScalar(0.5);
            this.pendingAbilities.push({ type: 'iceWall', x: mid.x, z: mid.z, radius: 3, duration: 8000, slowAmount: 0.7 });
        }
        this.lookAt(target.position);
    }
}

/** MestraDaIlusao - Illusion Mistress */
export class MestraDaIlusaoEnemy extends ServerEnemy {
    public habilidades = {
        h1: { cooldown: 6000, lastUsed: 0, state: 'idle' as 'idle' | 'dashing' | 'returning', startPos: null as Vec3 | null, returnTimer: 0 },
        h2: { cooldown: 10000, lastUsed: 0, state: 'idle' as 'idle' | 'linking', linkTimer: 0, target: null as ServerPlayer | null },
        h3: { cooldown: 12000, lastUsed: 0 }
    };
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];
    private damageReduction = 0;

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'MestraDaIlusao';
        this.name = 'Mestra da Ilusão';
        const c = CONFIG.MESTRA_DA_ILUSAO;
        this.maxHp = c.BASE_HP * globalMultiplier;
        this.hp = this.maxHp;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.damage = 12 * globalMultiplier;
        this.position.y = 1.0;
    }

    takeDamage(amount: number, instigator?: ServerPlayer | null): void {
        const now = Date.now();
        if (now > this.habilidades.h3.lastUsed + this.habilidades.h3.cooldown) {
            this.habilidades.h3.lastUsed = now;
            this.pendingAbilities.push({ type: 'spawnClone', x: this.position.x + 1, z: this.position.z + 1 });
            this.position.x += (Math.random() * 4 - 2);
            this.position.z += (Math.random() * 4 - 2);
            return; // completely dodge the damage!
        }
        const finalDamage = amount * (1 - this.damageReduction);
        super.takeDamage(finalDamage, instigator ?? null);
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);

        this.damageReduction = (this.hp >= this.maxHp) ? 0.25 : 0;
        this.speed = (this.hp / this.maxHp < 0.5) ? this.originalSpeed * 1.25 : this.originalSpeed;

        const h1 = this.habilidades.h1;
        if (h1.state !== 'idle') {
            if (h1.state === 'dashing') {
                h1.returnTimer -= dt * 1000;
                if (h1.returnTimer <= 0) {
                    h1.state = 'returning';
                    this.pendingAbilities.push({ type: 'dashExplosion', x: this.position.x, z: this.position.z, radius: 1.5, damage: 20 + target.maxHp * 0.03 });
                }
            } else if (h1.state === 'returning' && h1.startPos) {
                const returnDir = h1.startPos.clone().sub(this.position);
                returnDir.y = 0;
                if (returnDir.lengthSq() < 1) {
                    this.position.copy(h1.startPos);
                    this.pendingAbilities.push({ type: 'dashExplosion', x: this.position.x, z: this.position.z, radius: 1.5, damage: 20 + target.maxHp * 0.03 });
                    h1.state = 'idle';
                } else {
                    this.position.add(returnDir.normalize().multiplyScalar(this.speed * 2 * dt));
                }
            }
            return;
        }

        const h2 = this.habilidades.h2;
        if (h2.state === 'linking' && h2.target) {
            const distToTarget = this.position.distanceToXZ(h2.target.position);
            if (distToTarget > 15 || h2.target.isDead) {
                h2.state = 'idle';
                h2.target = null;
            } else {
                h2.linkTimer += dt * 1000;
                if (h2.linkTimer >= 2000) {
                    h2.target.takeDamage(15 + h2.target.maxHp * 0.015, false);
                    h2.target.applyRoot(2000);
                    h2.state = 'idle';
                    h2.target = null;
                }
            }
        }

        if (now > h2.lastUsed + h2.cooldown && dist < 12 && h2.state === 'idle') {
            h2.lastUsed = now;
            h2.state = 'linking';
            h2.linkTimer = 0;
            h2.target = target;
        } else if (now > h1.lastUsed + h1.cooldown && dist < 10 && h1.state === 'idle') {
            h1.lastUsed = now;
            h1.state = 'dashing';
            h1.returnTimer = 2000;
            h1.startPos = this.position.clone();
            const dashDir = target.position.clone().sub(this.position); dashDir.y = 0; dashDir.normalize();
            this.position.add(dashDir.multiplyScalar(5));
        }

        const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
        this.position.add(dir.multiplyScalar(this.speed * dt));
        this.lookAt(target.position);
    }
}

/** BombardeiroInsano - Insane Bomber: bouncing bombs, mine field, armor fracture, burn */
export class BombardeiroInsanoEnemy extends ServerEnemy {
    private bouncingBombCooldown: number = 5000;
    private lastBouncingBomb: number = 0;
    private mineFieldCooldown: number = 20000;
    private lastMineField: number = 0;
    private armorFractureCooldown: number = 12000;
    private lastArmorFracture: number = 0;
    private attackCooldown: number = 3000;
    private lastAttack: number = 0;
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; explosionRadius?: number }[] = [];

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'BombardeiroInsano';
        this.name = 'Bombardeiro Insano';
        const c = CONFIG.BOMBARDEIRO_INSANO;
        this.maxHp = c.BASE_HP * globalMultiplier;
        this.hp = this.maxHp;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.damage = 35 * globalMultiplier;
        this.position.y = 1.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        const now = Date.now();

        if (dist < 6) {
            const away = this.position.clone().sub(target.position); away.y = 0; away.normalize();
            this.position.add(away.multiplyScalar(this.speed * dt));
        } else if (dist > 15) {
            this.moveTowards(target.position, dt);
        }

        // Regular attack with explosion
        if (now > this.lastAttack + this.attackCooldown && dist < 18) {
            this.lastAttack = now;
            const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
            this.pendingProjectiles.push({ dir, damage: this.damage, specialEffect: 'explosive', explosionRadius: 3 });
        }

        // Bouncing bomb: arcing projectile
        if (now > this.lastBouncingBomb + this.bouncingBombCooldown) {
            this.lastBouncingBomb = now;
            this.pendingAbilities.push({
                type: 'bouncingBomb',
                startX: this.position.x, startY: 1, startZ: this.position.z,
                targetX: target.position.x, targetZ: target.position.z,
                damage: this.damage * 2, explosionRadius: 4, burnDamage: 10, burnDuration: 5000
            });
        }

        // Mine field: place AoE mines
        if (now > this.lastMineField + this.mineFieldCooldown) {
            this.lastMineField = now;
            this.pendingAbilities.push({
                type: 'mineField', x: target.position.x, z: target.position.z,
                count: 5, radius: 8, mineDamage: this.damage * 1.5, mineRadius: 2, duration: 15000
            });
        }

        // Ultimate explosion area
        if (now > this.lastArmorFracture + this.armorFractureCooldown && dist < 15) {
            this.lastArmorFracture = now;
            this.pendingAbilities.push({
                type: 'powderKeg', x: this.position.x, z: this.position.z,
                radius: 10, damage: this.damage * 3
            });
        }
        this.lookAt(target.position);
    }
}

// ============================================================
// CloneIlusorio - illusion clone spawned by MestraDaIlusao
// Matches index.html: 3s lifetime, 1 HP, applies disorientation on hit
// ============================================================
export class CloneIlusorioEnemy extends ServerEnemy {
    public lifetime: number = 3000; // 3 seconds

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'CloneIlusorio';
        this.name = 'Clone Ilusório';
        this.maxHp = 1;
        this.hp = 1;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 0.8;
        this.position.y = 1.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        this.lifetime -= dt * 1000;
        if (this.lifetime <= 0) {
            this.isDestroyed = true;
        }
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        // Only players can damage clones (and trigger disorientation)
        if (instigator) {
            instigator.applyDisorientation(1000);
        }
        this.isDestroyed = true;
        // No XP/score for destroying clones
    }
}
