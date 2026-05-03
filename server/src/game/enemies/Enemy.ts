import { v4 as uuidv4 } from 'uuid';
import { Vec3 } from '../../utils/Vector3';
import { EnemySnapshot } from '../../network/Protocol';
import { ServerPlayer } from '../Player';

/**
 * Base Enemy class - mirrors client Enemy with all status/knockback mechanics
 */
export class ServerEnemy {
    public id: string = uuidv4();
    public type: string = 'enemy';
    public name: string = 'Enemy';
    public position: Vec3;
    public rotationY: number = 0;
    public hp: number;
    public maxHp: number;
    public damage: number = 0;
    public speed: number = 0;
    public originalSpeed: number = 0;
    public xp: number = 0;
    public score: number = 0;
    public hitboxRadius: number = 0.5;
    public isDestroyed: boolean = false;
    public isInvulnerable: boolean = false;

    // Status
    public status = {
        slowTimer: 0,
        isMarked: false,
        knockback: null as { dir: Vec3; force: number } | null,
    };

    constructor(position: Vec3) {
        this.position = position.clone();
        this.hp = 100;
        this.maxHp = 100;
    }

    applyGlobalBuff(multiplier: number): void {
        if (this.isDestroyed) return;
        const ratio = this.hp / this.maxHp;
        this.maxHp *= multiplier;
        this.hp = this.maxHp * ratio;
        if (this.damage) this.damage *= multiplier;
    }

    applySlow(duration: number, amount = 0.5): void {
        this.status.slowTimer = duration;
        this.speed = this.originalSpeed * amount;
    }

    applyKnockback(direction: Vec3, force: number): void {
        this.status.knockback = { dir: direction.clone(), force };
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (this.isDestroyed || this.isInvulnerable) return;

        if (instigator) {
            // Essência Negra lifesteal
            const essencia = instigator.timedBuffs.find(b => b.type === 'essencia_negra');
            if (essencia) instigator.heal(amount * essencia.effects.lifesteal);
            // Lâmina da Geada bonus
            const lamina = instigator.timedBuffs.find(b => b.type === 'lamina_geada_buff');
            if (lamina) { amount += lamina.effects.bonus_damage; this.applySlow(500, 0.5); }
        }

        if (this.status.isMarked) { amount *= 1.5; this.status.isMarked = false; }
        this.hp -= amount;
        if (this.hp <= 0) { this.hp = 0; this.isDestroyed = true; }

        if (instigator && countsForPassive) {
            instigator.attackHitCounter++;
            if (instigator.attackHitCounter >= 3) {
                instigator.attackHitCounter = 0;
                // Passive explosion — handled by GameEngine
            }
        }
    }

    updateStatus(dt: number): boolean {
        if (this.status.slowTimer > 0) {
            this.status.slowTimer -= dt * 1000;
            if (this.status.slowTimer <= 0) this.speed = this.originalSpeed;
        }
        if (this.status.knockback) {
            this.position.add(this.status.knockback.dir.clone().multiplyScalar(this.status.knockback.force * dt));
            this.status.knockback.force *= 0.95;
            if (this.status.knockback.force < 1) this.status.knockback = null;
            return true; // skip AI while knocked back
        }
        return false;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        // Override in subclasses
    }

    /** Find closest alive player */
    getClosestPlayer(players: ServerPlayer[]): ServerPlayer | null {
        let closest: ServerPlayer | null = null;
        let closestDist = Infinity;
        for (const p of players) {
            if (p.isDead) continue;
            const d = this.position.distanceToXZ(p.position);
            if (d < closestDist) { closestDist = d; closest = p; }
        }
        return closest;
    }

    /** Get random alive player */
    getRandomPlayer(players: ServerPlayer[]): ServerPlayer | null {
        const alive = players.filter(p => !p.isDead);
        if (alive.length === 0) return null;
        return alive[Math.floor(Math.random() * alive.length)];
    }

    lookAt(target: Vec3): void {
        this.rotationY = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    }

    moveTowards(target: Vec3, dt: number, speed?: number): void {
        const dir = target.clone().sub(this.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.01) {
            dir.normalize().multiplyScalar((speed ?? this.speed) * dt);
            this.position.add(dir);
        }
    }

    toSnapshot(): EnemySnapshot {
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
            sizeMultiplier: (this as any).sizeMultiplier || undefined,
        };
    }
}
