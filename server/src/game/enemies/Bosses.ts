import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

/** SuperBoss - absorbs PurpleCubes/orbs, aura pull, cone projectiles */
export class SuperBossEnemy extends ServerEnemy {
    public auraRadius: number = CONFIG.SUPER_BOSS.AURA_RADIUS;
    public pullForce: number = CONFIG.SUPER_BOSS.PULL_FORCE;
    public damageMultiplier: number = 1.5;
    public attackSpeedMultiplier: number = 1.0;
    public isAggressive: boolean = false;
    private attackCooldown: number = 1500;
    private lastAttackTime: number = 0;
    public pendingProjectiles: { dir: Vec3; damage: number }[] = [];
    public pendingAbsorptions: string[] = []; // enemy IDs to absorb

    constructor(pos: Vec3, globalMult: number, hpOverride?: number, damageMult = 1) {
        super(pos);
        this.type = 'SuperBoss'; this.name = 'Super Boss';
        const c = CONFIG.SUPER_BOSS;
        this.maxHp = (hpOverride || this.getRegHp(c.BASE_HP)) * globalMult; this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMult * damageMult;
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE); this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 3;
    }

    getDamageForTarget(target: ServerPlayer): number {
        return (this.damage * this.damageMultiplier) + (target.maxHp * 0.10);
    }

    absorbCube(hpBonus: number): void {
        this.maxHp += hpBonus; this.hp += hpBonus; this.checkAggression();
    }
    absorbXpOrb(): void { this.damageMultiplier += 0.005; this.checkAggression(); }
    absorbHealingOrb(): void {
        this.attackSpeedMultiplier += 0.003;
        this.attackCooldown = 5000 / this.attackSpeedMultiplier;
        this.checkAggression();
    }
    checkAggression(): void {
        if (!this.isAggressive && (this.damageMultiplier > 1.1 || this.attackSpeedMultiplier > 1.05)) {
            this.isAggressive = true;
        }
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        // Move towards target
        this.moveTowards(target.position, dt);
        this.lookAt(target.position);
        // Attack: 5 projectiles in cone
        const now = Date.now();
        if (now > this.lastAttackTime + this.attackCooldown) {
            this.lastAttackTime = now;
            const baseDir = target.position.clone().sub(this.position); baseDir.y = 0; baseDir.normalize();
            const cone = Math.PI / 6;
            for (let i = 0; i < 5; i++) {
                const off = (i - 2) * (cone / 4);
                this.pendingProjectiles.push({ dir: baseDir.clone().applyAxisAngleY(off), damage: this.getDamageForTarget(target) });
            }
        }
    }
}

/** Gangplank - musket, powder kegs, rum heal, cannon salvo, incendiary passive */
export class GangplankEnemy extends ServerEnemy {
    private habilidades = {
        q: { cooldown: 2000, lastUsed: 0 },
        e: { cooldown: 4000, lastUsed: 0 },
        w: { cooldown: 0, lastUsed: 0, used: false },
        r: { cooldown: 10000, lastUsed: 0 },
    };
    private passiva = { cooldown: 2000, timer: 1000, isReady: true };
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3, globalMult: number) {
        super(pos);
        this.type = 'Gangplank'; this.name = 'Gangplank';
        const c = CONFIG.GANGPLANK;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMult; this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMult;
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE); this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.25;
    }

    getDmg(type: string, target: ServerPlayer): number {
        switch (type) {
            case 'q': return this.damage + (target.hp * 0.05);
            case 'e': return 80 + (this.damage * 0.15);
            case 'r': return 60 + (target.hp * 0.10);
            default: return this.damage + (target.maxHp * 0.05);
        }
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        // Passive timer
        if (!this.passiva.isReady) { this.passiva.timer -= ms; if (this.passiva.timer <= 0) this.passiva.isReady = true; }
        this.lookAt(target.position);

        if (now > this.habilidades.r.lastUsed + this.habilidades.r.cooldown) {
            this.usarSalvaDeCanhoes(target);
        } else if (this.hp / this.maxHp < 0.5 && !this.habilidades.w.used) {
            this.usarRumCurador();
        } else if (dist <= 15 && now > this.habilidades.e.lastUsed + this.habilidades.e.cooldown) {
            this.usarBarril(target);
        } else if (dist > 20 && now > this.habilidades.q.lastUsed + this.habilidades.q.cooldown) {
            this.usarMosquete(target);
        } else {
            this.moveTowards(target.position, dt);
        }
    }

    usarMosquete(target: ServerPlayer): void {
        this.habilidades.q.lastUsed = Date.now();
        const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
        let fx: string | undefined;
        if (this.isMarked) { this.damage *= 1.5; this.unmark(); }

        if (this.passiva.isReady) { this.passiva.isReady = false; this.passiva.timer = this.passiva.cooldown; fx = 'tiroIncendiario'; }
        this.pendingProjectiles.push({ dir, damage: this.getDmg('q', target), specialEffect: fx });
    }

    usarBarril(target: ServerPlayer): void {
        this.habilidades.e.lastUsed = Date.now();
        const fwd = target.position.clone().sub(this.position); fwd.y = 0; fwd.normalize();
        const barrelPos = this.position.clone().add(fwd.multiplyScalar(5));
        this.pendingAbilities.push({ type: 'powderKeg', x: barrelPos.x, z: barrelPos.z, damage: this.getDmg('e', target), armorFractureDuration: 4000, armorFractureAmount: 0.20 });
    }

    usarRumCurador(): void {
        this.habilidades.w.used = true;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.20);
        this.statusManager.removeStatus('slowed'); this.speed = this.originalSpeed;

    }

    usarSalvaDeCanhoes(target: ServerPlayer): void {
        this.habilidades.r.lastUsed = Date.now();
        this.pendingAbilities.push({
            type: 'cannonSalvo', x: target.position.x, z: target.position.z,
            areaSize: 7, damage: this.getDmg('r', target), slowDuration: 2000, slowAmount: 0.40,
            delayMs: 2000, salvos: 3, salvoInterval: 500
        });
    }
}

/** RainhaDasTrevas - shadow prison, tormenting flames, soul shield, dark devastation */
export class RainhaDasTrevasEnemy extends ServerEnemy {
    public baseDamage: number;
    private habilidades = {
        prisaoSombria: { cooldown: 8000, lastUsed: 0 },
        chamasAtormentadas: { cooldown: 10000, lastUsed: 0 },
        escudoDasAlmas: { cooldown: 12000, lastUsed: 0, isActive: false, timer: 0, duration: 5000 },
        devastacaoSombria: { cooldown: 20000, lastUsed: 0, isCharging: false, chargeTimer: 0, chargeDuration: 1500 },
    };
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number }[] = [];
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3, globalMult: number, playerMaxHp: number) {
        super(pos);
        this.type = 'RainhaDasTrevas'; this.name = 'Rainha das Trevas';
        const c = CONFIG.RAINHA_DAS_TREVAS;
        this.maxHp = this.getRegHp(c.BASE_HP) + (playerMaxHp * 0.5); this.hp = this.maxHp;
        this.baseDamage = 75 + (playerMaxHp * 0.1); this.damage = this.getRegDamage(c.BASE_DAMAGE);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE); this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        const h = this.habilidades;

        if (h.escudoDasAlmas.isActive) {
            h.escudoDasAlmas.timer -= ms;
            if (h.escudoDasAlmas.timer <= 0) { h.escudoDasAlmas.isActive = false; this.speed = this.originalSpeed; }
        }
        if (h.devastacaoSombria.isCharging) {
            h.devastacaoSombria.chargeTimer -= ms;
            if (h.devastacaoSombria.chargeTimer <= 0) {
                h.devastacaoSombria.isCharging = false;
                this.pendingAbilities.push({ type: 'devastation', x: this.position.x, z: this.position.z, radius: 5.5, hpPercent: 0.30, stunDuration: 1500 });
            }
            return;
        }
        if (dist < 6 && now > h.devastacaoSombria.lastUsed + h.devastacaoSombria.cooldown) {
            h.devastacaoSombria.lastUsed = now; h.devastacaoSombria.isCharging = true; h.devastacaoSombria.chargeTimer = h.devastacaoSombria.chargeDuration;
        } else if (now > h.escudoDasAlmas.lastUsed + h.escudoDasAlmas.cooldown && !h.escudoDasAlmas.isActive) {
            h.escudoDasAlmas.lastUsed = now; h.escudoDasAlmas.isActive = true; h.escudoDasAlmas.timer = h.escudoDasAlmas.duration;
            this.speed = this.originalSpeed * 2.30;
        } else if (dist < 15 && now > h.chamasAtormentadas.lastUsed + h.chamasAtormentadas.cooldown) {
            h.chamasAtormentadas.lastUsed = now;
            this.pendingAbilities.push({ type: 'tormentFlames', x: target.position.x, z: target.position.z, radius: 3, duration: 4000, damagePerSec: 5 + (target.maxHp * 0.02) });
        } else if (dist < 25 && now > h.prisaoSombria.lastUsed + h.prisaoSombria.cooldown) {
            h.prisaoSombria.lastUsed = now;
            const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
            this.pendingProjectiles.push({ dir, damage: target.maxHp * 0.15, specialEffect: 'prisao', speed: 20 });
        }
        this.moveTowards(target.position, dt);
        this.lookAt(target.position);
    }
}
