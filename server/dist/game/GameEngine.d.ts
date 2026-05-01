import { ServerPlayer } from './Player';
import { ServerEnemy } from './enemies/Enemy';
import { ServerProjectile } from './Projectile';
import { CollisionSystem } from './CollisionSystem';
import { SpawnManager } from './SpawnManager';
import { Vec3 } from '../utils/Vector3';
import { WorldSnapshot } from '../network/Protocol';
export interface Orb {
    id: string;
    type: 'xp' | 'healing' | 'buff';
    position: Vec3;
    hitboxRadius: number;
    buffType?: string;
    buffEffects?: any;
    buffDuration?: number;
}
export interface DynamicZone {
    id: string;
    type: string;
    position: Vec3;
    radius: number;
    duration: number;
    timer: number;
    damagePerSec: number;
    lastTick: number;
    extras?: any;
}
export declare class GameEngine {
    players: Map<string, ServerPlayer>;
    enemies: ServerEnemy[];
    playerProjectiles: ServerProjectile[];
    enemyProjectiles: ServerProjectile[];
    orbs: Orb[];
    zones: DynamicZone[];
    obstacles: {
        id: string;
        x: number;
        z: number;
        width: number;
        depth: number;
    }[];
    spawnManager: SpawnManager;
    collisionSystem: CollisionSystem;
    tick: number;
    gameTime: number;
    isGameOver: boolean;
    private towerRespawnQueue;
    private healingTowerPos;
    private healingTowerLastHeal;
    private orbIdCounter;
    private zoneIdCounter;
    constructor(numPlayers: number);
    private spawnInitialEntities;
    addPlayer(id: string, name: string): ServerPlayer;
    removePlayer(id: string): void;
    updateTick(dt: number): void;
    private handleSpawnEvent;
    private processEnemyActions;
    private processPlayerActions;
    private handleAbility;
    private processCollisions;
    private onEnemyKilled;
    private spawnItemDrop;
    private updateZones;
    private updateHealingTower;
    private updateTowerRespawns;
    private cleanup;
    handleSkill(playerId: string, skill: 'q' | 'w' | 'e' | 'r'): void;
    getSnapshot(): WorldSnapshot;
}
//# sourceMappingURL=GameEngine.d.ts.map