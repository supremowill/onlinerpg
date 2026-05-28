import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { GameEngine } from '../game/GameEngine';
import { CONFIG } from '../config';
import { ClientMessage, ServerMessage, PlayerBuild } from '../network/Protocol';
import { rankingService } from '../database/ranking';
import { getUpgradePromptForLevel, applyUpgrade } from '../game/UpgradeSystem';

export class Room {
    public id: string = uuidv4();
    public players: Map<string, WebSocket> = new Map();
    public playerNames: Map<string, string> = new Map();
    public engine: GameEngine;
    private tickInterval: NodeJS.Timeout | null = null;
    private startTime = Date.now();
    public isFinished = false;

    constructor() {
        this.engine = new GameEngine(0);
    }

    addPlayer(playerId: string, name: string, ws: WebSocket, platform: 'pc' | 'mobile' = 'pc', build?: PlayerBuild): void {
        this.players.set(playerId, ws);
        this.playerNames.set(playerId, name);
        this.engine.addPlayer(playerId, name, platform, build);
        console.log(`[Room ${this.id.slice(0, 8)}] Player joined: ${name} [${platform}] (${this.players.size}/${CONFIG.MAX_PLAYERS_PER_ROOM})`);
    }

    removePlayer(playerId: string): void {
        this.players.delete(playerId);
        this.engine.removePlayer(playerId);
        const name = this.playerNames.get(playerId) || 'unknown';
        this.playerNames.delete(playerId);
        console.log(`[Room ${this.id.slice(0, 8)}] Player left: ${name} (${this.players.size} remaining)`);
        if (this.players.size === 0) this.stop();
    }

    start(): void {
        this.startTime = Date.now();
        console.log(`[Room ${this.id.slice(0, 8)}] Game started with ${this.players.size} players`);
        // Send individual GAME_START with correct playerId
        for (const [pid, ws] of this.players) {
            this.send(ws, { type: 'GAME_START', payload: { yourPlayerId: pid, obstacles: this.engine.obstacles } });
        }
        const tickMs = CONFIG.TICK_INTERVAL_MS;
        this.tickInterval = setInterval(() => this.tick(), tickMs);
    }

    private tick(): void {
        const dt = 1 / CONFIG.TICK_RATE;
        // Set enemyMap for all players (for assassin upgrade)
        const enemyMap = new Map<string, any>();
        for (const e of this.engine.enemies) enemyMap.set(e.id, e);
        for (const p of this.engine.players.values()) p.enemyMap = enemyMap;
        this.engine.updateTick(dt);
        const snapshot = this.engine.getSnapshot();
        this.broadcast({ type: 'GAME_STATE', payload: snapshot });

        for (const p of this.engine.players.values()) {
            if (p.justDied) {
                p.justDied = false;
                this.broadcast({ type: 'PLAYER_DIED', payload: { playerId: p.id, playerName: p.name, score: p.score } });
            }
        }

        // Check for upgrade prompts
        for (const p of this.engine.players.values()) {
            if (p.isSelectingUpgrade && p.pendingUpgradeLevel > 0) {
                const prompt = getUpgradePromptForLevel(p.pendingUpgradeLevel, p);
                if (prompt) {
                    const ws = this.players.get(p.id);
                    if (ws) this.send(ws, { type: 'UPGRADE_PROMPT', payload: prompt });
                }
                p.pendingUpgradeLevel = 0; // Only send once
            }
        }

        // Broadcast pending game events (Faraó warnings, eclipses, etc.)
        if (this.engine.pendingEvents.length > 0) {
            for (const ev of this.engine.pendingEvents) {
                this.broadcast({ type: 'EVENT', payload: ev } as any);
            }
            this.engine.pendingEvents = [];
        }

        if (this.engine.isGameOver) this.endGame();
    }

    handleMessage(playerId: string, msg: ClientMessage): void {
        const player = this.engine.players.get(playerId);
        if (!player) return;
        switch (msg.type) {
            case 'INPUT_STATE':
                player.input = msg.payload;
                if (player.platform === 'pc') {
                    // Use raycaster world coords for both projectile direction AND visual rotation
                    if (msg.payload.worldX !== undefined && msg.payload.worldZ !== undefined) {
                        // setFacingDirection updates both facingDirection AND rotationY from world coords
                        player.setFacingDirection(msg.payload.worldX, msg.payload.worldZ);
                    } else {
                        // Fallback: derive from screen-space mouse position
                        const mx = msg.payload.mouseX ?? 0;
                        const my = msg.payload.mouseY ?? 0;
                        player.rotationY = Math.atan2(mx, -my);
                        player.setFacingDirectionFromScreen(mx, -my);
                    }
                }
                break;
            case 'MOVE_TO':
                player.setTargetPosition(msg.payload.x, msg.payload.z);
                break;
            case 'ATTACK_START': player.isAttacking = true; break;
            case 'ATTACK_STOP': player.isAttacking = false; break;
            case 'USE_SKILL': this.engine.handleSkill(playerId, msg.payload.skill); break;
            case 'SELECT_PLATFORM': player.platform = msg.payload.platform; break;
            case 'CHOOSE_UPGRADE':
                if ('skip' in msg.payload) player.skipUpgrade();
                else player.upgradeSkill(msg.payload.skillKey);
                break;
            case 'UPGRADE_SELECT': {
                const { skill, option } = msg.payload;
                if (applyUpgrade(player, skill, option)) {
                    const ws = this.players.get(playerId);
                    if (ws) this.send(ws, { type: 'UPGRADE_APPLIED' } as any);
                }
                break;
            }
            case 'PING':
                const ws = this.players.get(playerId);
                if (ws) this.send(ws, { type: 'PONG', payload: { serverTime: Date.now() } });
                break;
        }
    }

    private async endGame(): Promise<void> {
        if (this.isFinished) return;
        this.isFinished = true;
        this.stop();
        const scores = [...this.engine.players.values()]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => ({ playerId: p.id, playerName: p.name, score: p.score, rank: i + 1 }));
        const time = (Date.now() - this.startTime) / 1000;
        const winner = scores[0];
        this.broadcast({ type: 'GAME_OVER', payload: { scores, time, collapseLevel: this.engine.spawnManager.collapseLevel, winner } });
        // Save to DB
        try {
            for (const p of this.engine.players.values()) {
                const deaths = p.isDead ? 1 : 0;
                const assists = 0; // Not tracked currently
                const rUpgrade = p.selectedUpgrades?.['r'];
                let floor5 = 0;
                if (rUpgrade) {
                    const options = ['r_chuva_tetraedros', 'r_raio_oblivio', 'r_corte_dimensional', 
                                     'r_bastiao_titanio', 'r_terremoto_geometrico', 'r_armadura_reativa', 
                                     'r_singularidade', 'r_distorcao_temporal_mut', 'r_reset_dimensional'];
                    const idx = options.indexOf(rUpgrade);
                    if (idx !== -1) {
                        floor5 = (idx % 3) + 1;
                    }
                }
                p.build.floor5 = floor5;
                await rankingService.postScore(p.name, p.score, time, this.engine.spawnManager.collapseLevel, p.kills, this.id, this.players.size, deaths, assists, p.build);
            }
            await rankingService.saveMatchHistory(this.id, scores.length, time, this.engine.spawnManager.collapseLevel);
        } catch (e) { console.error('[Room] Failed to save scores:', e); }
        console.log(`[Room ${this.id.slice(0, 8)}] Game over. Winner: ${winner?.playerName} (${winner?.score})`);
    }

    stop(): void {
        if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    }

    broadcast(msg: ServerMessage): void {
        const data = JSON.stringify(msg);
        for (const ws of this.players.values()) {
            if (ws.readyState === WebSocket.OPEN) ws.send(data);
        }
    }

    send(ws: WebSocket, msg: ServerMessage): void {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    }
}
