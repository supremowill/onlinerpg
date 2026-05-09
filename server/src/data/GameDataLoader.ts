/**
 * GameDataLoader.ts — Leitura síncrona do game_data.json no startup
 * 
 * Regra de Performance: fs.readFileSync APENAS no startup.
 * Zero leituras de disco durante o game loop.
 * Crash fast: se o JSON é inválido, o servidor não inicia.
 */
import * as fs from 'fs';
import * as path from 'path';
import { GameData, EnemyDefinition } from './GameDataTypes';
import { EnemyRegistry } from './EnemyRegistry';
import { StatusRegistry } from './StatusRegistry';
import { AIBrainRegistry } from './AIBrainRegistry';

let _gameData: GameData | null = null;

/**
 * Carrega e valida o game_data.json.
 * Deve ser chamado UMA VEZ no startup (index.ts ou config.ts).
 * Popula os 3 registries globais em memória.
 */
export function loadGameData(): GameData {
    const jsonPath = path.resolve(__dirname, '../../game_data.json');
    console.log(`[GameDataLoader] Loading game_data.json from: ${jsonPath}`);

    let raw: string;
    try {
        raw = fs.readFileSync(jsonPath, 'utf-8');
    } catch (err: any) {
        console.error(`[GameDataLoader] FATAL: Cannot read game_data.json: ${err.message}`);
        console.warn('[GameDataLoader] Server will continue with CONFIG fallback only.');
        _gameData = { version: '0.0.0', enemies: {} };
        initRegistries(_gameData);
        return _gameData;
    }

    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch (err: any) {
        console.error(`[GameDataLoader] FATAL: Invalid JSON in game_data.json: ${err.message}`);
        throw new Error(`game_data.json parse error: ${err.message}`);
    }

    // Validação básica do schema
    if (!parsed.enemies || typeof parsed.enemies !== 'object') {
        throw new Error('game_data.json: missing or invalid "enemies" field');
    }

    // Injetar o id em cada definição (a chave do Record é o ID oficial)
    for (const [key, def] of Object.entries(parsed.enemies)) {
        (def as EnemyDefinition).id = key;
    }

    _gameData = parsed as GameData;
    initRegistries(_gameData);

    const enemyCount = Object.keys(_gameData.enemies).length;
    console.log(`[GameDataLoader] ✅ Loaded ${enemyCount} enemy definitions (v${_gameData.version})`);
    return _gameData;
}

function initRegistries(data: GameData): void {
    EnemyRegistry.init(data.enemies);
    StatusRegistry.init();
    AIBrainRegistry.init();
    console.log(`[GameDataLoader] ✅ All registries initialized`);
}

/** Acesso read-only ao GameData carregado */
export function getGameData(): GameData {
    if (!_gameData) {
        throw new Error('GameData not loaded. Call loadGameData() first.');
    }
    return _gameData;
}
