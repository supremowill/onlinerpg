import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

export interface SoulOrb {
    id: string;
    position: Vec3; // relative offset for orbiting
    angle: number;
    orbitSpeed: number;
    radius: number;
}

export class EspectroDeRazielEnemy extends ServerEnemy {
    public soulsAbsorbed: number = 0;
    public damageMultiplier: number = 1.0;
    public speedMultiplier: number = 1.0;
    public sizeMultiplier: number = 1.0;
    public readonly auraRadius: number = CONFIG.ESPECTRO_DE_RAZIEL.AURA_RADIUS;
    public orbitingSouls: SoulOrb[] = [];
    private absorbedBodyIds: Set<string> = new Set();
    public skill1Cooldown: number = 0; // Fenda de Garras
    public skill2Cooldown: number = 0; // Vórtice Sombrio
    private skill3Cooldown: number = 0; // Expurgo de Almas
    private skill4Cooldown: number = 0; // Transição Material

    // Soul orbs for visualization
    // (orbitingSouls is declared above at line 20)

    // State
    private playerLevel: number;
    public isTeleporting: boolean = false;
    public vortexActive: boolean = false;
    public vortexTimer: number = 0;
    public teleportTimer: number = 0;
    public pendingProjectiles: any[] = [];
    public pendingAbilities: any[] = [];

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.playerLevel = playerLevel;
        this.type = 'EspectroDeRaziel';
        this.name = 'Espectro de Raziel';
        const c = CONFIG.ESPECTRO_DE_RAZIEL;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) * globalMult;
        this.speed = this.getRegSpeed(c.SPEED);
        this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP);
        this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.5; // Octahedron height
    }

    update(dt: number, players: ServerPlayer[], gameTime: number, deadBodies: { position: Vec3; id: string }[] = []): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;

        const ms = dt * 1000;

        // Update cooldowns
        this.skill1Cooldown = Math.max(0, this.skill1Cooldown - ms);
        this.skill2Cooldown = Math.max(0, this.skill2Cooldown - ms);
        this.skill3Cooldown = Math.max(0, this.skill3Cooldown - ms);
        this.skill4Cooldown = Math.max(0, this.skill4Cooldown - ms);

        // Update vortex timer
        if (this.vortexActive) {
            this.vortexTimer -= ms;
            if (this.vortexTimer <= 0) this.vortexActive = false;
        }

        // Update teleport timer
        if (this.isTeleporting) {
            this.teleportTimer -= ms;
            if (this.teleportTimer <= 0) this.isTeleporting = false;
        }

        // Update orbiting souls
        for (const soul of this.orbitingSouls) {
            soul.angle += soul.orbitSpeed * dt;
        }

        // Passive: absorb nearby dead bodies
        this.absorbSouls(deadBodies);

        // Behavior: opportunistic - seek areas with dead bodies first
        const targetPos = this.findBestCorpseArea(deadBodies);
        const closestPlayer = this.getClosestPlayer(players);

        if (targetPos && !this.isTeleporting) {
            // Move towards corpses to feed
            this.lookAt(targetPos);
            this.moveTowards(targetPos, dt, this.speed * this.speedMultiplier);
        } else if (closestPlayer && !this.isTeleporting) {
            const distToPlayer = this.position.distanceToXZ(closestPlayer.position);

            // Use skills based on distance and cooldowns
            if (distToPlayer < 3 && this.skill1Cooldown === 0) {
                this.useSkill1(closestPlayer);
            } else if (distToPlayer < 10 && this.skill2Cooldown === 0) {
                this.useSkill2(players);
            } else if (this.soulsAbsorbed > 0 && this.skill3Cooldown === 0) {
                this.useSkill3(players);
            } else if (distToPlayer < 5 && this.skill4Cooldown === 0 && deadBodies.length > 0) {
                this.useSkill4(deadBodies);
            } else if (distToPlayer < 5) {
                // Melee attack
                this.lookAt(closestPlayer.position);
                closestPlayer.takeDamage(this.damage * this.damageMultiplier, this);
            } else if (!this.isTeleporting) {
                // Move towards player
                this.lookAt(closestPlayer.position);
                this.moveTowards(closestPlayer.position, dt, this.speed * this.speedMultiplier);
            }
        }

        // Ensure y position stays correct
        this.position.y = 1.5 * this.sizeMultiplier;
    }

    private absorbSouls(deadBodies: { position: Vec3; id: string }[]): void {
        for (const body of deadBodies) {
            // Skip bodies already absorbed
            if (this.absorbedBodyIds.has(body.id)) continue;

            const dist = this.position.distanceToXZ(body.position);
            if (dist <= this.auraRadius) {
                // Absorb this soul
                this.soulsAbsorbed++;
                this.absorbedBodyIds.add(body.id);
                this.damageMultiplier += CONFIG.ESPECTRO_DE_RAZIEL.SOUL_DAMAGE_PERCENT;
                this.speedMultiplier += CONFIG.ESPECTRO_DE_RAZIEL.SOUL_SPEED_PERCENT;
                this.sizeMultiplier += CONFIG.ESPECTRO_DE_RAZIEL.SOUL_SIZE_PERCENT;

                // Update actual stats
                this.speed = this.originalSpeed * this.speedMultiplier;
                this.hitboxRadius = this.getRegHitbox(CONFIG.ESPECTRO_DE_RAZIEL.HITBOX_RADIUS) * this.sizeMultiplier;

                // Add orbiting soul visual
                this.orbitingSouls.push({
                    id: `soul_${this.soulsAbsorbed}_${Date.now()}`,
                    position: new Vec3(0, 0, 0), // Will be calculated in renderer
                    angle: Math.random() * Math.PI * 2,
                    orbitSpeed: 1.5 + Math.random() * 0.5,
                    radius: 1.5 + Math.random() * 0.5,
                });

                console.log(`[Raziel] Absorbed soul #${this.soulsAbsorbed} from ${body.id.slice(0,8)} | DMG x${this.damageMultiplier.toFixed(2)} SPD x${this.speedMultiplier.toFixed(2)} SIZE x${this.sizeMultiplier.toFixed(2)}`);
            }
        }
    }

    private findBestCorpseArea(deadBodies: { position: Vec3; id: string }[]): Vec3 | null {
        if (deadBodies.length === 0) return null;

        // Find cluster of corpses
        let bestPos = deadBodies[0].position;
        let maxCount = 0;

        for (const body of deadBodies) {
            let count = 0;
            for (const other of deadBodies) {
                if (body.position.distanceToXZ(other.position) < 5) count++;
            }
            if (count > maxCount) {
                maxCount = count;
                bestPos = body.position;
            }
        }

        return maxCount > 1 ? bestPos : null;
    }

    private useSkill1(target: ServerPlayer): void {
        // Fenda de Garras - melee damage with blue triangular prisms
        this.lookAt(target.position);
        const dir = target.position.clone().sub(this.position).normalize();
        // Two prism-like projectiles (represented as slashes)
        for (let i = -1; i <= 1; i += 2) {
            const offset = new Vec3(-dir.z * i * 0.5, 0, dir.x * i * 0.5);
            const projDir = dir.clone();
            this.pendingProjectiles.push({
                dir: projDir,
                damage: this.damage * this.damageMultiplier * 1.5,
                specialEffect: 'fendaGarras',
            });
        }
        this.skill1Cooldown = CONFIG.ESPECTRO_DE_RAZIEL.SKILL_1_COOLDOWN;
    }

    private useSkill2(players: ServerPlayer[]): void {
        // Vórtice Sombrio - pull players and bodies towards Raziel
        this.vortexActive = true;
        this.vortexTimer = 2000; // 2 second vortex

        for (const p of players) {
            if (p.isDead) continue;
            const dist = p.position.distanceToXZ(this.position);
            if (dist < 15) {
                // Pull player towards Raziel
                const dir = this.position.clone().sub(p.position).normalize();
                p.position.add(dir.multiplyScalar(5)); // Pull 5 units
                p.applySlow(
                    CONFIG.ESPECTRO_DE_RAZIEL.SKILL_2_SLOW_DURATION,
                    0.5
                );
            }
        }

        this.pendingAbilities.push({
            type: 'vortexSombrio',
            position: this.position.clone(),
            radius: 15,
        });

        this.skill2Cooldown = CONFIG.ESPECTRO_DE_RAZIEL.SKILL_2_COOLDOWN;
    }

    private useSkill3(players: ServerPlayer[]): void {
        // Expurgo de Almas - fire projectiles equal to 10% of absorbed souls
        const projectileCount = Math.max(1, Math.floor(this.soulsAbsorbed * CONFIG.ESPECTRO_DE_RAZIEL.SKILL_3_PROJECTILE_COUNT_PERCENT));
        for (let i = 0; i < projectileCount; i++) {
            const target = this.getRandomPlayer(players);
            if (!target) break;
            const dir = target.position.clone().sub(this.position).normalize();
            this.pendingProjectiles.push({
                dir,
                damage: this.damage * this.damageMultiplier * 1.2,
                specialEffect: 'almaExpurgo',
            });
        }

        this.skill3Cooldown = CONFIG.ESPECTRO_DE_RAZIEL.SKILL_3_COOLDOWN;
    }

    private useSkill4(deadBodies: { position: Vec3; id: string }[]): void {
        // Transição Material - teleport near group of dead bodies
        if (deadBodies.length === 0) return;

        // Find position with most corpses nearby
        let bestPos = this.position.clone();
        let bestCount = 0;

        for (const body of deadBodies) {
            let count = 0;
            for (const other of deadBodies) {
                if (body.position.distanceToXZ(other.position) < 5) count++;
            }
            if (count > bestCount) {
                bestCount = count;
                bestPos = body.position.clone();
            }
        }

        // Teleport short distance towards best position
        const dir = bestPos.clone().sub(this.position);
        dir.y = 0;
        if (dir.lengthSq() > 0) {
            dir.normalize().multiplyScalar(Math.min(CONFIG.ESPECTRO_DE_RAZIEL.SKILL_4_TELEPORT_DISTANCE, dir.length()));
            this.position.add(dir);
            this.isTeleporting = true;
            this.teleportTimer = 500; // 0.5 second teleport cooldown
        }

        this.pendingAbilities.push({
            type: 'transicaoMaterial',
            position: this.position.clone(),
        });

        this.skill4Cooldown = CONFIG.ESPECTRO_DE_RAZIEL.SKILL_4_COOLDOWN;
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (this.isDestroyed || this.isInvulnerable) return;
        super.takeDamage(amount, instigator, countsForPassive);
    }

    toSnapshot(): any {
        const base = super.toSnapshot();
        return {
            ...base,
            soulsAbsorbed: this.soulsAbsorbed,
            damageMultiplier: this.damageMultiplier,
            speedMultiplier: this.speedMultiplier,
            sizeMultiplier: this.sizeMultiplier,
            orbitingSouls: this.orbitingSouls.map(s => ({
                id: s.id,
                angle: s.angle,
                radius: s.radius,
            })),
            isTeleporting: this.isTeleporting,
            vortexActive: this.vortexActive,
        };
    }
}
