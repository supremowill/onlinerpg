import { EnemyRegistry } from '../data/EnemyRegistry';
import { ServerEnemy } from './enemies/Enemy';

export interface ThreatContext {
    gameTime: number;
    playerLevel: number;
    collapseLevel: number;
}

export interface ThreatMultipliers {
    hp: number;
    damage: number;
    defense: number;
    speed: number;
    xp: number;
    score: number;
    category: string;
    antiExploitTier: number;
}

interface CategoryModifier {
    hp: number;
    damage: number;
    defense: number;
    speed: number;
}

const CATEGORY_MODIFIERS: Record<string, CategoryModifier> = {
    common: { hp: 1.00, damage: 1.00, defense: 0.80, speed: 1.00 },
    guardian: { hp: 1.20, damage: 1.00, defense: 1.20, speed: 0.70 },
    route_special: { hp: 1.10, damage: 1.20, defense: 0.90, speed: 1.00 },
    circle_boss: { hp: 1.50, damage: 1.20, defense: 1.30, speed: 0.50 },
    elite_boss: { hp: 1.70, damage: 1.30, defense: 1.30, speed: 0.50 },
    great_boss: { hp: 2.20, damage: 1.50, defense: 1.50, speed: 0.40 },
    supreme_entity: { hp: 3.00, damage: 1.80, defense: 1.80, speed: 0.30 },
    summoned_minion: { hp: 0.70, damage: 0.70, defense: 0.50, speed: 1.00 },
};

const TYPE_CATEGORY_OVERRIDES: Record<string, string> = {
    RedCone: 'guardian',
    EnemyTower: 'guardian',
    GuardianGuerreiro: 'guardian',
    GuardianMago: 'guardian',
    GuardianArqueiro: 'guardian',
    BruxaDoGelo: 'guardian',
    MestraDaIlusao: 'guardian',
    BombardeiroInsano: 'guardian',
    CloneIlusorio: 'summoned_minion',
    EscravoGlacial: 'summoned_minion',
    AlmaAmaldicoada: 'summoned_minion',
    CaveiraExplosiva: 'summoned_minion',
    EspectroSombrio: 'summoned_minion',
    BrotoCarnivoro: 'summoned_minion',
    MatilhaGeometra: 'summoned_minion',
    Ghoul: 'summoned_minion',
    Valkyr: 'summoned_minion',
    CloneSmith: 'summoned_minion',
    EscaravelhoFarao: 'summoned_minion',
    SuperBoss: 'elite_boss',
    Gangplank: 'circle_boss',
    RainhaDasTrevas: 'circle_boss',
    PlantaCarnivora: 'circle_boss',
    FeiticeiroImortal: 'elite_boss',
    LichKing: 'elite_boss',
    CaoDosInfernos: 'elite_boss',
    DoutorDoenca: 'elite_boss',
    GuardiaoDoLimbo: 'circle_boss',
    'GuardiãoDoLimbo': 'circle_boss',
    Minos: 'circle_boss',
    Cerbero: 'circle_boss',
    'Plutão': 'circle_boss',
    'Fúria': 'circle_boss',
    Megera: 'circle_boss',
    Minotauro: 'circle_boss',
    Geriao: 'circle_boss',
    'Lúcifer': 'great_boss',
    EspectroDeRaziel: 'supreme_entity',
    Smith: 'great_boss',
    TheMightyOne: 'great_boss',
    Farao: 'supreme_entity',
};

export class ThreatScalingSystem {
    public getSignature(context: ThreatContext): string {
        return [
            Math.floor(context.gameTime / 60),
            Math.max(1, Math.floor(context.playerLevel)),
            Math.max(0, Math.floor(context.collapseLevel)),
        ].join(':');
    }

    public applyToEnemy(enemy: ServerEnemy, context: ThreatContext, preserveHpRatio: boolean): ThreatMultipliers {
        this.captureBaseStats(enemy);
        const multipliers = this.calculate(enemy, context);

        const previousMaxHp = Math.max(1, enemy.maxHp || enemy.baseMaxHp || 1);
        const hpRatio = preserveHpRatio ? Math.max(0, Math.min(1, enemy.hp / previousMaxHp)) : 1;

        enemy.maxHp = Math.max(1, Math.round((enemy.baseMaxHp || previousMaxHp) * multipliers.hp));
        enemy.hp = Math.max(0, Math.min(enemy.maxHp, enemy.maxHp * hpRatio));
        enemy.damage = (enemy.baseDamage || 0) * multipliers.damage;
        enemy.defense = (enemy.baseDefense || 0) * multipliers.defense;
        enemy.originalSpeed = (enemy.baseSpeed || 0) * multipliers.speed;
        enemy.speed = enemy.originalSpeed;
        enemy.xp = Math.max(0, Math.round((enemy.baseXp || 0) * multipliers.xp));
        enemy.score = Math.max(0, Math.round((enemy.baseScore || 0) * multipliers.score));
        enemy.lastThreatSignature = this.getSignature(context);

        return multipliers;
    }

    public calculate(enemy: ServerEnemy, context: ThreatContext): ThreatMultipliers {
        const time = this.getTimeMultipliers(context.gameTime);
        const level = this.getLevelMultipliers(context.playerLevel);
        const antiExploit = this.getAntiExploitMultipliers(context.gameTime, context.playerLevel);
        const event = this.getEventMultipliers(context.collapseLevel);
        const category = this.normalizeCategory(enemy);
        const categoryMod = CATEGORY_MODIFIERS[category] || CATEGORY_MODIFIERS.common;

        return {
            hp: time.hp * level.hp * antiExploit.hp * categoryMod.hp * event.hp,
            damage: time.damage * level.damage * antiExploit.damage * categoryMod.damage * event.damage,
            defense: time.defense * level.defense * categoryMod.defense * event.defense,
            speed: time.speed * categoryMod.speed,
            xp: this.getXpMultiplier(context.gameTime, context.playerLevel) * event.xp,
            score: this.getScoreMultiplier(context.gameTime, context.playerLevel) * event.score,
            category,
            antiExploitTier: antiExploit.tier,
        };
    }

    private captureBaseStats(enemy: ServerEnemy): void {
        if (enemy.baseStatsCaptured) return;

        const def = EnemyRegistry.get(enemy.type);
        const stats = def?.stats;

        enemy.baseMaxHp = Math.max(1, stats?.hp ?? enemy.maxHp ?? 1);
        enemy.baseDamage = stats?.damage ?? enemy.damage ?? 0;
        enemy.baseDefense = this.normalizeDefensePoints(stats?.defense ?? enemy.defense ?? 0);
        enemy.baseSpeed = stats?.speed ?? enemy.originalSpeed ?? enemy.speed ?? 0;
        enemy.baseXp = stats?.xp ?? enemy.xp ?? 0;
        enemy.baseScore = stats?.score ?? enemy.score ?? 0;
        enemy.baseStatsCaptured = true;
    }

    private getTimeMultipliers(gameTime: number) {
        const minute = Math.max(0, gameTime / 60);
        const early = Math.min(minute, 10);
        const late = Math.max(0, minute - 10);

        return {
            hp: 1 + early * 0.04 + late * 0.07,
            damage: 1 + early * 0.02 + late * 0.04,
            defense: 1 + early * 0.015 + late * 0.025,
            speed: Math.min(1.12, 1 + minute * 0.01),
        };
    }

    private getLevelMultipliers(playerLevel: number) {
        const level = Math.max(1, playerLevel);
        const early = Math.min(level, 25);
        const late = Math.max(0, level - 25);

        return {
            hp: 1 + early * 0.02 + late * 0.015,
            damage: 1 + early * 0.012 + late * 0.008,
            defense: 1 + early * 0.008 + late * 0.005,
        };
    }

    private getAntiExploitMultipliers(gameTime: number, playerLevel: number) {
        const expected = this.getExpectedLevel(gameTime);
        const aheadBy = playerLevel - expected;

        if (aheadBy >= 15) return { hp: 1.30, damage: 1.15, tier: 15 };
        if (aheadBy >= 10) return { hp: 1.20, damage: 1.10, tier: 10 };
        if (aheadBy >= 5) return { hp: 1.10, damage: 1.05, tier: 5 };
        return { hp: 1.00, damage: 1.00, tier: 0 };
    }

    private getExpectedLevel(gameTime: number): number {
        const minute = Math.max(0, gameTime / 60);
        if (minute <= 5) return Math.round(1 + minute * 2);
        if (minute <= 10) return Math.round(11 + (minute - 5) * 2.4);
        if (minute <= 15) return Math.round(23 + (minute - 10) * 2);
        if (minute <= 20) return Math.round(33 + (minute - 15) * 1.4);
        return Math.round(40 + (minute - 20) * 1.2);
    }

    private getEventMultipliers(collapseLevel: number) {
        const level = Math.max(0, collapseLevel);
        return {
            hp: Math.pow(2, level),
            damage: Math.pow(2, level),
            defense: Math.pow(1.5, level),
            xp: Math.pow(1.25, level),
            score: Math.pow(1.35, level),
        };
    }

    private getXpMultiplier(gameTime: number, playerLevel: number): number {
        return 1 + Math.max(0, gameTime / 60) * 0.01 + Math.max(1, playerLevel) * 0.005;
    }

    private getScoreMultiplier(gameTime: number, playerLevel: number): number {
        return 1 + Math.max(0, gameTime / 60) * 0.02 + Math.max(1, playerLevel) * 0.008;
    }

    private normalizeCategory(enemy: ServerEnemy): string {
        if (TYPE_CATEGORY_OVERRIDES[enemy.type]) return TYPE_CATEGORY_OVERRIDES[enemy.type];

        const raw = EnemyRegistry.get(enemy.type)?.category || 'common';
        switch (raw) {
            case 'guardian':
            case 'defender':
            case 'structure':
                return 'guardian';
            case 'minion':
                return 'summoned_minion';
            case 'boss':
                return 'circle_boss';
            case 'miniboss':
                return 'elite_boss';
            case 'route_special':
            case 'elite_boss':
            case 'great_boss':
            case 'supreme_entity':
            case 'summoned_minion':
                return raw;
            case 'basic':
            default:
                return 'common';
        }
    }

    private normalizeDefensePoints(raw: number): number {
        if (!raw || raw <= 0) return 0;
        if (raw <= 1) return Math.round((750 * raw) / (1 - raw));
        return raw;
    }
}
