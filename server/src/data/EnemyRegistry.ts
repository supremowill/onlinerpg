/**
 * EnemyRegistry.ts — Cache em RAM de definições de inimigos
 * 
 * Map<string, EnemyDefinition> com acesso O(1).
 * Populado UMA VEZ no startup. Read-only durante o runtime.
 */
import { EnemyDefinition, EnemyStats, EnemyVisuals } from './GameDataTypes';

class EnemyRegistryClass {
    private _enemies: Map<string, EnemyDefinition> = new Map();

    init(enemies: Record<string, EnemyDefinition>): void {
        this._enemies.clear();
        for (const [key, def] of Object.entries(enemies)) {
            def.id = key;
            this._enemies.set(key, def);
        }
        console.log(`[EnemyRegistry] ✅ ${this._enemies.size} enemies registered`);
    }

    /** Retorna a definição completa do inimigo, ou undefined se não encontrado */
    get(id: string): EnemyDefinition | undefined {
        return this._enemies.get(id);
    }

    /** Retorna apenas os stats base */
    getStats(id: string): EnemyStats | undefined {
        return this._enemies.get(id)?.stats;
    }

    /** Retorna apenas os visuals */
    getVisuals(id: string): EnemyVisuals | undefined {
        return this._enemies.get(id)?.visuals;
    }

    /** Verifica se o inimigo existe no registry */
    has(id: string): boolean {
        return this._enemies.has(id);
    }

    /** Retorna todos os IDs registrados */
    getAllIds(): string[] {
        return [...this._enemies.keys()];
    }

    /** Retorna todas as definições */
    getAll(): EnemyDefinition[] {
        return [...this._enemies.values()];
    }

    /** Retorna quantidade de inimigos registrados */
    get size(): number {
        return this._enemies.size;
    }
}

/** Instância global singleton */
export const EnemyRegistry = new EnemyRegistryClass();
