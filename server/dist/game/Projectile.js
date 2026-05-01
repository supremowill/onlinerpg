"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerProjectile = void 0;
const uuid_1 = require("uuid");
class ServerProjectile {
    id = (0, uuid_1.v4)();
    position;
    direction;
    velocity = null; // for arcing projectiles
    speed = 15;
    damage;
    lifetime = 3;
    hitboxRadius;
    isPlayerOwned;
    ownerId;
    specialEffect = null;
    isBuffed = null;
    explosionRadius = 0;
    bleedDamage = 0;
    bounces = 0;
    color;
    isDestroyed = false;
    constructor(start, dir, ownerId, isPlayerOwned, damage, color) {
        this.position = start.clone();
        this.direction = dir.clone().normalize();
        this.ownerId = ownerId;
        this.isPlayerOwned = isPlayerOwned;
        this.damage = damage;
        this.hitboxRadius = isPlayerOwned ? 0.15 : 0.2;
        this.color = color;
    }
    update(dt) {
        if (this.isDestroyed)
            return;
        if (this.specialEffect === 'bouncingBomb' || this.specialEffect === 'sementeVenenosa') {
            if (this.velocity) {
                this.position.add(this.velocity.clone().multiplyScalar(dt));
                this.velocity.y -= 9.8 * dt;
                if (this.position.y < this.hitboxRadius) {
                    this.isDestroyed = true;
                }
            }
        }
        else {
            this.position.add(this.direction.clone().multiplyScalar(this.speed * dt));
        }
        this.lifetime -= dt;
        if (this.lifetime <= 0)
            this.isDestroyed = true;
    }
    toSnapshot() {
        return {
            id: this.id,
            x: this.position.x,
            y: this.position.y,
            z: this.position.z,
            isPlayerOwned: this.isPlayerOwned,
            color: this.color,
            specialEffect: this.specialEffect || undefined,
        };
    }
}
exports.ServerProjectile = ServerProjectile;
//# sourceMappingURL=Projectile.js.map