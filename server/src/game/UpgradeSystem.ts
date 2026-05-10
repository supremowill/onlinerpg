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
export function getUpgradePromptForLevel(level: number): UpgradePrompt | null {
    const skill = UPGRADE_LEVEL_MAP[level];
    if (!skill) return null;
    return {
        level,
        skill,
        options: UPGRADE_DEFINITIONS[skill],
    };
}

/**
 * Aplica o upgrade selecionado ao player.
 * Retorna true se aplicado com sucesso.
 */
export function applyUpgrade(player: ServerPlayer, skill: string, optionId: string): boolean {
    const options = UPGRADE_DEFINITIONS[skill];
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

        // ── R Upgrades ──
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
    }

    player.isSelectingUpgrade = false;
    return true;
}
