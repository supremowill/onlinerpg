import { getPool } from './db';
import { LeaderboardEntry, PlayerBuild } from '../network/Protocol';

export class RankingService {
    private isDbAvailable(): boolean {
        try {
            const pool = getPool();
            return pool !== null && pool !== undefined;
        } catch {
            return false;
        }
    }

    /**
     * Post a player's score to the ranking
     */
    async postScore(
        playerName: string,
        score: number,
        survivalTime: number,
        collapseLevel: number,
        kills: number,
        roomId: string,
        playersInRoom: number,
        deaths: number = 0,
        assists: number = 0,
        build?: PlayerBuild
    ): Promise<void> {
        if (!this.isDbAvailable()) {
            console.warn('[Ranking] Skipping score post - no database available');
            return;
        }
        try {
            const pool = getPool();
            const color = build?.buildingColor || 'red';
            const f1 = build?.floor1 ?? 0;
            const f2 = build?.floor2 ?? 0;
            const f3 = build?.floor3 ?? 0;
            const f4 = build?.floor4 ?? 0;
            const f5 = build?.floor5 ?? 0;
            await pool.query(
                `INSERT INTO ranking (player_name, score, survival_time_seconds, collapse_level, kills, deaths, assists, room_id, players_in_room, build_color, build_floor1, build_floor2, build_floor3, build_floor4, build_floor5)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [playerName, score, Math.floor(survivalTime), collapseLevel, kills, deaths, assists, roomId, playersInRoom, color, f1, f2, f3, f4, f5]
            );
            console.log(`[Ranking] Score posted: ${playerName} = ${score} with build color: ${color}`);
        } catch (err) {
            console.warn('[Ranking] Failed to post score:', (err as Error).message);
        }
    }

    /**
     * Get top N scores
     */
    async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
        if (!this.isDbAvailable()) {
            console.warn('[Ranking] Returning empty leaderboard - no database available');
            return [];
        }
        try {
            const pool = getPool();
            const result = await pool.query(
                `SELECT r.player_name, r.score, r.survival_time_seconds, r.created_at
                 FROM ranking r
                 ORDER BY r.score DESC
                 LIMIT $1`,
                [limit]
            );

            return result.rows.map((row, index) => ({
                rank: index + 1,
                playerName: row.player_name,
                score: row.score,
                time: row.survival_time_seconds,
                createdAt: row.created_at,
            }));
        } catch (err) {
            console.warn('[Ranking] Failed to get leaderboard:', (err as Error).message);
            return [];
        }
    }

    /**
     * Save match history
     */
    async saveMatchHistory(
        roomId: string,
        totalPlayers: number,
        totalTime: number,
        collapseLevel: number
    ): Promise<void> {
        if (!this.isDbAvailable()) {
            console.warn('[Ranking] Skipping match history - no database available');
            return;
        }
        try {
            const pool = getPool();
            await pool.query(
                `INSERT INTO match_history (room_id, total_players, total_time_seconds, collapse_level)
                 VALUES ($1, $2, $3, $4)`,
                [roomId, totalPlayers, totalTime, collapseLevel]
            );
        } catch (err) {
            console.warn('[Ranking] Failed to save match history:', (err as Error).message);
        }
    }

    /**
     * Get recent matches
     */
    async getRecentMatches(limit = 20): Promise<any[]> {
        if (!this.isDbAvailable()) { return []; }
        try {
            const pool = getPool();
            const result = await pool.query(`SELECT * FROM match_history ORDER BY created_at DESC LIMIT $1`, [limit]);
            return result.rows;
        } catch (err) {
            console.warn('[Ranking] Failed to get recent matches:', (err as Error).message);
            return [];
        }
    }

    /** Aggregated statistics for a player (from ranking table) */
    async getPlayerStats(playerName: string): Promise<{
        totalKills: number;
        totalDeaths: number;
        totalAssists: number;
        totalMatches: number;
        totalScore: number;
        bestScore: number;
        avgKills: number;
        avgSurvivalTime: number;
        avgCollapse: number;
    }> {
        if (!this.isDbAvailable()) {
            return { totalKills: 0, totalDeaths: 0, totalAssists: 0, totalMatches: 0, totalScore: 0, bestScore: 0, avgKills: 0, avgSurvivalTime: 0, avgCollapse: 0 };
        }
        try {
            const pool = getPool();
            const r = await pool.query(
                `SELECT COALESCE(SUM(kills),0) AS tk,
                        COALESCE(SUM(deaths),0) AS td,
                        COALESCE(SUM(assists),0) AS ta,
                        COUNT(*) AS tm,
                        COALESCE(SUM(score),0) AS ts,
                        COALESCE(MAX(score),0) AS bs,
                        COALESCE(AVG(kills),0) AS avg_k,
                        COALESCE(AVG(survival_time_seconds),0) AS avg_t,
                        COALESCE(AVG(collapse_level),0) AS avg_c
                 FROM ranking WHERE player_name=$1`, [playerName]);
            const row = r.rows[0];
            return {
                totalKills: +row.tk,
                totalDeaths: +row.td,
                totalAssists: +row.ta,
                totalMatches: +row.tm,
                totalScore: +row.ts,
                bestScore: +row.bs,
                avgKills: parseFloat(row.avg_k),
                avgSurvivalTime: parseFloat(row.avg_t),
                avgCollapse: parseFloat(row.avg_c)
            };
        } catch (err) {
            console.warn('[Ranking] getPlayerStats failed:', (err as Error).message);
            return { totalKills: 0, totalDeaths: 0, totalAssists: 0, totalMatches: 0, totalScore: 0, bestScore: 0, avgKills: 0, avgSurvivalTime: 0, avgCollapse: 0 };
        }
    }

    /** Match history for a specific player */
    async getPlayerMatchHistory(playerName: string, limit = 10): Promise<any[]> {
        if (!this.isDbAvailable()) return [];
        try {
            const pool = getPool();
            const r = await pool.query(
                `SELECT id AS match_id, created_at AS date, score, kills, deaths, assists,
                        survival_time_seconds AS duration, players_in_room, collapse_level
                 FROM ranking WHERE player_name=$1 ORDER BY created_at DESC LIMIT $2`,
                [playerName, limit]);
            return r.rows;
        } catch (err) {
            console.warn('[Ranking] getPlayerMatchHistory failed:', (err as Error).message);
            return [];
        }
    }

    /** Leaderboard by average score of 10 best matches of all time — 60s in-memory cache */
    private _avgCache: {data:any[];ts:number}|null = null;

    async getLeaderboardByAverage(limit = 50): Promise<any[]> {
        if (!this.isDbAvailable()) return [];
        const now = Date.now();
        if (this._avgCache && now - this._avgCache.ts < 60000) return this._avgCache.data.slice(0, limit);
        try {
            const pool = getPool();
            const r = await pool.query(
                `SELECT player_name,
                        ROUND(AVG(score)::numeric,1) AS avg_score,
                        COUNT(*) AS total_matches
                 FROM (SELECT player_name, score,
                              ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC) AS rn
                       FROM ranking) sub
                 WHERE rn<=10
                 GROUP BY player_name
                 ORDER BY avg_score DESC
                 LIMIT $1`, [limit]);
            const data = r.rows.map((row,i)=>({rank:i+1,playerName:row.player_name,avgScore:parseFloat(row.avg_score),totalMatches:+row.total_matches}));
            this._avgCache = {data, ts:now};
            return data;
        } catch (err) {
            console.warn('[Ranking] getLeaderboardByAverage failed:', (err as Error).message);
            return [];
        }
    }

    /** Leaderboard by average score of 10 best matches of the current week (resets Monday 00:01 America/Sao_Paulo) — 60s cache */
    private _weeklyCache: {data:any[];ts:number;sinceMs:number}|null = null;

    async getLeaderboardByAverageWeekly(limit = 50): Promise<any[]> {
        if (!this.isDbAvailable()) return [];
        const now = Date.now();

        // Calculate Monday 00:01 America/Sao_Paulo (UTC-3) start of week using deterministic millisecond logic
        // Reference Monday May 11, 2026 at 00:01:00 BRT = 03:01:00 UTC
        const REFERENCE_MS = new Date('2026-05-11T03:01:00Z').getTime();
        const elapsed = now - REFERENCE_MS;
        const elapsedWeeks = Math.floor(elapsed / 604800000);
        const currentWeekStartMs = REFERENCE_MS + elapsedWeeks * 604800000;
        const sinceDate = new Date(currentWeekStartMs);

        if (this._weeklyCache && now - this._weeklyCache.ts < 60000 && this._weeklyCache.sinceMs === currentWeekStartMs) {
            return this._weeklyCache.data.slice(0, limit);
        }

        try {
            const pool = getPool();
            const r = await pool.query(
                `SELECT player_name,
                        ROUND(AVG(score)::numeric,1) AS avg_score,
                        COUNT(*) AS total_matches
                 FROM (SELECT player_name, score,
                              ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC) AS rn
                       FROM ranking
                       WHERE created_at >= $1) sub
                 WHERE rn<=10
                 GROUP BY player_name
                 ORDER BY avg_score DESC
                 LIMIT $2`, [sinceDate, limit]);
            const data = r.rows.map((row,i)=>({rank:i+1,playerName:row.player_name,avgScore:parseFloat(row.avg_score),totalMatches:+row.total_matches}));
            this._weeklyCache = {data, ts:now, sinceMs:currentWeekStartMs};
            return data;
        } catch (err) {
            console.warn('[Ranking] getLeaderboardByAverageWeekly failed:', (err as Error).message);
            return [];
        }
    }
}

export const rankingService = new RankingService();
