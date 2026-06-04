import { Pool } from 'pg';
import { CONFIG } from '../config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let pool: Pool;

export async function initDatabase(): Promise<Pool> {
    const dbUrl = CONFIG.DATABASE_URL;

    if (!dbUrl) {
        console.warn('[DB] WARNING: DATABASE_URL not set - running without database (leaderboard disabled)');
        console.warn('[DB] To enable leaderboard, create a PostgreSQL service in Render and link it');
        // Return a dummy pool that logs warnings but doesn't crash
        pool = {
            on: () => {},
            connect: () => Promise.resolve({
                query: () => Promise.resolve({ rows: [] }),
                release: () => {},
            }),
            query: () => Promise.resolve({ rows: [] }),
            end: () => Promise.resolve(),
        } as any;
        return pool;
    }

    console.log(`[DB] Initializing database connection to ${dbUrl.substring(0, 25)}...`);

    const poolConfig: any = {
        connectionString: dbUrl,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
    };

    // Only enable SSL if explicitly needed (Render sets sslmode=require in DATABASE_URL)
    // For Docker/local, SSL should be disabled
    // Also disable if sslmode=disable is present
    const sslModeRequire = dbUrl.includes('sslmode=require');
    const sslModeDisable = dbUrl.includes('sslmode=disable');

    if (sslModeDisable) {
        poolConfig.ssl = false;
    } else if (sslModeRequire || (process.env.NODE_ENV === 'production' && !dbUrl.includes('localhost'))) {
        poolConfig.ssl = { rejectUnauthorized: false };
    } else {
        poolConfig.ssl = false;
    }

    pool = new Pool(poolConfig);
    console.log('[DB] SSL config:', poolConfig.ssl);

    pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err);
    });

    // Auto-run schema immediately (not lazy) for Render deployments

    // Fallback SQL if init.sql is not found (for Render deployments)
    // This MUST match server/init.sql exactly
    const FALLBACK_SQL = `
        -- Players accounts table
        CREATE TABLE IF NOT EXISTS players (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            is_blocked BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            coins INTEGER DEFAULT 0,
            inventory JSONB DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);

        -- Ranking table (matches what RankingService expects)
        CREATE TABLE IF NOT EXISTS ranking (
            id SERIAL PRIMARY KEY,
            player_name VARCHAR(50) NOT NULL,
            score INTEGER DEFAULT 0,
            survival_time_seconds INTEGER DEFAULT 0,
            collapse_level INTEGER DEFAULT 0,
            kills INTEGER DEFAULT 0,
            deaths INTEGER DEFAULT 0,
            assists INTEGER DEFAULT 0,
            room_id VARCHAR(255),
            players_in_room INTEGER DEFAULT 0,
            build_color VARCHAR(20) DEFAULT 'red',
            build_floor1 INTEGER DEFAULT 0,
            build_floor2 INTEGER DEFAULT 0,
            build_floor3 INTEGER DEFAULT 0,
            build_floor4 INTEGER DEFAULT 0,
            build_floor5 INTEGER DEFAULT 0,
            death_report JSONB,
            damage_analysis JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ranking_score ON ranking(score DESC);
        CREATE INDEX IF NOT EXISTS idx_ranking_created_at ON ranking(created_at DESC);

        -- Match history for tracking player results
        CREATE TABLE IF NOT EXISTS match_history (
            id SERIAL PRIMARY KEY,
            room_id VARCHAR(36) NOT NULL,
            total_players INTEGER NOT NULL,
            total_time_seconds REAL NOT NULL,
            collapse_level INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_match_room ON match_history(room_id);

        -- P2P Market offers table
        CREATE TABLE IF NOT EXISTS market_offers (
            id SERIAL PRIMARY KEY,
            seller_id INTEGER NOT NULL,
            seller_name VARCHAR(50) NOT NULL,
            item_id VARCHAR(50) NOT NULL,
            price INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_market_seller ON market_offers(seller_id);

        -- Weekly ranking awards history
        CREATE TABLE IF NOT EXISTS weekly_awards (
            id SERIAL PRIMARY KEY,
            week_id VARCHAR(40) UNIQUE NOT NULL,
            week_start TIMESTAMP WITH TIME ZONE NOT NULL,
            week_end TIMESTAMP WITH TIME ZONE NOT NULL,
            winner_player_id INTEGER,
            winner_name VARCHAR(50),
            avg_score NUMERIC(12, 1),
            top10_sum INTEGER,
            best_score INTEGER,
            total_valid_matches INTEGER,
            best_score_at TIMESTAMP WITH TIME ZONE,
            item_id VARCHAR(80),
            item_name VARCHAR(120),
            item_rarity VARCHAR(30),
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            error_message TEXT,
            news_entry_id VARCHAR(60),
            news_published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            delivered_at TIMESTAMP WITH TIME ZONE,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_weekly_awards_week ON weekly_awards(week_start DESC);
        CREATE INDEX IF NOT EXISTS idx_weekly_awards_status ON weekly_awards(status);
    `;

    // Try to init schema immediately and wait
    try {
        let sql: string;
        const sqlPaths = [
            path.join(__dirname, '../../init.sql'),          // Docker: /app/init.sql
            path.join(__dirname, '../../../server/init.sql'), // local dev fallback
        ];
        const sqlFile = sqlPaths.find(p => fs.existsSync(p));
        if (sqlFile) {
            sql = fs.readFileSync(sqlFile, 'utf8');
            console.log(`[DB] Using init.sql from: ${sqlFile}`);
        } else {
            sql = FALLBACK_SQL;
            console.log('[DB] Using fallback SQL (Render deployment)');
        }
        
        // Execute each statement separately for reliability
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        console.log(`[DB] Executing ${statements.length} schema statements...`);
        for (const stmt of statements) {
            try {
                await pool.query(stmt);
            } catch (e: any) {
                // Log but continue (e.g., "already exists" errors)
                console.warn(`[DB] Schema statement failed: ${stmt.substring(0, 60)}... Error: ${e.message}`);
            }
        }

        // Run migration checks to auto-align existing production/Render database columns
        try {
            console.log('[DB] Running schema migration checks...');
            
            // Alter players table to add missing role and block columns
            await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE');
            await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE');
            await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT \'[]\'');
            // Ensure admin user is marked as admin
            await pool.query("UPDATE players SET is_admin = TRUE WHERE LOWER(username) = 'admin'");
            console.log('[DB] Verified players table columns.');
            
            // Alter ranking table to add missing columns in production if they don't exist
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS deaths INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS assists INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS build_color VARCHAR(20) DEFAULT \'red\'');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS build_floor1 INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS build_floor2 INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS build_floor3 INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS build_floor4 INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS build_floor5 INTEGER DEFAULT 0');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS death_report JSONB');
            await pool.query('ALTER TABLE ranking ADD COLUMN IF NOT EXISTS damage_analysis JSONB');
            console.log('[DB] Verified ranking table columns.');

            // Ensure market_offers table exists
            await pool.query(`
                CREATE TABLE IF NOT EXISTS market_offers (
                    id SERIAL PRIMARY KEY,
                    seller_id INTEGER NOT NULL,
                    seller_name VARCHAR(50) NOT NULL,
                    item_id VARCHAR(50) NOT NULL,
                    price INTEGER NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_market_seller ON market_offers(seller_id)');
            console.log('[DB] Verified market_offers table.');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS weekly_awards (
                    id SERIAL PRIMARY KEY,
                    week_id VARCHAR(40) UNIQUE NOT NULL,
                    week_start TIMESTAMP WITH TIME ZONE NOT NULL,
                    week_end TIMESTAMP WITH TIME ZONE NOT NULL,
                    winner_player_id INTEGER,
                    winner_name VARCHAR(50),
                    avg_score NUMERIC(12, 1),
                    top10_sum INTEGER,
                    best_score INTEGER,
                    total_valid_matches INTEGER,
                    best_score_at TIMESTAMP WITH TIME ZONE,
                    item_id VARCHAR(80),
                    item_name VARCHAR(120),
                    item_rarity VARCHAR(30),
                    status VARCHAR(30) NOT NULL DEFAULT 'pending',
                    error_message TEXT,
                    news_entry_id VARCHAR(60),
                    news_published BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    delivered_at TIMESTAMP WITH TIME ZONE,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_weekly_awards_week ON weekly_awards(week_start DESC)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_weekly_awards_status ON weekly_awards(status)');
            console.log('[DB] Verified weekly_awards table.');

            // Check if match_history contains old schema (player_id column)
            const schemaCheck = await pool.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'match_history' AND column_name = 'player_id'
            `);
            if (schemaCheck.rows.length > 0) {
                console.log('[DB] Old match_history table detected. Rebuilding table for schema alignment...');
                await pool.query('DROP TABLE IF EXISTS match_history CASCADE');
                await pool.query(`
                    CREATE TABLE match_history (
                        id SERIAL PRIMARY KEY,
                        room_id VARCHAR(36) NOT NULL,
                        total_players INTEGER NOT NULL,
                        total_time_seconds REAL NOT NULL,
                        collapse_level INTEGER DEFAULT 0,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                `);
                await pool.query('CREATE INDEX idx_match_room ON match_history(room_id)');
                console.log('[DB] match_history table recreated successfully.');
            }
        } catch (migrationErr: any) {
            console.warn('[DB] Migration failed:', migrationErr.message);
        }

        // Verify tables exist
        const verifyResult = await pool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN ('players', 'ranking', 'match_history')
        `);
        console.log(`[DB] Tables found after init: ${verifyResult.rows.map(r => r.table_name).join(', ')}`);
        if (verifyResult.rows.length === 0) {
            console.error('[DB] WARNING: No tables found! Schema initialization may have failed.');
        }
        console.log('[DB] Schema initialized');
    } catch (err) {
        console.warn('[DB] Schema init warning:', (err as Error).message);
    }

    console.log('[DB] PostgreSQL pool initialized');
    return pool;
}

export function getPool(): Pool {
    if (!pool) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return pool;
}

export async function closeDatabase(): Promise<void> {
    if (pool) {
        await pool.end();
        console.log('[DB] PostgreSQL pool closed');
    }
}

export async function testConnection(): Promise<boolean> {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('[DB] Connection test successful');
        return true;
    } catch (err) {
        console.error('[DB] Connection test failed:', err);
        return false;
    }
}

// ==================== PLAYERS ACCOUNT FUNCTIONS ====================

export interface PlayerAccount {
    id: number;
    username: string;
    created_at: Date;
    last_login: Date;
    coins: number;
    inventory: string[];
    is_admin?: boolean;
    is_blocked?: boolean;
}

export async function createPlayer(username: string, password: string): Promise<PlayerAccount> {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at, last_login, coins, inventory, is_admin, is_blocked',
            [username, hashedPassword]
        );
        return result.rows[0];
    } catch (err: any) {
        console.error('[DB createPlayer] Error:', err.message, err.stack);
        throw err;
    }
}

export async function findPlayerByUsername(username: string): Promise<(PlayerAccount & { password_hash: string }) | null> {
    try {
        const result = await pool.query('SELECT id, username, password_hash, created_at, last_login, coins, inventory, is_admin, is_blocked FROM players WHERE username = $1', [username]);
        return result.rows[0] || null;
    } catch (err: any) {
        console.error('[DB findPlayerByUsername] Error:', err.message, err.stack);
        throw err;
    }
}

export async function validatePlayer(username: string, password: string): Promise<PlayerAccount | null> {
    const player = await findPlayerByUsername(username);
    if (!player) return null;
    if (player.is_blocked) {
        console.log(`[DB] Blocked user login attempt blocked: ${username}`);
        return null;
    }
    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) return null;
    // Update last login
    await pool.query('UPDATE players SET last_login = NOW() WHERE id = $1', [player.id]);
    return { id: player.id, username: player.username, created_at: player.created_at, last_login: new Date(), coins: player.coins, inventory: player.inventory, is_admin: player.is_admin, is_blocked: player.is_blocked };
}

export function generateJWT(player: PlayerAccount): string {
    return jwt.sign(
        { id: player.id, username: player.username, is_admin: player.is_admin },
        CONFIG.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

export function verifyJWT(token: string): { id: number; username: string, is_admin?: boolean } | null {
    try {
        return jwt.verify(token, CONFIG.JWT_SECRET) as any;
    } catch {
        return null;
    }
}

export async function updateUserCoins(playerId: number, newCoins: number): Promise<void> {
    try {
        await pool.query('UPDATE players SET coins = $1 WHERE id = $2', [newCoins, playerId]);
    } catch (err: any) {
        console.error('[DB updateUserCoins] Error:', err.message);
    }
}

export async function updateUserInventory(playerId: number, inventory: string[]): Promise<void> {
    try {
        await pool.query('UPDATE players SET inventory = $1 WHERE id = $2', [JSON.stringify(inventory), playerId]);
    } catch (err: any) {
        console.error('[DB updateUserInventory] Error:', err.message);
    }
}

export async function findPlayerById(id: number): Promise<PlayerAccount | null> {
    try {
        const result = await pool.query('SELECT id, username, created_at, last_login, coins, inventory, is_admin, is_blocked FROM players WHERE id = $1', [id]);
        return result.rows[0] || null;
    } catch (err: any) {
        console.error('[DB findPlayerById] Error:', err.message, err.stack);
        throw err;
    }
}

export async function getMarketOffers(): Promise<any[]> {
    try {
        const result = await pool.query('SELECT id, seller_id, seller_name, item_id, price, created_at FROM market_offers ORDER BY created_at DESC');
        return result.rows;
    } catch (err: any) {
        console.error('[DB getMarketOffers] Error:', err.message);
        throw err;
    }
}

export async function createMarketOffer(sellerId: number, sellerName: string, itemId: string, price: number): Promise<number> {
    try {
        const result = await pool.query(
            'INSERT INTO market_offers (seller_id, seller_name, item_id, price) VALUES ($1, $2, $3, $4) RETURNING id',
            [sellerId, sellerName, itemId, price]
        );
        return result.rows[0].id;
    } catch (err: any) {
        console.error('[DB createMarketOffer] Error:', err.message);
        throw err;
    }
}

export async function getMarketOfferById(offerId: number): Promise<any> {
    try {
        const result = await pool.query('SELECT id, seller_id, seller_name, item_id, price, created_at FROM market_offers WHERE id = $1', [offerId]);
        return result.rows[0] || null;
    } catch (err: any) {
        console.error('[DB getMarketOfferById] Error:', err.message);
        throw err;
    }
}

export async function deleteMarketOffer(offerId: number): Promise<void> {
    try {
        await pool.query('DELETE FROM market_offers WHERE id = $1', [offerId]);
    } catch (err: any) {
        console.error('[DB deleteMarketOffer] Error:', err.message);
        throw err;
    }
}
