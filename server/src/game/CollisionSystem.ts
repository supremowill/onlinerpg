import { Vec3 } from '../utils/Vector3';
import { ServerPlayer } from './Player';
import { ServerEnemy } from './enemies/Enemy';
import { ServerProjectile } from './Projectile';

export interface CollisionResult {
    playerHits: { playerId: string; projectileId: string; damage: number; specialEffect: string | null }[];
    enemyHits: { enemyId: string; projectileId: string; damage: number; instigatorId: string; specialEffect: string | null; bleedDamage: number }[];
    orbCollections: { orbId: string; playerId: string }[];
}

export class CollisionSystem {

    checkProjectileVsPlayers(projectiles: ServerProjectile[], players: ServerPlayer[]): CollisionResult['playerHits'] {
        const hits: CollisionResult['playerHits'] = [];
        for (const proj of projectiles) {
            if (proj.isDestroyed || proj.isPlayerOwned) continue;
            for (const p of players) {
                if (p.isDead) continue;
                const dist = proj.position.distanceToXZ(p.position);
                if (dist < proj.hitboxRadius + p.hitboxRadius) {
                    hits.push({ playerId: p.id, projectileId: proj.id, damage: proj.damage, specialEffect: proj.specialEffect });
                    proj.isDestroyed = true;
                    break;
                }
            }
        }
        return hits;
    }

    checkProjectileVsEnemies(projectiles: ServerProjectile[], enemies: ServerEnemy[]): CollisionResult['enemyHits'] {
        const hits: CollisionResult['enemyHits'] = [];
        for (const proj of projectiles) {
            if (proj.isDestroyed || !proj.isPlayerOwned) continue;
            for (const e of enemies) {
                if (e.isDestroyed) continue;
                const dist = proj.position.distanceToXZ(e.position);
                if (dist < proj.hitboxRadius + e.hitboxRadius) {
                    hits.push({ enemyId: e.id, projectileId: proj.id, damage: proj.damage, instigatorId: proj.ownerId, specialEffect: proj.specialEffect, bleedDamage: proj.bleedDamage });
                    if (proj.bounces > 0) { proj.bounces--; proj.direction.negate(); }
                    else proj.isDestroyed = true;
                    break;
                }
            }
        }
        return hits;
    }

    checkPlayerVsOrbs(players: ServerPlayer[], orbs: { id: string; position: Vec3; hitboxRadius: number }[]): CollisionResult['orbCollections'] {
        const collections: CollisionResult['orbCollections'] = [];
        for (const p of players) {
            if (p.isDead) continue;
            for (const orb of orbs) {
                const dist = p.position.distanceToXZ(orb.position);
                if (dist < p.hitboxRadius + orb.hitboxRadius) {
                    collections.push({ orbId: orb.id, playerId: p.id });
                }
            }
        }
        return collections;
    }

    /** Check if point is within map bounds */
    isOutOfBounds(pos: Vec3, half: number): boolean {
        return Math.abs(pos.x) > half || Math.abs(pos.z) > half;
    }

    /** Resolves collision between a circle (player/enemy) and an AABB rectangle (obstacle) */
    resolveCircleRectCollision(pos: Vec3, radius: number, obs: {x: number, z: number, width: number, depth: number}): void {
        const obsHalfW = obs.width / 2;
        const obsHalfD = obs.depth / 2;

        const minX = obs.x - obsHalfW;
        const maxX = obs.x + obsHalfW;
        const minZ = obs.z - obsHalfD;
        const maxZ = obs.z + obsHalfD;

        // Find closest point on the AABB to the circle center
        const closestX = Math.max(minX, Math.min(pos.x, maxX));
        const closestZ = Math.max(minZ, Math.min(pos.z, maxZ));

        // Calculate distance from circle center to closest point
        const distSq = (pos.x - closestX) * (pos.x - closestX) + (pos.z - closestZ) * (pos.z - closestZ);
        
        if (distSq < radius * radius) {
            const dist = Math.sqrt(distSq);
            if (dist === 0) {
                // Center of circle is exactly inside the center of rectangle (rare, but possible if spawned inside)
                pos.z += radius;
            } else {
                // Push circle out
                const overlap = radius - dist;
                pos.x += ((pos.x - closestX) / dist) * overlap;
                pos.z += ((pos.z - closestZ) / dist) * overlap;
            }
        }
    }
}
