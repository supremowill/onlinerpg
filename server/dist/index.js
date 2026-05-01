"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const MatchmakingService_1 = require("./matchmaking/MatchmakingService");
const ranking_1 = require("./database/ranking");
const db_1 = require("./database/db");
const config_1 = require("./config");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
const matchmaking = new MatchmakingService_1.MatchmakingService();
// Serve static client files
// Production (Docker): dist/ is at /app/dist, public/ at /app/public → '../public'
// Local dev: server/dist → ../../client
const publicDir = process.env.NODE_ENV === 'production'
    ? path_1.default.join(__dirname, '../public')
    : path_1.default.join(__dirname, '../../client');
app.use(express_1.default.static(publicDir));
app.use(express_1.default.json());
// Init DB
const db_2 = require("./database/db");
(0, db_2.initDatabase)();
// REST API
app.get('/api/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/api/ranking', async (_, res) => {
    try {
        res.json(await ranking_1.rankingService.getLeaderboard(50));
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch ranking' });
    }
});
app.get('/api/matches', async (_, res) => {
    try {
        res.json(await ranking_1.rankingService.getRecentMatches(20));
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch matches' });
    }
});
app.get('/api/stats', (_, res) => res.json(matchmaking.getStats()));
// WebSocket
wss.on('connection', (ws) => {
    const playerId = (0, uuid_1.v4)();
    let playerName = 'Player';
    console.log(`[WS] New connection: ${playerId.slice(0, 8)}`);
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            switch (msg.type) {
                case 'JOIN_QUEUE':
                    playerName = msg.payload?.name || 'Player';
                    matchmaking.addToQueue(playerId, playerName, ws);
                    break;
                case 'LEAVE_QUEUE':
                    matchmaking.removeFromQueue(playerId);
                    break;
                default:
                    if (matchmaking.isPlayerInRoom(playerId)) {
                        matchmaking.handleMessage(playerId, msg);
                    }
                    break;
            }
        }
        catch (e) {
            console.error('[WS] Bad message:', e);
        }
    });
    ws.on('close', () => {
        console.log(`[WS] Disconnected: ${playerId.slice(0, 8)}`);
        matchmaking.onDisconnect(playerId);
    });
    ws.on('error', (err) => console.error(`[WS] Error ${playerId.slice(0, 8)}:`, err.message));
    // Send welcome
    ws.send(JSON.stringify({ type: 'WELCOME', payload: { playerId, serverVersion: '1.0.0', tickRate: config_1.CONFIG.TICK_RATE } }));
});
// Start
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Survival Server running on port ${PORT}`);
    console.log(`   Tick rate: ${config_1.CONFIG.TICK_RATE}Hz | Max players/room: ${config_1.CONFIG.MAX_PLAYERS_PER_ROOM}`);
});
// Graceful shutdown
process.on('SIGTERM', () => { console.log('Shutting down...'); matchmaking.destroy(); (0, db_1.closeDatabase)(); server.close(); });
process.on('SIGINT', () => { console.log('Shutting down...'); matchmaking.destroy(); (0, db_1.closeDatabase)(); server.close(); process.exit(0); });
//# sourceMappingURL=index.js.map