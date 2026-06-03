import { v4 as uuidv4 } from 'uuid';
import { Vec3 } from '../../utils/Vector3';
import { EnemySnapshot } from '../../network/Protocol';
import { ServerPlayer } from '../Player';
import { EnemyRegistry } from '../../data/EnemyRegistry';
import { StatusManager } from '../status/StatusManager';

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
    public baseStatsCaptured: boolean = false;
    public baseMaxHp: number = 0;
    public baseDamage: number = 0;
    public baseDefense: number = 0;
    public baseSpeed: number = 0;
    public baseXp: number = 0;
    public baseScore: number = 0;
    public lastThreatSignature: string = '';
    protected _defense: number = 0;
    protected _hasDefenseOverride: boolean = false;

    // ── Centralised Status Manager ────────────────────────────────────────────
    public statusManager: StatusManager;

    // Kept for backward-compat reads by GameEngine / Boss classes
    get isStunned(): boolean { return this.statusManager.hasStatus('stunned'); }
    get isSilenced(): boolean { return this.statusManager.hasStatus('silenced') || this.statusManager.hasStatus('silence'); }
    get isDisoriented(): boolean { return this.statusManager.hasStatus('disoriented') || this.statusManager.hasStatus('confusion'); }
    get isMarked(): boolean { return this._isMarked; }
    protected _isMarked: boolean = false;

    mark(): void {
        this._isMarked = true;
    }

    unmark(): void {
        this._isMarked = false;
    }

    // ── Poison (special: has extra logic for build synergies) ─────────────────
    public poisonInstigator: ServerPlayer | null = null;
    get poisonStacks(): number { return this.statusManager.getStacks('poison'); }

    // ── Knockback (physics, not a status) ────────────────────────────────────
    public knockback: { dir: Vec3; force: number } | null = null;

    get defense(): number {
        if (this._hasDefenseOverride) return this._defense;
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
        this._hasDefenseOverride = true;
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

    constructor(position: Vec3) {
        this.position = position.clone();
        this.hp = 100;
        this.maxHp = 100;
        this.statusManager = new StatusManager(this);
    }

    applyGlobalBuff(multiplier: number): void {
        if (this.isDestroyed) return;
        const ratio = this.hp / this.maxHp;
        this.maxHp *= multiplier;
        this.hp = this.maxHp * ratio;
        if (this.damage) this.damage *= multiplier;
    }

    // ── Compatibility wrappers (old call-sites still work) ───────────────────

    applySlow(duration: number, amount = 0.5): void {
        this.statusManager.applyStatus('slowed', duration, amount);
    }

    applyBleed(duration: number, damage: number): void {
        this.statusManager.applyStatus('bleeding', duration, damage);
    }

    applyKnockback(direction: Vec3, force: number): void {
        this.knockback = { dir: direction.clone(), force };
    }

    applyArmorFracture(duration: number, amount: number): void {
        this.statusManager.applyStatus('armorFracture', duration, amount);
    }

    applySilence(duration: number): void {
        this.statusManager.applyStatus('silenced', duration);
    }

    applyDisorientation(duration: number): void {
        this.statusManager.applyStatus('disoriented', duration);
    }

    applyStun(duration: number): void {
        this.statusManager.applyStatus('stunned', duration);
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
        if (this._isMarked || this.statusManager.hasStatus('marked')) {
            fd *= 1.5;
            this._isMarked = false;
            this.statusManager.removeStatus('marked');
        }
        if (this.statusManager.hasStatus('vulnerable')) {
            fd *= 1.15;
        }

        // Armor Fracture logic
        if (this.statusManager.hasStatus('armorFracture')) {
            fd *= (1 + this.statusManager.getIntensity('armorFracture'));
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
            instigator.processLoadoutOnHit(this);
            instigator.attackHitCounter++;
            if (instigator.attackHitCounter >= 3) {
                instigator.attackHitCounter = 0;
                // Passive explosion — handled by GameEngine
            }
        }
    }

    updateStatus(dt: number): boolean {
        // ── Speed calculation: driven by StatusManager ────────────────────────
        if (this.statusManager.hasStatus('slowed')) {
            const amount = this.statusManager.getIntensity('slowed');
            this.speed = this.originalSpeed * (1 - amount);
        } else {
            this.speed = this.originalSpeed;
        }

        // Toxina Paralisante (5 poison stacks from poison build = 30% slow)
        if (this.poisonStacks === 5 && this.poisonInstigator?.build?.buildingColor === 'poison') {
            if (this.poisonInstigator.build.floor3 === 1) {
                this.speed *= 0.70;
            }
        }

        // ── Update StatusManager (handles DoT ticks, CC timers, immunities) ──
        const isHardCC = this.statusManager.update(dt);
        if (isHardCC) {
            this.speed = 0;
            return true;
        }
        if (this.statusManager.hasStatus('exhaust')) {
            this.speed *= 0.75;
        }

        // ── Poison DoT (special handling for build synergies / events) ────────
        const poisonState = this.statusManager.active.get('poison');
        if (poisonState) {
            // Instigator is stored on the state by addPoison()
            if (poisonState.instigator) this.poisonInstigator = poisonState.instigator;

            // Fire hit-number event after each poison tick
            // We track ticks via tickTimer already in StatusManager.
            // Here we just emit the event after damage was already dealt in onTick.
            // To do so we check whether a tick just fired this frame by checking tickTimer wrap-around.
            // (Already handled in StatusManager.update — the onTick in StatusDictionary calls takeDamage)
            // We still need to emit HIT_NUMBER event here:
            const def = 1000; // tickRateMs
            const prevTimer = (poisonState.tickTimer + dt * 1000);
            if (prevTimer >= def && poisonState.tickTimer < def) {
                // A tick fired this frame — emit visual event
                const engine = (global as any).__gameEngine;
                if (engine) {
                    const isBoss = this._isBossType();
                    engine.pendingEvents.push({
                        event: 'HIT_NUMBER',
                        data: {
                            targetId: this.id,
                            x: this.position.x,
                            y: isBoss ? 3.5 : 1.5,
                            z: this.position.z,
                            value: this.lastDamageTaken,
                            type: 'TOXIC'
                        }
                    });
                }
            }
        } else {
            this.poisonInstigator = null;
        }

        // ── Disoriented movement override ─────────────────────────────────────
        if (this.statusManager.hasStatus('disoriented') || this.statusManager.hasStatus('confusion')) {
            const now = Date.now();
            const angle = (now * 0.005) + (parseInt(this.id.substring(0, 4), 16) % 100);
            const dir = new Vec3(Math.cos(angle), 0, Math.sin(angle));
            this.position.add(dir.multiplyScalar(this.speed * dt));
            return true; // skip normal AI
        }

        // ── Knockback physics ─────────────────────────────────────────────────
        if (this.knockback) {
            this.position.add(this.knockback.dir.clone().multiplyScalar(this.knockback.force * dt));
            this.knockback.force *= 0.95;
            if (this.knockback.force < 1) this.knockback = null;
            return true;
        }

        return isHardCC;
    }

    addPoison(amount: number, instigator: ServerPlayer | null): void {
        // Contaminação: detonate at 6th stack
        let contaminationEnabled = false;
        if (instigator?.build?.buildingColor === 'poison') {
            if (instigator.build.floor4 === 0) {
                contaminationEnabled = true;
            }
        }

        const currentStacks = this.poisonStacks;
        const nextStacks = currentStacks + amount;

        if (contaminationEnabled && nextStacks >= 6) {
            // DETONATE!
            const level = instigator ? instigator.level : 1;
            const detonateDmg = (15 + level * 5) * 8;
            this.takeDamage(detonateDmg, instigator, false);
            this.statusManager.removeStatus('poison');

            const engine = (global as any).__gameEngine;
            if (engine) {
                engine.pendingEvents.push({
                    event: 'HIT_NUMBER',
                    data: {
                        targetId: this.id,
                        x: this.position.x,
                        y: this._isBossType() ? 3.5 : 1.5,
                        z: this.position.z,
                        value: detonateDmg,
                        type: 'CRIT'
                    }
                });
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
            // Apply/stack poison (timer resets to 3000ms, adds 1 stack)
            this.statusManager.applyStatus('poison', 3000, 0, instigator);
        }
    }

    canUseAbility(): boolean {
        return !this.statusManager.hasStatus('silenced')
            && !this.statusManager.hasStatus('silence')
            && !this.statusManager.hasStatus('disoriented')
            && !this.statusManager.hasStatus('confusion');
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

    private _isBossType(): boolean {
        return ['LichKing','TheMightyOne','Gangplank','RainhaDasTrevas',
            'PlantaCarnivora','FeiticeiroImortal','SuperBoss','CaoDosInfernos','Farao',
            'GuardiãoDoLimbo','Minos','Cerbero','Plutão','Fúria','Megera','Minotauro',
            'Geriao','Lúcifer','EspectroDeRaziel','Smith'].includes(this.type);
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
            statusEffects: this.statusManager.toSnapshot(),
        };
    }
}
