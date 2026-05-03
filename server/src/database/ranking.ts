import { getPool } from './db';
import { LeaderboardEntry } from '../network/Protocol';

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
        playersInRoom: number
    ): Promise<void> {
        if (!this.isDbAvailable()) {
            console.warn('[Ranking] Skipping score post - no database available');
            return;
        }
        try {
            const pool = getPool();
            await pool.query(
                `INSERT INTO ranking (player_name, score, survival_time_seconds, collapse_level, kills, room_id, players_in_room)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [playerName, score, survivalTime, collapseLevel, kills, roomId, playersInRoom]
            );
            console.log(`[Ranking] Score posted: ${playerName} = ${score}`);
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
                `SELECT player_name, score, survival_time_seconds, created_at
                 FROM ranking
                 ORDER BY score DESC
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
        if (!this.isDbAvailable()) {
            return [];
        }
        try {
            const pool = getPool();
            const result = await pool.query(
                `SELECT * FROM match_history ORDER BY created_at DESC LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (err) {
            console.warn('[Ranking] Failed to get recent matches:', (err as Error).message);
            return [];
        }
    }
}

export const rankingService = new RankingService();
