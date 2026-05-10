import { v4 as uuidv4 } from 'uuid';
import { Vec3 } from '../utils/Vector3';
import { CONFIG } from '../config';
import { InputState, PlayerSnapshot } from '../network/Protocol';
import { UPGRADE_LEVELS, getUpgradePromptForLevel } from './UpgradeSystem';
import { getGameData } from '../data/GameDataLoader';

/**
 * Server-side Player state — full authority
 */
export class ServerPlayer {
    // Upgrade system
    public selectedUpgrades: Record<string, string> = {};
    public upgradeFlags: Record<string, boolean> = {};
    public isSelectingUpgrade: boolean = false;
    public pendingUpgradeLevel: number = 0;
    public ultDamageStored: number = 0;
    public dashMineTimer: number = 0;
    public dashHitTracker: Map<string, number> = new Map();

    public id: string;
    public name: string;
    public position: Vec3;
    public targetPosition?: Vec3;
    public rotationY: number = 0;
    public color: number;
    public hp: number;
    public maxHp: number;
    public speed: number;
    public originalSpeed: number;
    public isDead: boolean = false;
    public level: number = 1;
    public xp: number = 0;
    public xpToNextLevel: number = CONFIG.PLAYER.XP_TO_FIRST_LEVEL;
    public score: number = 0;
    public kills: number = 0;
    public orbsCollected: number = 0;
    public attackCooldownMs: number;
    public originalAttackCooldownMs: number;
    public lastAttackTime: number = 0;
    public isAttacking: boolean = false;
    public attackHitCounter: number = 0;
    public justDied: boolean = false;
    public justKilled: boolean = false;
    public hitboxRadius: number = CONFIG.PLAYER.HITBOX_RADIUS;

    public skillLevels = { q: 1, w: 1, e: 1, r: 1, passive: 1 };
    public skills = {
        q: { cooldown: CONFIG.PLAYER.SKILL_Q.COOLDOWN, lastUsed: 0, duration: CONFIG.PLAYER.SKILL_Q.DURATION, timer: 0, isDashing: false, dashSpeed: CONFIG.PLAYER.SKILL_Q.DASH_SPEED },
        w: { cooldown: CONFIG.PLAYER.SKILL_W.COOLDOWN, lastUsed: 0 },
        e: { cooldown: CONFIG.PLAYER.SKILL_E.COOLDOWN, lastUsed: 0, duration: CONFIG.PLAYER.SKILL_E.DURATION, timer: 0, isActive: false, shieldHp: 0, maxShieldHp: 0, damageAbsorbed: 0 },
        r: { cooldown: CONFIG.PLAYER.SKILL_R.COOLDOWN, lastUsed: 0, duration: CONFIG.PLAYER.SKILL_R.DURATION, timer: 0, isActive: false },
    };

    public activeBuff = { type: null as string | null, timer: 0, duration: CONFIG.PLAYER.BUFF_DURATION, attackCounter: 0 };
    public enemyMap?: Map<string, any>;
    public tempBuff = { type: null as string | null, timer: 0, magnitude: 0 };
    public timedBuffs: { type: string; timer: number; effects: any }[] = [];

    public pendingProjectiles: { dir: Vec3, damage: number, fromOrbitalSoul?: boolean, fromPlayerId?: string, skillUpgrades?: any, trackHits?: boolean, specialEffect?: string, explosionRadius?: number }[] = [];
    public pendingZones: { type: string, x: number, z: number, radius: number, damage: number, extras?: any }[] = [];
    // Espectro de Raziel essence - orbital souls
    public orbitalSouls: { id: string; angle: number; orbitSpeed: number; radius: number; fireTimer: number }[] = [];
    public orbitalSoulDamageMultiplier: number = 0; // 0.05 = 5% of enemy max HP
    public orbitalSoulDamageFlat: number = 0; // level * 3
    public orbitalSoulCount: number = 0;

    public statusEffects = {
        stunned: { isActive: false, timer: 0 },
        frozen: { isActive: false, timer: 0 },
        bleeding: { isActive: false, timer: 0, damage: 0, lastTick: 0, tickInterval: 1000 },
        slowed: { isActive: false, timer: 0, amount: 0 },
        rooted: { isActive: false, timer: 0 },
        attackSpeedSlow: { isActive: false, timer: 0, amount: 0 },
        disoriented: { isActive: false, timer: 0 },
        blind: { isActive: false, timer: 0 },
        silenced: { isActive: false, timer: 0 },
        burning: { isActive: false, timer: 0, damagePerTick: 0, lastTick: 0, tickInterval: 1000, stacks: 0 },
        armorFracture: { isActive: false, timer: 0, amount: 0 },
        marcaDaAlma: { isActive: false, timer: 0 },
        lichKingPrison: { isActive: false, timer: 0 },
        lichKingLifeDrain: { isActive: false, timer: 0, damagePerSecond: 0 },
        freezingConeHits: { count: 0, timer: 0 },
        invertedControls: { isActive: false, timer: 0 },
    };

    public input: InputState = { keys: { w: false, a: false, s: false, d: false }, mouseX: 0, mouseY: 0 };
    public platform: 'pc' | 'mobile' = 'pc';
    public pendingReward: number = 0;
    public lastPingTime: number = Date.now();
    public isConnected: boolean = true;
    private facingDirection: Vec3 = new Vec3(0, 0, -1);

    private static PLAYER_COLORS = [0x4a90e2, 0xe24a4a, 0x4ae24a, 0xe2e24a, 0xe24ae2];
    private static nextColorIndex = 0;

    constructor(id: string, name: string) {
        const pConf = getGameData().player || CONFIG.PLAYER as any;
        this.id = id;
        this.name = name;
        this.maxHp = pConf.hp || CONFIG.PLAYER.MAX_HP;
        this.hp = this.maxHp;
        this.speed = pConf.speed || CONFIG.PLAYER.SPEED;
        this.originalSpeed = pConf.speed || CONFIG.PLAYER.SPEED;
        this.attackCooldownMs = pConf.attackCooldownMs || CONFIG.PLAYER.ATTACK_COOLDOWN_MS;
        this.originalAttackCooldownMs = pConf.attackCooldownMs || CONFIG.PLAYER.ATTACK_COOLDOWN_MS;
        this.xpToNextLevel = pConf.xpToFirstLevel || CONFIG.PLAYER.XP_TO_FIRST_LEVEL;
        this.hitboxRadius = pConf.hitboxRadius || CONFIG.PLAYER.HITBOX_RADIUS;
        
        // Use CONFIG fallback for skills if skills not defined
        const sq = pConf.skills?.q || CONFIG.PLAYER.SKILL_Q;
        const sw = pConf.skills?.w || CONFIG.PLAYER.SKILL_W;
        const se = pConf.skills?.e || CONFIG.PLAYER.SKILL_E;
        const sr = pConf.skills?.r || CONFIG.PLAYER.SKILL_R;

        this.skills = {
            q: { cooldown: sq.cooldown, lastUsed: 0, duration: sq.duration, timer: 0, isDashing: false, dashSpeed: sq.dashSpeed },
            w: { cooldown: sw.cooldown, lastUsed: 0 },
            e: { cooldown: se.cooldown, lastUsed: 0, duration: se.duration, timer: 0, isActive: false, shieldHp: 0, maxShieldHp: 0, damageAbsorbed: 0 },
            r: { cooldown: sr.cooldown, lastUsed: 0, duration: sr.duration, timer: 0, isActive: false },
        };

        this.color = ServerPlayer.PLAYER_COLORS[ServerPlayer.nextColorIndex++ % 5];
        const angle = Math.random() * Math.PI * 2;
        const radius = 3 + Math.random() * 5;
        this.position = new Vec3(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius);
    }

    getDamage(isAbility = false): number {
        const pConf = getGameData().player || CONFIG.PLAYER as any;
        const sr = pConf.skills?.r || CONFIG.PLAYER.SKILL_R;
        let base = 40 * (this.level * 2.0);
        if (this.activeBuff.type === 'guerreiro') base *= 1.70;
        if (this.skills.r.isActive) base *= sr.damageMultiplier || 4.0;
        if (this.tempBuff.type === 'damage') base *= this.tempBuff.magnitude;
        const rainhaBuff = this.timedBuffs.find(b => b.type === 'rainha_buff');
        if (rainhaBuff && isAbility) base *= rainhaBuff.effects.ability_damage;
        const plantaBuff = this.timedBuffs.find(b => b.type === 'planta_buff');
        if (plantaBuff) base *= plantaBuff.effects.damage;
        const essenciaBuff = this.timedBuffs.find(b => b.type === 'essencia_negra');
        if (essenciaBuff && isAbility) base *= essenciaBuff.effects.magic_damage;
        const sabreBuff = this.timedBuffs.find(b => b.type === 'sabre_pirata');
        if (sabreBuff && !isAbility) base *= (1 + sabreBuff.effects.physical_damage);
        const coroaBuff = this.timedBuffs.find(b => b.type === 'coroa_lich_buff');
        if (coroaBuff && isAbility) base *= (1 + coroaBuff.effects.ability_damage);
        return base;
    }

    getEffectiveAttackCooldown(): number {
        let cd = this.attackCooldownMs;
        const lamina = this.timedBuffs.find(b => b.type === 'lamina_geada_buff');
        if (lamina) cd *= (1 - lamina.effects.attack_speed);
        if (this.statusEffects.attackSpeedSlow.isActive) cd *= (1 + this.statusEffects.attackSpeedSlow.amount);
        if (this.skills.r.isActive && this.skillLevels.r >= 3) cd /= 1.5;
        if (this.tempBuff.type === 'attackSpeed') cd /= this.tempBuff.magnitude;
        const rainha = this.timedBuffs.find(b => b.type === 'rainha_buff');
        if (rainha) cd /= rainha.effects.attack_speed;
        return cd;
    }

    getEffectiveSkillCooldown(key: 'q' | 'w' | 'e' | 'r'): number {
        let cd = this.skills[key].cooldown;
        const essencia = this.timedBuffs.find(b => b.type === 'essencia_negra');
        if (essencia) cd *= (1 - essencia.effects.cooldown_reduction);
        // R upgrade: Distorção Temporal — Q/W/E a 1s durante ultimate
        if (this.upgradeFlags.r_reducedCooldowns && this.skills.r.isActive && key !== 'r') cd = 1000;
        return cd;
    }

    setFacingDirection(targetX: number, targetZ: number): void {
        const dir = new Vec3(targetX - this.position.x, 0, targetZ - this.position.z);
        if (dir.lengthSq() > 0.001) { dir.normalize(); this.facingDirection = dir; this.rotationY = Math.atan2(dir.x, dir.z); }
    }

    /** Updates only the projectile direction, leaving rotationY (visual) untouched */
    setFacingDirectionOnly(targetX: number, targetZ: number): void {
        const dir = new Vec3(targetX - this.position.x, 0, targetZ - this.position.z);
        if (dir.lengthSq() > 0.001) { dir.normalize(); this.facingDirection = dir; }
    }

    /** Sets facingDirection directly from normalized screen-space x/z (fallback when no raycaster) */
    setFacingDirectionFromScreen(sx: number, sz: number): void {
        const dir = new Vec3(sx, 0, sz);
        if (dir.lengthSq() > 0.001) { dir.normalize(); this.facingDirection = dir; }
    }

    setTargetPosition(targetX: number, targetZ: number): void {
        this.targetPosition = new Vec3(targetX, 0, targetZ);
    }

    getFacingDirection(): Vec3 { return this.facingDirection.clone(); }

    update(dt: number, now: number): void {
        if (this.isDead) return;
        this.updateStatusEffects(dt, now);
        this.updateBuffs(dt);
        this.updateSkills(dt);
        this.handleMovement(dt);
    }

    handleMovement(dt: number): void {
        if (this.statusEffects.stunned.isActive || this.statusEffects.frozen.isActive || this.statusEffects.rooted.isActive || this.statusEffects.lichKingPrison.isActive) return;
        if (this.skills.q.isDashing) { const dir = this.getFacingDirection(); this.position.add(dir.multiplyScalar(this.skills.q.dashSpeed * dt)); return; }
        const dir = new Vec3();
        let mx = 0, mz = 0;
        
        let spd = this.speed;
        if (this.statusEffects.slowed.isActive) spd *= (1 - this.statusEffects.slowed.amount);
        const pb = this.timedBuffs.find(b => b.type === 'planta_buff');
        if (pb) spd *= pb.effects.move_speed;

        let moved = false;
        if (this.platform === 'pc') { 
            const k = this.input.keys;
            if (k) {
                if (k.w) mz = -1;
                if (k.s) mz = 1;
                if (k.a) mx = -1;
                if (k.d) mx = 1;
            }
            if (this.statusEffects.disoriented.isActive || this.statusEffects.invertedControls.isActive) { dir.x = -mx; dir.z = -mz; } else { dir.x = mx; dir.z = mz; }
            if (dir.lengthSq() > 0) {
                dir.normalize().multiplyScalar(spd * dt);
                this.position.add(dir);
                moved = true;
            }
        } else {
            mx = this.input.joystickX || 0; mz = this.input.joystickY || 0;
            if (this.statusEffects.disoriented.isActive || this.statusEffects.invertedControls.isActive) { dir.x = -mx; dir.z = -mz; } else { dir.x = mx; dir.z = mz; }
            if (dir.lengthSq() > 0) {
                dir.normalize().multiplyScalar(spd * dt); 
                this.position.add(dir);
                this.rotationY = Math.atan2(dir.x, dir.z); 
                this.facingDirection.set(dir.x, 0, dir.z).normalize();
                moved = true;
            }
        }

        if (moved) {
            const h = CONFIG.GROUND_HALF;
            this.position.x = Math.max(-h, Math.min(h, this.position.x));
            this.position.z = Math.max(-h, Math.min(h, this.position.z));
        }
    }

    updateStatusEffects(dt: number, now: number): void {
        const ms = dt * 1000;
        for (const key in this.statusEffects) {
            const e = (this.statusEffects as any)[key];
            if (e.isActive && e.timer !== undefined) { e.timer -= ms; if (e.timer <= 0) { e.isActive = false; if (key === 'slowed') this.speed = this.originalSpeed; if (key === 'attackSpeedSlow') e.amount = 0; if (key === 'freezingConeHits') e.count = 0; if (key === 'burning') e.stacks = 0; } }
        }
        if (this.statusEffects.bleeding.isActive && now > this.statusEffects.bleeding.lastTick + 1000) { this.statusEffects.bleeding.lastTick = now; this.takeDamage(this.statusEffects.bleeding.damage, false); }
        if (this.statusEffects.burning.isActive && now > this.statusEffects.burning.lastTick + 1000) { this.statusEffects.burning.lastTick = now; this.takeDamage(this.statusEffects.burning.damagePerTick * this.statusEffects.burning.stacks, false); }
        if (this.statusEffects.lichKingLifeDrain.isActive) this.takeDamage(this.statusEffects.lichKingLifeDrain.damagePerSecond * dt, false);
    }

    updateBuffs(dt: number): void {
        const ms = dt * 1000;
        if (this.activeBuff.type) { this.activeBuff.timer -= ms; if (this.activeBuff.timer <= 0) this.clearBuff(); }
        if (this.tempBuff.type) { this.tempBuff.timer -= ms; if (this.tempBuff.timer <= 0) { this.tempBuff.type = null; this.tempBuff.timer = 0; this.tempBuff.magnitude = 0; } }
        for (let i = this.timedBuffs.length - 1; i >= 0; i--) { this.timedBuffs[i].timer -= ms; if (this.timedBuffs[i].timer <= 0) this.timedBuffs.splice(i, 1); }
    }

    updateSkills(dt: number): void {
        const ms = dt * 1000;
        if (this.skills.q.isDashing) {
            this.skills.q.timer -= ms;
            // Q upgrade: Rastro de Pólvora — minas durante dash
            if (this.upgradeFlags.q_trailMines) {
                this.dashMineTimer -= ms;
                if (this.dashMineTimer <= 0) {
                    this.dashMineTimer = 100; // 0.1s
                    this.pendingZones.push({
                        type: 'mine', x: this.position.x, z: this.position.z,
                        radius: 2, damage: this.getDamage(true) * 0.3,
                        extras: { sourceId: this.id }
                    });
                }
            }
            if (this.skills.q.timer <= 0) {
                this.skills.q.isDashing = false;
                this.dashMineTimer = 0;
                this.finishDash();
            }
        }
        const e = this.skills.e;
        if (e.isActive) {
            this.speed = this.originalSpeed;
            e.timer -= ms;
            if (e.timer <= 0 || e.shieldHp <= 0) {
                e.isActive = false;
                e.shieldHp = 0;
                this.speed = this.originalSpeed;
            }
        }
        if (this.skills.r.isActive) {
            this.skills.r.timer -= ms;
            if (this.skills.r.timer <= 0) {
                this.skills.r.isActive = false;
                // R upgrade: Singularidade do Colapso — explosão final
                if (this.upgradeFlags.r_storedExplosion && this.ultDamageStored > 0) {
                    this.pendingZones.push({
                        type: 'explosion', x: this.position.x, z: this.position.z,
                        radius: 20, damage: this.ultDamageStored * 2.0,
                        extras: { sourceId: this.id, burst: true }
                    });
                    this.ultDamageStored = 0;
                }
            }
        }
    }

    takeDamage(amount: number, fromProjectile = true, isTrueDamage = false): void {
        if (this.isDead) return;
        if (this.skills.r.isActive && !fromProjectile) {
            // R upgrade: Singularidade — armazenar dano evitado
            if (this.upgradeFlags.r_storedExplosion) this.ultDamageStored += amount;
            return;
        }
        let fd = amount;
        if (!isTrueDamage) { const pb = this.timedBuffs.find(b => b.type === 'planta_buff'); if (pb) this.heal(amount * pb.effects.lifesteal); const f = this.statusEffects.armorFracture; if (f.isActive) fd *= (1 + f.amount); }
        const e = this.skills.e;
        if (e.isActive && e.shieldHp > 0) {
            const ds = Math.min(fd, e.shieldHp); e.shieldHp -= ds; e.damageAbsorbed += ds;
            // E upgrade: Bateria de Sobrecarga — 10% dano absorvido → XP
            if (this.upgradeFlags.e_xpOnAbsorb) this.addXp(Math.floor(ds * 0.10));
            // E upgrade: Carapaça Reativa — disparo retaliatório (handled externally via flag)
            if (this.upgradeFlags.e_reactiveShield && ds > 0) {
                this.pendingProjectiles.push({
                    dir: this.getFacingDirection(), damage: ds * 0.5, fromPlayerId: this.id,
                    skillUpgrades: { ...this.selectedUpgrades }
                });
            }
            const rem = fd - ds; if (rem > 0) this.hp -= rem;
        } else this.hp -= fd;
        // E upgrade: Fortaleza Inabalável — imunidade a CC enquanto shield ativo
        if (this.upgradeFlags.e_fortress && e.isActive) {
            this.statusEffects.stunned.isActive = false;
            this.statusEffects.frozen.isActive = false;
            this.statusEffects.rooted.isActive = false;
        }
        if (this.hp <= 0) {
            this.hp = 0;
            if (!this.isDead) { this.die(); this.justDied = true; }
        }
    }

    heal(amount: number): void { this.hp = Math.min(this.maxHp, this.hp + amount); }
    die(): void { this.isDead = true; }
    addXp(amount: number): void { this.xp += amount; while (this.xp >= this.xpToNextLevel) this.levelUp(); }

    levelUp(): void {
        const pConf = getGameData().player || CONFIG.PLAYER as any;
        this.level++; const o = this.xp - this.xpToNextLevel; this.xp = o > 0 ? o : 0;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * (pConf.xpMultiplier || CONFIG.PLAYER.XP_MULTIPLIER));
        this.maxHp *= (pConf.levelHpMultiplier || CONFIG.PLAYER.LEVEL_HP_MULTIPLIER); this.hp = this.maxHp;
        // Verificar se este nível é um nível de upgrade
        const upLevels = pConf.upgradeLevels || CONFIG.PLAYER.UPGRADE_LEVELS;
        if (upLevels.includes(this.level) || UPGRADE_LEVELS.includes(this.level)) {
            this.isSelectingUpgrade = true;
            this.pendingUpgradeLevel = this.level;
        }
    }

    collectOrb(): void { this.orbsCollected++; this.score += 10; this.addXp(1 + Math.floor(this.orbsCollected / 5)); }
    upgradeSkill(key: string): void { if (key in this.skillLevels && (this.skillLevels as any)[key] < 3) (this.skillLevels as any)[key]++; }
    skipUpgrade(): void { this.isSelectingUpgrade = false; }
    activateDash(): void {
        const pConf = getGameData().player || CONFIG.PLAYER as any;
        const sq = pConf.skills?.q || CONFIG.PLAYER.SKILL_Q;
        const q = this.skills.q; q.isDashing = true; q.timer = q.duration;
        q.dashSpeed = this.skillLevels.q >= 2 ? sq.dashSpeed * 1.5 : sq.dashSpeed;
    }
    activateShield(): void {
        const pConf = getGameData().player || CONFIG.PLAYER as any;
        const se = pConf.skills?.e || CONFIG.PLAYER.SKILL_E;
        const e = this.skills.e; e.isActive = true;
        // E upgrade: Fortaleza Inabalável — 3x HP em vez de 1.5x
        const mult = this.upgradeFlags.e_fortress ? 3.0 : (se.shieldMultiplier || 1.5);
        e.maxShieldHp = this.maxHp * mult;
        e.shieldHp = e.maxShieldHp; e.timer = e.duration; e.damageAbsorbed = 0;
    }
    activateUltimate(): void {
        const r = this.skills.r; r.isActive = true;
        r.timer = r.duration;
        if (this.upgradeFlags.r_storedExplosion) this.ultDamageStored = 0;
    }

    // dashHits removido (sistema de upgrade removido)

    finishDash(): void {
        const dir = this.getFacingDirection();
        // Q upgrade: Convergência Assassina — cone estreito
        let cone = this.upgradeFlags.q_narrowCone ? Math.PI / 8 : Math.PI / 2;
        const num = 8;
        this.dashHitTracker.clear();
        for (let i = 0; i < num; i++) {
            const angle = (i / (num - 1) - 0.5) * cone;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const pDir = new Vec3(
                dir.x * cosA + dir.z * sinA,
                0,
                -dir.x * sinA + dir.z * cosA
            ).normalize();
            const proj: any = { 
                dir: pDir, 
                damage: this.getDamage(true) * 0.4, 
                fromPlayerId: this.id,
                skillUpgrades: { ...this.selectedUpgrades }
            };
            if (this.upgradeFlags.q_armorFracture) proj.specialEffect = 'q_armorFracture';
            if (this.upgradeFlags.q_narrowCone) {
                proj.specialEffect = 'q_dash_sphere';
                proj.trackHits = true;
            }
            this.pendingProjectiles.push(proj);
        }
    }

    canUseSkill(key: 'q' | 'w' | 'e' | 'r', now: number): boolean { if (this.isDead || this.statusEffects.stunned.isActive || this.statusEffects.frozen.isActive || this.statusEffects.silenced.isActive || this.statusEffects.rooted.isActive) return false; return now > this.skills[key].lastUsed + this.getEffectiveSkillCooldown(key); }
    canAttack(now: number): boolean { if (this.isDead || this.statusEffects.stunned.isActive || this.statusEffects.frozen.isActive || this.statusEffects.rooted.isActive) return false; return now > this.lastAttackTime + this.getEffectiveAttackCooldown(); }
    applyBuff(type: string): void { this.clearBuff(); this.activeBuff.type = type; this.activeBuff.timer = this.activeBuff.duration; if (type === 'guerreiro') { const b = this.maxHp * 0.20; this.maxHp += b; this.hp += b; } }
    clearBuff(): void { if (this.activeBuff.type === 'guerreiro') { this.maxHp = this.maxHp / 1.20; if (this.hp > this.maxHp) this.hp = this.maxHp; } this.activeBuff.type = null; this.activeBuff.timer = 0; this.activeBuff.attackCounter = 0; }
    applyTimedBuff(type: string, durSec: number, effects: any): void {
        const ex = this.timedBuffs.find(b => b.type === type);
        if (ex) {
            ex.timer = Math.max(ex.timer, durSec * 1000);
        } else {
            this.timedBuffs.push({ type, timer: durSec * 1000, effects });
        }
        // Initialize orbital souls for Espectro de Raziel essence
        if (type === 'essencia_espectral_raziel') {
            this.orbitalSoulDamageMultiplier = effects.soul_orbital_damage_percent || 0.05;
            this.orbitalSoulDamageFlat = effects.soul_orbital_damage_flat || 3;
            this.orbitalSoulCount = effects.soul_orbital_count || 5;
            this.orbitalSouls = [];
            for (let i = 0; i < this.orbitalSoulCount; i++) {
                this.orbitalSouls.push({
                    id: `orbital_soul_${i}_${Date.now()}`,
                    angle: (Math.PI * 2 * i) / this.orbitalSoulCount,
                    orbitSpeed: 1.5 + Math.random() * 0.5,
                    radius: 2.0 + Math.random() * 0.5,
                    fireTimer: 0,
                });
            }
        }
        // Fragmento de Código-Fonte: rewind game time
        if (type === 'fragmento_codigo_fonte') {
            // Rewind não implementado na versão atual
        }
    }
    applyTemporaryBuff(type: string, durSec: number, mag: number): void { this.tempBuff.type = type; this.tempBuff.timer = durSec * 1000; this.tempBuff.magnitude = mag; }
    applyStun(d: number): void { this.statusEffects.stunned.isActive = true; this.statusEffects.stunned.timer = Math.max(this.statusEffects.stunned.timer, d); }
    applyFreeze(d: number): void { const c = this.timedBuffs.find(b => b.type === 'coroa_lich_buff'); if (c?.effects.immunity_freeze) return; const t = this.timedBuffs.find(b => b.type === 'talisma_quebrado_buff'); if (t) d *= (1 - t.effects.freeze_reduction); if (this.statusEffects.frozen.isActive) return; this.statusEffects.frozen.isActive = true; this.statusEffects.frozen.timer = d; }
    applySlow(d: number, a: number): void { this.statusEffects.slowed.isActive = true; this.statusEffects.slowed.timer = Math.max(this.statusEffects.slowed.timer, d); this.statusEffects.slowed.amount = Math.max(this.statusEffects.slowed.amount, a); }
    applyRoot(d: number): void { this.statusEffects.rooted.isActive = true; this.statusEffects.rooted.timer = Math.max(this.statusEffects.rooted.timer, d); }
    applyBleed(d: number, dmg: number): void { const b = this.statusEffects.bleeding; b.isActive = true; b.timer = Math.max(b.timer, d); b.damage = dmg; b.lastTick = Date.now(); }
    applyBurn(d: number, dmg: number, s = 1): void { const b = this.statusEffects.burning; b.isActive = true; b.timer = Math.max(b.timer, d); b.damagePerTick = dmg; b.stacks = Math.min(b.stacks + s, 5); b.lastTick = Date.now(); }
    applyArmorFracture(d: number, a: number): void { const f = this.statusEffects.armorFracture; f.isActive = true; f.timer = Math.max(f.timer, d); f.amount = Math.max(f.amount, a); }
    applyAttackSpeedSlow(d: number, a: number): void { this.statusEffects.attackSpeedSlow.isActive = true; this.statusEffects.attackSpeedSlow.timer = Math.max(this.statusEffects.attackSpeedSlow.timer, d); this.statusEffects.attackSpeedSlow.amount = Math.max(this.statusEffects.attackSpeedSlow.amount, a); }
    applyDisorientation(d: number): void { if (this.statusEffects.disoriented.isActive) return; this.statusEffects.disoriented.isActive = true; this.statusEffects.disoriented.timer = d; }
    applyBlindness(d: number): void { this.statusEffects.blind.isActive = true; this.statusEffects.blind.timer = Math.max(this.statusEffects.blind.timer, d); }
    applySilence(d: number): void { this.statusEffects.silenced.isActive = true; this.statusEffects.silenced.timer = Math.max(this.statusEffects.silenced.timer, d); }
    applyMarcaDaAlma(d: number): void { if (this.statusEffects.marcaDaAlma.isActive) return; this.statusEffects.marcaDaAlma.isActive = true; this.statusEffects.marcaDaAlma.timer = d; }
    applyLichKingPrison(d: number): void { if (this.statusEffects.lichKingPrison.isActive) return; this.statusEffects.lichKingPrison.isActive = true; this.statusEffects.lichKingPrison.timer = d; }
    applyInvertedControls(d: number): void { if (this.statusEffects.invertedControls.isActive) return; this.statusEffects.invertedControls.isActive = true; this.statusEffects.invertedControls.timer = d; }
    clearNegativeEffects(): void { ['slowed','burning','bleeding','frozen','stunned','rooted','attackSpeedSlow','disoriented','blind','silenced','armorFracture','invertedControls'].forEach(k => { const e = (this.statusEffects as any)[k]; if (e) { e.isActive = false; e.timer = 0; if (k === 'slowed') this.speed = this.originalSpeed; if (k === 'burning') e.stacks = 0; } }); }

    /** R upgrade: Fúria Infinita — chamado externamente ao abater inimigo */
    onEnemyKilled(): void {
        if (this.upgradeFlags.r_extendOnKill && this.skills.r.isActive) {
            this.skills.r.timer += 1000; // +1s por abate
        }
    }

    toSnapshot(now: number): PlayerSnapshot {
        const fx: string[] = [];
        for (const [k, v] of Object.entries(this.statusEffects)) { if ((v as any).isActive) fx.push(k); }
        return {
            id: this.id, name: this.name, x: this.position.x, z: this.position.z, rotY: this.rotationY,
            hp: this.hp, maxHp: this.maxHp, xp: this.xp, xpNext: this.xpToNextLevel, level: this.level, score: this.score,
            shieldHp: this.skills.e.shieldHp, shieldMaxHp: this.skills.e.maxShieldHp,
            skillCooldowns: {
                q: Math.max(0, this.skills.q.lastUsed + this.getEffectiveSkillCooldown('q') - now),
                w: Math.max(0, this.skills.w.lastUsed + this.getEffectiveSkillCooldown('w') - now),
                e: Math.max(0, this.skills.e.lastUsed + this.getEffectiveSkillCooldown('e') - now),
                r: Math.max(0, this.skills.r.lastUsed + this.getEffectiveSkillCooldown('r') - now),
            },
            activeBuff: this.activeBuff.type, buffTimer: this.activeBuff.timer, tempBuff: this.tempBuff.type,
            timedBuffs: this.timedBuffs.map(b => b.type), statusEffects: fx,
            isDead: this.isDead, isDashing: this.skills.q.isDashing,
            isUltActive: this.skills.r.isActive, isShieldActive: this.skills.e.isActive,
            passiveLevel: this.skillLevels.passive, color: this.color,
            skillUpgrades: this.selectedUpgrades as any,
            isSelectingUpgrade: this.isSelectingUpgrade || undefined,
        };
    }
}
