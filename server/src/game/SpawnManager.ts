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
    public isSuperBossAlive = false;
    public isFeiticeiroAlive = false;
    public isLichKingAlive = false;
    public mightyOneAlive = false;
    public mightyOneNextSpawn = CONFIG.SPAWN_TIMERS.THE_MIGHTY_ONE_TIME;

    private guardianTypes = ['GuardianGuerreiro', 'GuardianMago', 'GuardianArqueiro'];
    private defenderTypes = ['BruxaDoGelo', 'MestraDaIlusao', 'BombardeiroInsano'];

    // Novos bosses do Limbo (Círculos 1-9)
    public isGuardiãoDoLimboAlive = false;
    public isMinosAlive = false;
    public isCerberoAlive = false;
    public isPlutaoAlive = false;
    public isFuriaAlive = false;
    public isMegeraAlive = false;
    public isMinotauroAlive = false;
    public isGeriaoAlive = false;
    public isLuciferAlive = false;
    public isEspectroDeRazielAlive = false;
    public isSmithAlive = false;
    // O Faraó — Entidade Deus (acima de boss)
    public isFaraoAlive = false;
    public faraoSpawnCount = 0;
    public faraoWarningTimer = 0;
    public faraoWarningActive = false;

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
            // Novos bosses do Limbo (Círculos 1-9)
            spawnGuardiãoDoLimbo: t.GUARDIAO_DO_LIMBO,
            spawnMinos: t.MINOS,
            spawnCerbero: t.CERBERO,
            spawnPlutao: t.PLUTAO,
            spawnFuria: t.FURIA,
            spawnMegera: t.MEGERA,
            spawnMinotauro: t.MINOTAURO,
            spawnGeriao: t.GERIAO,
            spawnLucifer: t.LUCIFER,
            spawnEspectroDeRaziel: t.ESPECTRO_DE_RAZIEL,
            spawnSmith: t.SMITH,
            spawnFarao: t.FARAO,
            spawnSuperBoss: t.SUPER_BOSS_TIME,
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
        if (!this.isRainhaAlive) {
            this.timers.spawnRainha -= dt;
            if (this.timers.spawnRainha <= 0 && !this.activeBoss) {
                this.timers.spawnRainha = CONFIG.SPAWN_TIMERS.RAINHA;
                this.isRainhaAlive = true;
                events.push({ type: 'RainhaDasTrevas', position: this.getSpawnPosition() });
            }
        }

        // PlantaCarnivora - every 3.5 min
        if (!this.isPlantaCarnivoraAlive) {
            this.timers.spawnPlantaCarnivora -= dt;
            if (this.timers.spawnPlantaCarnivora <= 0 && !this.activeBoss) {
                this.timers.spawnPlantaCarnivora = CONFIG.SPAWN_TIMERS.PLANTA_CARNIVORA;
                this.isPlantaCarnivoraAlive = true;
                events.push({ type: 'PlantaCarnivora', position: this.getSpawnPosition() });
            }
        }

        // Gangplank - every 6 min
        if (!this.isGangplankAlive) {
            this.timers.spawnGangplank -= dt;
            if (this.timers.spawnGangplank <= 0 && !this.activeBoss) {
                this.timers.spawnGangplank = CONFIG.SPAWN_TIMERS.GANGPLANK;
                this.isGangplankAlive = true;
                events.push({ type: 'Gangplank', position: this.getSpawnPosition() });
            }
        }

        // FeiticeiroImortal - every 7 min
        if (!this.isFeiticeiroAlive) {
            this.timers.spawnFeiticeiro -= dt;
            if (this.timers.spawnFeiticeiro <= 0 && !this.activeBoss) {
                this.timers.spawnFeiticeiro = CONFIG.SPAWN_TIMERS.FEITICEIRO;
                this.isFeiticeiroAlive = true;
                events.push({ type: 'FeiticeiroImortal', position: this.getSpawnPosition() });
            }
        }

        // LichKing - every 10 min
        if (!this.isLichKingAlive) {
            this.timers.spawnLichKing -= dt;
            if (this.timers.spawnLichKing <= 0 && !this.activeBoss) {
                this.timers.spawnLichKing = CONFIG.SPAWN_TIMERS.LICH_KING;
                this.isLichKingAlive = true;
                events.push({ type: 'LichKing', position: this.getSpawnPosition() });
            }
        }

        // SuperBoss - every 3 min
        if (!this.isSuperBossAlive) {
            this.timers.spawnSuperBoss -= dt;
            if (this.timers.spawnSuperBoss <= 0 && !this.activeBoss) {
                this.timers.spawnSuperBoss = CONFIG.SPAWN_TIMERS.SUPER_BOSS_TIME;
                this.isSuperBossAlive = true;
                events.push({ type: 'SuperBoss', position: this.getSpawnPosition() });
            }
        }

        // TheMightyOne - at 10 min, respawns
        if (!this.mightyOneAlive && this.gameTime >= this.mightyOneNextSpawn) {
            this.mightyOneAlive = true;
            events.push({ type: 'TheMightyOne', position: this.getSpawnPosition() });
        }

        // === NOVOS BOSSES DO LIMBO (Círculos 1-9) ===

        // Círculo 1 - Guardião do Limbo (60s)
        if (!this.isGuardiãoDoLimboAlive) {
            this.timers.spawnGuardiãoDoLimbo -= dt;
            if (this.timers.spawnGuardiãoDoLimbo <= 0 && !this.activeBoss) {
                this.timers.spawnGuardiãoDoLimbo = CONFIG.SPAWN_TIMERS.GUARDIAO_DO_LIMBO;
                this.isGuardiãoDoLimboAlive = true;
                events.push({ type: 'GuardiãoDoLimbo', position: this.getSpawnPosition() });
            }
        }

        // Círculo 2 - Minos (120s)
        if (!this.isMinosAlive) {
            this.timers.spawnMinos -= dt;
            if (this.timers.spawnMinos <= 0 && !this.activeBoss) {
                this.timers.spawnMinos = CONFIG.SPAWN_TIMERS.MINOS;
                this.isMinosAlive = true;
                events.push({ type: 'Minos', position: this.getSpawnPosition() });
            }
        }

        // Círculo 3 - Cerbero (180s)
        if (!this.isCerberoAlive) {
            this.timers.spawnCerbero -= dt;
            if (this.timers.spawnCerbero <= 0 && !this.activeBoss) {
                this.timers.spawnCerbero = CONFIG.SPAWN_TIMERS.CERBERO;
                this.isCerberoAlive = true;
                events.push({ type: 'Cerbero', position: this.getSpawnPosition() });
            }
        }

        // Círculo 4 - Plutão (240s)
        if (!this.isPlutaoAlive) {
            this.timers.spawnPlutao -= dt;
            if (this.timers.spawnPlutao <= 0 && !this.activeBoss) {
                this.timers.spawnPlutao = CONFIG.SPAWN_TIMERS.PLUTAO;
                this.isPlutaoAlive = true;
                events.push({ type: 'Plutão', position: this.getSpawnPosition() });
            }
        }

        // Círculo 5 - Fúria (300s)
        if (!this.isFuriaAlive) {
            this.timers.spawnFuria -= dt;
            if (this.timers.spawnFuria <= 0 && !this.activeBoss) {
                this.timers.spawnFuria = CONFIG.SPAWN_TIMERS.FURIA;
                this.isFuriaAlive = true;
                events.push({ type: 'Fúria', position: this.getSpawnPosition() });
            }
        }

        // Círculo 6 - Megera (360s)
        if (!this.isMegeraAlive) {
            this.timers.spawnMegera -= dt;
            if (this.timers.spawnMegera <= 0 && !this.activeBoss) {
                this.timers.spawnMegera = CONFIG.SPAWN_TIMERS.MEGERA;
                this.isMegeraAlive = true;
                events.push({ type: 'Megera', position: this.getSpawnPosition() });
            }
        }

        // Círculo 7 - Minotauro (420s)
        if (!this.isMinotauroAlive) {
            this.timers.spawnMinotauro -= dt;
            if (this.timers.spawnMinotauro <= 0 && !this.activeBoss) {
                this.timers.spawnMinotauro = CONFIG.SPAWN_TIMERS.MINOTAURO;
                this.isMinotauroAlive = true;
                events.push({ type: 'Minotauro', position: this.getSpawnPosition() });
            }
        }

        // Círculo 8 - Geriao (480s)
        if (!this.isGeriaoAlive) {
            this.timers.spawnGeriao -= dt;
            if (this.timers.spawnGeriao <= 0 && !this.activeBoss) {
                this.timers.spawnGeriao = CONFIG.SPAWN_TIMERS.GERIAO;
                this.isGeriaoAlive = true;
                events.push({ type: 'Geriao', position: this.getSpawnPosition() });
            }
        }

        // Círculo 9 - Lúcifer Cósmico (540s = 9 min)
        if (!this.isLuciferAlive) {
            this.timers.spawnLucifer -= dt;
            if (this.timers.spawnLucifer <= 0 && !this.activeBoss) {
                this.timers.spawnLucifer = CONFIG.SPAWN_TIMERS.LUCIFER;
                this.isLuciferAlive = true;
                events.push({ type: 'Lúcifer', position: this.getSpawnPosition() });
            }
        }

        // Espectro de Raziel (480s = 8 min)
        if (!this.isEspectroDeRazielAlive) {
            this.timers.spawnEspectroDeRaziel -= dt;
            if (this.timers.spawnEspectroDeRaziel <= 0 && !this.activeBoss) {
                this.timers.spawnEspectroDeRaziel = CONFIG.SPAWN_TIMERS.ESPECTRO_DE_RAZIEL || 480;
                this.isEspectroDeRazielAlive = true;
                events.push({ type: 'EspectroDeRaziel', position: this.getSpawnPosition() });
            }
        }

        // Smith - O Agente Corruptor (150s = 2:30 min) - ciclo de invasão
        this.timers.spawnSmith -= dt;
        if (this.timers.spawnSmith <= 0) {
            this.timers.spawnSmith = CONFIG.SPAWN_TIMERS.SMITH;
            console.log(`[SpawnManager] Smith spawn triggered! isSmithAlive=${this.isSmithAlive} timer=${this.timers.spawnSmith}`);
            if (this.isSmithAlive) {
                // Smith anterior ainda vivo: absorver e dobrar tamanho + 50% dano
                console.log('[SpawnManager] SmithAbsorb event pushed');
                events.push({ type: 'SmithAbsorb', position: this.getSpawnPosition() });
            } else {
                this.isSmithAlive = true;
                console.log('[SpawnManager] Smith event pushed');
                events.push({ type: 'Smith', position: this.getSpawnPosition() });
            }
        }

        // === O FARAÓ — Entidade Deus (12 min, respawns, independent of activeBoss) ===
        if (!this.isFaraoAlive && !this.faraoWarningActive) {
            this.timers.spawnFarao -= dt;
            if (this.timers.spawnFarao <= 0) {
                // Start 5s warning phase
                this.faraoWarningActive = true;
                this.faraoWarningTimer = CONFIG.FARAO.SPAWN_WARNING_DURATION / 1000; // 5s
                events.push({ type: 'FaraoWarning', position: this.getSpawnPosition() });
            }
        }
        if (this.faraoWarningActive) {
            this.faraoWarningTimer -= dt;
            if (this.faraoWarningTimer <= 0) {
                this.faraoWarningActive = false;
                this.isFaraoAlive = true;
                this.timers.spawnFarao = CONFIG.SPAWN_TIMERS.FARAO;
                events.push({ type: 'Farao', position: this.getSpawnPosition() });
            }
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

    onFaraoDefeated(): void {
        this.isFaraoAlive = false;
        this.faraoSpawnCount++;
    }
}
