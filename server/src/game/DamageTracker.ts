export type DamageSourceType = 'boss' | 'common' | 'elite' | 'summon' | 'status' | 'trap' | 'environment' | 'unknown';

export interface DamageSourceInfo {
    directSourceName: string;
    primarySourceName: string;
    sourceType: DamageSourceType;
    abilityName: string;
    isContinuous: boolean;
    isStatus: boolean;
    isSummoned: boolean;
}

export interface DamageEvent {
    gameTime: number;
    playerLevel: number;
    hpBefore: number;
    hpAfter: number;
    damage: number;
    directSourceName: string;
    primarySourceName: string;
    sourceType: DamageSourceType;
    abilityName: string;
    isContinuous: boolean;
    isStatus: boolean;
    isSummoned: boolean;
}

export interface DamageBucket {
    startTime: number;
    endTime: number;
    playerLevel: number;
    totalDamage: number;
    bossDamage: number;
    commonDamage: number;
    eliteDamage: number;
    statusDamage: number;
    environmentDamage: number;
    summonDamage: number;
    trapDamage: number;
    unknownDamage: number;
    hits: number;
    biggestHit: number;
    mainSourceType: DamageSourceType;
    mainSourceName: string;
    isSpike: boolean;
}

export interface DeathReport {
    finalBlow: DamageEvent | null;
    topContributor: { sourceName: string; damage: number; sourceType: DamageSourceType } | null;
    totalDamageLast10s: number;
    sources: { sourceName: string; damage: number; sourceType: DamageSourceType }[];
    deathTime: number;
    playerLevel: number;
}

export interface DamageAnalysis {
    buckets: DamageBucket[];
    peak: DamageBucket | null;
    totalDamage: number;
    damageByType: Record<string, number>;
}

const BOSS_TYPES = new Set([
    'SuperBoss', 'Gangplank', 'RainhaDasTrevas', 'PlantaCarnivora', 'FeiticeiroImortal',
    'LichKing', 'CaoDosInfernos', 'TheMightyOne', 'Farao', 'DoutorDoenca',
    'GuardiaoDoLimbo', 'GuardiãoDoLimbo', 'Minos', 'Cerbero', 'Plutao', 'Plutão',
    'Furia', 'Fúria', 'Megera', 'Minotauro', 'Geriao', 'Lucifer', 'Lúcifer',
    'EspectroDeRaziel', 'Smith', 'MestraDaIlusao'
]);

const ELITE_TYPES = new Set([
    'BruxaDoGelo', 'BombardeiroInsano',
    'GuardianGuerreiro', 'GuardianMago', 'GuardianArqueiro',
    'RedCone', 'EnemyTower'
]);

const SUMMON_TYPES = new Set([
    'AlmaAmaldicoada', 'CaveiraExplosiva', 'EspectroSombrio', 'BrotoCarnivoro',
    'Ghoul', 'Valkyr', 'CloneIlusorio', 'CloneSmith', 'MatilhaGeometra',
    'EscaravelhoFarao', 'EscravoGlacial'
]);

export class DamageTracker {
    private events: DamageEvent[] = [];
    private deathReport: DeathReport | null = null;
    private readonly maxEvents = 1200;

    record(event: DamageEvent): void {
        if (!Number.isFinite(event.damage) || event.damage <= 0) return;
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events.splice(0, this.events.length - this.maxEvents);
        }
    }

    buildDeathReport(deathTime: number, playerLevel: number): DeathReport {
        const recent = this.events.filter(e => e.gameTime >= deathTime - 10 && e.gameTime <= deathTime + 0.25);
        const finalBlow = recent.length > 0 ? recent[recent.length - 1] : null;
        const bySource = new Map<string, { sourceName: string; damage: number; sourceType: DamageSourceType }>();

        for (const e of recent) {
            const key = e.primarySourceName || e.directSourceName || 'Desconhecido';
            const current = bySource.get(key) || { sourceName: key, damage: 0, sourceType: e.sourceType };
            current.damage += e.damage;
            bySource.set(key, current);
        }

        const sources = [...bySource.values()].sort((a, b) => b.damage - a.damage);
        this.deathReport = {
            finalBlow,
            topContributor: sources[0] || null,
            totalDamageLast10s: recent.reduce((sum, e) => sum + e.damage, 0),
            sources: sources.slice(0, 5),
            deathTime,
            playerLevel,
        };
        return this.deathReport;
    }

    getDeathReport(): DeathReport | null {
        return this.deathReport;
    }

    getAnalysis(bucketSeconds = 10): DamageAnalysis {
        const buckets = new Map<number, DamageBucket & { sourceTotals?: Map<string, number> }>();
        const damageByType: Record<string, number> = {};

        for (const e of this.events) {
            const idx = Math.floor(e.gameTime / bucketSeconds);
            const startTime = idx * bucketSeconds;
            const bucket = buckets.get(idx) || {
                startTime,
                endTime: startTime + bucketSeconds,
                playerLevel: e.playerLevel,
                totalDamage: 0,
                bossDamage: 0,
                commonDamage: 0,
                eliteDamage: 0,
                statusDamage: 0,
                environmentDamage: 0,
                summonDamage: 0,
                trapDamage: 0,
                unknownDamage: 0,
                hits: 0,
                biggestHit: 0,
                mainSourceType: 'unknown',
                mainSourceName: 'Desconhecido',
                isSpike: false,
                sourceTotals: new Map<string, number>(),
            };

            bucket.playerLevel = e.playerLevel;
            bucket.totalDamage += e.damage;
            bucket.hits += 1;
            bucket.biggestHit = Math.max(bucket.biggestHit, e.damage);
            bucket.sourceTotals!.set(e.primarySourceName, (bucket.sourceTotals!.get(e.primarySourceName) || 0) + e.damage);
            damageByType[e.sourceType] = (damageByType[e.sourceType] || 0) + e.damage;

            if (e.sourceType === 'boss') bucket.bossDamage += e.damage;
            else if (e.sourceType === 'common') bucket.commonDamage += e.damage;
            else if (e.sourceType === 'elite') bucket.eliteDamage += e.damage;
            else if (e.sourceType === 'status') bucket.statusDamage += e.damage;
            else if (e.sourceType === 'environment') bucket.environmentDamage += e.damage;
            else if (e.sourceType === 'summon') bucket.summonDamage += e.damage;
            else if (e.sourceType === 'trap') bucket.trapDamage += e.damage;
            else bucket.unknownDamage += e.damage;

            buckets.set(idx, bucket);
        }

        const list = [...buckets.values()].sort((a, b) => a.startTime - b.startTime);
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            const typeTotals: [DamageSourceType, number][] = [
                ['boss', b.bossDamage], ['common', b.commonDamage], ['elite', b.eliteDamage],
                ['status', b.statusDamage], ['environment', b.environmentDamage],
                ['summon', b.summonDamage], ['trap', b.trapDamage], ['unknown', b.unknownDamage],
            ];
            b.mainSourceType = typeTotals.sort((a, c) => c[1] - a[1])[0][0];
            b.mainSourceName = [...(b.sourceTotals || new Map()).entries()].sort((a, c) => c[1] - a[1])[0]?.[0] || 'Desconhecido';

            const previousMinute = list.filter(x => x.startTime < b.startTime && x.startTime >= b.startTime - 60);
            const avg = previousMinute.length ? previousMinute.reduce((sum, x) => sum + x.totalDamage, 0) / previousMinute.length : 0;
            b.isSpike = (avg > 0 && b.totalDamage >= avg * 1.5) || b.totalDamage >= 300 || b.biggestHit >= 150;
            delete b.sourceTotals;
        }

        return {
            buckets: list,
            peak: list.length ? [...list].sort((a, b) => b.totalDamage - a.totalDamage)[0] : null,
            totalDamage: list.reduce((sum, b) => sum + b.totalDamage, 0),
            damageByType,
        };
    }
}

export function inferDamageSource(source: any, fallbackAbility = 'Dano recebido'): DamageSourceInfo {
    if (!source) {
        return {
            directSourceName: 'Desconhecido',
            primarySourceName: 'Desconhecido',
            sourceType: 'unknown',
            abilityName: fallbackAbility,
            isContinuous: false,
            isStatus: false,
            isSummoned: false,
        };
    }

    if (typeof source === 'string') {
        const isStatus = ['poison', 'bleed', 'bleeding', 'burning', 'ignite', 'acid', 'plague', 'mortalWounds'].includes(source);
        return {
            directSourceName: source,
            primarySourceName: source,
            sourceType: isStatus ? 'status' : 'environment',
            abilityName: fallbackAbility || source,
            isContinuous: isStatus,
            isStatus,
            isSummoned: false,
        };
    }

    const type = source.type || source.constructor?.name || '';
    const name = source.name || type || 'Fonte desconhecida';
    const isSummoned = SUMMON_TYPES.has(type) || Boolean(source.ownerId || source.summonerId);
    const sourceType: DamageSourceType = isSummoned ? 'summon' : BOSS_TYPES.has(type) ? 'boss' : ELITE_TYPES.has(type) ? 'elite' : type ? 'common' : 'unknown';

    return {
        directSourceName: name,
        primarySourceName: source.ownerName || source.summonerName || name,
        sourceType,
        abilityName: fallbackAbility,
        isContinuous: false,
        isStatus: false,
        isSummoned,
    };
}
