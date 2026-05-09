import re

with open('server/src/game/enemies/AdvancedBosses.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find start and end markers
start_marker = '/** CaoDosInfernos - dash, mark, roar+shield, frenzy, spawns filhotes */'
end_marker = '\n/** TheMightyOne'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1:
    print('ERROR: Start marker not found')
    exit(1)
if end_idx == -1:
    print('ERROR: End marker not found')
    exit(1)

print(f'Replacing from {start_idx} to {end_idx}')

new_class = '''/** CaoDosInfernos - Rework: Naafiri-inspired hunter with geometric matilha */
export class CaoDosInfernosEnemy extends ServerEnemy {
    public playerLevel: number;
    private attackCooldown: number;
    private lastAttackTime = 0;
    private attackRange = 2.0;
    public matilhaIds: string[] = [];
    public pendingAbilities: any[] = [];
    public isChannelingW: boolean = false;
    public channelTimerW: number = 0;
    public isUltActive: boolean = false;
    public ultTimer: number = 0;
    public shieldHp: number = 0;
    public shieldMaxHp: number = 0;
    public detectionRadius: number = 40;

    private habilidades = {
        matilhaTimer: 0,
        matilhaCount: 0,
        q: { cooldown: 0, lastUsed: 0 },
        w: { cooldown: 0, lastUsed: 0, isDashing: false, dashTimer: 0, dashDuration: 400, dashSpeed: 0, targetX: 0, targetZ: 0 },
        e: { cooldown: 0, lastUsed: 0, isSlamming: false, slamTimer: 0, slamDuration: 500 },
        r: { cooldown: 0, lastUsed: 0, isActive: false, timer: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number) {
        super(pos);
        this.playerLevel = playerLevel;
        this.type = 'CaoDosInfernos'; this.name = 'Cão dos Infernos';
        const c = CONFIG.CAO_DOS_INFERNOS;
        this.maxHp = c.BASE_HP + (playerLevel * c.HP_PER_LEVEL); this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE + (playerLevel * c.DAMAGE_PER_LEVEL);
        const playerBaseSpeed = CONFIG.PLAYER.SPEED;
        this.speed = playerBaseSpeed * c.SPEED_BASE_MULT * (1 + playerLevel * c.SPEED_PER_LEVEL);
        this.originalSpeed = this.speed;
        this.xp = c.XP_PER_LEVEL * playerLevel; this.score = c.SCORE + (playerLevel * 20);
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.attackCooldown = 1200;
        this.detectionRadius = 40 * (1 + (playerLevel * 0.02));

        const now = Date.now();
        this.habilidades.q.cooldown = c.SKILL_Q_COOLDOWN;
        this.habilidades.q.lastUsed = now - c.SKILL_Q_COOLDOWN;
        this.habilidades.w.cooldown = c.SKILL_W_COOLDOWN;
        this.habilidades.w.lastUsed = now - c.SKILL_W_COOLDOWN;
        this.habilidades.w.dashSpeed = c.SKILL_W_DASH_SPEED;
        this.habilidades.e.cooldown = c.SKILL_E_COOLDOWN;
        this.habilidades.e.lastUsed = now - c.SKILL_E_COOLDOWN;
        this.habilidades.r.cooldown = c.SKILL_R_COOLDOWN;
        this.habilidades.r.lastUsed = now - c.SKILL_R_COOLDOWN;
        this.position.y = 0.6;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);
        const h = this.habilidades;
        const c = CONFIG.CAO_DOS_INFERNOS;

        if (h.r.isActive) {
            h.r.timer -= ms;
            if (h.r.timer <= 0) {
                h.r.isActive = false; this.isUltActive = false;
                this.sizeMultiplier = 1.0; this.speed = this.originalSpeed;
                this.shieldHp = 0;
                this.detectionRadius = 40 * (1 + (this.playerLevel * 0.02));
            }
        }

        if (this.isChannelingW) {
            this.channelTimerW -= ms;
            if (this.channelTimerW <= 0) {
                this.isChannelingW = false;
                h.w.isDashing = true; h.w.dashTimer = h.w.dashDuration;
                this.pendingAbilities.push({ type: 'recallMatilha', bossId: this.id });
            }
            this.lookAt(target.position);
            return;
        }

        if (h.w.isDashing) {
            h.w.dashTimer -= ms;
            const dir = new Vec3(h.w.targetX - this.position.x, 0, h.w.targetZ - this.position.z);
            if (dir.lengthSq() > 0.01) {
                dir.normalize().multiplyScalar(h.w.dashSpeed * dt);
                this.position.add(dir);
            }
            if (this.position.distanceToXZ(target.position) < this.attackRange + target.hitboxRadius) {
                const dmg = c.SKILL_W_DAMAGE + (this.playerLevel * 5);
                target.takeDamage(dmg, null);
                target.statusEffects.stunned = { isActive: true, timer: c.SKILL_W_STUN_DURATION };
                h.w.isDashing = false; h.w.lastUsed = now;
                this.pendingAbilities.push({ type: 'investidaImpact', x: this.position.x, z: this.position.z });
            }
            if (h.w.dashTimer <= 0) { h.w.isDashing = false; h.w.lastUsed = now; }
            this.lookAt(target.position);
            return;
        }

        if (h.e.isSlamming) {
            h.e.slamTimer -= ms;
            if (h.e.slamTimer <= 0) {
                h.e.isSlamming = false; h.e.lastUsed = now;
                const targets = players.filter(p => !p.isDead && this.position.distanceToXZ(p.position) < c.SKILL_E_RADIUS);
                const dmg = c.SKILL_E_DAMAGE + (this.playerLevel * 5);
                for (const p of targets) p.takeDamage(dmg, null);
                this.pendingAbilities.push({ type: 'eviscerarSlam', x: this.position.x, z: this.position.z, radius: c.SKILL_E_RADIUS, bossId: this.id });
                if (c.SKILL_E_REPAIR_MATILHA) this.pendingAbilities.push({ type: 'repairMatilha', bossId: this.id });
            }
            return;
        }

        h.matilhaTimer -= dt;
        if (h.matilhaTimer <= 0 && h.matilhaCount < c.MATILHA_MAX) {
            h.matilhaTimer = c.MATILHA_SPAWN_INTERVAL;
            h.matilhaCount++;
            this.pendingAbilities.push({
                type: 'spawnMatilha',
                x: this.position.x + (Math.random() - 0.5) * 3,
                z: this.position.z + (Math.random() - 0.5) * 3,
                playerLevel: this.playerLevel, parentId: this.id,
            });
        }

        if (now > h.q.lastUsed + h.q.cooldown && dist < 25) {
            h.q.lastUsed = now;
            const dirToTarget = target.position.clone().sub(this.position).normalize();
            const leftDir = new Vec3(-dirToTarget.z, 0, dirToTarget.x);
            for (let i = 0; i < 2; i++) {
                const offset = leftDir.clone().multiplyScalar((i === 0 ? -1.5 : 1.5));
                const startPos = this.position.clone().add(offset);
                this.pendingAbilities.push({
                    type: 'prismaSombrio',
                    x: startPos.x, y: startPos.y, z: startPos.z,
                    dirX: dirToTarget.x, dirZ: dirToTarget.z,
                    damage: c.SKILL_Q_DAMAGE + (this.playerLevel * 3),
                    bossId: this.id, playerLevel: this.playerLevel,
                });
            }
        }

        const isBleeding = target.statusEffects.bleeding && target.statusEffects.bleeding.isActive;
        if (now > h.w.lastUsed + h.w.cooldown && isBleeding && dist < 30) {
            this.isChannelingW = true; this.channelTimerW = c.SKILL_W_AIM_DELAY;
            h.w.targetX = target.position.x; h.w.targetZ = target.position.z;
            this.pendingAbilities.push({
                type: 'investidaChannel', x: this.position.x, z: this.position.z,
                targetX: target.position.x, targetZ: target.position.z, duration: c.SKILL_W_AIM_DELAY,
            });
        }

        if (now > h.e.lastUsed + h.e.cooldown && dist < 8) {
            h.e.isSlamming = true; h.e.slamTimer = h.e.slamDuration;
            this.pendingAbilities.push({ type: 'eviscerarStart', x: this.position.x, z: this.position.z });
        }

        const hpPercent = this.hp / this.maxHp;
        if (now > h.r.lastUsed + h.r.cooldown && !h.r.isActive && (hpPercent < 0.4 || (dist < 15 && !h.r.isActive))) {
            h.r.isActive = true; h.r.timer = c.SKILL_R_DURATION;
            this.isUltActive = true;
            this.sizeMultiplier = c.SKILL_R_SIZE_MULT;
            this.speed = this.originalSpeed * c.SKILL_R_SPEED_BONUS;
            this.detectionRadius = (40 * (1 + (this.playerLevel * 0.02))) * c.SKILL_R_VISION_BONUS;
            this.shieldMaxHp = c.SKILL_R_SHIELD_HP + (this.playerLevel * 100);
            this.shieldHp = this.shieldMaxHp;
            if (c.SKILL_R_SPAWN_MAX_MATILHA) {
                const toSpawn = c.MATILHA_MAX - h.matilhaCount;
                for (let i = 0; i < toSpawn; i++) {
                    h.matilhaCount++;
                    this.pendingAbilities.push({
                        type: 'spawnMatilha',
                        x: this.position.x + (Math.random() - 0.5) * 3,
                        z: this.position.z + (Math.random() - 0.5) * 3,
                        playerLevel: this.playerLevel, parentId: this.id,
                    });
                }
            }
            this.pendingAbilities.push({ type: 'chamadoAbismo', x: this.position.x, z: this.position.z, duration: c.SKILL_R_DURATION });
        }

        if (dist > this.attackRange) {
            this.moveTowards(target.position, dt, this.speed);
        } else {
            if (now > this.lastAttackTime + this.attackCooldown) {
                this.lastAttackTime = now;
                const dmg = this.damage + (target.maxHp * c.DAMAGE_TARGET_HP_PERCENT);
                target.takeDamage(dmg, null);
                this.pendingAbilities.push({ type: 'meleeAttack', targetId: target.id, damage: dmg });
            }
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        if (this.isDestroyed) return;
        if (this.shieldHp > 0) {
            const absorbed = Math.min(amount, this.shieldHp);
            this.shieldHp -= absorbed;
            amount -= absorbed;
            if (amount <= 0) return;
        }
        super.takeDamage(amount, instigator, countsForPassive);
    }

    removeMatilha(id: string): void {
        this.matilhaIds = this.matilhaIds.filter(mid => mid !== id);
        this.habilidades.matilhaCount = Math.max(0, this.habilidades.matilhaCount - 1);
    }
}
'''

new_content = content[:start_idx] + new_class + content[end_idx:]
with open('server/src/game/enemies/AdvancedBosses.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('CaoDosInfernosEnemy rework completed!')
