import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MatchmakingService } from './matchmaking/MatchmakingService';
import { rankingService } from './database/ranking';
import { getPool, closeDatabase, initDatabase } from './database/db';
import { createPlayer, findPlayerByUsername, validatePlayer, generateJWT, verifyJWT } from './database/db';
import { CONFIG } from './config';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const matchmaking = new MatchmakingService();

// Track active connections: username -> playerId (prevent multi-login)
const activeConnections = new Map<string, string>();
// Track sockets: playerId -> WebSocket (for forcing disconnect)
const playerSockets = new Map<string, WebSocket>();

// Serve static client files
// Production (Docker): dist/ is at /app/dist, public/ at /app/public → '../public'
// Local dev: server/dist → ../../client
const publicDir = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../public')
    : path.join(__dirname, '../../client');
app.use(express.static(publicDir));
// CORS middleware - allow browser requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});
app.use(express.json());

// Init DB (will retry on failure, server starts even if DB is down)
let dbInitialized = false;
initDatabase().then(pool => {
    dbInitialized = true;
    console.log('[DB] Initialized successfully');
}).catch(err => {
    console.error('[DB] Initial database init failed, will retry on first request:', (err as Error).message);
});

// REST API
app.get('/api/health', (_, res) => {
    // Try to init DB on health check if not initialized
    if (!dbInitialized) {
        initDatabase().then(() => {
            dbInitialized = true;
        }).catch(err => {
            console.error('[DB] Retry failed:', (err as Error).message);
        });
    }
    res.json({ status: 'ok', uptime: process.uptime(), db: dbInitialized ? 'connected' : 'disconnected' });
});

// Debug endpoint - check DB tables (remove in production)
app.get('/api/debug', async (_, res) => {
    try {
        const pool = getPool();
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const players = await pool.query('SELECT COUNT(*) as count FROM players');
        res.json({
            tables: tables.rows,
            playerCount: players.rows[0].count,
            dbUrlPreview: CONFIG.DATABASE_URL ? CONFIG.DATABASE_URL.substring(0, 30) + '...' : 'not set',
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

app.get('/api/ranking', async (_, res) => {
    try { res.json(await rankingService.getLeaderboard(50)); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch ranking' }); }
});

app.get('/api/matches', async (_, res) => {
    try { res.json(await rankingService.getRecentMatches(20)); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch matches' }); }
});

app.get('/api/stats', (_, res) => res.json(matchmaking.getStats()));

// ==================== AUTH ENDPOINTS ====================

app.post('/api/auth/register', express.json(), async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (username.length < 3 || username.length > 15) return res.status(400).json({ error: 'Username must be 3-15 characters' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const existing = await findPlayerByUsername(username);
        if (existing) return res.status(409).json({ error: 'Username already taken' });

        const player = await createPlayer(username, password);
        const token = generateJWT(player);
        res.json({ token, username: player.username });
    } catch (e: any) {
        console.error('[Register Error]', e.message, e.stack);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', express.json(), async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const player = await validatePlayer(username, password);
        if (!player) return res.status(401).json({ error: 'Invalid credentials' });

        const token = generateJWT(player);
        res.json({ token, username: player.username });
    } catch (e: any) {
        console.error('[Login Error]', e.message, e.stack);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    res.json({ id: payload.id, username: payload.username });
});

// WebSocket
wss.on('connection', (ws: WebSocket) => {
    const playerId = uuidv4();
    let playerName = 'Player';
    console.log(`[WS] New connection: ${playerId.slice(0, 8)}`);

    // Register the socket for force-disconnect capability
    playerSockets.set(playerId, ws);

    ws.on('message', (raw: Buffer) => {
        try {
            const msg = JSON.parse(raw.toString());
            switch (msg.type) {
                case 'JOIN_QUEUE': {
                    // Check for JWT token first, then fall back to name
                    const token = msg.payload?.token;
                    if (token) {
                        const payload = verifyJWT(token);
                        if (payload) {
                            playerName = payload.username;
                            console.log(`[WS] Player ${playerName} joined via token`);

                            // ─── MULTI-LOGIN CHECK ───
                            if (activeConnections.has(playerName)) {
                                const existingPlayerId = activeConnections.get(playerName)!;
                                const existingWs = playerSockets.get(existingPlayerId);
                                // Force-disconnect the OLD session
                                if (existingWs && existingWs.readyState === WebSocket.OPEN) {
                                    existingWs.send(JSON.stringify({
                                        type: 'FORCE_LOGOUT',
                                        payload: { reason: 'Nova sessão iniciada em outro lugar' }
                                    }));
                                    existingWs.close(1000, 'Nova sessão iniciada');
                                }
                                // Clean up old state
                                activeConnections.delete(playerName);
                                playerSockets.delete(existingPlayerId);
                                matchmaking.onDisconnect(existingPlayerId);
                            }
                            // Register this new connection as the active one
                            activeConnections.set(playerName, playerId);
                        } else {
                            playerName = msg.payload?.name || 'Player';
                        }
                    } else {
                        playerName = msg.payload?.name || 'Player';
                    }
                    matchmaking.addToQueue(playerId, playerName, ws);
                    break;
                }
                case 'LEAVE_QUEUE':
                    matchmaking.removeFromQueue(playerId);
                    break;
                default:
                    // Always forward to matchmaking (handles both queue and room messages)
                    matchmaking.handleMessage(playerId, msg);
                    break;
            }
        } catch (e) { console.error('[WS] Bad message:', e); }
    });

    ws.on('close', () => {
        console.log(`[WS] Disconnected: ${playerId.slice(0, 8)}`);
        // Clean up activeConnections if this was the active session
        for (const [username, pid] of activeConnections.entries()) {
            if (pid === playerId) {
                activeConnections.delete(username);
                break;
            }
        }
        playerSockets.delete(playerId);
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
