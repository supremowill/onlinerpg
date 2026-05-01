"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerEnemy = void 0;
const uuid_1 = require("uuid");
/**
 * Base Enemy class - mirrors client Enemy with all status/knockback mechanics
 */
class ServerEnemy {
    id = (0, uuid_1.v4)();
    type = 'enemy';
    name = 'Enemy';
    position;
    rotationY = 0;
    hp;
    maxHp;
    damage = 0;
    speed = 0;
    originalSpeed = 0;
    xp = 0;
    score = 0;
    hitboxRadius = 0.5;
    isDestroyed = false;
    isInvulnerable = false;
    // Status
    status = {
        slowTimer: 0,
        isMarked: false,
        knockback: null,
    };
    constructor(position) {
        this.position = position.clone();
        this.hp = 100;
        this.maxHp = 100;
    }
    applyGlobalBuff(multiplier) {
        if (this.isDestroyed)
            return;
        const ratio = this.hp / this.maxHp;
        this.maxHp *= multiplier;
        this.hp = this.maxHp * ratio;
        if (this.damage)
            this.damage *= multiplier;
    }
    applySlow(duration, amount = 0.5) {
        this.status.slowTimer = duration;
        this.speed = this.originalSpeed * amount;
    }
    applyKnockback(direction, force) {
        this.status.knockback = { dir: direction.clone(), force };
    }
    takeDamage(amount, instigator, countsForPassive = true) {
        if (this.isDestroyed || this.isInvulnerable)
            return;
        if (instigator) {
            // Essência Negra lifesteal
            const essencia = instigator.timedBuffs.find(b => b.type === 'essencia_negra');
            if (essencia)
                instigator.heal(amount * essencia.effects.lifesteal);
            // Lâmina da Geada bonus
            const lamina = instigator.timedBuffs.find(b => b.type === 'lamina_geada_buff');
            if (lamina) {
                amount += lamina.effects.bonus_damage;
                this.applySlow(500, 0.5);
            }
        }
        if (this.status.isMarked) {
            amount *= 1.5;
            this.status.isMarked = false;
        }
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDestroyed = true;
        }
        if (instigator && countsForPassive) {
            instigator.attackHitCounter++;
            if (instigator.attackHitCounter >= 3) {
                instigator.attackHitCounter = 0;
                // Passive explosion — handled by GameEngine
            }
        }
    }
    updateStatus(dt) {
        if (this.status.slowTimer > 0) {
            this.status.slowTimer -= dt * 1000;
            if (this.status.slowTimer <= 0)
                this.speed = this.originalSpeed;
        }
        if (this.status.knockback) {
            this.position.add(this.status.knockback.dir.clone().multiplyScalar(this.status.knockback.force * dt));
            this.status.knockback.force *= 0.95;
            if (this.status.knockback.force < 1)
                this.status.knockback = null;
            return true; // skip AI while knocked back
        }
        return false;
    }
    update(dt, players, gameTime) {
        // Override in subclasses
    }
    /** Find closest alive player */
    getClosestPlayer(players) {
        let closest = null;
        let closestDist = Infinity;
        for (const p of players) {
            if (p.isDead)
                continue;
            const d = this.position.distanceToXZ(p.position);
            if (d < closestDist) {
                closestDist = d;
                closest = p;
            }
        }
        return closest;
    }
    /** Get random alive player */
    getRandomPlayer(players) {
        const alive = players.filter(p => !p.isDead);
        if (alive.length === 0)
            return null;
        return alive[Math.floor(Math.random() * alive.length)];
    }
    lookAt(target) {
        this.rotationY = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    }
    moveTowards(target, dt, speed) {
        const dir = target.clone().sub(this.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.01) {
            dir.normalize().multiplyScalar((speed ?? this.speed) * dt);
            this.position.add(dir);
        }
    }
    toSnapshot() {
        return {
            id: this.id,
            type: this.type,
            x: this.position.x,
            y: this.position.y,
            z: this.position.z,
            rotY: this.rotationY,
            hp: this.hp,
            maxHp: this.maxHp,
            name: this.name,
            isInvulnerable: this.isInvulnerable || undefined,
        };
    }
}
exports.ServerEnemy = ServerEnemy;
//# sourceMappingURL=Enemy.js.map