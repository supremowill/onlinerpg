import { Vec3 } from '../../utils/Vector3';
import { EnemySnapshot } from '../../network/Protocol';
import { ServerPlayer } from '../Player';
/**
 * Base Enemy class - mirrors client Enemy with all status/knockback mechanics
 */
export declare class ServerEnemy {
    id: string;
    type: string;
    name: string;
    position: Vec3;
    rotationY: number;
    hp: number;
    maxHp: number;
    damage: number;
    speed: number;
    originalSpeed: number;
    xp: number;
    score: number;
    hitboxRadius: number;
    isDestroyed: boolean;
    isInvulnerable: boolean;
    status: {
        slowTimer: number;
        isMarked: boolean;
        knockback: {
            dir: Vec3;
            force: number;
        } | null;
    };
    constructor(position: Vec3);
    applyGlobalBuff(multiplier: number): void;
    applySlow(duration: number, amount?: number): void;
    applyKnockback(direction: Vec3, force: number): void;
    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive?: boolean): void;
    updateStatus(dt: number): boolean;
    update(dt: number, players: ServerPlayer[], gameTime: number): void;
    /** Find closest alive player */
    getClosestPlayer(players: ServerPlayer[]): ServerPlayer | null;
    /** Get random alive player */
    getRandomPlayer(players: ServerPlayer[]): ServerPlayer | null;
    lookAt(target: Vec3): void;
    moveTowards(target: Vec3, dt: number, speed?: number): void;
    toSnapshot(): EnemySnapshot;
}
//# sourceMappingURL=Enemy.d.ts.map