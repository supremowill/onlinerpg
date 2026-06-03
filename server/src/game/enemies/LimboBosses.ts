import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

// ============================================================
// Círculo 1 - Limbo: Guardião do Limbo
// ============================================================
export class GuardiaoDoLimboEnemy extends ServerEnemy {
    public auraRadius: number = 5;
    private habilidades = {
        suspiro: { cooldown: 8000, lastUsed: 0 },
        pesoGeo: { cooldown: 12000, lastUsed: 0, isActive: false, timer: 0, duration: 3000 },
        melancolia: { cooldown: 15000, lastUsed: 0 },
        barreira: { cooldown: 20000, lastUsed: 0, isActive: false, hp: 0, timer: 0, duration: 5000 },
    };
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private playerLevel: number;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.playerLevel = playerLevel;
        this.type = 'GuardiãoDoLimbo';
        this.name = 'Guardião do Limbo';
        const c = CONFIG.GUARDIAO_DO_LIMBO;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.015);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;
        const dist = this.position.distanceToXZ(target.position);

        // Processar timers de habilidades ativas
        if (this.habilidades.barreira.isActive) {
            this.habilidades.barreira.timer -= ms;
            if (this.habilidades.barreira.timer <= 0) {
                this.habilidades.barreira.isActive = false;
                this.speed = this.originalSpeed;
            }
        }

        // Passiva: Névoa da Apatia (aura)
        for (const p of players) {
            if (p.isDead) continue;
            if (this.position.distanceToXZ(p.position) < this.auraRadius) {
                p.applySlow(3000, 0.15); // 15% slow
            }
        }

        // Prioridade: habilidades
        if (now > this.habilidades.melancolia.lastUsed + this.habilidades.melancolia.cooldown) {
            this.habilidades.melancolia.lastUsed = now;
            this.pendingAbilities.push({ type: 'melancolia', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.pesoGeo.lastUsed + this.habilidades.pesoGeo.cooldown) {
            this.habilidades.pesoGeo.lastUsed = now;
            this.pendingAbilities.push({ type: 'pesoGeometrico', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.suspiro.lastUsed + this.habilidades.suspiro.cooldown) {
            this.habilidades.suspiro.lastUsed = now;
            const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
            this.pendingProjectiles.push({ dir, damage: 10, specialEffect: 'suspiroLimbo' });
        } else if (now > this.habilidades.barreira.lastUsed + this.habilidades.barreira.cooldown && !this.habilidades.barreira.isActive) {
            this.habilidades.barreira.isActive = true;
            this.habilidades.barreira.hp = 500 + (this.playerLevel * 100);
            this.habilidades.barreira.timer = this.habilidades.barreira.duration;
            this.speed = this.originalSpeed * 0.7; // Fica lento com escudo
        } else {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);
    }

    toSnapshot() {
        const s = super.toSnapshot();
        (s as any).barreiraActive = this.habilidades.barreira.isActive;
        return s;
    }
}

// ============================================================
// Círculo 2 - Luxúria: Minos, o Árbitro
// ============================================================
export class MinosEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private habilidades = {
        ventoTemp: { cooldown: 6000, lastUsed: 0 },
        julgamento: { cooldown: 10000, lastUsed: 0 },
        furacao: { cooldown: 14000, lastUsed: 0 },
        sentenca: { cooldown: 25000, lastUsed: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Minos';
        this.name = 'Minos, o Árbitro';
        const c = CONFIG.MINOS;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.02);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 2.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();

        // Passiva: Ventos da Punição (rastro de mini-cubos)
        // Implementado via pendingAbility que cria zona no chão
        if (now > this.habilidades.ventoTemp.lastUsed + this.habilidades.ventoTemp.cooldown) {
            this.habilidades.ventoTemp.lastUsed = now;
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const dx = this.position.x + Math.cos(angle) * 5;
                const dz = this.position.z + Math.sin(angle) * 5;
                this.pendingProjectiles.push({
                    dir: new Vec3(Math.cos(angle), 0, Math.sin(angle)),
                    damage: this.damage,
                    specialEffect: 'discoMinos'
                });
            }
        } else if (now > this.habilidades.julgamento.lastUsed + this.habilidades.julgamento.cooldown) {
            this.habilidades.julgamento.lastUsed = now;
            this.pendingAbilities.push({ type: 'anelBumerangue', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.furacao.lastUsed + this.habilidades.furacao.cooldown) {
            this.habilidades.furacao.lastUsed = now;
            this.pendingAbilities.push({ type: 'furacaoMinos', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.sentenca.lastUsed + this.habilidades.sentenca.cooldown) {
            this.habilidades.sentenca.lastUsed = now;
            this.pendingAbilities.push({ type: 'sentencaFinal', x: target.position.x, z: target.position.z });
        } else {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);
    }
}

// ============================================================
// Círculo 3 - Gula: Cérbero Geométrico
// ============================================================
export class CerberoEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private habilidades = {
        mordida: { cooldown: 5000, lastUsed: 0 },
        vomito: { cooldown: 12000, lastUsed: 0 },
        rugido: { cooldown: 18000, lastUsed: 0 },
        devorar: { cooldown: 25000, lastUsed: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Cerbero';
        this.name = 'Cérbero Geométrico';
        const c = CONFIG.CERBERO;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.02);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();

        // Passiva: Fome Insaciável - gera lodo no chão (cooldown 2s)
        if (this.hp < this.maxHp * 0.9 && now > (this as any)._lodoTimer + 2000) {
            (this as any)._lodoTimer = now;
            this.pendingAbilities.push({ type: 'lodoComida', x: this.position.x, z: this.position.z });
        }

        if (now > this.habilidades.mordida.lastUsed + this.habilidades.mordida.cooldown && this.position.distanceToXZ(target.position) < 3) {
            this.habilidades.mordida.lastUsed = now;
            this.pendingAbilities.push({ type: 'mordidaTripla', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.vomito.lastUsed + this.habilidades.vomito.cooldown) {
            this.habilidades.vomito.lastUsed = now;
            this.pendingAbilities.push({ type: 'vomitoGlacial', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.rugido.lastUsed + this.habilidades.rugido.cooldown) {
            this.habilidades.rugido.lastUsed = now;
            this.pendingAbilities.push({ type: 'rugidoCerbero', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.devorar.lastUsed + this.habilidades.devorar.cooldown) {
            this.habilidades.devorar.lastUsed = now;
            this.pendingAbilities.push({ type: 'devorarCerbero', x: target.position.x, z: target.position.z });
        } else {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);
    }
}

// ============================================================
// Círculo 4 - Avareza: Plutão, o Dourado
// ============================================================
export class PlutaoEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private habilidades = {
        rolar: { cooldown: 8000, lastUsed: 0, isDashing: false, dashTimer: 0, dashSpeed: 25 },
        chuva: { cooldown: 15000, lastUsed: 0 },
        avareza: { cooldown: 20000, lastUsed: 0, isActive: false, timer: 0, scale: 1.0 },
        colapso: { cooldown: 30000, lastUsed: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Plutão';
        this.name = 'Plutão, o Dourado';
        const c = CONFIG.PLUTAO;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.03);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 2.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;

        // Passiva: Peso do Ouro - mini-cubos dourados (cooldown 2s)
        if (this.hp < this.maxHp * 0.95 && now > (this as any)._ouroTimer + 2000) {
            (this as any)._ouroTimer = now;
            this.pendingAbilities.push({ type: 'miniCubosDourados', x: this.position.x, z: this.position.z });
        }

        // Dash state
        if (this.habilidades.rolar.isDashing) {
            this.habilidades.rolar.dashTimer -= ms;
            this.moveTowards(target.position, dt, this.habilidades.rolar.dashSpeed);
            if (this.habilidades.rolar.dashTimer <= 0) {
                this.habilidades.rolar.isDashing = false;
                this.pendingAbilities.push({ type: 'rolarEsmagador', x: this.position.x, z: this.position.z, radius: 3 });
            }
            return;
        }

        // Avareza state
        if (this.habilidades.avareza.isActive) {
            this.habilidades.avareza.timer -= ms;
            if (this.habilidades.avareza.timer <= 0) {
                this.habilidades.avareza.isActive = false;
                this.hitboxRadius = (CONFIG as any).PLUTAO.HITBOX_RADIUS;
            }
        }

        if (now > this.habilidades.colapso.lastUsed + this.habilidades.colapso.cooldown) {
            this.habilidades.colapso.lastUsed = now;
            this.pendingAbilities.push({ type: 'colapsoPlutao', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.avareza.lastUsed + this.habilidades.avareza.cooldown && !this.habilidades.avareza.isActive) {
            this.habilidades.avareza.isActive = true;
            this.habilidades.avareza.timer = 5000;
            this.habilidades.avareza.scale = 1.3;
            this.hitboxRadius = (CONFIG as any).PLUTAO.HITBOX_RADIUS * 1.3;
        } else if (now > this.habilidades.chuva.lastUsed + this.habilidades.chuva.cooldown) {
            this.habilidades.chuva.lastUsed = now;
            this.pendingAbilities.push({ type: 'chuvaRiquezas', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.rolar.lastUsed + this.habilidades.rolar.cooldown) {
            this.habilidades.rolar.lastUsed = now;
            this.habilidades.rolar.isDashing = true;
            this.habilidades.rolar.dashTimer = 500; // 0.5s dash
        } else {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);
    }
}

// ============================================================
// Círculo 5 - Ira: Fúria, o Furioso
// ============================================================
export class FuriaEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private habilidades = {
        explosao: { cooldown: 6000, lastUsed: 0 },
        lancarOdio: { cooldown: 10000, lastUsed: 0 },
        pulo: { cooldown: 15000, lastUsed: 0 },
        pilar: { cooldown: 20000, lastUsed: 0 },
    };
    private furorActive = false;

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Fúria';
        this.name = 'Fúria, o Furioso';
        const c = CONFIG.FURIA;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * (1 - this.hp / this.maxHp) * 0.01);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.25;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();

        // Passiva: Fervor - abaixo 50% HP, velocidade dobra
        const hpPct = this.hp / this.maxHp;
        if (hpPct < 0.5 && !this.furorActive) {
            this.furorActive = true;
            this.speed = this.originalSpeed * 2;
        } else if (hpPct >= 0.5) {
            this.furorActive = false;
            this.speed = this.originalSpeed * (1 + (1 - hpPct)); // Aumenta conforme perde vida
        }

        if (now > this.habilidades.pilar.lastUsed + this.habilidades.pilar.cooldown) {
            this.habilidades.pilar.lastUsed = now;
            this.pendingAbilities.push({ type: 'pilarIra', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.pulo.lastUsed + this.habilidades.pulo.cooldown) {
            this.habilidades.pulo.lastUsed = now;
            this.pendingAbilities.push({ type: 'puloFurioso', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.lancarOdio.lastUsed + this.habilidades.lancarOdio.cooldown) {
            this.habilidades.lancarOdio.lastUsed = now;
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                this.pendingProjectiles.push({
                    dir: new Vec3(Math.cos(angle), 0, Math.sin(angle)),
                    damage: this.damage,
                    specialEffect: 'losangoVermelho'
                });
            }
        } else if (now > this.habilidades.explosao.lastUsed + this.habilidades.explosao.cooldown) {
            this.habilidades.explosao.lastUsed = now;
            this.pendingAbilities.push({ type: 'explosaoFuria', x: this.position.x, z: this.position.z, radius: 5 });
        } else {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);
    }
}

// ============================================================
// Círculo 6 - Heresia: Megera das Chamas
// ============================================================
export class MegeraEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private habilidades = {
        lasers: { cooldown: 5000, lastUsed: 0, angle: 0 },
        selo: { cooldown: 12000, lastUsed: 0 },
        teleporte: { cooldown: 15000, lastUsed: 0 },
        chuvaCaixas: { cooldown: 25000, lastUsed: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Megera';
        this.name = 'Megera das Chamas';
        const c = CONFIG.MEGERA;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.03);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();

        // Passiva: Tumba - imune a stun/slow
        this.statusManager.removeStatus('slowed'); // Passiva: Tumba - imune a slow\n

        if (now > this.habilidades.chuvaCaixas.lastUsed + this.habilidades.chuvaCaixas.cooldown) {
            this.habilidades.chuvaCaixas.lastUsed = now;
            this.pendingAbilities.push({ type: 'chuvaCaixas', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.teleporte.lastUsed + this.habilidades.teleporte.cooldown) {
            this.habilidades.teleporte.lastUsed = now;
            const angle = Math.random() * Math.PI * 2;
            this.position.x = Math.cos(angle) * 30;
            this.position.z = Math.sin(angle) * 30;
            this.pendingAbilities.push({ type: 'tiroTeleguiado', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.selo.lastUsed + this.habilidades.selo.cooldown) {
            this.habilidades.selo.lastUsed = now;
            this.pendingAbilities.push({ type: 'seloMegera', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.lasers.lastUsed + this.habilidades.lasers.cooldown) {
            this.habilidades.lasers.lastUsed = now;
            this.habilidades.lasers.angle += 0.3;
            for (let i = 0; i < 8; i++) {
                const angle = this.habilidades.lasers.angle + (i / 8) * Math.PI * 2;
                this.pendingProjectiles.push({
                    dir: new Vec3(Math.cos(angle), 0, Math.sin(angle)),
                    damage: this.damage,
                    specialEffect: 'laserHeresia'
                });
            }
        } else {
            // Fica parada (estática na maioria do tempo)
            if (Math.random() < 0.01) { // Teleporte ocasional
                const angle = Math.random() * Math.PI * 2;
                this.position.x = Math.cos(angle) * 30;
                this.position.z = Math.sin(angle) * 30;
            }
        }
        this.lookAt(target.position);
    }
}

// ============================================================
// Círculo 7 - Violência: Minotauro de Sangue
// ============================================================
export class MinotauroEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private habilidades = {
        investida: { cooldown: 6000, lastUsed: 0, isDashing: false, dashTimer: 0 },
        pisada: { cooldown: 10000, lastUsed: 0 },
        giro: { cooldown: 15000, lastUsed: 0 },
        rio: { cooldown: 22000, lastUsed: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Minotauro';
        this.name = 'Minotauro de Sangue';
        const c = CONFIG.MINOTAURO;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.04);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now(); const ms = dt * 1000;

        // Passiva: Sede - sangra cubos, rouba vida (cooldown 2s)
        if (this.hp < this.maxHp * 0.95 && now > (this as any)._sedeTimer + 2000) {
            (this as any)._sedeTimer = now;
            this.pendingAbilities.push({ type: 'sangraCubos', x: this.position.x, z: this.position.z });
        }

        // Dash state
        if (this.habilidades.investida.isDashing) {
            this.habilidades.investida.dashTimer -= ms;
            this.moveTowards(target.position, dt, 20); // Alta velocidade
            if (this.habilidades.investida.dashTimer <= 0) {
                this.habilidades.investida.isDashing = false;
                this.pendingAbilities.push({ type: 'investidaMinotauro', x: this.position.x, z: this.position.z });
            }
            return;
        }

        if (now > this.habilidades.rio.lastUsed + this.habilidades.rio.cooldown) {
            this.habilidades.rio.lastUsed = now;
            this.pendingAbilities.push({ type: 'rioSangue', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.giro.lastUsed + this.habilidades.giro.cooldown) {
            this.habilidades.giro.lastUsed = now;
            this.pendingAbilities.push({ type: 'giroMinotauro', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.pisada.lastUsed + this.habilidades.pisada.cooldown) {
            this.habilidades.pisada.lastUsed = now;
            this.pendingAbilities.push({ type: 'pisadaSismica', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.investida.lastUsed + this.habilidades.investida.cooldown) {
            this.habilidades.investida.lastUsed = now;
            this.habilidades.investida.isDashing = true;
            this.habilidades.investida.dashTimer = 600; // 0.6s dash
        } else {
            this.moveTowards(target.position, dt);
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        super.takeDamage(amount, instigator, countsForPassive);
        // Passiva: Sede - rouba 5% do dano como vida
        if (instigator && !this.isDestroyed) {
            const heal = amount * 0.05;
            this.hp = Math.min(this.maxHp, this.hp + heal);
        }
    }
}

// ============================================================
// Círculo 8 - Fraude: Gerião, a Ilusão
// ============================================================
export class GeriaoEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    public clones: string[] = [];
    private habilidades = {
        dardo: { cooldown: 5000, lastUsed: 0 },
        clones: { cooldown: 15000, lastUsed: 0 },
        confusao: { cooldown: 20000, lastUsed: 0 },
        buracoNegro: { cooldown: 30000, lastUsed: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Geriao';
        this.name = 'Gerião, a Ilusão';
        const c = CONFIG.GERIAO;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.02); // Veneno
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 1.5;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const target = this.getClosestPlayer(players);
        if (!target) return;
        const now = Date.now();

        // Passiva: Mentira - 20% chance ignorar dano (handled in takeDamage)
        // Crítico = invisível (handled in snapshot)

        if (now > this.habilidades.buracoNegro.lastUsed + this.habilidades.buracoNegro.cooldown) {
            this.habilidades.buracoNegro.lastUsed = now;
            this.pendingAbilities.push({ type: 'buracoNegro', x: this.position.x, z: this.position.z });
        } else if (now > this.habilidades.confusao.lastUsed + this.habilidades.confusao.cooldown) {
            this.habilidades.confusao.lastUsed = now;
            this.pendingAbilities.push({ type: 'confusaoGeriao', x: target.position.x, z: target.position.z });
        } else if (now > this.habilidades.clones.lastUsed + this.habilidades.clones.cooldown && this.clones.length === 0) {
            this.habilidades.clones.lastUsed = now;
            this.pendingAbilities.push({ type: 'clonesGeriao', x: this.position.x, z: this.position.z, count: 3 });
        } else if (now > this.habilidades.dardo.lastUsed + this.habilidades.dardo.cooldown) {
            this.habilidades.dardo.lastUsed = now;
            const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
            this.pendingProjectiles.push({ dir, damage: this.damage, specialEffect: 'dardoGeriao' });
        } else {
            // Foge constantemente
            const away = this.position.clone().sub(target.position); away.y = 0; away.normalize();
            this.position.add(away.multiplyScalar(this.speed * dt));
        }
        this.lookAt(target.position);
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        // Passiva: Mentira - 20% chance ignorar dano
        if (Math.random() < 0.20) return;
        super.takeDamage(amount, instigator, countsForPassive);
    }
}

// ============================================================
// Círculo 9 - Traição: Lúcifer Cósmico (BOSS FINAL)
// ============================================================
export class LuciferEnemy extends ServerEnemy {
    public pendingProjectiles: { dir: Vec3, damage: number, specialEffect?: string }[] = [];
    public pendingAbilities: any[] = [];
    private habilidades = {
        traicao: { cooldown: 4000, lastUsed: 0 },
        varredura: { cooldown: 12000, lastUsed: 0 },
        lasers: { cooldown: 20000, lastUsed: 0 },
        queda: { cooldown: 40000, lastUsed: 0 },
    };

    constructor(pos: Vec3, globalMult: number, playerLevel: number, playerMaxHp: number) {
        super(pos);
        this.type = 'Lúcifer';
        this.name = 'Lúcifer Cósmico';
        const c = CONFIG.LUCIFER;
        this.maxHp = (this.getRegHp(c.BASE_HP) + playerLevel * c.HP_PER_LEVEL) * globalMult;
        this.hp = this.maxHp;
        this.damage = this.getRegDamage(c.BASE_DAMAGE) + (playerMaxHp * 0.05);
        this.speed = this.getRegSpeed(c.SPEED); this.originalSpeed = this.getRegSpeed(c.SPEED);
        this.xp = this.getRegXp(c.XP); this.score = this.getRegScore(c.SCORE);
        this.hitboxRadius = this.getRegHitbox(c.HITBOX_RADIUS);
        this.position.y = 2.0;
        // Imóvel no centro do mapa
        this.position.x = 0; this.position.z = 0;
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        if (this.isDestroyed || this.updateStatus(dt)) return;
        const now = Date.now();

        // Passiva: Zero Absoluto - transforma cenário em gelo
        // Bordas do mapa dão hit kill (handled in collision)
        for (const p of players) {
            if (p.isDead) continue;
            // Perde 10% velocidade permanentemente (handled via status effect)
            if (!p.statusEffects.slowed.isActive) {
                p.applySlow(999999, 0.90); // Quase parado
            }
        }

        if (now > this.habilidades.queda.lastUsed + this.habilidades.queda.cooldown) {
            this.habilidades.queda.lastUsed = now;
            this.pendingAbilities.push({ type: 'quedaTitanica', x: 0, z: 0 });
        } else if (now > this.habilidades.lasers.lastUsed + this.habilidades.lasers.cooldown) {
            this.habilidades.lasers.lastUsed = now;
            const target = this.getClosestPlayer(players);
            if (target) {
                for (let i = 0; i < 3; i++) {
                    const dir = target.position.clone().sub(this.position); dir.y = 0; dir.normalize();
                    this.pendingProjectiles.push({ dir, damage: this.damage * 3, specialEffect: 'laserFrio' });
                }
            }
        } else if (now > this.habilidades.varredura.lastUsed + this.habilidades.varredura.cooldown) {
            this.habilidades.varredura.lastUsed = now;
            this.pendingAbilities.push({ type: 'varreduraLucifer', x: 0, z: 0 });
        } else if (now > this.habilidades.traicao.lastUsed + this.habilidades.traicao.cooldown) {
            this.habilidades.traicao.lastUsed = now;
            const target = this.getClosestPlayer(players);
            if (target) {
                this.pendingAbilities.push({ type: 'traicaoCongelada', x: target.position.x, z: target.position.z });
            }
        }
        // O núcleo é imóvel - não faz moveTowards
    }
}
