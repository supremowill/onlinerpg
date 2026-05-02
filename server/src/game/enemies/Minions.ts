import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';

export interface ShieldState {
    isActive: boolean;
    hp: number;
    timer: number;
}

// ============================================================
// AlmaAmaldicoada - orbits around FeiticeiroImortal
// ============================================================
export class AlmaAmaldicoadaEnemy extends ServerEnemy {
    public ownerId: string;
    private angularSpeed = 0.5;

    constructor(pos: Vec3, ownerId: string, globalMult: number) {
        super(pos);
        this.type = 'AlmaAmaldicoada';
        this.name = 'Alma Amaldicoada';
        this.maxHp = 500 * globalMult;
        this.hp = this.maxHp;
        this.damage = 0;
        this.speed = 3;
        this.originalSpeed = 3;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 0.5;
        this.ownerId = ownerId;
        this.position.y = 1;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (target) this.lookAt(target.position);
    }

    updateOrbit(ownerPos: Vec3, gameTime: number): void {
        const angle = gameTime * this.angularSpeed;
        this.position.x = ownerPos.x + Math.cos(angle) * 4;
        this.position.z = ownerPos.z + Math.sin(angle) * 4;
        this.position.y = ownerPos.y + Math.sin(angle * 2) * 1.5;
        this.lookAt(ownerPos);
    }
}

// ============================================================
// CaveiraExplosiva - suicidal skull, explodes on contact or timeout
// ============================================================
export class CaveiraExplosivaEnemy extends ServerEnemy {
    public lifetime: number = 8000;
    public explosionRadius = 2;
    public pendingExplosion = false;

    constructor(pos: Vec3, damage: number, globalMult: number) {
        super(pos);
        this.type = 'CaveiraExplosiva';
        this.name = 'Caveira Explosiva';
        this.maxHp = 1;
        this.hp = 1;
        this.damage = damage;
        this.speed = 4;
        this.originalSpeed = 4;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 0.4;
        this.lifetime = 8000;
        this.position.y = 0.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        if (this.updateStatus(dt)) return;

        this.lifetime -= dt * 1000;
        if (this.lifetime <= 0) {
            this.isDestroyed = true;
            this.pendingExplosion = true;
            return;
        }

        const target = this.getClosestPlayer(players);
        if (!target) return;

        this.moveTowards(target.position, dt);
        this.lookAt(target.position);

        if (this.position.distanceToXZ(target.position) < this.hitboxRadius + 0.5) {
            target.takeDamage(this.damage);
            this.isDestroyed = true;
            this.pendingExplosion = true;
        }
    }
}

// ============================================================
// EspectroSombrio - ghost of a dead enemy, 30% stats, 10s lifetime
// ============================================================
export class EspectroSombrioEnemy extends ServerEnemy {
    public lifetime: number = 10000;

    constructor(pos: Vec3, origHp: number, origDmg: number, origSpd: number, globalMult: number) {
        super(pos);
        this.type = 'EspectroSombrio';
        this.name = 'Espectro Sombrio';
        this.maxHp = origHp * 0.3 * globalMult;
        this.hp = this.maxHp;
        this.damage = origDmg * 0.3;
        this.speed = origSpd * 1.1;
        this.originalSpeed = this.speed;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 0.5;
        this.lifetime = 10000;
        this.position.y = 0.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        if (this.updateStatus(dt)) return;

        this.lifetime -= dt * 1000;
        if (this.lifetime <= 0) {
            this.isDestroyed = true;
            return;
        }

        const target = this.getClosestPlayer(players);
        if (!target) return;

        this.moveTowards(target.position, dt);
        this.lookAt(target.position);

        if (this.position.distanceToXZ(target.position) < this.hitboxRadius + 0.5) {
            target.takeDamage(this.damage);
            this.isDestroyed = true;
        }
    }
}

// ============================================================
// FilhoteCao - hellhound pup, supports parent's shield
// ============================================================
export class FilhoteCaoEnemy extends ServerEnemy {
    public parentId: string;
    public shield: ShieldState = { isActive: false, hp: 0, timer: 0 };
    private attackRange = 1.5;
    private attackCooldown = 1500;
    private lastAttackTime = 0;
    public parentMarkActive = false;

    constructor(pos: Vec3, playerLevel: number, parentId: string, globalMult: number) {
        super(pos);
        this.type = 'FilhoteCao';
        this.name = 'Filhote do Cao';
        this.maxHp = (80 + playerLevel * 40) * 0.25 * globalMult;
        this.hp = this.maxHp;
        this.damage = (15 + playerLevel * 5) * 0.3;
        this.speed = 4.5;
        this.originalSpeed = 4.5;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 0.6;
        this.attackRange = 1.5;
        this.attackCooldown = 1500;
        this.parentId = parentId;
        this.position.y = 0.3;
    }

    applyShield(duration: number, amount: number): void {
        this.shield.isActive = true;
        this.shield.hp = amount;
        this.shield.timer = duration;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        if (this.updateStatus(dt)) return;

        if (this.shield.isActive) {
            this.shield.timer -= dt * 1000;
            if (this.shield.timer <= 0) {
                this.shield.isActive = false;
                this.shield.hp = 0;
            }
        }

        const target = this.getClosestPlayer(players);
        if (!target) return;

        const dist = this.position.distanceToXZ(target.position);
        let spd = this.originalSpeed;
        if (this.parentMarkActive) spd = this.originalSpeed * 1.5;

        if (dist > this.attackRange) {
            this.moveTowards(target.position, dt, spd);
        } else {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown) {
                this.lastAttackTime = now;
                target.takeDamage(this.damage);
            }
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (this.shield.isActive && this.shield.hp > 0) {
            const absorbed = Math.min(amount, this.shield.hp);
            this.shield.hp -= absorbed;
            amount -= absorbed;
            if (this.shield.hp <= 0) this.shield.isActive = false;
            if (amount <= 0) return;
        }
        super.takeDamage(amount, instigator, countsForPassive);
    }
}

// ============================================================
// BrotoCarnivoro - fast melee attacker spawned by PlantaCarnivora
// ============================================================
export class BrotoCarnivoroEnemy extends ServerEnemy {
    private attackRange = 1.5;
    private attackCooldown = 1800;
    private lastAttackTime = 0;

    constructor(pos: Vec3, playerLevel: number, globalMult: number) {
        super(pos);
        this.type = 'BrotoCarnivoro';
        this.name = 'Broto Carnivoro';
        this.maxHp = (150 + playerLevel * 20) * globalMult;
        this.hp = this.maxHp;
        this.damage = 25 + playerLevel * 3;
        this.speed = 3.5;
        this.originalSpeed = 3.5;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 0.6;
        this.attackRange = 1.5;
        this.attackCooldown = 1800;
        this.position.y = 0.6;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        if (this.updateStatus(dt)) return;

        const target = this.getClosestPlayer(players);
        if (!target) return;

        const dist = this.position.distanceToXZ(target.position);

        if (dist > this.attackRange) {
            this.moveTowards(target.position, dt);
        } else {
            const now = Date.now();
            if (now > this.lastAttackTime + this.attackCooldown) {
                this.lastAttackTime = now;
                target.takeDamage(this.damage);
            }
        }
        this.lookAt(target.position);
    }
}
