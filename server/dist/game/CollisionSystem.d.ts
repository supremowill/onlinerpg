import { Vec3 } from '../utils/Vector3';
import { ServerPlayer } from './Player';
import { ServerEnemy } from './enemies/Enemy';
import { ServerProjectile } from './Projectile';
export interface CollisionResult {
    playerHits: {
        playerId: string;
        projectileId: string;
        damage: number;
        specialEffect: string | null;
    }[];
    enemyHits: {
        enemyId: string;
        projectileId: string;
        damage: number;
        instigatorId: string;
        specialEffect: string | null;
        bleedDamage: number;
    }[];
    orbCollections: {
        orbId: string;
        playerId: string;
    }[];
}
export declare class CollisionSystem {
    checkProjectileVsPlayers(projectiles: ServerProjectile[], players: ServerPlayer[]): CollisionResult['playerHits'];
    checkProjectileVsEnemies(projectiles: ServerProjectile[], enemies: ServerEnemy[]): CollisionResult['enemyHits'];
    checkPlayerVsOrbs(players: ServerPlayer[], orbs: {
        id: string;
        position: Vec3;
        hitboxRadius: number;
    }[]): CollisionResult['orbCollections'];
    /** Check if point is within map bounds */
    isOutOfBounds(pos: Vec3, half: number): boolean;
    /** Resolves collision between a circle (player/enemy) and an AABB rectangle (obstacle) */
    resolveCircleRectCollision(pos: Vec3, radius: number, obs: {
        x: number;
        z: number;
        width: number;
        depth: number;
    }): void;
}
//# sourceMappingURL=CollisionSystem.d.ts.map