import { ServerPlayer } from './Player';
import { ServerEnemy } from './enemies/Enemy';
import { ServerProjectile } from './Projectile';
import { CollisionSystem } from './CollisionSystem';
import { SpawnManager, SpawnEvent } from './SpawnManager';
import { Vec3 } from '../utils/Vector3';
import { CONFIG } from '../config';
import { WorldSnapshot, PlayerBuild } from '../network/Protocol';
import { PurpleCubeEnemy, RedConeEnemy, EnemyTowerEnemy, GuardianGuerreiroEnemy, GuardianMagoEnemy, GuardianArqueiroEnemy } from './enemies/BasicEnemies';
import { BruxaDoGeloEnemy, EscravoGlacialEnemy, FarsanteCarmesimEnemy, BombardeiroInsanoEnemy, CloneIlusorioEnemy } from './enemies/Defenders';
import { SuperBossEnemy, GangplankEnemy, RainhaDasTrevasEnemy } from './enemies/Bosses';
import { FeiticeiroImortalEnemy, LichKingEnemy, PlantaCarnivoraEnemy, CaoDosInfernosEnemy, TheMightyOneEnemy, MatilhaGeometraEnemy, GhoulEnemy, ValkyrEnemy } from './enemies/AdvancedBosses';
import { GuardiaoDoLimboEnemy, MinosEnemy, CerberoEnemy, PlutaoEnemy, FuriaEnemy, MegeraEnemy, MinotauroEnemy, GeriaoEnemy, LuciferEnemy } from './enemies/LimboBosses';
import { AlmaAmaldicoadaEnemy, CaveiraExplosivaEnemy, EspectroSombrioEnemy, BrotoCarnivoroEnemy } from './enemies/Minions';
import { EspectroDeRazielEnemy } from './enemies/EspectroDeRaziel';
import { SmithEnemy } from './enemies/SmithEnemy';
import { FaraoEnemy, EscaravelhoFaraoEnemy } from './enemies/Farao';
import { DoutorDoencaEnemy } from './enemies/DoutorDoenca';
import { ThreatScalingSystem, ThreatContext } from './ThreatScalingSystem';
import type { DamageSourceInfo, DamageSourceType } from './DamageTracker';
import type { PlayerDamageMeta } from './PlayerDamageTracker';

export interface Orb { id: string; type: 'xp' | 'healing' | 'buff'; position: Vec3; hitboxRadius: number; buffType?: string; buffEffects?: any; buffDuration?: number; reservedBy?: string; }
export interface DynamicZone { id: string; type: string; position: Vec3; radius: number; duration: number; timer: number; damagePerSec: number; lastTick: number; extras?: any; }
interface ErgWorker {
    id: string;
    ownerId: string;
    index: number;
    position: Vec3;
    targetOrbId?: string;
    carrying: number;
    returning: boolean;
    stuckTimer: number;
    lastDistance: number;
    integrity: number;
    maxIntegrity: number;
    hitRecoveryTimers: number[];
    respawnTimer: number;
    hitCooldown: number;
}

export class GameEngine {
    public players: Map<string, ServerPlayer> = new Map();
    public enemies: ServerEnemy[] = [];
    public playerProjectiles: ServerProjectile[] = [];
    public enemyProjectiles: ServerProjectile[] = [];
    public orbs: Orb[] = [];
    public zones: DynamicZone[] = [];
    public obstacles: { id: string; x: number; z: number; width: number; depth: number }[] = [];
    public spawnManager: SpawnManager;
    public slipperyZones: { position: Vec3; radius: number }[] = [];
    public collisionSystem: CollisionSystem;
    public threatScaling: ThreatScalingSystem;
    public tick = 0;
    public gameTime = 0;
    public isGameOver = false;
    private lastThreatSignature = '';
    private towerRespawnQueue: { enemy: EnemyTowerEnemy; timer: number }[] = [];
    private healingTowerPos = new Vec3(0, 1.5, 0);
    private healingTowerLastHeal = 0;
    private orbIdCounter = 0;
    private zoneIdCounter = 0;
    private ergWorkers: ErgWorker[] = [];
    public pendingEvents: { event: string; data: any }[] = [];
    // Throttle: only emit HIT_NUMBER events per entity every 150ms to avoid network spam
    private hitNumberThrottle: Map<string, number> = new Map();
    constructor(numPlayers: number) {
        this.spawnManager = new SpawnManager();
        this.collisionSystem = new CollisionSystem();
        this.threatScaling = new ThreatScalingSystem();
        this.spawnInitialEntities();
        (global as any).__gameEngine = this;
    }

    private getEnemyById(id?: string | null): ServerEnemy | null {
        if (!id) return null;
        return this.enemies.find(e => e.id === id) || null;
    }

    private resolveAbilitySource(ab: any, fallback?: ServerEnemy | null): ServerEnemy | null {
        return this.getEnemyById(ab?.sourceId)
            || this.getEnemyById(ab?.ownerId)
            || this.getEnemyById(ab?.bossId)
            || this.getEnemyById(ab?.parentId)
            || fallback
            || null;
    }

    private getZoneSource(z: DynamicZone): ServerEnemy | null {
        return this.getEnemyById(z.extras?.sourceId)
            || this.getEnemyById(z.extras?.ownerId)
            || this.getEnemyById(z.extras?.bossId)
            || null;
    }

    private buildDamageInfo(source: ServerEnemy | null, abilityName: string, sourceType?: DamageSourceType, isContinuous = false): Partial<DamageSourceInfo> {
        const owner = source ? this.getEnemyById((source as any).ownerId || (source as any).summonerId) : null;
        const directSourceName = source?.name || abilityName || 'Fonte ambiental';
        const primarySourceName = owner?.name || (source as any)?.ownerName || (source as any)?.summonerName || directSourceName;
        return {
            directSourceName,
            primarySourceName,
            abilityName: abilityName || directSourceName,
            sourceType: source ? undefined : (sourceType || 'environment'),
            isContinuous,
            isStatus: false,
            isSummoned: Boolean(source && ((source as any).ownerId || (source as any).summonerId)),
        };
    }

    private damagePlayer(target: ServerPlayer, amount: number, source: ServerEnemy | null, abilityName: string, fromProjectile = false, isTrueDamage = false, sourceType?: DamageSourceType, isContinuous = false): void {
        const sourceAny = source as any;
        if (sourceAny?.__limboDamageBuffUntil && Date.now() < sourceAny.__limboDamageBuffUntil) {
            amount *= 1 + (sourceAny.__limboDamageBuff || 0);
        }
        target.takeDamage(amount, fromProjectile, isTrueDamage, source, this.buildDamageInfo(source, abilityName, sourceType, isContinuous));
    }

    private capTowerDamage(player: ServerPlayer, rawDamage: number, percent = 0.18): number {
        return Math.min(rawDamage, player.maxHp * percent);
    }

    private distancePointToSegmentXZ(point: Vec3, start: Vec3, end: Vec3): number {
        const sx = start.x;
        const sz = start.z;
        const ex = end.x;
        const ez = end.z;
        const dx = ex - sx;
        const dz = ez - sz;
        const lenSq = dx * dx + dz * dz;
        if (lenSq <= 0.0001) return point.distanceToXZ(start);
        const t = Math.max(0, Math.min(1, ((point.x - sx) * dx + (point.z - sz) * dz) / lenSq));
        const px = sx + t * dx;
        const pz = sz + t * dz;
        const ox = point.x - px;
        const oz = point.z - pz;
        return Math.sqrt(ox * ox + oz * oz);
    }

    private applyLimboStatus(target: ServerPlayer, status?: string, duration = 0, intensity = 0): void {
        if (!status) return;
        switch (status) {
            case 'slow':
            case 'slowed':
                target.applySlow(duration || 3000, intensity || 0.25);
                break;
            case 'root':
            case 'rooted':
                target.applyRoot(duration || 1000);
                break;
            case 'stun':
            case 'stunned':
                target.applyStun(duration || 750);
                break;
            case 'blind':
                target.applyBlindness(duration || 2000);
                break;
            case 'bleed':
            case 'bleeding':
                target.applyBleed(duration || 4000, intensity || 5);
                break;
            case 'burn':
            case 'burning':
                target.applyBurn(duration || 4000, intensity || 8);
                break;
            case 'poison':
                target.statusManager.applyStatus('poison', duration || 4000, intensity || 0, null);
                break;
            case 'disorient':
            case 'disoriented':
                target.applyDisorientation(duration || 1200);
                break;
            case 'mortalWounds':
                target.statusManager.applyStatus('mortalWounds', duration || 4000, intensity || 0, null);
                break;
            case 'armorFracture':
                target.applyArmorFracture(duration || 5000, intensity || 0.15);
                break;
            case 'freeze':
            case 'frozen':
                target.applyFreeze(duration || 1200);
                break;
            case 'silence':
            case 'silenced':
                target.applySilence(duration || 1500);
                break;
            default:
                target.statusManager.applyStatus(status, duration || 3000, intensity || 0, null);
                break;
        }
    }

    private applyLimboForce(target: ServerPlayer, center: Vec3, force?: number, pull = false): void {
        if (!force) return;
        const dir = pull ? center.clone().sub(target.position) : target.position.clone().sub(center);
        dir.y = 0;
        if (dir.lengthSq() > 0.01) target.applyKnockback(dir.normalize(), force);
    }

    private pushLimboWarning(type: string, position: Vec3, radius: number, duration: number, extras: any = {}): void {
        this.zones.push({
            id: `zone_${this.zoneIdCounter++}`,
            type,
            position,
            radius,
            duration,
            timer: duration,
            damagePerSec: 0,
            lastTick: 0,
            extras,
        });
    }

    private skillDamageMeta(player: ServerPlayer, skillKey: 'q' | 'w' | 'e' | 'r' | string, abilityName: string, extra: Partial<PlayerDamageMeta> = {}): PlayerDamageMeta {
        return {
            sourceType: 'skill',
            sourceId: skillKey,
            sourceName: abilityName,
            abilityName,
            skillKey,
            upgradeId: player.selectedUpgrades?.[skillKey],
            isSkill: true,
            ...extra,
        };
    }

    private itemDamageMeta(itemId: string, sourceName: string, extra: Partial<PlayerDamageMeta> = {}): PlayerDamageMeta {
        return {
            sourceType: 'item',
            sourceId: itemId,
            sourceName,
            abilityName: sourceName,
            itemId,
            itemName: sourceName,
            isItem: true,
            ...extra,
        };
    }

    private essenceDamageMeta(player: ServerPlayer, sourceId: string, sourceName: string, essenceFloor?: number, extra: Partial<PlayerDamageMeta> = {}): PlayerDamageMeta {
        return {
            sourceType: 'essence_tower',
            sourceId,
            sourceName,
            abilityName: sourceName,
            essenceColor: player.build?.buildingColor,
            essenceFloor,
            isEssenceTower: true,
            ...extra,
        };
    }

    private projectileDamageMeta(player: ServerPlayer, proj?: ServerProjectile | null): PlayerDamageMeta {
        const special = proj?.specialEffect || '';
        if (!special || special === 'raio_peste_proj') {
            return {
                sourceType: 'basic_attack',
                sourceId: 'basic_attack',
                sourceName: special === 'raio_peste_proj' ? 'Raio da Peste' : 'Ataque basico',
                abilityName: special === 'raio_peste_proj' ? 'Raio da Peste' : 'Ataque basico',
                isBasicAttack: !special,
                isEssenceTower: special === 'raio_peste_proj',
                essenceColor: special === 'raio_peste_proj' ? 'poison' : player.build?.buildingColor,
                essenceFloor: special === 'raio_peste_proj' ? 5 : undefined,
                isCritical: Boolean(proj?.isCritical),
            };
        }
        if (special === 'frasco_peconha') {
            return this.essenceDamageMeta(player, 'poison_frasco_peconha', 'Frasco de Peconha', 5, { isCritical: Boolean(proj?.isCritical) });
        }
        const skillKey = proj?.skillUpgrades?.q ? 'q' : proj?.skillUpgrades?.w ? 'w' : proj?.skillUpgrades?.e ? 'e' : proj?.skillUpgrades?.r ? 'r' : 'skill';
        return this.skillDamageMeta(player, skillKey, special, { sourceId: special, sourceName: special, isCritical: Boolean(proj?.isCritical) });
    }

    private spawnInitialEntities(): void {
        // XP orbs
        for (let i = 0; i < CONFIG.XP_ORB.INITIAL_COUNT; i++) {
            this.spawnXpOrb();
        }
        // Enemy towers
        for (const tp of CONFIG.TOWER_POSITIONS) {
            const tower = new EnemyTowerEnemy(new Vec3(tp.x, 0, tp.z), 1, (tp as any).kind || 'ballistic');
            this.addEnemy(tower, 'initial_tower');
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

    public spawnXpOrb(): void {
        const half = CONFIG.GROUND_HALF - 5;
        this.orbs.push({
            id: `orb_${this.orbIdCounter++}`,
            type: 'xp',
            position: new Vec3((Math.random() * half * 2) - half, 0.5, (Math.random() * half * 2) - half),
            hitboxRadius: CONFIG.XP_ORB.HITBOX_RADIUS
        });
    }

    addPlayer(id: string, name: string, platform: 'pc' | 'mobile' = 'pc', build?: PlayerBuild, loadout?: string[]): ServerPlayer {
        const p = new ServerPlayer(id, name, build);
        p.platform = platform;
        
        // Loadout Validation
        const items = loadout || (build && build.loadoutItems);
        if (items && Array.isArray(items)) {
            const ItemDatabase = require('../data/ItemDatabase').ItemDatabase;
            let legCount = 0, epicCount = 0, basicCount = 0;
            const validLoadout: string[] = [];
            
            for (const itemId of items) {
                const item = ItemDatabase[itemId];
                if (!item) continue;
                
                if (item.rarity === 'legendary' && legCount < 1) { legCount++; validLoadout.push(itemId); }
                else if (item.rarity === 'epic' && epicCount < 2) { epicCount++; validLoadout.push(itemId); }
                else if (item.rarity === 'basic' && basicCount < 3) { basicCount++; validLoadout.push(itemId); }
            }
            p.loadoutItems = validLoadout;
            p.applyLoadoutPassives();
        }

        this.players.set(id, p);
        return p;
    }

    removePlayer(id: string): void { this.players.delete(id); }

    updateTick(dt: number): void {
        if (this.isGameOver) return;
        this.tick++;
        this.gameTime += dt;
        // Process rewind from Fragmento de Código-Fonte
        for (const p of [...this.players.values()]) {
            if (p.pendingRewindSeconds > 0) {
                this.gameTime = Math.max(0, this.gameTime - p.pendingRewindSeconds);
                p.pendingRewindSeconds = 0;
                p.addXp(0);
            }
        }
        const now = Date.now();
        const alivePlayers = [...this.players.values()].filter(p => !p.isDead);
        if (alivePlayers.length === 0 && this.players.size > 0 && this.gameTime > 2) { this.isGameOver = true; return; }

        // Update slippery zones list from active zones
        this.slipperyZones = this.zones
            .filter(z => z.type === 'slippery_ice')
            .map(z => ({ position: z.position, radius: z.radius }));

        // Update players
        for (const p of this.players.values()) {
            p.update(dt, now);
            p.isOnSlipperyGround = false;
            for (const sz of this.slipperyZones) {
                if (p.position.distanceToXZ(sz.position) < sz.radius) {
                    p.isOnSlipperyGround = true;
                    break;
                }
            }
        }
        // Handle orbital souls from Espectro de Raziel essence
        this.handleOrbitalSouls(dt);
        // Handle familiars from Núcleo da Matilha
        this.handlePlayerFamiliars(dt);
        this.updatePredatorHiveSystems(dt);
        // Handle player attacks
        for (const p of this.players.values()) {
            if (!p.isDead && p.isAttacking && p.canAttack(now)) {
                p.lastAttackTime = now;
                const dir = p.getFacingDirection();
                p.prepareBasicAttack();

                if (p.activeBuff.type === 'mago') {
                    p.activeBuff.attackCounter++;
                    if (p.activeBuff.attackCounter >= 3) {
                        p.activeBuff.attackCounter = 0;
                        p.pendingZones.push({
                            type: 'explosion',
                            x: p.position.x,
                            z: p.position.z,
                            radius: 8,
                            damage: p.getDamage(true) * 0.25
                        });
                    }
                }

                if (p.r_raio_peste_timer > 0) {
                    const dmg = p.getDamage();
                    const proj = new ServerProjectile(p.position.clone().set(p.position.x, 0.5, p.position.z), dir, p.id, true, dmg, 0x39ff14);
                    proj.speed = 30; // Extreme speed
                    proj.lifetime = 2.0; // Extreme range
                    proj.specialEffect = 'raio_peste_proj';
                    proj.isCritical = p.lastHitWasCrit;
                    proj.hitboxRadius = 0.5; // wider hitbox
                    this.playerProjectiles.push(proj);
                } else if (p.activeBuff.type === 'arqueiro') {
                    const numProjectiles = 5;
                    const coneAngle = Math.PI / 8;
                    for (let i = 0; i < numProjectiles; i++) {
                        const offset = (i - (numProjectiles - 1) / 2) * (coneAngle / (numProjectiles - 1));
                        const pDir = dir.clone().applyAxisAngleY(offset);
                        const dmg = p.getDamage();
                        const proj = new ServerProjectile(p.position.clone().set(p.position.x, 0.5, p.position.z), pDir, p.id, true, dmg, p.color);
                        proj.speed = CONFIG.PLAYER.PROJECTILE_SPEED;
                        proj.isBuffed = 'arqueiro';
                        proj.isCritical = p.lastHitWasCrit;
                        this.playerProjectiles.push(proj);
                    }
                } else if (p.loadoutItems && p.loadoutItems.includes('coroa_gelida')) {
                    // Coroa Gélida: Ataques = Cleave de Gelo
                    const dmg = p.getDamage();
                    this.pendingEvents.push({
                        event: 'ICE_CLEAVE',
                        data: {
                            playerId: p.id,
                            x: p.position.x,
                            y: p.position.y,
                            z: p.position.z,
                            dir: { x: dir.x, z: dir.z }
                        }
                    });
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'item_ice_cleave',
                        position: p.position.clone(),
                        radius: 4.0,
                        duration: 260,
                        timer: 260,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { sourceId: p.id, rotY: p.rotationY }
                    });
                    
                    // Hit enemies in an arc/area in front of player
                    for (const enemy of this.enemies) {
                        if (enemy.isDestroyed) continue;
                        const dist = p.position.distanceToXZ(enemy.position);
                        if (dist <= 4.0) { // 4m range
                            // Check if enemy is in front of the player
                            const toEnemy = enemy.position.clone().sub(p.position).normalize();
                            const dot = toEnemy.x * dir.x + toEnemy.z * dir.z;
                            if (dot > 0.5) { // roughly 120 degree cone
                                enemy.takeDamage(dmg, p, true, 0, false, this.itemDamageMeta('coroa_gelida', 'Coroa Gelida - Cleave'));
                                enemy.statusManager.applyStatus('freeze', 1000, 0, p);
                            }
                        }
                    }
                } else {
                    const dmg = p.getDamage();
                    const proj = new ServerProjectile(p.position.clone().set(p.position.x, 0.5, p.position.z), dir, p.id, true, dmg, p.color);
                    proj.speed = CONFIG.PLAYER.PROJECTILE_SPEED;
                    proj.isCritical = p.lastHitWasCrit;
                    this.playerProjectiles.push(proj);
                }
            }
        }
        // Spawns
        const spawnEvents = this.spawnManager.update(dt);
        for (const ev of spawnEvents) this.handleSpawnEvent(ev, alivePlayers);
        // Track dead bodies for passive abilities (e.g., Espectro de Raziel)
        const deadBodies = this.enemies
            .filter(e => e.isDestroyed && !(e instanceof EnemyTowerEnemy))
            .map(e => ({ position: e.position.clone(), id: e.id }));

        // Update enemies
        for (const e of this.enemies) {
            if (!e.isDestroyed) {
                // Pass dead bodies to EspectroDeRaziel for soul absorption
                if (e.type === 'EspectroDeRaziel') {
                    (e as any).update(dt, alivePlayers, this.gameTime, deadBodies);
                } else {
                    e.update(dt, alivePlayers, this.gameTime);
                }
                e.updateHiveWounds(dt);
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
        for (const p of this.playerProjectiles) {
            p.update(dt);
            if (p.specialEffect === 'frasco_peconha' && p.isDestroyed && !(p as any).hasExploded) {
                (p as any).hasExploded = true;
                const instigator = this.players.get(p.ownerId);
                if (instigator) {
                    const explosionRadius = 3.5;
                    const explosionDmg = instigator.getDamage(true) * 1.5;
                    for (const otherEnemy of this.enemies) {
                        if (!otherEnemy.isDestroyed && otherEnemy.position.distanceToXZ(p.position) < explosionRadius) {
                            otherEnemy.addPoison(2, instigator);
                            otherEnemy.takeDamage(explosionDmg, instigator, false, 0, false, this.essenceDamageMeta(instigator, 'poison_frasco_peconha', 'Frasco de Peconha', 5));
                        }
                    }
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'explosion',
                        position: p.position.clone(),
                        radius: explosionRadius,
                        duration: 400,
                        timer: 400,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { sourceId: instigator.id, burst: true }
                    });
                }
            }
        }
        for (const p of this.enemyProjectiles) {
            if ((p.specialEffect === 'esporo_basico' || p.specialEffect === 'reactive_saronite_shard') && !p.isDestroyed) {
                let closestPlayer = null;
                let closestDist = Infinity;
                for (const pl of alivePlayers) {
                    const dist = p.position.distanceToXZ(pl.position);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPlayer = pl;
                    }
                }
                if (closestPlayer) {
                    const dir = closestPlayer.position.clone().sub(p.position);
                    dir.y = 0;
                    if (dir.lengthSq() > 0.01) {
                        p.direction = dir.normalize();
                    }
                }
            }
            p.update(dt);
        }
        // Collisions
        this.processCollisions(now);

        // Process esporo_basico explosions (on hit or expiration)
        for (const p of this.enemyProjectiles) {
            if (p.specialEffect === 'esporo_basico' && p.isDestroyed) {
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'esporo_explosion',
                    position: p.position.clone(),
                    radius: 3.5,
                    duration: 800,
                    timer: 800,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { burst: true, sourceId: p.ownerId }
                });

                const projectileOwner = this.getEnemyById(p.ownerId);
                const params = (p as any).params || {};
                const ownerLimits = (projectileOwner as any)?.getPathogenLimits?.();
                const pathogenLimits = {
                    maxStacks: params.maxStacks ?? ownerLimits?.maxStacks,
                    maxTypes: params.maxTypes ?? ownerLimits?.maxTypes
                };
                const pathogenChance = params.pathogenChance ?? (projectileOwner as any)?.getPathogenChance?.() ?? 0.40;
                for (const pl of alivePlayers) {
                    if (!pl.isDead && pl.position.distanceToXZ(p.position) < 3.5) {
                        this.damagePlayer(pl, p.damage, projectileOwner, p.specialEffect || 'esporo_explosion');
                        if (Math.random() < pathogenChance) {
                            const PATHOGENS = [
                                'febre_critica',
                                'paralisia_parcial',
                                'mao_tremula',
                                'imunidade_baixa',
                                'visao_turva',
                                'cansaco_viral',
                                'incapacidade',
                                'hemorragia_quadrada'
                            ];
                            const randKey = PATHOGENS[Math.floor(Math.random() * PATHOGENS.length)];
                            pl.applyPathogen(randKey, 10000, pathogenLimits);
                        }
                    }
                }
            }
        }
        // Zones (AoE damage areas)
        this.updateZones(dt, alivePlayers);
        // Healing tower
        this.updateHealingTower(now, alivePlayers);
        // Tower respawns
        this.updateTowerRespawns(dt);
        // Cleanup destroyed
        this.cleanup();
        this.recalculateThreatIfNeeded('tick');
    }

    private getThreatContext(players?: ServerPlayer[]): ThreatContext {
        const sourcePlayers = players && players.length > 0 ? players : [...this.players.values()].filter(p => !p.isDead);
        const playerLevel = sourcePlayers.length > 0 ? Math.max(...sourcePlayers.map(p => p.level || 1)) : 1;
        return {
            gameTime: this.gameTime,
            playerLevel,
            collapseLevel: this.spawnManager.collapseLevel,
        };
    }

    public addEnemy(enemy: ServerEnemy, reason: string, players?: ServerPlayer[]): void {
        const context = this.getThreatContext(players);
        const multipliers = this.threatScaling.applyToEnemy(enemy, context, false);
        this.applyEnemyPostThreatScaling(enemy, false);
        this.enemies.push(enemy);

        if (process.env.THREAT_DEBUG === '1') {
            console.log(`[ThreatScaling] spawn reason=${reason} type=${enemy.type} category=${multipliers.category} minute=${Math.floor(context.gameTime / 60)} level=${context.playerLevel} collapse=${context.collapseLevel} hp=${enemy.maxHp} dmg=${enemy.damage.toFixed(2)} def=${enemy.defense.toFixed(2)} speed=${enemy.originalSpeed.toFixed(2)}`);
        }
    }

    private recalculateThreatIfNeeded(reason: string): void {
        const context = this.getThreatContext();
        const signature = this.threatScaling.getSignature(context);
        if (signature === this.lastThreatSignature) return;
        this.recalculateThreatForLivingEnemies(reason, context);
    }

    private recalculateThreatForLivingEnemies(reason: string, context = this.getThreatContext()): void {
        const signature = this.threatScaling.getSignature(context);
        this.lastThreatSignature = signature;

        let count = 0;
        for (const enemy of this.enemies) {
            if (enemy.isDestroyed) continue;
            this.threatScaling.applyToEnemy(enemy, context, true);
            this.applyEnemyPostThreatScaling(enemy, true);
            count++;
        }

        console.log(`[ThreatScaling] recalculated reason=${reason} minute=${Math.floor(context.gameTime / 60)} level=${context.playerLevel} collapse=${context.collapseLevel} enemies=${count}`);
    }

    private applyEnemyPostThreatScaling(enemy: ServerEnemy, preserveHpRatio: boolean): void {
        const applyAppearanceScaling = (enemy as any).applyAppearanceScaling;
        if (typeof applyAppearanceScaling === 'function') {
            applyAppearanceScaling.call(enemy, preserveHpRatio);
        }
    }

    private handleSpawnEvent(ev: SpawnEvent, players: ServerPlayer[]): void {
        const gm = 1;
        const scale = 1;
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
            case 'MestraDaIlusao': enemy = new FarsanteCarmesimEnemy(ev.position, scale); break;
            case 'BombardeiroInsano': enemy = new BombardeiroInsanoEnemy(ev.position, scale); break;
            case 'SuperBoss': enemy = new SuperBossEnemy(ev.position, gm); this.spawnManager.activeBoss = enemy.id; break;
            case 'Gangplank': enemy = new GangplankEnemy(ev.position, gm); this.spawnManager.activeBoss = enemy.id; break;
            case 'RainhaDasTrevas': enemy = new RainhaDasTrevasEnemy(ev.position, gm, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'PlantaCarnivora': enemy = new PlantaCarnivoraEnemy(ev.position, gm, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'FeiticeiroImortal': enemy = new FeiticeiroImortalEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'LichKing': enemy = new LichKingEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'CaoDosInfernos': enemy = new CaoDosInfernosEnemy(ev.position, gm, avgLevel); break;
            case 'TheMightyOne': {
                const mighty = new TheMightyOneEnemy(ev.position);
                mighty.init();
                enemy = mighty;
                break;
            }
            // Novos bosses do Limbo (Círculos 1-9)
            case 'GuardiãoDoLimbo': enemy = new GuardiaoDoLimboEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Minos': enemy = new MinosEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Cerbero': enemy = new CerberoEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Plutão': enemy = new PlutaoEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Fúria': enemy = new FuriaEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Megera': enemy = new MegeraEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Minotauro': enemy = new MinotauroEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Geriao': enemy = new GeriaoEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Lúcifer': enemy = new LuciferEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'EspectroDeRaziel': enemy = new EspectroDeRazielEnemy(ev.position, gm, avgLevel, avgMaxHp); this.spawnManager.activeBoss = enemy.id; break;
            case 'Smith': {
                const totalScore = players.reduce((sum, p) => sum + (p.score || 0), 0);
                enemy = new SmithEnemy(ev.position, gm, totalScore);
                this.spawnManager.isSmithAlive = true;
                this.spawnManager.activeBoss = enemy.id;
                console.log(`[Smith] Spawned: id=${enemy.id} hp=${enemy.hp}`);
                break;
            }
            case 'SmithAbsorb': {
                // Find existing Smith and absorb
                const existingSmith = this.enemies.find(e => e.type === 'Smith' && !e.isDestroyed) as any;
                if (existingSmith) {
                    const totalScore = players.reduce((sum, p) => sum + (p.score || 0), 0);
                    const newSmith = new SmithEnemy(ev.position, gm, totalScore);
                    newSmith.absorb(existingSmith);
                    existingSmith.isDestroyed = true;
                    enemy = newSmith;
                    this.spawnManager.activeBoss = enemy.id;
                    console.log(`[Smith] Absorbed previous Smith: new sizeMult=${enemy.sizeMultiplier} dmgMult=${enemy.damageMultiplier}`);
                } else {
                    // No existing Smith, spawn normally
                    const totalScore = players.reduce((sum, p) => sum + (p.score || 0), 0);
                    enemy = new SmithEnemy(ev.position, gm, totalScore);
                    this.spawnManager.isSmithAlive = true;
                    this.spawnManager.activeBoss = enemy.id;
                    console.log(`[Smith] Spawned (no previous): id=${enemy.id} hp=${enemy.hp}`);
                }
                break;
            }
            // ======= O FARAÓ — Entidade Deus =======
            case 'FaraoWarning': {
                // 5s warning phase: broadcast event but don't spawn yet
                this.pendingEvents.push({ event: 'FARAO_SPAWN_WARNING', data: { timer: CONFIG.FARAO.SPAWN_WARNING_DURATION } });
                return; // No enemy to push
            }
            case 'Farao': {
                const farao = new FaraoEnemy(ev.position, this.spawnManager.faraoSpawnCount);
                enemy = farao;
                // Farao does NOT use activeBoss — it's above the boss tier
                this.pendingEvents.push({ event: 'BOSS_SPAWN', data: { name: 'O Faraó', tier: 'Deus' } });
                console.log(`[Faraó] Spawned! HP=${farao.hp} spawnCount=${farao.spawnCount}`);
                break;
            }
            case 'DoutorDoenca': {
                const appearance = Math.max(1, ev.appearance || this.spawnManager.doutorDoencaAppearanceCount || 1);
                enemy = new DoutorDoencaEnemy(ev.position, 1, avgLevel, appearance);
                this.spawnManager.isDoutorDoencaSpawned = true;
                this.spawnManager.isDoutorDoencaAlive = true;
                this.spawnManager.activeBoss = enemy.id;
                const phaseName = appearance === 1 ? 'Surto Inicial' : appearance === 2 ? 'Epidemia Avancada' : 'Epidemia Terminal';
                this.pendingEvents.push({ event: 'BOSS_SPAWN', data: { name: `Doutor Doenca - ${phaseName}`, tier: appearance === 1 ? 'Elite' : 'Ameaca' } });
                console.log(`[Doutor Doenca] Spawned appearance=${appearance} phase=${phaseName} HP=${enemy.hp}`);
                break;
            }
            default: return;
        }
        this.addEnemy(enemy, `spawn:${ev.type}`, players);
    }

    private processEnemyActions(players: ServerPlayer[]): void {
        const now = Date.now();
        for (const e of this.enemies) {
            if (e.isDestroyed) continue;
            const asAny = e as any;
            if (asAny.__limboAuraUntil !== undefined && now > asAny.__limboAuraUntil) {
                if (asAny.__limboAuraBaseSpeed !== undefined) e.speed = asAny.__limboAuraBaseSpeed;
                if (asAny.__limboAuraBaseDamage !== undefined) e.damage = asAny.__limboAuraBaseDamage;
                delete asAny.__limboAuraUntil;
                delete asAny.__limboAuraBaseSpeed;
                delete asAny.__limboAuraBaseDamage;
            }
            if (asAny.__limboDamageBuffUntil !== undefined && now > asAny.__limboDamageBuffUntil) {
                delete asAny.__limboDamageBuffUntil;
                delete asAny.__limboDamageBuff;
            }
            // Pending projectiles
            if (asAny.pendingProjectiles?.length > 0) {
                for (const pp of asAny.pendingProjectiles) {
                    const proj = new ServerProjectile(e.position.clone(), pp.dir, e.id, false, pp.damage, 0xff0000);
                    if (pp.specialEffect) proj.specialEffect = pp.specialEffect;
                    if (pp.explosionRadius) proj.explosionRadius = pp.explosionRadius;
                    if (pp.bleedDamage) proj.bleedDamage = pp.bleedDamage;
                    if (pp.speed) proj.speed = pp.speed;
                    if (pp.lifetime !== undefined) proj.lifetime = pp.lifetime;
                    if (pp.hitboxRadius !== undefined) proj.hitboxRadius = pp.hitboxRadius;
                    if (pp.params !== undefined) (proj as any).params = pp.params;
                    this.enemyProjectiles.push(proj);
                }
                asAny.pendingProjectiles = [];
            }
            // Pending melee attacks
            if (asAny.pendingMeleeAttacks?.length > 0) {
                for (const atk of asAny.pendingMeleeAttacks) {
                    const target = this.players.get(atk.targetId);
                    if (target && !target.isDead) {
                        if (e && ((e as any).blindedTimer > 0 || e.statusManager.hasStatus('blind'))) {
                            // miss, trigger HIT_NUMBER event showing 0 value
                            this.pendingEvents.push({
                                event: 'HIT_NUMBER',
                                data: {
                                    targetId: target.id,
                                    x: target.position.x,
                                    y: 2.0,
                                    z: target.position.z,
                                    value: 0,
                                    type: 'NORMAL'
                                }
                            });
                        } else {
                            this.damagePlayer(target, atk.damage, e, atk.type || 'Ataque corpo a corpo');
                            if (atk.stun) target.applyStun(atk.stun);
                        }
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

    private handleOrbitalSouls(dt: number): void {
        for (const p of this.players.values()) {
            const buff = p.timedBuffs.find(b => b.type === 'essencia_espectral_raziel');
            if (!buff) continue;

            if (!p.orbitalSouls || p.orbitalSouls.length === 0) {
                // Initialize orbital souls from buff effects
                p.orbitalSouls = [];
                p.orbitalSoulDamageMultiplier = buff.effects.soul_orbital_damage_percent || 0.05;
                p.orbitalSoulDamageFlat = buff.effects.soul_orbital_damage_flat || 3;
                const count = buff.effects.soul_orbital_count || 5;
                for (let i = 0; i < count; i++) {
                    p.orbitalSouls.push({
                        id: `orbital_soul_${i}_${Date.now()}`,
                        angle: (Math.PI * 2 * i) / count,
                        orbitSpeed: 1.5 + Math.random() * 0.5,
                        radius: 2.0 + Math.random() * 0.5,
                        fireTimer: 2000,
                    });
                }
            }

            // Update orbital souls and fire at enemies
            for (const soul of p.orbitalSouls) {
                soul.angle += soul.orbitSpeed * dt;
                soul.fireTimer -= dt * 1000;

                if (soul.fireTimer <= 0) {
                    // Find closest enemy
                    let closest: any = null;
                    let minDist = Infinity;
                    for (const e of this.enemies) {
                        if (e.isDestroyed) continue;
                        const dist = e.position.distanceToXZ(p.position);
                        if (dist < minDist && dist < 15) {
                            minDist = dist;
                            closest = e;
                        }
                    }

                    if (closest) {
                        const dir = closest.position.clone().sub(p.position).normalize();
                        const damage = (closest.maxHp * p.orbitalSoulDamageMultiplier) + (p.level * p.orbitalSoulDamageFlat);
                        p.pendingProjectiles.push({ dir, damage, fromOrbitalSoul: true, skillUpgrades: { ...p.selectedUpgrades } });
                        soul.fireTimer = 2000; // Fire every 2 seconds
                    }
                }
            }
        }
    }

    private handlePlayerFamiliars(dt: number): void {
        for (const p of this.players.values()) {
            const buff = p.timedBuffs.find(b => b.type === 'nucleo_da_matilha');
            if (!buff) continue;

            if (p.familiarAttackTimer === undefined) p.familiarAttackTimer = 0;
            p.familiarAttackTimer -= dt * 1000;

            if (p.familiarAttackTimer <= 0) {
                let closest: any = null;
                let minDist = Infinity;
                for (const e of this.enemies) {
                    if (e.isDestroyed) continue;
                    const dist = e.position.distanceToXZ(p.position);
                    if (dist < minDist && dist < 15) {
                        minDist = dist;
                        closest = e;
                    }
                }

                if (closest) {
                    const orbitSpeed = Date.now() * 0.003;
                    const radius = 1.8;
                    const fx = p.position.x + Math.sin(orbitSpeed) * radius;
                    const fz = p.position.z + Math.cos(orbitSpeed) * radius;
                    const startPos = new Vec3(fx, 1.2, fz);

                    const dir = closest.position.clone().sub(startPos).normalize();
                    const damage = 15 + (p.level * 5);

                    const proj = new ServerProjectile(startPos, dir, p.id, true, damage, 0xff3333);
                    proj.specialEffect = 'matilha_projectile';
                    proj.speed = 12;
                    proj.hitboxRadius = 0.3;
                    this.playerProjectiles.push(proj);

                    p.familiarAttackTimer = 1500;
                }
            }
        }
    }

    private updatePredatorHiveSystems(dt: number): void {
        const activeOwners = new Set<string>();
        for (const p of this.players.values()) {
            if (!p.isDead && p.ergCentralBaseActive) {
                activeOwners.add(p.id);
                const existing = this.ergWorkers.filter(w => w.ownerId === p.id);
                for (let i = existing.length; i < 4; i++) {
                    const angle = (i * Math.PI * 2) / 4;
                    this.ergWorkers.push({
                        id: `erg_worker_${p.id}_${i}`,
                        ownerId: p.id,
                        index: i,
                        position: this.healingTowerPos.clone().add(new Vec3(Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2)),
                        carrying: 0,
                        returning: false,
                        stuckTimer: 0,
                        lastDistance: Infinity,
                        integrity: p.getErgWorkerMaxIntegrity(),
                        maxIntegrity: p.getErgWorkerMaxIntegrity(),
                        hitRecoveryTimers: [],
                        respawnTimer: 0,
                        hitCooldown: 0
                    });
                }
            }
        }
        this.ergWorkers = this.ergWorkers.filter(w => activeOwners.has(w.ownerId));
        const reservedByActive = new Set(this.ergWorkers.map(w => w.targetOrbId).filter(Boolean) as string[]);
        for (const orb of this.orbs) {
            if (orb.reservedBy && !this.ergWorkers.some(w => w.id === orb.reservedBy)) orb.reservedBy = undefined;
            if (orb.reservedBy && !reservedByActive.has(orb.id)) orb.reservedBy = undefined;
        }

        for (const worker of this.ergWorkers) {
            const owner = this.players.get(worker.ownerId);
            if (!owner || owner.isDead || !owner.ergCentralBaseActive) continue;
            worker.hitCooldown = Math.max(0, worker.hitCooldown - dt);
            worker.maxIntegrity = owner.getErgWorkerMaxIntegrity();
            if (worker.respawnTimer > 0) {
                worker.respawnTimer -= dt;
                worker.position = this.healingTowerPos.clone().add(new Vec3(Math.cos(worker.index * Math.PI * 0.5) * 2.2, 0.2, Math.sin(worker.index * Math.PI * 0.5) * 2.2));
                if (worker.respawnTimer <= 0) {
                    worker.integrity = worker.maxIntegrity;
                    worker.hitRecoveryTimers = [];
                    worker.carrying = 0;
                    worker.returning = false;
                    worker.targetOrbId = undefined;
                }
                continue;
            }
            worker.hitRecoveryTimers = worker.hitRecoveryTimers
                .map(t => t - dt)
                .filter(t => {
                    if (t > 0) return true;
                    worker.integrity = Math.min(worker.maxIntegrity, worker.integrity + 1);
                    return false;
                });
            if (worker.integrity > worker.maxIntegrity) worker.integrity = worker.maxIntegrity;
            const boosted = owner.ergWorkerBoostTimer > 0;
            const levelSpeed = owner.ergBaseLevel >= 3 ? 1.10 : 1.0;
            const speed = (boosted ? 10.5 : 6.5) * levelSpeed * dt;
            const capacity = boosted ? 2 : 1;
            const basePos = this.healingTowerPos;

            if (worker.carrying >= capacity) worker.returning = true;
            if (worker.returning || worker.carrying > 0 && !worker.targetOrbId) {
                this.moveWorkerTowards(worker, basePos, speed);
                if (worker.position.distanceToXZ(basePos) <= 1.2) {
                    const delivered = worker.carrying;
                    if (delivered > 0) owner.onErgXpDelivered(boosted ? delivered * 2 : delivered);
                    worker.carrying = 0;
                    worker.returning = false;
                    worker.targetOrbId = undefined;
                }
                continue;
            }

            let target = worker.targetOrbId ? this.orbs.find(o => o.id === worker.targetOrbId && o.type === 'xp') : undefined;
            if (!target) {
                worker.targetOrbId = undefined;
                worker.stuckTimer = 0;
                worker.lastDistance = Infinity;
                target = this.findNearestReservableXpOrb(worker.position);
                if (target) {
                    target.reservedBy = worker.id;
                    worker.targetOrbId = target.id;
                }
            }
            if (!target) {
                this.moveWorkerTowards(worker, basePos, speed * 0.35);
                continue;
            }

            const distBefore = worker.position.distanceToXZ(target.position);
            this.moveWorkerTowards(worker, target.position, speed);
            const distAfter = worker.position.distanceToXZ(target.position);
            if (distAfter >= worker.lastDistance - 0.02) worker.stuckTimer += dt; else worker.stuckTimer = 0;
            worker.lastDistance = distAfter;
            if (worker.stuckTimer > 5) {
                target.reservedBy = undefined;
                worker.targetOrbId = undefined;
                worker.stuckTimer = 0;
                worker.lastDistance = Infinity;
                continue;
            }
            if (distBefore <= 0.8 || distAfter <= 0.8) {
                this.orbs = this.orbs.filter(o => o.id !== target!.id);
                worker.carrying++;
                worker.targetOrbId = undefined;
                worker.stuckTimer = 0;
                worker.lastDistance = Infinity;
                this.spawnXpOrb();
                if (worker.carrying >= capacity) worker.returning = true;
            }
        }
        this.processErgWorkerThreats(dt);
        this.updateErgBasePulse(dt);
    }

    private findNearestReservableXpOrb(from: Vec3): Orb | undefined {
        let best: Orb | undefined;
        let bestDist = Infinity;
        for (const orb of this.orbs) {
            if (orb.type !== 'xp' || orb.reservedBy) continue;
            const dist = from.distanceToXZ(orb.position);
            if (dist < bestDist) {
                best = orb;
                bestDist = dist;
            }
        }
        return best;
    }

    private moveWorkerTowards(worker: ErgWorker, target: Vec3, maxStep: number): void {
        const dir = target.clone().sub(worker.position);
        dir.y = 0;
        const len = dir.length();
        if (len <= 0.001) return;
        dir.multiplyScalar(Math.min(maxStep, len) / len);
        worker.position.add(dir);
        worker.position.y = 0.2;
    }

    private dropWorkerCargo(worker: ErgWorker): void {
        const dropped = Math.max(0, worker.carrying);
        for (let i = 0; i < dropped; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 0.3 + Math.random() * 1.1;
            this.orbs.push({
                id: `orb_${this.orbIdCounter++}`,
                type: 'xp',
                position: worker.position.clone().add(new Vec3(Math.cos(angle) * dist, 0.3, Math.sin(angle) * dist)),
                hitboxRadius: CONFIG.XP_ORB.HITBOX_RADIUS
            });
        }
    }

    private releaseWorkerReservation(worker: ErgWorker): void {
        if (!worker.targetOrbId) return;
        const target = this.orbs.find(o => o.id === worker.targetOrbId);
        if (target?.reservedBy === worker.id) target.reservedBy = undefined;
        worker.targetOrbId = undefined;
    }

    private damageErgWorker(worker: ErgWorker, owner: ServerPlayer): void {
        if (worker.respawnTimer > 0 || worker.hitCooldown > 0) return;
        worker.hitCooldown = 0.85;
        worker.integrity = Math.max(0, worker.integrity - 1);
        worker.hitRecoveryTimers.push(20);
        this.zones.push({
            id: `zone_${this.zoneIdCounter++}`,
            type: 'erg_worker_hit',
            position: worker.position.clone(),
            radius: 0.8,
            duration: 350,
            timer: 350,
            damagePerSec: 0,
            lastTick: 0,
            extras: { sourceId: owner.id }
        });
        if (worker.integrity > 0) return;

        this.dropWorkerCargo(worker);
        this.releaseWorkerReservation(worker);
        worker.carrying = 0;
        worker.returning = false;
        worker.stuckTimer = 0;
        worker.lastDistance = Infinity;
        worker.hitRecoveryTimers = [];
        worker.respawnTimer = owner.getErgWorkerRespawnSeconds();
        this.pendingEvents.push({
            event: 'MESSAGE',
            data: { message: `Um Erg foi abatido. Retornara em ${Math.round(worker.respawnTimer)}s.` }
        });
        this.zones.push({
            id: `zone_${this.zoneIdCounter++}`,
            type: 'erg_worker_break',
            position: worker.position.clone(),
            radius: 1.2,
            duration: 600,
            timer: 600,
            damagePerSec: 0,
            lastTick: 0,
            extras: { sourceId: owner.id }
        });
    }

    private isBossLike(enemy: ServerEnemy): boolean {
        return enemy.maxHp >= 5000 || String(enemy.type || '').toLowerCase().includes('boss');
    }

    private processErgWorkerThreats(_dt: number): void {
        for (const worker of this.ergWorkers) {
            const owner = this.players.get(worker.ownerId);
            if (!owner || owner.isDead || !owner.ergCentralBaseActive || worker.respawnTimer > 0) continue;
            const ownerDist = owner.position.distanceToXZ(worker.position);
            for (const enemy of this.enemies) {
                if (enemy.isDestroyed) continue;
                if (owner.position.distanceToXZ(enemy.position) <= 12) continue;
                const dist = enemy.position.distanceToXZ(worker.position);
                const reach = Math.max(1.0, enemy.hitboxRadius + 0.65);
                if (dist <= reach || (ownerDist > 12 && dist <= 5 && Math.random() < 0.012)) {
                    this.damageErgWorker(worker, owner);
                    break;
                }
            }
        }

        for (const proj of this.enemyProjectiles) {
            if (proj.isDestroyed) continue;
            const effect = String(proj.specialEffect || proj.visualEffect || '').toLowerCase();
            if (/(poison|toxic|slow|blind|debuff|aura|dot)/.test(effect)) continue;
            for (const worker of this.ergWorkers) {
                const owner = this.players.get(worker.ownerId);
                if (!owner || worker.respawnTimer > 0) continue;
                if (proj.position.distanceToXZ(worker.position) <= 0.45 + proj.hitboxRadius + 0.35) {
                    this.damageErgWorker(worker, owner);
                    proj.isDestroyed = true;
                    break;
                }
            }
        }
    }

    private updateErgBasePulse(_dt: number): void {
        for (const player of this.players.values()) {
            if (player.isDead || !player.ergCentralBaseActive || player.ergBaseLevel < 10) continue;
            if (player.ergBasePulseTimer > 0) continue;
            player.ergBasePulseTimer = 12000;
            this.zones.push({
                id: `zone_${this.zoneIdCounter++}`,
                type: 'erg_base_defense_pulse',
                position: this.healingTowerPos.clone(),
                radius: 5,
                duration: 650,
                timer: 650,
                damagePerSec: 0,
                lastTick: 0,
                extras: { sourceId: player.id }
            });
            for (const enemy of this.enemies) {
                if (enemy.isDestroyed || enemy.position.distanceToXZ(this.healingTowerPos) > 5) continue;
                const away = enemy.position.clone().sub(this.healingTowerPos);
                away.y = 0;
                if (away.lengthSq() > 0.01) {
                    const bossLike = this.isBossLike(enemy);
                    if (!bossLike) enemy.position.add(away.normalize().multiplyScalar(enemy.maxHp > 1200 ? 0.8 : 1.8));
                }
                if (this.isBossLike(enemy)) enemy.applySlow(800, 0.10);
                else if (enemy.maxHp > 1200) enemy.applySlow(1000, 0.20);
            }
        }
    }

    private tryFireErgBaseSlime(player: ServerPlayer, enemy: ServerEnemy): void {
        if (player.build?.buildingColor !== 'predator_hive' || !player.ergCentralBaseActive || player.ergBaseLevel < 2) return;
        if (player.ergBaseSlimeCooldown > 0) return;
        if (player.position.distanceToXZ(this.healingTowerPos) > 14) return;
        if (enemy.position.distanceToXZ(this.healingTowerPos) > 18) return;

        const bossLike = this.isBossLike(enemy);
        const ascension = player.predatorHiveUltAscensionActive;
        let damagePct = ascension ? (bossLike ? 0.14 : 0.25) : (bossLike ? 0.10 : 0.18);
        let woundChance = ascension ? (bossLike ? 0.20 : 0.45) : (bossLike ? 0.12 : 0.25);
        if (player.ergBaseLevel >= 4) damagePct += 0.03;
        if (player.ergBaseLevel >= 6) woundChance += 0.05;
        player.ergBaseSlimeShotCounter++;
        const heavy = player.ergBaseLevel >= 10 && player.ergBaseSlimeShotCounter % 5 === 0;
        const damage = player.getDamage(false, true) * damagePct * (heavy ? 1.5 : 1.0);
        const start = this.healingTowerPos.clone().set(this.healingTowerPos.x, 1.1, this.healingTowerPos.z);
        const dir = enemy.position.clone().sub(start);
        dir.y = 0;
        if (dir.lengthSq() <= 0.001) return;
        const proj = new ServerProjectile(start, dir.normalize(), player.id, true, damage, 0xa855f7);
        proj.specialEffect = 'erg_base_slime';
        proj.visualEffect = 'erg_base_slime';
        proj.speed = 18;
        proj.lifetime = 1.6;
        proj.hitboxRadius = 0.35;
        (proj as any).ergBaseSlime = {
            woundChance,
            splashRadius: player.ergBaseLevel >= 8 ? 2 : 0,
            splashDamagePct: 0.35,
            heavy
        };
        this.playerProjectiles.push(proj);
        player.ergBaseSlimeCooldown = bossLike ? 0.75 : 0.45;
    }

    private processPlayerActions(dt: number, players: ServerPlayer[]): void {
        for (const p of players) {
            // Pending projectiles (from Q dash finish)
            if (p.pendingProjectiles.length > 0) {
                for (const pp of p.pendingProjectiles) {
                    const proj = new ServerProjectile(p.position.clone(), pp.dir, p.id, true, pp.damage, p.color);
                    if (pp.specialEffect) proj.specialEffect = pp.specialEffect;
                    if (pp.visualEffect) proj.visualEffect = pp.visualEffect;
                    if (pp.skillUpgrades) proj.skillUpgrades = pp.skillUpgrades;
                    if (pp.trackHits) proj.trackHits = pp.trackHits;
                    if (pp.isCritical) proj.isCritical = pp.isCritical;
                    if (proj.specialEffect && p.hitboxMagiasSizePct > 0) {
                        proj.hitboxRadius *= (1 + p.hitboxMagiasSizePct);
                    }
                    this.playerProjectiles.push(proj);
                }
                p.pendingProjectiles = [];
            }
            // Pending zones (from E shield expiration / Q level 3 explosion)
            if (p.pendingZones.length > 0) {
                for (const pz of p.pendingZones) {
                    const dur = pz.extras && pz.extras.duration !== undefined ? pz.extras.duration : 500;
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`, type: pz.type,
                        position: new Vec3(pz.x, 0, pz.z), radius: pz.radius,
                        duration: dur, timer: dur, damagePerSec: pz.damage * 2,
                        lastTick: 0, extras: { sourceId: p.id, burst: dur === 500, ...pz.extras }
                    });
                }
                p.pendingZones = [];
            }
            // Update loadout-specific active timers
            p.updateLoadoutTimers(dt);

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
                            e.takeDamage(p.getDamage(true) * 0.1 * dt, p, false, 0, false, this.essenceDamageMeta(p, 'purple_toxic_aura', 'Torre Roxa Aura Toxica', 4, { isDoT: true }));
                        }
                    }
                }
            }

            // --- Essence Towers Mutated Ultimates Ticking states ---
            const ms = dt * 1000;

            // 1. Chuva de Tetraedros (Red)
            if (p.r_chuva_timer > 0) {
                p.r_chuva_timer -= ms;
                p.r_chuva_tick -= ms;
                if (p.r_chuva_tick <= 0) {
                    p.r_chuva_tick = 300; // spawn every 300ms
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * 8;
                    const zx = p.position.x + Math.cos(angle) * dist;
                    const zz = p.position.z + Math.sin(angle) * dist;
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'chuva_tetraedros_zone',
                        position: new Vec3(zx, 0, zz),
                        radius: 4,
                        duration: 1000,
                        timer: 1000,
                        damagePerSec: p.getDamage(true) * 1.5,
                        lastTick: 0,
                        extras: { sourceId: p.id, burst: true }
                    });
                }
            }

            // 2. Corte Dimensional (Red)
            if (p.r_slash_targets.length > 0) {
                p.r_slash_timer -= ms;
                if (p.r_slash_timer <= 0) {
                    p.r_slash_timer = 150; // every 150ms
                    let foundTarget = false;
                    while (p.r_slash_index < p.r_slash_targets.length) {
                        const targetId = p.r_slash_targets[p.r_slash_index];
                        const target = this.enemies.find(e => e.id === targetId);
                        p.r_slash_index++;
                        if (target && !target.isDestroyed) {
                            p.position.copy(target.position);
                            this.zones.push({
                                id: `zone_${this.zoneIdCounter++}`,
                                type: 'explosion',
                                position: p.position.clone(),
                                radius: 4,
                                duration: 300,
                                timer: 300,
                                damagePerSec: p.getDamage(true) * 2.5,
                                lastTick: 0,
                                extras: { sourceId: p.id, burst: true }
                            });
                            foundTarget = true;
                            break;
                        }
                    }
                    if (!foundTarget || p.r_slash_index >= p.r_slash_targets.length) {
                        p.r_slash_targets = [];
                    }
                }
            }

            // 3. Terremoto Geométrico (Green)
            if (p.r_quake_timer > 0) {
                p.r_quake_timer -= ms;
                p.r_quake_tick -= ms;
                if (p.r_quake_tick <= 0) {
                    p.r_quake_tick = 1000; // every 1s
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'terremoto_geometrico_zone',
                        position: p.position.clone(),
                        radius: 8,
                        duration: 500,
                        timer: 500,
                        damagePerSec: p.getDamage(true) * 1.6,
                        lastTick: 0,
                        extras: { sourceId: p.id, burst: true }
                    });
                    for (const enemy of this.enemies) {
                        if (!enemy.isDestroyed && p.position.distanceToXZ(enemy.position) < 8.0) {
                            enemy.applyDisorientation(1000);
                        }
                    }
                }
            }

            // 4. Campo de Fungos (Poison passive mushroom generation)
            if (p.upgradeFlags.r_campo_fungos) {
                p.shroomSpawnTimer -= ms;
                if (p.shroomSpawnTimer <= 0) {
                    p.shroomSpawnTimer = 4000;
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 3 + Math.random() * 9;
                    const zx = Math.max(-48, Math.min(48, p.position.x + Math.cos(angle) * dist));
                    const zz = Math.max(-48, Math.min(48, p.position.z + Math.sin(angle) * dist));
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'teemo_shroom',
                        position: new Vec3(zx, 0, zz),
                        radius: 1.0,
                        duration: 30000,
                        timer: 30000,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { sourceId: p.id }
                    });
                }
            }
        }
    }

    private handleAbility(ab: any, source: ServerEnemy, players: ServerPlayer[]): void {
        switch (ab.type) {
            case 'tower_inferno_tick': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    this.damagePlayer(target, ab.damage || 0, source, 'Foco Infernal', false, false, undefined, true);
                }
                if (ab.targetX !== undefined && ab.targetZ !== undefined) {
                    const sx = ab.x ?? source.position.x;
                    const sz = ab.z ?? source.position.z;
                    const tx = ab.targetX;
                    const tz = ab.targetZ;
                    const mid = new Vec3((sx + tx) * 0.5, 0, (sz + tz) * 0.5);
                    const dx = tx - sx;
                    const dz = tz - sz;
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'tower_inferno_beam',
                        position: mid,
                        radius: Math.max(0.8, Math.sqrt(dx * dx + dz * dz) * 0.5),
                        duration: 300,
                        timer: 300,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { sourceId: source.id, sourceX: sx, sourceZ: sz, targetX: tx, targetZ: tz, heat: ab.lockTime || 0 },
                    });
                }
                break;
            }
            case 'tower_inferno_overheat': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    this.damagePlayer(target, this.capTowerDamage(target, ab.damage || 0), source, 'Superaquecimento Infernal');
                    target.applySlow(ab.slowDuration || 2000, ab.slowAmount || 0.40);
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'tower_inferno_overheat',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: 4.5,
                    duration: 650,
                    timer: 650,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: source.id },
                });
                break;
            }
            case 'tower_shock_pulse': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    this.damagePlayer(target, ab.damage || 0, source, 'Pulso da Bobina de Choque');
                    target.applySlow(ab.slowDuration || 800, ab.slowAmount || 0.20);
                    const stunMap: Map<string, number> | undefined = (source as any).lastShockStun;
                    const lastStun = stunMap?.get(target.id) || 0;
                    if (Date.now() - lastStun >= 1600 && Math.random() < (ab.stunChance || 0)) {
                        target.applyStun(ab.stunDuration || 180);
                        stunMap?.set(target.id, Date.now());
                    }
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'tower_shock_pulse',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: 4.5,
                    duration: 420,
                    timer: 420,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: source.id },
                });
                break;
            }
            case 'tower_shock_overload': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    this.damagePlayer(target, this.capTowerDamage(target, ab.damage || 0), source, 'Sobrecarga Eletrica');
                    target.applyStun(ab.stunDuration || 550);
                    target.applySlow(ab.slowDuration || 2000, ab.slowAmount || 0.40);
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'tower_shock_overload',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: 5.5,
                    duration: 700,
                    timer: 700,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: source.id },
                });
                break;
            }
            case 'tower_gravity_pulse': {
                const target = this.players.get(ab.targetId);
                const center = new Vec3(ab.x, 0, ab.z);
                if (target && !target.isDead) {
                    this.damagePlayer(target, ab.damage || 0, source, 'Pulso de Vortice');
                    target.applySlow(ab.slowDuration || 1200, ab.slowAmount || 0.25);
                    this.applyLimboForce(target, center, ab.pullForce || 8, true);
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'tower_gravity_pulse',
                    position: center,
                    radius: ab.radius || 5,
                    duration: 700,
                    timer: 700,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: source.id },
                });
                break;
            }
            case 'tower_gravity_rupture': {
                const target = this.players.get(ab.targetId);
                const center = new Vec3(ab.x, 0, ab.z);
                if (target && !target.isDead) {
                    this.damagePlayer(target, this.capTowerDamage(target, ab.damage || 0), source, 'Ruptura Gravitacional');
                    target.applySlow(ab.slowDuration || 1800, ab.slowAmount || 0.45);
                    this.applyLimboForce(target, center, ab.knockbackForce || 14, false);
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'tower_gravity_rupture',
                    position: center,
                    radius: ab.radius || 5,
                    duration: 800,
                    timer: 800,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: source.id },
                });
                if (ab.residue) {
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'tower_gravity_residue',
                        position: center.clone(),
                        radius: ab.radius || 5,
                        duration: 3000,
                        timer: 3000,
                        damagePerSec: ab.residueDamagePerSec || source.damage * 0.35,
                        lastTick: 0,
                        extras: { sourceId: source.id },
                    });
                }
                break;
            }
            case 'limbo_line': {
                const origin = new Vec3(ab.x, 0, ab.z);
                const aim = new Vec3(ab.targetX, 0, ab.targetZ);
                const dir = aim.clone().sub(origin);
                dir.y = 0;
                if (dir.lengthSq() <= 0.01) break;
                dir.normalize();
                const range = ab.range || 18;
                const width = ab.width || 1.2;
                const end = origin.clone().add(dir.clone().multiplyScalar(range));
                const mid = origin.clone().add(dir.clone().multiplyScalar(range * 0.5));
                this.pushLimboWarning(`limbo_warning_${ab.ability || 'line'}`, mid, Math.max(width, range * 0.5), ab.delay || 900, { ...ab, line: true, sourceId: source.id });
                setTimeout(() => {
                    const zoneSource = this.resolveAbilitySource(ab, source);
                    for (const p of this.players.values()) {
                        if (p.isDead) continue;
                        if (this.distancePointToSegmentXZ(p.position, origin, end) <= width) {
                            this.damagePlayer(p, ab.damage || 0, zoneSource, ab.ability || ab.type);
                            this.applyLimboStatus(p, ab.status, ab.statusDuration, ab.statusIntensity);
                            this.applyLimboForce(p, origin, ab.knockbackForce, false);
                        }
                    }
                }, ab.delay || 900);
                break;
            }
            case 'limbo_radial': {
                const center = new Vec3(ab.x, 0, ab.z);
                const radius = ab.radius || 4;
                this.pushLimboWarning(`limbo_warning_${ab.ability || 'radial'}`, center.clone(), radius, ab.delay || 750, { ...ab, sourceId: source.id });
                setTimeout(() => {
                    const zoneSource = this.resolveAbilitySource(ab, source);
                    for (const p of this.players.values()) {
                        if (p.isDead || p.position.distanceToXZ(center) > radius) continue;
                        this.damagePlayer(p, ab.damage || 0, zoneSource, ab.ability || ab.type);
                        this.applyLimboStatus(p, ab.status, ab.statusDuration, ab.statusIntensity);
                        this.applyLimboForce(p, center, ab.knockbackForce, false);
                        this.applyLimboForce(p, center, ab.pullForce, true);
                    }
                }, ab.delay || 750);
                break;
            }
            case 'limbo_zone':
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: `limbo_zone_${ab.ability || 'area'}`,
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: ab.radius || 3,
                    duration: ab.duration || 4000,
                    timer: ab.duration || 4000,
                    damagePerSec: ab.damagePerSec || 0,
                    lastTick: 0,
                    extras: { ...ab, sourceId: source.id }
                });
                break;
            case 'limbo_spawn_souls': {
                const count = ab.count || 3;
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2;
                    const sx = ab.x + Math.cos(angle) * 2.2;
                    const sz = ab.z + Math.sin(angle) * 2.2;
                    const soul = new CaveiraExplosivaEnemy(new Vec3(sx, 0.5, sz), ab.damage || source.damage * 0.5, 1);
                    soul.name = 'Alma Errante';
                    soul.type = 'AlmaErrante';
                    (soul as any).ownerId = ab.ownerId || source.id;
                    this.addEnemy(soul, 'limbo:spawnSouls', players);
                }
                break;
            }
            case 'limbo_enemy_aura': {
                const center = new Vec3(ab.x, 0, ab.z);
                for (const e of this.enemies) {
                    if (e.isDestroyed || e.id === source.id || e.position.distanceToXZ(center) > (ab.radius || 7)) continue;
                    const anyEnemy = e as any;
                    if (anyEnemy.__limboAuraBaseSpeed === undefined) anyEnemy.__limboAuraBaseSpeed = e.originalSpeed || e.speed;
                    if (anyEnemy.__limboAuraBaseDamage === undefined) anyEnemy.__limboAuraBaseDamage = e.damage;
                    e.speed = anyEnemy.__limboAuraBaseSpeed * (1 + (ab.speedBonus || 0.10));
                    e.damage = anyEnemy.__limboAuraBaseDamage * (1 + (ab.damageBonus || 0.08));
                    anyEnemy.__limboAuraUntil = Date.now() + 1200;
                }
                this.pushLimboWarning('limbo_enemy_aura', center, ab.radius || 7, 1000, { ...ab, sourceId: source.id });
                break;
            }
            case 'limbo_consume_ally': {
                const radius = ab.radius || 7;
                let victim: ServerEnemy | null = null;
                let bestDist = Number.MAX_VALUE;
                for (const e of this.enemies) {
                    if (e.isDestroyed || e.id === source.id) continue;
                    if (e.maxHp > source.maxHp * 0.5) continue;
                    const dist = e.position.distanceToXZ(source.position);
                    if (dist < radius && dist < bestDist) {
                        victim = e;
                        bestDist = dist;
                    }
                }
                if (victim) {
                    victim.isDestroyed = true;
                    source.hp = Math.min(source.maxHp, source.hp + source.maxHp * (ab.healPct || 0.05));
                    (source as any).__limboDamageBuffUntil = Date.now() + (ab.buffDuration || 8000);
                    (source as any).__limboDamageBuff = ab.damageBonus || 0.10;
                    this.pushLimboWarning('limbo_consume_ally', victim.position.clone(), 2.5, 700, { sourceId: source.id });
                }
                break;
            }
            case 'limbo_delayed_mark': {
                const target = this.players.get(ab.targetId);
                if (!target || target.isDead) break;
                this.pushLimboWarning('limbo_delayed_mark', target.position.clone(), ab.radius || 6, ab.delay || 3000, { ...ab, sourceId: source.id });
                setTimeout(() => {
                    const liveTarget = this.players.get(ab.targetId);
                    if (!liveTarget || liveTarget.isDead || source.isDestroyed) return;
                    if (liveTarget.position.distanceToXZ(source.position) <= (ab.radius || 6)) {
                        this.damagePlayer(liveTarget, ab.damage || source.damage * 2, this.resolveAbilitySource(ab, source), ab.type);
                    }
                }, ab.delay || 3000);
                break;
            }
            case 'limbo_coin_rain': {
                const count = ab.count || 5;
                const center = new Vec3(ab.x, 0, ab.z);
                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * (ab.spread || 7);
                    const pos = new Vec3(center.x + Math.cos(angle) * dist, 0, center.z + Math.sin(angle) * dist);
                    this.pushLimboWarning('limbo_coin_warning', pos, ab.radius || 1.8, ab.delay || 900, { ...ab, sourceId: source.id });
                    setTimeout(() => {
                        const zoneSource = this.resolveAbilitySource(ab, source);
                        for (const p of this.players.values()) {
                            if (!p.isDead && p.position.distanceToXZ(pos) <= (ab.radius || 1.8)) {
                                this.damagePlayer(p, ab.damage || 0, zoneSource, 'chuva_de_moedas');
                            }
                        }
                    }, ab.delay || 900);
                }
                break;
            }
            case 'limbo_cone': {
                const origin = new Vec3(ab.x, 0, ab.z);
                const dir = new Vec3(ab.dirX || 0, 0, ab.dirZ || 1);
                if (dir.lengthSq() <= 0.01) break;
                dir.normalize();
                const range = ab.range || 7;
                const cosLimit = Math.cos((ab.angle || Math.PI / 3) * 0.5);
                this.pushLimboWarning(`limbo_warning_${ab.ability || 'cone'}`, origin.clone().add(dir.clone().multiplyScalar(range * 0.45)), range * 0.5, 650, { ...ab, sourceId: source.id });
                for (const p of players) {
                    if (p.isDead) continue;
                    const toPlayer = p.position.clone().sub(origin);
                    toPlayer.y = 0;
                    const dist = toPlayer.length();
                    if (dist <= 0.01 || dist > range) continue;
                    if (toPlayer.normalize().dot(dir) >= cosLimit) {
                        this.damagePlayer(p, ab.damage || 0, this.resolveAbilitySource(ab, source), ab.ability || ab.type);
                        this.applyLimboStatus(p, ab.status, ab.statusDuration, ab.statusIntensity);
                    }
                }
                break;
            }
            case 'limbo_clone': {
                const maxClones = ab.maxClones || 1;
                const ownerId = ab.ownerId || source.id;
                const activeClones = this.enemies.filter(e => e.type === 'CloneIlusorio' && (e as any).ownerId === ownerId && !e.isDestroyed).length;
                if (activeClones >= maxClones) break;
                const angle = Math.random() * Math.PI * 2;
                const clone = new CloneIlusorioEnemy(new Vec3(ab.x + Math.cos(angle) * 2, 0, ab.z + Math.sin(angle) * 2), 1);
                (clone as any).ownerId = ownerId;
                clone.maxHp = source.maxHp * (ab.hpPct || 0.2);
                clone.hp = clone.maxHp;
                clone.damage = source.damage * (ab.damageScale || 0.5);
                clone.xp = 0;
                clone.score = 0;
                this.addEnemy(clone, 'limbo:clone', players);
                break;
            }
            case 'limbo_swap_clone': {
                const ownerId = ab.ownerId || source.id;
                const clone = this.enemies.find(e => e.type === 'CloneIlusorio' && (e as any).ownerId === ownerId && !e.isDestroyed);
                if (!clone) break;
                const oldSourcePos = source.position.clone();
                source.position.copy(clone.position);
                clone.position.copy(oldSourcePos);
                this.pushLimboWarning('limbo_swap_clone', oldSourcePos, 2.8, 650, { sourceId: source.id });
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(oldSourcePos) <= 2.8) {
                        this.damagePlayer(p, ab.damage || source.damage, source, 'troca_de_mascara');
                        this.applyLimboStatus(p, 'blind', 1200);
                    }
                }
                break;
            }
            case 'limbo_fake_stage': {
                const center = new Vec3(ab.x, 0, ab.z);
                const count = ab.count || 6;
                const realCount = ab.realCount || 3;
                const realIndexes = new Set<number>();
                while (realIndexes.size < realCount) realIndexes.add(Math.floor(Math.random() * count));
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2;
                    const pos = new Vec3(center.x + Math.cos(angle) * (ab.spread || 6), 0, center.z + Math.sin(angle) * (ab.spread || 6));
                    const real = realIndexes.has(i);
                    this.pushLimboWarning(real ? 'limbo_stage_real' : 'limbo_stage_fake', pos, ab.radius || 2.2, ab.delay || 2000, { ...ab, sourceId: source.id, real });
                    if (real) {
                        setTimeout(() => {
                            const zoneSource = this.resolveAbilitySource(ab, source);
                            for (const p of this.players.values()) {
                                if (!p.isDead && p.position.distanceToXZ(pos) <= (ab.radius || 2.2)) {
                                    this.damagePlayer(p, ab.damage || 0, zoneSource, 'palco_da_mentira');
                                }
                            }
                        }, ab.delay || 2000);
                    }
                }
                break;
            }
            case 'limbo_prison': {
                const target = this.players.get(ab.targetId);
                if (!target || target.isDead) break;
                const center = new Vec3(ab.x, 0, ab.z);
                this.pushLimboWarning('limbo_prison', center.clone(), ab.radius || 3.5, ab.delay || 2000, { ...ab, sourceId: source.id });
                setTimeout(() => {
                    const liveTarget = this.players.get(ab.targetId);
                    if (!liveTarget || liveTarget.isDead || liveTarget.position.distanceToXZ(center) > (ab.radius || 3.5)) return;
                    this.damagePlayer(liveTarget, ab.damage || 0, this.resolveAbilitySource(ab, source), 'prisao_da_traicao');
                    liveTarget.applyRoot(ab.rootDuration || 1000);
                }, ab.delay || 2000);
                break;
            }
            // --- Bruxa do Gelo Rework ---
            case 'ice_w_root':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        this.damagePlayer(p, ab.damage, source, ab.type);
                        p.applyRoot(1500); // 1.5s root
                    }
                }
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'ice_w_root', position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: 500, timer: 500, damagePerSec: 0, lastTick: 0 });
                break;
            case 'ice_e_claw_spawn':
                // Client-side visual only. The server handles the position inside the AI.
                // We could just emit an event, or create a visual zone.
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'ice_e_claw_spawn', position: new Vec3(ab.x, 0, ab.z), radius: 2, duration: 2500, timer: 2500, damagePerSec: 0, lastTick: 0, extras: { dirX: ab.dirX, dirZ: ab.dirZ, sourceId: source.id } });
                break;
            case 'ice_r_self':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'ice_r_self', position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: 3000, timer: 3000, damagePerSec: ab.damage / 3, lastTick: 0, extras: { sourceId: source.id } });
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        p.applySlow(2000, 0.5);
                    }
                }
                break;
            case 'ice_r_stun':
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    this.damagePlayer(target, ab.damage, source, ab.type);
                    target.applyStun(1500);
                }
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'ice_r_stun', position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: 3000, timer: 3000, damagePerSec: ab.damage / 3, lastTick: 0, extras: { sourceId: source.id } });
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        p.applySlow(2000, 0.5);
                    }
                }
                break;
            case 'zhonya_effect':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'zhonya_effect', position: new Vec3(ab.x, 0, ab.z), radius: 1, duration: 2500, timer: 2500, damagePerSec: 0, lastTick: 0, extras: { sourceId: source.id } });
                break;
            case 'ice_slave_explosion':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        this.damagePlayer(p, ab.damage, source, ab.type);
                    }
                }
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'ice_slave_explosion', position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: 500, timer: 500, damagePerSec: 0, lastTick: 0 });
                break;
            // ----------------------------
            case 'mestra_arcane_mark': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    const bonus = (source as any).consumeArcaneMark?.(target.id, ab.detonationMultiplier || 1) || 0;
                    this.damagePlayer(target, (ab.damage || 0) + bonus, source, ab.type);
                    if (!ab.mimic || bonus === 0) {
                        (source as any).applyArcaneMark?.(target.id, ab.markDuration || 3500);
                    }
                    this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: bonus > 0 ? 'mestra_mark_pop' : 'mestra_arcane_mark', position: target.position.clone(), radius: bonus > 0 ? 2.2 : 1.2, duration: 700, timer: 700, damagePerSec: 0, lastTick: 0, extras: { sourceId: source.id } });
                }
                break;
            }
            case 'mestra_distortion_impact': {
                const center = new Vec3(ab.x, 0, ab.z);
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(center) < (ab.radius || 3.3)) {
                        const bonus = (source as any).consumeArcaneMark?.(p.id, ab.detonationMultiplier || 1) || 0;
                        this.damagePlayer(p, (ab.damage || 0) + bonus, source, ab.type);
                        if (bonus > 0) {
                            this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mestra_mark_pop', position: p.position.clone(), radius: 2.4, duration: 600, timer: 600, damagePerSec: 0, lastTick: 0 });
                        }
                    }
                }
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: ab.mimic ? 'mestra_mimic_distortion' : 'mestra_distortion_impact', position: center, radius: ab.radius || 3.3, duration: 650, timer: 650, damagePerSec: 0, lastTick: 0, extras: { sourceId: source.id } });
                break;
            }
            case 'mestra_distortion_return':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mestra_distortion_return', position: new Vec3(ab.targetX, 0, ab.targetZ), radius: 2.2, duration: 650, timer: 650, damagePerSec: 0, lastTick: 0, extras: { sourceId: source.id } });
                break;
            case 'mestra_chain_start': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    const bonus = (source as any).consumeArcaneMark?.(target.id, ab.detonationMultiplier || 1) || 0;
                    this.damagePlayer(target, (ab.damage || 0) + bonus, source, ab.type);
                    if (bonus > 0) {
                        this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mestra_mark_pop', position: target.position.clone(), radius: 2.4, duration: 600, timer: 600, damagePerSec: 0, lastTick: 0 });
                    }
                    const mid = new Vec3((ab.x + target.position.x) / 2, 0, (ab.z + target.position.z) / 2);
                    this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: ab.mimic ? 'mestra_mimic_chain' : 'mestra_chain_start', position: mid, radius: Math.max(1.5, source.position.distanceToXZ(target.position) / 2), duration: 900, timer: 900, damagePerSec: 0, lastTick: 0 });
                }
                break;
            }
            case 'mestra_chain_root': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    this.damagePlayer(target, ab.damage || 0, source, ab.type);
                    target.applyRoot(ab.rootDuration || 1600);
                    this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: ab.mimic ? 'mestra_mimic_root' : 'mestra_chain_root', position: target.position.clone(), radius: 2.6, duration: ab.rootDuration || 1600, timer: ab.rootDuration || 1600, damagePerSec: 0, lastTick: 0 });
                }
                break;
            }
            case 'mestra_chain_break':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mestra_chain_break', position: new Vec3(ab.x, 0, ab.z), radius: 1.5, duration: 450, timer: 450, damagePerSec: 0, lastTick: 0 });
                break;
            case 'mestra_mimic_cast':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mestra_mimic_cast', position: new Vec3(ab.x, 0, ab.z), radius: 3.0, duration: 850, timer: 850, damagePerSec: 0, lastTick: 0 });
                break;
            case 'mestra_passive_vanish':
            case 'mestra_reappear':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: ab.type, position: new Vec3(ab.x, 0, ab.z), radius: ab.passive ? 4.0 : 2.5, duration: 900, timer: 900, damagePerSec: 0, lastTick: 0 });
                break;
            case 'spawnClone':
                // Limit to 1 clone per MestraDaIlusao
                const ownerMestra = ab.ownerId
                    ? this.enemies.find(e => e.id === ab.ownerId)
                    : this.enemies.find(e => Math.abs(e.position.x - ab.x) < 5 && Math.abs(e.position.z - ab.z) < 5 && e.type === 'MestraDaIlusao');
                if (ownerMestra) {
                    const activeClones = this.enemies.filter(e => e.type === 'CloneIlusorio' && (e as any).ownerId === ownerMestra.id).length;
                    if (activeClones >= (ab.ownerId ? 2 : 1)) break;
                }
                const clone = new CloneIlusorioEnemy(new Vec3(ab.x, 0, ab.z), 1);
                if (ownerMestra) (clone as any).ownerId = ownerMestra.id;
                if (ab.dirX !== undefined || ab.dirZ !== undefined) (clone as any).moveDir = new Vec3(ab.dirX || 0, 0, ab.dirZ || 0).normalize();
                if (ab.lifetime) (clone as any).lifetime = ab.lifetime;
                if (ab.speed) (clone as any).speed = ab.speed;
                clone.xp = 0;
                clone.score = 0;
                this.addEnemy(clone, 'ability:spawnClone', players);
                break;
            case 'blizzard': case 'iceWall': case 'tormentFlames': case 'nevascaZone':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: ab.type, position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: ab.duration, timer: ab.duration, damagePerSec: ab.damagePerSec || ab.damage || 0, lastTick: 0, extras: { ...ab, sourceId: source.id } });
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
            // Passive abilities from Limbo bosses
            case 'lodoComida':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'lodoComida', position: new Vec3(ab.x, 0, ab.z), radius: 3, duration: 5, timer: 5, damagePerSec: 0, lastTick: 0 });
                break;
            case 'miniCubosDourados':
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const proj = new ServerProjectile(
                        new Vec3(ab.x + Math.cos(angle) * 2, 0.5, ab.z + Math.sin(angle) * 2),
                        new Vec3(Math.cos(angle), 0, Math.sin(angle)),
                        ab.ownerId || 'enemy', false, 5, 0xffd700
                    );
                    proj.type = 'miniCuboDourado';
                    proj.speed = 3;
                    proj.lifetime = 3;
                    this.enemyProjectiles.push(proj);
                }
                break;
            case 'sangraCubos':
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const proj = new ServerProjectile(
                        new Vec3(ab.x + Math.cos(angle) * 1.5, 0.5, ab.z + Math.sin(angle) * 1.5),
                        new Vec3(Math.cos(angle), 0, Math.sin(angle)),
                        ab.ownerId || 'enemy', false, 3, 0xff0000
                    );
                    proj.type = 'sangraCubo';
                    proj.speed = 4;
                    proj.lifetime = 2.5;
                    this.enemyProjectiles.push(proj);
                }
                break;
            case 'dashExplosion': case 'rugido':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        this.damagePlayer(p, ab.damage, this.resolveAbilitySource(ab, source), ab.type);
                        if (ab.stunDuration) p.applyStun(ab.stunDuration);
                    }
                }
                break;
            case 'devastation':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        this.damagePlayer(p, p.maxHp * ab.hpPercent, this.resolveAbilitySource(ab, source), ab.type);
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
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'cannonSalvo', position: new Vec3(ab.x, 0, ab.z), radius: ab.areaSize, duration: ab.delayMs + ab.salvos * ab.salvoInterval + 1000, timer: ab.delayMs + ab.salvos * ab.salvoInterval + 1000, damagePerSec: ab.damage, lastTick: 0, extras: { ...ab, sourceId: source.id } });
                break;
            case 'powderKeg':
                // Simplified: immediate explosion zone
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'powderKeg', position: new Vec3(ab.x, 0, ab.z), radius: 5, duration: 3000, timer: 3000, damagePerSec: ab.damage, lastTick: 0, extras: { ...ab, sourceId: source.id } });
                break;
            case 'bouncingBomb':
                // Delayed burst zone
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'bouncingBomb', position: new Vec3(ab.targetX, 0, ab.targetZ), radius: ab.explosionRadius, duration: 1500, timer: 1500, damagePerSec: ab.damage, lastTick: 0, extras: { burst: true, ...ab, sourceId: source.id } });
                break;
            case 'mineField':
                for (let i = 0; i < ab.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * ab.radius;
                    const mx = ab.x + Math.cos(angle) * r;
                    const mz = ab.z + Math.sin(angle) * r;
                    this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mineField', position: new Vec3(mx, 0, mz), radius: ab.mineRadius, duration: ab.duration, timer: ab.duration, damagePerSec: ab.mineDamage, lastTick: 0, extras: { burst: true, sourceId: source.id } });
                }
                break;
            case 'satchel_charge':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'satchel_charge', position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: ab.duration, timer: ab.duration, damagePerSec: ab.damage, lastTick: 0, extras: { sourceId: ab.sourceId || source.id, knockbackForce: 18 } });
                break;
            case 'hexplosive_minefield':
                for (let i = 0; i < ab.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * ab.radius;
                    const mx = ab.x + Math.cos(angle) * r;
                    const mz = ab.z + Math.sin(angle) * r;
                    this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'hexplosive_mine', position: new Vec3(mx, 0, mz), radius: ab.mineRadius, duration: ab.duration, timer: ab.duration, damagePerSec: ab.mineDamage, lastTick: 0, extras: { sourceId: source.id } });
                }
                break;
            case 'mega_inferno_bomb':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mega_inferno_warning', position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: ab.duration, timer: ab.duration, damagePerSec: ab.damage, lastTick: 0, extras: { sourceId: source.id } });
                break;
            case 'smith_teleport_aoe':
                // AoE explosion after teleport
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.position.x, 0, ab.position.z)) < ab.radius) {
                        this.damagePlayer(p, ab.damage, this.resolveAbilitySource(ab, source), ab.type);
                        if (ab.invertControls) {
                            p.applyInvertedControls(ab.invertDuration || 2000);
                        }
                    }
                }
                break;
            case 'spawnSouls':
                console.log(`[DEBUG] spawnSouls: count=${ab.count} ownerId=${ab.ownerId}`);
                const ownerSouls = this.enemies.find(e => e.id === ab.ownerId);
                if (ownerSouls) {
                    for (let i = 0; i < ab.count; i++) {
                        const angle = (i / ab.count) * Math.PI * 2;
                        const sx = ab.x + Math.cos(angle) * 4;
                        const sz = ab.z + Math.sin(angle) * 4;
                        const soul = new AlmaAmaldicoadaEnemy(new Vec3(sx, 0, sz), ab.ownerId, 1);
                        this.addEnemy(soul, 'ability:spawnSouls', players);
                        if (!(ownerSouls as any).souls) (ownerSouls as any).souls = [];
                        (ownerSouls as any).souls.push(soul.id);
                    }
                    console.log(`[DEBUG] Created ${ab.count} AlmaAmaldicoada, total enemies: ${this.enemies.length}`);
                }
                break;
            case 'spawnCaveiras':
                for (let i = 0; i < ab.count; i++) {
                    const angle = (i / ab.count) * Math.PI * 2;
                    const sx = ab.x + Math.cos(angle) * 2;
                    const sz = ab.z + Math.sin(angle) * 2;
                    const skull = new CaveiraExplosivaEnemy(new Vec3(sx, 0, sz), ab.damage, 1);
                    this.addEnemy(skull, 'ability:spawnCaveiras', players);
                }
                break;
            case 'spawnEspectro':
                // Lookup base stats from originalType
                const origType = ab.originalType || 'PurpleCube';
                let origHp = 500, origDmg = 50, origSpd = 3;
                // Find a live enemy of that type to get stats, or use defaults
                const origEnemy = this.enemies.find(e => e.type === origType && !e.isDestroyed);
                if (origEnemy) {
                    origHp = origEnemy.maxHp;
                    origDmg = origEnemy.damage;
                    origSpd = origEnemy.originalSpeed;
                } else {
                    // Fallback: use CONFIG values
                    const cfg = (CONFIG as any)[origType.toUpperCase()] || CONFIG.PURPLE_CUBE;
                    origHp = cfg.BASE_HP || 500;
                    origDmg = cfg.BASE_DAMAGE || 50;
                    origSpd = cfg.SPEED || 3;
                }
                const espectro = new EspectroSombrioEnemy(
                    new Vec3(ab.x, 0, ab.z), origHp, origDmg, origSpd, 1
                );
                espectro.xp = 0; espectro.score = 0;
                this.addEnemy(espectro, 'ability:spawnEspectro', players);
                break;
            case 'spawnBrotos':
                for (let i = 0; i < ab.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const bx = ab.x + Math.cos(angle) * 3;
                    const bz = ab.z + Math.sin(angle) * 3;
                    const broto = new BrotoCarnivoroEnemy(new Vec3(bx, 0, bz), ab.playerLevel || 1, 1);
                    this.addEnemy(broto, 'ability:spawnBrotos', players);
                }
                break;
            case 'spawnBrotos':
                for (let i = 0; i < ab.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const bx = ab.x + Math.cos(angle) * 3;
                    const bz = ab.z + Math.sin(angle) * 3;
                    const broto = new BrotoCarnivoroEnemy(new Vec3(bx, 0, bz), ab.playerLevel || 1, 1);
                    this.addEnemy(broto, 'ability:spawnBrotos', players);
                }
                break;
            // Cao Dos Infernos abilities
            case 'spawnMatilha':
                const matilha = new MatilhaGeometraEnemy(new Vec3(ab.x, 0, ab.z), ab.playerLevel || 1, 1);
                matilha.parentId = ab.parentId;
                matilha.xp = 0; matilha.score = 0;
                const boss = this.enemies.find(e => e.id === ab.parentId);
                if (boss) {
                    matilha.parentBoss = boss as CaoDosInfernosEnemy;
                    if ((boss as any).matilhaIds) (boss as any).matilhaIds.push(matilha.id);
                }
                this.addEnemy(matilha, 'ability:spawnMatilha', players);
                break;
            case 'prismaSombrio':
                const projQ = new ServerProjectile(
                    new Vec3(ab.x, ab.y || 0.6, ab.z),
                    new Vec3(ab.dirX, 0, ab.dirZ),
                    ab.bossId,
                    false,
                    ab.damage,
                    0xff0000
                );
                projQ.speed = 18;
                projQ.specialEffect = 'prismaSombrio';
                projQ.lifetime = 1.5;
                projQ.hitboxRadius = 0.5;
                this.enemyProjectiles.push(projQ);
                break;
            case 'repairMatilha':
                const parentBoss = this.enemies.find(e => e.id === ab.bossId) as CaoDosInfernosEnemy;
                if (parentBoss && !parentBoss.isDestroyed) {
                    const toSpawn = CONFIG.CAO_DOS_INFERNOS.MATILHA_MAX - parentBoss.matilhaIds.length;
                    for (let i = 0; i < toSpawn; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const mx = parentBoss.position.x + Math.cos(angle) * 2;
                        const mz = parentBoss.position.z + Math.sin(angle) * 2;
                        const repairedPup = new MatilhaGeometraEnemy(new Vec3(mx, 0, mz), parentBoss.playerLevel || 1, 1);
                        repairedPup.parentId = parentBoss.id;
                        repairedPup.parentBoss = parentBoss;
                        repairedPup.xp = 0; repairedPup.score = 0;
                        this.addEnemy(repairedPup, 'ability:repairMatilha', players);
                        parentBoss.matilhaIds.push(repairedPup.id);
                    }
                    (parentBoss as any).habilidades.matilhaCount = CONFIG.CAO_DOS_INFERNOS.MATILHA_MAX;
                }
                break;
            case 'investidaChannel':
            case 'investidaImpact':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < (ab.type === 'investidaChannel' ? 3 : 2)) {
                        this.damagePlayer(p, ab.damage || 0, this.resolveAbilitySource(ab, source), ab.type);
                        if (ab.stunDuration) p.applyStun(ab.stunDuration);
                    }
                }
                break;
            case 'eviscerarStart':
            case 'eviscerarSlam':
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < 6) {
                        this.damagePlayer(p, ab.damage || 0, this.resolveAbilitySource(ab, source), ab.type);
                    }
                }
                const bossSlam = this.enemies.find(e => e.id === ab.bossId);
                if (bossSlam) (bossSlam as any).habilidades.e.isSlamming = false;
                break;
            case 'recallMatilha':
                const ownerBoss = this.enemies.find(e => e.id === ab.bossId);
                if (ownerBoss && (ownerBoss as any).matilhaIds) {
                    for (const mid of (ownerBoss as any).matilhaIds) {
                        const m = this.enemies.find(e => e.id === mid);
                        if (m && !m.isDestroyed) m.position = new Vec3(ab.x, 0, ab.z);
                    }
                }
                break;
            case 'chamadoAbismo':
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'chamadoAbismo', position: new Vec3(ab.x, 0, ab.z), radius: 8, duration: ab.duration || 15000, timer: ab.duration || 15000, damagePerSec: 0, lastTick: 0, extras: { ...ab, sourceId: source.id } });
                break;
            case 'surto_epidemico':
                // Duplicate 1 stack of a random pathogen for all players in range, or apply a random one if they have none.
                {
                    const center = new Vec3(ab.x, 0, ab.z);
                    const pulses = Math.max(1, Math.min(3, ab.pulses || 1));
                    const pathogenLimits = { maxStacks: ab.maxDiseaseStacks, maxTypes: ab.maxDiseaseTypes };
                    for (let pulse = 0; pulse < pulses; pulse++) {
                        for (const p of players) {
                            if (!p.isDead && p.position.distanceToXZ(center) < ab.radius) {
                                const pathogenKeys = Object.keys(p.pathogens);
                                if (pathogenKeys.length > 0) {
                                    const randKey = pathogenKeys[Math.floor(Math.random() * pathogenKeys.length)];
                                    p.applyPathogen(randKey, 10000, pathogenLimits);
                                } else {
                                    const PATHOGENS = [
                                        'febre_critica',
                                        'paralisia_parcial',
                                        'mao_tremula',
                                        'imunidade_baixa',
                                        'visao_turva',
                                        'cansaco_viral',
                                        'incapacidade',
                                        'hemorragia_quadrada'
                                    ];
                                    const randomPathogen = PATHOGENS[Math.floor(Math.random() * PATHOGENS.length)];
                                    p.applyPathogen(randomPathogen, 10000, pathogenLimits);
                                }
                            }
                        }
                    }
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'surto_epidemico',
                        position: center,
                        radius: ab.radius,
                        duration: 700 + pulses * 250,
                        timer: 700 + pulses * 250,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { ...ab, sourceId: source.id, burst: true }
                    });
                }
                break;
            case 'nuvem_esporos':
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'nuvem_esporos',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: ab.radius,
                    duration: ab.duration,
                    timer: ab.duration,
                    damagePerSec: ab.damagePerSec,
                    lastTick: 0,
                    extras: { ...ab, sourceId: source.id }
                });
                break;
            case 'incubadora_viral':
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'incubadora_viral',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: ab.radius,
                    duration: ab.duration,
                    timer: ab.duration,
                    damagePerSec: ab.damagePerSec,
                    lastTick: 0,
                    extras: { ...ab, sourceId: source.id }
                });
                break;
            case 'diagnostico_fatal': {
                const target = this.players.get(ab.targetId);
                if (target && !target.isDead) {
                    this.damagePlayer(target, ab.damage || 0, this.resolveAbilitySource(ab, source), ab.type);
                    const PATHOGENS = [
                        'febre_critica',
                        'paralisia_parcial',
                        'mao_tremula',
                        'imunidade_baixa',
                        'visao_turva',
                        'cansaco_viral',
                        'incapacidade',
                        'hemorragia_quadrada'
                    ];
                    const randKey = PATHOGENS[Math.floor(Math.random() * PATHOGENS.length)];
                    target.applyPathogen(randKey, 10000, { maxStacks: ab.maxDiseaseStacks, maxTypes: ab.maxDiseaseTypes });
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'diagnostico_fatal',
                        position: target.position.clone(),
                        radius: 2.8,
                        duration: 700,
                        timer: 700,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { ...ab, sourceId: source.id, burst: true }
                    });
                }
                break;
            }
            case 'sobrecarga_patogenica': {
                const center = new Vec3(ab.x, 0, ab.z);
                const PATHOGENS = [
                    'febre_critica',
                    'paralisia_parcial',
                    'mao_tremula',
                    'imunidade_baixa',
                    'visao_turva',
                    'cansaco_viral',
                    'incapacidade',
                    'hemorragia_quadrada'
                ];
                for (const p of players) {
                    if (p.isDead || p.position.distanceToXZ(center) > ab.radius) continue;
                    const stacks = Object.values(p.pathogens).reduce((sum, data) => sum + data.stacks, 0);
                    this.damagePlayer(p, (ab.damage || 0) * (1 + Math.min(0.75, stacks * 0.08)), this.resolveAbilitySource(ab, source), ab.type);
                    const randKey = PATHOGENS[Math.floor(Math.random() * PATHOGENS.length)];
                    p.applyPathogen(randKey, 10000, { maxStacks: ab.maxDiseaseStacks, maxTypes: ab.maxDiseaseTypes });
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'sobrecarga_patogenica',
                    position: center,
                    radius: ab.radius,
                    duration: 800,
                    timer: 800,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { ...ab, sourceId: source.id, burst: true }
                });
                break;
            }

            // ======= O FARAÓ — Abilities =======
            case 'raioDeRaWarning':
                // Warning circle on the ground (VFX only, handled by client via zone)
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'raioDeRaWarning', position: new Vec3(ab.x, 0, ab.z), radius: 3, duration: ab.warningDuration, timer: ab.warningDuration, damagePerSec: 0, lastTick: 0, extras: { ...ab, sourceId: source.id } });
                break;
            case 'raioDeRaStrike':
                // AoE damage: 30% max HP + burn
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        this.damagePlayer(p, p.maxHp * ab.hpPercent, this.resolveAbilitySource(ab, source), ab.type, false, true); // true damage
                        p.applyBurn(ab.burnDuration, ab.burnDps);
                    }
                }
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'raioDeRaStrike', position: new Vec3(ab.x, 0, ab.z), radius: ab.radius, duration: 1000, timer: 1000, damagePerSec: 0, lastTick: 0, extras: { ...ab, sourceId: source.id } });
                break;
            case 'prisaoDeGize': {
                // Create closing pyramid zone, then root if player inside after escape time
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'prisaoDeGize', position: new Vec3(ab.x, 0, ab.z), radius: 4, duration: ab.escapeTime, timer: ab.escapeTime, damagePerSec: 0, lastTick: 0, extras: { ...ab, sourceId: source.id } });
                // Schedule root after escape time
                setTimeout(() => {
                    const target = this.players.get(ab.targetId);
                    if (target && !target.isDead && target.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < 4) {
                        target.applyRoot(ab.rootDuration);
                    }
                }, ab.escapeTime);
                break;
            }
            case 'julgamentoStart':
                // Broadcast Julgamento event to clients (visual split)
                this.pendingEvents.push({ event: 'FARAO_JULGAMENTO', data: { timer: ab.timer, safeX: ab.safeX, safeZ: ab.safeZ } });
                break;
            case 'julgamentoResolve':
                // 99% max HP true damage to everyone NOT in the safe half
                for (const p of players) {
                    if (p.isDead) continue;
                    // Safe side: left half (safeX < 0) or right half (safeX > 0)
                    const isSafe = (ab.safeX < 0 && p.position.x < 0) || (ab.safeX > 0 && p.position.x > 0);
                    if (!isSafe) {
                        this.damagePlayer(p, p.maxHp * ab.damagePercent, this.resolveAbilitySource(ab, source), ab.type, false, true); // true damage
                    }
                }
                break;
            case 'pragaDeVoxeis': {
                // Cone blind + DoT zone
                for (const p of players) {
                    if (p.isDead) continue;
                    const toPlayer = p.position.clone().sub(new Vec3(ab.x, 0, ab.z));
                    toPlayer.y = 0;
                    const coneDir = new Vec3(ab.dirX, 0, ab.dirZ);
                    const dot = toPlayer.normalize().dot(coneDir);
                    const dist = p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z));
                    if (dot > 0.6 && dist < 15) { // 60° cone, 15 units range
                        p.applyBlindness(ab.blindDuration);
                    }
                }
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'pragaDeVoxeis', position: new Vec3(ab.x, 0, ab.z), radius: 15, duration: 3000, timer: 3000, damagePerSec: ab.damagePerSec || 10, lastTick: 0, extras: { dirX: ab.dirX, dirZ: ab.dirZ, sourceId: source.id } });
                break;
            }
            case 'colapsoStart':
                // VFX event: Pharaoh levitating
                this.pendingEvents.push({ event: 'MESSAGE', data: { message: '⚠ O Faraó prepara o Colapso Monumental! ⚠' } });
                break;
            case 'colapsoBlock':
                // Falling block: damage zone + temporary obstacle
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < 2.5) {
                        this.damagePlayer(p, ab.damage, this.resolveAbilitySource(ab, source), ab.type);
                    }
                }
                // Add temporary obstacle
                const obsId = `farao_obs_${this.zoneIdCounter++}`;
                this.obstacles.push({ id: obsId, x: ab.x, z: ab.z, width: 3, depth: 3 });
                this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'colapsoBlock', position: new Vec3(ab.x, 0, ab.z), radius: 2.5, duration: ab.duration, timer: ab.duration, damagePerSec: 0, lastTick: 0, extras: { obstacleId: obsId } });
                // Remove obstacle when zone expires
                setTimeout(() => {
                    this.obstacles = this.obstacles.filter(o => o.id !== obsId);
                }, ab.duration);
                break;
            case 'spawnEscaravelhoFarao': {
                const escaravelho = new EscaravelhoFaraoEnemy(new Vec3(ab.x, 0, ab.z), ab.ownerId);
                this.addEnemy(escaravelho, 'ability:spawnEscaravelhoFarao', players);
                break;
            }
            case 'faraoEclipse':
                // Broadcast eclipse event to clients
                this.pendingEvents.push({ event: 'FARAO_ECLIPSE', data: { duration: ab.duration } });
                break;
            case 'mightyOneInit': {
                this.pendingEvents.push({ event: 'MIGHTY_ONE_SPAWN', data: {} });
                this.pendingEvents.push({ event: 'MESSAGE', data: { message: "⚠️ O Poderoso chegou… O mundo está colapsando!" } });
                const boss = source as TheMightyOneEnemy;
                if (boss) {
                    const orbsToAbsorb = this.orbs.filter(o => o.type === 'xp');
                    for (const orb of orbsToAbsorb) {
                        boss.damageBonus += 0.005;
                        boss.attackSpeedBonus += 0.005;
                    }
                    this.orbs = this.orbs.filter(o => o.type !== 'xp');
                    console.log(`[TheMightyOne] Absorbed ${orbsToAbsorb.length} orbs. damageBonus=${boss.damageBonus}`);

                    const spawnPos1 = this.spawnManager.getSpawnPosition();
                    const spawnPos2 = this.spawnManager.getSpawnPosition();
                    const spawnPos3 = this.spawnManager.getSpawnPosition();
                    const spawnPos4 = this.spawnManager.getSpawnPosition();

                    const superBoss = new SuperBossEnemy(spawnPos1, 1);
                    this.addEnemy(superBoss, 'mightyOneInit:SuperBoss', players);
                    this.spawnManager.activeBoss = superBoss.id;

                    const g1 = new GuardianGuerreiroEnemy(spawnPos2, 1, true);
                    const g2 = new GuardianMagoEnemy(spawnPos3, 1, true);
                    const g3 = new GuardianArqueiroEnemy(spawnPos4, 1, true);
                    this.addEnemy(g1, 'mightyOneInit:GuardianGuerreiro', players);
                    this.addEnemy(g2, 'mightyOneInit:GuardianMago', players);
                    this.addEnemy(g3, 'mightyOneInit:GuardianArqueiro', players);
                }
                break;
            }
            case 'ice_cylinder_explode':
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'ice_cylinder_explode',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: ab.radius,
                    duration: ab.duration,
                    timer: ab.duration,
                    damagePerSec: 0,
                    lastTick: 0
                });
                break;
            case 'spawnGhouls': {
                const count = ab.count || 4;
                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 3.0;
                    const spawnPos = new Vec3(ab.x + Math.cos(angle) * r, 0.4, ab.z + Math.sin(angle) * r);
                    const ghoul = new GhoulEnemy(spawnPos, ab.damage || 120, 1);
                    this.addEnemy(ghoul, 'ability:spawnGhouls', players);
                }
                break;
            }
            case 'estilhacar_explosion': {
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(new Vec3(ab.x, 0, ab.z)) < ab.radius) {
                        this.damagePlayer(p, ab.damage, this.resolveAbilitySource(ab, source), ab.type);
                    }
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'estilhacar_explosion',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: ab.radius,
                    duration: 500,
                    timer: 500,
                    damagePerSec: 0,
                    lastTick: 0
                });
                break;
            }
            case 'spawnValkyrs': {
                const target = this.players.get(ab.targetId);
                if (target) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 8.0;
                    const offset1 = new Vec3(Math.cos(angle) * dist, 3.5, Math.sin(angle) * dist);
                    const offset2 = new Vec3(Math.cos(angle + Math.PI) * dist, 3.5, Math.sin(angle + Math.PI) * dist);
                    
                    const valk1 = new ValkyrEnemy(target.position.clone().add(offset1), ab.damage, 1);
                    const valk2 = new ValkyrEnemy(target.position.clone().add(offset2), ab.damage, 1);
                    
                    this.addEnemy(valk1, 'ability:spawnValkyrs', players);
                    this.addEnemy(valk2, 'ability:spawnValkyrs', players);
                }
                break;
            }
            case 'defile': {
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'defile',
                    position: new Vec3(ab.x, 0, ab.z),
                    radius: ab.radius,
                    duration: ab.duration,
                    timer: ab.duration,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: {
                        sourceId: ab.sourceId || source.id,
                        growthTime: 0,
                        lastGhoulSpawn: 0,
                        damage: ab.damage
                    }
                });
                break;
            }
            case 'icecrown_collapse': {
                const waveDur = 3000;
                const baseRadius = 3.0 * (ab.sizeMultiplier || 1.0);
                for (let waveIndex = 0; waveIndex < 3; waveIndex++) {
                    const delay = waveIndex * 1200;
                    setTimeout(() => {
                        if (this.enemies.length === 0 && this.players.size === 0) return;
                        this.zones.push({
                            id: `zone_${this.zoneIdCounter++}`,
                            type: 'icecrown_wave',
                            position: new Vec3(ab.x, 0, ab.z),
                            radius: baseRadius,
                            duration: waveDur,
                            timer: waveDur,
                            damagePerSec: 0,
                            lastTick: 0,
                            extras: {
                                maxRadius: 25.0 * (ab.sizeMultiplier || 1.0),
                                damage: ab.damage,
                                hitPlayers: [],
                                sourceId: ab.sourceId || source.id
                            }
                        });
                    }, delay);
                }
                break;
            }
            case 'sindragosa_wrath': {
                const half = CONFIG.GROUND_HALF || 50;
                const minCoord = -half;
                const size = 2 * half;
                const gridCells = 5;
                const cellSize = size / gridCells;
                
                const cells: { row: number; col: number }[] = [];
                for (let r = 0; r < gridCells; r++) {
                    for (let c = 0; c < gridCells; c++) {
                        cells.push({ row: r, col: c });
                    }
                }
                
                for (let i = cells.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = cells[i];
                    cells[i] = cells[j];
                    cells[j] = temp;
                }
                
                const targetCells = cells.slice(0, 17);
                this.pendingEvents.push({
                    event: 'MESSAGE',
                    data: { message: '❄️ Sindragosa se prepara para congelar a arena! ❄️' }
                });
                
                const warningDur = 3000;
                for (const cell of targetCells) {
                    const x = minCoord + cellSize * (cell.col + 0.5);
                    const z = minCoord + cellSize * (cell.row + 0.5);
                    
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'sindragosa_warning',
                        position: new Vec3(x, 0, z),
                        radius: cellSize * 0.7,
                        duration: warningDur,
                        timer: warningDur,
                        damagePerSec: 0,
                        lastTick: 0
                    });
                    
                    setTimeout(() => {
                        if (this.enemies.length === 0 && this.players.size === 0) return;
                        
                        const iceBlockDur = 1000;
                        this.zones.push({
                            id: `zone_${this.zoneIdCounter++}`,
                            type: 'sindragosa_ice_block',
                            position: new Vec3(x, 0, z),
                            radius: cellSize * 0.7,
                            duration: iceBlockDur,
                            timer: iceBlockDur,
                            damagePerSec: 0,
                            lastTick: 0,
                            extras: {
                                damage: ab.damage,
                                sizeMultiplier: ab.sizeMultiplier || 1.0,
                                sourceId: ab.sourceId || source.id
                            }
                        });
                        
                        setTimeout(() => {
                            if (this.enemies.length === 0 && this.players.size === 0) return;
                            this.zones.push({
                                id: `zone_${this.zoneIdCounter++}`,
                                type: 'slippery_ice',
                                position: new Vec3(x, 0, z),
                                radius: cellSize * 0.7 * (ab.sizeMultiplier || 1.0),
                                duration: 9999999,
                                timer: 9999999,
                                damagePerSec: 0,
                                lastTick: 0
                            });
                        }, iceBlockDur);
                        
                    }, warningDur);
                }
                break;
            }
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
            let finalDamage = hit.damage;
            const proj = hit.projectileId ? this.enemyProjectiles.find(pr => pr.id === hit.projectileId) : null;
            const projectileOwner = proj?.ownerId ? this.enemies.find(en => en.id === proj.ownerId) || null : null;
            if (proj) {
                if (proj.ownerId) {
                    const owner = projectileOwner;
                    if (owner && ((owner as any).blindedTimer > 0 || owner.statusManager.hasStatus('blind'))) {
                        finalDamage = 0; // miss!
                    }
                }
            }
            if (hit.specialEffect === 'mighty_one_projectile') {
                finalDamage = 500 * p.level + p.maxHp * 0.03;
                if (Math.random() < 0.005) {
                    finalDamage = p.maxHp * 2;
                    this.pendingEvents.push({ event: 'MESSAGE', data: { message: `☠️ O Poderoso desferiu MORTE INSTANTÂNEA em ${p.name}! ☠️` } });
                }
            }
            if (hit.specialEffect === 'esporo_basico') {
                finalDamage = 0;
            }
            if (hit.specialEffect === 'tower_ballistic_heavy') {
                finalDamage = this.capTowerDamage(p, finalDamage, (proj as any)?.params?.damageCapPercent || 0.18);
            }
            if (proj) {
                const wall = this.zones.find(z => (z.type === 'predator_front_wall' || z.type === 'predator_living_wall') && z.position.distanceToXZ(proj.position) <= z.radius);
                if (wall) finalDamage *= 0.60;
            }
            this.damagePlayer(p, finalDamage, projectileOwner, hit.specialEffect || proj?.type || 'Projetil inimigo', true);
            // HIT_NUMBER feedback for the local player
            const hitNow = Date.now();
            const pThrottle = this.hitNumberThrottle.get(p.id) || 0;
            if (hitNow - pThrottle > 150) {
                this.hitNumberThrottle.set(p.id, hitNow);
                const isShieldHit = p.skills.e.isActive && p.skills.e.shieldHp > 0;
                this.pendingEvents.push({
                    event: 'HIT_NUMBER',
                    data: {
                        targetId: p.id,
                        x: p.position.x,
                        y: 2.0,
                        z: p.position.z,
                        value: p.lastDamageTaken,
                        type: isShieldHit ? 'SHIELD' : 'NORMAL'
                    }
                });
            }
            if (hit.specialEffect === 'freeze') p.applyFreeze(2000);
            if (hit.specialEffect === 'freezingCone') { p.statusEffects.freezingConeHits.count++; p.statusEffects.freezingConeHits.timer = 3000; if (p.statusEffects.freezingConeHits.count >= 3) { p.applyFreeze(2000); p.statusEffects.freezingConeHits.count = 0; } }
            if (hit.specialEffect === 'bleed') p.applyBleed(5000, 5);
            if (hit.specialEffect === 'prisao') p.applyRoot(2000);
            if (hit.specialEffect === 'tiroIncendiario') p.applyBurn(3000, 10);
            if (hit.specialEffect === 'lançaGelo') p.applyFreeze(1500);
            if (hit.specialEffect === 'limbo_poison') p.statusManager.applyStatus('poison', 5000, 0, null);
            if (hit.specialEffect === 'limbo_poison_chance' && Math.random() < 0.20) p.statusManager.applyStatus('poison', 3000, 0, null);
            if (hit.specialEffect === 'limbo_burn') p.applyBurn(4000, 8);
            if (hit.specialEffect === 'limbo_ice_slow') p.applySlow(3000, 0.30);
            if (hit.specialEffect === 'tower_ballistic' || hit.specialEffect === 'tower_ballistic_heavy') {
                const params = (proj as any)?.params || {};
                if ((params.slowChance || 0) > 0 && Math.random() < params.slowChance) {
                    p.applySlow(params.slowDuration || 1000, params.slowAmount || 0.20);
                }
            }
            if (hit.specialEffect === 'prismaSombrio') {
                const c = CONFIG.CAO_DOS_INFERNOS;
                if (p.statusEffects.bleeding && p.statusEffects.bleeding.isActive) {
                    const extraDmg = finalDamage * (c.SKILL_Q_BONUS_DAMAGE_ON_BLEED - 1);
                    this.damagePlayer(p, extraDmg, projectileOwner, 'prismaSombrio - sangramento', true);
                    const bossId = proj ? proj.ownerId : null;
                    const boss = bossId ? this.enemies.find(e => e.id === bossId) : null;
                    if (boss) {
                        const healAmount = boss.maxHp * c.SKILL_Q_LIFESTEAL_PERCENT;
                        boss.hp = Math.min(boss.maxHp, boss.hp + healAmount);
                    }
                }
                p.applyBleed(c.SKILL_Q_BLEED_DURATION, c.SKILL_Q_BLEED_DPS);
            }
            if (hit.specialEffect === 'injecao_geometrica') {
                const params = (proj as any)?.params || {};
                const ownerLimits = (projectileOwner as any)?.getPathogenLimits?.();
                const PATHOGENS = [
                    'febre_critica',
                    'paralisia_parcial',
                    'mao_tremula',
                    'imunidade_baixa',
                    'visao_turva',
                    'cansaco_viral',
                    'incapacidade',
                    'hemorragia_quadrada'
                ];
                const randKey = PATHOGENS[Math.floor(Math.random() * PATHOGENS.length)];
                p.applyPathogen(randKey, 10000, {
                    maxStacks: params.maxStacks ?? ownerLimits?.maxStacks,
                    maxTypes: params.maxTypes ?? ownerLimits?.maxTypes
                });
            }
        }
        // Player projectiles vs enemies
        const enemyHits = this.collisionSystem.checkProjectileVsEnemies(this.playerProjectiles, this.enemies);
        for (const hit of enemyHits) {
            const enemy = this.enemies.find(e => e.id === hit.enemyId);
            const instigator = this.players.get(hit.instigatorId);
            if (!enemy || !instigator) continue;

            const proj = this.playerProjectiles.find(p => p.id === hit.projectileId);
            let totalDamage = hit.damage;
            if (instigator.activeBuff.type === 'guerreiro' && enemy.maxHp) {
                totalDamage += enemy.maxHp * 0.03;
            }
            if (proj && proj.isBuffed === 'arqueiro' && enemy.maxHp) {
                totalDamage += enemy.maxHp * 0.03 * 2;
            }

            if (instigator.timedBuffs.some(b => b.type === 'alma_de_arthas')) {
                totalDamage += Math.round(totalDamage * 0.30);
            }

            enemy.takeDamage(totalDamage, instigator, true, 0, false, this.projectileDamageMeta(instigator, proj));

            if (proj?.specialEffect === 'erg_base_slime') {
                const slime = (proj as any).ergBaseSlime || {};
                if (Math.random() < (slime.woundChance || 0)) {
                    enemy.applyHiveWound(instigator, 5000, 1);
                }
                if (slime.heavy && !this.isBossLike(enemy)) enemy.applySlow(1000, 0.20);
                if ((slime.splashRadius || 0) > 0) {
                    const splashDamage = enemy.lastDamageTaken * (slime.splashDamagePct || 0.35);
                    for (const otherEnemy of this.enemies) {
                        if (otherEnemy.isDestroyed || otherEnemy.id === enemy.id) continue;
                        if (otherEnemy.position.distanceToXZ(enemy.position) <= slime.splashRadius) {
                            otherEnemy.takeDamage(splashDamage, instigator, false, 0, false, this.essenceDamageMeta(instigator, 'erg_base_slime_splash', 'Gosma da Colmeia', 0, { isEssenceTower: true }));
                        }
                    }
                }
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'erg_base_slime_hit',
                    position: enemy.position.clone(),
                    radius: slime.splashRadius || 1,
                    duration: 450,
                    timer: 450,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: instigator.id }
                });
                proj.isDestroyed = true;
                continue;
            }

            if (proj?.isCritical && instigator.build?.buildingColor === 'coin') {
                const critHeal = instigator.consumeCoinCritHeal();
                if (critHeal > 0) {
                    this.pendingEvents.push({
                        event: 'HIT_NUMBER',
                        data: {
                            targetId: instigator.id,
                            x: instigator.position.x,
                            y: 2.0,
                            z: instigator.position.z,
                            value: critHeal,
                            type: 'HEAL'
                        }
                    });
                }
            }

            if (instigator.timedBuffs.some(b => b.type === 'alma_de_arthas')) {
                const lifestealHeal = Math.round(enemy.lastDamageTaken * 0.05);
                if (lifestealHeal > 0) {
                    instigator.heal(lifestealHeal);
                }
                enemy.applySlow(1500, 0.30);
            }

            // --- Essence Towers passive hit effects ---
            if (proj) {
                const isBasicAttack = !proj.specialEffect || proj.specialEffect === 'raio_peste_proj';
                if (isBasicAttack && instigator.build && instigator.build.buildingColor === 'poison') {
                    // Tiro Tóxico or Twitch laser applies poison stack
                    if (instigator.build.floor1 === 2 || proj.specialEffect === 'raio_peste_proj') {
                        enemy.addPoison(1, instigator);
                    }
                    // Presas Gêmeas (heal 2% max HP on 3+ stacks targets)
                    if (instigator.build.floor2 === 1 && enemy.poisonStacks >= 3) {
                        instigator.heal(instigator.maxHp * 0.02);
                        const hThrottle = this.hitNumberThrottle.get(`heal_${instigator.id}`) || 0;
                        if (now - hThrottle > 150) {
                            this.hitNumberThrottle.set(`heal_${instigator.id}`, now);
                            this.pendingEvents.push({
                                event: 'HIT_NUMBER',
                                data: {
                                    targetId: instigator.id,
                                    x: instigator.position.x,
                                    y: 2.0,
                                    z: instigator.position.z,
                                    value: Math.round(instigator.maxHp * 0.02),
                                    type: 'HEAL'
                                }
                            });
                        }
                    }
                    // Dardo Cegante (10% chance to blind for 2s)
                    if (instigator.build.floor2 === 2 && Math.random() < 0.10) {
                        enemy.statusManager.applyStatus('blind', 2000);

                    }
                }

                if (proj.specialEffect === 'frasco_peconha') {
                    const explosionRadius = 3.5;
                    const explosionDmg = instigator.getDamage(true) * 1.5;
                    for (const otherEnemy of this.enemies) {
                        if (!otherEnemy.isDestroyed && otherEnemy.position.distanceToXZ(proj.position) < explosionRadius) {
                            otherEnemy.addPoison(2, instigator);
                            otherEnemy.takeDamage(explosionDmg, instigator, false, 0, false, this.essenceDamageMeta(instigator, 'poison_frasco_peconha', 'Frasco de Peconha', 5));
                        }
                    }
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'explosion',
                        position: proj.position.clone(),
                        radius: explosionRadius,
                        duration: 400,
                        timer: 400,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { sourceId: instigator.id, burst: true }
                    });
                    proj.isDestroyed = true;
                }

                // If it's a basic attack
                if (!proj.specialEffect) {
                    if (instigator.build?.buildingColor === 'predator_hive') {
                        const alwaysApply = instigator.predatorHiveUltAscensionActive;
                        const ultApply = instigator.skills.r.isActive && instigator.predatorHiveUltMode === 'basic' && Math.random() < 0.30;
                        const clawApply = instigator.predatorHiveClaws && Math.random() < 0.18;
                        if (alwaysApply || ultApply || clawApply) {
                            enemy.applyHiveWound(instigator, 5000, 1);
                            const stacks = enemy.getHiveWoundStacks(instigator.id);
                            const isBossLike = enemy.maxHp >= 5000 || String(enemy.type || '').toLowerCase().includes('boss');
                            if (instigator.predatorHiveEvolution && stacks >= 3 && !isBossLike && !(enemy as any).__ergAuraSpawned) {
                                (enemy as any).__ergAuraSpawned = true;
                                this.zones.push({
                                    id: `zone_${this.zoneIdCounter++}`,
                                    type: 'erg_contamination_aura',
                                    position: enemy.position.clone(),
                                    radius: 4,
                                    duration: 4000,
                                    timer: 4000,
                                    damagePerSec: 0,
                                    lastTick: 0,
                                    extras: { sourceId: instigator.id, spreadHiveWound: true }
                                });
                            }
                        }
                        if (instigator.predatorErgCall) {
                            if (instigator.predatorErgAttackWindow <= 0) {
                                instigator.predatorErgAttackCounter = 0;
                                instigator.predatorErgAttackWindow = 6000;
                            }
                            instigator.predatorErgAttackCounter++;
                            if (instigator.predatorErgAttackCounter >= 5 && instigator.predatorErgPulseCooldown <= 0) {
                                instigator.predatorErgAttackCounter = 0;
                                instigator.predatorErgAttackWindow = 0;
                                instigator.predatorErgPulseCooldown = 10000;
                                instigator.pendingZones.push({
                                    type: 'erg_call_pulse',
                                    x: instigator.position.x,
                                    z: instigator.position.z,
                                    radius: 6,
                                    damage: instigator.getDamage(true, true) * 0.75,
                                    extras: { sourceId: instigator.id, applyHiveWoundChance: true }
                                });
                            }
                        }
                        this.tryFireErgBaseSlime(instigator, enemy);
                    }
                    // Lifesteal
                    if (instigator.lifestealPct > 0) {
                        const healAmt = Math.round(enemy.lastDamageTaken * instigator.lifestealPct);
                        if (healAmt > 0) {
                            instigator.heal(healAmt);
                            const hThrottle = this.hitNumberThrottle.get(`heal_${instigator.id}`) || 0;
                            if (now - hThrottle > 150) {
                                this.hitNumberThrottle.set(`heal_${instigator.id}`, now);
                                this.pendingEvents.push({
                                    event: 'HIT_NUMBER',
                                    data: {
                                        targetId: instigator.id,
                                        x: instigator.position.x,
                                        y: 2.0,
                                        z: instigator.position.z,
                                        value: healAmt,
                                        type: 'LIFESTEAL'
                                    }
                                });
                            }
                        }
                    }
                    if (instigator.getCoinLifestealPct() > 0) {
                        const healAmt = instigator.consumeCoinLifesteal(enemy.lastDamageTaken);
                        if (healAmt > 0) {
                            const hThrottle = this.hitNumberThrottle.get(`coin_heal_${instigator.id}`) || 0;
                            if (now - hThrottle > 150) {
                                this.hitNumberThrottle.set(`coin_heal_${instigator.id}`, now);
                                this.pendingEvents.push({
                                    event: 'HIT_NUMBER',
                                    data: {
                                        targetId: instigator.id,
                                        x: instigator.position.x,
                                        y: 2.0,
                                        z: instigator.position.z,
                                        value: healAmt,
                                        type: 'LIFESTEAL'
                                    }
                                });
                            }
                        }
                    }
                    // Cleave
                    if (instigator.attackCleave) {
                        for (const otherEnemy of this.enemies) {
                            if (!otherEnemy.isDestroyed && otherEnemy.id !== enemy.id) {
                                if (enemy.position.distanceToXZ(otherEnemy.position) < 4.0) {
                                    otherEnemy.takeDamage(totalDamage * 0.5, instigator, false, 0, false, this.essenceDamageMeta(instigator, 'red_attack_cleave', 'Torre Vermelha Cleave', 3));
                                    // Hit number feedback for cleave damage
                                    const eHitNow = Date.now();
                                    const eThrottle = this.hitNumberThrottle.get(otherEnemy.id) || 0;
                                    if (eHitNow - eThrottle > 150) {
                                        this.hitNumberThrottle.set(otherEnemy.id, eHitNow);
                                        const isBoss = ['LichKing','TheMightyOne','Gangplank','RainhaDasTrevas',
                                            'PlantaCarnivora','FeiticeiroImortal','SuperBoss','CaoDosInfernos','Farao',
                                            'GuardiãoDoLimbo','Minos','Cerbero','Plutão','Fúria','Megera','Minotauro',
                                            'Geriao','Lúcifer','EspectroDeRaziel','Smith'].includes(otherEnemy.type);
                                        const isCrit = proj ? proj.isCritical : false;
                                        this.pendingEvents.push({
                                            event: 'HIT_NUMBER',
                                            data: {
                                                targetId: otherEnemy.id,
                                                x: otherEnemy.position.x,
                                                y: isBoss ? 3.5 : 1.5,
                                                z: otherEnemy.position.z,
                                                value: otherEnemy.lastDamageTaken,
                                                type: isCrit ? 'CRIT' : 'NORMAL'
                                            }
                                        });
                                    }
                                    if (otherEnemy.isDestroyed) this.onEnemyKilled(otherEnemy, instigator);
                                }
                            }
                        }
                    }
                    // 4th hit explosion
                    if (instigator.fourthHitExplodes) {
                        instigator.consecutiveHitCount++;
                        if (instigator.consecutiveHitCount >= 4) {
                            instigator.consecutiveHitCount = 0;
                            instigator.pendingZones.push({
                                type: 'explosion',
                                x: enemy.position.x,
                                z: enemy.position.z,
                                radius: 5,
                                damage: instigator.getDamage(true) * 1.5
                            });
                        }
                    }
                } else {
                    // Spell Vamp (abilities)
                    if (instigator.spellVampPct > 0) {
                        const healAmt = Math.round(enemy.lastDamageTaken * instigator.spellVampPct);
                        if (healAmt > 0) {
                            instigator.heal(healAmt);
                            const hThrottle = this.hitNumberThrottle.get(`heal_${instigator.id}`) || 0;
                            if (now - hThrottle > 150) {
                                this.hitNumberThrottle.set(`heal_${instigator.id}`, now);
                                this.pendingEvents.push({
                                    event: 'HIT_NUMBER',
                                    data: {
                                        targetId: instigator.id,
                                        x: instigator.position.x,
                                        y: 2.0,
                                        z: instigator.position.z,
                                        value: healAmt,
                                        type: 'SPELLVAMP'
                                    }
                                });
                            }
                        }
                    }
                }
            }

            // Purple F3-3: Orbes extras no hit (15% chance on any hit)
            if (instigator.extraOrbsOnHit && Math.random() < 0.15) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 2 + 1;
                const orbPos = enemy.position.clone().add(new Vec3(Math.cos(angle) * dist, 0.5, Math.sin(angle) * dist));
                this.orbs.push({
                    id: `orb_${this.orbIdCounter++}`,
                    type: 'xp',
                    position: orbPos,
                    hitboxRadius: CONFIG.XP_ORB.HITBOX_RADIUS
                });
            }

            // Red F3-1: Dano escala com hits
            if (instigator.damageEscalasConsecutivas > 0) {
                instigator.consecutiveHitsTime = Date.now();
                instigator.consecutiveHitsMultiplier = Math.min(1.20, instigator.consecutiveHitsMultiplier + 0.02);
            }

            // Purple F3-2: Ataques dão Slow (3s, 50% slow)
            if (instigator.slowOnAttack) {
                enemy.applySlow(3000, 0.5);
            }
            // HIT_NUMBER feedback for enemy damage
            const eHitNow = Date.now();
            const eThrottle = this.hitNumberThrottle.get(enemy.id) || 0;
            if (eHitNow - eThrottle > 150) {
                this.hitNumberThrottle.set(enemy.id, eHitNow);
                const isBoss = ['LichKing','TheMightyOne','Gangplank','RainhaDasTrevas',
                    'PlantaCarnivora','FeiticeiroImortal','SuperBoss','CaoDosInfernos','Farao',
                    'GuardiãoDoLimbo','Minos','Cerbero','Plutão','Fúria','Megera','Minotauro',
                    'Geriao','Lúcifer','EspectroDeRaziel','Smith'].includes(enemy.type);
                const isCrit = proj ? proj.isCritical : false;
                this.pendingEvents.push({
                    event: 'HIT_NUMBER',
                    data: {
                        targetId: enemy.id,
                        x: enemy.position.x,
                        y: isBoss ? 3.5 : 1.5,
                        z: enemy.position.z,
                        value: enemy.lastDamageTaken,
                        type: isCrit ? 'CRIT' : 'NORMAL'
                    }
                });
            }
            if (hit.bleedDamage > 0) enemy.mark();

            
            // Handle special effects from upgrades
            if (hit.specialEffect === 'q_armorFracture') {
                enemy.applyArmorFracture(4000, 0.25);
            } else if (hit.specialEffect === 'q_dash_sphere') {
                const currentHits = (instigator.dashHitTracker.get(enemy.id) || 0) + 1;
                instigator.dashHitTracker.set(enemy.id, currentHits);
                if (currentHits >= 3) {
                    enemy.applySilence(2000);
                    instigator.applyTemporaryBuff('attack_speed', 3, 1.5);
                    // Clear so it doesn't trigger again for the same dash if more hit
                    instigator.dashHitTracker.set(enemy.id, -999);
                }
            }

            if (enemy.isDestroyed) this.onEnemyKilled(enemy, instigator);
        }
        // Player vs orbs
        const orbHits = this.collisionSystem.checkPlayerVsOrbs([...this.players.values()], this.orbs);
        for (const hit of orbHits) {
            const p = this.players.get(hit.playerId);
            const orb = this.orbs.find(o => o.id === hit.orbId);
            if (!p || !orb) continue;
            if (orb.type === 'xp') {
                p.collectOrb();
                this.spawnXpOrb();
            }
            else if (orb.type === 'buff' && orb.buffType) { p.applyTimedBuff(orb.buffType, (orb.buffDuration || 60000) / 1000, orb.buffEffects); }
            this.orbs = this.orbs.filter(o => o.id !== hit.orbId);
        }
    }

    private onEnemyKilled(enemy: ServerEnemy, killer: ServerEnemy | ServerPlayer | null): void {
        if (enemy.deathProcessed) return;
        enemy.deathProcessed = true;

        const killerPlayer = killer instanceof ServerPlayer ? killer : null;
        if (killerPlayer) {
            killerPlayer.addXp(enemy.xp);
            killerPlayer.score += enemy.score;
            killerPlayer.kills++;
            killerPlayer.onEnemyKilled(); // R upgrade: Fúria Infinita

            const coinKillHeal = killerPlayer.consumeCoinAllOrNothingKillHeal();
            if (coinKillHeal > 0) {
                this.pendingEvents.push({
                    event: 'HIT_NUMBER',
                    data: {
                        targetId: killerPlayer.id,
                        x: killerPlayer.position.x,
                        y: 2.0,
                        z: killerPlayer.position.z,
                        value: coinKillHeal,
                        type: 'HEAL'
                    }
                });
            }

            if (killerPlayer.build?.buildingColor === 'predator_hive' && enemy.hasHiveWound?.(killerPlayer.id)) {
                const isBossLike = enemy.maxHp >= 5000 || String(enemy.type || '').toLowerCase().includes('boss');
                const isEliteLike = !isBossLike && enemy.maxHp > 1000;
                if (killerPlayer.predatorMutantRegen && killerPlayer.predatorRegenCooldown <= 0) {
                    killerPlayer.predatorRegenCooldown = 1000;
                    const healPct = isBossLike ? 0.07 : (isEliteLike ? 0.04 : 0.02);
                    const healAmount = Math.round(killerPlayer.maxHp * healPct);
                    if (killerPlayer.skills.e.isActive && killerPlayer.skills.e.shieldHp > 0) {
                        killerPlayer.heal(healAmount * 0.5);
                        killerPlayer.skills.e.shieldHp = Math.min(killerPlayer.skills.e.maxShieldHp, killerPlayer.skills.e.shieldHp + healAmount * 0.5);
                    } else {
                        killerPlayer.heal(healAmount);
                    }
                    this.pendingEvents.push({ event: 'HIT_NUMBER', data: { targetId: killerPlayer.id, x: killerPlayer.position.x, y: 2.0, z: killerPlayer.position.z, value: healAmount, type: 'HEAL' } });
                }
                if (killerPlayer.predatorFragmentSwarm && Math.random() < 0.14) {
                    const targets = this.enemies
                        .filter(e => !e.isDestroyed && e.id !== enemy.id && e.position.distanceToXZ(enemy.position) <= 8)
                        .slice(0, 3);
                    for (const target of targets) {
                        const dmg = killerPlayer.getDamage(true, true) * 0.30 * (target.maxHp >= 5000 ? 0.50 : 1.0);
                        target.takeDamage(dmg, killerPlayer, false, 0, false, this.essenceDamageMeta(killerPlayer, 'erg_fragment_swarm', 'Enxame de Fragmentos', 3));
                        this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'erg_fragment', position: target.position.clone(), radius: 1.2, duration: 350, timer: 350, damagePerSec: 0, lastTick: 0, extras: { sourceId: killerPlayer.id, burst: false } });
                    }
                }
                if (killerPlayer.predatorHiveUltAscensionActive && enemy.getHiveWoundStacks?.(killerPlayer.id) >= 5) {
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'erg_ascension_deathburst',
                        position: enemy.position.clone(),
                        radius: 5,
                        duration: 500,
                        timer: 500,
                        damagePerSec: killerPlayer.getDamage(true, true) * 2.10,
                        lastTick: 0,
                        extras: { sourceId: killerPlayer.id, burst: true, applyHiveWoundChance: true }
                    });
                }
            }

            // Purple F4-1: Kill reseta cooldowns
            if (killerPlayer.killResetsCooldowns) {
                killerPlayer.skills.q.lastUsed = 0;
                killerPlayer.skills.w.lastUsed = 0;
                killerPlayer.skills.e.lastUsed = 0;
            }

            // In-Game Scaling: PurpleCube progression
            if (enemy.type === 'PurpleCube') {
                killerPlayer.purpleCubesKilled++;
                if (killerPlayer.purpleCubesKilled % 100 === 0) {
                    killerPlayer.upgradeLoadoutItems();
                }
            }
        }

        // --- Bruxa do Gelo Passive (Submissão Glacial adapted to Cubes) ---
        if (enemy.type === 'PurpleCube') {
            const bruxa = this.enemies.find(e => e.type === 'BruxaDoGelo' && !e.isDestroyed);
            if (bruxa && bruxa.position.distanceToXZ(enemy.position) < 15) {
                // Spawn an Escravo Glacial at the dead cube's position
                const escravo = new EscravoGlacialEnemy(enemy.position.clone(), 1);
                this.addEnemy(escravo, 'passive:EscravoGlacial');
            }
        }

        // Plague spread logic (and Epidemia Acida)
        if (enemy.statusManager.hasStatus('plague')) {
            const plagueIntensity = enemy.statusManager.getIntensity('plague') || 10;
            const instigator = enemy.statusManager.active.get('plague')?.instigator;
            let hasEpidemia = false;
            if (instigator && instigator.loadoutItems && instigator.loadoutItems.includes('epidemia_acida')) {
                hasEpidemia = true;
            }
            // Spread to nearby enemies
            for (const other of this.enemies) {
                if (!other.isDestroyed && other !== enemy && other.position.distanceToXZ(enemy.position) < 5.0) {
                    other.statusManager.applyStatus('plague', 6000, plagueIntensity, instigator);
                    if (hasEpidemia) {
                        other.statusManager.applyStatus('acid', 4000, plagueIntensity, instigator);
                        other.statusManager.applyStatus('acid', 4000, plagueIntensity, instigator); // Apply twice to get 2 stacks
                    }
                }
            }
        }

        // Legião do Flagelo: Ghoul death explosion and Ceifador de Almas heal
        if (enemy.type === 'Ghoul') {
            this.zones.push({
                id: `zone_${this.zoneIdCounter++}`,
                type: 'ghoul_acid_pool',
                position: enemy.position.clone(),
                radius: 2.0,
                duration: 3000,
                timer: 3000,
                damagePerSec: 150,
                lastTick: 0,
                extras: {}
            });
            const lich = this.enemies.find(e => e.type === 'LichKing' && !e.isDestroyed);
            if (lich) {
                lich.hp = Math.min(lich.maxHp, lich.hp + lich.maxHp * 0.05);
            }
        }
        // Notify Smith about clone destroyed (for lag effect)
        if (enemy.type === 'CloneSmith') {
            const smith = this.enemies.find(e => e.type === 'Smith' && !e.isDestroyed) as any;
            if (smith && smith.recordCloneDestroyed) {
                smith.recordCloneDestroyed();
            }
        }
        // Notify CaoDosInfernos about matilha minion destroyed
        if (enemy.type === 'MatilhaGeometra') {
            const parentId = (enemy as any).parentId;
            if (parentId) {
                const parent = this.enemies.find(e => e.id === parentId) as any;
                if (parent && parent.removeMatilha) {
                    parent.removeMatilha(enemy.id);
                }
            }
        }
        // Boss-specific drops
        const t = enemy.type;
        if (t === 'Gangplank') { this.spawnManager.isGangplankAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'sabre_pirata', { physical_damage: 0.10 }, 120); }
        if (t === 'RainhaDasTrevas') { this.spawnManager.isRainhaAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'rainha_buff', { attack_speed: 1.25, ability_damage: 1.15 }, 30); }
        if (t === 'PlantaCarnivora') { this.spawnManager.isPlantaCarnivoraAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'planta_buff', { lifesteal: 0.05, move_speed: 1.15, damage: 1.10 }, 45); }
        if (t === 'FeiticeiroImortal') { this.spawnManager.isFeiticeiroAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'essencia_negra', { magic_damage: 1.5, lifesteal: 0.03, cooldown_reduction: 0.15 }, 120); }
        if (t === 'LichKing') { this.spawnManager.isLichKingAlive = false; this.spawnManager.activeBoss = null; this.spawnItemDrop(enemy.position, 'alma_de_arthas', {}, 999999); }
        if (t === 'SuperBoss') { this.spawnManager.isSuperBossAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'TheMightyOne') {
            this.spawnManager.onMightyOneDefeated();
            this.recalculateThreatForLivingEnemies('mighty_one_defeated');
            this.pendingEvents.push({ event: 'MIGHTY_ONE_DEFEATED', data: {} });
            this.pendingEvents.push({ event: 'MESSAGE', data: { message: "🌀 O Poderoso caiu… mas algo no mundo mudou para sempre…" } });
        }
        // Novos bosses do Limbo - resetar flags ao morrer
        if (t === 'GuardiãoDoLimbo') { this.spawnManager.isGuardiãoDoLimboAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Minos') { this.spawnManager.isMinosAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Cerbero') { this.spawnManager.isCerberoAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Plutão') { this.spawnManager.isPlutaoAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Fúria') { this.spawnManager.isFuriaAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Megera') { this.spawnManager.isMegeraAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Minotauro') { this.spawnManager.isMinotauroAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Geriao') { this.spawnManager.isGeriaoAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'Lúcifer') { this.spawnManager.isLuciferAlive = false; this.spawnManager.activeBoss = null; }
        if (t === 'EspectroDeRaziel') {
            this.spawnManager.isEspectroDeRazielAlive = false;
            this.spawnManager.activeBoss = null;
            // Drop Essência Espectral de Raziel
            this.spawnItemDrop(enemy.position, 'essencia_espectral_raziel', {
                soul_orbital_damage_percent: 0.05,
                soul_orbital_damage_flat: 3, // will be multiplied by player level in Player.ts
                soul_orbital_count: 5,
                duration: 180, // 3 minutes
            }, 180);
        }
        if (t === 'Smith') {
            this.spawnManager.isSmithAlive = false;
            this.spawnManager.activeBoss = null;
            // Drop Fragmento de Código-Fonte - retrocede 30s de jogo mantendo XP
            this.spawnItemDrop(enemy.position, 'fragmento_codigo_fonte', {
                rewind_time_seconds: 30,
                duration: 300, // 5 minutes to use
            }, 300);
        }
        if (t === 'DoutorDoenca') {
            this.spawnManager.onDoutorDoencaDefeated();
        }
        // ======= O FARAÓ — Kill rewards =======
        if (t === 'Farao') {
            this.spawnManager.onFaraoDefeated();
            // Clean up all scarabs
            for (const e of this.enemies) {
                if (e.type === 'EscaravelhoFarao' && !e.isDestroyed) e.isDestroyed = true;
            }
            // Award 1,000,000 XP to all alive players
            for (const p of [...this.players.values()]) {
                if (!p.isDead) {
                    p.addXp(CONFIG.FARAO.XP);
                    p.score += CONFIG.FARAO.SCORE;
                    // Bênção do Faraó: buff de 45 segundos +50% HP Máximo e Velocidade
                    const hasBuff = p.timedBuffs.some(b => b.type === 'bencao_do_farao');
                    if (!hasBuff) {
                        p.maxHp *= 1.50;
                        p.hp = p.maxHp;
                        p.speed *= 1.50;
                        p.originalSpeed = p.speed;
                    }
                    p.applyTimedBuff('bencao_do_farao', 45, {
                        stat_multiplier: 1.50,
                    });
                }
            }
            this.pendingEvents.push({ event: 'BOSS_KILLED', data: { name: 'O Faraó', tier: 'Deus', xp: CONFIG.FARAO.XP } });
            this.pendingEvents.push({ event: 'MESSAGE', data: { message: `☀ O Faraó foi derrotado! Bênção do Faraó concedida! ☀` } });
        }
        // Notify Smith clones that Smith died
        if (enemy.type === 'Smith' && enemy instanceof SmithEnemy) {
            const smith = enemy as any;
            for (const cloneId of smith.cloneIds) {
                const clone = this.enemies.find(e => e.id === cloneId);
                if (clone && !clone.isDestroyed) {
                    clone.isDestroyed = true;
                }
            }
        }
        if (t === 'GuardianGuerreiro' && killerPlayer) killerPlayer.applyBuff('guerreiro');
        if (t === 'GuardianMago' && killerPlayer) killerPlayer.applyBuff('mago');
        if (t === 'GuardianArqueiro' && killerPlayer) killerPlayer.applyBuff('arqueiro');
        if (t === 'CaoDosInfernos') {
            this.spawnItemDrop(enemy.position, 'cao_dos_infernos_buff', { move_speed: 1.20, damage: 1.20 }, 60);
            if (Math.random() < 0.15) {
                this.spawnItemDrop(enemy.position, 'nucleo_da_matilha', { familiar: true }, 180);
            }
        }

        // Poison Tower Death Passives
        const poisonInstigator = enemy.poisonInstigator instanceof ServerPlayer ? enemy.poisonInstigator : null;
        const pSource = killerPlayer || poisonInstigator;
        if (pSource && pSource.build && pSource.build.buildingColor === 'poison') {
            // Miasma Menor (Floor 3 Option 1 -> floor3 === 0)
            if (pSource.build.floor3 === 0) {
                this.zones.push({
                    id: `zone_${this.zoneIdCounter++}`,
                    type: 'poison_puddle',
                    position: enemy.position.clone(),
                    radius: 1.0,
                    duration: 6000,
                    timer: 6000,
                    damagePerSec: 0,
                    lastTick: 0,
                    extras: { sourceId: pSource.id, isMini: true, maxRadius: 2.5 }
                });
            }
            // Espalhar a Peste (Floor 4 Option 3 -> floor4 === 2)
            if (pSource.build.floor4 === 2 && enemy.poisonStacks > 0) {
                const transferRadius = 5.0;
                for (const otherEnemy of this.enemies) {
                    if (!otherEnemy.isDestroyed && otherEnemy.id !== enemy.id) {
                        if (enemy.position.distanceToXZ(otherEnemy.position) < transferRadius) {
                            otherEnemy.addPoison(enemy.poisonStacks, pSource);
                        }
                    }
                }
            }
        }

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

            // Poison Puddle (Evasão Tóxica / Miasma Menor)
            if (z.type === 'poison_puddle') {
                const duration = z.duration;
                const elapsed = duration - z.timer;
                const progress = elapsed / duration;
                
                const startR = z.extras?.isMini ? 1.0 : 2.0;
                const maxR = z.extras?.maxRadius || (z.extras?.isMini ? 2.5 : 5.0);
                z.radius = startR + (maxR - startR) * progress;
                
                if (Date.now() > z.lastTick + 1000) {
                    z.lastTick = Date.now();
                    const p = this.players.get(z.extras?.sourceId);
                    for (const e of this.enemies) {
                        if (!e.isDestroyed && e.position.distanceToXZ(z.position) < z.radius) {
                            e.addPoison(1, p || null);
                        }
                    }
                }
            }

            // Armadilha Cúbica
            if (z.type === 'cubic_trap') {
                for (const e of this.enemies) {
                    if (!e.isDestroyed && z.position.distanceToXZ(e.position) < z.radius) {
                        const p = this.players.get(z.extras?.sourceId);
                        if (p) {
                            const explosionRadius = 3.5;
                            for (const otherEnemy of this.enemies) {
                                if (!otherEnemy.isDestroyed && otherEnemy.position.distanceToXZ(z.position) < explosionRadius) {
                                    otherEnemy.addPoison(2, p);
                                    otherEnemy.takeDamage(p.getDamage(true) * 0.5, p, false, 0, false, this.essenceDamageMeta(p, 'poison_cubic_trap', 'Armadilha Cubica', 4));
                                }
                            }
                            this.zones.push({
                                id: `zone_${this.zoneIdCounter++}`,
                                type: 'explosion',
                                position: z.position.clone(),
                                radius: explosionRadius,
                                duration: 400,
                                timer: 400,
                                damagePerSec: 0,
                                lastTick: 0,
                                extras: { sourceId: p.id, burst: true }
                            });
                        }
                        z.timer = 0; // explode and trigger cleanup
                        break;
                    }
                }
            }

            // Teemo Shroom (Campo de Fungos)
            if (z.type === 'teemo_shroom') {
                for (const e of this.enemies) {
                    if (!e.isDestroyed && z.position.distanceToXZ(e.position) < z.radius) {
                        const p = this.players.get(z.extras?.sourceId);
                        if (p) {
                            const explosionRadius = 4.0;
                            const level = p.level;
                            const explosionDmg = (15 + level * 5) * 5;
                            for (const otherEnemy of this.enemies) {
                                if (!otherEnemy.isDestroyed && otherEnemy.position.distanceToXZ(z.position) < explosionRadius) {
                                    otherEnemy.addPoison(5, p);
                                    otherEnemy.applySlow(4000, 0.2); // 80% slow
                                    otherEnemy.takeDamage(explosionDmg, p, false, 0, false, this.essenceDamageMeta(p, 'poison_teemo_shroom', 'Campo de Fungos', 5));
                                }
                            }
                            this.zones.push({
                                id: `zone_${this.zoneIdCounter++}`,
                                type: 'explosion',
                                position: z.position.clone(),
                                radius: explosionRadius,
                                duration: 400,
                                timer: 400,
                                damagePerSec: 0,
                                lastTick: 0,
                                extras: { sourceId: p.id, burst: true }
                            });
                        }
                        z.timer = 0; // explode and trigger cleanup
                        break;
                    }
                }
            }

            if (z.type === 'defile') {
                let playerInside = false;
                const dps = z.extras?.damage || 120;
                const zoneSource = this.getZoneSource(z);
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                        playerInside = true;
                        this.damagePlayer(p, dps * dt, zoneSource, z.type, false, false, undefined, true);
                    }
                }
                if (playerInside) {
                    z.radius += z.radius * 0.20 * dt;
                    if (!z.extras) z.extras = {};
                    z.extras.growthTime = (z.extras.growthTime || 0) + dt;
                    if (z.extras.growthTime - (z.extras.lastGhoulSpawn || 0) >= 4.0) {
                        z.extras.lastGhoulSpawn = z.extras.growthTime;
                        for (let k = 0; k < 2; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            const rx = z.position.x + Math.cos(angle) * z.radius;
                            const rz = z.position.z + Math.sin(angle) * z.radius;
                            const ghoul = new GhoulEnemy(new Vec3(rx, 0.4, rz), dps * 0.5, 1);
                            this.addEnemy(ghoul, 'zone:defile');
                        }
                    }
                }
            }

            if (z.type === 'icecrown_wave') {
                const zoneSource = this.getZoneSource(z);
                const maxR = z.extras?.maxRadius || 25.0;
                const duration = z.duration;
                const elapsed = duration - z.timer;
                const progress = elapsed / duration;
                
                const startR = 3.0;
                z.radius = startR + (maxR - startR) * progress;
                
                const dmg = z.extras?.damage || 200;
                const hitThickness = 1.0;
                
                if (!z.extras.hitPlayers) z.extras.hitPlayers = [];
                
                for (const p of players) {
                    if (p.isDead || z.extras.hitPlayers.includes(p.id)) continue;
                    const dist = p.position.distanceToXZ(z.position);
                    if (Math.abs(dist - z.radius) <= hitThickness) {
                        if (p.jumpTimer > 0) continue;
                        this.damagePlayer(p, dmg, zoneSource, z.type);
                        p.applySilence(1500);
                        z.extras.hitPlayers.push(p.id);
                    }
                }
            }

            if (z.type === 'sindragosa_ice_block') {
                const zoneSource = this.getZoneSource(z);
                if (z.timer <= 0) {
                    for (const p of players) {
                        if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                            this.damagePlayer(p, p.maxHp * 10.0, zoneSource, z.type);
                        }
                    }
                }
            }

            // Singularity pull / damage / final explosion
            if (z.type === 'singularidade_zone') {
                for (const e of this.enemies) {
                    if (!e.isDestroyed) {
                        const dist = z.position.distanceToXZ(e.position);
                        if (dist < z.radius) {
                            const pullDir = z.position.clone().sub(e.position);
                            pullDir.y = 0;
                            const len = pullDir.length();
                            if (len > 0.1) {
                                pullDir.normalize();
                                e.position.add(pullDir.multiplyScalar(6 * dt));
                            }
                            const p = this.players.get(z.extras?.sourceId);
                            e.takeDamage(z.damagePerSec * dt, p || null, false, 0, false, p ? this.essenceDamageMeta(p, 'purple_singularidade', 'Singularidade', 5, { isDoT: true }) : undefined);
                        }
                    }
                }
                
                if (z.timer <= 0) {
                    const p = this.players.get(z.extras?.sourceId);
                    if (p) {
                        this.zones.push({
                            id: `zone_${this.zoneIdCounter++}`,
                            type: 'explosion',
                            position: z.position.clone(),
                            radius: z.radius,
                            duration: 500,
                            timer: 500,
                            damagePerSec: p.getDamage(true) * 2.0,
                            lastTick: 0,
                            extras: { sourceId: p.id, burst: true }
                        });
                    }
                }
            }

            // Time Distortion zone slow
            if (z.type === 'distorcao_temporal_zone') {
                for (const e of this.enemies) {
                    if (!e.isDestroyed && z.position.distanceToXZ(e.position) < z.radius) {
                        e.applySlow(500, 0.2); // 80% slow
                    }
                }
            }

            if (z.type.startsWith('limbo_zone_')) {
                const zoneSource = this.getZoneSource(z);
                if (!z.extras) z.extras = {};
                z.lastTick = Date.now();
                const now = Date.now();
                const canApplyStatus = now > (z.extras.statusTick || 0) + 500;
                if (canApplyStatus) z.extras.statusTick = now;
                for (const p of players) {
                    if (p.isDead || p.position.distanceToXZ(z.position) > z.radius) continue;
                    if (z.damagePerSec > 0) {
                        this.damagePlayer(p, z.damagePerSec * dt, zoneSource, z.type, false, false, undefined, true);
                    }
                    if (canApplyStatus) {
                        this.applyLimboStatus(p, z.extras.status, z.extras.statusDuration, z.extras.statusIntensity);
                    }
                    this.applyLimboForce(p, z.position, z.extras.pullForce, true);
                    this.applyLimboForce(p, z.position, z.extras.knockbackForce, false);
                }
            }

            if (z.type === 'tower_gravity_residue') {
                const zoneSource = this.getZoneSource(z);
                for (const p of players) {
                    if (p.isDead || p.position.distanceToXZ(z.position) > z.radius) continue;
                    this.damagePlayer(p, z.damagePerSec * dt, zoneSource, z.type, false, false, undefined, true);
                    p.applySlow(500, 0.20);
                }
            }

            if (z.timer <= 0) {
                if (z.type === 'satchel_charge') {
                    const zoneSource = this.getZoneSource(z);
                    for (const p of players) {
                        if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                            this.damagePlayer(p, z.damagePerSec, zoneSource, z.type, false, false, 'trap');
                            const dir = p.position.clone().sub(z.position); dir.y = 0;
                            if (dir.lengthSq() > 0.01) p.applyKnockback(dir.normalize(), z.extras?.knockbackForce || 18);
                        }
                    }
                    const boss = this.enemies.find(e => e.id === z.extras?.sourceId);
                    if (boss && !boss.isDestroyed && boss.position.distanceToXZ(z.position) < z.radius) {
                        const dir = boss.position.clone().sub(z.position); dir.y = 0;
                        if (dir.lengthSq() > 0.01) boss.applyKnockback(dir.normalize(), z.extras?.knockbackForce || 18);
                    }
                }
                if (z.type === 'mega_inferno_warning') {
                    const zoneSource = this.getZoneSource(z);
                    this.zones.push({ id: `zone_${this.zoneIdCounter++}`, type: 'mega_inferno_explosion', position: z.position.clone(), radius: z.radius, duration: 500, timer: 500, damagePerSec: z.damagePerSec, lastTick: 0, extras: z.extras });
                    for (const p of players) {
                        if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                            this.damagePlayer(p, z.damagePerSec, zoneSource, z.type);
                        }
                    }
                }
                this.zones.splice(i, 1);
                continue;
            }

            // Handle mine explosion (Q upgrade)
            if (z.type === 'mine') {
                for (const e of this.enemies) {
                    if (!e.isDestroyed && z.position.distanceToXZ(e.position) < z.radius) {
                        const p = this.players.get(z.extras?.sourceId);
                        if (p) {
                            e.takeDamage(z.damagePerSec, p, false, 0, false, this.skillDamageMeta(p, 'q', 'Mina Dimensional'));
                            e.applyBleed(3000, p.getDamage(true) * 0.1);
                        }
                        z.timer = 0; // explode
                        break;
                    }
                }
            }

            // Handle hexplosive_mine
            if (z.type === 'hexplosive_mine') {
                const zoneSource = this.getZoneSource(z);
                for (const p of players) {
                    if (!p.isDead && z.position.distanceToXZ(p.position) < z.radius) {
                        this.damagePlayer(p, z.damagePerSec, zoneSource, z.type, false, false, 'trap');
                        z.timer = 0; // trigger removal
                        break;
                    }
                }
            }

            if (z.type === 'nuvem_esporos') {
                const zoneSource = this.getZoneSource(z);
                if (!z.extras) z.extras = {};
                if (z.extras.pathogenTimer === undefined) {
                    z.extras.pathogenTimer = 0;
                }
                z.extras.pathogenTimer -= dt * 1000;
                let attemptPathogen = false;
                if (z.extras.pathogenTimer <= 0) {
                    z.extras.pathogenTimer = 1500; // 1.5 seconds
                    attemptPathogen = true;
                }
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                        this.damagePlayer(p, z.damagePerSec * dt, zoneSource, z.type, false, false, undefined, true);
                        if (attemptPathogen && Math.random() < (z.extras.pathogenChance ?? 0.35)) {
                            const PATHOGENS = [
                                'febre_critica',
                                'paralisia_parcial',
                                'mao_tremula',
                                'imunidade_baixa',
                                'visao_turva',
                                'cansaco_viral',
                                'incapacidade',
                                'hemorragia_quadrada'
                            ];
                            const randKey = PATHOGENS[Math.floor(Math.random() * PATHOGENS.length)];
                            p.applyPathogen(randKey, 10000, {
                                maxStacks: z.extras.maxDiseaseStacks,
                                maxTypes: z.extras.maxDiseaseTypes
                            });
                        }
                    }
                }
            }

            if (z.type === 'incubadora_viral') {
                const zoneSource = this.getZoneSource(z);
                if (!z.extras) z.extras = {};
                if (z.extras.pathogenTimer === undefined) z.extras.pathogenTimer = 0;
                z.extras.pathogenTimer -= dt * 1000;
                const attemptPathogen = z.extras.pathogenTimer <= 0;
                if (attemptPathogen) z.extras.pathogenTimer = 1000;
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                        this.damagePlayer(p, z.damagePerSec * dt, zoneSource, z.type, false, false, undefined, true);
                        if (attemptPathogen && Math.random() < 0.50) {
                            const PATHOGENS = [
                                'febre_critica',
                                'paralisia_parcial',
                                'mao_tremula',
                                'imunidade_baixa',
                                'visao_turva',
                                'cansaco_viral',
                                'incapacidade',
                                'hemorragia_quadrada'
                            ];
                            const randKey = PATHOGENS[Math.floor(Math.random() * PATHOGENS.length)];
                            p.applyPathogen(randKey, 10000, {
                                maxStacks: z.extras.maxDiseaseStacks,
                                maxTypes: z.extras.maxDiseaseTypes
                            });
                        }
                    }
                }
            }

            if (z.extras?.applyHiveWound && !z.extras.appliedHiveWound) {
                z.extras.appliedHiveWound = true;
                const p = this.players.get(z.extras.sourceId);
                if (p) {
                    for (const e of this.enemies) {
                        if (!e.isDestroyed && z.position.distanceToXZ(e.position) <= z.radius) {
                            e.applyHiveWound(p, 5000, 1);
                        }
                    }
                }
            }

            if ((z.type === 'predator_bastion_guard' || z.type === 'predator_living_wall' || z.type === 'predator_front_wall') && Date.now() > z.lastTick + 1000) {
                z.lastTick = Date.now();
                const p = this.players.get(z.extras?.sourceId);
                for (const e of this.enemies) {
                    if (e.isDestroyed || z.position.distanceToXZ(e.position) > z.radius) continue;
                    const isBossLike = e.maxHp >= 5000 || String(e.type || '').toLowerCase().includes('boss');
                    if (z.type === 'predator_bastion_guard') {
                        if (Math.random() < 0.20) e.applySlow(isBossLike ? 1000 : 2000, isBossLike ? 0.15 : 0.30);
                    } else if (z.type === 'predator_living_wall') {
                        if (isBossLike) e.applySlow(1000, 0.20);
                        else e.statusManager.applyStatus('root', e.maxHp > 1000 ? 600 : 1200);
                    } else {
                        if (isBossLike) e.applySlow(1000, 0.20);
                        else e.statusManager.applyStatus('root', e.maxHp > 1000 ? 600 : 1200);
                    }
                }
                if (p && z.type === 'predator_living_wall') z.position = p.position.clone();
            }

            if (z.extras?.spreadHiveWound && Date.now() > z.lastTick + 1000) {
                z.lastTick = Date.now();
                const p = this.players.get(z.extras.sourceId);
                if (p) {
                    for (const e of this.enemies) {
                        if (!e.isDestroyed && z.position.distanceToXZ(e.position) <= z.radius && Math.random() < 0.12) {
                            e.applyHiveWound(p, 5000, 1);
                        }
                    }
                }
            }

            if (z.extras?.burst && z.lastTick === 0) {
                z.lastTick = 1;
                // Burst damage from player zones (Shield explosion, dash explosion, R singularity)
                let coinBurstHits = 0;
                for (const e of this.enemies) {
                    if (!e.isDestroyed && z.position.distanceToXZ(e.position) < z.radius) {
                        const p = this.players.get(z.extras.sourceId);
                        if (p) {
                            let damage = (z.type === 'explosion' || z.type === 'pulso_arcano' || z.type === 'terremoto_geometrico_zone') ? z.damagePerSec : z.damagePerSec / 2;
                            if (p.build?.buildingColor === 'predator_hive') {
                                const isBossLike = e.maxHp >= 5000 || String(e.type || '').toLowerCase().includes('boss');
                                if (z.extras?.scaleByHiveWounds) {
                                    let wounded = 0;
                                    for (const other of this.enemies) {
                                        if (!other.isDestroyed && other.hasHiveWound?.(p.id) && z.position.distanceToXZ(other.position) < z.radius) wounded++;
                                    }
                                    damage *= (1 + Math.min(0.70, wounded * 0.07));
                                    if (isBossLike) damage *= 0.60;
                                }
                                if (z.extras?.hiveBonus && e.hasHiveWound?.(p.id)) damage *= isBossLike ? 1.15 : 1.35;
                                if (z.extras?.applyHiveWoundChance) {
                                    const chance = isBossLike ? 0.25 : (e.maxHp > 1000 ? 0.60 : 1.0);
                                    if (Math.random() < chance) e.applyHiveWound(p, 5000, 1);
                                }
                                if (z.extras?.detonateHiveWounds) {
                                    const stacks = e.getHiveWoundStacks?.(p.id) || 0;
                                    if (stacks <= 0) continue;
                                    damage *= stacks;
                                }
                            }
                            e.takeDamage(damage, p, false, 0, false, this.skillDamageMeta(p, 'r', z.type));
                            if (z.type === 'coin_burst') coinBurstHits++;
                        }
                    }
                }
                if (z.type === 'coin_burst' && coinBurstHits >= 5) {
                    const p = this.players.get(z.extras.sourceId);
                    if (p && p.coinBurstHealCooldown <= 0) {
                        p.coinBurstHealCooldown = 2000;
                        const healAmount = Math.round(p.maxHp * 0.05);
                        p.heal(healAmount);
                        this.pendingEvents.push({
                            event: 'HIT_NUMBER',
                            data: {
                                targetId: p.id,
                                x: p.position.x,
                                y: 2.0,
                                z: p.position.z,
                                value: healAmount,
                                type: 'HEAL'
                            }
                        });
                    }
                }
            } else if (!z.extras?.burst && z.damagePerSec > 0 && Date.now() > z.lastTick + 1000) {
                // Continuous damage from zones (only for non-player zones or specific persistent ones)
                z.lastTick = Date.now();
                const zoneSource = this.getZoneSource(z);
                for (const p of players) {
                    if (!p.isDead && p.position.distanceToXZ(z.position) < z.radius) {
                        this.damagePlayer(p, z.damagePerSec, zoneSource, z.type, false, false, undefined, true);
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
                const healAmount = p.maxHp * CONFIG.HEALING_TOWER.HEAL_PERCENT;
                p.heal(healAmount);
                // HIT_NUMBER HEAL feedback
                const hThrottle = this.hitNumberThrottle.get(`heal_${p.id}`) || 0;
                if (now - hThrottle > 500) {
                    this.hitNumberThrottle.set(`heal_${p.id}`, now);
                    this.pendingEvents.push({
                        event: 'HIT_NUMBER',
                        data: {
                            targetId: p.id,
                            x: p.position.x,
                            y: 2.0,
                            z: p.position.z,
                            value: Math.round(healAmount),
                            type: 'HEAL'
                        }
                    });
                }
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
        // Process any destroyed enemies whose death hasn't been processed yet (e.g. from zone or passive ticks)
        for (const e of this.enemies) {
            if (e.isDestroyed && !e.deathProcessed) {
                this.onEnemyKilled(e, e.killer);
            }
        }

        // Only remove enemies that have been dead for more than 10 seconds (gives Espectro de Raziel time to absorb)
        const now = Date.now();
        this.enemies = this.enemies.filter(e => {
            if (!e.isDestroyed) return true;
            if (e instanceof EnemyTowerEnemy) return true;
            // Keep dead bodies for 10 seconds so passives can absorb them
            if (!(e as any).deathTime) (e as any).deathTime = now;
            return (now - (e as any).deathTime) < 10000;
        });
        this.playerProjectiles = this.playerProjectiles.filter(p => !p.isDestroyed);
        this.enemyProjectiles = this.enemyProjectiles.filter(p => !p.isDestroyed);
    }

    // Skill handling
    handleSkill(playerId: string, skill: 'q' | 'w' | 'e' | 'r' | 'jump'): void {
        const p = this.players.get(playerId);
        if (!p) return;

        if (skill === 'jump') {
            if (p.isDead || p.statusEffects.stunned.isActive || p.statusEffects.frozen.isActive || p.statusEffects.rooted.isActive || p.statusEffects.lichKingPrison.isActive) return;
            if (p.jumpTimer <= 0) {
                p.jumpTimer = 800;
            }
            return;
        }

        const now = Date.now();
        if (!p.canUseSkill(skill, now)) return;
        p.skills[skill].lastUsed = now;

        // Purple Floor 2 Option 1: extra damage after casting skill
        if (p.extraDamageAfterSkill) {
            p.extraDamageAfterSkillActive = true;
        }

        switch (skill) {
            case 'q': p.activateDash(); break;
            case 'w': // Repel: push enemies away
                let projectilesReversed = 0;
                for (const proj of this.enemyProjectiles) {
                    if (!proj.isDestroyed && p.position.distanceToXZ(proj.position) < CONFIG.PLAYER.SKILL_W.RANGE) {
                        proj.isDestroyed = true;
                        projectilesReversed++;
                    }
                }

                if (p.upgradeFlags.w_healOnReflect && projectilesReversed > 0) {
                    p.heal(p.maxHp * 0.03 * projectilesReversed);
                    if (projectilesReversed >= 3) p.clearNegativeEffects();
                    p.pendingZones.push({ type: 'w_refracao_vital', x: p.position.x, z: p.position.z, radius: CONFIG.PLAYER.SKILL_W.RANGE, damage: 0 });
                }

                for (const e of this.enemies) {
                    if (e.isDestroyed) continue;
                    const dist = p.position.distanceToXZ(e.position);
                    if (dist < CONFIG.PLAYER.SKILL_W.RANGE) {
                        const dir = e.position.clone().sub(p.position); dir.y = 0; dir.normalize();
                        let force = (p.skillLevels.w >= 2 ? 40 : 25) * (1 - dist / CONFIG.PLAYER.SKILL_W.RANGE);
                        
                        if (p.upgradeFlags.w_pullInstead) {
                            force = -force * 0.5; // pull inward gently
                            e.applySlow(3000, 0.7);
                        }
                        
                        e.applyKnockback(dir, force);
                        if (p.skillLevels.w >= 3) e.takeDamage(p.getDamage(true) * 0.5, p, false, 0, false, this.skillDamageMeta(p, 'w', 'Repulsao'));
                        
                        if (p.upgradeFlags.w_bleedOnRepel) {
                            e.applyBleed(5000, p.getDamage(true) * 0.1);
                        }
                    }
                }

                if (p.upgradeFlags.w_bleedOnRepel) {
                    p.pendingZones.push({ type: 'w_campo_hemorragia', x: p.position.x, z: p.position.z, radius: CONFIG.PLAYER.SKILL_W.RANGE, damage: 0 });
                } else if (p.upgradeFlags.w_pullInstead) {
                    p.pendingZones.push({ type: 'w_vacuo_magnetico', x: p.position.x, z: p.position.z, radius: CONFIG.PLAYER.SKILL_W.RANGE, damage: 0 });
                }
                if (p.build.buildingColor === 'predator_hive' && p.predatorWall && p.predatorWallCooldown <= 0) {
                    const dir = p.getFacingDirection();
                    const wallPos = p.position.clone().add(dir.multiplyScalar(3.5));
                    p.predatorWallCooldown = 12000;
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'predator_front_wall',
                        position: wallPos,
                        radius: 4.0,
                        duration: 3000,
                        timer: 3000,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { sourceId: p.id, rotY: p.rotationY }
                    });
                }
                break;
            case 'e': p.activateShield(); break;
            case 'r': 
                // Purple Mutated Ultimate: Reset Dimensional (Blink + cooldown resets)
                if (p.upgradeFlags.r_reset_dimensional) {
                    p.skills.q.lastUsed = 0;
                    p.skills.w.lastUsed = 0;
                    p.skills.e.lastUsed = 0;
                    const dir = p.getFacingDirection();
                    p.position.add(dir.multiplyScalar(8.0));
                    p.position.x = Math.max(-48, Math.min(48, p.position.x));
                    p.position.z = Math.max(-48, Math.min(48, p.position.z));
                }

                p.activateUltimate(); 
                p.clearNegativeEffects(); 
                p.heal(p.maxHp * 0.3); 

                // Basic and Mutated Ultimate activation logic
                const color = p.build.buildingColor;
                if (color === 'red') {
                    if (p.upgradeFlags.r_chuva_tetraedros) {
                        p.r_chuva_timer = 4000;
                        p.r_chuva_tick = 0;
                    } else if (p.upgradeFlags.r_raio_oblivio) {
                        const dir = p.getFacingDirection();
                        const dmg = p.getDamage(true) * 8.0;
                        const proj = new ServerProjectile(p.position.clone().set(p.position.x, 0.5, p.position.z), dir, p.id, true, dmg, 0xff0000);
                        proj.isCritical = p.lastHitWasCrit;
                        proj.specialEffect = 'raio_oblivio';
                        proj.speed = 35;
                        proj.hitboxRadius = 2.5;
                        proj.lifetime = 2.0;
                        this.playerProjectiles.push(proj);
                    } else if (p.upgradeFlags.r_corte_dimensional) {
                        const nearbyEnemies = [];
                        for (const enemy of this.enemies) {
                            if (!enemy.isDestroyed && p.position.distanceToXZ(enemy.position) < 12.0) {
                                nearbyEnemies.push(enemy);
                            }
                        }
                        nearbyEnemies.sort((a, b) => p.position.distanceToXZ(a.position) - p.position.distanceToXZ(b.position));
                        p.r_slash_targets = nearbyEnemies.slice(0, 5).map(e => e.id);
                        p.r_slash_timer = 0;
                        p.r_slash_index = 0;
                    } else {
                        // Basic Red Ultimate: Raio de Fogo Simples
                        const dir = p.getFacingDirection();
                        const dmg = p.getDamage(true) * 3.0;
                        const proj = new ServerProjectile(p.position.clone().set(p.position.x, 0.5, p.position.z), dir, p.id, true, dmg, 0xff5500);
                        proj.isCritical = p.lastHitWasCrit;
                        proj.specialEffect = 'raio_fogo_simples';
                        proj.speed = 25;
                        proj.hitboxRadius = 1.0;
                        proj.lifetime = 2.0;
                        this.playerProjectiles.push(proj);
                    }
                } else if (color === 'green') {
                    if (p.upgradeFlags.r_bastiao_titanio) {
                        const sh = p.skills.e;
                        sh.isActive = true;
                        sh.maxShieldHp = p.maxHp;
                        sh.shieldHp = p.maxHp;
                        sh.timer = 6000;
                        p.applyTemporaryBuff('invulnerable', 6, 0);
                    } else if (p.upgradeFlags.r_terremoto_geometrico) {
                        p.r_quake_timer = 6000;
                        p.r_quake_tick = 0;
                    } else {
                        // Basic Green Ultimate: Escudo de Polígonos
                        const sh = p.skills.e;
                        sh.isActive = true;
                        sh.maxShieldHp = p.maxHp * 0.30;
                        sh.shieldHp = sh.maxShieldHp;
                        sh.timer = 10000;
                    }
                } else if (color === 'purple') {
                    if (p.upgradeFlags.r_singularidade) {
                        const dir = p.getFacingDirection();
                        const targetPos = p.position.clone().add(dir.multiplyScalar(6.0));
                        targetPos.x = Math.max(-48, Math.min(48, targetPos.x));
                        targetPos.z = Math.max(-48, Math.min(48, targetPos.z));
                        this.zones.push({
                            id: `zone_${this.zoneIdCounter++}`,
                            type: 'singularidade_zone',
                            position: targetPos,
                            radius: 6,
                            duration: 4000,
                            timer: 4000,
                            damagePerSec: p.getDamage(true) * 0.5,
                            lastTick: 0,
                            extras: { sourceId: p.id }
                        });
                    } else if (p.upgradeFlags.r_distorcao_temporal_mut) {
                        this.zones.push({
                            id: `zone_${this.zoneIdCounter++}`,
                            type: 'distorcao_temporal_zone',
                            position: p.position.clone(),
                            radius: 8,
                            duration: 6000,
                            timer: 6000,
                            damagePerSec: 0,
                            lastTick: 0,
                            extras: { sourceId: p.id }
                        });
                    } else {
                        // Basic Purple Ultimate: Pulso Arcano
                        p.pendingZones.push({
                            type: 'pulso_arcano',
                            x: p.position.x,
                            z: p.position.z,
                            radius: 8,
                            damage: p.getDamage(true) * 1.5
                        });
                        for (const enemy of this.enemies) {
                            if (!enemy.isDestroyed) {
                                const dist = p.position.distanceToXZ(enemy.position);
                                if (dist < 8.0) {
                                    const kDir = enemy.position.clone().sub(p.position);
                                    kDir.y = 0;
                                    kDir.normalize();
                                    enemy.applyKnockback(kDir, 30);
                                }
                            }
                        }
                    }
                } else if (color === 'poison') {
                    if (p.upgradeFlags.r_campo_fungos) {
                        // Spawn 3 mushrooms in a circle around the player
                        for (let i = 0; i < 3; i++) {
                            const angle = (i * Math.PI * 2) / 3;
                            const dist = 4.0;
                            const zx = Math.max(-48, Math.min(48, p.position.x + Math.cos(angle) * dist));
                            const zz = Math.max(-48, Math.min(48, p.position.z + Math.sin(angle) * dist));
                            this.zones.push({
                                id: `zone_${this.zoneIdCounter++}`,
                                type: 'teemo_shroom',
                                position: new Vec3(zx, 0, zz),
                                radius: 1.0,
                                duration: 30000,
                                timer: 30000,
                                damagePerSec: 0,
                                lastTick: 0,
                                extras: { sourceId: p.id }
                            });
                        }
                    } else if (p.upgradeFlags.r_olhar_gorgona) {
                        const dir = p.getFacingDirection().normalize();
                        const dmg = p.getDamage(true) * 2.0;
                        for (const enemy of this.enemies) {
                            if (enemy.isDestroyed) continue;
                            const dist = p.position.distanceToXZ(enemy.position);
                            if (dist < 8.0) {
                                const toEnemy = enemy.position.clone().sub(p.position);
                                toEnemy.y = 0;
                                if (toEnemy.lengthSq() > 0.001) {
                                    toEnemy.normalize();
                                    const dot = dir.dot(toEnemy);
                                    if (dot > 0.707) { // 90 degree cone (45 deg each side)
                                        const toPlayer = p.position.clone().sub(enemy.position).normalize();
                                        const enemyFacing = new Vec3(Math.sin(enemy.rotationY), 0, Math.cos(enemy.rotationY)).normalize();
                                        const faceDot = enemyFacing.dot(toPlayer);
                                        
                                        enemy.takeDamage(dmg, p, false, 0, false, this.essenceDamageMeta(p, 'poison_olhar_gorgona', 'Olhar da Gorgona', 5));
                                        if (faceDot > 0) { // facing player
                                            enemy.applyStun(4000);
                                        } else { // facing away
                                            enemy.applySlow(4000, 0.2); // 80% slow
                                        }
                                    }
                                }
                            }
                        }
                        this.zones.push({
                            id: `zone_${this.zoneIdCounter++}`,
                            type: 'gorgon_flash',
                            position: p.position.clone(),
                            radius: 8.0,
                            duration: 500,
                            timer: 500,
                            damagePerSec: 0,
                            lastTick: 0,
                            extras: { sourceId: p.id, rotY: p.rotationY }
                        });
                    } else if (p.upgradeFlags.r_raio_peste) {
                        // Handled by timer inside basic attack firing, but we can play sound/effect
                        // We also set p.r_raio_peste_timer = 8000 in activateUltimate.
                    } else {
                        // Basic Poison Ultimate: Frasco de Peçonha
                        const dir = p.getFacingDirection();
                        const dmg = p.getDamage(true) * 1.5;
                        const proj = new ServerProjectile(p.position.clone().set(p.position.x, 0.5, p.position.z), dir, p.id, true, dmg, 0x10b981);
                        proj.isCritical = p.lastHitWasCrit;
                        proj.specialEffect = 'frasco_peconha';
                        proj.speed = 15;
                        proj.hitboxRadius = 1.0;
                        proj.lifetime = 1.5;
                        this.playerProjectiles.push(proj);
                    }
                } else if (color === 'coin') {
                    this.zones.push({
                        id: `zone_${this.zoneIdCounter++}`,
                        type: 'coin_spin',
                        position: p.position.clone(),
                        radius: 1.6,
                        duration: p.skills.r.timer,
                        timer: p.skills.r.timer,
                        damagePerSec: 0,
                        lastTick: 0,
                        extras: { sourceId: p.id }
                    });
                }
                break;
        }
    }

    getSnapshot(): WorldSnapshot {
        const now = Date.now();
        for (const p of this.players.values()) {
            if (p.build?.buildingColor !== 'predator_hive') continue;
            const workers = this.ergWorkers.filter(w => w.ownerId === p.id);
            p.ergActiveWorkers = workers.filter(w => w.respawnTimer <= 0).length;
            p.ergWorkerIntegrities = workers
                .sort((a, b) => a.index - b.index)
                .map(w => w.respawnTimer > 0 ? 0 : w.integrity);
        }
        return {
            tick: this.tick,
            time: this.gameTime,
            players: [...this.players.values()].map(p => p.toSnapshot(now)),
            enemies: this.enemies.filter(e => !e.isDestroyed).map(e => e.toSnapshot()),
            projectiles: [...this.playerProjectiles, ...this.enemyProjectiles].map(p => p.toSnapshot()),
            orbs: this.orbs.map(o => ({ id: o.id, type: o.type, x: o.position.x, z: o.position.z, hitboxRadius: o.hitboxRadius, buffType: o.buffType })),
            dynamicEntities: [
                ...this.zones.map(z => ({ id: z.id, type: z.type, x: z.position.x, y: 0, z: z.position.z, radius: z.radius, duration: z.duration, timer: z.timer, opacity: z.timer / z.duration, rotY: z.extras?.rotY, extras: z.extras })),
                ...[...this.players.values()].filter(p => p.ergCentralBaseActive && !p.isDead).map(p => ({ id: `erg_base_${p.id}`, type: p.ergBaseLevel >= 10 ? 'erg_central_base_max' : 'erg_central_base', x: this.healingTowerPos.x, y: 0.12, z: this.healingTowerPos.z, radius: 3.2 + Math.min(1.3, p.ergBaseLevel * 0.08), duration: 1000, timer: 1000, opacity: 0.75, color: 0x7c3aed })),
                ...this.ergWorkers.map(w => {
                    const type = w.respawnTimer > 0 ? 'erg_worker_dead' : (w.integrity <= 1 ? 'erg_worker_critical' : (w.integrity < w.maxIntegrity ? 'erg_worker_damaged' : (w.carrying > 0 ? 'erg_worker_carrying' : 'erg_worker')));
                    return { id: w.id, type, x: w.position.x, y: 0.25, z: w.position.z, radius: 0.45, duration: 1000, timer: 1000, opacity: w.respawnTimer > 0 ? 0.28 : 0.88, color: w.respawnTimer > 0 ? 0x4c1d95 : (w.integrity <= 1 ? 0xef4444 : 0xa855f7), integrity: w.integrity, maxIntegrity: w.maxIntegrity, respawnTimer: Math.max(0, w.respawnTimer) };
                })
            ],
            boss: this.spawnManager.activeBoss ? (() => { const b = this.enemies.find(e => e.id === this.spawnManager.activeBoss); return b ? { id: b.id, name: b.name, hp: b.hp, maxHp: b.maxHp } : null; })() : null,
            mightyOne: this.spawnManager.mightyOneAlive ? (() => { const m = this.enemies.find(e => e.type === 'TheMightyOne'); return m ? { hp: m.hp, maxHp: m.maxHp, damageBonus: (m as TheMightyOneEnemy).damageBonus } : null; })() : null,
            collapseLevel: this.spawnManager.collapseLevel,
            globalMultiplier: this.spawnManager.globalMultiplier,
            // Faraó arena state
            eclipseActive: (() => { const f = this.enemies.find(e => e.type === 'Farao' && !e.isDestroyed) as FaraoEnemy | undefined; return f?.eclipseActive || undefined; })(),
            faraoWarning: this.spawnManager.faraoWarningActive ? { timer: this.spawnManager.faraoWarningTimer } : undefined,
            julgamento: (() => { const f = this.enemies.find(e => e.type === 'Farao' && !e.isDestroyed) as any; return f?.habilidades?.julgamento?.isActive ? { timer: f.habilidades.julgamento.timer, safeX: f.habilidades.julgamento.safeX, safeZ: 0 } : undefined; })(),
        };
    }
}
