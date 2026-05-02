import { ServerPlayer } from './Player';
import { ServerEnemy } from './enemies/Enemy';
import { ServerProjectile } from './Projectile';
import { CollisionSystem } from './CollisionSystem';
import { SpawnManager, SpawnEvent } from './SpawnManager';
import { Vec3 } from '../utils/Vector3';
import { CONFIG } from '../config';
import { WorldSnapshot } from '../network/Protocol';
import { PurpleCubeEnemy, RedConeEnemy, EnemyTowerEnemy, GuardianGuerreiroEnemy, GuardianMagoEnemy, GuardianArqueiroEnemy } from './enemies/BasicEnemies';
import { BruxaDoGeloEnemy, MestraDaIlusaoEnemy, BombardeiroInsanoEnemy } from './enemies/Defenders';
import { SuperBossEnemy, GangplankEnemy, RainhaDasTrevasEnemy } from './enemies/Bosses';
import { FeiticeiroImortalEnemy, LichKingEnemy, PlantaCarnivoraEnemy, CaoDosInfernosEnemy, TheMightyOneEnemy } from './enemies/AdvancedBosses';
import { AlmaAmaldicoadaEnemy, CaveiraExplosivaEnemy, EspectroSombrioEnemy, FilhoteCaoEnemy, BrotoCarnivoroEnemy } from './enemies/Minions';

export interface Orb { id: string; type: 'xp' | 'healing' | 'buff'; position: Vec3; hitboxRadius: number; buffType?: string; buffEffects?: any; buffDuration?: number; }
export interface DynamicZone { id: string; type: string; position: Vec3; radius: number; duration: number; timer: number; damagePerSec: number; lastTick: number; extras?: any; }

export class GameEngine {
    public players: Map<string, ServerPlayer> = new Map();
    public enemies: ServerEnemy[] = [];
    public playerProjectiles: ServerProjectile[] = [];
    public enemyProjectiles: ServerProjectile[] = [];
    public orbs: Orb[] = [];
    public zones: DynamicZone[] = [];
    public obstacles: { id: string; x: number; z: number; width: number; depth: number }[] = [];
    public spawnManager: SpawnManager;
    public collisionSystem: CollisionSystem;
    public tick = 0;
    public gameTime = 0;
    public isGameOver = false;
    private towerRespawnQueue: { enemy: EnemyTowerEnemy; timer: number }[] = [];
    private healingTowerPos = new Vec3(0, 1.5, 0);
    private healingTowerLastHeal = 0;
    private orbIdCounter = 0;
    private zoneIdCounter = 0;

    constructor(numPlayers: number) {
        this.spawnManager = new SpawnManager();
        this.collisionSystem = new CollisionSystem();
        this.spawnInitialEntities();
    }

    private spawnInitialEntities(): void {
        // XP orbs
        for (let i = 0; i < CONFIG.XP_ORB.INITIAL_COUNT; i++) {
            const half = CONFIG.GROUND_HALF - 5;
            this.orbs.push({ id: `orb_${this.orbIdCounter++}`, type: 'xp', position: new Vec3((Math.random() * half * 2) - half, 0.5, (Math.random() * half * 2) - half), hitboxRadius: CONFIG.XP_ORB.HITBOX_RADIUS });
        }
        // Enemy towers
        for (const tp of CONFIG.TOWER_POSITIONS) {
            const tower = new EnemyTowerEnemy(new Vec3(tp.x, 0, tp.z), this.spawnManager.globalMultiplier);
            this.enemies.push(tower);
        }
        
        // Random Obstacles (Walls)
        const numObstacles = 10;
        for (let i = 0; i < numObstacles; i++) {
            const half = CONFIG.GROUND_HALF - 15;
            const width = 5 + Math.random() * 10;
            const depth = 2 + Math.random() * 3;
            // Prevent spawning at center (0,0) where players spawn
            let x = (Math.random() * half * 2) - half;
            let z = (Math.random() * half * 2) - half;
            while (Math.abs(x) < 10 && Math.abs(z) < 10) {
                x = (Math.random() * half * 2) - half;
                z = (Math.random() * half * 2) - half;
            }
            // Rotate 90 degrees randomly
            if (Math.random() > 0.5) {
                this.obstacles.push({ id: `obs_${i}`, x, z, width: depth, depth: width });
            } else {
                this.obstacles.push({ id: `obs_${i}`, x, z, width, depth });
            }
        }
    }

    addPlayer(id: string, name: string): ServerPlayer {
        const p = new ServerPlayer(id, name);
        this.players.set(id, p);
        return p;
    }

    removePlayer(id: string): void { this.players.delete(id); }

    updateTick(dt: number): void {
        if (this.isGameOver) return;
        this.tick++;
        this.gameTime += dt;
        const now = Date.now();
        const alivePlayers = [...this.players.values()].filter(p => !p.isDead);
        if (alivePlayers.length === 0 && this.players.size > 0 && this.gameTime > 2) { this.isGameOver = true; return; }

        // Update players
        for (const p of this.players.values()) p.update(dt, now);
        // Handle player attacks
        for (const p of this.players.values()) {
            if (!p.isDead && p.isAttacking && p.canAttack(now)) {
                p.lastAttackTime = now;
                const dir = p.getFacingDirection();
                const proj = new ServerProjectile(p.position.clone().set(p.position.x, 0.5, p.position.z), dir, p.id, true, p.getDamage(), p.color);
                proj.speed = CONFIG.PLAYER.PROJECTILE_SPEED;
                this.playerProjectiles.push(proj);
            }
        }
        // Spawns
        const spawnEvents = this.spawnManager.update(dt);
        for (const ev of spawnEvents) this.handleSpawnEvent(ev, alivePlayers);
        // Update enemies
        for (const e of this.enemies) {
            if (!e.isDestroyed) {
                e.update(dt, alivePlayers, this.gameTime);
                // Update orbital positions for AlmaAmaldicoada
                if (e.type === 'AlmaAmaldicoada' && (e as any).ownerId) {
                    const owner = this.enemies.find(en => en.id === (e as any).ownerId);
                    if (owner) (e as AlmaAmaldicoadaEnemy).updateOrbit(owner.position, this.gameTime);
                }
            }
        }
        // Process pending explosions from CaveiraExplosiva
        for (const e of this.enemies) {
            if ((e as any).pendingExplosion) {
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`, type: 'caveiraExplosion',
                    position: e.position.clone(), radius: (e as any).explosionRadius || 2,
                    duration: 1000, timer: 1000, damagePerSec: e.damage, lastTick: 0, extras: {}
                });
                (e as any).pendingExplosion = false;
            }
        }
        // Process enemy pending actions
        this.processEnemyActions(alivePlayers);
        // Process player pending actions and R skill
        this.processPlayerActions(dt, alivePlayers);
        // Update projectiles
        for (const p of this.playerProjectiles) p.update(dt);
        for (const p of this.enemyProjectiles) p.update(dt);
        // Collisions
        this.processCollisions(now);
        // Zones (AoE damage areas)
        this.updateZones(dt, alivePlayers);
        // Healing tower
        this.updateHealingTower(now, alivePlayers);
        // Tower respawns
        this.updateTowerRespawns(dt);
        // Cleanup destroyed
        this.cleanup();
    }

    private handleSpawnEvent(ev: SpawnEvent, players: ServerPlayer[]): void {
        const gm = this.spawnManager.globalMultiplier;
        const np = this.players.size;
        const scale = gm * (1 + CONFIG.ENEMY_SCALE_PER_PLAYER * (np - 1));
        const avgLevel = players.length > 0 ? players.reduce((s, p) => s + p.level, 0) / players.length : 1;
        const avgMaxHp = players.length > 0 ? players.reduce((s, p) => s + p.maxHp, 0) / players.length : CONFIG.PLAYER.MAX_HP;

        let enemy: ServerEnemy;
        switch (ev.type) {
            case 'PurpleCube': enemy = new PurpleCubeEnemy(ev.position, scale); break;
            case 'RedCone': enemy = new RedConeEnemy(ev.position, scale); break;
            case 'GuardianGuerreiro': enemy = new GuardianGuerreiroEnemy(ev.position, scale, ev.isElite); break;
            case 'GuardianMago': enemy = new GuardianMagoEnemy(ev.position, scale, ev.isElite); break;
            case 'GuardianArqueiro': enemy = new GuardianArqueiroEnemy(ev.position, scale, ev.isElite); break;
            case 'BruxaDoGelo': enemy = new BruxaDoGeloEnemy(ev.position, scale); break;
            case 'MestraDaIlusao': enemy = new MestraDaIlusaoEnemy(ev.position, scale); break;
            case 'BombardeiroInsano': enemy = new BombardeiroInsanoEnemy(ev.position, scale); break;
            case 'SuperBoss': enemy = new SuperBossEnemy(ev.position, gm); this.spawnManager.activeBoss = enemy.id; break;
            case 'Gangplank': enemy = new GangplankEnemy(ev.position, gm); this.spawnManager.activeBoss = enemy.id; break;
            case 'RainhaDasTrevas': enemy = new RainhaDasTrevasEnemy(ev.position, gm, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'PlantaCarnivora': enemy = new PlantaCarnivoraEnemy(ev.position, gm, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'FeiticeiroImortal': enemy = new FeiticeiroImortalEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'LichKing': enemy = new LichKingEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'CaoDosInfernos': enemy = new CaoDosInfernosEnemy(ev.position, gm, avgLevel); break;
            case 'TheMightyOne': enemy = new TheMightyOneEnemy(ev.position); break;
            default: return;
        }
        this.enemies.push(enemy);
    }

    private processEnemyActions(players: ServerPlayer[]): void {
        for (const e of this.enemies) {
            if (e.isDestroyed) continue;
            const asAny = e as any;
            // Pending projectiles
            if (asAny.pendingProjectiles?.length > 0) {
                for (const pp of asAny.pendingProjectiles) {
                    const proj = new ServerProjectile(e.position.clone(), pp.dir, e.id, false, pp.damage, 0xff0000);
                    if (pp.specialEffect) proj.specialEffect = pp.specialEffect;
                    if (pp.explosionRadius) proj.explosionRadius = pp.explosionRadius;
                    if (pp.bleedDamage) proj.bleedDamage = pp.bleedDamage;
                    if (pp.speed) proj.speed = pp.speed;
                    this.enemyProjectiles.push(proj);
                }
                asAny.pendingProjectiles = [];
            }
            // Pending melee attacks
            if (asAny.pendingMeleeAttacks?.length > 0) {
                for (const atk of asAny.pendingMeleeAttacks) {
                    const target = this.players.get(atk.targetId);
                    if (target && !target.isDead) {
                        target.takeDamage(atk.damage);
                        if (atk.stun) target.applyStun(atk.stun);
                    }
                }
                asAny.pendingMeleeAttacks = [];
            }
            // Pending abilities
            if (asAny.pendingAbilities?.length > 0) {
                for (const ab of asAny.pendingAbilities) this.handleAbility(ab, e, players);
                asAny.pendingAbilities = [];
            }
        }
    }

    private processPlayerActions(dt: number, players: ServerPlayer[]): void {
        for (const p of players) {
            // Pending projectiles (from Q dash finish)
            if (p.pendingProjectiles.length > 0) {
                for (const pp of p.pendingProjectiles) {
                    const proj = new ServerProjectile(p.position.clone(), pp.dir, p.id, true, pp.damage, p.color);
                    this.playerProjectiles.push(proj);
                }
                p.pendingProjectiles = [];
            }
            // Pending zones (from E shield expiration / Q level 3 explosion)
            if (p.pendingZones.length > 0) {
                for (const pz of p.pendingZones) {
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`, type: pz.type,
                        position: new Vec3(pz.x, 0, pz.z), radius: pz.radius,
                        duration: 500, timer: 500, damagePerSec: pz.damage * 2, // damage applied immediately
                        lastTick: 0, extras: { sourceId: p.id, burst: true }
                    });
                }
                p.pendingZones = [];
            }
            // R skill effects
            if (p.skills.r.isActive) {
                // Destroy nearby enemy projectiles
                for (const ep of this.enemyProjectiles) {
                    if (!ep.isDestroyed && p.position.distanceToXZ(ep.position) < 2) {
                        ep.isDestroyed = true;
                    }
                }
                // Damage nearby enemies if level >= 2
                if (p.skillLevels.r >= 2) {
                    for (const e of this.enemies) {
                        if (!e.isDestroyed && p.position.distanceToXZ(e.position) < 2.5) {
                            e.takeDamage(p.getDamage(true) * 0.1 * dt, p);
                        }
                    }
                }
            }
        }
    }

    private handleAbility(ab: any, source: ServerEnemy, players: ServerPlayer[]): void {
        switch (ab.type) {
            case 'spawnClone':
                const clone = new MestraDaIlusaoEnemy(new Vec3(ab.x, 0, ab.z), 1);
                (clone as any).isClone = true;
                clone.hp = clone.maxHp = 50;
                clone.xp = 0;
                clone.score = 0;
                this.enemies.push(clone);
                break;
            case 'blizzard': case 'iceWall': case 'tormentFlames': case 'nevascaZone':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: ab.type, position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: ab.duration, timer: ab.duration, damagePerSec: ab.damagePerSec || ab.damage || 0, lastTick: 0, extras: ab });
                break;
            case 'disorient':
                for (const p of players) { if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) p.applyDisorientation(ab.duration); }
                break;
            case 'blind':
                const bt = this.players.get(ab.targetId);
                if (bt) bt.applyBlindness(ab.duration);
                break;
            case 'armorFracture':
                for (const p of players) { if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) p.applyArmorFracture(ab.duration, ab.amount); }
                break;
            case 'marcaDaAlma':
                const mt = this.players.get(ab.targetId);
                if (mt) mt.applyMarcaDaAlma(ab.duration);
                break;
            case 'lichPrison':
                const lt = this.players.get(ab.targetId);
                if (lt) lt.applyLichKingPrison(ab.duration);
                break;
            case 'meleeAttack':
                const mat = this.players.get(ab.targetId);
                if (mat && !mat.isDead) { mat.takeDamage(ab.damage); if (ab.stunDuration) mat.applyStun(ab.stunDuration); }
                break;
            case 'dashExplosion': case 'rugido':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        p.takeDamage(ab.damage, false);
                        if (ab.stunDuration) p.applyStun(ab.stunDuration);
                    }
                }
                break;
            case 'devastation':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        p.takeDamage(p.maxHp * ab.hpPercent, false);
                        p.applyStun(ab.stunDuration);
                    }
                }
                break;
            case 'powderKeg':
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`, type: 'powderKeg',
                    position: new Vec3(ab.x, 0, ab.z), radius: ab.radius || 5,
                    duration: 4000, timer: 4000, damagePerSec: 0, lastTick: 0,
                    extras: { armorFracture: { duration: 4000, amount: 0.20 } }
                });
                break;
            case 'cannonSalvo':
                // Delayed AoE - create zone with delay
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'cannonSalvo', position: new Vec3(ab.x, 0, ab.z), radius: ab.areaSize, duration: ab.delayMs + ab.salvos * ab.salvoInterval + 1000, timer: ab.delayMs + ab.salvos * ab.salvoInterval + 1000, damagePerSec: ab.damage, lastTick: 0, extras: ab });
                break;
            case 'powderKeg':
                // Simplified: immediate explosion zone
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'powderKeg', position: new Vec3(ab.x, 0, ab.z), radius: 5, duration: 3000, timer: 3000, damagePerSec: ab.damage, lastTick: 0, extras: ab });
                break;
            case 'bouncingBomb':
                // Delayed burst zone
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'bouncingBomb', position: new Vec3(ab.targetX, 0, ab.targetZ), radius: ab.explosionRadius, duration: 1500, timer: 1500, damagePerSec: ab.damage, lastTick: 0, extras: { burst: true, ...ab } });
                break;
            case 'mineField':
                for (let i = 0; i < ab.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * ab.radius;
                    const mx = ab.x + Math.cos(angle) * r;
                    const mz = ab.z + Math.sin(angle) * r;
                    this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mineField', position: new Vec3(mx, 0, mz), radius: ab.mineRadius, duration: ab.duration, timer: ab.duration, damagePerSec: ab.mineDamage, lastTick: 0, extras: { burst: true } });
                }
                break;
            case 'spawnSouls':
                const ownerSouls = this.enemies.find(e => e.id === ab.ownerId);
                if (ownerSouls) {
                    for (let i = 0; i < ab.count; i++) {
                        const angle = (i / ab.count) * Math.PI * 2;
                        const sx = ab.x + Math.cos(angle) * 4;
                        const sz = ab.z + Math.sin(angle) * 4;
                        const soul = new AlmaAmaldicoadaEnemy(new Vec3(sx, 0, sz), ab.ownerId, this.spawnManager.globalMultiplier);
                        this.enemies.push(soul);
                        if (!(ownerSouls as any).souls) (ownerSouls as any).souls = [];
                        (ownerSouls as any).souls.push(soul.id);
                    }
                }
                break;
            case 'spawnCaveiras':
                for (let i = 0; i < ab.count; i++) {
                    const angle = (i / ab.count) * Math.PI * 2;
                    const sx = ab.x + Math.cos(angle) * 2;
                    const sz = ab.z + Math.sin(angle) * 2;
                    const skull = new CaveiraExplosivaEnemy(new Vec3(sx, 0, sz), ab.damage, this.spawnManager.globalMultiplier);
                    this.enemies.push(skull);
                }
                break;
            case 'spawnEspectro':
                const espectro = new EspectroSombrioEnemy(
                    new Vec3(ab.x, 0, ab.z), ab.originalHp || 500, ab.originalDmg || 50, ab.originalSpd || 3, this.spawnManager.globalMultiplier
                );
                espectro.xp = 0; espectro.score = 0;
                this.enemies.push(espectro);
                break;
            case 'spawnBrotos':
                for (let i = 0; i < ab.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const bx = ab.x + Math.cos(angle) * 3;
                    const bz = ab.z + Math.sin(angle) * 3;
                    const broto = new BrotoCarnivoroEnemy(new Vec3(bx, 0, bz), ab.playerLevel || 1, this.spawnManager.globalMultiplier);
                    this.enemies.push(broto);
                }
                break;
            case 'respawnFilhote':
                const filhote = new FilhoteCaoEnemy(
                    new Vec3(ab.x, 0, ab.z), ab.playerLevel || 1, ab.parentId, this.spawnManager.globalMultiplier
                );
                this.enemies.push(filhote);
                const pai = this.enemies.find(e => e.id === ab.parentId);
                if (pai && (pai as any).filhoteIds) (pai as any).filhoteIds.push(filhote.id);
                break;
        }
    }

    private processCollisions(now: number): void {
        const playersArr = [...this.players.values()];
        // Player vs Obstacles
        for (const p of playersArr) {
            if (p.isDead) continue;
            for (const obs of this.obstacles) {
                this.collisionSystem.resolveCircleRectCollision(p.position, p.hitboxRadius, obs);
            }
        }
        // Enemy vs Obstacles
        for (const e of this.enemies) {
            if (e.isDestroyed) continue;
            for (const obs of this.obstacles) {
                this.collisionSystem.resolveCircleRectCollision(e.position, e.hitboxRadius, obs);
            }
        }

        // Enemy projectiles vs players
        const playerHits = this.collisionSystem.checkProjectileVsPlayers(this.enemyProjectiles, playersArr);
        for (const hit of playerHits) {
            const p = this.players.get(hit.playerId);
            if (!p) continue;
            p.takeDamage(hit.damage);
            if (hit.specialEffect === 'freeze') p.applyFreeze(2000);
            if (hit.specialEffect === 'freezingCone') { p.statusEffects.freezingConeHits.count++; p.statusEffects.freezingConeHits.timer = 3000; if (p.statusEffects.freezingConeHits.count >= 3) { p.applyFreeze(2000); p.statusEffects.freezingConeHits.count = 0; } }
            if (hit.specialEffect === 'bleed') p.applyBleed(5000, 5);
            if (hit.specialEffect === 'prisao') p.applyRoot(2000);
            if (hit.specialEffect === 'tiroIncendiario') p.applyBurn(3000, 10);
            if (hit.specialEffect === 'lançaGelo') p.applyFreeze(1500);
        }
        // Player projectiles vs enemies
        const enemyHits = this.collisionSystem.checkProjectileVsEnemies(this.playerProjectiles, this.enemies);
        for (const hit of enemyHits) {
            const enemy = this.enemies.find(e => e.id === hit.enemyId);
            const instigator = this.players.get(hit.instigatorId);
            if (!enemy || !instigator) continue;
            enemy.takeDamage(hit.damage, instigator);
            if (hit.bleedDamage > 0) enemy.status.isMarked = true;
            if (enemy.isDestroyed) this.onEnemyKilled(enemy, instigator);
        }
        // Player vs orbs
        const orbHits = this.collisionSystem.checkPlayerVsOrbs([...this.players.values()], this.orbs);
        for (const hit of orbHits) {
            const p = this.players.get(hit.playerId);
            const orb = this.orbs.find(o => o.id === hit.orbId);
            if (!p || !orb) continue;
            if (orb.type === 'xp') { p.collectOrb(); }
            else if (orb.type === 'buff' && orb.buffType) { p.applyTimedBuff(orb.buffType, (orb.buffDuration || 60000) / 1000, orb.buffEffects); }
            this.orbs = this.orbs.filter(o => o.id !== hit.orbId);
        }
    }

    private onEnemyKilled(enemy: ServerEnemy, killer: ServerPlayer): void {
        killer.addXp(enemy.xp);
        killer.score += enemy.score;
        killer.kills++;
        // Boss-specific drops
        const t = enemy.type;
        if (t === 'Gangplank') { this.spawnManager.isGangplankAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'sabre_pirata', { physical_damage: 0.10 }, 120); }
        if (t === 'RainhaDasTrevas') { this.spawnManager.isRainhaAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'rainha_buff', { attack_speed: 1.25, ability_damage: 1.15 }, 30); }
        if (t === 'PlantaCarnivora') { this.spawnManager.isPlantaCarnivoraAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'planta_buff', { lifesteal: 0.05, move_speed: 1.15, damage: 1.10 }, 45); }
        if (t === 'FeiticeiroImortal') { this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'essencia_negra', { magic_damage: 1.5, lifesteal: 0.03, cooldown_reduction: 0.15 }, 120); }
        if (t === 'LichKing') { this.spawnManager.activeBoss = null; const items = ['coroa_lich_buff', 'lamina_geada_buff', 'fragmento_morte_buff', 'talisma_quebrado_buff']; const pick = items[Math.floor(Math.random() * items.length)]; const fx: any = { coroa_lich_buff: { ability_damage: 1.0, immunity_freeze: true }, lamina_geada_buff: { bonus_damage: 20, attack_speed: 0.1 }, fragmento_morte_buff: { chance: 0.25 }, talisma_quebrado_buff: { max_hp_bonus: 0.10, freeze_reduction: 0.50 } }; this.spawnItemDrop(enemy.position, pick, fx[pick], 120); }
        if (t === 'SuperBoss') this.spawnManager.activeBoss = null;
        if (t === 'TheMightyOne') { this.spawnManager.onMightyOneDefeated(); for (const e of this.enemies) if (!e.isDestroyed) e.applyGlobalBuff(CONFIG.COLLAPSE_MULTIPLIER); }
        if (t === 'GuardianGuerreiro') killer.applyBuff('guerreiro');
        if (t === 'GuardianMago') killer.applyBuff('mago');
        if (t === 'GuardianArqueiro') killer.applyBuff('arqueiro');
        if (t === 'CaoDosInfernos') { const bt = Math.random() < 0.5 ? 'damage' : 'attackSpeed'; this.orbs.push({ id: `orb_${this.orbIdCounter++}`, type: 'buff', position: enemy.position.clone(), hitboxRadius: 0.8, buffType: bt }); }
        // Tower respawn
        if (enemy instanceof EnemyTowerEnemy) { this.towerRespawnQueue.push({ enemy, timer: CONFIG.ENEMY_TOWER.RESPAWN_DELAY }); }
    }

    private spawnItemDrop(pos: Vec3, buffType: string, effects: any, durationSec: number): void {
        this.orbs.push({ id: `orb_${this.orbIdCounter++}`, type: 'buff', position: pos.clone(), hitboxRadius: 2.5, buffType, buffEffects: effects, buffDuration: durationSec * 1000 });
    }

    private updateZones(dt: number, players: ServerPlayer[]): void {
        for (let i = this.zones.length - 1; i >= 0; i--) {
            const z = this.zones[i];
            z.timer -= dt * 1000;
            if (z.timer <= 0) { this.zones.splice(i, 1); continue; }

            if (z.extras?.burst && z.lastTick === 0) {
                z.lastTick = 1;
                // Burst damage from player zones (Shield explosion, dash explosion)
                for (const e of this.enemies) {
                    if (!e.isDestroyed && z.position.distanceToXZ(e.position) < z.radius) {
                        const p = this.players.get(z.extras.sourceId);
                        if (p) e.takeDamage(z.damagePerSec / 2, p); // We multiplied by 2 when adding, so divide to get actual burst
                    }
                }
            } else if (!z.extras?.burst && z.damagePerSec > 0 && Date.now() > z.lastTick + 1000) {
                z.lastTick = Date.now();
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                        p.takeDamage(z.damagePerSec, false);
                        if (z.type === 'blizzard' || z.type === 'iceWall') p.applySlow(1500, z.extras?.slowAmount || 0.5);
                    }
                }
            }
        }
    }

    private updateHealingTower(now: number, players: ServerPlayer[]): void {
        for (const p of players) {
            if (p.position.distanceToXZ(this.healingTowerPos) <= CONFIG.HEALING_TOWER.AURA_RADIUS && now > this.healingTowerLastHeal + CONFIG.HEALING_TOWER.HEAL_COOLDOWN) {
                this.healingTowerLastHeal = now;
                p.heal(p.maxHp * CONFIG.HEALING_TOWER.HEAL_PERCENT);
            }
        }
    }

    private updateTowerRespawns(dt: number): void {
        for (let i = this.towerRespawnQueue.length - 1; i >= 0; i--) {
            this.towerRespawnQueue[i].timer -= dt;
            if (this.towerRespawnQueue[i].timer <= 0) {
                this.towerRespawnQueue[i].enemy.respawn();
                this.towerRespawnQueue.splice(i, 1);
            }
        }
    }

    private cleanup(): void {
        this.playerProjectiles = this.playerProjectiles.filter(p => !p.isDestroyed);
        this.enemyProjectiles = this.enemyProjectiles.filter(p => !p.isDestroyed);
        this.enemies = this.enemies.filter(e => !e.isDestroyed || e instanceof EnemyTowerEnemy);
    }

    // Skill handling
    handleSkill(playerId: string, skill: 'q' | 'w' | 'e' | 'r'): void {
        const p = this.players.get(playerId);
        if (!p) return;
        const now = Date.now();
        if (!p.canUseSkill(skill, now)) return;
        p.skills[skill].lastUsed = now;
        switch (skill) {
            case 'q': p.activateDash(); break;
            case 'w': // Repel: push enemies away
                for (const e of this.enemies) {
                    if (e.isDestroyed) continue;
                    const dist = p.position.distanceToXZ(e.position);
                    if (dist < CONFIG.PLAYER.SKILL_W.RANGE) {
                        const dir = e.position.clone().sub(p.position); dir.y = 0; dir.normalize();
                        const force = (p.skillLevels.w >= 2 ? 40 : 25) * (1 - dist / CONFIG.PLAYER.SKILL_W.RANGE);
                        e.applyKnockback(dir, force);
                        if (p.skillLevels.w >= 3) e.takeDamage(p.getDamage(true) * 0.5, p);
                    }
                }
                break;
            case 'e': p.activateShield(); break;
            case 'r': p.activateUltimate(); p.clearNegativeEffects(); p.heal(p.maxHp * 0.3); break;
        }
    }

    getSnapshot(): WorldSnapshot {
        const now = Date.now();
        return {
            tick: this.tick,
            time: this.gameTime,
            players: [...this.players.values()].map(p => p.toSnapshot(now)),
            enemies: this.enemies.filter(e => !e.isDestroyed).map(e => e.toSnapshot()),
            projectiles: [...this.playerProjectiles, ...this.enemyProjectiles].map(p => p.toSnapshot()),
            orbs: this.orbs.map(o => ({ id: o.id, type: o.type, x: o.position.x, z: o.position.z, buffType: o.buffType })),
            dynamicEntities: this.zones.map(z => ({ id: z.id, type: z.type, x: z.position.x, y: 0, z: z.position.z, radius: z.radius, opacity: z.timer / z.duration })),
            boss: this.spawnManager.activeBoss ? (() => { const b = this.enemies.find(e => e.id === this.spawnManager.activeBoss); return b ? { id: b.id, name: b.name, hp: b.hp, maxHp: b.maxHp } : null; })() : null,
            mightyOne: this.spawnManager.mightyOneAlive ? (() => { const m = this.enemies.find(e => e.type === 'TheMightyOne'); return m ? { hp: m.hp, maxHp: m.maxHp, damageBonus: (m as TheMightyOneEnemy).damageBonus } : null; })() : null,
            collapseLevel: this.spawnManager.collapseLevel,
            globalMultiplier: this.spawnManager.globalMultiplier,
        };
    }
}
