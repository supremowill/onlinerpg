import { getPool } from './db';
import { LeaderboardEntry } from '../network/Protocol';

export class RankingService {
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
        const pool = getPool();
        await pool.query(
            `INSERT INTO ranking (player_name, score, survival_time_seconds, collapse_level, kills, room_id, players_in_room)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [playerName, score, survivalTime, collapseLevel, kills, roomId, playersInRoom]
        );
        console.log(`[Ranking] Score posted: ${playerName} = ${score}`);
    }

    /**
     * Get top N scores
     */
    async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
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
        const pool = getPool();
        await pool.query(
            `INSERT INTO match_history (room_id, total_players, total_time_seconds, collapse_level)
             VALUES ($1, $2, $3, $4)`,
            [roomId, totalPlayers, totalTime, collapseLevel]
        );
    }

    /**
     * Get recent matches
     */
    async getRecentMatches(limit = 20): Promise<any[]> {
        const pool = getPool();
        const result = await pool.query(
            `SELECT * FROM match_history ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return result.rows;
    }
}

export const rankingService = new RankingService();
