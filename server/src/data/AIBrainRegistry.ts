/**
 * AIBrainRegistry.ts — Strategy Pattern para comportamentos de IA
 * 
 * Map<string, AIBrainFunction> delega algoritmos de Steering Behavior
 * por string, sem switch/case no game loop.
 * 
 * O campo `ai.profile` do game_data.json é a chave de lookup.
 */
import { ServerEnemy } from '../game/enemies/Enemy';
import { ServerPlayer } from '../game/Player';
import { Vec3 } from '../utils/Vector3';

export type AIBrainFunction = (
    enemy: ServerEnemy,
    target: ServerPlayer,
    dt: number,
    params?: Record<string, number>
) => void;

class AIBrainRegistryClass {
    private _brains: Map<string, AIBrainFunction> = new Map();

    init(): void {
        this._brains.clear();
        this.registerBuiltinBrains();
        console.log(`[AIBrainRegistry] ✅ ${this._brains.size} AI profiles registered`);
    }

    /** Registra um perfil de IA */
    registerBrain(profile: string, fn: AIBrainFunction): void {
        this._brains.set(profile, fn);
    }

    /** Executa o comportamento de IA do perfil */
    execute(profile: string, enemy: ServerEnemy, target: ServerPlayer, dt: number, params?: Record<string, number>): boolean {
        const brain = this._brains.get(profile);
        if (!brain) {
            console.warn(`[AIBrainRegistry] No brain for profile: "${profile}"`);
            return false;
        }
        brain(enemy, target, dt, params);
        return true;
    }

    has(profile: string): boolean {
        return this._brains.has(profile);
    }

    // ============================================================
    // Steering Behaviors pré-programados
    // ============================================================
    private registerBuiltinBrains(): void {

        // CHASER: perseguição direta ao alvo mais próximo
        this.registerBrain('chaser', (enemy, target, dt) => {
            enemy.moveTowards(target.position, dt);
            enemy.lookAt(target.position);
        });

        // FLANKER: abordagem tangencial (produto vetorial cruzado)
        this.registerBrain('flanker', (enemy, target, dt) => {
            const toTarget = target.position.clone().sub(enemy.position);
            toTarget.y = 0;
            const dist = toTarget.length();
            toTarget.normalize();
            // Cross product com Y-up para obter vetor perpendicular
            const perpendicular = new Vec3(-toTarget.z, 0, toTarget.x);
            // Alternar lado baseado no ID do inimigo (hash simples)
            const side = (enemy.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
            // Combinar: 70% em direção ao alvo + 30% perpendicular
            const moveDir = toTarget.multiplyScalar(0.7).add(perpendicular.multiplyScalar(0.3 * side));
            moveDir.normalize();
            enemy.position.add(moveDir.multiplyScalar(enemy.speed * dt));
            enemy.lookAt(target.position);
        });

        // KITER: mantém distância ideal, recua se muito perto
        this.registerBrain('kiter', (enemy, target, dt, params) => {
            const idealRange = params?.idealRange ?? 15;
            const retreatRange = params?.retreatRange ?? 8;
            const dist = enemy.position.distanceToXZ(target.position);

            if (dist < retreatRange) {
                // Recuar
                const away = enemy.position.clone().sub(target.position);
                away.y = 0; away.normalize();
                enemy.position.add(away.multiplyScalar(enemy.speed * dt));
            } else if (dist > idealRange) {
                // Aproximar
                enemy.moveTowards(target.position, dt);
            }
            // Dentro da faixa ideal: parado, apenas olha
            enemy.lookAt(target.position);
        });

        // TURRET: estacionário, apenas rotaciona para encarar
        this.registerBrain('turret', (enemy, target, _dt) => {
            enemy.lookAt(target.position);
        });

        // ORBITER: órbita circular ao redor do alvo
        this.registerBrain('orbiter', (enemy, target, dt, params) => {
            const orbitRadius = params?.orbitRadius ?? 10;
            const orbitSpeed = params?.orbitSpeed ?? 1.5;
            const toTarget = target.position.clone().sub(enemy.position);
            toTarget.y = 0;
            const dist = toTarget.length();

            if (Math.abs(dist - orbitRadius) > 2) {
                // Ajustar distância
                if (dist > orbitRadius) {
                    enemy.moveTowards(target.position, dt);
                } else {
                    const away = enemy.position.clone().sub(target.position);
                    away.y = 0; away.normalize();
                    enemy.position.add(away.multiplyScalar(enemy.speed * dt));
                }
            } else {
                // Orbitar
                toTarget.normalize();
                const tangent = new Vec3(-toTarget.z, 0, toTarget.x);
                enemy.position.add(tangent.multiplyScalar(orbitSpeed * dt));
            }
            enemy.lookAt(target.position);
        });

        // WANDERER: patrulha aleatória, persegue ao detectar
        this.registerBrain('wanderer', (enemy, target, dt, params) => {
            const aggroRange = params?.aggroRange ?? 20;
            const dist = enemy.position.distanceToXZ(target.position);

            if (dist < aggroRange) {
                // Dentro do aggro: perseguir
                enemy.moveTowards(target.position, dt);
            } else {
                // Fora do aggro: andar aleatoriamente
                if (Math.random() < 0.02) {
                    const angle = Math.random() * Math.PI * 2;
                    const wanderDir = new Vec3(Math.cos(angle), 0, Math.sin(angle));
                    enemy.position.add(wanderDir.multiplyScalar(enemy.speed * dt));
                }
            }
            enemy.lookAt(target.position);
        });

        // COWARD: foge do alvo permanentemente
        this.registerBrain('coward', (enemy, target, dt) => {
            const away = enemy.position.clone().sub(target.position);
            away.y = 0; away.normalize();
            enemy.position.add(away.multiplyScalar(enemy.speed * dt));
            enemy.lookAt(target.position);
        });

        // STATIC: não se move (para bosses imóveis como Lúcifer)
        this.registerBrain('static', (enemy, target, _dt) => {
            enemy.lookAt(target.position);
        });
    }
}

/** Instância global singleton */
export const AIBrainRegistry = new AIBrainRegistryClass();
