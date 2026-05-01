/**
 * Lightweight Vector3 for server-side math (no Three.js dependency)
 */
export class Vec3 {
    public x: number;
    public y: number;
    public z: number;

    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(x: number, y: number, z: number): this {
        this.x = x; this.y = y; this.z = z;
        return this;
    }

    copy(v: Vec3): this {
        this.x = v.x; this.y = v.y; this.z = v.z;
        return this;
    }

    clone(): Vec3 {
        return new Vec3(this.x, this.y, this.z);
    }

    add(v: Vec3): this {
        this.x += v.x; this.y += v.y; this.z += v.z;
        return this;
    }

    sub(v: Vec3): this {
        this.x -= v.x; this.y -= v.y; this.z -= v.z;
        return this;
    }

    multiplyScalar(s: number): this {
        this.x *= s; this.y *= s; this.z *= s;
        return this;
    }

    lengthSq(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    length(): number {
        return Math.sqrt(this.lengthSq());
    }

    normalize(): this {
        const l = this.length();
        if (l > 0) {
            this.x /= l; this.y /= l; this.z /= l;
        }
        return this;
    }

    distanceTo(v: Vec3): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    distanceToXZ(v: Vec3): number {
        const dx = this.x - v.x;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    lerp(target: Vec3, alpha: number): this {
        this.x += (target.x - this.x) * alpha;
        this.y += (target.y - this.y) * alpha;
        this.z += (target.z - this.z) * alpha;
        return this;
    }

    negate(): this {
        this.x = -this.x; this.y = -this.y; this.z = -this.z;
        return this;
    }

    /**
     * Apply rotation around Y axis
     */
    applyAxisAngleY(angle: number): this {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos - this.z * sin;
        const z = this.x * sin + this.z * cos;
        this.x = x;
        this.z = z;
        return this;
    }

    /**
     * Reflect this vector off a surface with the given normal
     */
    reflect(normal: Vec3): this {
        const dot = this.dot(normal);
        this.x -= 2 * dot * normal.x;
        this.y -= 2 * dot * normal.y;
        this.z -= 2 * dot * normal.z;
        return this;
    }

    dot(v: Vec3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    /** Angle in radians from this position looking towards target (XZ plane) */
    angleTo(target: Vec3): number {
        return Math.atan2(target.x - this.x, target.z - this.z);
    }

    /** Direction from this to target (normalized) */
    directionTo(target: Vec3): Vec3 {
        return target.clone().sub(this).normalize();
    }

    toJSON(): { x: number; y: number; z: number } {
        return { x: this.x, y: this.y, z: this.z };
    }

    static fromJSON(data: { x: number; y: number; z: number }): Vec3 {
        return new Vec3(data.x, data.y, data.z);
    }

    static zero(): Vec3 {
        return new Vec3(0, 0, 0);
    }
}
