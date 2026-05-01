import { Vec3 } from '../utils/Vector3';
import { CONFIG } from '../config';

export interface SpawnEvent {
    type: string;
    position: Vec3;
    count?: number;
    isElite?: boolean;
}

/** Mirrors the client GameManager spawn logic */
export class SpawnManager {
    private timers: Record<string, number>;
    private gameTime = 0;
    public globalMultiplier = 1;
    public collapseLevel = 0;
    public isRainhaAlive = false;
    public isPlantaCarnivoraAlive = false;
    public isGangplankAlive = false;
    public activeBoss: string | null = null;
    public superBossTriggered = false;
    public mightyOneAlive = false;
    public mightyOneNextSpawn = CONFIG.SPAWN_TIMERS.THE_MIGHTY_ONE_TIME;

    private guardianTypes = ['GuardianGuerreiro', 'GuardianMago', 'GuardianArqueiro'];
    private defenderTypes = ['BruxaDoGelo', 'MestraDaIlusao', 'BombardeiroInsano'];

    constructor() {
        const t = CONFIG.SPAWN_TIMERS;
        this.timers = {
            globalScale: t.GLOBAL_SCALE,
            spawnPurpleCube: t.PURPLE_CUBE,
            spawnRedCone: t.RED_CONE,
            spawnGuardian: t.GUARDIAN,
            spawnCaoDosInfernos: t.CAO_DOS_INFERNOS,
            spawnRainha: t.RAINHA,
            spawnPlantaCarnivora: t.PLANTA_CARNIVORA,
            spawnFeiticeiro: t.FEITICEIRO,
            spawnLichKing: t.LICH_KING,
            spawnGangplank: t.GANGPLANK,
        };
    }

    getSpawnPosition(): Vec3 {
        const half = CONFIG.GROUND_HALF;
        const margin = 5;
        return new Vec3(
            (Math.random() * (half * 2 - margin * 2)) - (half - margin),
            0,
            (Math.random() * (half * 2 - margin * 2)) - (half - margin)
        );
    }

    update(dt: number): SpawnEvent[] {
        this.gameTime += dt;
        const events: SpawnEvent[] = [];

        // Global scaling
        this.timers.globalScale -= dt;
        if (this.timers.globalScale <= 0) {
            this.timers.globalScale = CONFIG.SPAWN_TIMERS.GLOBAL_SCALE;
        }

        // PurpleCubes - every 5s, spawn 2
        this.timers.spawnPurpleCube -= dt;
        if (this.timers.spawnPurpleCube <= 0) {
            this.timers.spawnPurpleCube = CONFIG.SPAWN_TIMERS.PURPLE_CUBE;
            for (let i = 0; i < 2; i++) events.push({ type: 'PurpleCube', position: this.getSpawnPosition() });
        }

        // RedCone + Defender - every 30s
        this.timers.spawnRedCone -= dt;
        if (this.timers.spawnRedCone <= 0) {
            this.timers.spawnRedCone = CONFIG.SPAWN_TIMERS.RED_CONE;
            const conePos = this.getSpawnPosition();
            events.push({ type: 'RedCone', position: conePos });
            const defType = this.defenderTypes[Math.floor(Math.random() * this.defenderTypes.length)];
            const defPos = conePos.clone().add(new Vec3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
            events.push({ type: defType, position: defPos });
        }

        // Guardians - after 4 min, every 4 min
        this.timers.spawnGuardian -= dt;
        if (this.gameTime > 240 && this.timers.spawnGuardian <= 0) {
            this.timers.spawnGuardian = CONFIG.SPAWN_TIMERS.GUARDIAN;
            let count = 1;
            if (this.gameTime >= 1200) count = 3;
            else if (this.gameTime >= 600) count = 2;
            for (let i = 0; i < count; i++) {
                const gType = this.guardianTypes[Math.floor(Math.random() * this.guardianTypes.length)];
                events.push({ type: gType, position: this.getSpawnPosition() });
            }
        }

        // CaoDosInfernos - every 2 min
        this.timers.spawnCaoDosInfernos -= dt;
        if (this.timers.spawnCaoDosInfernos <= 0) {
            this.timers.spawnCaoDosInfernos = CONFIG.SPAWN_TIMERS.CAO_DOS_INFERNOS;
            events.push({ type: 'CaoDosInfernos', position: this.getSpawnPosition() });
        }

        // RainhaDasTrevas - every 5 min (single active)
        this.timers.spawnRainha -= dt;
        if (!this.isRainhaAlive && this.timers.spawnRainha <= 0 && !this.activeBoss) {
            this.timers.spawnRainha = CONFIG.SPAWN_TIMERS.RAINHA;
            this.isRainhaAlive = true;
            events.push({ type: 'RainhaDasTrevas', position: this.getSpawnPosition() });
        }

        // PlantaCarnivora - every 3.5 min
        this.timers.spawnPlantaCarnivora -= dt;
        if (!this.isPlantaCarnivoraAlive && this.timers.spawnPlantaCarnivora <= 0 && !this.activeBoss) {
            this.timers.spawnPlantaCarnivora = CONFIG.SPAWN_TIMERS.PLANTA_CARNIVORA;
            this.isPlantaCarnivoraAlive = true;
            events.push({ type: 'PlantaCarnivora', position: this.getSpawnPosition() });
        }

        // Gangplank - every 6 min
        this.timers.spawnGangplank -= dt;
        if (!this.isGangplankAlive && this.timers.spawnGangplank <= 0 && !this.activeBoss) {
            this.timers.spawnGangplank = CONFIG.SPAWN_TIMERS.GANGPLANK;
            this.isGangplankAlive = true;
            events.push({ type: 'Gangplank', position: this.getSpawnPosition() });
        }

        // FeiticeiroImortal - every 7 min
        this.timers.spawnFeiticeiro -= dt;
        if (this.timers.spawnFeiticeiro <= 0 && !this.activeBoss) {
            this.timers.spawnFeiticeiro = CONFIG.SPAWN_TIMERS.FEITICEIRO;
            events.push({ type: 'FeiticeiroImortal', position: this.getSpawnPosition() });
        }

        // LichKing - every 10 min
        this.timers.spawnLichKing -= dt;
        if (this.timers.spawnLichKing <= 0 && !this.activeBoss) {
            this.timers.spawnLichKing = CONFIG.SPAWN_TIMERS.LICH_KING;
            events.push({ type: 'LichKing', position: this.getSpawnPosition() });
        }

        // SuperBoss - at 3 min (once)
        if (!this.superBossTriggered && this.gameTime >= CONFIG.SPAWN_TIMERS.SUPER_BOSS_TIME) {
            this.superBossTriggered = true;
            events.push({ type: 'SuperBoss', position: this.getSpawnPosition() });
        }

        // TheMightyOne - at 10 min, respawns
        if (!this.mightyOneAlive && this.gameTime >= this.mightyOneNextSpawn) {
            this.mightyOneAlive = true;
            events.push({ type: 'TheMightyOne', position: this.getSpawnPosition() });
        }

        return events;
    }

    onMightyOneDefeated(): void {
        this.mightyOneAlive = false;
        this.collapseLevel++;
        this.globalMultiplier *= CONFIG.COLLAPSE_MULTIPLIER;
        this.mightyOneNextSpawn = this.gameTime + CONFIG.SPAWN_TIMERS.THE_MIGHTY_ONE_TIME;
    }

    scaleEnemies(): number {
        return this.globalMultiplier;
    }

    getNumPlayers(n: number): number {
        return 1 + CONFIG.ENEMY_SCALE_PER_PLAYER * (n - 1);
    }
}
