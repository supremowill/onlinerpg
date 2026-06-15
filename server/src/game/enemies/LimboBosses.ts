import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

type CooldownMap = Record<string, { cooldown: number; lastUsed: number }>;

interface LimboProjectile {
    dir: Vec3;
    damage: number;
    specialEffect?: string;
    speed?: number;
    lifetime?: number;
    hitboxRadius?: number;
}

abstract class DanteLimboBoss extends ServerEnemy {
    public pendingProjectiles: LimboProjectile[] = [];
    public pendingAbilities: any[] = [];
    protected playerLevel: number;
    protected playerMaxHp: number;
    protected cooldowns: CooldownMap;
    protected lastTargetPos = new Map<string, Vec3>();
    protected phase25Triggered = false;
    protected phase50Triggered = false;
    protected phase75Triggered = false;

    constructor(pos: Vec3, playerLevel: number, playerMaxHp: number, cooldowns: CooldownMap) {
        super(pos);
        this.playerLevel = playerLevel;
        this.playerMaxHp = playerMaxHp;
        this.cooldowns = cooldowns;
    }

    protected initBoss(type: string, name: string, cfg: any, globalMult: number, y = 1.5): void {
        this.type = type;
        this.name = name;
        this.maxHp = (this.getRegHp(cfg.BASE_HP) + this.playerLevel * (cfg.HP_PER_LEVEL || 0)) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(cfg.BASE_DAMAGE) + (this.playerMaxHp * 0.012);
        this.speed = this.getRegSpeed(cfg.SPEED);
        this.originalSpeed = this.speed;
        this.xp = this.getRegXp(cfg.XP);
        this.score = this.getRegScore(cfg.SCORE);
        this.hitboxRadius = this.getRegHitbox(cfg.HITBOX_RADIUS);
        this.position.y = y;
        this.defense = cfg.DEFENSE_POINTS || 90;
    }

    protected hpPct(): number {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }

    protected updatePhases(onThreshold: (lostPct: number) => void): void {
        const pct = this.hpPct();
        if (!this.phase75Triggered && pct <= 0.75) { this.phase75Triggered = true; onThreshold(25); }
        if (!this.phase50Triggered && pct <= 0.50) { this.phase50Triggered = true; onThreshold(50); }
        if (!this.phase25Triggered && pct <= 0.25) { this.phase25Triggered = true; onThreshold(75); }
    }

    protected canUse(key: string, cooldownScale = 1): boolean {
        const cd = this.cooldowns[key];
        if (!cd) return false;
        return Date.now() >= cd.lastUsed + cd.cooldown * cooldownScale;
    }

    protected markUsed(key: string): void {
        const cd = this.cooldowns[key];
        if (cd) cd.lastUsed = Date.now();
    }

    protected use(key: string, cooldownScale = 1): boolean {
        if (!this.canUse(key, cooldownScale)) return false;
        this.markUsed(key);
        return true;
    }

    protected predictTarget(target: ServerPlayer, leadSeconds = 0.75): Vec3 {
        const previous = this.lastTargetPos.get(target.id);
        this.lastTargetPos.set(target.id, target.position.clone());
        if (!previous) return target.position.clone();
        const velocity = target.position.clone().sub(previous);
        velocity.y = 0;
        return target.position.clone().add(velocity.multiplyScalar(leadSeconds * 20));
    }

    protected moveToMaintainDistance(target: ServerPlayer, dt: number, idealDistance: number, orbit = 0): void {
        const dist = this.position.distanceToXZ(target.position);
        if (dist > idealDistance + 1.0) {
            this.moveTowards(target.position, dt);
            return;
        }
        if (dist < idealDistance - 1.0) {
            const away = this.position.clone().sub(target.position);
            away.y = 0;
            if (away.lengthSq() > 0.01) this.position.add(away.normalize().multiplyScalar(this.speed * dt));
            return;
        }
        if (orbit !== 0) {
            const radial = this.position.clone().sub(target.position);
            radial.y = 0;
            if (radial.lengthSq() > 0.01) {
                const side = new Vec3(-radial.z, 0, radial.x).normalize().multiplyScalar(this.speed * orbit * dt);
                this.position.add(side);
            }
        }
    }

    protected pushProjectile(target: ServerPlayer, damage: number, specialEffect: string, speed = 12, lead = 0.5): void {
        const predicted = this.predictTarget(target, lead);
        const dir = predicted.sub(this.position);
        dir.y = 0;
        if (dir.lengthSq() <= 0.01) return;
        this.pendingProjectiles.push({ dir: dir.normalize(), damage, specialEffect, speed, lifetime: 4, hitboxRadius: 0.35 });
    }

    protected lineAbility(type: string, target: ServerPlayer, damage: number, opts: any = {}): void {
        const predicted = this.predictTarget(target, opts.lead ?? 0.75);
        this.pendingAbilities.push({
            type: 'limbo_line',
            ability: type,
            x: this.position.x,
            z: this.position.z,
            targetX: predicted.x,
            targetZ: predicted.z,
            range: opts.range || 18,
            width: opts.width || 1.2,
            damage,
            delay: opts.delay ?? 900,
            status: opts.status,
            statusDuration: opts.statusDuration,
            statusIntensity: opts.statusIntensity,
            knockbackForce: opts.knockbackForce,
            sourceId: this.id,
        });
    }

    protected radialAbility(type: string, x: number, z: number, radius: number, damage: number, opts: any = {}): void {
        this.pendingAbilities.push({
            type: 'limbo_radial',
            ability: type,
            x,
            z,
            radius,
            damage,
            delay: opts.delay ?? 750,
            status: opts.status,
            statusDuration: opts.statusDuration,
            statusIntensity: opts.statusIntensity,
            knockbackForce: opts.knockbackForce,
            pullForce: opts.pullForce,
            sourceId: this.id,
        });
    }

    protected zoneAbility(type: string, x: number, z: number, radius: number, duration: number, damagePerSec: number, opts: any = {}): void {
        this.pendingAbilities.push({
            type: 'limbo_zone',
            ability: type,
            x,
            z,
            radius,
            duration,
            damagePerSec,
            status: opts.status,
            statusDuration: opts.statusDuration,
            statusIntensity: opts.statusIntensity,
            pullForce: opts.pullForce,
            sourceId: this.id,
        });
    }
}

// Círculo 1 - Limbo: O Guardião Sem Fé
export class GuardiaoDoLimboEnemy extends DanteLimboBoss {
    private antiHealLast = 0;
    private auraLast = 0;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            grito: { cooldown: 8000, lastUsed: 0 },
            correntes: { cooldown: 10000, lastUsed: 0 },
            almas: { cooldown: 14000, lastUsed: 0 },
        });
        this.initBoss('GuardiãoDoLimbo', 'O Guardião Sem Fé', CONFIG.GUARDIAO_DO_LIMBO, globalMult, 1.5);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 1.15);
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);

        this.updatePhases(() => {
            this.pendingAbilities.push({ type: 'limbo_spawn_souls', x: this.position.x, z: this.position.z, count: 3, damage: this.damage * 0.65, ownerId: this.id });
        });

        if (now > this.auraLast + 1000) {
            this.auraLast = now;
            this.pendingAbilities.push({ type: 'limbo_enemy_aura', x: this.position.x, z: this.position.z, radius: 7, speedBonus: 0.10, damageBonus: 0.08, sourceId: this.id });
        }
        if (now > this.antiHealLast + 12000 && dist < 9) {
            this.antiHealLast = now;
            target.statusManager.applyStatus('mortalWounds', 4000, 0.30);
        }

        const scale = this.hpPct() < 0.5 ? 0.72 : 1;
        if (dist > 11 && this.use('almas', scale)) {
            this.pendingAbilities.push({ type: 'limbo_spawn_souls', x: this.position.x, z: this.position.z, count: this.hpPct() < 0.5 ? 6 : 5, damage: this.damage * 0.55, ownerId: this.id });
        } else if (dist < 5 && this.use('grito', scale)) {
            this.radialAbility('grito_do_esquecido', this.position.x, this.position.z, 5, this.damage * 1.25, { status: 'slow', statusDuration: 3000, statusIntensity: 0.25 });
        } else if (this.use('correntes', this.hpPct() < 0.25 ? 0.55 : scale)) {
            this.lineAbility('correntes_do_limbo', target, this.damage * 0.75, { status: 'root', statusDuration: 1000, range: 18, width: 1.1 });
        } else {
            this.moveToMaintainDistance(target, dt, 8);
        }
        this.lookAt(target.position);
    }
}

// Círculo 2 - Luxúria: A Matriarca dos Ventos Profanos
export class MinosEnemy extends DanteLimboBoss {
    private perfumeLast = 0;
    private speedBoostTimer = 0;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            vendaval: { cooldown: 7000, lastUsed: 0 },
            beijo: { cooldown: 9000, lastUsed: 0 },
            espiral: { cooldown: 12000, lastUsed: 0 },
        });
        this.initBoss('Minos', 'Matriarca dos Ventos Profanos', CONFIG.MINOS, globalMult, 1.8);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 2.7);
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer -= dt * 1000;
            this.speed = this.originalSpeed * 1.2;
        } else {
            this.speed = this.originalSpeed;
        }
        if (now > this.perfumeLast + 8000 && dist < 6) {
            this.perfumeLast = now;
            target.applyBlindness(2000);
        }

        const scale = this.hpPct() < 0.5 ? 0.8 : 1;
        const poisonedOrBlind = target.statusManager.hasStatus('poison') || target.statusManager.hasStatus('blind');
        if (dist > 10 && this.use('beijo', scale)) {
            this.pushProjectile(target, this.damage * 0.8, 'limbo_poison', 13, 0.55);
        } else if (dist < 4.5 && this.use('espiral', scale)) {
            this.radialAbility('espiral_do_desejo', this.position.x, this.position.z, 6, this.damage * 1.2, { pullForce: 11, delay: 950, status: 'disoriented', statusDuration: 1200 });
        } else if (this.use('vendaval', scale)) {
            this.lineAbility('vendaval_da_luxuria', target, this.damage * 1.05, { knockbackForce: 18, range: 15, width: 2.2, delay: 750 });
        } else {
            this.moveToMaintainDistance(target, dt, poisonedOrBlind ? 5 : 7, 1);
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false, damageMeta?: any): void {
        super.takeDamage(amount, instigator, countsForPassive, hpPercent, isTrueDamage, damageMeta);
        if (!this.isDestroyed && Math.random() < 0.15) this.speedBoostTimer = 2000;
    }
}

// Círculo 3 - Gula: O Devorador Abissal
export class CerberoEnemy extends DanteLimboBoss {
    private gasLast = 0;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            mordida: { cooldown: 8000, lastUsed: 0 },
            vomito: { cooldown: 10000, lastUsed: 0 },
            engolir: { cooldown: 16000, lastUsed: 0 },
        });
        this.initBoss('Cerbero', 'O Devorador Abissal', CONFIG.CERBERO, globalMult, 1.6);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 1.25);
        this.defense = 130;
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);
        if (now > this.gasLast + 10000) {
            this.gasLast = now;
            this.radialAbility('digestao_infernal', this.position.x, this.position.z, 5.5, this.damage * 0.35, { status: 'poison', statusDuration: 4000, delay: 300 });
        }
        const scale = this.hpPct() < 0.35 ? 0.75 : 1;
        if (this.hpPct() < 0.7 && this.use('engolir', scale)) {
            this.pendingAbilities.push({ type: 'limbo_consume_ally', x: this.position.x, z: this.position.z, radius: 7, healPct: 0.05, damageBuff: 0.10, damageBuffDuration: 8000, sourceId: this.id });
        } else if (dist < 3.2 && this.use('mordida', scale)) {
            this.radialAbility('mordida_colossal', target.position.x, target.position.z, 3.2, this.damage * 1.8, { knockbackForce: 16, delay: 850 });
        } else if (this.use('vomito', this.hpPct() < 0.2 ? 0.65 : scale)) {
            const pos = this.predictTarget(target, 0.8);
            this.zoneAbility('vomito_putrefato', pos.x, pos.z, 4.2, 6000, this.damage * 0.34, { status: 'poison', statusDuration: 5000 });
        } else {
            this.moveToMaintainDistance(target, dt, 3.4);
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false, damageMeta?: any): void {
        const adjusted = this.hpPct() > 0.7 ? amount * 0.85 : amount;
        super.takeDamage(adjusted, instigator, countsForPassive, hpPercent, isTrueDamage, damageMeta);
    }
}

// Círculo 4 - Ganância: O Rei das Correntes de Ouro
export class PlutaoEnemy extends DanteLimboBoss {
    private tributeLast = 0;
    private armorOpenUntil = 0;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            correntes: { cooldown: 8000, lastUsed: 0 },
            moedas: { cooldown: 11000, lastUsed: 0 },
            cofre: { cooldown: 15000, lastUsed: 0 },
        });
        this.initBoss('Plutão', 'O Rei das Correntes de Ouro', CONFIG.PLUTAO, globalMult, 1.9);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 1.5);
        this.defense = 180;
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);
        if (now > this.tributeLast + 15000 && dist < 9) {
            this.tributeLast = now;
            this.pendingAbilities.push({ type: 'limbo_delayed_mark', targetId: target.id, x: target.position.x, z: target.position.z, radius: 9, delay: 3000, damage: this.damage * 2.0, sourceId: this.id });
        }
        const scale = this.hpPct() < 0.5 ? 0.78 : 1;
        if (dist > 8 && this.use('correntes', scale)) {
            this.armorOpenUntil = now + 4000;
            this.lineAbility('correntes_do_tesouro', target, this.damage * 1.15, { status: 'slow', statusDuration: 3000, statusIntensity: 0.35, width: 1.4 });
        } else if ((target.statusManager.hasStatus('slowed') || target.statusManager.hasStatus('slow')) && this.use('moedas', scale)) {
            this.armorOpenUntil = now + 4000;
            this.pendingAbilities.push({ type: 'limbo_coin_rain', x: target.position.x, z: target.position.z, count: 6, radius: 6, damage: this.damage * 0.8, sourceId: this.id });
        } else if (this.use('cofre', this.hpPct() < 0.25 ? 0.65 : scale)) {
            this.armorOpenUntil = now + 4000;
            const pos = this.predictTarget(target, 0.7);
            this.zoneAbility('cofre_maldito', pos.x, pos.z, 5, 4000, 0, { pullForce: 8 });
            this.radialAbility('cofre_maldito_explosao', pos.x, pos.z, 5, this.damage * 1.4, { delay: 4000 });
        } else {
            this.moveToMaintainDistance(target, dt, 7);
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false, damageMeta?: any): void {
        const adjusted = Date.now() > this.armorOpenUntil ? amount * 0.8 : amount;
        super.takeDamage(adjusted, instigator, countsForPassive, hpPercent, isTrueDamage, damageMeta);
    }
}

// Círculo 5 - Ira: O Carrasco Rubro
export class FuriaEnemy extends DanteLimboBoss {
    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            investida: { cooldown: 7000, lastUsed: 0 },
            machado: { cooldown: 9000, lastUsed: 0 },
            explosao: { cooldown: 13000, lastUsed: 0 },
        });
        this.initBoss('Fúria', 'O Carrasco Rubro', CONFIG.FURIA, globalMult, 1.5);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 2.4);
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const hpLostSteps = Math.floor((1 - this.hpPct()) / 0.10);
        this.damageMultiplier = 1 + Math.min(0.50, hpLostSteps * 0.05);
        this.speed = this.originalSpeed * (this.hpPct() < 0.4 ? 1.25 : 1);
        const scale = this.hpPct() < 0.4 ? 0.8 : 1;
        const dist = this.position.distanceToXZ(target.position);
        if (dist > 7 && this.use('investida', this.hpPct() < 0.2 ? 0.55 : scale)) {
            this.lineAbility('investida_furiosa', target, this.damage * this.damageMultiplier * 1.9, { width: 1.7, range: 18, delay: 800 });
            this.moveTowards(this.predictTarget(target, 0.4), dt, this.speed * 3.0);
        } else if (dist < 4 && this.use('machado', scale)) {
            this.pendingAbilities.push({ type: 'limbo_cone', ability: 'machado_da_ira', x: this.position.x, z: this.position.z, dirX: Math.sin(this.rotationY), dirZ: Math.cos(this.rotationY), range: 5, angle: 0.75, damage: this.damage * this.damageMultiplier * 1.55, status: 'bleed', statusDuration: 5000, statusIntensity: 7, sourceId: this.id });
        } else if (dist < 3.2 && this.use('explosao', scale)) {
            this.radialAbility('explosao_de_raiva', this.position.x, this.position.z, 5.5, this.damage * this.damageMultiplier, { status: 'stun', statusDuration: 750, delay: 900 });
        } else {
            this.moveTowards(this.predictTarget(target, 0.35), dt, this.speed);
        }
        this.lookAt(target.position);
    }
}

// Círculo 6 - Heresia: O Profeta Queimado
export class MegeraEnemy extends DanteLimboBoss {
    private faithLast = 0;
    private revived = false;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            pilar: { cooldown: 9000, lastUsed: 0 },
            livro: { cooldown: 10000, lastUsed: 0 },
            circulo: { cooldown: 14000, lastUsed: 0 },
        });
        this.initBoss('Megera', 'O Profeta Queimado', CONFIG.MEGERA, globalMult, 1.7);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 1.65);
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);
        if (now > this.faithLast + 12000 && dist < 8) {
            this.faithLast = now;
            target.applyArmorFracture(5000, 0.15);
        }
        const scale = this.revived ? 0.65 : (this.hpPct() < 0.5 ? 0.75 : 1);
        if (dist > 10 && this.use('livro', scale)) {
            for (let i = -1; i <= 1; i++) this.pushProjectile(target, this.damage * 0.75, 'limbo_burn', 9 + Math.abs(i), 0.6 + i * 0.1);
        } else if ((target.statusManager.hasStatus('slowed') || target.statusManager.hasStatus('rooted') || dist > 6) && this.use('pilar', scale)) {
            const pos = this.predictTarget(target, 0.9);
            this.radialAbility('pilar_de_cinzas', pos.x, pos.z, 3.8, this.damage * 1.7, { delay: 1500, status: 'burning', statusDuration: 4000, statusIntensity: 8 });
        } else if (dist < 6 && this.use('circulo', scale)) {
            this.zoneAbility('circulo_heretico', this.position.x, this.position.z, 5, 7000, this.damage * 0.38, { status: 'burning', statusDuration: 4000, statusIntensity: 7 });
        } else {
            this.moveToMaintainDistance(target, dt, 9);
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false, damageMeta?: any): void {
        super.takeDamage(amount, instigator, countsForPassive, hpPercent, isTrueDamage, damageMeta);
        if (this.isDestroyed && !this.revived) {
            this.revived = true;
            this.isDestroyed = false;
            this.hp = this.maxHp * 0.25;
            this.damage *= 1.2;
            this.speed = this.originalSpeed *= 1.15;
            this.pendingAbilities.push({ type: 'limbo_radial', ability: 'ressurreicao_heretica', x: this.position.x, z: this.position.z, radius: 6, damage: this.damage, delay: 500, status: 'burning', statusDuration: 4000, statusIntensity: 8, sourceId: this.id });
        }
    }
}

// Círculo 7 - Violência: A Besta dos Três Sangues
export class MinotauroEnemy extends DanteLimboBoss {
    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            garra: { cooldown: 7000, lastUsed: 0 },
            rio: { cooldown: 10000, lastUsed: 0 },
            salto: { cooldown: 12000, lastUsed: 0 },
        });
        this.initBoss('Minotauro', 'A Besta dos Três Sangues', CONFIG.MINOTAURO, globalMult, 1.5);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 2.05);
        this.defense = 150;
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const scale = this.hpPct() < 0.35 ? 0.75 : 1;
        if (target.statusManager.hasStatus('bleeding') || target.statusManager.hasStatus('bleed')) this.speed = this.originalSpeed * 1.1;
        else this.speed = this.originalSpeed;
        const dist = this.position.distanceToXZ(target.position);
        if (dist > 9 && this.use('salto', scale)) {
            const pos = this.predictTarget(target, 0.65);
            this.position.x = pos.x;
            this.position.z = pos.z;
            this.radialAbility('salto_carniceiro', pos.x, pos.z, 4, this.damage * 1.55, { delay: 900 });
        } else if (dist > 4 && this.use('rio', scale)) {
            this.lineAbility('rio_de_sangue', target, this.damage * 0.7, { range: 16, width: 1.8, status: 'bleed', statusDuration: 4000, statusIntensity: 6, delay: 800 });
        } else if (this.use('garra', scale)) {
            for (let i = -1; i <= 1; i++) this.pendingAbilities.push({ type: 'limbo_cone', ability: 'garra_tripla', x: this.position.x, z: this.position.z, dirX: Math.sin(this.rotationY + i * 0.25), dirZ: Math.cos(this.rotationY + i * 0.25), range: 4.5, angle: 0.45, damage: this.damage * 0.78, sourceId: this.id });
        } else {
            this.moveToMaintainDistance(target, dt, 3.2, 0.45);
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false, damageMeta?: any): void {
        super.takeDamage(amount * 0.9, instigator, countsForPassive, hpPercent, isTrueDamage, damageMeta);
    }
}

// Círculo 8 - Fraude: O Arlequim das Mil Faces
export class GeriaoEnemy extends DanteLimboBoss {
    private cloneLast = 0;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            troca: { cooldown: 8000, lastUsed: 0 },
            punhal: { cooldown: 9000, lastUsed: 0 },
            palco: { cooldown: 14000, lastUsed: 0 },
        });
        this.initBoss('Geriao', 'O Arlequim das Mil Faces', CONFIG.GERIAO, globalMult, 1.6);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 2.2);
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const activeCloneLimit = this.hpPct() < 0.25 ? 2 : 1;
        if (now > this.cloneLast + (this.hpPct() < 0.5 ? 9000 : 15000)) {
            this.cloneLast = now;
            this.pendingAbilities.push({ type: 'limbo_clone', x: this.position.x, z: this.position.z, ownerId: this.id, hpPct: 0.20, damageScale: 0.5, maxClones: activeCloneLimit });
        }
        const dist = this.position.distanceToXZ(target.position);
        if (this.use('troca') && dist < 8) {
            this.pendingAbilities.push({ type: 'limbo_swap_clone', x: this.position.x, z: this.position.z, damage: this.damage, ownerId: this.id, sourceId: this.id });
        } else if (this.use('punhal')) {
            for (let i = -2; i <= 2; i++) this.pushProjectile(target, this.damage * 0.65, 'limbo_poison_chance', 12, 0.4 + i * 0.05);
        } else if (this.use('palco')) {
            this.pendingAbilities.push({ type: 'limbo_fake_stage', x: target.position.x, z: target.position.z, radius: 8, count: 7, realCount: 3, damage: this.damage * 1.1, sourceId: this.id });
        } else {
            const away = this.position.clone().sub(target.position);
            away.y = 0;
            if (away.lengthSq() > 0.01) this.position.add(away.normalize().multiplyScalar(this.speed * dt));
            if (this.position.distanceToXZ(target.position) > 13) this.moveTowards(target.position, dt, this.speed * 0.5);
        }
        this.lookAt(target.position);
    }
}

// Círculo 9 - Traição: O Imperador Congelado
export class LuciferEnemy extends DanteLimboBoss {
    private silentLast = 0;
    private finalStormStarted = false;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos, playerLevel, playerMaxHp, {
            lanca: { cooldown: 8000, lastUsed: 0 },
            prisao: { cooldown: 12000, lastUsed: 0 },
            tempestade: { cooldown: 18000, lastUsed: 0 },
        });
        this.initBoss('Lúcifer', 'O Imperador Congelado', CONFIG.LUCIFER, globalMult, 2.0);
        this.speed = this.originalSpeed = Math.max(this.originalSpeed, 1.25);
        this.defense = 220;
    }

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);
        if (now > this.silentLast + 18000) {
            this.silentLast = now;
            target.applySlow(4000, 0.45);
        }
        if (this.hpPct() < 0.25 && !this.finalStormStarted) {
            this.finalStormStarted = true;
            this.zoneAbility('ultimo_juramento', this.position.x, this.position.z, 7, 999999, this.damage * 0.15, { status: 'slow', statusDuration: 1000, statusIntensity: 0.10 });
        }
        const scale = this.hpPct() < 0.5 ? 0.78 : 1;
        if ((target.statusManager.hasStatus('slowed') || target.statusManager.hasStatus('slow')) && this.use('tempestade', scale)) {
            this.zoneAbility('tempestade_de_cocito', this.position.x, this.position.z, 8, 6000, this.damage * 0.42, { status: 'slow', statusDuration: 1500, statusIntensity: 0.35 });
        } else if (dist > 9 && this.use('lanca', scale)) {
            this.lineAbility('lanca_de_gelo_negro', target, this.damage * 1.55, { status: 'slow', statusDuration: 3000, statusIntensity: 0.30, range: 20, width: 1.2 });
        } else if (this.use('prisao', this.hpPct() < 0.5 ? 0.7 : scale)) {
            const pos = this.predictTarget(target, 0.9);
            this.pendingAbilities.push({ type: 'limbo_prison', x: pos.x, z: pos.z, radius: 4, delay: 2000, damage: this.damage * 1.6, rootDuration: 1000, sourceId: this.id });
        } else {
            this.moveToMaintainDistance(target, dt, 8);
        }
        this.lookAt(target.position);
    }

    toSnapshot() {
        const s = super.toSnapshot();
        (s as any).isChanneling = this.finalStormStarted || undefined;
        return s;
    }
}
