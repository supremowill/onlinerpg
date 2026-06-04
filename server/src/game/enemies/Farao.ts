import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';
import { EnemyRegistry } from '../../data/EnemyRegistry';

/**
 * EscaravelhoFarao — Guided scarab minion spawned by O Faraó
 * Chases the closest player like a homing missile, explodes on contact
 */
export class EscaravelhoFaraoEnemy extends ServerEnemy {
    public ownerId: string;
    private explosionRadius = 1.5;

    constructor(pos: Vec3, ownerId: string) {
        super(pos);
        this.type = 'EscaravelhoFarao';
        this.name = 'Escaravelho';
        this.ownerId = ownerId;

        const def = EnemyRegistry.get('EscaravelhoFarao');
        const c = CONFIG.ESCARAVELHO_FARAO;

        if (def) {
            const s = def.stats;
            this.maxHp = s.hp;
            this.hp = this.maxHp;
            this.damage = s.damage;
            this.speed = s.speed;
            this.originalSpeed = s.speed;
            this.hitboxRadius = s.hitboxRadius;
            this.xp = s.xp;
            this.score = s.score;
        } else {
            this.maxHp = this.getRegHp(c.BASE_HP);
            this.hp = this.maxHp;
            this.damage = this.getRegDamage(c.BASE_DAMAGE);
            this.speed = this.getRegSpeed(c.SPEED);
            this.originalSpeed = this.getRegSpeed(c.SPEED);
            this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
            this.xp = this.getRegXp(c.XP);
            this.score = this.getRegScore(c.SCORE);
        }
        this.position.y = 0.3;
    }

    // Scarabs ignore all CC
    applySlow(_d: number, _a?: number): void {}
    applyKnockback(_dir: Vec3, _f: number): void {}

    update(dt: number, players: ServerPlayer[]): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        // Explode on contact
        if (dist < this.explosionRadius + target.hitboxRadius) {
            target.takeDamage(this.damage, false, false, this);
            this.hp = 0;
            this.isDestroyed = true;
            return;
        }
        this.moveTowards(target.position, dt);
        this.lookAt(target.position);
    }
}

/**
 * FaraoEnemy — O FARAÓ — Entidade Deus (Tier: Acima de Boss)
 *
 * God-tier entity with:
 * - 5 Passives: Areias do Tempo, Maldição Dourada, Gênese de Escaravelhos,
 *               Divindade Intocável (CC immunity), Eclipsar
 * - 5 Actives:  Raio de Rá, Prisão de Gizé, Julgamento de Osíris,
 *               Praga de Vóxeis, Colapso Monumental
 * - Teleportation AI (no walking)
 * - Spawns every 12 min, HP scales +20% each invocation
 */
export class FaraoEnemy extends ServerEnemy {
    public spawnCount: number;
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];

    // Teleport AI
    private teleportTimer: number;
    private losBlockTimer = 0; // Time LOS has been blocked by obstacle

    // Passive timers
    private escaravelhoTimer: number;
    private areiasAccumulator: Map<string, number> = new Map(); // playerId -> accumulated slow %

    // Eclipse tracking
    private eclipseTriggered: boolean[] = [false, false, false]; // 75%, 50%, 25%
    public eclipseActive = false;
    private eclipseTimer = 0;

    // Active ability cooldowns
    private habilidades = {
        raioDeRa: { cooldown: CONFIG.FARAO.RAIO_RA_COOLDOWN, lastUsed: 0, isWarning: false, warningTimer: 0, targetX: 0, targetZ: 0 },
        prisaoDeGize: { cooldown: CONFIG.FARAO.PRISAO_GIZE_COOLDOWN, lastUsed: 0 },
        julgamento: { cooldown: CONFIG.FARAO.JULGAMENTO_COOLDOWN, lastUsed: 0, isActive: false, timer: 0, safeX: 0, safeZ: 0 },
        praga: { cooldown: CONFIG.FARAO.PRAGA_COOLDOWN, lastUsed: 0 },
        colapso: { cooldown: CONFIG.FARAO.COLAPSO_COOLDOWN, lastUsed: 0, isLevitating: false, levitateTimer: 0 },
    };

    // Levitation state for Colapso
    public isLevitating = false;

    constructor(pos: Vec3, spawnCount: number) {
        super(pos);
        this.type = 'Farao';
        this.name = 'O Faraó';
        this.spawnCount = spawnCount;

        const def = EnemyRegistry.get('Farao');
        const c = CONFIG.FARAO;

        let baseHp = this.getRegHp(c.BASE_HP);
        let hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        let xp = this.getRegXp(c.XP);
        let score = this.getRegScore(c.SCORE);

        if (def) {
            const s = def.stats;
            if (s.hp) baseHp = s.hp;
            if (s.hitboxRadius) hitboxRadius = s.hitboxRadius;
            if (s.xp) xp = s.xp;
            if (s.score) score = s.score;
        }

        // Scale HP by +20% per respawn
        const hpScale = Math.pow(c.HP_SCALE_PER_SPAWN, spawnCount);
        this.maxHp = Math.floor(baseHp * hpScale);
        this.hp = this.maxHp;

        this.speed = 0;
        this.originalSpeed = 0;
        this.hitboxRadius = hitboxRadius;
        this.xp = xp;
        this.score = score;
        this.sizeMultiplier = 2.0;
        this.position.y = 1.5; // Floating

        this.teleportTimer = c.TELEPORT_INTERVAL;
        this.escaravelhoTimer = c.ESCARAVELHO_INTERVAL;
    }

    // ===== PASSIVA 4: Divindade Intocável — Total CC immunity =====
    applySlow(_duration: number, _amount?: number): void { /* Immune */ }
    applyKnockback(_direction: Vec3, _force: number): void { /* Immune */ }
    applyBleed(_duration: number, _damage: number): void { /* Immune */ }
    applyArmorFracture(_duration: number, _amount: number): void { /* Immune */ }
    applySilence(_duration: number): void { /* Immune */ }
    applyDisorientation(_duration: number): void { /* Immune */ }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false): void {
        if (this.isDestroyed || this.isInvulnerable) return;

        // Step 1 - Dano Base
        const danoBase = amount + (this.maxHp * hpPercent);

        // Step 2 - Flutuação de Dano (RNG)
        const rng = 0.9 + Math.random() * 0.2;
        let fd = danoBase * rng;

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
        if (this.isMarked) { fd *= 1.5; this.unmark(); }


        const finalDamage = Math.round(fd);
        this.lastDamageTaken = finalDamage;

        // Reflect 10% of damage back to attacker (based on final damage)
        if (instigator) {
            const reflectDmg = finalDamage * CONFIG.FARAO.MALDIÇÃO_REFLECT_PCT;
            instigator.takeDamage(reflectDmg, false, false, this);
        }

        this.hp -= finalDamage;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDestroyed = true;
        }

        // Check eclipse thresholds
        const currentHpPercent = this.hp / this.maxHp;
        const thresholds = [0.75, 0.50, 0.25];
        for (let i = 0; i < thresholds.length; i++) {
            if (!this.eclipseTriggered[i] && currentHpPercent <= thresholds[i]) {
                this.eclipseTriggered[i] = true;
                this.eclipseActive = true;
                this.eclipseTimer = CONFIG.FARAO.ECLIPSE_DURATION;
                this.pendingAbilities.push({ type: 'faraoEclipse', duration: CONFIG.FARAO.ECLIPSE_DURATION });
            }
        }

        if (instigator && countsForPassive) {
            instigator.attackHitCounter++;
        }
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const ms = dt * 1000;
        const c = CONFIG.FARAO;

        // ===== Eclipse timer =====
        if (this.eclipseActive) {
            this.eclipseTimer -= ms;
            if (this.eclipseTimer <= 0) {
                this.eclipseActive = false;
            }
        }

        // ===== Colapso levitation state =====
        if (this.habilidades.colapso.isLevitating) {
            this.habilidades.colapso.levitateTimer -= ms;
            this.isLevitating = true;
            this.position.y = 8; // High above arena
            if (this.habilidades.colapso.levitateTimer <= 0) {
                this.habilidades.colapso.isLevitating = false;
                this.isLevitating = false;
                this.position.y = 1.5;
                // Drop blocks
                for (let i = 0; i < c.COLAPSO_BLOCK_COUNT; i++) {
                    const half = CONFIG.GROUND_HALF - 10;
                    const bx = (Math.random() * half * 2) - half;
                    const bz = (Math.random() * half * 2) - half;
                    this.pendingAbilities.push({
                        type: 'colapsoBlock',
                        x: bx, z: bz,
                        damage: c.COLAPSO_DAMAGE,
                        duration: c.COLAPSO_BLOCK_DURATION,
                    });
                }
            }
            // While levitating, skip other actions
            return;
        }

        // ===== Raio de Rá warning phase =====
        if (this.habilidades.raioDeRa.isWarning) {
            this.habilidades.raioDeRa.warningTimer -= ms;
            if (this.habilidades.raioDeRa.warningTimer <= 0) {
                this.habilidades.raioDeRa.isWarning = false;
                // Fire the beam!
                this.pendingAbilities.push({
                    type: 'raioDeRaStrike',
                    x: this.habilidades.raioDeRa.targetX,
                    z: this.habilidades.raioDeRa.targetZ,
                    hpPercent: c.RAIO_RA_HP_PERCENT,
                    burnDuration: c.RAIO_RA_BURN_DURATION,
                    burnDps: c.RAIO_RA_BURN_DPS,
                    radius: 3,
                });
            }
        }

        // ===== Julgamento de Osíris active phase =====
        if (this.habilidades.julgamento.isActive) {
            this.habilidades.julgamento.timer -= ms;
            if (this.habilidades.julgamento.timer <= 0) {
                this.habilidades.julgamento.isActive = false;
                // Apply damage to everyone NOT in the safe zone
                this.pendingAbilities.push({
                    type: 'julgamentoResolve',
                    safeX: this.habilidades.julgamento.safeX,
                    safeZ: this.habilidades.julgamento.safeZ,
                    damagePercent: c.JULGAMENTO_DAMAGE_PERCENT,
                });
            }
        }

        // ===== PASSIVA 1: Areias do Tempo — cumulative slow =====
        for (const p of players) {
            if (p.isDead) continue;
            const pid = p.id;
            // Check if player moved since last tick
            const prev = this.areiasAccumulator.get(pid) || 0;
            // Simple movement check: if speed is very low or player didn't move
            const isStationary = p.statusEffects.stunned.isActive ||
                                  p.statusEffects.frozen.isActive ||
                                  p.statusEffects.rooted.isActive ||
                                  (!p.input.keys?.w && !p.input.keys?.a && !p.input.keys?.s && !p.input.keys?.d &&
                                   !p.input.joystickX && !p.input.joystickY);
            if (isStationary) {
                const newSlow = Math.min(prev + c.AREIAS_SLOW_PER_SEC * dt, 0.70); // Cap at 70%
                this.areiasAccumulator.set(pid, newSlow);
                p.applySlow(500, newSlow);
            } else {
                // Reset slow when moving
                this.areiasAccumulator.set(pid, 0);
            }
        }

        // ===== PASSIVA 3: Gênese de Escaravelhos — spawn 3 every 12s =====
        this.escaravelhoTimer -= ms;
        if (this.escaravelhoTimer <= 0) {
            this.escaravelhoTimer = c.ESCARAVELHO_INTERVAL;
            for (let i = 0; i < c.ESCARAVELHO_COUNT; i++) {
                const angle = (i / c.ESCARAVELHO_COUNT) * Math.PI * 2 + Math.random() * 0.5;
                const sx = this.position.x + Math.cos(angle) * 3;
                const sz = this.position.z + Math.sin(angle) * 3;
                this.pendingAbilities.push({
                    type: 'spawnEscaravelhoFarao',
                    x: sx, z: sz,
                    ownerId: this.id,
                });
            }
        }

        // ===== TELEPORT AI =====
        this.teleportTimer -= ms;
        if (this.teleportTimer <= 0) {
            this.teleportTimer = c.TELEPORT_INTERVAL;
            // Teleport to a blind spot relative to the player
            const angle = Math.random() * Math.PI * 2;
            const dist = 12 + Math.random() * 10; // 12-22 units away
            let newX = target.position.x + Math.cos(angle) * dist;
            let newZ = target.position.z + Math.sin(angle) * dist;
            // Clamp to arena
            const half = CONFIG.GROUND_HALF - 5;
            newX = Math.max(-half, Math.min(half, newX));
            newZ = Math.max(-half, Math.min(half, newZ));
            this.position.x = newX;
            this.position.z = newZ;
        }

        this.lookAt(target.position);

        // ===== ACTIVE ABILITIES (priority order) =====
        const hpPercent = this.hp / this.maxHp;

        // 5. Colapso Monumental (Ultimate) — only when HP < 50%
        if (hpPercent < 0.50 && now > this.habilidades.colapso.lastUsed + this.habilidades.colapso.cooldown) {
            this.habilidades.colapso.lastUsed = now;
            this.habilidades.colapso.isLevitating = true;
            this.habilidades.colapso.levitateTimer = 3000; // 3s levitation before blocks fall
            this.pendingAbilities.push({
                type: 'colapsoStart',
                x: this.position.x, z: this.position.z,
                blockCount: c.COLAPSO_BLOCK_COUNT,
            });
            return;
        }

        // 3. Julgamento de Osíris
        if (now > this.habilidades.julgamento.lastUsed + this.habilidades.julgamento.cooldown && !this.habilidades.julgamento.isActive) {
            this.habilidades.julgamento.lastUsed = now;
            this.habilidades.julgamento.isActive = true;
            this.habilidades.julgamento.timer = c.JULGAMENTO_TIMER;
            // Safe zone is a random half of the arena
            const safeLeft = Math.random() > 0.5;
            this.habilidades.julgamento.safeX = safeLeft ? -CONFIG.GROUND_HALF / 2 : CONFIG.GROUND_HALF / 2;
            this.habilidades.julgamento.safeZ = 0;
            this.pendingAbilities.push({
                type: 'julgamentoStart',
                timer: c.JULGAMENTO_TIMER,
                safeX: this.habilidades.julgamento.safeX,
                safeZ: this.habilidades.julgamento.safeZ,
            });
        }

        // 2. Prisão de Gizé
        if (now > this.habilidades.prisaoDeGize.lastUsed + this.habilidades.prisaoDeGize.cooldown) {
            this.habilidades.prisaoDeGize.lastUsed = now;
            this.pendingAbilities.push({
                type: 'prisaoDeGize',
                targetId: target.id,
                x: target.position.x,
                z: target.position.z,
                escapeTime: c.PRISAO_GIZE_ESCAPE_TIME,
                rootDuration: c.PRISAO_GIZE_ROOT_DURATION,
            });
        }

        // 1. Raio de Rá
        if (now > this.habilidades.raioDeRa.lastUsed + this.habilidades.raioDeRa.cooldown && !this.habilidades.raioDeRa.isWarning) {
            this.habilidades.raioDeRa.lastUsed = now;
            this.habilidades.raioDeRa.isWarning = true;
            this.habilidades.raioDeRa.warningTimer = c.RAIO_RA_WARNING;
            this.habilidades.raioDeRa.targetX = target.position.x;
            this.habilidades.raioDeRa.targetZ = target.position.z;
            this.pendingAbilities.push({
                type: 'raioDeRaWarning',
                x: target.position.x,
                z: target.position.z,
                warningDuration: c.RAIO_RA_WARNING,
            });
        }

        // 4. Praga de Vóxeis
        if (now > this.habilidades.praga.lastUsed + this.habilidades.praga.cooldown) {
            this.habilidades.praga.lastUsed = now;
            const dir = target.position.clone().sub(this.position);
            dir.y = 0;
            dir.normalize();
            this.pendingAbilities.push({
                type: 'pragaDeVoxeis',
                x: this.position.x, z: this.position.z,
                dirX: dir.x, dirZ: dir.z,
                blindDuration: c.PRAGA_BLIND_DURATION,
                damagePerSec: c.PRAGA_DAMAGE_PER_SEC,
            });
        }
    }

    toSnapshot() {
        const s = super.toSnapshot();
        s.isLevitating = this.isLevitating || undefined;
        (s as any).eclipseActive = this.eclipseActive || undefined;
        (s as any).isJulgamentoActive = this.habilidades.julgamento.isActive || undefined;
        (s as any).julgamentoSafeX = this.habilidades.julgamento.isActive ? this.habilidades.julgamento.safeX : undefined;
        (s as any).isRaioWarning = this.habilidades.raioDeRa.isWarning || undefined;
        (s as any).raioTargetX = this.habilidades.raioDeRa.isWarning ? this.habilidades.raioDeRa.targetX : undefined;
        (s as any).raioTargetZ = this.habilidades.raioDeRa.isWarning ? this.habilidades.raioDeRa.targetZ : undefined;
        return s;
    }
}
