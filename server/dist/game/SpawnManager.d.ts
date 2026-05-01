import { Vec3 } from '../utils/Vector3';
export interface SpawnEvent {
    type: string;
    position: Vec3;
    count?: number;
    isElite?: boolean;
}
/** Mirrors the client GameManager spawn logic */
export declare class SpawnManager {
    private timers;
    private gameTime;
    globalMultiplier: number;
    collapseLevel: number;
    isRainhaAlive: boolean;
    isPlantaCarnivoraAlive: boolean;
    isGangplankAlive: boolean;
    activeBoss: string | null;
    superBossTriggered: boolean;
    mightyOneAlive: boolean;
    mightyOneNextSpawn: number;
    private guardianTypes;
    private defenderTypes;
    constructor();
    getSpawnPosition(): Vec3;
    update(dt: number): SpawnEvent[];
    onMightyOneDefeated(): void;
    scaleEnemies(): number;
    getNumPlayers(n: number): number;
}
//# sourceMappingURL=SpawnManager.d.ts.map