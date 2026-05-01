"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const uuid_1 = require("uuid");
const ws_1 = __importDefault(require("ws"));
const GameEngine_1 = require("../game/GameEngine");
const config_1 = require("../config");
const ranking_1 = require("../database/ranking");
class Room {
    id = (0, uuid_1.v4)();
    players = new Map();
    playerNames = new Map();
    engine;
    tickInterval = null;
    startTime = Date.now();
    isFinished = false;
    constructor() {
        this.engine = new GameEngine_1.GameEngine(0);
    }
    addPlayer(playerId, name, ws) {
        this.players.set(playerId, ws);
        this.playerNames.set(playerId, name);
        this.engine.addPlayer(playerId, name);
        console.log(`[Room ${this.id.slice(0, 8)}] Player joined: ${name} (${this.players.size}/${config_1.CONFIG.MAX_PLAYERS_PER_ROOM})`);
    }
    removePlayer(playerId) {
        this.players.delete(playerId);
        this.engine.removePlayer(playerId);
        const name = this.playerNames.get(playerId) || 'unknown';
        this.playerNames.delete(playerId);
        console.log(`[Room ${this.id.slice(0, 8)}] Player left: ${name} (${this.players.size} remaining)`);
        if (this.players.size === 0)
            this.stop();
    }
    start() {
        this.startTime = Date.now();
        console.log(`[Room ${this.id.slice(0, 8)}] Game started with ${this.players.size} players`);
        // Send individual GAME_START with correct playerId
        for (const [pid, ws] of this.players) {
            this.send(ws, { type: 'GAME_START', payload: { yourPlayerId: pid, obstacles: this.engine.obstacles } });
        }
        const tickMs = config_1.CONFIG.TICK_INTERVAL_MS;
        this.tickInterval = setInterval(() => this.tick(), tickMs);
    }
    tick() {
        const dt = 1 / config_1.CONFIG.TICK_RATE;
        this.engine.updateTick(dt);
        const snapshot = this.engine.getSnapshot();
        this.broadcast({ type: 'GAME_STATE', payload: snapshot });
        for (const p of this.engine.players.values()) {
            if (p.justDied) {
                p.justDied = false;
                this.broadcast({ type: 'PLAYER_DIED', payload: { playerId: p.id, playerName: p.name, score: p.score } });
            }
        }
        if (this.engine.isGameOver)
            this.endGame();
    }
    handleMessage(playerId, msg) {
        const player = this.engine.players.get(playerId);
        if (!player)
            return;
        switch (msg.type) {
            case 'INPUT_STATE':
                player.input = msg.payload;
                if (player.platform === 'pc') {
                    const mx = msg.payload.mouseX ?? 0; // -1..1, right is positive
                    const my = msg.payload.mouseY ?? 0; // -1..1, up is positive
                    // Screen-space rotation: atan2(screenX, -screenY) makes character
                    // always face toward mouse position on screen regardless of camera tilt.
                    player.rotationY = Math.atan2(mx, -my);
                    // Use raycaster world coords for projectile direction
                    if (msg.payload.worldX !== undefined && msg.payload.worldZ !== undefined) {
                        player.setFacingDirectionOnly(msg.payload.worldX, msg.payload.worldZ);
                    }
                    else {
                        // fallback: derive facing from screen direction
                        player.setFacingDirectionFromScreen(mx, -my);
                    }
                }
                break;
            case 'MOVE_TO':
                player.setTargetPosition(msg.payload.x, msg.payload.z);
                break;
            case 'ATTACK_START':
                player.isAttacking = true;
                break;
            case 'ATTACK_STOP':
                player.isAttacking = false;
                break;
            case 'USE_SKILL':
                this.engine.handleSkill(playerId, msg.payload.skill);
                break;
            case 'SELECT_PLATFORM':
                player.platform = msg.payload.platform;
                break;
            case 'CHOOSE_UPGRADE':
                if ('skip' in msg.payload)
                    player.skipUpgrade();
                else
                    player.upgradeSkill(msg.payload.skillKey);
                break;
            case 'PING':
                const ws = this.players.get(playerId);
                if (ws)
                    this.send(ws, { type: 'PONG', payload: { serverTime: Date.now() } });
                break;
        }
    }
    async endGame() {
        if (this.isFinished)
            return;
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
                await ranking_1.rankingService.postScore(p.name, p.score, time, this.engine.spawnManager.collapseLevel, p.kills, this.id, this.players.size);
            }
            await ranking_1.rankingService.saveMatchHistory(this.id, scores.length, time, this.engine.spawnManager.collapseLevel);
        }
        catch (e) {
            console.error('[Room] Failed to save scores:', e);
        }
        console.log(`[Room ${this.id.slice(0, 8)}] Game over. Winner: ${winner?.playerName} (${winner?.score})`);
    }
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
    broadcast(msg) {
        const data = JSON.stringify(msg);
        for (const ws of this.players.values()) {
            if (ws.readyState === ws_1.default.OPEN)
                ws.send(data);
        }
    }
    send(ws, msg) {
        if (ws.readyState === ws_1.default.OPEN)
            ws.send(JSON.stringify(msg));
    }
}
exports.Room = Room;
//# sourceMappingURL=Room.js.map