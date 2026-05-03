import { Pool } from 'pg';
import { CONFIG } from '../config';
import fs from 'fs';
import path from 'path';

let pool: Pool;

export function initDatabase(): Pool {
    const dbUrl = CONFIG.DATABASE_URL;

    // Only create pool if DATABASE_URL is provided
    if (!dbUrl) {
        console.warn('[DB] No DATABASE_URL provided - running without database (leaderboard disabled)');
        // Return a dummy pool that throws on queries
        pool = {
            on: () => {},
            connect: () => Promise.reject(new Error('No database configured')),
            query: () => Promise.reject(new Error('No database configured')),
            end: () => Promise.resolve(),
        } as any;
        return pool;
    }

    pool = new Pool({
        connectionString: dbUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err);
    });

    // Auto-run schema SQL on startup (CREATE TABLE IF NOT EXISTS = safe to repeat)
    pool.connect().then(async (client) => {
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
            console.warn('[DB] Schema init warning (may already exist):', (err as Error).message);
        } finally {
            client.release();
        }
    }).catch(err => console.warn('[DB] Could not connect on startup (non-fatal):', err));

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
