/**
 * StatusRegistry.ts — Strategy Pattern para passivas/status effects
 * 
 * Map<string, StatusHandler> resolve lógicas matemáticas pré-programadas
 * sem instruções condicionais gigantescas (switch/case massivos) ou eval().
 * 
 * Para adicionar uma nova passiva:
 * 1. Defina a string no game_data.json (ex: "poison_on_hit")
 * 2. Registre o handler aqui com registerHandler()
 * Pronto. Zero código condicional necessário.
 */
import { ServerPlayer } from '../game/Player';

export interface StatusContext {
    target: any;            // Quem recebe o efeito (player ou enemy)
    instigator?: any;       // Quem causou (enemy ou player)
    value: number;          // Intensidade do efeito
    duration?: number;      // Duração em ms
    chance?: number;        // Probabilidade (0-1)
    damage?: number;        // Dano do hit que ativou a passiva
}

export type StatusHandler = (ctx: StatusContext) => void;

class StatusRegistryClass {
    private _handlers: Map<string, StatusHandler> = new Map();

    init(): void {
        this._handlers.clear();
        this.registerBuiltinHandlers();
        console.log(`[StatusRegistry] ✅ ${this._handlers.size} status handlers registered`);
    }

    /** Registra um handler para um tipo de passiva */
    registerHandler(type: string, handler: StatusHandler): void {
        this._handlers.set(type, handler);
    }

    /** Executa o handler da passiva, se existir */
    apply(type: string, ctx: StatusContext): boolean {
        const handler = this._handlers.get(type);
        if (!handler) {
            console.warn(`[StatusRegistry] No handler for passive type: "${type}"`);
            return false;
        }
        // Check de probabilidade (se definido)
        if (ctx.chance !== undefined && Math.random() > ctx.chance) {
            return false;
        }
        handler(ctx);
        return true;
    }

    /** Verifica se um handler existe para o tipo dado */
    has(type: string): boolean {
        return this._handlers.has(type);
    }

    // ============================================================
    // Handlers pré-programados (built-in)
    // Cada handler é uma função pura — sem side effects globais
    // ============================================================
    private registerBuiltinHandlers(): void {
        // Sangramento: dano por segundo durante duration
        this.registerHandler('bleed_on_hit', (ctx) => {
            if (ctx.target.applyBleed) {
                ctx.target.applyBleed(ctx.duration ?? 4000, ctx.value);
            }
        });

        // Roubo de vida: cura o instigator em % do dano causado
        this.registerHandler('lifesteal', (ctx) => {
            if (ctx.instigator?.heal && ctx.damage) {
                ctx.instigator.heal(ctx.damage * ctx.value);
            }
        });

        // Veneno: dano por segundo (similar a bleed, mas outro visual)
        this.registerHandler('poison', (ctx) => {
            if (ctx.target.applyPoison) {
                ctx.target.applyPoison(ctx.duration ?? 3000, ctx.value);
            } else if (ctx.target.applyBleed) {
                // Fallback: usar bleed se poison não existe
                ctx.target.applyBleed(ctx.duration ?? 3000, ctx.value);
            }
        });

        // Stun ao acertar
        this.registerHandler('stun_on_hit', (ctx) => {
            if (ctx.target.applyStun) {
                ctx.target.applyStun(ctx.duration ?? 1000);
            }
        });

        // Slow ao acertar
        this.registerHandler('slow_on_hit', (ctx) => {
            if (ctx.target.applySlow) {
                ctx.target.applySlow(ctx.duration ?? 1500, ctx.value);
            }
        });

        // Queimadura
        this.registerHandler('burn_on_hit', (ctx) => {
            if (ctx.target.applyBurn) {
                ctx.target.applyBurn(ctx.duration ?? 3000, ctx.value);
            }
        });

        // Congelamento
        this.registerHandler('freeze_on_hit', (ctx) => {
            if (ctx.target.applyFreeze) {
                ctx.target.applyFreeze(ctx.duration ?? 2000);
            }
        });

        // Knockback ao acertar
        this.registerHandler('knockback_on_hit', (ctx) => {
            if (ctx.target.applyKnockback && ctx.instigator) {
                const dir = ctx.target.position.clone().sub(ctx.instigator.position).normalize();
                ctx.target.applyKnockback(dir, ctx.value);
            }
        });

        // Marca: próximo hit causa dano extra
        this.registerHandler('mark_on_hit', (ctx) => {
            if (ctx.target.status) {
                ctx.target.status.isMarked = true;
            }
        });

        // Armor fracture: reduz defesa temporariamente
        this.registerHandler('armor_fracture', (ctx) => {
            if (ctx.target.applyArmorFracture) {
                ctx.target.applyArmorFracture(ctx.duration ?? 4000, ctx.value);
            }
        });

        // Root: impede movimento
        this.registerHandler('root_on_hit', (ctx) => {
            if (ctx.target.applyRoot) {
                ctx.target.applyRoot(ctx.duration ?? 2000);
            }
        });

        // Desorientação
        this.registerHandler('disorient_on_hit', (ctx) => {
            if (ctx.target.applyDisorientation) {
                ctx.target.applyDisorientation(ctx.duration ?? 1000);
            }
        });

        // Dano % do HP máximo do alvo
        this.registerHandler('percent_hp_damage', (ctx) => {
            if (ctx.target.takeDamage && ctx.target.maxHp) {
                ctx.target.takeDamage(ctx.target.maxHp * ctx.value, null, false);
            }
        });

        // Imunidade a CC (crowd control)
        this.registerHandler('cc_immunity', (_ctx) => {
            // Marcador — o sistema de combate verifica se a passiva existe
            // antes de aplicar CC. Não precisa de handler ativo.
        });

        // Dodge: chance de ignorar dano
        this.registerHandler('dodge', (_ctx) => {
            // Marcador — verificado no takeDamage do inimigo
        });
    }
}

/** Instância global singleton */
export const StatusRegistry = new StatusRegistryClass();
