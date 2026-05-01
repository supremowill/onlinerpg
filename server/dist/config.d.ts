/**
 * Game configuration constants - mirrors the client-side game balance
 * All game logic values are centralized here
 */
export declare const CONFIG: {
    PORT: number;
    TICK_RATE: number;
    readonly TICK_INTERVAL_MS: number;
    MAX_PLAYERS_PER_ROOM: number;
    MIN_PLAYERS_TO_START: number;
    MATCHMAKING_TIMEOUT_MS: number;
    RECONNECT_TIMEOUT_MS: number;
    MAP_SIZE: number;
    GROUND_HALF: number;
    PLAYER: {
        HITBOX_RADIUS: number;
        SPEED: number;
        MAX_HP: number;
        ATTACK_COOLDOWN_MS: number;
        PROJECTILE_SPEED: number;
        PROJECTILE_LIFETIME: number;
        XP_TO_FIRST_LEVEL: number;
        XP_MULTIPLIER: number;
        LEVEL_HP_MULTIPLIER: number;
        UPGRADE_LEVELS: number[];
        SKILL_Q: {
            COOLDOWN: number;
            DURATION: number;
            DASH_SPEED: number;
        };
        SKILL_W: {
            COOLDOWN: number;
            RANGE: number;
        };
        SKILL_E: {
            COOLDOWN: number;
            DURATION: number;
            SHIELD_MULTIPLIER: number;
        };
        SKILL_R: {
            COOLDOWN: number;
            DURATION: number;
            DAMAGE_MULTIPLIER: number;
        };
        BUFF_DURATION: number;
    };
    ENEMY_SCALE_PER_PLAYER: number;
    PURPLE_CUBE: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        ATTACK_RANGE: number;
        ATTACK_COOLDOWN: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
    };
    RED_CONE: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        ATTACK_RANGE: number;
        ATTACK_COOLDOWN: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
    };
    ENEMY_TOWER: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        ATTACK_RANGE: number;
        ATTACK_COOLDOWN: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
        RESPAWN_DELAY: number;
    };
    GUARDIAN_GUERREIRO: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        ATTACK_RANGE: number;
        ATTACK_COOLDOWN: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
        STUN_COOLDOWN: number;
    };
    GUARDIAN_MAGO: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        ATTACK_RANGE: number;
        MIN_ATTACK_RANGE: number;
        ATTACK_COOLDOWN: number;
        FREEZE_COOLDOWN: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
    };
    GUARDIAN_ARQUEIRO: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        ATTACK_RANGE: number;
        ATTACK_COOLDOWN: number;
        IDEAL_DISTANCE: number;
        RETREAT_DISTANCE: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
    };
    CAO_DOS_INFERNOS: {
        BASE_HP_PER_LEVEL: number;
        BASE_HP: number;
        BASE_DAMAGE_PER_LEVEL: number;
        BASE_DAMAGE: number;
        SPEED: number;
        HITBOX_RADIUS: number;
    };
    SUPER_BOSS: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        AURA_RADIUS: number;
        PULL_FORCE: number;
        HITBOX_RADIUS: number;
        XP: number;
        SCORE: number;
    };
    RAINHA_DAS_TREVAS: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        HITBOX_RADIUS: number;
        XP: number;
        SCORE: number;
    };
    PLANTA_CARNIVORA: {
        BASE_HP: number;
        SPEED: number;
        HITBOX_RADIUS: number;
        XP: number;
        SCORE: number;
    };
    FEITICEIRO_IMORTAL: {
        BASE_HP: number;
        SPEED: number;
        HITBOX_RADIUS: number;
        XP: number;
        SCORE: number;
    };
    LICH_KING: {
        BASE_HP: number;
        SPEED: number;
        HITBOX_RADIUS: number;
        AURA_RADIUS: number;
        XP: number;
        SCORE: number;
    };
    GANGPLANK: {
        BASE_HP: number;
        BASE_DAMAGE: number;
        SPEED: number;
        DEFENSE: number;
        HITBOX_RADIUS: number;
        XP: number;
        SCORE: number;
    };
    THE_MIGHTY_ONE: {
        HP: number;
        SPEED: number;
        HITBOX_RADIUS: number;
        AURA_RADIUS: number;
        XP: number;
        SCORE: number;
    };
    BRUXA_DO_GELO: {
        BASE_HP: number;
        SPEED: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
    };
    MESTRA_DA_ILUSAO: {
        BASE_HP: number;
        SPEED: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
    };
    BOMBARDEIRO_INSANO: {
        BASE_HP: number;
        SPEED: number;
        XP: number;
        SCORE: number;
        HITBOX_RADIUS: number;
    };
    SPAWN_TIMERS: {
        GLOBAL_SCALE: number;
        PURPLE_CUBE: number;
        RED_CONE: number;
        GUARDIAN: number;
        CAO_DOS_INFERNOS: number;
        RAINHA: number;
        PLANTA_CARNIVORA: number;
        FEITICEIRO: number;
        LICH_KING: number;
        GANGPLANK: number;
        SUPER_BOSS_TIME: number;
        THE_MIGHTY_ONE_TIME: number;
    };
    COLLAPSE_MULTIPLIER: number;
    HEALING_TOWER: {
        AURA_RADIUS: number;
        HEAL_COOLDOWN: number;
        HEAL_PERCENT: number;
    };
    XP_ORB: {
        HITBOX_RADIUS: number;
        INITIAL_COUNT: number;
    };
    TOWER_POSITIONS: {
        x: number;
        z: number;
    }[];
    DATABASE_URL: string;
};
//# sourceMappingURL=config.d.ts.map