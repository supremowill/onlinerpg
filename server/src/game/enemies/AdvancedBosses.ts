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
        this.xp = CONFIG.FEITICEIRO_IMORTAL.XP; this.score = CONFIG.FEITICEIRO_IMORTAL.SCORE;
        this.hitboxRadius = CONFIG.FEITICEIRO_IMORTAL.HITBOX_RADIUS;
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
export class LichKingEnemy extends ServerEnemy {
    public auraRadius: number;
    public revivalQueue: { reviveAt: number; position: Vec3; originalType: string }[] = [];
    private habilidades = {
        explosao: { cooldown: 6000, lastUsed: 0 },
        prisao: { cooldown: 12000, lastUsed: 0 },
        chamado: { cooldown: 15000, lastUsed: 0 },
        ultimate: { cooldown: 35000, lastUsed: 0, isChanneling: false, timer: 0 },
    };
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'LichKing'; this.name = 'Lich King';
        const c = CONFIG.LICH_KING;
        this.maxHp = 32000 + (450 * playerLevel) + (playerMaxHp * 0.7); this.hp = this.maxHp;
        this.damage = 350 + (playerMaxHp * 0.15);
        this.speed = c.SPEED; this.originalSpeed = c.SPEED;
        this.auraRadius = c.AURA_RADIUS;
        this.xp = c.XP; this.score = c.SCORE; this.hitboxRadius = c.HITBOX_RADIUS;
    }

    addToRevivalQueue(position: Vec3, originalType: string): void {
        this.revivalQueue.push({ reviveAt: Date.now() + 5000, position: position.clone(), originalType });
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);

        // Revival queue
        for (let i = this.revivalQueue.length - 1; i >= 0; i--) {
            if (now >= this.revivalQueue[i].reviveAt) {
                const item = this.revivalQueue.splice(i, 1)[0];
                this.pendingAbilities.push({ type: 'spawnEspectro', x: item.position.x, z: item.position.z, originalType: item.originalType });
            }
        }

        // Frost aura: damage + slow nearby players
        for (const p of players) {
            if (p.isDead) continue;
            if (this.position.distanceToXZ(p.position) < this.auraRadius) {
                p.takeDamage(p.maxHp * 0.02 * dt, false);
                p.applySlow(500, 0.3);
            }
        }

        // Ultimate channeling
        if (this.habilidades.ultimate.isChanneling) {
            this.habilidades.ultimate.timer -= ms;
            if (this.habilidades.ultimate.timer <= 0) {
                this.habilidades.ultimate.isChanneling = false;
                this.pendingAbilities.push({ type: 'nevascaZone', x: this.position.x, z: this.position.z, radius: 6, duration: 3000, damagePerSec: 600 + (target.maxHp * 0.4) });
                for (const p of players) {
                    if (!p.isDead) { p.applySlow(4000, 0.5); p.statusEffects.lichKingLifeDrain.isActive = true; p.statusEffects.lichKingLifeDrain.timer = 4000; p.statusEffects.lichKingLifeDrain.damagePerSecond = p.maxHp * 0.05; }
                }
            }
            return;
        }

        // Ability priority
        if (now > this.habilidades.ultimate.lastUsed + this.habilidades.ultimate.cooldown) {
            this.habilidades.ultimate.lastUsed = now; this.habilidades.ultimate.isChanneling = true; this.habilidades.ultimate.timer = 3000;
        } else if (now > this.habilidades.chamado.lastUsed + this.habilidades.chamado.cooldown) {
            this.habilidades.chamado.lastUsed = now;
            this.pendingAbilities.push({ type: 'spawnCaveiras', x: this.position.x, z: this.position.z, count: 5, damage: 200 + (target.maxHp * 0.03) });
        } else if (now > this.habilidades.prisao.lastUsed + this.habilidades.prisao.cooldown) {
            this.habilidades.prisao.lastUsed = now;
            this.pendingAbilities.push({ type: 'lichPrison', targetId: target.id, duration: 2000 });
        } else if (now > this.habilidades.explosao.lastUsed + this.habilidades.explosao.cooldown) {
            this.habilidades.explosao.lastUsed = now;
            const baseDir = target.position.clone().sub(this.position); baseDir.y = 0; baseDir.normalize();
            for (let i = -1; i <= 1; i++) {
                this.pendingProjectiles.push({ dir: baseDir.clone().applyAxisAngleY(i * 0.2), damage: 300 + (target.maxHp * 0.04), specialEffect: 'freezingCone' });
            }
        }
        this.moveTowards(target.position, dt);
        this.lookAt(target.position);
    }

    toSnapshot() {
        const s = super.toSnapshot();
        s.isChanneling = this.habilidades.ultimate.isChanneling;
        return s;
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
        this.maxHp = c.BASE_HP + (playerMaxHp * 0.8); this.hp = this.maxHp;
        this.speed = 0; this.originalSpeed = 0;
        this.xp = c.XP; this.score = c.SCORE; this.hitboxRadius = c.HITBOX_RADIUS;
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
                        p.takeDamage(p.maxHp * 0.40, false);
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

/** CaoDosInfernos - dash, mark, roar+shield, frenzy, spawns filhotes */
export class CaoDosInfernosEnemy extends ServerEnemy {
    private playerLevel: number;
    private attackCooldown: number;
    private lastAttackTime = 0;
    private attackRange = 2.0;
    public filhoteIds: string[] = [];
    public respawnQueue: { filhoteId: string; timer: number }[] = [];
    private habilidades = {
        investida: { cooldown: 5000, lastUsed: 0, isDashing: false, dashTimer: 0, dashDuration: 300, dashSpeed: 20, useCount: 0 },
        marca: { cooldown: 8000, lastUsed: 0, isActive: false, duration: 5000, timer: 0 },
        rugido: { cooldown: 12000, lastUsed: 0 },
        frenesi: { cooldown: 20000, lastUsed: 0, isActive: false, duration: 10000, timer: 0 },
    };
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3, globalMult: number, playerLevel: number) {
        super(pos);
        this.playerLevel = playerLevel;
        this.type = 'CaoDosInfernos'; this.name = 'Cão dos Infernos';
        const c = CONFIG.CAO_DOS_INFERNOS;
        this.maxHp = c.BASE_HP + (playerLevel * c.BASE_HP_PER_LEVEL); this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE + (playerLevel * c.BASE_DAMAGE_PER_LEVEL);
        this.speed = c.SPEED; this.originalSpeed = c.SPEED;
        this.xp = 30 + (playerLevel * 10); this.score = 500 + (playerLevel * 20);
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.attackCooldown = (1.2 - (Math.floor(playerLevel / 5) * 0.05)) * 1000;
        this.position.y = 0.6;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        const h = this.habilidades;

        // Respawn filhotes
        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            this.respawnQueue[i].timer -= dt;
            if (this.respawnQueue[i].timer <= 0) {
                this.pendingAbilities.push({ type: 'respawnFilhote', x: this.position.x + (Math.random() - 0.5) * 5, z: this.position.z + (Math.random() - 0.5) * 5, playerLevel: this.playerLevel, parentId: this.id });
                this.respawnQueue.splice(i, 1);
            }
        }

        // Frenzy timer
        if (h.frenesi.isActive) { h.frenesi.timer -= ms; if (h.frenesi.timer <= 0) { h.frenesi.isActive = false; h.frenesi.lastUsed = now; h.investida.useCount = 0; } }
        else { if (this.updateStatus(dt)) return; }
        // Mark timer
        if (h.marca.isActive) { h.marca.timer -= ms; if (h.marca.timer <= 0) h.marca.isActive = false; }

        // Trigger frenzy after 3 dashes
        if (h.investida.useCount >= 3 && now > h.frenesi.lastUsed + h.frenesi.cooldown && !h.frenesi.isActive) {
            h.frenesi.isActive = true; h.frenesi.timer = h.frenesi.duration;
        }
        // Roar: AoE damage + shield filhotes
        if (now > h.rugido.lastUsed + h.rugido.cooldown && dist < 10) {
            h.rugido.lastUsed = now;
            this.pendingAbilities.push({ type: 'rugido', x: this.position.x, z: this.position.z, radius: 8, damage: this.damage * 1.5, filhoteIds: this.filhoteIds });
        }
        // Mark
        if (now > h.marca.lastUsed + h.marca.cooldown) { h.marca.lastUsed = now; h.marca.isActive = true; h.marca.timer = h.marca.duration; }
        // Dash
        const dashCd = h.frenesi.isActive ? 1000 : h.investida.cooldown;
        if (now > h.investida.lastUsed + dashCd && dist < 15 && !h.investida.isDashing) {
            h.investida.lastUsed = now; h.investida.isDashing = true; h.investida.dashTimer = h.investida.dashDuration;
            if (!h.frenesi.isActive) h.investida.useCount++;
        }

        if (h.investida.isDashing) {
            h.investida.dashTimer -= ms;
            this.moveTowards(target.position, dt, h.investida.dashSpeed);
            if (h.investida.dashTimer <= 0) {
                h.investida.isDashing = false;
                this.pendingAbilities.push({ type: 'dashExplosion', x: this.position.x, z: this.position.z, radius: 4, damage: this.damage * 2, stunDuration: 1000 });
            }
        } else {
            let spd = this.originalSpeed;
            if (h.marca.isActive) spd *= 1.5;
            if (h.frenesi.isActive) spd *= 1.2;
            if (dist > this.attackRange) { this.moveTowards(target.position, dt, spd); }
            else {
                let cd = this.attackCooldown, dmg = this.damage;
                if (h.frenesi.isActive) { cd /= 2; dmg *= 2.5; }
                if (now > this.lastAttackTime + cd) {
                    this.lastAttackTime = now;
                    this.pendingAbilities.push({ type: 'meleeAttack', targetId: target.id, damage: dmg });
                }
            }
        }
        this.lookAt(target.position);
    }
}

/** TheMightyOne - the ultimate boss, reflects projectiles, spawns elite minions, absorbs orbs */
export class TheMightyOneEnemy extends ServerEnemy {
    public auraRadius: number;
    public damageBonus = 1.0;
    public attackSpeedBonus = 1.0;
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3) {
        super(pos);
        this.type = 'TheMightyOne'; this.name = 'O Poderoso';
        const c = CONFIG.THE_MIGHTY_ONE;
        this.maxHp = c.HP; this.hp = this.maxHp;
        this.speed = c.SPEED; this.originalSpeed = c.SPEED;
        this.auraRadius = c.AURA_RADIUS; this.hitboxRadius = c.HITBOX_RADIUS;
        this.xp = c.XP; this.score = c.SCORE;
        this.position.y = this.hitboxRadius;
    }

    init(): void {
        this.pendingAbilities.push({ type: 'mightyOneInit' });
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        this.moveTowards(target.position, dt);
    }
}
