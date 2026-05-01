import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
/** PurpleCube - basic ranged enemy that chases and shoots */
export declare class PurpleCubeEnemy extends ServerEnemy {
    private attackRange;
    private attackCooldown;
    private lastAttackTime;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
    }[];
    constructor(pos: Vec3, globalMultiplier: number);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** RedCone - stationary turret that fires spreads of projectiles */
export declare class RedConeEnemy extends ServerEnemy {
    private attackRange;
    private attackCooldown;
    private lastAttackTime;
    projectileCount: number;
    private lastProjectileIncreaseTime;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
    }[];
    constructor(pos: Vec3, globalMultiplier: number);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** EnemyTower - static tower with ranged attacks, respawns after destruction */
export declare class EnemyTowerEnemy extends ServerEnemy {
    private attackRange;
    private attackCooldown;
    private lastAttackTime;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
    }[];
    respawnDelay: number;
    respawnTimer: number;
    isWaitingRespawn: boolean;
    constructor(pos: Vec3, globalMultiplier: number);
    getDamage(targetDist: number): number;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
    respawn(): void;
}
/** GuardianGuerreiro - melee warrior with stun */
export declare class GuardianGuerreiroEnemy extends ServerEnemy {
    private attackRange;
    private attackCooldown;
    private lastAttackTime;
    private stunCooldown;
    private lastStunTime;
    isElite: boolean;
    pendingMeleeAttacks: {
        targetId: string;
        damage: number;
        stun?: number;
    }[];
    constructor(pos: Vec3, globalMultiplier: number, isElite?: boolean);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** GuardianMago - ranged mage that repositions, freeze ability */
export declare class GuardianMagoEnemy extends ServerEnemy {
    private attackRange;
    private minAttackRange;
    private attackCooldown;
    private lastAttackTime;
    private freezeCooldown;
    private lastFreezeTime;
    private state;
    private stateTimer;
    private targetPosition;
    private castDuration;
    isElite: boolean;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
        explosionRadius?: number;
    }[];
    constructor(pos: Vec3, globalMultiplier: number, isElite?: boolean);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** GuardianArqueiro - ranged archer with bleed, maintains ideal distance */
export declare class GuardianArqueiroEnemy extends ServerEnemy {
    private attackRange;
    private attackCooldown;
    private lastAttackTime;
    private idealDistance;
    private retreatDistance;
    isElite: boolean;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
        bleedDamage?: number;
    }[];
    constructor(pos: Vec3, globalMultiplier: number, isElite?: boolean);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
//# sourceMappingURL=BasicEnemies.d.ts.map