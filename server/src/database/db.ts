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
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);

        -- Ranking table (references players table)
        CREATE TABLE IF NOT EXISTS ranking (
            player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
            kills INTEGER DEFAULT 0,
            deaths INTEGER DEFAULT 0,
            max_kills INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Match history for tracking player results
        CREATE TABLE IF NOT EXISTS match_history (
            id SERIAL PRIMARY KEY,
            player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
            result VARCHAR(10) CHECK (result IN ('win', 'loss')),
            kills INTEGER DEFAULT 0,
            deaths INTEGER DEFAULT 0,
            duration INTEGER,
            played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_ranking_wins ON ranking(wins DESC);
        CREATE INDEX IF NOT EXISTS idx_match_history_player ON match_history(player_id);
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
}

export async function createPlayer(username: string, password: string): Promise<PlayerAccount> {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at, last_login',
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
        const result = await pool.query('SELECT id, username, password_hash, created_at, last_login FROM players WHERE username = $1', [username]);
        return result.rows[0] || null;
    } catch (err: any) {
        console.error('[DB findPlayerByUsername] Error:', err.message, err.stack);
        throw err;
    }
}

export async function validatePlayer(username: string, password: string): Promise<PlayerAccount | null> {
    const player = await findPlayerByUsername(username);
    if (!player) return null;
    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) return null;
    // Update last login
    await pool.query('UPDATE players SET last_login = NOW() WHERE id = $1', [player.id]);
    return { id: player.id, username: player.username, created_at: player.created_at, last_login: new Date() };
}

export function generateJWT(player: PlayerAccount): string {
    return jwt.sign(
        { id: player.id, username: player.username },
        CONFIG.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

export function verifyJWT(token: string): { id: number; username: string } | null {
    try {
        return jwt.verify(token, CONFIG.JWT_SECRET) as any;
    } catch {
        return null;
    }
}
