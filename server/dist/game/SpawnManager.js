"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpawnManager = void 0;
const Vector3_1 = require("../utils/Vector3");
const config_1 = require("../config");
/** Mirrors the client GameManager spawn logic */
class SpawnManager {
    timers;
    gameTime = 0;
    globalMultiplier = 1;
    collapseLevel = 0;
    isRainhaAlive = false;
    isPlantaCarnivoraAlive = false;
    isGangplankAlive = false;
    activeBoss = null;
    superBossTriggered = false;
    mightyOneAlive = false;
    mightyOneNextSpawn = config_1.CONFIG.SPAWN_TIMERS.THE_MIGHTY_ONE_TIME;
    guardianTypes = ['GuardianGuerreiro', 'GuardianMago', 'GuardianArqueiro'];
    defenderTypes = ['BruxaDoGelo', 'MestraDaIlusao', 'BombardeiroInsano'];
    constructor() {
        const t = config_1.CONFIG.SPAWN_TIMERS;
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
    getSpawnPosition() {
        const half = config_1.CONFIG.GROUND_HALF;
        const margin = 5;
        return new Vector3_1.Vec3((Math.random() * (half * 2 - margin * 2)) - (half - margin), 0, (Math.random() * (half * 2 - margin * 2)) - (half - margin));
    }
    update(dt) {
        this.gameTime += dt;
        const events = [];
        // Global scaling
        this.timers.globalScale -= dt;
        if (this.timers.globalScale <= 0) {
            this.timers.globalScale = config_1.CONFIG.SPAWN_TIMERS.GLOBAL_SCALE;
        }
        // PurpleCubes - every 5s, spawn 2
        this.timers.spawnPurpleCube -= dt;
        if (this.timers.spawnPurpleCube <= 0) {
            this.timers.spawnPurpleCube = config_1.CONFIG.SPAWN_TIMERS.PURPLE_CUBE;
            for (let i = 0; i < 2; i++)
                events.push({ type: 'PurpleCube', position: this.getSpawnPosition() });
        }
        // RedCone + Defender - every 30s
        this.timers.spawnRedCone -= dt;
        if (this.timers.spawnRedCone <= 0) {
            this.timers.spawnRedCone = config_1.CONFIG.SPAWN_TIMERS.RED_CONE;
            const conePos = this.getSpawnPosition();
            events.push({ type: 'RedCone', position: conePos });
            const defType = this.defenderTypes[Math.floor(Math.random() * this.defenderTypes.length)];
            const defPos = conePos.clone().add(new Vector3_1.Vec3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
            events.push({ type: defType, position: defPos });
        }
        // Guardians - after 4 min, every 4 min
        this.timers.spawnGuardian -= dt;
        if (this.gameTime > 240 && this.timers.spawnGuardian <= 0) {
            this.timers.spawnGuardian = config_1.CONFIG.SPAWN_TIMERS.GUARDIAN;
            let count = 1;
            if (this.gameTime >= 1200)
                count = 3;
            else if (this.gameTime >= 600)
                count = 2;
            for (let i = 0; i < count; i++) {
                const gType = this.guardianTypes[Math.floor(Math.random() * this.guardianTypes.length)];
                events.push({ type: gType, position: this.getSpawnPosition() });
            }
        }
        // CaoDosInfernos - every 2 min
        this.timers.spawnCaoDosInfernos -= dt;
        if (this.timers.spawnCaoDosInfernos <= 0) {
            this.timers.spawnCaoDosInfernos = config_1.CONFIG.SPAWN_TIMERS.CAO_DOS_INFERNOS;
            events.push({ type: 'CaoDosInfernos', position: this.getSpawnPosition() });
        }
        // RainhaDasTrevas - every 5 min (single active)
        this.timers.spawnRainha -= dt;
        if (!this.isRainhaAlive && this.timers.spawnRainha <= 0 && !this.activeBoss) {
            this.timers.spawnRainha = config_1.CONFIG.SPAWN_TIMERS.RAINHA;
            this.isRainhaAlive = true;
            events.push({ type: 'RainhaDasTrevas', position: this.getSpawnPosition() });
        }
        // PlantaCarnivora - every 3.5 min
        this.timers.spawnPlantaCarnivora -= dt;
        if (!this.isPlantaCarnivoraAlive && this.timers.spawnPlantaCarnivora <= 0 && !this.activeBoss) {
            this.timers.spawnPlantaCarnivora = config_1.CONFIG.SPAWN_TIMERS.PLANTA_CARNIVORA;
            this.isPlantaCarnivoraAlive = true;
            events.push({ type: 'PlantaCarnivora', position: this.getSpawnPosition() });
        }
        // Gangplank - every 6 min
        this.timers.spawnGangplank -= dt;
        if (!this.isGangplankAlive && this.timers.spawnGangplank <= 0 && !this.activeBoss) {
            this.timers.spawnGangplank = config_1.CONFIG.SPAWN_TIMERS.GANGPLANK;
            this.isGangplankAlive = true;
            events.push({ type: 'Gangplank', position: this.getSpawnPosition() });
        }
        // FeiticeiroImortal - every 7 min
        this.timers.spawnFeiticeiro -= dt;
        if (this.timers.spawnFeiticeiro <= 0 && !this.activeBoss) {
            this.timers.spawnFeiticeiro = config_1.CONFIG.SPAWN_TIMERS.FEITICEIRO;
            events.push({ type: 'FeiticeiroImortal', position: this.getSpawnPosition() });
        }
        // LichKing - every 10 min
        this.timers.spawnLichKing -= dt;
        if (this.timers.spawnLichKing <= 0 && !this.activeBoss) {
            this.timers.spawnLichKing = config_1.CONFIG.SPAWN_TIMERS.LICH_KING;
            events.push({ type: 'LichKing', position: this.getSpawnPosition() });
        }
        // SuperBoss - at 3 min (once)
        if (!this.superBossTriggered && this.gameTime >= config_1.CONFIG.SPAWN_TIMERS.SUPER_BOSS_TIME) {
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
    onMightyOneDefeated() {
        this.mightyOneAlive = false;
        this.collapseLevel++;
        this.globalMultiplier *= config_1.CONFIG.COLLAPSE_MULTIPLIER;
        this.mightyOneNextSpawn = this.gameTime + config_1.CONFIG.SPAWN_TIMERS.THE_MIGHTY_ONE_TIME;
    }
    scaleEnemies() {
        return this.globalMultiplier;
    }
    getNumPlayers(n) {
        return 1 + config_1.CONFIG.ENEMY_SCALE_PER_PLAYER * (n - 1);
    }
}
exports.SpawnManager = SpawnManager;
//# sourceMappingURL=SpawnManager.js.map