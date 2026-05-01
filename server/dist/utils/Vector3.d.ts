/**
 * Lightweight Vector3 for server-side math (no Three.js dependency)
 */
export declare class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vec3): this;
    clone(): Vec3;
    add(v: Vec3): this;
    sub(v: Vec3): this;
    multiplyScalar(s: number): this;
    lengthSq(): number;
    length(): number;
    normalize(): this;
    distanceTo(v: Vec3): number;
    distanceToXZ(v: Vec3): number;
    lerp(target: Vec3, alpha: number): this;
    negate(): this;
    /**
     * Apply rotation around Y axis
     */
    applyAxisAngleY(angle: number): this;
    /**
     * Reflect this vector off a surface with the given normal
     */
    reflect(normal: Vec3): this;
    dot(v: Vec3): number;
    /** Angle in radians from this position looking towards target (XZ plane) */
    angleTo(target: Vec3): number;
    /** Direction from this to target (normalized) */
    directionTo(target: Vec3): Vec3;
    toJSON(): {
        x: number;
        y: number;
        z: number;
    };
    static fromJSON(data: {
        x: number;
        y: number;
        z: number;
    }): Vec3;
    static zero(): Vec3;
}
//# sourceMappingURL=Vector3.d.ts.map