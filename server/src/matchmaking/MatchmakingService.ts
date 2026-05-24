import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Room } from './Room';
import { CONFIG } from '../config';
import { ServerMessage, PlayerBuild } from '../network/Protocol';

interface QueuedPlayer {
    id: string;
    name: string;
    ws: WebSocket;
    joinedAt: number;
    platform: 'pc' | 'mobile';
    build?: PlayerBuild;
}

export class MatchmakingService {
    private queue: QueuedPlayer[] = [];
    private rooms: Map<string, Room> = new Map();
    private playerToRoom: Map<string, string> = new Map();
    private checkInterval: NodeJS.Timeout;

    constructor() {
        this.checkInterval = setInterval(() => this.processQueue(), 1000);
    }

    addToQueue(playerId: string, playerName: string, ws: WebSocket, platform: 'pc' | 'mobile' = 'pc', build?: PlayerBuild): void {
        // Remove if already in queue
        this.queue = this.queue.filter(p => p.id !== playerId);
        this.queue.push({ id: playerId, name: playerName, ws, joinedAt: Date.now(), platform, build });
        console.log(`[Matchmaking] ${playerName} joined queue (${this.queue.length} in queue) [${platform}]`);
        this.sendQueueStatus();
        this.processQueue();
    }

    setPlayerPlatform(playerId: string, platform: 'pc' | 'mobile'): void {
        const player = this.queue.find(p => p.id === playerId);
        if (player) {
            player.platform = platform;
            console.log(`[Matchmaking] ${playerId.slice(0,8)} platform set to ${platform}`);
        }
    }

    removeFromQueue(playerId: string): void {
        this.queue = this.queue.filter(p => p.id !== playerId);
    }

    onDisconnect(playerId: string): void {
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

    handleMessage(playerId: string, msg: any): void {
        // Handle messages from players in queue (not yet in room)
        if (msg.type === 'SELECT_PLATFORM') {
            this.setPlayerPlatform(playerId, msg.payload.platform);
            return;
        }
        // Forward to room if player is in one
        const roomId = this.playerToRoom.get(playerId);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) room.handleMessage(playerId, msg);
        }
    }

    isPlayerInRoom(playerId: string): boolean {
        return this.playerToRoom.has(playerId);
    }

    private processQueue(): void {
        // Remove disconnected players
        this.queue = this.queue.filter(p => p.ws.readyState === WebSocket.OPEN);
        if (this.queue.length === 0) return;

        const now = Date.now();
        const minPlayers = CONFIG.MIN_PLAYERS_TO_START;
        const maxPlayers = CONFIG.MAX_PLAYERS_PER_ROOM;
        const timeout = CONFIG.MATCHMAKING_TIMEOUT_MS;

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

    private createRoom(players: QueuedPlayer[]): void {
        const room = new Room();
        this.rooms.set(room.id, room);
        const playerInfos = players.map(p => ({ id: p.id, name: p.name }));

        for (const p of players) {
            room.addPlayer(p.id, p.name, p.ws, p.platform, p.build);
            this.playerToRoom.set(p.id, room.id);
            const msg: ServerMessage = { type: 'MATCH_FOUND', payload: { roomId: room.id, players: playerInfos } };
            if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(msg));
        }
        // Start after short delay for clients to prepare
        setTimeout(() => room.start(), 2000);
        console.log(`[Matchmaking] Room ${room.id.slice(0, 8)} created with ${players.length} players`);
    }

    private sendQueueStatus(): void {
        for (let i = 0; i < this.queue.length; i++) {
            const p = this.queue[i];
            const msg: ServerMessage = {
                type: 'QUEUE_STATUS',
                payload: { position: i + 1, playersInQueue: this.queue.length, estimatedWaitMs: Math.max(0, CONFIG.MATCHMAKING_TIMEOUT_MS - (Date.now() - p.joinedAt)) }
            };
            if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(msg));
        }
    }

    getStats(): { queueSize: number; activeRooms: number; totalPlayers: number } {
        return {
            queueSize: this.queue.length,
            activeRooms: this.rooms.size,
            totalPlayers: [...this.rooms.values()].reduce((s, r) => s + r.players.size, 0),
        };
    }

    destroy(): void {
        clearInterval(this.checkInterval);
        for (const room of this.rooms.values()) room.stop();
    }
}
