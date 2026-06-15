import { v4 as uuidv4 } from 'uuid';
import { Vec3 } from '../utils/Vector3';
import { ProjectileSnapshot } from '../network/Protocol';

export class ServerProjectile {
    public id: string = uuidv4();
    public type: string = 'bullet';
    public position: Vec3;
    public direction: Vec3;
    public velocity: Vec3 | null = null; // for arcing projectiles
    public speed: number = 15;
    public damage: number;
    public isCritical: boolean = false;
    public lifetime: number = 3;
    public hitboxRadius: number = 0.3;
    public isPlayerOwned: boolean = false;
    public ownerId: string = '';
    public specialEffect: string | null = null;
    public visualEffect: string | null = null;
    public isBuffed: string | null = null;
    public explosionRadius: number = 0;
    public bleedDamage: number = 0;
    public bounces: number = 0;
    public isDestroyed: boolean = false;
    public color: number = 0xffffff;
    public params: any = undefined;
    public skillUpgrades: { q?: string; w?: string; e?: string; r?: string } | null = null;
    public trackHits: boolean = false;
    public hitTargets: Set<string> = new Set();

    constructor(start: Vec3, dir: Vec3, ownerId: string, isPlayerOwned: boolean, damage: number, color: number) {
        this.position = start.clone();
        this.direction = dir.clone().normalize();
        this.ownerId = ownerId;
        this.isPlayerOwned = isPlayerOwned;
        this.damage = damage;
        this.hitboxRadius = isPlayerOwned ? 0.15 : 0.2;
        this.color = color;
    }

    update(dt: number): void {
        if (this.isDestroyed) return;
        if (this.specialEffect === 'bouncingBomb' || this.specialEffect === 'sementeVenenosa') {
            if (this.velocity) {
                this.position.add(this.velocity.clone().multiplyScalar(dt));
                this.velocity.y -= 9.8 * dt;
                if (this.position.y < this.hitboxRadius) {
                    this.isDestroyed = true;
                }
            }
        } else {
            this.position.add(this.direction.clone().multiplyScalar(this.speed * dt));
        }
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.isDestroyed = true;
    }

    toSnapshot(): ProjectileSnapshot {
        return {
            id: this.id,
            x: this.position.x,
            y: this.position.y,
            z: this.position.z,
            rotY: Math.atan2(this.direction.x, this.direction.z),
            hitboxRadius: this.hitboxRadius,
            isPlayerOwned: this.isPlayerOwned,
            color: this.color,
            specialEffect: this.specialEffect || undefined,
            visualEffect: this.visualEffect || undefined,
            skillUpgrades: this.skillUpgrades || undefined,
        };
    }
}
