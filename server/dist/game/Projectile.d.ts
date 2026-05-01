import { Vec3 } from '../utils/Vector3';
import { ProjectileSnapshot } from '../network/Protocol';
export declare class ServerProjectile {
    id: string;
    position: Vec3;
    direction: Vec3;
    velocity: Vec3 | null;
    speed: number;
    damage: number;
    lifetime: number;
    hitboxRadius: number;
    isPlayerOwned: boolean;
    ownerId: string;
    specialEffect: string | null;
    isBuffed: string | null;
    explosionRadius: number;
    bleedDamage: number;
    bounces: number;
    color: number;
    isDestroyed: boolean;
    constructor(start: Vec3, dir: Vec3, ownerId: string, isPlayerOwned: boolean, damage: number, color: number);
    update(dt: number): void;
    toSnapshot(): ProjectileSnapshot;
}
//# sourceMappingURL=Projectile.d.ts.map