"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchmakingService = void 0;
const ws_1 = __importDefault(require("ws"));
const Room_1 = require("./Room");
const config_1 = require("../config");
class MatchmakingService {
    queue = [];
    rooms = new Map();
    playerToRoom = new Map();
    checkInterval;
    constructor() {
        this.checkInterval = setInterval(() => this.processQueue(), 1000);
    }
    addToQueue(playerId, playerName, ws) {
        // Remove if already in queue
        this.queue = this.queue.filter(p => p.id !== playerId);
        this.queue.push({ id: playerId, name: playerName, ws, joinedAt: Date.now() });
        console.log(`[Matchmaking] ${playerName} joined queue (${this.queue.length} in queue)`);
        this.sendQueueStatus();
        this.processQueue();
    }
    removeFromQueue(playerId) {
        this.queue = this.queue.filter(p => p.id !== playerId);
    }
    onDisconnect(playerId) {
        this.removeFromQueue(playerId);
        const roomId = this.playerToRoom.get(playerId);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) {
                room.removePlayer(playerId);
                if (room.players.size === 0) {
                    room.stop();
                    this.rooms.delete(roomId);
                    console.log(`[Matchmaking] Room ${roomId.slice(0, 8)} removed (empty)`);
                }
            }
            this.playerToRoom.delete(playerId);
        }
    }
    handleMessage(playerId, msg) {
        const roomId = this.playerToRoom.get(playerId);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room)
                room.handleMessage(playerId, msg);
        }
    }
    isPlayerInRoom(playerId) {
        return this.playerToRoom.has(playerId);
    }
    processQueue() {
        // Remove disconnected players
        this.queue = this.queue.filter(p => p.ws.readyState === ws_1.default.OPEN);
        if (this.queue.length === 0)
            return;
        const now = Date.now();
        const minPlayers = config_1.CONFIG.MIN_PLAYERS_TO_START;
        const maxPlayers = config_1.CONFIG.MAX_PLAYERS_PER_ROOM;
        const timeout = config_1.CONFIG.MATCHMAKING_TIMEOUT_MS;
        // Enough players to start
        if (this.queue.length >= minPlayers) {
            const oldestWait = now - this.queue[0].joinedAt;
            // Start if we have max players OR timeout reached
            if (this.queue.length >= maxPlayers || oldestWait >= timeout) {
                const batch = this.queue.splice(0, Math.min(this.queue.length, maxPlayers));
                this.createRoom(batch);
            }
        }
        // Solo start after timeout
        else if (this.queue.length > 0) {
            const oldestWait = now - this.queue[0].joinedAt;
            if (oldestWait >= timeout) {
                const batch = this.queue.splice(0, this.queue.length);
                this.createRoom(batch);
            }
        }
    }
    createRoom(players) {
        const room = new Room_1.Room();
        this.rooms.set(room.id, room);
        const playerInfos = players.map(p => ({ id: p.id, name: p.name }));
        for (const p of players) {
            room.addPlayer(p.id, p.name, p.ws);
            this.playerToRoom.set(p.id, room.id);
            const msg = { type: 'MATCH_FOUND', payload: { roomId: room.id, players: playerInfos } };
            if (p.ws.readyState === ws_1.default.OPEN)
                p.ws.send(JSON.stringify(msg));
        }
        // Start after short delay for clients to prepare
        setTimeout(() => room.start(), 2000);
        console.log(`[Matchmaking] Room ${room.id.slice(0, 8)} created with ${players.length} players`);
    }
    sendQueueStatus() {
        for (let i = 0; i < this.queue.length; i++) {
            const p = this.queue[i];
            const msg = {
                type: 'QUEUE_STATUS',
                payload: { position: i + 1, playersInQueue: this.queue.length, estimatedWaitMs: Math.max(0, config_1.CONFIG.MATCHMAKING_TIMEOUT_MS - (Date.now() - p.joinedAt)) }
            };
            if (p.ws.readyState === ws_1.default.OPEN)
                p.ws.send(JSON.stringify(msg));
        }
    }
    getStats() {
        return {
            queueSize: this.queue.length,
            activeRooms: this.rooms.size,
            totalPlayers: [...this.rooms.values()].reduce((s, r) => s + r.players.size, 0),
        };
    }
    destroy() {
        clearInterval(this.checkInterval);
        for (const room of this.rooms.values())
            room.stop();
    }
}
exports.MatchmakingService = MatchmakingService;
//# sourceMappingURL=MatchmakingService.js.map