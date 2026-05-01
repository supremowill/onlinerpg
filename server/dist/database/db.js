"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getPool = getPool;
exports.closeDatabase = closeDatabase;
exports.testConnection = testConnection;
const pg_1 = require("pg");
const config_1 = require("../config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let pool;
function initDatabase() {
    pool = new pg_1.Pool({
        connectionString: config_1.CONFIG.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err);
    });
    // Auto-run schema SQL on startup (CREATE TABLE IF NOT EXISTS = safe to repeat)
    pool.connect().then(async (client) => {
        try {
            const sqlPaths = [
                path_1.default.join(__dirname, '../../init.sql'), // Docker: /app/init.sql
                path_1.default.join(__dirname, '../../../server/init.sql'), // local dev fallback
            ];
            const sqlFile = sqlPaths.find(p => fs_1.default.existsSync(p));
            if (sqlFile) {
                const sql = fs_1.default.readFileSync(sqlFile, 'utf8');
                await client.query(sql);
                console.log('[DB] Schema initialized from init.sql');
            }
        }
        catch (err) {
            console.warn('[DB] Schema init warning (may already exist):', err.message);
        }
        finally {
            client.release();
        }
    }).catch(err => console.error('[DB] Could not connect on startup:', err));
    console.log('[DB] PostgreSQL pool initialized');
    return pool;
}
function getPool() {
    if (!pool) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return pool;
}
async function closeDatabase() {
    if (pool) {
        await pool.end();
        console.log('[DB] PostgreSQL pool closed');
    }
}
async function testConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('[DB] Connection test successful');
        return true;
    }
    catch (err) {
        console.error('[DB] Connection test failed:', err);
        return false;
    }
}
//# sourceMappingURL=db.js.map