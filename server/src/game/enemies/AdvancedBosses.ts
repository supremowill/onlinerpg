import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

/** FeiticeiroImortalDasTrevas (Lord Vouldemord) - souls, barrier w/ reflect, marca da alma, teleport, dark explosion */
export class FeiticeiroImortalEnemy extends ServerEnemy {
    public baseDamage: number;
    private idealDistance = 18;
    private retreatDistance = 12;
    private teleportTimer = 15000;
    public isImmortal = false;
    public souls: string[] = []; // soul enemy IDs
    private habilidades = {
        explosao: { cooldown: 3000, lastUsed: 0 },
        marca: { cooldown: 12000, lastUsed: 0 },
        barreira: { cooldown: 7500, lastUsed: 0, isActive: false, shieldHp: 0, shieldMaxHp: 1000, duration: 4000, timer: 0 },
        ritual: { cooldown: 15000, lastUsed: 0 },
    };
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; explosionRadius?: number }[] = [];
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'FeiticeiroImortal'; this.name = 'Lord Vouldemord';
        this.maxHp = 50000 + (1000 * playerLevel); this.hp = this.maxHp;
        this.baseDamage = 500 + (playerMaxHp * 0.8);
        this.speed = 1.2; this.originalSpeed = 1.2;
        this.xp = this.getRegXp(CONFIG.FEITICEIRO_IMORTAL.XP); this.score = this.getRegScore(CONFIG.FEITICEIRO_IMORTAL.SCORE);
        this.hitboxRadius = this.getRegHitbox(CONFIG.FEITICEIRO_IMORTAL.HITBOX_RADIUS);
        this.position.y = 1.75;
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (this.isDestroyed) return;
        const b = this.habilidades.barreira;
        if (b.isActive && b.shieldHp > 0) {
            const ds = Math.min(amount, b.shieldHp); b.shieldHp -= ds;
            // Reflect 40% damage
            if (instigator) {
                const dir = instigator.position.clone().sub(this.position); dir.y = 0; dir.normalize();
                this.pendingProjectiles.push({ dir, damage: amount * 0.40, specialEffect: 'reflectedOrb' });
            }
            const rem = amount - ds;
            if (b.shieldHp <= 0) { b.isActive = false; }
            if (rem <= 0) return;
            amount = rem;
        }
        if (this.isImmortal) return;
        super.takeDamage(amount, instigator, countsForPassive);
    }

    onSoulDestroyed(): void {
        this.souls.pop();
        if (this.souls.length === 0) this.isImmortal = false;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        const b = this.habilidades.barreira;

        this.teleportTimer -= ms;
        if (this.teleportTimer <= 0) {
            this.teleportTimer = 15000;
            const angle = Math.random() * Math.PI * 2;
            this.position.add(new Vec3(Math.cos(angle) * 10, 0, Math.sin(angle) * 10));
        }
        if (b.isActive) { b.timer -= ms; if (b.timer <= 0) b.isActive = false; }

        // Movement: maintain ideal distance
        if (dist < this.retreatDistance) {
            const away = this.position.clone().sub(target.position); away.y = 0; away.normalize();
            this.position.add(away.multiplyScalar(this.speed * dt));
        } else if (dist > this.idealDistance) {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);

        // Abilities priority
        if (now > this.habilidades.ritual.lastUsed + this.habilidades.ritual.cooldown && this.souls.length === 0) {
            this.habilidades.ritual.lastUsed = now; this.isImmortal = true;
            this.pendingAbilities.push({ type: 'spawnSouls', x: this.position.x, z: this.position.z, count: 3, ownerId: this.id });
        }
        if (now > b.lastUsed + b.cooldown && this.hp / this.maxHp < 0.5 && !b.isActive) {
            b.lastUsed = now; b.isActive = true; b.shieldHp = b.shieldMaxHp; b.timer = b.duration;
        }
        if (now > this.habilidades.marca.lastUsed + this.habilidades.marca.cooldown) {
            this.habilidades.marca.lastUsed = now;
            this.pendingAbilities.push({ type: 'marcaDaAlma', targetId: target.id, duration: 5000 });
        }
        if (now > this.habilidades.explosao.lastUsed + this.habilidades.explosao.cooldown) {
            this.habilidades.explosao.lastUsed = now;
            const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
            this.pendingProjectiles.push({ dir, damage: 400 + (target.maxHp * 0.05), specialEffect: 'explosaoDasTrevas', explosionRadius: 3 });
        }
    }
}

/** LichKing - frost aura, frost cone, prison, skull summon, blizzard ultimate, revival queue */
/** LichKing - reworked boss with enrage, scaling, Frostmourne stacks, PredDefile, HexCrown rings, Twin Valkyrs, and Sindragosa Wrath */
export class LichKingEnemy extends ServerEnemy {
    public auraRadius: number;
    public timeAlive: number = 0;
    public phase: number = 1;
    public introTimer: number = 3000;
    public auraDamageTimer: number = 0;
    public ghoulSpawnTimer: number = 12000;
    public lastAttackTime: number = 0;
    public attackCooldown: number = 2000;

    public pendingMeleeAttacks: { targetId: string; damage: number; stun?: number }[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number }[] = [];
    public pendingAbilities: any[] = [];

    private habilidades = {
        defile: { cooldown: 10000, lastUsed: 0 },
        colapso: { cooldown: 18000, lastUsed: 0 },
        valkyr: { cooldown: 35000, lastUsed: 0 },
        sindragosa: { cooldown: 50000, lastUsed: 0 }
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'LichKing';
        this.name = 'Lich King';
        const c = CONFIG.LICH_KING;
        this.maxHp = c.BASE_HP + (450 * playerLevel) + (playerMaxHp * 0.7);
        this.hp = this.maxHp;
        this.damage = 350 + (playerMaxHp * 0.15);
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.speed;
        this.auraRadius = c.AURA_RADIUS || 4;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.isInvulnerable = true;
    }

    applySlow(duration: number, amount = 0.5): void {
        // Armadura Reativa de Saronita: Imunidade total
    }

    applyKnockback(direction: Vec3, force: number): void {
        // Armadura Reativa de Saronita: Imunidade total
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false): void {
        if (this.isInvulnerable || this.isDestroyed) return;
        
        const hpBefore = this.hp;
        super.takeDamage(amount, instigator, countsForPassive, hpPercent, isTrueDamage);
        const damageDealt = hpBefore - this.hp;

        // Armadura Reativa de Saronita: Refletir 5% de todo dano recebido como losangos perseguidores
        if (damageDealt > 0 && instigator) {
            const reflectedAmount = Math.max(1, Math.round(damageDealt * 0.05));
            const dir = instigator.position.clone().sub(this.position);
            dir.y = 0;
            if (dir.lengthSq() > 0.01) {
                dir.normalize();
                this.pendingProjectiles.push({
                    dir,
                    damage: reflectedAmount,
                    specialEffect: 'reactive_saronite_shard',
                    speed: 12.0
                });
            }
        }
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;

        const ms = dt * 1000;

        // --- Animação de Entrada ---
        if (this.introTimer > 0) {
            this.introTimer -= ms;
            if (this.introTimer <= 0) {
                this.isInvulnerable = false;
                // Explode o cilindro: dano, repulsão e ativa zona visual
                this.pendingAbilities.push({
                    type: 'ice_cylinder_explode',
                    x: this.position.x,
                    z: this.position.z,
                    radius: 5.0,
                    duration: 1000
                });
                for (const p of players) {
                    if (p.isDead) continue;
                    const d = this.position.distanceToXZ(p.position);
                    if (d < 5.0) {
                        p.takeDamage(this.damage * 0.40, false, false, this);
                        const kbDir = p.position.clone().sub(this.position);
                        kbDir.y = 0;
                        if (kbDir.lengthSq() > 0.01) {
                            p.applyKnockback(kbDir.normalize(), 15.0);
                        }
                    }
                }
            }
            return;
        }

        const target = this.getClosestPlayer(players);
        if (!target) return;

        this.timeAlive += dt;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);

        // --- Escalonamento a cada 60s vivo ---
        const scalingTicks = Math.floor(this.timeAlive / 60);
        const scalingMult = 1.0 + scalingTicks * 0.08;
        this.sizeMultiplier = scalingMult;

        // --- Fase 2 (Enrage) aos 50% HP ---
        if (this.phase === 1 && this.hp / this.maxHp <= 0.50) {
            this.phase = 2;
            this.speed = this.originalSpeed * 1.20;
        }

        // --- Passiva 1: Aura de Inverno Impiedoso ---
        this.auraDamageTimer -= ms;
        if (this.auraDamageTimer <= 0) {
            this.auraDamageTimer = 500;
            const currentAuraRadius = this.auraRadius * scalingMult;
            for (const p of players) {
                if (p.isDead) continue;
                if (this.position.distanceToXZ(p.position) < currentAuraRadius) {
                    p.takeDamage(this.damage * 0.05 * scalingMult, false, true, this);
                    p.applySlow(600, 0.20);
                    // Ceifador de Almas: cura 1.5% do HP máximo
                    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.015);
                }
            }
        }

        // --- Passiva 4: Legião do Flagelo ---
        this.ghoulSpawnTimer -= ms;
        if (this.ghoulSpawnTimer <= 0) {
            this.ghoulSpawnTimer = 12000;
            this.pendingAbilities.push({
                type: 'spawnGhouls',
                x: this.position.x,
                z: this.position.z,
                count: 4,
                damage: this.damage * 0.3
            });
        }

        // --- Ataque Básico: Golpe de Frostmourne ---
        if (dist <= 2.8) {
            const currentCooldown = this.phase === 2 ? this.attackCooldown / 2 : this.attackCooldown;
            if (now > this.lastAttackTime + currentCooldown && this.canUseAbility()) {
                this.lastAttackTime = now;
                
                target.takeDamage(this.damage * scalingMult, false, false, this);
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.015);

                // Mecânica de Stacks (Gelo Cadavérico)
                let stacks = (target.statusEffects as any).geloCadaviricStacks || 0;
                stacks++;
                if (stacks >= 4) {
                    stacks = 0;
                    target.applyRoot(1500);
                    target.takeDamage(this.damage * 0.5 * scalingMult, false, false, this);
                    
                    this.pendingAbilities.push({
                        type: 'estilhacar_explosion',
                        x: target.position.x,
                        z: target.position.z,
                        radius: 4.0 * scalingMult,
                        damage: this.damage * 0.4 * scalingMult
                    });
                }
                (target.statusEffects as any).geloCadaviricStacks = stacks;
            }
        }

        // --- IA de Habilidades Ativas ---
        const defileCd = this.phase === 2 ? this.habilidades.defile.cooldown / 2 : this.habilidades.defile.cooldown;
        const colapsoCd = this.phase === 2 ? this.habilidades.colapso.cooldown / 2 : this.habilidades.colapso.cooldown;
        const valkyrCd = this.phase === 2 ? this.habilidades.valkyr.cooldown / 2 : this.habilidades.valkyr.cooldown;
        const sindragosaCd = this.phase === 2 ? this.habilidades.sindragosa.cooldown / 2 : this.habilidades.sindragosa.cooldown;

        if (this.canUseAbility()) {
            if (now > this.habilidades.sindragosa.lastUsed + sindragosaCd) {
                this.habilidades.sindragosa.lastUsed = now;
                this.pendingAbilities.push({
                    type: 'sindragosa_wrath',
                    x: this.position.x,
                    z: this.position.z,
                    damage: this.damage * 1.5 * scalingMult,
                    sizeMultiplier: scalingMult,
                    sourceId: this.id
                });
            }
            else if (now > this.habilidades.valkyr.lastUsed + valkyrCd) {
                this.habilidades.valkyr.lastUsed = now;
                this.pendingAbilities.push({
                    type: 'spawnValkyrs',
                    targetId: target.id,
                    damage: this.damage * 0.4 * scalingMult,
                    bossId: this.id
                });
                
                if (this.phase === 2) {
                    this.habilidades.colapso.lastUsed = now;
                    this.pendingAbilities.push({
                        type: 'icecrown_collapse',
                        x: this.position.x,
                        z: this.position.z,
                        damage: this.damage * 0.8 * scalingMult,
                        sizeMultiplier: scalingMult,
                        sourceId: this.id
                    });
                }
            }
            else if (now > this.habilidades.colapso.lastUsed + colapsoCd) {
                this.habilidades.colapso.lastUsed = now;
                this.pendingAbilities.push({
                    type: 'icecrown_collapse',
                    x: this.position.x,
                    z: this.position.z,
                    damage: this.damage * 0.8 * scalingMult,
                    sizeMultiplier: scalingMult,
                    sourceId: this.id
                });
            }
            else if (now > this.habilidades.defile.lastUsed + defileCd) {
                this.habilidades.defile.lastUsed = now;
                const velocity = target.slideVelocity || new Vec3(0, 0, 0);
                const targetPos = target.position.clone().add(velocity.clone().multiplyScalar(1.0));
                
                this.pendingAbilities.push({
                    type: 'defile',
                    x: targetPos.x,
                    z: targetPos.z,
                    radius: 2.0 * scalingMult,
                    damage: 120 * scalingMult,
                    duration: 10000,
                    sourceId: this.id
                });
            }
        }

        this.moveTowards(target.position, dt);
        this.lookAt(target.position);
    }

    toSnapshot() {
        const s = super.toSnapshot();
        s.isEmerging = this.introTimer > 0;
        s.isEnraged = this.phase === 2;
        return s;
    }
}

/** Ghoul - Cubo cinza ágil do Flagelo */
export class GhoulEnemy extends ServerEnemy {
    constructor(pos: Vec3, damage: number, globalMult: number) {
        super(pos);
        this.type = 'Ghoul';
        this.name = 'Ghoul';
        this.maxHp = 600 * globalMult;
        this.hp = this.maxHp;
        this.damage = damage;
        this.speed = 4.2;
        this.originalSpeed = 4.2;
        this.xp = 50;
        this.score = 200;
        this.hitboxRadius = 0.5;
        this.position.y = 0.4;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        
        const dist = this.position.distanceToXZ(target.position);
        if (dist <= 1.2) {
            target.takeDamage(this.damage, false, false, this);
            this.isDestroyed = true;
        } else {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);
    }
}

/** Valkyr - Pirâmide branca voadora flanqueadora */
export class ValkyrEnemy extends ServerEnemy {
    public chargeDir: Vec3 = new Vec3(0, 0, 0);
    public warningTimer: number = 1500;
    public chargeTimer: number = 3000;
    public isCharging: boolean = false;
    public grabbedPlayer: ServerPlayer | null = null;
    public grabTimer: number = 0;
    public targetPos: Vec3 = new Vec3(0, 0, 0);

    constructor(pos: Vec3, damage: number, globalMult: number) {
        super(pos);
        this.type = 'Valkyr';
        this.name = 'Val\'kyr Gêmea';
        this.maxHp = 2000 * globalMult;
        this.hp = this.maxHp;
        this.damage = damage;
        this.speed = 12.0;
        this.originalSpeed = 12.0;
        this.xp = 300;
        this.score = 1000;
        this.hitboxRadius = 0.8;
        this.position.y = 3.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) {
            if (this.grabbedPlayer) {
                this.releasePlayer();
            }
            return;
        }

        const target = this.getClosestPlayer(players);
        if (!target && !this.grabbedPlayer) return;

        const ms = dt * 1000;

        if (this.grabbedPlayer) {
            this.grabTimer -= ms;
            const moveAmt = this.speed * dt;
            this.position.add(this.chargeDir.clone().multiplyScalar(moveAmt));
            this.grabbedPlayer.position.copy(this.position);
            this.grabbedPlayer.position.y = 0.5;

            if (this.grabTimer <= 0) {
                this.grabbedPlayer.jumpTimer = 800;
                this.grabbedPlayer.statusEffects.silenced.isActive = false;
                this.grabbedPlayer.statusEffects.rooted.isActive = false;
                const pToDamage = this.grabbedPlayer;
                setTimeout(() => {
                    if (!pToDamage.isDead) {
                        pToDamage.takeDamage(pToDamage.maxHp * 0.25, false, false, this);
                    }
                }, 800);
                this.grabbedPlayer = null;
                this.isDestroyed = true;
            }
            return;
        }

        if (this.warningTimer > 0) {
            this.warningTimer -= ms;
            if (target) {
                this.targetPos.copy(target.position);
                this.lookAt(this.targetPos);
            }
            if (this.warningTimer <= 0) {
                this.isCharging = true;
                this.chargeDir.copy(this.targetPos).sub(this.position);
                this.chargeDir.y = 0;
                if (this.chargeDir.lengthSq() > 0.01) {
                    this.chargeDir.normalize();
                } else {
                    this.chargeDir.set(0, 0, -1);
                }
            }
            return;
        }

        if (this.isCharging) {
            this.chargeTimer -= ms;
            const moveAmt = this.speed * dt;
            this.position.add(this.chargeDir.clone().multiplyScalar(moveAmt));
            
            if (target) {
                const dist = this.position.distanceToXZ(target.position);
                if (dist < 1.5) {
                    this.grabbedPlayer = target;
                    this.grabTimer = 1000;
                    target.statusEffects.silenced.isActive = true;
                    target.statusEffects.silenced.timer = 2000;
                    target.statusEffects.rooted.isActive = true;
                    target.statusEffects.rooted.timer = 2000;
                }
            }

            if (this.chargeTimer <= 0) {
                this.isDestroyed = true;
            }
        }
    }

    private releasePlayer(): void {
        if (this.grabbedPlayer) {
            this.grabbedPlayer.statusEffects.silenced.isActive = false;
            this.grabbedPlayer.statusEffects.rooted.isActive = false;
            this.grabbedPlayer = null;
        }
    }
}

/** PlantaCarnivoraRainha - whip, poison seeds, sprout summon, devour (pull + bite) */
export class PlantaCarnivoraEnemy extends ServerEnemy {
    private habilidades = {
        chicote: { cooldown: 4000, lastUsed: 0 },
        sementes: { cooldown: 8000, lastUsed: 0 },
        brotos: { cooldown: 12000, lastUsed: 0 },
        devorar: { cooldown: 25000, lastUsed: 0, isCharging: false, chargeTimer: 0, chargeDuration: 2000 },
    };
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number }[] = [];
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3, globalMult: number, playerMaxHp: number) {
        super(pos);
        this.type = 'PlantaCarnivora'; this.name = 'Planta Carnívora Rainha';
        const c = CONFIG.PLANTA_CARNIVORA;
        this.maxHp = this.getRegHp(c.BASE_HP) + (playerMaxHp * 0.8); this.hp = this.maxHp;
        this.speed = 0; this.originalSpeed = 0;
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE); this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        const hd = this.habilidades.devorar;

        if (hd.isCharging) {
            hd.chargeTimer -= ms;
            const progress = 1 - (hd.chargeTimer / hd.chargeDuration);
            // Pull players within 15 units
            for (const p of players) {
                if (p.isDead) continue;
                if (this.position.distanceToXZ(p.position) < 15) {
                    const pull = this.position.clone().sub(p.position); pull.y = 0; pull.normalize();
                    p.position.add(pull.multiplyScalar(15 * progress * dt));
                }
            }
            if (hd.chargeTimer <= 0) {
                hd.isCharging = false;
                // Bite: 40% maxHp damage to nearby players
                for (const p of players) {
                    if (!p.isDead && this.position.distanceToXZ(p.position) < 3) {
                        p.takeDamage(p.maxHp * 0.40, false, false, this);
                    }
                }
            }
            return;
        }

        if (dist < 10 && now > hd.lastUsed + hd.cooldown) {
            hd.lastUsed = now; hd.isCharging = true; hd.chargeTimer = hd.chargeDuration;
        } else if (now > this.habilidades.brotos.lastUsed + this.habilidades.brotos.cooldown) {
            this.habilidades.brotos.lastUsed = now;
            this.pendingAbilities.push({ type: 'spawnBrotos', x: this.position.x, z: this.position.z, count: 2, playerLevel: target.level });
        } else if (dist < 20 && now > this.habilidades.sementes.lastUsed + this.habilidades.sementes.cooldown) {
            this.habilidades.sementes.lastUsed = now;
            for (let i = 0; i < 3; i++) {
                const offset = new Vec3((Math.random() - 0.5) * 15, 0, (Math.random() - 0.5) * 15);
                const tgt = target.position.clone().add(offset);
                const dir = tgt.sub(this.position); dir.normalize();
                this.pendingAbilities.push({ type: 'poisonSeed', startX: this.position.x, startZ: this.position.z, dirX: dir.x, dirZ: dir.z });
            }
        } else if (dist < 30 && now > this.habilidades.chicote.lastUsed + this.habilidades.chicote.cooldown) {
            this.habilidades.chicote.lastUsed = now;
            const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
            this.pendingProjectiles.push({ dir, damage: 50 + (target.maxHp * 0.05), speed: 25 });
        }
    }
}

/** CaoDosInfernos - Rework: Naafiri-inspired hunter with geometric matilha
 * Design: Geometric (black/red rectangular block + pyramids)
 * Behavior: Implacable hunter (aggro radius 40 + scaling)
 * Inspiration: Naafiri (League of Legends)
 */
export class CaoDosInfernosEnemy extends ServerEnemy {
    public playerLevel: number;
    private attackCooldown: number;
    private lastAttackTime = 0;
    private attackRange = 2.0;
    public matilhaIds: string[] = [];
    public pendingAbilities: any[] = [];
    public isChannelingW: boolean = false;
    public channelTimerW: number = 0;
    public isUltActive: boolean = false;
    public ultTimer: number = 0;
    public shieldHp: number = 0;
    public shieldMaxHp: number = 0;
    public detectionRadius: number = 40;

    private habilidades = {
        matilhaTimer: 0,
        matilhaCount: 0,
        q: { cooldown: 0, lastUsed: 0 },
        w: { cooldown: 0, lastUsed: 0, isDashing: false, dashTimer: 0, dashDuration: 400, dashSpeed: 0, targetX: 0, targetZ: 0 },
        e: { cooldown: 0, lastUsed: 0, isSlamming: false, slamTimer: 0, slamDuration: 500 },
        r: { cooldown: 0, lastUsed: 0, isActive: false, timer: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number) {
        super(pos);
        this.playerLevel = playerLevel;
        this.type = 'CaoDosInfernos'; this.name = 'Cão dos Infernos';
        const c = CONFIG.CAO_DOS_INFERNOS;
        this.maxHp = this.getRegHp(c.BASE_HP) + (playerLevel * c.HP_PER_LEVEL); this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerLevel * c.DAMAGE_PER_LEVEL);
        const playerBaseSpeed = this.getRegSpeed(CONFIG.PLAYER.SPEED);
        this.speed = playerBaseSpeed * c.SPEED_BASE_MULT * (1 + playerLevel * c.SPEED_PER_LEVEL);
        this.originalSpeed = this.speed;
        this.xp = this.getRegXp(c.XP_PER_LEVEL) * playerLevel; this.score = this.getRegScore(c.SCORE) + (playerLevel * 20);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.attackCooldown = 1200;
        this.detectionRadius = 40 * (1 + (playerLevel * 0.02));

        const now = Date.now();
        this.habilidades.q.cooldown = c.SKILL_Q_COOLDOWN;
        this.habilidades.q.lastUsed = now - c.SKILL_Q_COOLDOWN;
        this.habilidades.w.cooldown = c.SKILL_W_COOLDOWN;
        this.habilidades.w.lastUsed = now - c.SKILL_W_COOLDOWN;
        this.habilidades.w.dashSpeed = c.SKILL_W_DASH_SPEED;
        this.habilidades.e.cooldown = c.SKILL_E_COOLDOWN;
        this.habilidades.e.lastUsed = now - c.SKILL_E_COOLDOWN;
        this.habilidades.r.cooldown = c.SKILL_R_COOLDOWN;
        this.habilidades.r.lastUsed = now - c.SKILL_R_COOLDOWN;
        this.position.y = 0.6;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        const h = this.habilidades;
        const c = CONFIG.CAO_DOS_INFERNOS;

        if (h.r.isActive) {
            h.r.timer -= ms;
            if (h.r.timer <= 0) {
                h.r.isActive = false; this.isUltActive = false;
                this.sizeMultiplier = 1.0; this.speed = this.originalSpeed;
                this.shieldHp = 0;
                this.detectionRadius = 40 * (1 + (this.playerLevel * 0.02));
            }
        }

        if (this.isChannelingW) {
            this.channelTimerW -= ms;
            if (this.channelTimerW <= 0) {
                this.isChannelingW = false;
                h.w.isDashing = true; h.w.dashTimer = h.w.dashDuration;
                this.pendingAbilities.push({ type: 'recallMatilha', bossId: this.id });
            }
            this.lookAt(target.position);
            return;
        }

        if (h.w.isDashing) {
            h.w.dashTimer -= ms;
            const dir = new Vec3(h.w.targetX - this.position.x, 0, h.w.targetZ - this.position.z);
            if (dir.lengthSq() > 0.01) {
                dir.normalize().multiplyScalar(h.w.dashSpeed * dt);
                this.position.add(dir);
            }
            // Check collision with any player in path
            let hitPlayer: ServerPlayer | null = null;
            for (const p of players) {
                if (!p.isDead && this.position.distanceToXZ(p.position) < this.hitboxRadius + p.hitboxRadius) {
                    hitPlayer = p;
                    break;
                }
            }
            if (hitPlayer) {
                const dmg = c.SKILL_W_DAMAGE + (this.playerLevel * 5);
                hitPlayer.takeDamage(dmg, false, false, this);
                hitPlayer.applyStun(c.SKILL_W_STUN_DURATION);
                h.w.isDashing = false; h.w.lastUsed = now;
                this.pendingAbilities.push({ type: 'investidaImpact', x: this.position.x, z: this.position.z });
            } else if (h.w.dashTimer <= 0) {
                h.w.isDashing = false;
                h.w.lastUsed = now;
            }
            this.lookAt(target.position);
            return;
        }

        if (h.e.isSlamming) {
            h.e.slamTimer -= ms;
            if (h.e.slamTimer <= 0) {
                h.e.isSlamming = false; h.e.lastUsed = now;
                const targets = players.filter(p => !p.isDead && this.position.distanceToXZ(p.position) < c.SKILL_E_RADIUS);
                const dmg = c.SKILL_E_DAMAGE + (this.playerLevel * 5);
                for (const p of targets) p.takeDamage(dmg, false, false, this);
                this.pendingAbilities.push({ type: 'eviscerarSlam', x: this.position.x, z: this.position.z, radius: c.SKILL_E_RADIUS, bossId: this.id });
                if (c.SKILL_E_REPAIR_MATILHA) this.pendingAbilities.push({ type: 'repairMatilha', bossId: this.id });
            }
            return;
        }

        h.matilhaTimer -= dt;
        if (h.matilhaTimer <= 0 && h.matilhaCount < c.MATILHA_MAX) {
            h.matilhaTimer = c.MATILHA_SPAWN_INTERVAL;
            h.matilhaCount++;
            this.pendingAbilities.push({
                type: 'spawnMatilha',
                x: this.position.x + (Math.random() - 0.5) * 3,
                z: this.position.z + (Math.random() - 0.5) * 3,
                playerLevel: this.playerLevel, parentId: this.id,
            });
        }

        if (now > h.q.lastUsed + h.q.cooldown && dist < 25) {
            h.q.lastUsed = now;
            const dirToTarget = target.position.clone().sub(this.position).normalize();
            const leftDir = new Vec3(-dirToTarget.z, 0, dirToTarget.x);
            for (let i = 0; i < 2; i++) {
                const offset = leftDir.clone().multiplyScalar((i === 0 ? -1.5 : 1.5));
                const startPos = this.position.clone().add(offset);
                this.pendingAbilities.push({
                    type: 'prismaSombrio',
                    x: startPos.x, y: startPos.y, z: startPos.z,
                    dirX: dirToTarget.x, dirZ: dirToTarget.z,
                    damage: c.SKILL_Q_DAMAGE + (this.playerLevel * 3),
                    bossId: this.id, playerLevel: this.playerLevel,
                });
            }
        }

        const isBleeding = target.statusEffects.bleeding && target.statusEffects.bleeding.isActive;
        if (now > h.w.lastUsed + h.w.cooldown && isBleeding && dist < 30) {
            this.isChannelingW = true; this.channelTimerW = c.SKILL_W_AIM_DELAY;
            h.w.targetX = target.position.x; h.w.targetZ = target.position.z;
            this.pendingAbilities.push({
                type: 'investidaChannel', x: this.position.x, z: this.position.z,
                targetX: target.position.x, targetZ: target.position.z, duration: c.SKILL_W_AIM_DELAY,
            });
        }

        if (now > h.e.lastUsed + h.e.cooldown && dist < 8) {
            h.e.isSlamming = true; h.e.slamTimer = h.e.slamDuration;
            this.pendingAbilities.push({ type: 'eviscerarStart', x: this.position.x, z: this.position.z });
            this.pendingAbilities.push({ type: 'recallMatilha', bossId: this.id, x: this.position.x, z: this.position.z });
        }

        const hpPercent = this.hp / this.maxHp;
        if (now > h.r.lastUsed + h.r.cooldown && !h.r.isActive && (hpPercent < 0.4 || (dist < 15 && !h.r.isActive))) {
            h.r.isActive = true; h.r.timer = c.SKILL_R_DURATION;
            this.isUltActive = true;
            this.sizeMultiplier = c.SKILL_R_SIZE_MULT;
            this.speed = this.originalSpeed * c.SKILL_R_SPEED_BONUS;
            this.detectionRadius = (40 * (1 + (this.playerLevel * 0.02))) * c.SKILL_R_VISION_BONUS;
            this.shieldMaxHp = c.SKILL_R_SHIELD_HP + (this.playerLevel * 100);
            this.shieldHp = this.shieldMaxHp;
            if (c.SKILL_R_SPAWN_MAX_MATILHA) {
                const toSpawn = c.MATILHA_MAX - h.matilhaCount;
                for (let i = 0; i < toSpawn; i++) {
                    h.matilhaCount++;
                    this.pendingAbilities.push({
                        type: 'spawnMatilha',
                        x: this.position.x + (Math.random() - 0.5) * 3,
                        z: this.position.z + (Math.random() - 0.5) * 3,
                        playerLevel: this.playerLevel, parentId: this.id,
                    });
                }
            }
            this.pendingAbilities.push({ type: 'chamadoAbismo', x: this.position.x, z: this.position.z, duration: c.SKILL_R_DURATION });
        }

        if (dist > this.attackRange) {
            this.moveTowards(target.position, dt, this.speed);
        } else {
            if (now > this.lastAttackTime + this.attackCooldown) {
                this.lastAttackTime = now;
                const dmg = this.damage + (target.maxHp * c.DAMAGE_TARGET_HP_PERCENT);
                target.takeDamage(dmg, false, false, this);
                this.pendingAbilities.push({ type: 'meleeAttack', targetId: target.id, damage: dmg });
            }
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (this.isDestroyed) return;
        if (this.shieldHp > 0) {
            const absorbed = Math.min(amount, this.shieldHp);
            this.shieldHp -= absorbed;
            amount -= absorbed;
            if (amount <= 0) return;
        }
        super.takeDamage(amount, instigator, countsForPassive);
    }

    removeMatilha(id: string): void {
        this.matilhaIds = this.matilhaIds.filter(mid => mid !== id);
        this.habilidades.matilhaCount = Math.max(0, this.habilidades.matilhaCount - 1);
    }

    toSnapshot() {
        const s = super.toSnapshot();
        s.isChannelingW = this.isChannelingW || undefined;
        s.isUltActive = this.isUltActive || undefined;
        s.shieldActive = this.shieldHp > 0 || undefined;
        s.matilhaCount = this.habilidades.matilhaCount || undefined;
        return s;
    }
}

/** TheMightyOne - the ultimate boss, reflects projectiles, spawns elite minions, absorbs orbs */
export class TheMightyOneEnemy extends ServerEnemy {
    public auraRadius: number;
    public damageBonus = 1.0;
    public attackSpeedBonus = 1.0;
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number }[] = [];
    private lastAttackTime = 0;
    private attackCooldown = 1500;

    constructor(pos: Vec3) {
        super(pos);
        this.type = 'TheMightyOne'; this.name = 'O Poderoso';
        const c = CONFIG.THE_MIGHTY_ONE;
        this.maxHp = this.getRegHp(c.HP); this.hp = this.maxHp;
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.auraRadius = c.AURA_RADIUS; this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.position.y = this.hitboxRadius;
    }

    init(): void {
        this.pendingAbilities.push({ type: 'mightyOneInit' });
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (Math.random() < 0.3) {
            amount *= 0.4; // 60% reduction
        }
        super.takeDamage(amount, instigator, countsForPassive);
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        this.moveTowards(target.position, dt);
        this.lookAt(target.position);

        const now = Date.now();
        if (now > this.lastAttackTime + this.attackCooldown) {
            this.lastAttackTime = now;
            const dir = target.position.clone().sub(this.position);
            dir.y = 0;
            dir.normalize();
            this.pendingProjectiles.push({
                dir: dir,
                damage: 0,
                specialEffect: 'mighty_one_projectile',
                speed: 14
            });
        }
    }
}

/** MatilhaGeometraEnemy - minion spawned by Cao Dos Infernos */
export class MatilhaGeometraEnemy extends ServerEnemy {
    public parentId: string = '';
    public parentBoss: CaoDosInfernosEnemy | null = null;
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number }[] = [];
    public playerLevel: number;
    private attackCooldown: number;
    private lastAttackTime = 0;
    private habilidades = {
        qTimer: 0,
        qCooldown: 3000,
    };

    constructor(pos: Vec3, playerLevel: number, globalMult: number) {
        super(pos);
        this.playerLevel = playerLevel;
        this.type = 'MatilhaGeometra'; this.name = 'Matilha Geométrica';
        const c = CONFIG.MATILHA_GEOMETRICA;
        this.maxHp = this.getRegHp(c.BASE_HP) + (playerLevel * c.HP_PER_LEVEL); this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerLevel * c.DAMAGE_PER_LEVEL);
        this.speed = this.getRegSpeed(CONFIG.PLAYER.SPEED) * (1 + 0.3 * (1 + playerLevel * 0.02));
        this.originalSpeed = this.speed;
        this.xp = 0; this.score = 0;
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.attackCooldown = 1000;
        this.position.y = 0.6;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);

        this.habilidades.qTimer -= ms;

        // Follow or orbit the parent boss
        if (this.parentBoss && !this.parentBoss.isDestroyed) {
            const distToBoss = this.position.distanceToXZ(this.parentBoss.position);
            if (distToBoss > 4.5) {
                this.moveTowards(this.parentBoss.position, dt, this.speed);
            } else {
                const angle = gameTime * 1.5 + (this.id.charCodeAt(0) % 4) * Math.PI / 2;
                const orbitRadius = 2.5 + Math.sin(gameTime * 2 + (this.id.charCodeAt(0) % 4)) * 0.5;
                const targetPos = this.parentBoss.position.clone().add(new Vec3(Math.sin(angle) * orbitRadius, 0, Math.cos(angle) * orbitRadius));
                this.moveTowards(targetPos, dt, this.speed);
            }
        } else {
            if (dist > 3) {
                this.moveTowards(target.position, dt, this.speed);
            }
        }

        // Melee attack fallback if very close
        if (dist < 2.0) {
            if (now > this.lastAttackTime + this.attackCooldown) {
                this.lastAttackTime = now;
                target.takeDamage(this.damage, false, false, this);
            }
        }

        // Shoot mini cubic projectiles autonomously
        if (this.habilidades.qTimer <= 0 && dist < 16) {
            this.habilidades.qTimer = this.habilidades.qCooldown;
            const dir = target.position.clone().sub(this.position).normalize();
            this.pendingProjectiles.push({
                dir,
                damage: this.damage,
                specialEffect: 'matilha_projectile',
                speed: CONFIG.CAO_DOS_INFERNOS.MATILHA_PROJECTILE_SPEED || 8
            });
        }

        this.lookAt(target.position);
    }
}
