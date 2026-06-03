import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MatchmakingService } from './matchmaking/MatchmakingService';
import { rankingService } from './database/ranking';
import { getPool, closeDatabase, initDatabase } from './database/db';
import { createPlayer, findPlayerByUsername, validatePlayer, generateJWT, verifyJWT, updateUserCoins, updateUserInventory, findPlayerById, getMarketOffers, createMarketOffer, getMarketOfferById, deleteMarketOffer } from './database/db';
import { CONFIG } from './config';
import { loadGameData } from './data/GameDataLoader';
import { LootEngine } from './game/LootEngine';
import { weeklyAwardService } from './services/WeeklyAwardService';

// ============================================================
// DATA-DRIVEN PIPELINE: Carregar game_data.json no startup
// Zero leituras de disco durante o game loop
// ============================================================
loadGameData();
LootEngine.loadRates();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const matchmaking = new MatchmakingService();

// Track active connections: username -> playerId (prevent multi-login)
const activeConnections = new Map<string, string>();
// Track sockets: playerId -> WebSocket (for forcing disconnect)
const playerSockets = new Map<string, WebSocket>();

// Track admin sockets for live dashboard
const adminConnections = new Set<WebSocket>();

setInterval(() => {
    if (adminConnections.size === 0) return;
    const stats = matchmaking.getStats();
    const mem = process.memoryUsage();
    const payload = JSON.stringify({
        type: 'ADMIN_STATS',
        payload: {
            ...stats,
            memory: {
                rss: mem.rss,
                heapTotal: mem.heapTotal,
                heapUsed: mem.heapUsed
            }
        }
    });
    for (const ws of adminConnections) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        } else {
            adminConnections.delete(ws);
        }
    }
}, 1000);

// Serve static client files
// Production (Docker): dist/ is at /app/dist, public/ at /app/public → '../public'
// Local dev: server/dist → ../../client
const publicDir = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../public')
    : path.join(__dirname, '../../client');
app.use(express.static(publicDir, {
    maxAge: '1y',
    etag: true,
    lastModified: true
}));
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

async function requireAdmin(req: express.Request, res: express.Response): Promise<boolean> {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return false;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) {
        res.status(401).json({ error: 'Invalid token' });
        return false;
    }

    const player = await findPlayerByUsername(payload.username);
    if (!player || !player.is_admin || player.is_blocked) {
        res.status(403).json({ error: 'Admin access required' });
        return false;
    }

    return true;
}

function hasWeeklyAwardSecret(req: express.Request): boolean {
    const expected = process.env.WEEKLY_AWARD_SECRET || CONFIG.JWT_SECRET;
    const provided = req.headers['x-weekly-award-secret'] || req.query.secret;
    return typeof provided === 'string' && provided.length > 0 && provided === expected;
}

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

// Admin hot-reload game data endpoint
app.post('/api/admin/reload-data', (req, res) => {
    try {
        console.log('[Admin] Hot-reloading game data...');
        loadGameData();
        LootEngine.loadRates();
        res.json({ success: true, message: 'Game data reloaded successfully' });
    } catch (e: any) {
        console.error('[Admin] Failed to reload game data:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
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

app.get('/api/ranking/average', async (_, res) => {
    try { res.json(await rankingService.getLeaderboardByAverage(50)); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch average ranking' }); }
});

app.get('/api/ranking/weekly', async (_, res) => {
    try { res.json(await rankingService.getLeaderboardByAverageWeekly(50)); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch weekly ranking' }); }
});

app.get('/api/admin/weekly-awards', async (req, res) => {
    try {
        if (!(await requireAdmin(req, res))) return;
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30));
        res.json(await weeklyAwardService.listAwards(limit));
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to fetch weekly awards', detail: e.message });
    }
});

app.post('/api/admin/weekly-awards/process', async (req, res) => {
    try {
        if (!(await requireAdmin(req, res))) return;
        const result = await weeklyAwardService.processPreviousWeek({ force: req.body?.force === true });
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to process weekly award', detail: e.message });
    }
});

app.post('/api/internal/weekly-awards/process', async (req, res) => {
    try {
        if (!hasWeeklyAwardSecret(req)) {
            return res.status(403).json({ error: 'Invalid weekly award secret' });
        }
        const result = await weeklyAwardService.processPreviousWeek();
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to process weekly award', detail: e.message });
    }
});

app.get('/api/dashboard', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });
    try {
        const player = await findPlayerByUsername(payload.username);
        if (!player || player.is_blocked) {
            return res.status(401).json({ error: 'Account blocked or not found' });
        }
        const [kda, matchHistory, rankingTotal, rankingAvg, rankingWeekly] = await Promise.all([
            rankingService.getPlayerStats(payload.username),
            rankingService.getPlayerMatchHistory(payload.username, 10),
            rankingService.getLeaderboard(50),
            rankingService.getLeaderboardByAverage(50),
            rankingService.getLeaderboardByAverageWeekly(50)
        ]);
        const playerRankTotal  = rankingTotal.findIndex(r => r.playerName === payload.username) + 1;
        const playerRankAvg    = rankingAvg.findIndex(r => r.playerName === payload.username) + 1;
        const playerRankWeekly = rankingWeekly.findIndex(r => r.playerName === payload.username) + 1;
        res.json({
            username: payload.username,
            kda,
            matchHistory,
            rankingTotal,
            rankingAvg,
            rankingWeekly,
            playerRankTotal,
            playerRankAvg,
            playerRankWeekly
        });
    } catch (e) { res.status(500).json({ error: 'Failed to fetch dashboard' }); }
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

    try {
        const player = await findPlayerByUsername(payload.username);
        if (!player || player.is_blocked) {
            return res.status(401).json({ error: 'Account blocked or not found' });
        }
        res.json({ id: payload.id, username: payload.username, is_admin: player.is_admin });
    } catch (e) {
        res.status(500).json({ error: 'Database check failed' });
    }
});

// ==================== USER DATA & ECONOMY ====================

app.get('/api/user/data', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    try {
        const player = await findPlayerByUsername(payload.username);
        if (!player || player.is_blocked) {
            return res.status(401).json({ error: 'Account blocked or not found' });
        }
        res.json({ coins: player.coins || 0, inventory: player.inventory || [] });
    } catch (e) {
        res.status(500).json({ error: 'Database check failed' });
    }
});

app.post('/api/user/tradein', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    const { itemsToSell } = req.body; 

    try {
        const player = await findPlayerByUsername(payload.username);
        if (!player || player.is_blocked) return res.status(401).json({ error: 'Account blocked or not found' });

        let currentInventory = [...(player.inventory || [])];
        let currentCoins = player.coins || 0;
        let coinsGained = 0;

        for (const itemId of (itemsToSell || [])) {
            const index = currentInventory.indexOf(itemId);
            if (index !== -1) {
                currentInventory.splice(index, 1);
                coinsGained += 10;
            }
        }

        currentCoins += coinsGained;
        await updateUserCoins(player.id, currentCoins);
        await updateUserInventory(player.id, currentInventory);

        res.json({ success: true, coins: currentCoins, inventory: currentInventory, gained: coinsGained });
    } catch (e) {
        res.status(500).json({ error: 'Trade-in failed' });
    }
});

app.post('/api/user/buy', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    const { itemId, price } = req.body; 

    try {
        const player = await findPlayerByUsername(payload.username);
        if (!player || player.is_blocked) return res.status(401).json({ error: 'Account blocked or not found' });

        let currentCoins = player.coins || 0;
        let currentInventory = [...(player.inventory || [])];

        if (currentCoins < price) {
            return res.status(400).json({ error: 'Not enough coins' });
        }

        currentCoins -= price;
        currentInventory.push(itemId);

        await updateUserCoins(player.id, currentCoins);
        await updateUserInventory(player.id, currentInventory);

        res.json({ success: true, coins: currentCoins, inventory: currentInventory });
    } catch (e) {
        res.status(500).json({ error: 'Purchase failed' });
    }
});

// ==================== P2P MARKETPLACE ====================

app.get('/api/market/offers', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    try {
        const offers = await getMarketOffers();
        res.json(offers);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch market offers' });
    }
});

app.post('/api/market/sell', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    const { itemId, price } = req.body;
    const itemPrice = parseInt(price);

    if (isNaN(itemPrice) || itemPrice <= 0) {
        return res.status(400).json({ error: 'Preço inválido. Deve ser um número inteiro maior que 0.' });
    }

    if (!itemId || typeof itemId !== 'string') {
        return res.status(400).json({ error: 'ID do item inválido' });
    }

    try {
        const player = await findPlayerByUsername(payload.username);
        if (!player || player.is_blocked) return res.status(401).json({ error: 'Jogador bloqueado ou não encontrado' });

        const currentInventory = [...(player.inventory || [])];
        const idx = currentInventory.indexOf(itemId);
        if (idx === -1) {
            return res.status(400).json({ error: 'Item não encontrado no seu inventário' });
        }

        // Remove single instance from inventory
        currentInventory.splice(idx, 1);

        // Create market offer
        const offerId = await createMarketOffer(player.id, player.username, itemId, itemPrice);

        // Save updated inventory
        await updateUserInventory(player.id, currentInventory);

        res.json({ success: true, offerId, inventory: currentInventory });
    } catch (e: any) {
        res.status(500).json({ error: 'Falha ao listar item: ' + e.message });
    }
});

app.post('/api/market/buy', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    const { offerId } = req.body;
    const offerIdNum = parseInt(offerId);

    if (isNaN(offerIdNum)) {
        return res.status(400).json({ error: 'ID da oferta inválido' });
    }

    try {
        const buyer = await findPlayerByUsername(payload.username);
        if (!buyer || buyer.is_blocked) return res.status(401).json({ error: 'Comprador bloqueado ou não encontrado' });

        const offer = await getMarketOfferById(offerIdNum);
        if (!offer) {
            return res.status(404).json({ error: 'Oferta não encontrada ou já vendida' });
        }

        if (offer.seller_id === buyer.id) {
            return res.status(400).json({ error: 'Você não pode comprar sua própria oferta. Use a opção de cancelar.' });
        }

        if ((buyer.coins || 0) < offer.price) {
            return res.status(400).json({ error: 'Coins insuficientes' });
        }

        const seller = await findPlayerById(offer.seller_id);
        if (!seller) {
            return res.status(404).json({ error: 'Vendedor não encontrado' });
        }

        // Deduct coins & Add item for buyer
        const buyerCoins = (buyer.coins || 0) - offer.price;
        const buyerInventory = [...(buyer.inventory || [])];
        buyerInventory.push(offer.item_id);

        // Add coins to seller
        const sellerCoins = (seller.coins || 0) + offer.price;

        // Update buyer
        await updateUserCoins(buyer.id, buyerCoins);
        await updateUserInventory(buyer.id, buyerInventory);

        // Update seller
        await updateUserCoins(seller.id, sellerCoins);

        // Delete offer
        await deleteMarketOffer(offerIdNum);

        res.json({ success: true, coins: buyerCoins, inventory: buyerInventory });
    } catch (e: any) {
        res.status(500).json({ error: 'Falha na compra: ' + e.message });
    }
});

app.post('/api/market/cancel', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    const { offerId } = req.body;
    const offerIdNum = parseInt(offerId);

    if (isNaN(offerIdNum)) {
        return res.status(400).json({ error: 'ID da oferta inválido' });
    }

    try {
        const player = await findPlayerByUsername(payload.username);
        if (!player || player.is_blocked) return res.status(401).json({ error: 'Jogador bloqueado ou não encontrado' });

        const offer = await getMarketOfferById(offerIdNum);
        if (!offer) {
            return res.status(404).json({ error: 'Oferta não encontrada' });
        }

        if (offer.seller_id !== player.id) {
            return res.status(403).json({ error: 'Você não é o dono desta oferta' });
        }

        // Return item to seller inventory
        const currentInventory = [...(player.inventory || [])];
        currentInventory.push(offer.item_id);
        await updateUserInventory(player.id, currentInventory);

        // Delete offer
        await deleteMarketOffer(offerIdNum);

        res.json({ success: true, inventory: currentInventory });
    } catch (e: any) {
        res.status(500).json({ error: 'Falha ao cancelar oferta: ' + e.message });
    }
});

// WebSocket
wss.on('connection', (ws: WebSocket) => {
    const playerId = uuidv4();
    let playerName = 'Player';
    console.log(`[WS] New connection: ${playerId.slice(0, 8)}`);

    // Register the socket for force-disconnect capability
    playerSockets.set(playerId, ws);

    ws.on('message', async (raw: Buffer) => {
        try {
            const msg = JSON.parse(raw.toString());
            switch (msg.type) {
                case 'JOIN_ADMIN': {
                    const token = msg.payload?.token;
                    if (token) {
                        const payload = verifyJWT(token);
                        if (payload && payload.is_admin) {
                            adminConnections.add(ws);
                            ws.send(JSON.stringify({ type: 'ADMIN_WELCOME', payload: { message: 'Connected to AdminWatch' } }));
                            console.log(`[WS] Admin ${payload.username} connected to AdminWatch`);
                        } else {
                            ws.close(1008, 'Unauthorized');
                        }
                    } else {
                        ws.close(1008, 'No token');
                    }
                    break;
                }
                case 'JOIN_QUEUE': {
                    let loadout: string[] = [];
                    const token = msg.payload?.token;
                    if (token) {
                        const payload = verifyJWT(token);
                        if (payload) {
                            const player = await findPlayerByUsername(payload.username);
                            if (player && player.is_blocked) {
                                ws.send(JSON.stringify({
                                    type: 'FORCE_LOGOUT',
                                    payload: { reason: 'Sua conta foi bloqueada pelo administrador.' }
                                }));
                                ws.close(1000, 'Conta bloqueada');
                                return;
                            }
                            if (player) {
                                playerName = payload.username;
                                console.log(`[WS] Player ${playerName} joined via token`);
                                const userInventory = player.inventory || [];
                                const requestedLoadout = msg.payload?.loadout || [];
                                const ownedLoadout = requestedLoadout.filter((itemId: string) => userInventory.includes(itemId));

                                // Enforce rarity limits: max 1 legendary, 2 epics, 3 basics, total 3 items
                                const ItemDatabase = require('./data/ItemDatabase').ItemDatabase;
                                let leg = 0, epic = 0, basic = 0;
                                const validatedLoadout: string[] = [];
                                for (const itemId of ownedLoadout) {
                                    const item = ItemDatabase[itemId];
                                    if (item) {
                                        if (item.rarity === 'legendary' && leg < 1) {
                                            leg++;
                                            validatedLoadout.push(itemId);
                                        } else if (item.rarity === 'epic' && epic < 2) {
                                            epic++;
                                            validatedLoadout.push(itemId);
                                        } else if (item.rarity === 'basic' && basic < 3) {
                                            basic++;
                                            validatedLoadout.push(itemId);
                                        }
                                        if (validatedLoadout.length >= 3) break;
                                    }
                                }
                                loadout = validatedLoadout;
                            }

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
                    const platform = msg.payload?.platform || 'pc';
                    const build = msg.payload?.build;
                    matchmaking.addToQueue(playerId, playerName, ws, platform, build, loadout);
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
        adminConnections.delete(ws);
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
