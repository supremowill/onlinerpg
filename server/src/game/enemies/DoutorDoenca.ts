import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';
import { EnemySnapshot } from '../../network/Protocol';

export class DoutorDoencaEnemy extends ServerEnemy {
    private skillCooldowns = {
        injecao: { cooldown: 6000, lastUsed: 0 },
        nuvem: { cooldown: 12000, lastUsed: 0 },
        surto: { cooldown: 20000, lastUsed: 0 },
        basicAttack: { cooldown: 2000, lastUsed: 0 }
    };

    public pendingProjectiles: { dir: Vec3; damage: number; speed?: number; lifetime?: number; specialEffect?: string; explosionRadius?: number; ownerId?: string }[] = [];
    public pendingAbilities: any[] = [];
    
    // Ultimate pulsing visual feedback
    public isSurtoActive = false;
    private surtoVisualTimer = 0;

    // Flee mechanic (below 20% HP)
    private fleeTriggered = false;
    private fleeTimer = 0;

    private static readonly PATHOGENS = [
        'febre_critica',
        'paralisia_parcial',
        'mao_tremula',
        'imunidade_baixa',
        'visao_turva',
        'cansaco_viral',
        'incapacidade',
        'hemorragia_quadrada'
    ];

    constructor(pos: Vec3, globalMult: number, playerLevel: number) {
        super(pos);
        this.type = 'DoutorDoenca';
        this.name = 'Doutor Doença';
        
        // Base Stats
        this.maxHp = 20000 * playerLevel * globalMult;
        this.hp = this.maxHp;
        this.damage = 45 * (1 + 0.12 * playerLevel) * globalMult;
        this.speed = 3.5;
        this.originalSpeed = 3.5;
        this.hitboxRadius = 1.8;
        this.xp = 10000 * playerLevel;
        this.score = 5000 * playerLevel;
        this.position.y = 1.0;
    }

    getRandomPathogen(): string {
        return DoutorDoencaEnemy.PATHOGENS[Math.floor(Math.random() * DoutorDoencaEnemy.PATHOGENS.length)];
    }

    /** Find player with least active pathogens, fallback to closest */
    getContagionTarget(players: ServerPlayer[]): ServerPlayer | null {
        let best: ServerPlayer | null = null;
        let minPathogens = Infinity;
        let bestDist = Infinity;
        for (const p of players) {
            if (p.isDead) continue;
            const pathCount = Object.keys(p.pathogens).length;
            const dist = this.position.distanceToXZ(p.position);
            if (pathCount < minPathogens || (pathCount === minPathogens && dist < bestDist)) {
                minPathogens = pathCount;
                bestDist = dist;
                best = p;
            }
        }
        return best;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        
        const target = this.getContagionTarget(players);
        if (!target) return;
        
        const now = Date.now();
        const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);

        // 1. Passive 3: Sobrevivência Viral (Regenerate 5 HP/s per active player pathogen, max 15 HP/s)
        const pathogenCount = Object.keys(target.pathogens).length;
        const healAmount = Math.min(15, 5 * pathogenCount) * dt;
        this.hp = Math.min(this.maxHp, this.hp + healAmount);

        // 2. Visual state timer update
        if (this.isSurtoActive) {
            this.surtoVisualTimer -= ms;
            if (this.surtoVisualTimer <= 0) {
                this.isSurtoActive = false;
            }
        }

        // 3. Flee mechanic if life is below 20%
        if (!this.fleeTriggered && this.hp / this.maxHp < 0.2) {
            this.fleeTriggered = true;
            this.fleeTimer = 3000; // 3 seconds
            this.speed = this.originalSpeed * 1.5;
        }

        if (this.fleeTimer > 0) {
            this.fleeTimer -= ms;
            if (this.fleeTimer <= 0) {
                this.speed = this.originalSpeed;
            }
        }

        // 4. Movement: Kiting at exactly 10 units
        this.lookAt(target.position);
        if (dist < 10) {
            // Player is too close, retreat
            const away = this.position.clone().sub(target.position);
            away.y = 0;
            if (away.lengthSq() > 0.01) {
                away.normalize().multiplyScalar(this.speed * dt);
                this.position.add(away);
            }
        } else if (dist > 10.5) {
            // Player is too far, advance
            this.moveTowards(target.position, dt);
        }

        if (!this.canUseAbility()) return;

        // 5. Active skill: Surto Epidêmico (Cooldown 20s)
        if (now > this.skillCooldowns.surto.lastUsed + this.skillCooldowns.surto.cooldown) {
            this.skillCooldowns.surto.lastUsed = now;
            this.isSurtoActive = true;
            this.surtoVisualTimer = 1000; // 1 second visual feedback
            this.pendingAbilities.push({
                type: 'surto_epidemico',
                x: this.position.x,
                z: this.position.z,
                radius: 15,
                bossId: this.id
            });
        }

        // 6. Active skill: Nuvem de Esporos (Cooldown 12s)
        if (now > this.skillCooldowns.nuvem.lastUsed + this.skillCooldowns.nuvem.cooldown) {
            this.skillCooldowns.nuvem.lastUsed = now;
            this.pendingAbilities.push({
                type: 'nuvem_esporos',
                x: this.position.x,
                z: this.position.z,
                radius: 8,
                duration: 5000,
                damagePerSec: 15, // Damage per second inside esporo cloud
                bossId: this.id
            });
        }

        // 7. Active skill: Injeção Geométrica (Cooldown 6s)
        if (now > this.skillCooldowns.injecao.lastUsed + this.skillCooldowns.injecao.cooldown) {
            this.skillCooldowns.injecao.lastUsed = now;
            const dir = target.position.clone().sub(this.position);
            dir.y = 0;
            if (dir.lengthSq() > 0.01) {
                dir.normalize();
                this.pendingProjectiles.push({
                    dir,
                    damage: this.damage,
                    speed: 8.0,
                    specialEffect: 'injecao_geometrica',
                    ownerId: this.id
                });
            }
        }

        // 8. Basic Attack (Esporo projectile, Cooldown 2s) - kiting basic attack
        if (now > this.skillCooldowns.basicAttack.lastUsed + this.skillCooldowns.basicAttack.cooldown) {
            this.skillCooldowns.basicAttack.lastUsed = now;
            const dir = target.position.clone().sub(this.position);
            dir.y = 0;
            if (dir.lengthSq() > 0.01) {
                dir.normalize();
                this.pendingProjectiles.push({
                    dir,
                    damage: this.damage * 0.5,
                    speed: 12.0,
                    lifetime: 3.0,
                    specialEffect: 'esporo_basico',
                    ownerId: this.id
                });
            }
        }
    }

    toSnapshot(): EnemySnapshot {
        const snap = super.toSnapshot();
        if (this.isSurtoActive) {
            snap.isSurtoActive = true;
        }
        return snap;
    }
}
