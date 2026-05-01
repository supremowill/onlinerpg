import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
/** SuperBoss - absorbs PurpleCubes/orbs, aura pull, cone projectiles */
export declare class SuperBossEnemy extends ServerEnemy {
    auraRadius: number;
    pullForce: number;
    damageMultiplier: number;
    attackSpeedMultiplier: number;
    isAggressive: boolean;
    private attackCooldown;
    private lastAttackTime;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
    }[];
    pendingAbsorptions: string[];
    constructor(pos: Vec3, globalMult: number, hpOverride?: number, damageMult?: number);
    getDamageForTarget(target: ServerPlayer): number;
    absorbCube(hpBonus: number): void;
    absorbXpOrb(): void;
    absorbHealingOrb(): void;
    checkAggression(): void;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
}
/** Gangplank - musket, powder kegs, rum heal, cannon salvo, incendiary passive */
export declare class GangplankEnemy extends ServerEnemy {
    private baseMaxHp;
    baseDamage: number;
    private habilidades;
    private passiva;
    pendingProjectiles: {
        dir: Vec3;
        damage: number;
        specialEffect?: string;
    }[];
    pendingAbilities: any[];
    constructor(pos: Vec3, globalMult: number);
    getDmg(type: string, target: ServerPlayer): number;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
    usarMosquete(target: ServerPlayer): void;
    usarBarril(target: ServerPlayer): void;
    usarRumCurador(): void;
    usarSalvaDeCanhoes(target: ServerPlayer): void;
}
/** RainhaDasTrevas - shadow prison, tormenting flames, soul shield, dark devastation */
export declare class RainhaDasTrevasEnemy extends ServerEnemy {
    baseDamage: number;
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
//# sourceMappingURL=Bosses.d.ts.map