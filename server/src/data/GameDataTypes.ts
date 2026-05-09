/**
 * GameDataTypes.ts — Contrato de Interface Definitivo
 * 
 * Estas interfaces espelham EXATAMENTE a saída que a ferramenta C# (Authoring Tool)
 * deverá serializar. Qualquer alteração aqui deve ser replicada na ferramenta.
 * 
 * Regra: Nenhum campo opcional sem motivo. Se o campo pode não existir,
 * documente o porquê.
 */

// ============================================================
// Visuals: geometria simples para front-end CSS3D/WebGL
// Proibido estritamente: malhas 3D complexas
// ============================================================
export type ShapeType =
    | 'cube'
    | 'tetrahedron'
    | 'cone'
    | 'sphere'
    | 'cylinder'
    | 'dodecahedron'
    | 'octahedron'
    | 'torus'
    | 'icosahedron';

export interface EnemyVisuals {
    shape: ShapeType;
    color: string;          // hex "#FF0000"
    scale: number;          // multiplicador de tamanho base (1.0 = padrão)
    emissive?: string;      // cor emissiva opcional (brilho)
    opacity?: number;       // 0.0-1.0 (padrão: 1.0)
}

// ============================================================
// Stats base do inimigo
// ============================================================
export interface EnemyStats {
    hp: number;
    speed: number;          // unidades/segundo (0 = estático, como torres)
    damage: number;
    attackRange: number;
    attackCooldown: number;  // ms entre ataques
    hitboxRadius: number;
    xp: number;
    score: number;
    defense?: number;        // redução de dano percentual (0.0-1.0)
}

// ============================================================
// Scaling: escalamento por nível do jogador
// Presente apenas em inimigos que escalam (bosses, minions)
// ============================================================
export interface EnemyScaling {
    hpPerLevel?: number;
    damagePerLevel?: number;
    speedPerLevel?: number;
    xpPerLevel?: number;
}

// ============================================================
// Passiva individual
// O campo `type` é a chave usada pelo StatusRegistry para
// resolver a lógica matemática pré-programada no servidor
// ============================================================
export interface PassiveDefinition {
    type: string;           // "bleed_on_hit", "lifesteal", "poison", etc.
    value: number;          // intensidade do efeito
    duration?: number;      // duração em ms (para DoTs/debuffs)
    chance?: number;        // probabilidade 0-1 (para efeitos probabilísticos)
}

// ============================================================
// Perfil de IA
// O campo `profile` é a chave usada pelo AIBrainRegistry
// para delegar o Steering Behavior correspondente
// ============================================================
export interface AIProfile {
    profile: string;        // "chaser", "flanker", "kiter", "turret", "orbiter", etc.
    aggroRange: number;     // raio de detecção
    retreatRange?: number;  // distância mínima (para kiter/mage)
    idealRange?: number;    // distância ideal (para ranged)
    params?: Record<string, number>;  // parâmetros extras por perfil
}

// ============================================================
// Skill (habilidade ativa do inimigo)
// Definição declarativa — a lógica real vive nas classes TS
// ============================================================
export interface SkillDefinition {
    id: string;             // identificador único da skill
    cooldown: number;       // ms entre usos
    damage?: number;        // dano base
    radius?: number;        // raio de efeito (AoE)
    duration?: number;      // duração do efeito em ms
    params?: Record<string, number | boolean | string>;  // parâmetros extras
}

// ============================================================
// Spawn: configuração de quando e como o inimigo aparece
// ============================================================
export interface SpawnConfig {
    timer: number;              // intervalo de spawn em segundos
    isBoss?: boolean;           // se true, só um ativo por vez
    isUnique?: boolean;         // só 1 ativo por partida (ex: TheMightyOne)
    minGameTime?: number;       // tempo mínimo de jogo (seg) para primeiro spawn
    count?: number;             // quantos spawnar por evento (default: 1)
}

// ============================================================
// Definição completa de um inimigo
// A chave do Record<string, EnemyDefinition> no GameData
// é o ID oficial (ex: "PurpleCube", "CaoDosInfernos")
// ============================================================
export interface EnemyDefinition {
    id: string;                 // ID oficial, igual à chave do Record
    name: string;               // nome de exibição
    category: 'basic' | 'guardian' | 'defender' | 'boss' | 'miniboss' | 'minion' | 'structure';
    visuals: EnemyVisuals;
    stats: EnemyStats;
    passives: PassiveDefinition[];
    ai: AIProfile;
    skills?: SkillDefinition[];
    spawn?: SpawnConfig;
    scaling?: EnemyScaling;
}

// ============================================================
// Root do JSON — ponto de entrada para o GameDataLoader
// ============================================================
export interface GameData {
    version: string;            // versão do schema (para forward-compatibility)
    enemies: Record<string, EnemyDefinition>;
}
