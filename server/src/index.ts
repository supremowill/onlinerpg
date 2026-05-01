import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MatchmakingService } from './matchmaking/MatchmakingService';
import { rankingService } from './database/ranking';
import { getPool, closeDatabase } from './database/db';
import { CONFIG } from './config';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const matchmaking = new MatchmakingService();

// Serve static client files
// Production (Docker): dist/ is at /app/dist, public/ at /app/public → '../public'
// Local dev: server/dist → ../../client
const publicDir = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../public')
    : path.join(__dirname, '../../client');
app.use(express.static(publicDir));
app.use(express.json());

// Init DB
import { initDatabase } from './database/db';
initDatabase();

// REST API
app.get('/api/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/api/ranking', async (_, res) => {
    try { res.json(await rankingService.getLeaderboard(50)); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch ranking' }); }
});

app.get('/api/matches', async (_, res) => {
    try { res.json(await rankingService.getRecentMatches(20)); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch matches' }); }
});

app.get('/api/stats', (_, res) => res.json(matchmaking.getStats()));

// WebSocket
wss.on('connection', (ws: WebSocket) => {
    const playerId = uuidv4();
    let playerName = 'Player';
    console.log(`[WS] New connection: ${playerId.slice(0, 8)}`);

    ws.on('message', (raw: Buffer) => {
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
        } catch (e) { console.error('[WS] Bad message:', e); }
    });

    ws.on('close', () => {
        console.log(`[WS] Disconnected: ${playerId.slice(0, 8)}`);
        matchmaking.onDisconnect(playerId);
    });

    ws.on('error', (err) => console.error(`[WS] Error ${playerId.slice(0, 8)}:`, err.message));

    // Send welcome
    ws.send(JSON.stringify({ type: 'WELCOME', payload: { playerId, serverVersion: '1.0.0', tickRate: CONFIG.TICK_RATE } }));
});

// Start
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Survival Server running on port ${PORT}`);
    console.log(`   Tick rate: ${CONFIG.TICK_RATE}Hz | Max players/room: ${CONFIG.MAX_PLAYERS_PER_ROOM}`);
});

// Graceful shutdown
process.on('SIGTERM', () => { console.log('Shutting down...'); matchmaking.destroy(); closeDatabase(); server.close(); });
process.on('SIGINT', () => { console.log('Shutting down...'); matchmaking.destroy(); closeDatabase(); server.close(); process.exit(0); });
