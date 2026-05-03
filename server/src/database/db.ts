import { Pool } from 'pg';
import { CONFIG } from '../config';
import fs from 'fs';
import path from 'path';

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
    pool = new Pool({
        connectionString: dbUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
    });

    pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err);
    });

    // Test connection and auto-run schema on startup
    pool.connect().then(async (client) => {
        console.log('[DB] Connected successfully!');
        try {
            const sqlPaths = [
                path.join(__dirname, '../../init.sql'),          // Docker: /app/init.sql
                path.join(__dirname, '../../../server/init.sql'), // local dev fallback
            ];
            const sqlFile = sqlPaths.find(p => fs.existsSync(p));
            if (sqlFile) {
                const sql = fs.readFileSync(sqlFile, 'utf8');
                await client.query(sql);
                console.log('[DB] Schema initialized from init.sql');
            }
        } catch (err) {
            console.warn('[DB] Schema init warning:', (err as Error).message);
        } finally {
            client.release();
        }
    }).catch(err => {
        console.error('[DB] Failed to connect to database on startup:', (err as Error).message);
        console.error('[DB] Leaderboard will be unavailable until reconnected');
    });

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
