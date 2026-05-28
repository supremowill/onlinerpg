/**
 * UpgradeSystem.ts — Sistema de Aprimoramentos por Nível
 * 
 * Níveis de upgrade: 5, 10, 15, 20
 * Cada nível oferece 3 opções para a habilidade correspondente:
 *   Nível 5  → Skill Q (Dash)
 *   Nível 10 → Skill W (Repel)
 *   Nível 15 → Skill E (Shield)
 *   Nível 20 → Skill R (Ultimate)
 */
import { ServerPlayer } from './Player';
import { UpgradeOption, UpgradePrompt } from '../network/Protocol';

// ============================================================
// Definições das opções de upgrade
// ============================================================
export const UPGRADE_DEFINITIONS: Record<string, UpgradeOption[]> = {
    q: [
        {
            id: 'q_impacto_estilhacante',
            name: 'Impacto Estilhaçante',
            description: 'Esferas do dash aplicam Armor Fracture (-25% defesa, 4s). Cooldown reduzido em 1s.',
        },
        {
            id: 'q_rastro_polvora',
            name: 'Rastro de Pólvora',
            description: 'Durante o dash, deixa minas no chão a cada 0.1s. Inimigos que pisam sofrem dano + queimadura.',
        },
        {
            id: 'q_convergencia_assassina',
            name: 'Convergência Assassina',
            description: 'Cone de disparo estreito. Se 3+ esferas acertam o mesmo alvo: Silence 2s + buff Attack Speed.',
        },
    ],
    w: [
        {
            id: 'w_campo_hemorragia',
            name: 'Campo de Hemorragia',
            description: 'Inimigos repelidos recebem Bleed (5s, 10% do seu dano atual).',
        },
        {
            id: 'w_refracao_vital',
            name: 'Refração Vital',
            description: 'Cada projétil revertido cura 3% HP máx. Se reverter 3+, limpa todos os debuffs.',
        },
        {
            id: 'w_vacuo_magnetico',
            name: 'Vácuo Magnético',
            description: 'Em vez de empurrar, puxa inimigos para o centro e aplica Slow 70% por 3s.',
        },
    ],
    e: [
        {
            id: 'e_carapaca_reativa',
            name: 'Carapaça Reativa',
            description: 'Ao receber dano no escudo, dispara projétil automático no atacante (50% dano absorvido).',
        },
        {
            id: 'e_bateria_sobrecarga',
            name: 'Bateria de Sobrecarga',
            description: '10% do dano absorvido pelo escudo é convertido em XP.',
        },
        {
            id: 'e_fortaleza_inabalavel',
            name: 'Fortaleza Inabalável',
            description: 'Shield HP dobra (3x vida máx). Imune a Stun/Freeze/Root enquanto ativo.',
        },
    ],
    r: [
        {
            id: 'r_furia_infinita',
            name: 'Fúria Infinita',
            description: 'Cada abate durante a Ultimate adiciona +1s de duração.',
        },
        {
            id: 'r_distorcao_temporal',
            name: 'Distorção Temporal',
            description: 'Durante a Ultimate, cooldowns de Q/W/E caem para 1 segundo.',
        },
        {
            id: 'r_singularidade_colapso',
            name: 'Singularidade do Colapso',
            description: 'Armazena dano evitado. Ao fim da Ultimate, explode 200% do dano em raio 20.',
        },
    ],
};

// ============================================================
// Definições das mutações de ultimate baseadas na cor da torre
// ============================================================
export const TOWER_MUTATION_DEFINITIONS: Record<string, UpgradeOption[]> = {
    red: [
        {
            id: 'r_chuva_tetraedros',
            name: 'Chuva de Tetraedros',
            description: 'Chuva de meteoros tetraédricos em área, causando dano massivo contínuo por 4s.',
        },
        {
            id: 'r_raio_oblivio',
            name: 'Raio do Oblívio',
            description: 'Dispara um megashoot em linha reta de calor extremo que derrete inimigos.',
        },
        {
            id: 'r_corte_dimensional',
            name: 'Corte Dimensional',
            description: 'Dobra a velocidade e ataca inimigos em sequência com cortes críticos rápidos.',
        },
    ],
    green: [
        {
            id: 'r_bastiao_titanio',
            name: 'Bastião de Titânio',
            description: 'Gera um escudo impenetrável de 100% do HP máximo e imunidade total por 6s.',
        },
        {
            id: 'r_terremoto_geometrico',
            name: 'Terremoto Geométrico',
            description: 'Cria terremotos contínuos ao seu redor que dão dano e Stun (1s) a cada pulso.',
        },
        {
            id: 'r_armadura_reativa',
            name: 'Armadura Reativa',
            description: 'Reflete 50% do dano sofrido e atordoa o atacante por 1s.',
        },
    ],
    purple: [
        {
            id: 'r_singularidade',
            name: 'Singularidade',
            description: 'Dispara um orbe que cria um buraco negro puxando inimigos próximos por 4s.',
        },
        {
            id: 'r_distorcao_temporal_mut',
            name: 'Distorção Temporal',
            description: 'Cria campo que congela inimigos e reduz tempo de recarga de suas magias em 80%.',
        },
        {
            id: 'r_reset_dimensional',
            name: 'Reset Dimensional',
            description: 'Blink à frente. Ao usar a ultimate, reseta instantaneamente os cooldowns de Q, W, E.',
        },
    ],
    poison: [
        {
            id: 'r_campo_fungos',
            name: 'Campo de Fungos',
            description: 'Passiva Contínua. O mapa gera cogumelos tetraédricos invisíveis aleatoriamente. Inimigos que pisarem sofrem 5 stacks de veneno instantâneos e lentidão de 80% em área.',
        },
        {
            id: 'r_olhar_gorgona',
            name: 'Olhar da Górgona',
            description: 'Ativa. Dispara um flash poligonal em cone. Inimigos de frente viram pedra (Stun de 4s). Inimigos de costas tomam 80% de lentidão.',
        },
        {
            id: 'r_raio_peste',
            name: 'Raio da Peste',
            description: 'Ativa. Por 8s, ganha alcance extremo. Seus ataques básicos viram lasers penetrantes que atravessam a horda inteira, aplicando dano total e stacks a cada acerto.',
        },
    ],
};

// ============================================================
// Mapeamento: nível → habilidade que recebe upgrade
// ============================================================
const UPGRADE_LEVEL_MAP: Record<number, 'q' | 'w' | 'e' | 'r'> = {
    5: 'q',
    10: 'w',
    15: 'e',
    20: 'r',
};

export const UPGRADE_LEVELS = [5, 10, 15, 20];

/**
 * Verifica se o player atingiu um nível de upgrade e retorna o prompt
 */
export function getUpgradePromptForLevel(level: number, player?: ServerPlayer): UpgradePrompt | null {
    const skill = UPGRADE_LEVEL_MAP[level];
    if (!skill) return null;
    
    let options = UPGRADE_DEFINITIONS[skill];
    if (level === 20 && player && player.build && player.build.buildingColor) {
        const color = player.build.buildingColor;
        if (TOWER_MUTATION_DEFINITIONS[color]) {
            options = TOWER_MUTATION_DEFINITIONS[color];
        }
    }

    return {
        level,
        skill,
        options,
    };
}

/**
 * Aplica o upgrade selecionado ao player.
 * Retorna true se aplicado com sucesso.
 */
export function applyUpgrade(player: ServerPlayer, skill: string, optionId: string): boolean {
    let options = UPGRADE_DEFINITIONS[skill];
    if (skill === 'r' && player.build && player.build.buildingColor) {
        const color = player.build.buildingColor;
        if (TOWER_MUTATION_DEFINITIONS[color]) {
            options = TOWER_MUTATION_DEFINITIONS[color];
        }
    }
    if (!options) return false;
    const option = options.find(o => o.id === optionId);
    if (!option) return false;

    // Armazenar qual upgrade foi escolhido
    if (!player.selectedUpgrades) player.selectedUpgrades = {};
    player.selectedUpgrades[skill] = optionId;

    // Aplicar efeitos baseados na opção
    switch (optionId) {
        // ── Q Upgrades ──
        case 'q_impacto_estilhacante':
            player.skills.q.cooldown -= 1000; // -1s cooldown
            player.upgradeFlags.q_armorFracture = true;
            break;
        case 'q_rastro_polvora':
            player.upgradeFlags.q_trailMines = true;
            break;
        case 'q_convergencia_assassina':
            player.upgradeFlags.q_narrowCone = true;
            break;

        // ── W Upgrades ──
        case 'w_campo_hemorragia':
            player.upgradeFlags.w_bleedOnRepel = true;
            break;
        case 'w_refracao_vital':
            player.upgradeFlags.w_healOnReflect = true;
            break;
        case 'w_vacuo_magnetico':
            player.upgradeFlags.w_pullInstead = true;
            break;

        // ── E Upgrades ──
        case 'e_carapaca_reativa':
            player.upgradeFlags.e_reactiveShield = true;
            break;
        case 'e_bateria_sobrecarga':
            player.upgradeFlags.e_xpOnAbsorb = true;
            break;
        case 'e_fortaleza_inabalavel':
            player.upgradeFlags.e_fortress = true;
            break;

        // ── Fallback R Upgrades ──
        case 'r_furia_infinita':
            player.upgradeFlags.r_extendOnKill = true;
            break;
        case 'r_distorcao_temporal':
            player.upgradeFlags.r_reducedCooldowns = true;
            break;
        case 'r_singularidade_colapso':
            player.upgradeFlags.r_storedExplosion = true;
            player.ultDamageStored = 0;
            break;

        // ── Red Mutations ──
        case 'r_chuva_tetraedros':
            player.upgradeFlags.r_chuva_tetraedros = true;
            break;
        case 'r_raio_oblivio':
            player.upgradeFlags.r_raio_oblivio = true;
            break;
        case 'r_corte_dimensional':
            player.upgradeFlags.r_corte_dimensional = true;
            break;

        // ── Green Mutations ──
        case 'r_bastiao_titanio':
            player.upgradeFlags.r_bastiao_titanio = true;
            break;
        case 'r_terremoto_geometrico':
            player.upgradeFlags.r_terremoto_geometrico = true;
            break;
        case 'r_armadura_reativa':
            player.upgradeFlags.r_armadura_reativa = true;
            break;

        // ── Purple Mutations ──
        case 'r_singularidade':
            player.upgradeFlags.r_singularidade = true;
            break;
        case 'r_distorcao_temporal_mut':
            player.upgradeFlags.r_distorcao_temporal_mut = true;
            break;
        case 'r_reset_dimensional':
            player.upgradeFlags.r_reset_dimensional = true;
            break;

        // ── Poison Mutations ──
        case 'r_campo_fungos':
            player.upgradeFlags.r_campo_fungos = true;
            break;
        case 'r_olhar_gorgona':
            player.upgradeFlags.r_olhar_gorgona = true;
            break;
        case 'r_raio_peste':
            player.upgradeFlags.r_raio_peste = true;
            break;
    }

    player.isSelectingUpgrade = false;
    return true;
}
