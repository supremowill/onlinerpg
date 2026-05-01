import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
/** BruxaDoGelo - Ice Witch: freezing cone, blizzard AoE, ice wall (slow), immunity to freeze */
export declare class BruxaDoGeloEnemy extends ServerEnemy {
    private freezingConeCooldown;
    private lastFreezingCone;
    private blizzardCooldown;
    private lastBlizzard;
    private iceWallCooldown;
    private lastIceWall;
    pendingAbilities: any[];
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
    }[];
    constructor(pos: Vec3, globalMultiplier: number);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** MestraDaIlusao - Illusion Mistress */
export declare class MestraDaIlusaoEnemy extends ServerEnemy {
    habilidades: {
        h1: {
            cooldown: number;
            lastUsed: number;
            state: "idle" | "dashing" | "returning";
            startPos: Vec3 | null;
            returnTimer: number;
        };
        h2: {
            cooldown: number;
            lastUsed: number;
            state: "idle" | "linking";
            linkTimer: number;
            target: ServerPlayer | null;
        };
        h3: {
            cooldown: number;
            lastUsed: number;
        };
    };
    pendingAbilities: any[];
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
    }[];
    private damageReduction;
    constructor(pos: Vec3, globalMultiplier: number);
    takeDamage(amount: number, instigator?: ServerPlayer | null): void;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** BombardeiroInsano - Insane Bomber: bouncing bombs, mine field, armor fracture, burn */
export declare class BombardeiroInsanoEnemy extends ServerEnemy {
    private bouncingBombCooldown;
    private lastBouncingBomb;
    private mineFieldCooldown;
    private lastMineField;
    private armorFractureCooldown;
    private lastArmorFracture;
    private attackCooldown;
    private lastAttack;
    pendingAbilities: any[];
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
        explosionRadius?: number;
    }[];
    constructor(pos: Vec3, globalMultiplier: number);
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
//# sourceMappingURL=Defenders.d.ts.map