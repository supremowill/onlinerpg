"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RainhaDasTrevasEnemy = exports.GangplankEnemy = exports.SuperBossEnemy = void 0;
const Enemy_1 = require("./Enemy");
const config_1 = require("../../config");
/** SuperBoss - absorbs PurpleCubes/orbs, aura pull, cone projectiles */
class SuperBossEnemy extends Enemy_1.ServerEnemy {
    auraRadius = config_1.CONFIG.SUPER_BOSS.AURA_RADIUS;
    pullForce = config_1.CONFIG.SUPER_BOSS.PULL_FORCE;
    damageMultiplier = 1.5;
    attackSpeedMultiplier = 1.0;
    isAggressive = false;
    attackCooldown = 1500;
    lastAttackTime = 0;
    pendingProjectiles = [];
    pendingAbsorptions = []; // enemy IDs to absorb
    constructor(pos, globalMult, hpOverride, damageMult = 1) {
        super(pos);
        this.type = 'SuperBoss';
        this.name = 'Super Boss';
        const c = config_1.CONFIG.SUPER_BOSS;
        this.maxHp = (hpOverride || c.BASE_HP) * globalMult;
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMult * damageMult;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.position.y = 3;
    }
    getDamageForTarget(target) {
        return (this.damage * this.damageMultiplier) + (target.maxHp * 0.10);
    }
    absorbCube(hpBonus) {
        this.maxHp += hpBonus;
        this.hp += hpBonus;
        this.checkAggression();
    }
    absorbXpOrb() { this.damageMultiplier += 0.005; this.checkAggression(); }
    absorbHealingOrb() {
        this.attackSpeedMultiplier += 0.003;
        this.attackCooldown = 5000 / this.attackSpeedMultiplier;
        this.checkAggression();
    }
    checkAggression() {
        if (!this.isAggressive && (this.damageMultiplier > 1.1 || this.attackSpeedMultiplier > 1.05)) {
            this.isAggressive = true;
        }
    }
    update(dt, players, gameTime) {
        if (this.isDestroyed || this.updateStatus(dt))
            return;
        const target = this.getClosestPlayer(players);
        if (!target)
            return;
        // Move towards target
        this.moveTowards(target.position, dt);
        this.lookAt(target.position);
        // Attack: 5 projectiles in cone
        const now = Date.now();
        if (now > this.lastAttackTime + this.attackCooldown) {
            this.lastAttackTime = now;
            const baseDir = target.position.clone().sub(this.position);
            baseDir.y = 0;
            baseDir.normalize();
            const cone = Math.PI / 6;
            for (let i = 0; i < 5; i++) {
                const off = (i - 2) * (cone / 4);
                this.pendingProjectiles.push({ dir: baseDir.clone().applyAxisAngleY(off), damage: this.getDamageForTarget(target) });
            }
        }
    }
}
exports.SuperBossEnemy = SuperBossEnemy;
/** Gangplank - musket, powder kegs, rum heal, cannon salvo, incendiary passive */
class GangplankEnemy extends Enemy_1.ServerEnemy {
    baseMaxHp;
    baseDamage;
    habilidades = {
        q: { cooldown: 2000, lastUsed: 0 },
        e: { cooldown: 4000, lastUsed: 0 },
        w: { cooldown: 0, lastUsed: 0, used: false },
        r: { cooldown: 10000, lastUsed: 0 },
    };
    passiva = { cooldown: 2000, timer: 1000, isReady: true };
    pendingProjectiles = [];
    pendingAbilities = [];
    constructor(pos, globalMult) {
        super(pos);
        this.type = 'Gangplank';
        this.name = 'Gangplank';
        const c = config_1.CONFIG.GANGPLANK;
        this.baseMaxHp = c.BASE_HP;
        this.maxHp = c.BASE_HP * globalMult;
        this.hp = this.maxHp;
        this.baseDamage = c.BASE_DAMAGE * globalMult;
        this.damage = this.baseDamage;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.position.y = 1.25;
    }
    getDmg(type, target) {
        switch (type) {
            case 'q': return this.baseDamage + (target.hp * 0.05);
            case 'e': return 80 + (this.baseDamage * 0.15);
            case 'r': return 60 + (target.hp * 0.10);
            default: return this.baseDamage + (target.maxHp * 0.05);
        }
    }
    update(dt, players, gameTime) {
        if (this.isDestroyed || this.updateStatus(dt))
            return;
        const target = this.getClosestPlayer(players);
        if (!target)
            return;
        const now = Date.now();
        const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        // Scale HP over time
        this.maxHp = this.baseMaxHp + (this.baseMaxHp * 0.15 * Math.floor(gameTime / 120));
        // Passive timer
        if (!this.passiva.isReady) {
            this.passiva.timer -= ms;
            if (this.passiva.timer <= 0)
                this.passiva.isReady = true;
        }
        this.lookAt(target.position);
        if (now > this.habilidades.r.lastUsed + this.habilidades.r.cooldown) {
            this.usarSalvaDeCanhoes(target);
        }
        else if (this.hp / this.maxHp < 0.5 && !this.habilidades.w.used) {
            this.usarRumCurador();
        }
        else if (dist <= 15 && now > this.habilidades.e.lastUsed + this.habilidades.e.cooldown) {
            this.usarBarril(target);
        }
        else if (dist > 20 && now > this.habilidades.q.lastUsed + this.habilidades.q.cooldown) {
            this.usarMosquete(target);
        }
        else {
            this.moveTowards(target.position, dt);
        }
    }
    usarMosquete(target) {
        this.habilidades.q.lastUsed = Date.now();
        const dir = target.position.clone().sub(this.position);
        dir.y = 0;
        dir.normalize();
        let fx;
        if (this.passiva.isReady) {
            this.passiva.isReady = false;
            this.passiva.timer = this.passiva.cooldown;
            fx = 'tiroIncendiario';
        }
        this.pendingProjectiles.push({ dir, damage: this.getDmg('q', target), specialEffect: fx });
    }
    usarBarril(target) {
        this.habilidades.e.lastUsed = Date.now();
        const fwd = target.position.clone().sub(this.position);
        fwd.y = 0;
        fwd.normalize();
        const barrelPos = this.position.clone().add(fwd.multiplyScalar(5));
        this.pendingAbilities.push({ type: 'powderKeg', x: barrelPos.x, z: barrelPos.z, damage: this.getDmg('e', target), armorFractureDuration: 4000, armorFractureAmount: 0.20 });
    }
    usarRumCurador() {
        this.habilidades.w.used = true;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.20);
        this.status.slowTimer = 0;
        this.speed = this.originalSpeed;
    }
    usarSalvaDeCanhoes(target) {
        this.habilidades.r.lastUsed = Date.now();
        this.pendingAbilities.push({
            type: 'cannonSalvo', x: target.position.x, z: target.position.z,
            areaSize: 7, damage: this.getDmg('r', target), slowDuration: 2000, slowAmount: 0.40,
            delayMs: 2000, salvos: 3, salvoInterval: 500
        });
    }
}
exports.GangplankEnemy = GangplankEnemy;
/** RainhaDasTrevas - shadow prison, tormenting flames, soul shield, dark devastation */
class RainhaDasTrevasEnemy extends Enemy_1.ServerEnemy {
    baseDamage;
    habilidades = {
        prisaoSombria: { cooldown: 8000, lastUsed: 0 },
        chamasAtormentadas: { cooldown: 10000, lastUsed: 0 },
        escudoDasAlmas: { cooldown: 12000, lastUsed: 0, isActive: false, timer: 0, duration: 5000 },
        devastacaoSombria: { cooldown: 20000, lastUsed: 0, isCharging: false, chargeTimer: 0, chargeDuration: 1500 },
    };
    pendingProjectiles = [];
    pendingAbilities = [];
    constructor(pos, globalMult, playerMaxHp) {
        super(pos);
        this.type = 'RainhaDasTrevas';
        this.name = 'Rainha das Trevas';
        const c = config_1.CONFIG.RAINHA_DAS_TREVAS;
        this.maxHp = c.BASE_HP + (playerMaxHp * 0.5);
        this.hp = this.maxHp;
        this.baseDamage = 75 + (playerMaxHp * 0.1);
        this.damage = c.BASE_DAMAGE;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.position.y = 1.5;
    }
    update(dt, players, gameTime) {
        if (this.isDestroyed || this.updateStatus(dt))
            return;
        const target = this.getClosestPlayer(players);
        if (!target)
            return;
        const now = Date.now();
        const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        const h = this.habilidades;
        if (h.escudoDasAlmas.isActive) {
            h.escudoDasAlmas.timer -= ms;
            if (h.escudoDasAlmas.timer <= 0) {
                h.escudoDasAlmas.isActive = false;
                this.speed = this.originalSpeed;
            }
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
            h.devastacaoSombria.lastUsed = now;
            h.devastacaoSombria.isCharging = true;
            h.devastacaoSombria.chargeTimer = h.devastacaoSombria.chargeDuration;
        }
        else if (now > h.escudoDasAlmas.lastUsed + h.escudoDasAlmas.cooldown && !h.escudoDasAlmas.isActive) {
            h.escudoDasAlmas.lastUsed = now;
            h.escudoDasAlmas.isActive = true;
            h.escudoDasAlmas.timer = h.escudoDasAlmas.duration;
            this.speed = this.originalSpeed * 2.30;
        }
        else if (dist < 15 && now > h.chamasAtormentadas.lastUsed + h.chamasAtormentadas.cooldown) {
            h.chamasAtormentadas.lastUsed = now;
            this.pendingAbilities.push({ type: 'tormentFlames', x: target.position.x, z: target.position.z, radius: 3, duration: 4000, damagePerSec: 5 + (target.maxHp * 0.02) });
        }
        else if (dist < 25 && now > h.prisaoSombria.lastUsed + h.prisaoSombria.cooldown) {
            h.prisaoSombria.lastUsed = now;
            const dir = target.position.clone().sub(this.position);
            dir.y = 0;
            dir.normalize();
            this.pendingProjectiles.push({ dir, damage: target.maxHp * 0.15, specialEffect: 'prisao', speed: 20 });
        }
        this.moveTowards(target.position, dt);
        this.lookAt(target.position);
    }
}
exports.RainhaDasTrevasEnemy = RainhaDasTrevasEnemy;
//# sourceMappingURL=Bosses.js.map