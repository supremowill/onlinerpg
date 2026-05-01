import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
/** FeiticeiroImortalDasTrevas (Lord Vouldemord) - souls, barrier w/ reflect, marca da alma, teleport, dark explosion */
export declare class FeiticeiroImortalEnemy extends ServerEnemy {
    baseDamage: number;
    private idealDistance;
    private retreatDistance;
    private teleportTimer;
    isImmortal: boolean;
    souls: string[];
    private habilidades;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
        explosionRadius?: number;
    }[];
    pendingAbilities: any[];
    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number);
    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive?: boolean): void;
    onSoulDestroyed(): void;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** LichKing - frost aura, frost cone, prison, skull summon, blizzard ultimate, revival queue */
export declare class LichKingEnemy extends ServerEnemy {
    auraRadius: number;
    revivalQueue: {
        reviveAt: number;
        position: Vec3;
        originalType: string;
    }[];
    private habilidades;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
    }[];
    pendingAbilities: any[];
    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number);
    addToRevivalQueue(position: Vec3, originalType: string): void;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
    toSnapshot(): import("../../network/Protocol").EnemySnapshot;
}
/** PlantaCarnivoraRainha - whip, poison seeds, sprout summon, devour (pull + bite) */
export declare class PlantaCarnivoraEnemy extends ServerEnemy {
    private habilidades;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
        speed?: number;
    }[];
    pendingAbilities: any[];
    constructor(pos: Vec3, globalMult: number, playerMaxHp: number);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** CaoDosInfernos - dash, mark, roar+shield, frenzy, spawns filhotes */
export declare class CaoDosInfernosEnemy extends ServerEnemy {
    private playerLevel;
    private attackCooldown;
    private lastAttackTime;
    private attackRange;
    filhoteIds: string[];
    respawnQueue: {
        filhoteId: string;
        timer: number;
    }[];
    private habilidades;
    pendingAbilities: any[];
    constructor(pos: Vec3, globalMult: number, playerLevel: number);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** TheMightyOne - the ultimate boss, reflects projectiles, spawns elite minions, absorbs orbs */
export declare class TheMightyOneEnemy extends ServerEnemy {
    auraRadius: number;
    damageBonus: number;
    attackSpeedBonus: number;
    pendingAbilities: any[];
    constructor(pos: Vec3);
    init(): void;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
//# sourceMappingURL=AdvancedBosses.d.ts.map