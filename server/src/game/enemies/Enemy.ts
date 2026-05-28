import { v4 as uuidv4 } from 'uuid';
import { Vec3 } from '../../utils/Vector3';
import { EnemySnapshot } from '../../network/Protocol';
import { ServerPlayer } from '../Player';
import { EnemyRegistry } from '../../data/EnemyRegistry';

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
    public sizeMultiplier: number = 1.0;
    public damageMultiplier: number = 1.0;
    public lastDamageTaken: number = 0;
    public killer: ServerPlayer | null = null;
    public lastDamagedBy: ServerPlayer | null = null;
    public deathProcessed: boolean = false;
    protected _defense: number = 0;

    get defense(): number {
        if (this._defense > 0) return this._defense;
        const def = EnemyRegistry.get(this.type);
        if (def && def.stats.defense !== undefined) {
            const raw = def.stats.defense;
            if (raw > 0) {
                if (raw <= 1.0) {
                    return Math.round((750 * raw) / (1 - raw));
                }
                return raw;
            }
        }
        return 0;
    }

    set defense(val: number) {
        this._defense = val;
    }

    getRegHp(fallback: number): number {
        return EnemyRegistry.get(this.type)?.stats.hp ?? fallback;
    }
    getRegDamage(fallback: number): number {
        return EnemyRegistry.get(this.type)?.stats.damage ?? fallback;
    }
    getRegSpeed(fallback: number): number {
        return EnemyRegistry.get(this.type)?.stats.speed ?? fallback;
    }
    getRegXp(fallback: number): number {
        return EnemyRegistry.get(this.type)?.stats.xp ?? fallback;
    }
    getRegScore(fallback: number): number {
        return EnemyRegistry.get(this.type)?.stats.score ?? fallback;
    }
    getRegHitbox(fallback: number): number {
        return EnemyRegistry.get(this.type)?.stats.hitboxRadius ?? fallback;
    }

    public poisonStacks = 0;
    public poisonTimer = 0; // remaining time in ms
    public poisonInstigator: ServerPlayer | null = null;
    public poisonTickTimer = 0;
    public blindedTimer = 0;
    public slowAmount = 1.0;

    // Status
    public status = {
        slowTimer: 0,
        isMarked: false,
        knockback: null as { dir: Vec3; force: number } | null,
        bleeding: { isActive: false, timer: 0, damage: 0, lastTick: 0, tickInterval: 1000 },
        armorFracture: { isActive: false, timer: 0, amount: 0 },
        silenced: { isActive: false, timer: 0 },
        disoriented: { isActive: false, timer: 0 },
        stunned: { isActive: false, timer: 0 },
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

    applyBleed(duration: number, damage: number): void {
        const b = this.status.bleeding;
        b.isActive = true;
        b.timer = Math.max(b.timer, duration);
        b.damage = damage;
        b.lastTick = Date.now();
    }

    applyKnockback(direction: Vec3, force: number): void {
        this.status.knockback = { dir: direction.clone(), force };
    }

    applyArmorFracture(duration: number, amount: number): void {
        const f = this.status.armorFracture;
        f.isActive = true;
        f.timer = Math.max(f.timer, duration);
        f.amount = Math.max(f.amount, amount);
    }

    applySilence(duration: number): void {
        this.status.silenced.isActive = true;
        this.status.silenced.timer = Math.max(this.status.silenced.timer, duration);
    }

    applyDisorientation(duration: number): void {
        this.status.disoriented.isActive = true;
        this.status.disoriented.timer = Math.max(this.status.disoriented.timer, duration);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false): void {
        if (this.isDestroyed || this.isInvulnerable) return;

        if (instigator) {
            // Incapacidade pathogen check: 10% * stacks chance to fail attack
            const incapacidade = instigator.pathogens['incapacidade'];
            if (incapacidade && Math.random() < 0.10 * incapacidade.stacks) {
                amount = 0;
            }

            // Essência Negra lifesteal
            const essencia = instigator.timedBuffs.find(b => b.type === 'essencia_negra');
            if (essencia && amount > 0) instigator.heal(amount * essencia.effects.lifesteal);
            // Lâmina da Geada bonus
            const lamina = instigator.timedBuffs.find(b => b.type === 'lamina_geada_buff');
            if (lamina && amount > 0) { amount += lamina.effects.bonus_damage; this.applySlow(500, 0.5); }

            this.lastDamagedBy = instigator;
        }

        // Step 1 - Dano Base
        const danoBase = amount + (this.maxHp * hpPercent);

        // Step 2 - Flutuação de Dano (RNG)
        const rng = 0.9 + Math.random() * 0.2;
        let fd = danoBase * rng;

        // Foco Infeccioso (+20% direct damage on envenomed targets)
        if (instigator && instigator.build && instigator.build.buildingColor === 'poison') {
            if (instigator.build.floor3 === 2 && this.poisonStacks > 0) {
                fd *= 1.20;
            }
        }

        // Step 3 - Fator de Mitigação (Armadura)
        if (!isTrueDamage) {
            let defenseTotal = this.defense || 0;
            if (instigator && instigator.armorPenetrationPct > 0) {
                defenseTotal = defenseTotal * (1 - instigator.armorPenetrationPct);
            }
            defenseTotal = Math.max(0, Math.min(500, defenseTotal)); // Hard Cap is 500
            const fatorReducao = defenseTotal / (defenseTotal + 750);
            fd = fd * (1 - fatorReducao);
        }

        // Step 4 - Dano Final
        if (this.status.isMarked) { fd *= 1.5; this.status.isMarked = false; }
        
        // Armor Fracture logic
        if (this.status.armorFracture.isActive) {
            fd *= (1 + this.status.armorFracture.amount);
        }

        const finalDamage = Math.round(fd);
        this.lastDamageTaken = finalDamage;

        this.hp -= finalDamage;
        if (this.hp <= 0) {
            this.hp = 0;
            if (!this.isDestroyed) {
                this.isDestroyed = true;
                this.killer = instigator || this.lastDamagedBy;
            }
        }

        if (instigator && countsForPassive) {
            instigator.attackHitCounter++;
            if (instigator.attackHitCounter >= 3) {
                instigator.attackHitCounter = 0;
                // Passive explosion — handled by GameEngine
            }
        }
    }

    updateStatus(dt: number): boolean {
        const now = Date.now();
        if (this.status.bleeding.isActive) {
            this.status.bleeding.timer -= dt * 1000;
            if (this.status.bleeding.timer <= 0) {
                this.status.bleeding.isActive = false;
            } else if (now > this.status.bleeding.lastTick + this.status.bleeding.tickInterval) {
                this.status.bleeding.lastTick = now;
                this.takeDamage(this.status.bleeding.damage, null, false);
            }
        }

        // Blind ticking
        if (this.blindedTimer > 0) {
            this.blindedTimer -= dt * 1000;
        }

        // Stun ticking
        if (this.status.stunned.isActive) {
            this.status.stunned.timer -= dt * 1000;
            if (this.status.stunned.timer <= 0) {
                this.status.stunned.isActive = false;
            } else {
                return true; // Skip normal AI movement/attacks while stunned
            }
        }

        // Dynamic speed calculation combining slow and Toxina Paralisante (5 stacks = 30% slow)
        let speedMult = 1.0;
        if (this.status.slowTimer > 0) {
            this.status.slowTimer -= dt * 1000;
            if (this.status.slowTimer <= 0) {
                this.slowAmount = 1.0;
            } else {
                speedMult *= this.slowAmount;
            }
        }
        if (this.poisonStacks === 5 && this.poisonInstigator && this.poisonInstigator.build && this.poisonInstigator.build.buildingColor === 'poison') {
            if (this.poisonInstigator.build.floor3 === 1) { // Toxina Paralisante
                speedMult *= 0.70; // 30% slow
            }
        }
        this.speed = this.originalSpeed * speedMult;

        // Poison DoT ticking
        if (this.poisonStacks > 0) {
            this.poisonTimer -= dt * 1000;
            if (this.poisonTimer <= 0) {
                this.poisonStacks = 0;
                this.poisonInstigator = null;
            } else {
                this.poisonTickTimer += dt;
                if (this.poisonTickTimer >= 1.0) {
                    this.poisonTickTimer -= 1.0;
                    const level = this.poisonInstigator ? this.poisonInstigator.level : 1;
                    const basePoisonDmg = 10 + level * 2;
                    const finalDmg = basePoisonDmg * this.poisonStacks;
                    this.takeDamage(finalDmg, this.poisonInstigator, false);
                    
                    const engine = (global as any).__gameEngine;
                    if (engine) {
                        const isBoss = ['LichKing','TheMightyOne','Gangplank','RainhaDasTrevas',
                            'PlantaCarnivora','FeiticeiroImortal','SuperBoss','CaoDosInfernos','Farao',
                            'GuardiãoDoLimbo','Minos','Cerbero','Plutão','Fúria','Megera','Minotauro',
                            'Geriao','Lúcifer','EspectroDeRaziel','Smith'].includes(this.type);
                        engine.pendingEvents.push({
                            event: 'HIT_NUMBER',
                            data: {
                                targetId: this.id,
                                x: this.position.x,
                                y: isBoss ? 3.5 : 1.5,
                                z: this.position.z,
                                value: finalDmg,
                                type: 'TOXIC'
                            }
                        });
                    }
                }
            }
        }

        if (this.status.armorFracture.isActive) {
            this.status.armorFracture.timer -= dt * 1000;
            if (this.status.armorFracture.timer <= 0) this.status.armorFracture.isActive = false;
        }

        if (this.status.silenced.isActive) {
            this.status.silenced.timer -= dt * 1000;
            if (this.status.silenced.timer <= 0) this.status.silenced.isActive = false;
        }

        if (this.status.disoriented.isActive) {
            this.status.disoriented.timer -= dt * 1000;
            if (this.status.disoriented.timer <= 0) {
                this.status.disoriented.isActive = false;
            } else {
                const angle = (now * 0.005) + (parseInt(this.id.substring(0, 4), 16) % 100);
                const dir = new Vec3(Math.cos(angle), 0, Math.sin(angle));
                this.position.add(dir.multiplyScalar(this.speed * dt));
                return true;
            }
        }

        if (this.status.knockback) {
            this.position.add(this.status.knockback.dir.clone().multiplyScalar(this.status.knockback.force * dt));
            this.status.knockback.force *= 0.95;
            if (this.status.knockback.force < 1) this.status.knockback = null;
            return true;
        }
        return false;
    }

    applyStun(duration: number): void {
        this.status.stunned.isActive = true;
        this.status.stunned.timer = Math.max(this.status.stunned.timer, duration);
    }

    addPoison(amount: number, instigator: ServerPlayer | null): void {
        this.poisonInstigator = instigator;
        this.poisonTimer = 3000; // resets duration to 3s
        
        let contaminationEnabled = false;
        if (instigator && instigator.build && instigator.build.buildingColor === 'poison') {
            if (instigator.build.floor4 === 0) { // Contaminação
                contaminationEnabled = true;
            }
        }
        
        const nextStacks = this.poisonStacks + amount;
        if (contaminationEnabled && nextStacks >= 6) {
            // DETONATE!
            const level = instigator ? instigator.level : 1;
            const detonateDmg = (15 + level * 5) * 8; // Explosive damage scaling with level
            this.takeDamage(detonateDmg, instigator, false);
            this.poisonStacks = 0;
            this.poisonTimer = 0;
            
            const engine = (global as any).__gameEngine;
            if (engine) {
                const isBoss = ['LichKing','TheMightyOne','Gangplank','RainhaDasTrevas',
                    'PlantaCarnivora','FeiticeiroImortal','SuperBoss','CaoDosInfernos','Farao',
                    'GuardiãoDoLimbo','Minos','Cerbero','Plutão','Fúria','Megera','Minotauro',
                    'Geriao','Lúcifer','EspectroDeRaziel','Smith'].includes(this.type);
                engine.pendingEvents.push({
                    event: 'HIT_NUMBER',
                    data: {
                        targetId: this.id,
                        x: this.position.x,
                        y: isBoss ? 3.5 : 1.5,
                        z: this.position.z,
                        value: detonateDmg,
                        type: 'CRIT'
                    }
                });
                
                // Spawn a visual explosion zone
                engine.zones.push({
                    id: `zone_${engine.zoneIdCounter++}`,
                    type: 'explosion',
                    position: this.position.clone(),
                    radius: 3.0,
                    duration: 400,
                    timer: 400,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: instigator?.id, burst: true }
                });
            }
        } else {
            this.poisonStacks = Math.min(nextStacks, 5);
        }
    }

    canUseAbility(): boolean {
        return !this.status.silenced.isActive && !this.status.disoriented.isActive;
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
