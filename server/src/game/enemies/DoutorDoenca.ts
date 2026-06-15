import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { EnemySnapshot } from '../../network/Protocol';

type DoctorPhase = 'initial' | 'advanced' | 'terminal';

interface DoctorAbilityCooldown {
    base: number;
    lastUsed: number;
}

export class DoutorDoencaEnemy extends ServerEnemy {
    private skillCooldowns: Record<string, DoctorAbilityCooldown> = {
        injecao: { base: 6000, lastUsed: 0 },
        nuvem: { base: 12000, lastUsed: 0 },
        surto: { base: 20000, lastUsed: 0 },
        incubadora: { base: 18000, lastUsed: 0 },
        diagnostico: { base: 16000, lastUsed: 0 },
        sobrecarga: { base: 14000, lastUsed: 0 },
        basicAttack: { base: 2000, lastUsed: 0 },
    };

    public pendingProjectiles: {
        dir: Vec3;
        damage: number;
        speed?: number;
        lifetime?: number;
        specialEffect?: string;
        explosionRadius?: number;
        ownerId?: string;
        hitboxRadius?: number;
        params?: any;
    }[] = [];
    public pendingAbilities: any[] = [];

    public appearance: number;
    public phase: DoctorPhase;
    public maxDiseaseTypes: number;
    public maxDiseaseStacks: number;
    public surtoPulses: number;
    public incubatorsEnabled: boolean;
    public fatalDiagnosisEnabled: boolean;
    public pathogenicOverloadEnabled: boolean;

    public isSurtoActive = false;
    private surtoVisualTimer = 0;
    private fleeTriggered = false;
    private fleeTimer = 0;
    private terminalExecutionMode = false;

    private static readonly PATHOGENS = [
        'febre_critica',
        'paralisia_parcial',
        'mao_tremula',
        'imunidade_baixa',
        'visao_turva',
        'cansaco_viral',
        'incapacidade',
        'hemorragia_quadrada',
    ];

    constructor(pos: Vec3, globalMult: number, playerLevel: number, appearance = 1) {
        super(pos);
        this.type = 'DoutorDoenca';
        this.name = 'Doutor Doenca';
        this.appearance = Math.max(1, appearance);
        this.phase = this.appearance === 1 ? 'initial' : this.appearance === 2 ? 'advanced' : 'terminal';

        this.maxDiseaseTypes = this.appearance === 1 ? 3 : 5;
        this.maxDiseaseStacks = this.appearance === 1 ? 3 : 5;
        this.surtoPulses = this.appearance === 1 ? 1 : this.appearance === 2 ? 2 : 3;
        this.incubatorsEnabled = this.appearance >= 2;
        this.fatalDiagnosisEnabled = this.appearance >= 2;
        this.pathogenicOverloadEnabled = this.appearance >= 2;

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

    public getPathogenLimits() {
        return { maxStacks: this.maxDiseaseStacks, maxTypes: this.maxDiseaseTypes };
    }

    public getPathogenChance(): number {
        if (this.phase === 'terminal') return 0.55;
        if (this.phase === 'advanced') return 0.45;
        return 0.35;
    }

    public getCooldownMultiplier(): number {
        if (this.appearance <= 1) return 1;
        return Math.max(0.70, 0.85 - Math.max(0, this.appearance - 2) * 0.05);
    }

    public applyAppearanceScaling(preserveHpRatio = true): void {
        const previousMaxHp = Math.max(1, this.maxHp);
        const hpRatio = preserveHpRatio ? Math.max(0, Math.min(1, this.hp / previousMaxHp)) : 1;
        let hpMult = 1;
        let damageMult = 1;
        let speedMult = 1;

        if (this.appearance >= 2) {
            const extra = Math.max(0, this.appearance - 2);
            hpMult = 1.35 + extra * 0.15;
            damageMult = 1.20 + extra * 0.10;
            speedMult = Math.min(1.30, 1.15 + extra * 0.05);
        }

        this.maxHp = Math.max(1, Math.round(this.maxHp * hpMult));
        this.hp = Math.max(0, Math.min(this.maxHp, this.maxHp * hpRatio));
        this.damage *= damageMult;
        this.originalSpeed *= speedMult;
        this.speed = this.originalSpeed;
    }

    getRandomPathogen(): string {
        return DoutorDoencaEnemy.PATHOGENS[Math.floor(Math.random() * DoutorDoencaEnemy.PATHOGENS.length)];
    }

    private getCooldown(key: string): number {
        return this.skillCooldowns[key].base * this.getCooldownMultiplier();
    }

    private canCast(key: string, now: number): boolean {
        return now > this.skillCooldowns[key].lastUsed + this.getCooldown(key);
    }

    private markCast(key: string, now: number): void {
        this.skillCooldowns[key].lastUsed = now;
    }

    private getPredictedTargetPosition(target: ServerPlayer, seconds = 0.85): Vec3 {
        const predicted = target.position.clone();
        const dir = target.getFacingDirection?.();
        if (dir && dir.lengthSq() > 0.01) {
            predicted.add(dir.clone().multiplyScalar(target.getEffectiveSpeed() * seconds));
        }
        return predicted;
    }

    private getContagionTarget(players: ServerPlayer[]): ServerPlayer | null {
        let best: ServerPlayer | null = null;
        let bestScore = -Infinity;
        let bestDist = Infinity;
        for (const p of players) {
            if (p.isDead) continue;
            const pathCount = Object.keys(p.pathogens).length;
            const stackCount = Object.values(p.pathogens).reduce((sum, data) => sum + data.stacks, 0);
            const dist = this.position.distanceToXZ(p.position);
            const spreadScore = this.phase === 'initial'
                ? (10 - pathCount * 2 - stackCount) - dist * 0.01
                : (pathCount * 3 + stackCount * 1.5) - dist * 0.03;
            if (spreadScore > bestScore || (spreadScore === bestScore && dist < bestDist)) {
                bestScore = spreadScore;
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
        const hpPct = this.maxHp > 0 ? this.hp / this.maxHp : 1;
        const dist = this.position.distanceToXZ(target.position);

        const pathogenCount = Object.keys(target.pathogens).length;
        const healCap = this.phase === 'initial' ? 15 : this.phase === 'advanced' ? 28 : 40;
        this.hp = Math.min(this.maxHp, this.hp + Math.min(healCap, 5 * pathogenCount) * dt);

        if (this.isSurtoActive) {
            this.surtoVisualTimer -= ms;
            if (this.surtoVisualTimer <= 0) this.isSurtoActive = false;
        }

        if (this.phase === 'terminal' && hpPct < 0.35) this.terminalExecutionMode = true;

        if (!this.fleeTriggered && hpPct < (this.terminalExecutionMode ? 0.35 : 0.20)) {
            this.fleeTriggered = true;
            this.fleeTimer = this.phase === 'initial' ? 3000 : 1800;
            this.speed = this.originalSpeed * (this.phase === 'initial' ? 1.5 : 1.25);
        }
        if (this.fleeTimer > 0) {
            this.fleeTimer -= ms;
            if (this.fleeTimer <= 0) this.speed = this.originalSpeed;
        }

        this.lookAt(target.position);
        const idealDistance = this.terminalExecutionMode ? 7.5 : this.phase === 'initial' ? 10 : 8.5;
        if (dist < idealDistance - 0.5) {
            const away = this.position.clone().sub(target.position);
            away.y = 0;
            if (away.lengthSq() > 0.01) this.position.add(away.normalize().multiplyScalar(this.speed * dt));
        } else if (dist > idealDistance + 0.8) {
            this.moveTowards(target.position, dt, this.speed);
        }

        if (!this.canUseAbility()) return;

        const infectedStackCount = Object.values(target.pathogens).reduce((sum, data) => sum + data.stacks, 0);

        if (this.pathogenicOverloadEnabled && infectedStackCount >= 4 && this.canCast('sobrecarga', now)) {
            this.markCast('sobrecarga', now);
            this.pendingAbilities.push({
                type: 'sobrecarga_patogenica',
                x: target.position.x,
                z: target.position.z,
                radius: this.phase === 'terminal' ? 7 : 6,
                damage: this.damage * (this.phase === 'terminal' ? 1.25 : 0.95),
                bossId: this.id,
                maxDiseaseStacks: this.maxDiseaseStacks,
                maxDiseaseTypes: this.maxDiseaseTypes,
            });
        }

        if (this.fatalDiagnosisEnabled && infectedStackCount >= 3 && this.canCast('diagnostico', now)) {
            this.markCast('diagnostico', now);
            this.pendingAbilities.push({
                type: 'diagnostico_fatal',
                targetId: target.id,
                damage: this.damage * (1.25 + Math.min(0.75, infectedStackCount * 0.08)),
                bossId: this.id,
                maxDiseaseStacks: this.maxDiseaseStacks,
                maxDiseaseTypes: this.maxDiseaseTypes,
            });
        }

        if (this.canCast('surto', now)) {
            this.markCast('surto', now);
            this.isSurtoActive = true;
            this.surtoVisualTimer = 900 + this.surtoPulses * 350;
            this.pendingAbilities.push({
                type: 'surto_epidemico',
                x: this.position.x,
                z: this.position.z,
                radius: this.phase === 'initial' ? 15 : 17,
                bossId: this.id,
                pulses: this.surtoPulses,
                maxDiseaseStacks: this.maxDiseaseStacks,
                maxDiseaseTypes: this.maxDiseaseTypes,
            });
        }

        if (this.incubatorsEnabled && this.canCast('incubadora', now)) {
            this.markCast('incubadora', now);
            const pos = this.getPredictedTargetPosition(target, 1.1);
            this.pendingAbilities.push({
                type: 'incubadora_viral',
                x: pos.x,
                z: pos.z,
                radius: this.phase === 'terminal' ? 4.8 : 4.2,
                duration: this.phase === 'terminal' ? 10000 : 8000,
                damagePerSec: this.phase === 'terminal' ? 18 : 12,
                bossId: this.id,
                maxDiseaseStacks: this.maxDiseaseStacks,
                maxDiseaseTypes: this.maxDiseaseTypes,
            });
        }

        if (this.canCast('nuvem', now)) {
            this.markCast('nuvem', now);
            const pos = this.phase === 'initial'
                ? target.position.clone()
                : this.getPredictedTargetPosition(target, 1.2);
            this.pendingAbilities.push({
                type: 'nuvem_esporos',
                x: pos.x,
                z: pos.z,
                radius: this.phase === 'initial' ? 8 : 9,
                duration: this.phase === 'initial' ? 5000 : 6500,
                damagePerSec: this.phase === 'initial' ? 15 : 22,
                bossId: this.id,
                maxDiseaseStacks: this.maxDiseaseStacks,
                maxDiseaseTypes: this.maxDiseaseTypes,
                pathogenChance: this.getPathogenChance(),
            });
        }

        if (this.canCast('injecao', now)) {
            this.markCast('injecao', now);
            const aim = this.phase === 'initial' ? target.position.clone() : this.getPredictedTargetPosition(target, 0.75);
            const dir = aim.sub(this.position);
            dir.y = 0;
            if (dir.lengthSq() > 0.01) {
                dir.normalize();
                this.pendingProjectiles.push({
                    dir,
                    damage: this.damage,
                    speed: this.phase === 'initial' ? 8.0 : 10.5,
                    specialEffect: 'injecao_geometrica',
                    ownerId: this.id,
                    hitboxRadius: this.phase === 'initial' ? 0.22 : 0.28,
                    params: this.getPathogenLimits(),
                });
                if (this.phase !== 'initial') {
                    const side = new Vec3(-dir.z, 0, dir.x).multiplyScalar(0.18);
                    this.pendingProjectiles.push({
                        dir: dir.clone().add(side).normalize(),
                        damage: this.damage * 0.75,
                        speed: 10.5,
                        specialEffect: 'injecao_geometrica',
                        ownerId: this.id,
                        hitboxRadius: 0.25,
                        params: this.getPathogenLimits(),
                    });
                }
            }
        }

        if (this.canCast('basicAttack', now)) {
            this.markCast('basicAttack', now);
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
                    ownerId: this.id,
                    params: { ...this.getPathogenLimits(), pathogenChance: this.getPathogenChance() },
                });
            }
        }
    }

    toSnapshot(): EnemySnapshot {
        const snap = super.toSnapshot();
        if (this.isSurtoActive) snap.isSurtoActive = true;
        (snap as any).appearance = this.appearance;
        (snap as any).phase = this.phase;
        return snap;
    }
}
