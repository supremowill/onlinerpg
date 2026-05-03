import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

export class SmithEnemy extends ServerEnemy {
    public skill1Cooldown: number = 0;  // Salto de Protocolo
    public skill2Cooldown: number = 0;  // Sobrescrita Global
    public cloneIds: Set<string> = new Set();
    public sizeMultiplier: number = 1.0;
    public damageMultiplier: number = 1.0;
    public pendingAbilities: any[] = [];
    public isTeleporting: boolean = false;
    public teleportTimer: number = 0;
    public isLevitating: boolean = false;
    public levitateTimer: number = 0;
    public playerTotalScore: number = 0;
    private destroyedCloneTimestamps: number[] = []; // timestamps of recently destroyed clones
    private skill1Next: number = 0;
    private skill2Next: number = 0;

    constructor(pos: Vec3, globalMult: number, playerTotalScore: number) {
        super(pos);
        this.type = 'Smith';
        this.name = 'Smith - O Agente Corruptor';
        const c = CONFIG.SMITH;
        this.playerTotalScore = playerTotalScore;
        this.maxHp = (c.BASE_HP + playerTotalScore * 0.15) * globalMult;
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMult;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.position.y = 1.0; // half of 2.0 height for prism
        this.skill1Next = Date.now() + 2000; // delay first use
        this.skill2Next = Date.now() + 4000;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;

        const now = Date.now();

        // Clean up old destroyed clone timestamps (older than 10s)
        this.destroyedCloneTimestamps = this.destroyedCloneTimestamps.filter(t => now - t < 10000);

        // Count active clones and update damage multiplier
        const activeClones = this.cloneIds.size;
        const c = CONFIG.SMITH;
        this.damageMultiplier = 1.0 + (activeClones * c.CLONE_DAMAGE_PERCENT);
        this.damage = c.BASE_DAMAGE * (this.damageMultiplier);

        // Speed reduction: -5% per clone destroyed in last 10s
        const recentDestroyed = this.destroyedCloneTimestamps.length;
        const speedMultiplier = Math.max(0.5, 1.0 - (recentDestroyed * 0.05));
        this.speed = this.originalSpeed * speedMultiplier;

        const target = this.getClosestPlayer(players);
        if (!target) return;

        const dist = this.position.distanceToXZ(target.position);

        // Tactical AI
        const executionMode = activeClones >= 5;

        if (executionMode) {
            // Execution mode: chase relentlessly
            this.moveTowards(target.position, dt);
        } else {
            // Avoid direct combat, use skills to build army
            if (dist < 8) {
                // Too close, back away
                const away = this.position.clone().sub(target.position);
                away.y = 0;
                away.normalize();
                this.position.add(away.multiplyScalar(this.speed * dt));
            }
        }

        this.lookAt(target.position);

        // Skill 1: Salto de Protocolo (teleport behind player + AoE)
        if (now >= this.skill1Next && !this.isTeleporting) {
            this.useSaltoDeProtocolo(target, players);
            this.skill1Next = now + c.SKILL_1_COOLDOWN;
        }

        // Skill 2: Sobrescrita Global (convert minions to clones or create error particles)
        if (now >= this.skill2Next && !this.isLevitating) {
            this.useSobrescritaGlobal(players);
            this.skill2Next = now + c.SKILL_2_COOLDOWN;
        }
    }

    private useSaltoDeProtocolo(target: ServerPlayer, players: ServerPlayer[]): void {
        // Teleport behind player (shadow)
        const behind = target.position.clone();
        behind.x += (Math.random() - 0.5) * 6;
        behind.z += (Math.random() - 0.5) * 6;
        behind.y = 1.0;

        this.position = behind;
        this.isTeleporting = true;
        this.teleportTimer = 500; // ms

        // AoE explosion (radius 4)
        const c = CONFIG.SMITH;
        this.pendingAbilities.push({
            type: 'smith_teleport_aoe',
            position: behind.clone(),
            radius: 4,
            damage: this.damage * 0.5,
            invertControls: true,
            invertDuration: 2000,
            timer: 0,
        });
    }

    private useSobrescritaGlobal(players: ServerPlayer[]): void {
        // Find all common minions on the map (non-boss, non-clone enemies)
        const gameEngine = (global as any).__gameEngine;
        let minionsConverted = 0;

        if (gameEngine) {
            const minions = gameEngine.enemies.filter((e: any) =>
                e !== this &&
                e.type !== 'CloneSmith' &&
                e.type !== 'Smith' &&
                !e.type.includes('Boss') &&
                !e.type.includes('Guerreiro') &&
                !e.type.includes('Mago') &&
                !e.type.includes('Arqueiro') &&
                e.hp > 0
            );

            // Convert up to 5 minions to clones
            const toConvert = minions.slice(0, 5);
            for (const minion of toConvert) {
                // Replace minion with clone
                minion.isDestroyed = true;
                this.addClone(minion.position.clone(), gameEngine);
                minionsConverted++;
            }
        }

        // If no minions, create 3 error particle clones near player
        if (minionsConverted === 0) {
            const target = this.getClosestPlayer(players);
            if (target) {
                for (let i = 0; i < 3; i++) {
                    const offset = new Vec3(
                        (Math.random() - 0.5) * 4,
                        1.0,
                        (Math.random() - 0.5) * 4
                    );
                    const pos = target.position.clone().add(offset);
                    if (gameEngine) {
                        this.addClone(pos, gameEngine);
                    }
                }
            }
        }

        // Apply "Buffer" state to player hit by beam: all skills +3s cooldown
        const target = this.getClosestPlayer(players);
        if (target) {
            // Buffer effect: extend all skill cooldowns by 3 seconds
            for (const skill of Object.values(target.skills)) {
                (skill as any).cooldown += 3000;
            }
        }

        this.isLevitating = true;
        this.levitateTimer = 1000;
    }

    addClone(pos: Vec3, gameEngine: any): void {
        const { CloneSmithEnemy } = require('./Minions');
        const clone = new CloneSmithEnemy(pos, this.id, gameEngine.globalMultiplier || 1.0);
        clone.position.y = 1.0;
        gameEngine.enemies.push(clone);
        this.cloneIds.add(clone.id);
    }

    recordCloneDestroyed(): void {
        this.destroyedCloneTimestamps.push(Date.now());
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (this.isDestroyed || this.isInvulnerable) return;

        // Hive Mind passive: 10% damage distributed to clones
        const c = CONFIG.SMITH;
        const sharedDamage = amount * 0.10;

        // Distribute to clones
        const gameEngine = (global as any).__gameEngine;
        if (gameEngine && this.cloneIds.size > 0) {
            const clones = gameEngine.enemies.filter((e: any) =>
                e.type === 'CloneSmith' && this.cloneIds.has(e.id) && !e.isDestroyed
            );
            if (clones.length > 0) {
                const dmgPerClone = sharedDamage / clones.length;
                for (const clone of clones) {
                    clone.takeDamage(dmgPerClone, instigator, false);
                }
            }
        }

        // Boss takes 90% of damage
        const bossDamage = amount * 0.90;
        super.takeDamage(bossDamage, instigator, countsForPassive);
    }

    // Called when Smith absorbs a previous Smith (size/damage doubling)
    absorb(otherSmith: SmithEnemy): void {
        this.sizeMultiplier += 1.0;
        this.damageMultiplier += 0.5; // +50% damage bonus
        this.maxHp += otherSmith.maxHp;
        this.hp = Math.min(this.maxHp, this.hp + otherSmith.hp);
        this.hitboxRadius *= 1.2;

        // Merge clone IDs
        for (const id of otherSmith.cloneIds) {
            this.cloneIds.add(id);
        }
    }
}
