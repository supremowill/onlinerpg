/**
 * Game configuration constants - mirrors the client-side game balance
 * All game logic values are centralized here
 */
export const CONFIG = {
    // Server
    PORT: parseInt(process.env.PORT || '3000'),
    TICK_RATE: parseInt(process.env.TICK_RATE || '20'),        // Hz
    get TICK_INTERVAL_MS() { return 1000 / this.TICK_RATE; },

    // Matchmaking
    MAX_PLAYERS_PER_ROOM: parseInt(process.env.MAX_PLAYERS_PER_ROOM || '5'),
    MIN_PLAYERS_TO_START: parseInt(process.env.MIN_PLAYERS_TO_START || '1'),
    MATCHMAKING_TIMEOUT_MS: parseInt(process.env.MATCHMAKING_TIMEOUT_MS || '30000'),
    RECONNECT_TIMEOUT_MS: 60000,

    // Map
    MAP_SIZE: 100, // 100x100 ground plane
    GROUND_HALF: 50,

    // Player
    PLAYER: {
        HITBOX_RADIUS: 0.5,
        SPEED: 5,
        MAX_HP: 100,
        ATTACK_COOLDOWN_MS: 500,
        PROJECTILE_SPEED: 15,
        PROJECTILE_LIFETIME: 3,
        XP_TO_FIRST_LEVEL: 10,
        XP_MULTIPLIER: 1.8,
        LEVEL_HP_MULTIPLIER: 1.5,
        UPGRADE_LEVELS: [5, 10, 15, 20],

        // Skill Q - Dash
        SKILL_Q: {
            COOLDOWN: 5000,
            DURATION: 200,
            DASH_SPEED: 30,
        },
        // Skill W - Repel
        SKILL_W: {
            COOLDOWN: 8000,
            RANGE: 10,
        },
        // Skill E - Shield
        SKILL_E: {
            COOLDOWN: 20000,
            DURATION: 15000,
            SHIELD_MULTIPLIER: 1.5, // of maxHp
        },
        // Skill R - Ultimate
        SKILL_R: {
            COOLDOWN: 50000,
            DURATION: 25000,
            DAMAGE_MULTIPLIER: 4.0,
        },
        // Buffs
        BUFF_DURATION: 60000,
    },

    // Enemy scaling
    ENEMY_SCALE_PER_PLAYER: 0.5, // HP * (1 + 0.5 * (numPlayers - 1))

    // Enemies
    PURPLE_CUBE: {
        BASE_HP: 300,
        BASE_DAMAGE: 25,
        SPEED: 2.5,
        ATTACK_RANGE: 12,
        ATTACK_COOLDOWN: 2000,
        XP: 250,
        SCORE: 50,
        HITBOX_RADIUS: 0.6,
    },
    RED_CONE: {
        BASE_HP: 900,
        BASE_DAMAGE: 15,
        SPEED: 0,
        ATTACK_RANGE: 10,
        ATTACK_COOLDOWN: 1000,
        XP: 1000,
        SCORE: 150,
        HITBOX_RADIUS: 0.7,
    },
    ENEMY_TOWER: {
        BASE_HP: 500,
        BASE_DAMAGE: 20,
        ATTACK_RANGE: 30,
        ATTACK_COOLDOWN: 1500,
        XP: 100,
        SCORE: 150,
        HITBOX_RADIUS: 1.2,
        RESPAWN_DELAY: 60,
    },
    GUARDIAN_GUERREIRO: {
        BASE_HP: 800,
        BASE_DAMAGE: 30,
        SPEED: 2.0,
        ATTACK_RANGE: 2.0,
        ATTACK_COOLDOWN: 1500,
        XP: 500,
        SCORE: 1000,
        HITBOX_RADIUS: 1.0,
        STUN_COOLDOWN: 10000,
    },
    GUARDIAN_MAGO: {
        BASE_HP: 600,
        BASE_DAMAGE: 20,
        SPEED: 2.5,
        ATTACK_RANGE: 15,
        MIN_ATTACK_RANGE: 5,
        ATTACK_COOLDOWN: 4000,
        FREEZE_COOLDOWN: 15000,
        XP: 600,
        SCORE: 1200,
        HITBOX_RADIUS: 0.8,
    },
    GUARDIAN_ARQUEIRO: {
        BASE_HP: 500,
        BASE_DAMAGE: 25,
        SPEED: 3.0,
        ATTACK_RANGE: 22,
        ATTACK_COOLDOWN: 1500,
        IDEAL_DISTANCE: 10,
        RETREAT_DISTANCE: 6,
        XP: 700,
        SCORE: 1500,
        HITBOX_RADIUS: 0.7,
    },
    CAO_DOS_INFERNOS: {
        BASE_HP_PER_LEVEL: 40,
        BASE_HP: 80,
        BASE_DAMAGE_PER_LEVEL: 5,
        BASE_DAMAGE: 15,
        SPEED: 3.8,
        HITBOX_RADIUS: 1.2,
    },
    SUPER_BOSS: {
        BASE_HP: 5000,
        BASE_DAMAGE: 50,
        SPEED: 1.0,
        AURA_RADIUS: 8,
        PULL_FORCE: 2.5,
        HITBOX_RADIUS: 3.0,
        XP: 2000,
        SCORE: 7500,
    },
    RAINHA_DAS_TREVAS: {
        BASE_HP: 70000,
        BASE_DAMAGE: 30,
        SPEED: 2.8,
        HITBOX_RADIUS: 1.5,
        XP: 25000,
        SCORE: 5000,
    },
    PLANTA_CARNIVORA: {
        BASE_HP: 2500,
        SPEED: 0,
        HITBOX_RADIUS: 2.0,
        XP: 3000,
        SCORE: 6000,
    },
    FEITICEIRO_IMORTAL: {
        BASE_HP: 50000,
        SPEED: 1.2,
        HITBOX_RADIUS: 1.2,
        XP: 50000,
        SCORE: 10000,
    },
    LICH_KING: {
        BASE_HP: 32000,
        SPEED: 0.7,
        HITBOX_RADIUS: 1.5,
        AURA_RADIUS: 4,
        XP: 50000,
        SCORE: 25000,
    },
    GANGPLANK: {
        BASE_HP: 120000,
        BASE_DAMAGE: 70,
        SPEED: 2.0,
        DEFENSE: 0.10,
        HITBOX_RADIUS: 1.5,
        XP: 30000,
        SCORE: 4500,
    },
    THE_MIGHTY_ONE: {
        HP: 100000,
        SPEED: 0.3,
        HITBOX_RADIUS: 4.0,
        AURA_RADIUS: 25,
        XP: 30000,
        SCORE: 50000,
    },

    // Defenders
    BRUXA_DO_GELO: {
        BASE_HP: 1000,
        SPEED: 2.0,
        XP: 400,
        SCORE: 2000,
        HITBOX_RADIUS: 1.0,
    },
    MESTRA_DA_ILUSAO: {
        BASE_HP: 850,
        SPEED: 2.5,
        XP: 380,
        SCORE: 2200,
        HITBOX_RADIUS: 1.0,
    },
    BOMBARDEIRO_INSANO: {
        BASE_HP: 10000,
        SPEED: 1.8,
        XP: 750,
        SCORE: 2500,
        HITBOX_RADIUS: 1.2,
    },

    // Spawn timers (seconds)
    SPAWN_TIMERS: {
        GLOBAL_SCALE: 60,
        PURPLE_CUBE: 5,
        RED_CONE: 30,
        GUARDIAN: 240,
        CAO_DOS_INFERNOS: 120,
        RAINHA: 300,
        PLANTA_CARNIVORA: 210,
        FEITICEIRO: 420,
        LICH_KING: 600,
        GANGPLANK: 360,
        GUARDIAO_DO_LIMBO: 60,
        MINOS: 120,
        CERBERO: 180,
        PLUTAO: 240,
        FURIA: 300,
        MEGERA: 360,
        MINOTAURO: 420,
        GERIAO: 480,
        LUCIFER: 540,
        SUPER_BOSS_TIME: 180,
        THE_MIGHTY_ONE_TIME: 600,
    },

    // Global collapse
    COLLAPSE_MULTIPLIER: 20,

    // Healing tower
    HEALING_TOWER: {
        AURA_RADIUS: 4,
        HEAL_COOLDOWN: 3000,
        HEAL_PERCENT: 0.08,
    },

    // Orbs
    XP_ORB: {
        HITBOX_RADIUS: 1.0,
        INITIAL_COUNT: 40,
    },

    // Tower positions
    TOWER_POSITIONS: [
        { x: 35, z: 35 },
        { x: -35, z: 35 },
        { x: 35, z: -35 },
        { x: -35, z: -35 },
    ],

    // Database
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://survival:survival_secret@localhost:5432/survival_game',
};
