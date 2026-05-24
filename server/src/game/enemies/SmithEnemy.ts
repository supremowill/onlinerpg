import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

export class SmithEnemy extends ServerEnemy {
    public cloneIds: Set<string> = new Set();
    public sizeMultiplier: number = 1.0;
    public damageMultiplier: number = 1.0;
    public pendingAbilities: any[] = [];
    private skill1Next: number = 0;
    private skill2Next: number = 0;
    public playerTotalScore: number = 0;
    private destroyedCloneTimestamps: number[] = [];
    private basicAttackCooldown: number = 1200;
    private lastBasicAttackTime: number = 0;
    private hitCounter: number = 0;

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
        this.position.y = 1.0;
        this.skill1Next = Date.now() + 2000;
        this.skill2Next = Date.now() + 4000;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;

        const now = Date.now();

        // Count active clones
        const c = CONFIG.SMITH;
        const activeClones = this.cloneIds.size;
        this.damageMultiplier = 1.0 + (activeClones * c.CLONE_DAMAGE_PERCENT);
        this.damage = c.BASE_DAMAGE * this.damageMultiplier;

        // Speed reduction based on recently destroyed clones
        this.destroyedCloneTimestamps = this.destroyedCloneTimestamps.filter(t => now - t < 10000);
        const recentDestroyed = this.destroyedCloneTimestamps.length;
        const speedMultiplier = Math.max(0.5, 1.0 - (recentDestroyed * 0.05));
        this.speed = this.originalSpeed * speedMultiplier;

        const target = this.getClosestPlayer(players);
        if (!target) {
            return;
        }

        const dist = this.position.distanceToXZ(target.position);
        const executionMode = activeClones >= 5;

        if (executionMode) {
            this.moveTowards(target.position, dt);
        } else {
            if (dist < 8) {
                const away = this.position.clone().sub(target.position);
                away.y = 0;
                away.normalize();
                this.position.add(away.multiplyScalar(this.speed * dt));
            }
        }

        this.lookAt(target.position);

        // Skill 1: Salto de Protocolo
        if (now >= this.skill1Next) {
            this.useSaltoDeProtocolo(target, players);
            this.skill1Next = now + c.SKILL_1_COOLDOWN;
        }

        // Skill 2: Sobrescrita Global
        if (now >= this.skill2Next) {
            this.useSobrescritaGlobal(players);
            this.skill2Next = now + c.SKILL_2_COOLDOWN;
        }

        // Melee Basic Attack check
        if (dist < this.hitboxRadius + target.hitboxRadius + 0.3) {
            if (now > this.lastBasicAttackTime + this.basicAttackCooldown) {
                this.lastBasicAttackTime = now;
                this.hitCounter++;
                let dmg = this.damage;
                if (this.hitCounter % 3 === 0) {
                    const pctSmithLifeLost = (this.maxHp - this.hp) / this.maxHp;
                    const percentDamage = 0.05 + pctSmithLifeLost;
                    dmg = target.maxHp * percentDamage;
                    
                    const pctSt = Math.round(percentDamage * 100);
                    const gameEngine = (global as any).__gameEngine;
                    if (gameEngine) {
                        gameEngine.pendingEvents.push({
                            event: 'MESSAGE',
                            data: { message: `⚡ Smith ataca criticamente com Corrupção: causou ${pctSt}% de dano com base no HP perdido! ⚡` }
                        });
                    }
                }
                target.takeDamage(dmg, false);
            }
        }
    }

    private useSaltoDeProtocolo(target: ServerPlayer, players: ServerPlayer[]): void {
        const behind = target.position.clone();
        behind.x += (Math.random() - 0.5) * 6;
        behind.z += (Math.random() - 0.5) * 6;
        behind.y = 1.0;

        this.position = behind;

        this.pendingAbilities.push({
            type: 'smith_teleport_aoe',
            position: behind.clone(),
            radius: 4,
            damage: this.damage * 0.5,
            invertControls: true,
            invertDuration: 2000,
            timer: 0,
        });
        console.log('[Smith] Salto de Protocolo used');
    }

    private useSobrescritaGlobal(players: ServerPlayer[]): void {
        const gameEngine = (global as any).__gameEngine;
        console.log('[Smith] Sobrescrita Global, gameEngine=' + !!gameEngine);

        if (gameEngine) {
            // Convert minions to clones
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

            const toConvert = minions.slice(0, 5);
            for (const minion of toConvert) {
                minion.isDestroyed = true;
                this.addClone(minion.position.clone(), gameEngine);
            }

            // If no minions, create error particle clones near player
            if (toConvert.length === 0) {
                const target = this.getClosestPlayer(players);
                if (target) {
                    for (let i = 0; i < 3; i++) {
                        const offset = new Vec3(
                            (Math.random() - 0.5) * 4,
                            1.0,
                            (Math.random() - 0.5) * 4
                        );
                        const pos = target.position.clone().add(offset);
                        this.addClone(pos, gameEngine);
                    }
                }
            }

            // Apply Buffer state to player (skills +3s cooldown)
            const target2 = this.getClosestPlayer(players);
            if (target2) {
                target2.applyTimedBuff('smith_debuff', 8, { cooldown_increase: 3000 });
            }
        }
        console.log('[Smith] Sobrescrita Global used');
    }

    addClone(pos: Vec3, gameEngine: any): void {
        const { CloneSmithEnemy } = require('./Minions');
        const clone = new CloneSmithEnemy(pos, this.id, gameEngine.globalMultiplier || 1.0);
        clone.position.y = 1.0;
        gameEngine.enemies.push(clone);
        this.cloneIds.add(clone.id);
        console.log('[Smith] Clone added, total=' + this.cloneIds.size);
    }

    recordCloneDestroyed(): void {
        this.destroyedCloneTimestamps.push(Date.now());
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive: boolean = true): void {
        if (this.isDestroyed || this.isInvulnerable) return;

        const c = CONFIG.SMITH;
        const sharedDamage = amount * 0.10;

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

        const bossDamage = amount * 0.90;
        super.takeDamage(bossDamage, instigator, countsForPassive);
    }

    absorb(otherSmith: SmithEnemy): void {
        this.sizeMultiplier += 1.0;
        this.damageMultiplier += 0.5;
        this.maxHp += otherSmith.maxHp;
        this.hp = Math.min(this.maxHp, this.hp + otherSmith.hp);
        this.hitboxRadius *= 1.2;

        for (const id of otherSmith.cloneIds) {
            this.cloneIds.add(id);
        }
        console.log('[Smith] Absorbed another Smith, sizeMult=' + this.sizeMultiplier);
    }
}
