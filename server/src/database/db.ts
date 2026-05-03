import { Pool } from 'pg';
import { CONFIG } from '../config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let pool: Pool;

export function initDatabase(): Pool {
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

    // Auto-run schema on first real query (lazy initialization)
    let schemaInitialized = false;
    const initSchema = async () => {
        if (schemaInitialized) return;
        try {
            const sqlPaths = [
                path.join(__dirname, '../../init.sql'),          // Docker: /app/init.sql
                path.join(__dirname, '../../../server/init.sql'), // local dev fallback
            ];
            const sqlFile = sqlPaths.find(p => fs.existsSync(p));
            if (sqlFile) {
                const sql = fs.readFileSync(sqlFile, 'utf8');
                await pool.query(sql);
                console.log('[DB] Schema initialized from init.sql');
                schemaInitialized = true;
            }
        } catch (err) {
            console.warn('[DB] Schema init warning:', (err as Error).message);
        }
    };
    // Try to init schema immediately (fire and forget)
    initSchema();

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
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
        'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at, last_login',
        [username, hashedPassword]
    );
    return result.rows[0];
}

export async function findPlayerByUsername(username: string): Promise<(PlayerAccount & { password_hash: string }) | null> {
    const result = await pool.query('SELECT id, username, password_hash, created_at, last_login FROM players WHERE username = $1', [username]);
    return result.rows[0] || null;
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
