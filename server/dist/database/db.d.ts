import { Pool } from 'pg';
export declare function initDatabase(): Pool;
export declare function getPool(): Pool;
export declare function closeDatabase(): Promise<void>;
export declare function testConnection(): Promise<boolean>;
//# sourceMappingURL=db.d.ts.map