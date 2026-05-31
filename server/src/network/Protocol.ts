/**
 * Network protocol - all message types between client and server
 */

// ============================================================
// Client → Server Messages
// ============================================================

export interface PlayerBuild {
    buildingColor: 'red' | 'green' | 'purple' | 'poison';
    floor1: number; // Selected index (0, 1, or 2)
    floor2: number;
    floor3: number;
    floor4: number;
    floor5?: number;
    loadoutItems?: string[]; // Array of item IDs equipped
}

export type ClientMessage =
    | { type: 'JOIN_QUEUE'; payload: { name?: string; token?: string; build?: PlayerBuild; loadout?: string[]; platform?: 'pc' | 'mobile' } }
    | { type: 'LEAVE_QUEUE' }
    | { type: 'SELECT_PLATFORM'; payload: { platform: 'pc' | 'mobile' } }
    | { type: 'INPUT_STATE'; payload: InputState }
    | { type: 'USE_SKILL'; payload: { skill: 'q' | 'w' | 'e' | 'r' | 'jump' } }
    | { type: 'MOVE_TO'; payload: { x: number; z: number } }
    | { type: 'ATTACK_START' }
    | { type: 'ATTACK_STOP' }
    | { type: 'CHOOSE_UPGRADE'; payload: { skillKey: string } | { skip: true } }
    | { type: 'UPGRADE_SELECT'; payload: { skill: string; option: string } }
    | { type: 'PING' };

export interface InputState {
    keys: { w: boolean; a: boolean; s: boolean; d: boolean };
    mouseX: number;  // normalized -1 to 1
    mouseY: number;  // normalized -1 to 1
    // Mobile joystick
    joystickX?: number;
    joystickY?: number;
    worldX?: number;
    worldZ?: number;
    isAiming?: boolean;
}

// ============================================================
// Server → Client Messages
// ============================================================

export type ServerMessage =
    | { type: 'WELCOME'; payload: { playerId: string; serverVersion: string; tickRate: number } }
    | { type: 'CONNECTED'; payload: { playerId: string } }
    | { type: 'QUEUE_STATUS'; payload: QueueStatus }
    | { type: 'MATCH_FOUND'; payload: MatchInfo }
    | { type: 'COUNTDOWN'; payload: { seconds: number } }
    | { type: 'GAME_START'; payload: { yourPlayerId: string, obstacles: Obstacle[] } }
    | { type: 'GAME_STATE'; payload: WorldSnapshot }
    | { type: 'EVENT'; payload: GameEvent }
    | { type: 'UPGRADE_PROMPT'; payload: UpgradePrompt }
    | { type: 'UPGRADE_APPLIED' }
    | { type: 'PLAYER_DIED'; payload: { playerId: string; playerName: string; score: number } }
    | { type: 'GAME_OVER'; payload: GameOverData }
    | { type: 'LEADERBOARD'; payload: LeaderboardEntry[] }
    | { type: 'PONG'; payload: { serverTime: number } }
    | { type: 'ERROR'; payload: { message: string } };

export interface UpgradeOption {
    id: string;
    name: string;
    description: string;
}

export interface UpgradePrompt {
    level: number;
    skill: 'q' | 'w' | 'e' | 'r';
    options: UpgradeOption[];
}

export interface QueueStatus {
    position: number;
    playersInQueue: number;
    estimatedWaitMs: number;
}

export interface MatchInfo {
    roomId: string;
    players: { id: string; name: string }[];
}

export interface Obstacle {
    x: number;
    z: number;
    width: number;
    depth: number;
}

export interface WorldSnapshot {
    tick: number;
    time: number;
    players: PlayerSnapshot[];
    enemies: EnemySnapshot[];
    projectiles: ProjectileSnapshot[];
    orbs: OrbSnapshot[];
    dynamicEntities: DynamicEntitySnapshot[];
    boss: BossSnapshot | null;
    mightyOne: MightyOneSnapshot | null;
    collapseLevel: number;
    globalMultiplier: number;
    // Faraó arena state
    faraoWarning?: { timer: number };
    eclipseActive?: boolean;
    julgamento?: { timer: number; safeX: number; safeZ: number };
}

export interface PlayerSnapshot {
    id: string;
    name: string;
    x: number;
    y?: number;
    z: number;
    rotY: number;
    hp: number;
    maxHp: number;
    xp: number;
    xpNext: number;
    level: number;
    score: number;
    shieldHp: number;
    shieldMaxHp: number;
    skillCooldowns: { q: number; w: number; e: number; r: number }; // remaining ms
    activeBuff: string | null;
    buffTimer: number;
    tempBuff: string | null;
    timedBuffs: string[];
    statusEffects: { id: string; stacks: number }[];
    buffTimers?: { [key: string]: number };
    pathogens?: { [key: string]: number };
    isDead: boolean;
    isDashing: boolean;
    isUltActive: boolean;
    isShieldActive: boolean;
    passiveLevel: number;
    color: number; // hex color for rendering
    skillUpgrades?: { q?: string; w?: string; e?: string; r?: string };
    isSelectingUpgrade?: boolean;
    build?: PlayerBuild;
    damage?: number;
    defense?: number;
    critChance?: number;
    critDamageMultiplier?: number;
    speed?: number;
    attackSpeed?: number;
    loadoutLevel?: number;
    itemMultiplier?: number;
    loadoutItems?: string[];
}

export interface EnemySnapshot {
    id: string;
    type: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    hp: number;
    maxHp: number;
    name?: string;
    // Visual state flags
    isInvulnerable?: boolean;
    isChanneling?: boolean;
    shieldActive?: boolean;
    isSurtoActive?: boolean;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    // Espectro de Raziel fields
    soulsAbsorbed?: number;
    damageMultiplier?: number;
    speedMultiplier?: number;
    sizeMultiplier?: number;
    orbitingSouls?: { id: string; angle: number; radius: number }[];
    isTeleporting?: boolean;
    vortexActive?: boolean;
    // Cão dos Infernos rework fields
    isChannelingW?: boolean;
    isUltActive?: boolean;
    matilhaCount?: number;
    // O Faraó fields
    isLevitating?: boolean;
    eclipseActive?: boolean;
    isJulgamentoActive?: boolean;
    julgamentoSafeX?: number;
    isRaioWarning?: boolean;
    raioTargetX?: number;
    isEmerging?: boolean;
    isEnraged?: boolean;
    statusEffects?: { id: string; stacks: number }[];
}

export interface ProjectileSnapshot {
    id: string;
    x: number;
    y: number;
    z: number;
    isPlayerOwned: boolean;
    color: number;
    specialEffect?: string;
    skillUpgrades?: { q?: string; w?: string; e?: string; r?: string };
}

export interface OrbSnapshot {
    id: string;
    type: 'xp' | 'healing' | 'buff';
    x: number;
    z: number;
    buffType?: string;
}

export interface DynamicEntitySnapshot {
    id: string;
    type: string;
    x: number;
    y: number;
    z: number;
    radius?: number;
    opacity?: number;
    color?: number;
    rotY?: number;
}

export interface BossSnapshot {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
}

export interface MightyOneSnapshot {
    hp: number;
    maxHp: number;
    damageBonus: number;
}

export interface GameEvent {
    event: 'BOSS_SPAWN' | 'BOSS_KILLED' | 'COLLAPSE' | 'PLAYER_LEVEL_UP'
        | 'ITEM_DROP' | 'MESSAGE' | 'PLAYER_BUFF'
        | 'FARAO_SPAWN_WARNING' | 'FARAO_ECLIPSE' | 'FARAO_JULGAMENTO'
        | 'HIT_NUMBER' | 'MIGHTY_ONE_SPAWN' | 'MIGHTY_ONE_DEFEATED' | 'LOADOUT_LEVEL_UP';
    data: any;
}



export interface GameOverData {
    scores: { playerId: string; playerName: string; score: number; rank: number }[];
    time: number;
    collapseLevel: number;
    winner: { playerId: string; playerName: string; score: number };
    droppedItems?: { playerId: string; itemId: string }[];
}

export interface LeaderboardEntry {
    rank: number;
    playerName: string;
    score: number;
    time: number;
    createdAt: string;
}
