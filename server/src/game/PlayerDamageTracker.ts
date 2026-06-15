import { PlayerBuild } from '../network/Protocol';

export type DamageDealtSourceType =
    | 'basic_attack'
    | 'skill'
    | 'item'
    | 'status'
    | 'essence_tower'
    | 'summon'
    | 'environment'
    | 'unknown';

export type DamageTargetCategory = 'common' | 'elite' | 'boss' | 'summon' | 'structure' | 'unknown';

export interface PlayerDamageMeta {
    sourceType?: DamageDealtSourceType;
    sourceId?: string;
    sourceName?: string;
    abilityName?: string;
    skillKey?: 'q' | 'w' | 'e' | 'r' | 'passive' | string;
    upgradeId?: string;
    itemId?: string;
    itemName?: string;
    statusId?: string;
    essenceColor?: string;
    essenceFloor?: number;
    isCritical?: boolean;
    isDoT?: boolean;
    isStatus?: boolean;
    isItem?: boolean;
    isEssenceTower?: boolean;
    isSkill?: boolean;
    isBasicAttack?: boolean;
}

export interface PlayerDamageEvent {
    gameTime: number;
    playerId: string;
    playerName: string;
    playerLevel: number;
    targetId: string;
    targetName: string;
    targetType: string;
    targetCategory: DamageTargetCategory;
    targetHpBefore: number;
    targetHpAfter: number;
    rawDamage: number;
    finalDamage: number;
    overkillDamage: number;
    isKill: boolean;
    isCritical: boolean;
    isDoT: boolean;
    isStatus: boolean;
    isItem: boolean;
    isEssenceTower: boolean;
    isSkill: boolean;
    isBasicAttack: boolean;
    sourceType: DamageDealtSourceType;
    sourceId: string;
    sourceName: string;
    abilityName: string;
    skillKey?: string;
    upgradeId?: string;
    itemId?: string;
    itemName?: string;
    statusId?: string;
    essenceColor?: string;
    essenceFloor1: number;
    essenceFloor2: number;
    essenceFloor3: number;
    essenceFloor4: number;
    essenceFloor5: number;
    buildSignature: string;
    equippedItems: string[];
}

export interface PlayerDamageBucket {
    startTime: number;
    endTime: number;
    playerLevel: number;
    totalDamage: number;
    bossDamage: number;
    itemDamage: number;
    skillDamage: number;
    statusDamage: number;
    essenceDamage: number;
    basicAttackDamage: number;
    hitCount: number;
    killCount: number;
    biggestHit: number;
    mainSourceName: string;
    mainSourceType: DamageDealtSourceType;
    isPowerSpike: boolean;
}

export interface DamageDealtAnalysis {
    summary: {
        totalDamageDealt: number;
        totalBossDamage: number;
        totalEliteDamage: number;
        totalCommonDamage: number;
        totalKillsFromDamage: number;
        averageDps: number;
        peakDps: number;
        biggestHit: number;
        biggestHitSource: string;
        mostEfficientSource: string;
        generatedAt: string;
    };
    damageBySource: Array<{
        sourceType: DamageDealtSourceType;
        sourceId: string;
        sourceName: string;
        totalDamage: number;
        bossDamage: number;
        kills: number;
        hitCount: number;
        averageDamagePerHit: number;
    }>;
    damageByItem: Array<{
        itemId: string;
        itemName: string;
        directDamage: number;
        indirectDamage: number;
        totalContribution: number;
        bossDamage: number;
        kills: number;
        dpsContribution: number;
        usageTime: number;
        efficiencyScore: number;
    }>;
    damageByEssenceTower: Array<{
        buildSignature: string;
        buildingColor: string;
        floor1: number;
        floor2: number;
        floor3: number;
        floor4: number;
        floor5: number;
        totalDamage: number;
        bossDamage: number;
        averageDps: number;
        kills: number;
        peakWindow: number;
    }>;
    damageByAbility: Array<{
        skillKey: string;
        upgradeId?: string;
        abilityName: string;
        totalDamage: number;
        bossDamage: number;
        kills: number;
        averageDamagePerHit: number;
        hitCount: number;
        critCount: number;
    }>;
    damageByStatus: Array<{
        statusId: string;
        sourceName: string;
        totalDamage: number;
        bossDamage: number;
        kills: number;
        hitCount: number;
    }>;
    timeline: PlayerDamageBucket[];
    recommendations: string[];
}

interface DamageAccumulator {
    sourceType: DamageDealtSourceType;
    sourceId: string;
    sourceName: string;
    totalDamage: number;
    bossDamage: number;
    kills: number;
    hitCount: number;
    critCount: number;
}

const BOSS_TYPES = new Set([
    'SuperBoss', 'Gangplank', 'RainhaDasTrevas', 'PlantaCarnivora', 'FeiticeiroImortal',
    'LichKing', 'CaoDosInfernos', 'TheMightyOne', 'Farao', 'DoutorDoenca',
    'GuardiaoDoLimbo', 'GuardiãoDoLimbo', 'Minos', 'Cerbero', 'Plutao', 'Plutão',
    'Furia', 'Fúria', 'Megera', 'Minotauro', 'Geriao', 'Lucifer', 'Lúcifer',
    'EspectroDeRaziel', 'Smith', 'MestraDaIlusao'
]);

const ELITE_TYPES = new Set([
    'BruxaDoGelo', 'BombardeiroInsano', 'FarsanteCarmesim',
    'GuardianGuerreiro', 'GuardianMago', 'GuardianArqueiro',
    'RedCone', 'EnemyTower'
]);

const SUMMON_TYPES = new Set([
    'AlmaAmaldicoada', 'CaveiraExplosiva', 'EspectroSombrio', 'BrotoCarnivoro',
    'Ghoul', 'Valkyr', 'CloneIlusorio', 'CloneSmith', 'MatilhaGeometra',
    'EscaravelhoFarao', 'EscravoGlacial'
]);

const STRUCTURE_TYPES = new Set(['EnemyTower', 'RedCone']);

export function getDamageTargetCategory(targetType: string): DamageTargetCategory {
    if (STRUCTURE_TYPES.has(targetType)) return 'structure';
    if (BOSS_TYPES.has(targetType)) return 'boss';
    if (ELITE_TYPES.has(targetType)) return 'elite';
    if (SUMMON_TYPES.has(targetType)) return 'summon';
    if (targetType) return 'common';
    return 'unknown';
}

export function buildSignature(build?: PlayerBuild): string {
    const color = build?.buildingColor || 'red';
    const f1 = build?.floor1 ?? 0;
    const f2 = build?.floor2 ?? 0;
    const f3 = build?.floor3 ?? 0;
    const f4 = build?.floor4 ?? 0;
    const f5 = build?.floor5 ?? 0;
    return `${color}-${f1}-${f2}-${f3}-${f4}-${f5}`;
}

export class PlayerDamageTracker {
    private events: PlayerDamageEvent[] = [];
    private readonly maxEvents = 5000;

    record(event: PlayerDamageEvent): void {
        if (!Number.isFinite(event.finalDamage) || event.finalDamage <= 0) return;
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events.splice(0, this.events.length - this.maxEvents);
        }
    }

    getAnalysis(bucketSeconds = 10): DamageDealtAnalysis {
        const sourceMap = new Map<string, DamageAccumulator>();
        const directItemMap = new Map<string, DamageAccumulator & { itemId: string; itemName: string }>();
        const indirectItemMap = new Map<string, { itemId: string; itemName: string; indirectDamage: number; usageTime: number }>();
        const buildMap = new Map<string, {
            buildSignature: string;
            buildingColor: string;
            floor1: number;
            floor2: number;
            floor3: number;
            floor4: number;
            floor5: number;
            totalDamage: number;
            bossDamage: number;
            kills: number;
            peakWindow: number;
        }>();
        const abilityMap = new Map<string, DamageAccumulator & { skillKey: string; upgradeId?: string; abilityName: string }>();
        const statusMap = new Map<string, DamageAccumulator & { statusId: string }>();
        const buckets = new Map<number, PlayerDamageBucket & { sourceTotals?: Map<string, number> }>();

        let totalDamageDealt = 0;
        let totalBossDamage = 0;
        let totalEliteDamage = 0;
        let totalCommonDamage = 0;
        let totalKillsFromDamage = 0;
        let biggestHit = 0;
        let biggestHitSource = 'Desconhecido';
        let maxGameTime = 0;

        for (const e of this.events) {
            totalDamageDealt += e.finalDamage;
            maxGameTime = Math.max(maxGameTime, e.gameTime);
            if (e.targetCategory === 'boss') totalBossDamage += e.finalDamage;
            else if (e.targetCategory === 'elite') totalEliteDamage += e.finalDamage;
            else if (e.targetCategory === 'common') totalCommonDamage += e.finalDamage;
            if (e.isKill) totalKillsFromDamage += 1;
            if (e.finalDamage > biggestHit) {
                biggestHit = e.finalDamage;
                biggestHitSource = e.sourceName;
            }

            this.addDamage(sourceMap, `${e.sourceType}:${e.sourceId || e.sourceName}`, e);

            if (e.itemId) {
                const key = e.itemId;
                if (e.sourceType === 'item' || e.isItem) {
                    const acc = this.addDamage(directItemMap, key, e) as DamageAccumulator & { itemId: string; itemName: string };
                    acc.itemId = e.itemId;
                    acc.itemName = e.itemName || e.sourceName;
                }
            }

            for (const itemId of e.equippedItems) {
                const current = indirectItemMap.get(itemId) || { itemId, itemName: itemId, indirectDamage: 0, usageTime: 0 };
                current.indirectDamage += e.finalDamage;
                current.usageTime = Math.max(current.usageTime, e.gameTime);
                indirectItemMap.set(itemId, current);
            }

            const build = buildMap.get(e.buildSignature) || {
                buildSignature: e.buildSignature,
                buildingColor: e.essenceColor || 'red',
                floor1: e.essenceFloor1,
                floor2: e.essenceFloor2,
                floor3: e.essenceFloor3,
                floor4: e.essenceFloor4,
                floor5: e.essenceFloor5,
                totalDamage: 0,
                bossDamage: 0,
                kills: 0,
                peakWindow: 0,
            };
            build.totalDamage += e.finalDamage;
            if (e.targetCategory === 'boss') build.bossDamage += e.finalDamage;
            if (e.isKill) build.kills += 1;
            buildMap.set(e.buildSignature, build);

            if (e.skillKey || e.isSkill || e.sourceType === 'skill') {
                const key = `${e.skillKey || 'unknown'}:${e.upgradeId || e.abilityName}`;
                const acc = this.addDamage(abilityMap, key, e) as DamageAccumulator & { skillKey: string; upgradeId?: string; abilityName: string };
                acc.skillKey = e.skillKey || 'unknown';
                acc.upgradeId = e.upgradeId;
                acc.abilityName = e.abilityName || e.sourceName;
            }

            if (e.statusId || e.isStatus || e.sourceType === 'status') {
                const statusId = e.statusId || e.sourceId || e.sourceName;
                const acc = this.addDamage(statusMap, statusId, e) as DamageAccumulator & { statusId: string };
                acc.statusId = statusId;
            }

            const idx = Math.floor(e.gameTime / bucketSeconds);
            const startTime = idx * bucketSeconds;
            const bucket = buckets.get(idx) || {
                startTime,
                endTime: startTime + bucketSeconds,
                playerLevel: e.playerLevel,
                totalDamage: 0,
                bossDamage: 0,
                itemDamage: 0,
                skillDamage: 0,
                statusDamage: 0,
                essenceDamage: 0,
                basicAttackDamage: 0,
                hitCount: 0,
                killCount: 0,
                biggestHit: 0,
                mainSourceName: 'Desconhecido',
                mainSourceType: 'unknown',
                isPowerSpike: false,
                sourceTotals: new Map<string, number>(),
            };
            bucket.playerLevel = e.playerLevel;
            bucket.totalDamage += e.finalDamage;
            bucket.hitCount += 1;
            bucket.killCount += e.isKill ? 1 : 0;
            bucket.biggestHit = Math.max(bucket.biggestHit, e.finalDamage);
            bucket.sourceTotals!.set(e.sourceName, (bucket.sourceTotals!.get(e.sourceName) || 0) + e.finalDamage);
            if (e.targetCategory === 'boss') bucket.bossDamage += e.finalDamage;
            if (e.sourceType === 'item' || e.isItem) bucket.itemDamage += e.finalDamage;
            if (e.sourceType === 'skill' || e.isSkill) bucket.skillDamage += e.finalDamage;
            if (e.sourceType === 'status' || e.isStatus) bucket.statusDamage += e.finalDamage;
            if (e.sourceType === 'essence_tower' || e.isEssenceTower) bucket.essenceDamage += e.finalDamage;
            if (e.sourceType === 'basic_attack' || e.isBasicAttack) bucket.basicAttackDamage += e.finalDamage;
            buckets.set(idx, bucket);
        }

        const timeline = [...buckets.values()].sort((a, b) => a.startTime - b.startTime);
        for (let i = 0; i < timeline.length; i++) {
            const bucket = timeline[i];
            const entries = [...(bucket.sourceTotals || new Map()).entries()].sort((a, b) => b[1] - a[1]);
            bucket.mainSourceName = entries[0]?.[0] || 'Desconhecido';
            const match = this.events.find(e => e.sourceName === bucket.mainSourceName);
            bucket.mainSourceType = match?.sourceType || 'unknown';

            const previous = timeline.filter(x => x.startTime < bucket.startTime && x.startTime >= bucket.startTime - 60);
            const avg = previous.length ? previous.reduce((sum, x) => sum + x.totalDamage, 0) / previous.length : 0;
            bucket.isPowerSpike = (avg > 0 && bucket.totalDamage >= avg * 1.5) || bucket.totalDamage >= 600 || bucket.biggestHit >= 250;
            delete bucket.sourceTotals;

            const build = [...buildMap.values()].find(b => b.buildSignature === this.events.find(e => Math.floor(e.gameTime / bucketSeconds) === Math.floor(bucket.startTime / bucketSeconds))?.buildSignature);
            if (build) build.peakWindow = Math.max(build.peakWindow, bucket.totalDamage);
        }

        const duration = Math.max(1, maxGameTime);
        const damageBySource = [...sourceMap.values()]
            .sort((a, b) => b.totalDamage - a.totalDamage)
            .map(acc => ({
                sourceType: acc.sourceType,
                sourceId: acc.sourceId,
                sourceName: acc.sourceName,
                totalDamage: acc.totalDamage,
                bossDamage: acc.bossDamage,
                kills: acc.kills,
                hitCount: acc.hitCount,
                averageDamagePerHit: acc.hitCount ? acc.totalDamage / acc.hitCount : 0,
            }));

        const damageByItem = [...new Set([...directItemMap.keys(), ...indirectItemMap.keys()])].map(itemId => {
            const direct = directItemMap.get(itemId);
            const indirect = indirectItemMap.get(itemId);
            const directDamage = direct?.totalDamage || 0;
            const indirectDamage = indirect?.indirectDamage || 0;
            const totalContribution = directDamage + indirectDamage;
            return {
                itemId,
                itemName: direct?.itemName || indirect?.itemName || itemId,
                directDamage,
                indirectDamage,
                totalContribution,
                bossDamage: direct?.bossDamage || 0,
                kills: direct?.kills || 0,
                dpsContribution: totalContribution / duration,
                usageTime: indirect?.usageTime || duration,
                efficiencyScore: totalContribution > 0 ? (totalContribution / duration) + ((direct?.kills || 0) * 25) : 0,
            };
        }).sort((a, b) => b.totalContribution - a.totalContribution);

        const damageByEssenceTower = [...buildMap.values()]
            .sort((a, b) => b.totalDamage - a.totalDamage)
            .map(b => ({ ...b, averageDps: b.totalDamage / duration }));

        const damageByAbility = [...abilityMap.values()]
            .sort((a, b) => b.totalDamage - a.totalDamage)
            .map(acc => ({
                skillKey: acc.skillKey,
                upgradeId: acc.upgradeId,
                abilityName: acc.abilityName,
                totalDamage: acc.totalDamage,
                bossDamage: acc.bossDamage,
                kills: acc.kills,
                averageDamagePerHit: acc.hitCount ? acc.totalDamage / acc.hitCount : 0,
                hitCount: acc.hitCount,
                critCount: acc.critCount,
            }));

        const damageByStatus = [...statusMap.values()]
            .sort((a, b) => b.totalDamage - a.totalDamage)
            .map(acc => ({
                statusId: acc.statusId,
                sourceName: acc.sourceName,
                totalDamage: acc.totalDamage,
                bossDamage: acc.bossDamage,
                kills: acc.kills,
                hitCount: acc.hitCount,
            }));

        const peakBucket = timeline.length ? [...timeline].sort((a, b) => b.totalDamage - a.totalDamage)[0] : null;
        const topSource = damageBySource[0];
        const recommendations = this.buildRecommendations(damageByItem, damageByEssenceTower, damageByAbility, damageByStatus, peakBucket);

        return {
            summary: {
                totalDamageDealt,
                totalBossDamage,
                totalEliteDamage,
                totalCommonDamage,
                totalKillsFromDamage,
                averageDps: totalDamageDealt / duration,
                peakDps: peakBucket ? peakBucket.totalDamage / bucketSeconds : 0,
                biggestHit,
                biggestHitSource,
                mostEfficientSource: topSource?.sourceName || 'Desconhecido',
                generatedAt: new Date().toISOString(),
            },
            damageBySource,
            damageByItem,
            damageByEssenceTower,
            damageByAbility,
            damageByStatus,
            timeline,
            recommendations,
        };
    }

    private addDamage<T extends DamageAccumulator>(map: Map<string, T>, key: string, event: PlayerDamageEvent): T {
        const current = map.get(key) || {
            sourceType: event.sourceType,
            sourceId: event.sourceId,
            sourceName: event.sourceName,
            totalDamage: 0,
            bossDamage: 0,
            kills: 0,
            hitCount: 0,
            critCount: 0,
        } as T;
        current.totalDamage += event.finalDamage;
        if (event.targetCategory === 'boss') current.bossDamage += event.finalDamage;
        if (event.isKill) current.kills += 1;
        if (event.isCritical) current.critCount += 1;
        current.hitCount += 1;
        map.set(key, current);
        return current;
    }

    private buildRecommendations(
        items: DamageDealtAnalysis['damageByItem'],
        builds: DamageDealtAnalysis['damageByEssenceTower'],
        abilities: DamageDealtAnalysis['damageByAbility'],
        statuses: DamageDealtAnalysis['damageByStatus'],
        peakBucket: PlayerDamageBucket | null
    ): string[] {
        const recommendations: string[] = [];
        if (items[0]) recommendations.push(`Item com maior contribuicao de dano: ${items[0].itemName}.`);
        if (builds[0]) recommendations.push(`Torre de Essencia mais eficiente: ${builds[0].buildSignature}.`);
        if (abilities[0]) recommendations.push(`Habilidade com maior dano: ${abilities[0].abilityName}.`);
        if (statuses[0]) recommendations.push(`Status ofensivo mais forte: ${statuses[0].sourceName}.`);
        if (peakBucket) recommendations.push(`Pico de dano entre ${Math.round(peakBucket.startTime)}s e ${Math.round(peakBucket.endTime)}s.`);
        return recommendations;
    }
}
