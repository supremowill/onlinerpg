import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

/** BruxaDoGelo - Ice Witch: freezing cone, blizzard AoE, ice wall (slow), immunity to freeze */
export class BruxaDoGeloEnemy extends ServerEnemy {
    public habilidades: any;
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number; params?: any }[] = [];

    private currentState: 'laning' | 'engaging' | 'peeling' | 'zhonya' = 'laning';

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'BruxaDoGelo';
        this.name = 'Bruxa do Gelo';
        const c = CONFIG.BRUXA_DO_GELO;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier * 1.5; // Buff HP for teamfights
        this.hp = this.maxHp;
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.speed;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.damage = 18 * globalMultiplier;
        this.position.y = 1.0;

        // Load cooldowns dynamically from CONFIG
        this.habilidades = {
            q: { cooldown: c.SKILL_Q_COOLDOWN || 4000, lastUsed: 0 },
            w: { cooldown: c.SKILL_W_COOLDOWN || 10000, lastUsed: 0 },
            e: { cooldown: c.SKILL_E_COOLDOWN || 16000, lastUsed: 0, state: 'idle', pos: new Vec3(0,0,0), dir: new Vec3(0,0,0), timer: 0, maxDuration: 2500 },
            r: { cooldown: c.SKILL_R_COOLDOWN || 60000, lastUsed: 0 },
            zhonya: { cooldown: c.ZHONYA_COOLDOWN || 90000, lastUsed: 0, active: false, timer: 0 }
        };
    }

    getPriorityTarget(players: ServerPlayer[]): ServerPlayer | null {
        let bestTarget: ServerPlayer | null = null;
        let lowestHp = Infinity;
        for (const p of players) {
            if (p.isDead) continue;
            if (p.hp < lowestHp) { 
                lowestHp = p.hp;
                bestTarget = p;
            }
        }
        return bestTarget;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const now = Date.now();
        const ms = dt * 1000;

        // --- ZHONYA STATE ---
        if (this.habilidades.zhonya.active) {
            this.habilidades.zhonya.timer -= ms;
            if (this.habilidades.zhonya.timer <= 0) {
                this.habilidades.zhonya.active = false;
                this.isInvulnerable = false;
            }
            return;
        }

        if (this.updateStatus(dt)) return;

        const pTarget = this.getPriorityTarget(players);
        const closestTarget = this.getClosestPlayer(players);
        if (!closestTarget || !pTarget) return;

        const distToClosest = this.position.distanceToXZ(closestTarget.position);

        // --- E (GLACIAL PATH) LOGIC ---
        if (this.habilidades.e.state === 'moving') {
            this.habilidades.e.timer += ms;
            this.habilidades.e.pos.add(this.habilidades.e.dir.clone().multiplyScalar(4 * dt)); // Claw moves at speed 4
            
            const clawDistToTarget = this.habilidades.e.pos.distanceToXZ(pTarget.position);
            
            // Pro Player recast E: Recast instantly if it hits the target OR max duration reached
            if (clawDistToTarget < 3 || this.habilidades.e.timer >= this.habilidades.e.maxDuration) {
                // Teleport to claw
                this.position.copy(this.habilidades.e.pos);
                this.habilidades.e.state = 'idle';
                
                // PRO COMBO: E -> W -> R -> Q
                
                // Insta W after teleport
                if (now > this.habilidades.w.lastUsed + this.habilidades.w.cooldown) {
                    this.habilidades.w.lastUsed = now;
                    this.pendingAbilities.push({ type: 'ice_w_root', x: this.position.x, z: this.position.z, radius: 5, damage: this.damage * 1.5 });
                }

                // Insta R after W if available
                if (now > this.habilidades.r.lastUsed + this.habilidades.r.cooldown) {
                    this.habilidades.r.lastUsed = now;
                    if (this.hp / this.maxHp <= 0.3) {
                        // Self R if low
                        const missingHp = this.maxHp - this.hp;
                        this.hp = Math.min(this.maxHp, this.hp + (missingHp * 0.5)); 
                        this.habilidades.zhonya.active = true;
                        this.habilidades.zhonya.timer = 1500;
                        this.isInvulnerable = true;
                        this.pendingAbilities.push({ type: 'ice_r_self', x: this.position.x, z: this.position.z, radius: 8, damage: this.damage * 3 });
                    } else {
                        // R on target
                        this.pendingAbilities.push({ type: 'ice_r_stun', targetId: pTarget.id, x: pTarget.position.x, z: pTarget.position.z, radius: 8, damage: this.damage * 3 });
                    }
                }

                // Insta Q
                if (now > this.habilidades.q.lastUsed + this.habilidades.q.cooldown) {
                    this.habilidades.q.lastUsed = now;
                    const qDir = pTarget.position.clone().sub(this.position); qDir.y = 0; qDir.normalize();
                    this.pendingProjectiles.push({ dir: qDir, damage: this.damage, specialEffect: 'ice_q_shard', speed: 18 });
                }
            }
            return; // While E is moving, she focuses on the recast timing
        }

        // --- LOW HP DEFENSIVE ZHONYA ---
        // Pro players Zhonya immediately when about to die to avoid burst
        if (this.hp / this.maxHp < 0.25 && now > this.habilidades.zhonya.lastUsed + this.habilidades.zhonya.cooldown) {
            this.habilidades.zhonya.lastUsed = now;
            this.habilidades.zhonya.active = true;
            this.habilidades.zhonya.timer = 2500;
            this.isInvulnerable = true;
            this.pendingAbilities.push({ type: 'zhonya_effect', x: this.position.x, z: this.position.z });
            return;
        }

        // --- DEFENSIVE W ---
        // If an enemy gets too close (melee range), use W to root them and run away
        if (distToClosest < 4.5 && now > this.habilidades.w.lastUsed + this.habilidades.w.cooldown) {
            this.habilidades.w.lastUsed = now;
            this.pendingAbilities.push({ type: 'ice_w_root', x: this.position.x, z: this.position.z, radius: 5, damage: this.damage * 1.5 });
        }

        // --- AGGRESSIVE / DEFENSIVE E (GLACIAL PATH) ENGAGE ---
        let clusteredCount = 0;
        for (const p of players) {
            if (!p.isDead && p.position.distanceToXZ(pTarget.position) < 6) clusteredCount++;
        }

        if (now > this.habilidades.e.lastUsed + this.habilidades.e.cooldown) {
            // Pro decision: Engage if we can kill (target < 50% HP) OR if enemies are clumped up for a multi-man W/R
            const canEngage = (pTarget.hp / pTarget.maxHp < 0.5) || clusteredCount >= 2;
            // Pro decision: Disengage if we are low HP and someone is chasing us
            const needsEscape = (this.hp / this.maxHp < 0.4 && distToClosest < 6);

            if (canEngage || needsEscape) {
                this.habilidades.e.lastUsed = now;
                this.habilidades.e.state = 'moving';
                this.habilidades.e.pos = this.position.clone();
                this.habilidades.e.timer = 0;
                
                if (needsEscape) {
                    // Cast E away from closest target
                    this.habilidades.e.dir = this.position.clone().sub(closestTarget.position); 
                } else {
                    // Cast E directly towards priority target to engage
                    this.habilidades.e.dir = pTarget.position.clone().sub(this.position); 
                }
                this.habilidades.e.dir.y = 0; 
                this.habilidades.e.dir.normalize();
                
                this.pendingAbilities.push({ type: 'ice_e_claw_spawn', x: this.position.x, z: this.position.z, dirX: this.habilidades.e.dir.x, dirZ: this.habilidades.e.dir.z });
                return;
            }
        }

        // --- KITING & MOVEMENT ---
        // Pro players maintain perfect max range to throw Q
        const idealRange = 10;
        if (distToClosest > idealRange) {
            this.moveTowards(closestTarget.position, dt);
        } else if (distToClosest < 7) {
            const away = this.position.clone().sub(closestTarget.position); away.y = 0; away.normalize();
            this.position.add(away.multiplyScalar(this.speed * dt));
        }

        // --- Q (ICE SHARD) POKE ---
        if (now > this.habilidades.q.lastUsed + this.habilidades.q.cooldown) {
            this.habilidades.q.lastUsed = now;
            
            // Aim at priority target if in range, otherwise closest
            const targetForQ = this.position.distanceToXZ(pTarget.position) < 18 ? pTarget : closestTarget;
            const distToQ = this.position.distanceToXZ(targetForQ.position);
            
            if (distToQ < 18) {
                const timeToTarget = distToQ / 18.0;
                const targetVel = (targetForQ as any).slideVelocity || new Vec3(0, 0, 0);
                // Pro players predict movement
                const predictedPos = targetForQ.position.clone().add(targetVel.clone().multiplyScalar(timeToTarget));

                const dir = predictedPos.sub(this.position); dir.y = 0; dir.normalize();
                this.pendingProjectiles.push({ dir, damage: this.damage, specialEffect: 'ice_q_shard', speed: 18 });
            }
        }

        // --- EMERGENCY R ---
        // If R is available and she hasn't comboed, but target is very low or she is dying
        if (now > this.habilidades.r.lastUsed + this.habilidades.r.cooldown) {
            if (this.hp / this.maxHp <= 0.2) {
                // Panic self R
                this.habilidades.r.lastUsed = now;
                const missingHp = this.maxHp - this.hp;
                this.hp = Math.min(this.maxHp, this.hp + (missingHp * 0.5)); 
                this.habilidades.zhonya.active = true;
                this.habilidades.zhonya.timer = 1500;
                this.isInvulnerable = true;
                this.pendingAbilities.push({ type: 'ice_r_self', x: this.position.x, z: this.position.z, radius: 8, damage: this.damage * 3 });
            } else if (distToClosest < 8 && pTarget.hp / pTarget.maxHp < 0.3) {
                // Kill steal / execute with R without needing E
                this.habilidades.r.lastUsed = now;
                this.pendingAbilities.push({ type: 'ice_r_stun', targetId: pTarget.id, x: pTarget.position.x, z: pTarget.position.z, radius: 8, damage: this.damage * 3 });
            }
        }

        this.lookAt(closestTarget.position);
    }
}

/** EscravoGlacial - spawned when PurpleCube dies near Bruxa */
export class EscravoGlacialEnemy extends ServerEnemy {
    public lifetime: number = 5000;
    
    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'EscravoGlacial';
        this.name = 'Escravo Glacial';
        this.maxHp = 100 * globalMultiplier;
        this.hp = this.maxHp;
        this.speed = 4.0;
        this.originalSpeed = 4.0;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 1.0;
        this.damage = 30 * globalMultiplier;
        this.position.y = 1.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        this.lifetime -= dt * 1000;
        
        const target = this.getClosestPlayer(players);
        if (target) {
            const dist = this.position.distanceToXZ(target.position);
            if (dist < 4) {
                target.applySlow(1000, 0.4); 
            }
            this.moveTowards(target.position, dt);
            this.lookAt(target.position);
        }

        if (this.lifetime <= 0) {
            this.isDestroyed = true;
            (this as any).pendingAbilities = (this as any).pendingAbilities || [];
            (this as any).pendingAbilities.push({ type: 'ice_slave_explosion', x: this.position.x, z: this.position.z, radius: 5, damage: this.damage });
        }
    }
}


/** FarsanteCarmesim - Mestra da Ilusao rework inspired by assassin illusionist play */
export class FarsanteCarmesimEnemy extends ServerEnemy {
    public habilidades: any;
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number; lifetime?: number }[] = [];
    private markedTargets: Map<string, number> = new Map();
    private activeChain: { target: ServerPlayer; timer: number; mimic: boolean } | null = null;
    private distortionReturn: { startPos: Vec3; expiresAt: number; returnAt: number } | null = null;
    private lastBasicSpell: 'q' | 'w' | 'e' | null = null;
    private passiveUsed = false;
    private cloneCooldownUntil = 0;
    private stealthTimer = 0;
    private isInDesperation = false;
    private isDistorting = false;

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'MestraDaIlusao';
        this.name = 'A Farsante Carmesim';
        const c = CONFIG.MESTRA_DA_ILUSAO;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier * (c.HP_MULTIPLIER || 1.35);
        this.hp = this.maxHp;
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.damage = (c.BASE_DAMAGE || 18) * globalMultiplier;
        this.position.y = 1.0;

        this.habilidades = {
            q: { cooldown: c.SKILL_Q_COOLDOWN || 6000, lastUsed: 0, range: c.SKILL_Q_RANGE || 16 },
            w: { cooldown: c.SKILL_W_COOLDOWN || 10000, lastUsed: 0, range: c.SKILL_W_RANGE || 8 },
            e: { cooldown: c.SKILL_E_COOLDOWN || 12000, lastUsed: 0, range: c.SKILL_E_RANGE || 14 },
            r: { cooldown: c.SKILL_R_COOLDOWN || 22000, lastUsed: 0 },
            clone: { cooldown: c.CLONE_COOLDOWN || 14000 },
        };
    }

    takeDamage(amount: number, instigator?: ServerPlayer | null, countsForPassive = true, hpPercent = 0, isTrueDamage = false): void {
        if (this.stealthTimer > 0 || this.isInvulnerable) return;
        super.takeDamage(amount, instigator ?? null, countsForPassive, hpPercent, isTrueDamage);
    }

    public applyArcaneMark(playerId: string, durationMs: number): void {
        this.markedTargets.set(playerId, Date.now() + durationMs);
    }

    public hasArcaneMark(playerId: string): boolean {
        const now = Date.now();
        const expiresAt = this.markedTargets.get(playerId);
        if (!expiresAt || expiresAt <= now) {
            this.markedTargets.delete(playerId);
            return false;
        }
        return true;
    }

    public consumeArcaneMark(playerId: string, multiplier = 1): number {
        if (!this.hasArcaneMark(playerId)) return 0;
        this.markedTargets.delete(playerId);
        return this.damage * 2.1 * multiplier;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const now = Date.now();

        if (this.stealthTimer > 0) {
            this.stealthTimer -= dt * 1000;
            if (this.stealthTimer <= 0) {
                this.isInvulnerable = false;
                this.pendingAbilities.push({ type: 'mestra_reappear', x: this.position.x, z: this.position.z });
            }
            return;
        }

        if (this.updateStatus(dt)) return;

        const alivePlayers = players.filter(p => !p.isDead);
        if (alivePlayers.length === 0) return;

        this.cleanupMarks(now);
        this.updateActiveChain(dt);
        this.updateDistortionReturn(now);

        const target = this.selectTarget(alivePlayers);
        if (!target) return;

        const hpRatio = this.hp / this.maxHp;
        if (!this.passiveUsed && hpRatio <= 0.4) {
            this.triggerMirrorImage(target, true);
            return;
        }

        this.isInDesperation = hpRatio <= 0.25;
        this.speed = this.originalSpeed * (this.isInDesperation ? 1.35 : hpRatio < 0.5 ? 1.15 : 1);

        const dist = this.position.distanceToXZ(target.position);
        const cooldownScale = this.isInDesperation ? 0.72 : 1;

        if (hpRatio < 0.5 && dist < 5 && now > this.cloneCooldownUntil) {
            this.triggerMirrorImage(target, false);
            this.cloneCooldownUntil = now + this.habilidades.clone.cooldown;
            return;
        }

        if (now > this.habilidades.r.lastUsed + this.habilidades.r.cooldown * cooldownScale && this.shouldMimic(target, dist)) {
            this.habilidades.r.lastUsed = now;
            this.castMimic(target, dist);
        } else if (this.hasArcaneMark(target.id) && now > this.habilidades.w.lastUsed + this.habilidades.w.cooldown * cooldownScale && dist < 11) {
            this.castDistortion(target, false, now);
        } else if (!this.hasArcaneMark(target.id) && now > this.habilidades.q.lastUsed + this.habilidades.q.cooldown * cooldownScale && dist < this.habilidades.q.range) {
            this.castArcaneMark(target, false, now);
        } else if (!this.activeChain && now > this.habilidades.e.lastUsed + this.habilidades.e.cooldown * cooldownScale && dist < this.habilidades.e.range && (this.hasArcaneMark(target.id) || dist > 7 || this.isInDesperation)) {
            this.castEtherealChains(target, false, now);
        }

        this.kiteAround(target, dist, dt);
        this.lookAt(target.position);
    }

    private cleanupMarks(now: number): void {
        for (const [playerId, expiresAt] of this.markedTargets.entries()) {
            if (expiresAt <= now) this.markedTargets.delete(playerId);
        }
    }

    private updateActiveChain(dt: number): void {
        if (!this.activeChain) return;
        const chain = this.activeChain;
        if (chain.target.isDead || this.position.distanceToXZ(chain.target.position) > (chain.mimic ? 18 : 15)) {
            this.pendingAbilities.push({ type: 'mestra_chain_break', x: chain.target.position.x, z: chain.target.position.z });
            this.activeChain = null;
            return;
        }
        chain.timer += dt * 1000;
        const rootTime = chain.mimic ? 1000 : 1500;
        if (chain.timer >= rootTime) {
            this.pendingAbilities.push({
                type: 'mestra_chain_root',
                targetId: chain.target.id,
                x: chain.target.position.x,
                z: chain.target.position.z,
                damage: this.damage * (chain.mimic ? 2.2 : 1.35),
                rootDuration: chain.mimic ? 2200 : 1600,
                mimic: chain.mimic
            });
            this.activeChain = null;
        }
    }

    private updateDistortionReturn(now: number): void {
        if (!this.distortionReturn) return;
        if (now >= this.distortionReturn.returnAt || now >= this.distortionReturn.expiresAt) {
            const returnPos = this.distortionReturn.startPos.clone();
            this.pendingAbilities.push({ type: 'mestra_distortion_return', x: this.position.x, z: this.position.z, targetX: returnPos.x, targetZ: returnPos.z });
            this.position.copy(returnPos);
            this.distortionReturn = null;
            this.isDistorting = false;
        }
    }

    private selectTarget(players: ServerPlayer[]): ServerPlayer | null {
        let best: ServerPlayer | null = null;
        let bestScore = -Infinity;
        for (const p of players) {
            const dist = this.position.distanceToXZ(p.position);
            let nearestAlly = Infinity;
            for (const other of players) {
                if (other.id === p.id) continue;
                nearestAlly = Math.min(nearestAlly, p.position.distanceToXZ(other.position));
            }
            let score = 0;
            score += (1 - p.hp / p.maxHp) * 45;
            if (nearestAlly > 12) score += 30;
            if (this.hasArcaneMark(p.id)) score += 25;
            if (dist > 7 && dist < 18) score += 12;
            if (dist > 22) score -= 35;
            if (p.skills?.e?.isActive) score -= 15;
            if (score > bestScore) {
                bestScore = score;
                best = p;
            }
        }
        return best;
    }

    private shouldMimic(target: ServerPlayer, dist: number): boolean {
        if (!this.lastBasicSpell) return target.hp / target.maxHp < 0.35 || this.isInDesperation;
        if (target.hp / target.maxHp < 0.45 && this.hasArcaneMark(target.id)) return true;
        if (this.hp / this.maxHp < 0.35 && this.lastBasicSpell === 'w') return true;
        return this.isInDesperation && dist < 14;
    }

    private castArcaneMark(target: ServerPlayer, mimic: boolean, now: number): void {
        if (!mimic) {
            this.habilidades.q.lastUsed = now;
            this.lastBasicSpell = 'q';
        }
        this.pendingAbilities.push({
            type: 'mestra_arcane_mark',
            targetId: target.id,
            x: target.position.x,
            z: target.position.z,
            damage: this.damage * (mimic ? 1.7 : 1.0),
            markDuration: mimic ? 2500 : 3500,
            detonationMultiplier: mimic ? 1.35 : 1,
            mimic
        });
    }

    private castDistortion(target: ServerPlayer, mimic: boolean, now: number): void {
        if (!mimic) {
            this.habilidades.w.lastUsed = now;
            this.lastBasicSpell = 'w';
        }
        const startPos = this.position.clone();
        const targetVel = (target as any).slideVelocity || new Vec3(0, 0, 0);
        const aimPos = target.position.clone().add(targetVel.clone().multiplyScalar(0.35));
        const dir = aimPos.sub(this.position);
        dir.y = 0;
        if (dir.lengthSq() <= 0.001) return;
        dir.normalize();
        const dashDistance = Math.min(mimic ? 9 : 7, Math.max(4, this.position.distanceToXZ(target.position)));
        this.position.add(dir.multiplyScalar(dashDistance));
        this.position.x = Math.max(-48, Math.min(48, this.position.x));
        this.position.z = Math.max(-48, Math.min(48, this.position.z));
        this.distortionReturn = {
            startPos,
            expiresAt: now + 4000,
            returnAt: now + (mimic || this.hp / this.maxHp < 0.45 ? 850 : 1250)
        };
        this.isDistorting = true;
        this.pendingAbilities.push({
            type: 'mestra_distortion_impact',
            x: this.position.x,
            z: this.position.z,
            fromX: startPos.x,
            fromZ: startPos.z,
            radius: mimic ? 4.2 : 3.3,
            damage: this.damage * (mimic ? 2.0 : 1.45),
            detonationMultiplier: mimic ? 1.25 : 1,
            mimic
        });
    }

    private castEtherealChains(target: ServerPlayer, mimic: boolean, now: number): void {
        if (!mimic) {
            this.habilidades.e.lastUsed = now;
            this.lastBasicSpell = 'e';
        }
        this.activeChain = { target, timer: 0, mimic };
        this.pendingAbilities.push({
            type: 'mestra_chain_start',
            targetId: target.id,
            x: this.position.x,
            z: this.position.z,
            targetX: target.position.x,
            targetZ: target.position.z,
            damage: this.damage * (mimic ? 1.35 : 0.85),
            detonationMultiplier: mimic ? 1.2 : 1,
            mimic
        });
    }

    private castMimic(target: ServerPlayer, dist: number): void {
        let spell = this.lastBasicSpell;
        if (!spell) spell = this.hasArcaneMark(target.id) || target.hp / target.maxHp < 0.4 ? 'q' : dist > 9 ? 'w' : 'e';
        this.pendingAbilities.push({ type: 'mestra_mimic_cast', x: this.position.x, z: this.position.z, spell });
        const now = Date.now();
        if (spell === 'q') this.castArcaneMark(target, true, now);
        else if (spell === 'w') this.castDistortion(target, true, now);
        else this.castEtherealChains(target, true, now);
    }

    private triggerMirrorImage(target: ServerPlayer, isPassive: boolean): void {
        if (isPassive) this.passiveUsed = true;
        this.stealthTimer = isPassive ? 1000 : 650;
        this.isInvulnerable = true;
        const toTarget = target.position.clone().sub(this.position);
        toTarget.y = 0;
        if (toTarget.lengthSq() <= 0.001) toTarget.set(1, 0, 0);
        toTarget.normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const flank = new Vec3(-toTarget.z * side, 0, toTarget.x * side);
        const cloneDir = toTarget.clone().multiplyScalar(0.7).add(flank.clone().multiplyScalar(-0.3)).normalize();
        this.pendingAbilities.push({
            type: 'spawnClone',
            x: this.position.x,
            z: this.position.z,
            dirX: cloneDir.x,
            dirZ: cloneDir.z,
            lifetime: isPassive ? 8000 : 4500,
            speed: isPassive ? 4.2 : 3.3,
            ownerId: this.id
        });
        this.pendingAbilities.push({ type: 'mestra_passive_vanish', x: this.position.x, z: this.position.z, passive: isPassive });

        this.position.x = Math.max(-48, Math.min(48, target.position.x + flank.x * 5 - toTarget.x * 2));
        this.position.z = Math.max(-48, Math.min(48, target.position.z + flank.z * 5 - toTarget.z * 2));
    }

    private kiteAround(target: ServerPlayer, dist: number, dt: number): void {
        if (this.isDistorting) return;
        const idealRange = this.hasArcaneMark(target.id) ? 9 : 12;
        const toTarget = target.position.clone().sub(this.position);
        toTarget.y = 0;
        if (toTarget.lengthSq() <= 0.001) return;
        toTarget.normalize();
        if (dist > idealRange + 2) {
            this.position.add(toTarget.multiplyScalar(this.speed * dt));
        } else if (dist < idealRange - 2) {
            this.position.add(toTarget.multiplyScalar(-this.speed * dt));
        } else {
            const strafe = new Vec3(-toTarget.z, 0, toTarget.x);
            this.position.add(strafe.multiplyScalar(this.speed * 0.55 * dt));
        }
        this.position.x = Math.max(-48, Math.min(48, this.position.x));
        this.position.z = Math.max(-48, Math.min(48, this.position.z));
    }

    toSnapshot(): any {
        const base = super.toSnapshot();
        return {
            ...base,
            isInvulnerable: this.isInvulnerable || this.stealthTimer > 0 || undefined,
            isTeleporting: this.isDistorting || this.stealthTimer > 0 || undefined,
            isChanneling: !!this.activeChain || undefined,
        };
    }
}

/** MestraDaIlusao - Illusion Mistress */
export class MestraDaIlusaoEnemy extends ServerEnemy {
    public habilidades = {
        h1: { cooldown: 6000, lastUsed: 0, state: 'idle' as 'idle' | 'dashing' | 'returning', startPos: null as Vec3 | null, returnTimer: 0 },
        h2: { cooldown: 10000, lastUsed: 0, state: 'idle' as 'idle' | 'linking', linkTimer: 0, target: null as ServerPlayer | null },
        h3: { cooldown: 12000, lastUsed: 0 }
    };
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string }[] = [];
    private damageReduction = 0;

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'MestraDaIlusao';
        this.name = 'Mestra da Ilusão';
        const c = CONFIG.MESTRA_DA_ILUSAO;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier;
        this.hp = this.maxHp;
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.damage = 12 * globalMultiplier;
        this.position.y = 1.0;
    }

    takeDamage(amount: number, instigator?: ServerPlayer | null): void {
        const now = Date.now();
        if (now > this.habilidades.h3.lastUsed + this.habilidades.h3.cooldown) {
            this.habilidades.h3.lastUsed = now;
            this.pendingAbilities.push({ type: 'spawnClone', x: this.position.x + 1, z: this.position.z + 1 });
            this.position.x += (Math.random() * 4 - 2);
            this.position.z += (Math.random() * 4 - 2);
            return; // completely dodge the damage!
        }
        const finalDamage = amount * (1 - this.damageReduction);
        super.takeDamage(finalDamage, instigator ?? null);
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();
        const dist = this.position.distanceToXZ(target.position);

        this.damageReduction = (this.hp >= this.maxHp) ? 0.25 : 0;
        this.speed = (this.hp / this.maxHp < 0.5) ? this.originalSpeed * 1.25 : this.originalSpeed;

        const h1 = this.habilidades.h1;
        if (h1.state !== 'idle') {
            if (h1.state === 'dashing') {
                h1.returnTimer -= dt * 1000;
                if (h1.returnTimer <= 0) {
                    h1.state = 'returning';
                    this.pendingAbilities.push({ type: 'dashExplosion', x: this.position.x, z: this.position.z, radius: 1.5, damage: 20 + target.maxHp * 0.03 });
                }
            } else if (h1.state === 'returning' && h1.startPos) {
                const returnDir = h1.startPos.clone().sub(this.position);
                returnDir.y = 0;
                if (returnDir.lengthSq() < 1) {
                    this.position.copy(h1.startPos);
                    this.pendingAbilities.push({ type: 'dashExplosion', x: this.position.x, z: this.position.z, radius: 1.5, damage: 20 + target.maxHp * 0.03 });
                    h1.state = 'idle';
                } else {
                    this.position.add(returnDir.normalize().multiplyScalar(this.speed * 2 * dt));
                }
            }
            return;
        }

        const h2 = this.habilidades.h2;
        if (h2.state === 'linking' && h2.target) {
            const distToTarget = this.position.distanceToXZ(h2.target.position);
            if (distToTarget > 15 || h2.target.isDead) {
                h2.state = 'idle';
                h2.target = null;
            } else {
                h2.linkTimer += dt * 1000;
                if (h2.linkTimer >= 2000) {
                    h2.target.takeDamage(15 + h2.target.maxHp * 0.015, false, false, this);
                    h2.target.applyRoot(2000);
                    h2.state = 'idle';
                    h2.target = null;
                }
            }
        }

        if (now > h2.lastUsed + h2.cooldown && dist < 12 && h2.state === 'idle') {
            h2.lastUsed = now;
            h2.state = 'linking';
            h2.linkTimer = 0;
            h2.target = target;
        } else if (now > h1.lastUsed + h1.cooldown && dist < 10 && h1.state === 'idle') {
            h1.lastUsed = now;
            h1.state = 'dashing';
            h1.returnTimer = 2000;
            h1.startPos = this.position.clone();
            const dashDir = target.position.clone().sub(this.position); dashDir.y = 0; dashDir.normalize();
            this.position.add(dashDir.multiplyScalar(5));
        }

        const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
        this.position.add(dir.multiplyScalar(this.speed * dt));
        this.lookAt(target.position);
    }
}

/** BombardeiroInsano - Insane Bomber (Ziggs-like): bouncing bombs (Q), satchel charge (W), mine field (E), mega inferno (R) */
export class BombardeiroInsanoEnemy extends ServerEnemy {
    private habilidades = {
        q: { cooldown: 4000, lastUsed: 0 },
        w: { cooldown: 12000, lastUsed: 0 },
        e: { cooldown: 18000, lastUsed: 0 },
        r: { cooldown: 35000, lastUsed: 0 }
    };
    public pendingAbilities: any[] = [];
    public pendingProjectiles: { dir: Vec3; damage: number; specialEffect?: string; speed?: number; params?: any }[] = [];

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'BombardeiroInsano';
        this.name = 'Bombardeiro Insano';
        const c = CONFIG.BOMBARDEIRO_INSANO;
        this.maxHp = this.getRegHp(c.BASE_HP) * globalMultiplier;
        this.hp = this.maxHp;
        this.speed = this.getRegSpeed(c.SPEED) * 1.2; // A bit faster to kite
        this.originalSpeed = this.speed;
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.damage = this.getRegDamage(35) * globalMultiplier;
        this.position.y = 1.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const dist = this.position.distanceToXZ(target.position);
        const now = Date.now();
        const ms = dt * 1000;

        // Kiting logic
        if (dist < 8) {
            const away = this.position.clone().sub(target.position); away.y = 0; away.normalize();
            this.position.add(away.multiplyScalar(this.speed * dt));
        } else if (dist > 16) {
            this.moveTowards(target.position, dt);
        }

        // Q - Bomba Saltitante (Bouncing Bomb)
        // Uses movement prediction to lead the target
        if (now > this.habilidades.q.lastUsed + this.habilidades.q.cooldown && dist < 22) {
            this.habilidades.q.lastUsed = now;
            const projectileSpeed = 12.0;
            const timeToTarget = dist / projectileSpeed;
            // Predict target position
            const targetVel = (target as any).slideVelocity || new Vec3(0, 0, 0);
            const predictedPos = target.position.clone().add(targetVel.clone().multiplyScalar(timeToTarget * 0.8)); // 0.8 to not overpredict too much
            
            const dir = predictedPos.clone().sub(this.position); dir.y = 0; dir.normalize();
            this.pendingProjectiles.push({
                dir,
                damage: this.damage * 1.5,
                specialEffect: 'bomba_saltitante',
                speed: projectileSpeed
            });
        }

        // W - Carga Concentrada (Satchel Charge)
        // Used defensively when players get too close
        if (now > this.habilidades.w.lastUsed + this.habilidades.w.cooldown && dist < 6) {
            this.habilidades.w.lastUsed = now;
            // Throw between self and target to blow both away
            const midPoint = this.position.clone().add(target.position).multiplyScalar(0.5);
            this.pendingAbilities.push({
                type: 'satchel_charge',
                x: midPoint.x, z: midPoint.z,
                damage: this.damage * 0.5,
                radius: 4,
                duration: 1500, // Explodes after 1.5s
                sourceId: this.id
            });
        }

        // E - Campo Minado Hexplosivo (Minefield)
        if (now > this.habilidades.e.lastUsed + this.habilidades.e.cooldown && dist < 15) {
            this.habilidades.e.lastUsed = now;
            // Predict a bit where to scatter mines
            const targetVel = (target as any).slideVelocity || new Vec3(0, 0, 0);
            const centerPos = target.position.clone().add(targetVel.clone().multiplyScalar(1.0));
            
            this.pendingAbilities.push({
                type: 'hexplosive_minefield',
                x: centerPos.x, z: centerPos.z,
                count: 8,
                radius: 6,
                mineDamage: this.damage * 1.2,
                mineRadius: 1.5,
                duration: 20000 // 20s mines
            });
        }

        // R - Mega Bomba Infernal (Mega Inferno Bomb)
        if (now > this.habilidades.r.lastUsed + this.habilidades.r.cooldown && dist < 20) {
            this.habilidades.r.lastUsed = now;
            this.pendingAbilities.push({
                type: 'mega_inferno_bomb',
                x: target.position.x, z: target.position.z, // Directly on target's current pos, huge AoE
                radius: 12,
                damage: this.damage * 4,
                duration: 3500 // 3.5s warning
            });
        }

        this.lookAt(target.position);
    }
}

// ============================================================
// CloneIlusorio - illusion clone spawned by MestraDaIlusao
// Matches index.html: 3s lifetime, 1 HP, applies disorientation on hit
// ============================================================
export class CloneIlusorioEnemy extends ServerEnemy {
    public lifetime: number = 3000; // 3 seconds
    public moveDir: Vec3 = new Vec3(0, 0, 0);

    constructor(pos: Vec3, globalMultiplier: number) {
        super(pos);
        this.type = 'CloneIlusorio';
        this.name = 'Clone Ilusório';
        this.maxHp = 1;
        this.hp = 1;
        this.speed = 0;
        this.originalSpeed = 0;
        this.xp = 0;
        this.score = 0;
        this.hitboxRadius = 0.8;
        this.position.y = 1.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        this.lifetime -= dt * 1000;
        if (this.moveDir.lengthSq() > 0.001 && this.speed > 0) {
            this.position.add(this.moveDir.clone().normalize().multiplyScalar(this.speed * dt));
            this.position.x = Math.max(-48, Math.min(48, this.position.x));
            this.position.z = Math.max(-48, Math.min(48, this.position.z));
            this.rotationY = Math.atan2(this.moveDir.x, this.moveDir.z);
        }
        if (this.lifetime <= 0) {
            this.isDestroyed = true;
        }
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        // Only players can damage clones (and trigger disorientation)
        if (instigator) {
            instigator.applyDisorientation(1000);
        }
        this.isDestroyed = true;
        // No XP/score for destroying clones
    }
}
