import { LeaderboardEntry } from '../network/Protocol';
export declare class RankingService {
    /**
     * Post a player's score to the ranking
     */
    postScore(playerName: string, score: number, survivalTime: number, collapseLevel: number, kills: number, roomId: string, playersInRoom: number): Promise<void>;
    /**
     * Get top N scores
     */
    getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
    /**
     * Save match history
     */
    saveMatchHistory(roomId: string, totalPlayers: number, totalTime: number, collapseLevel: number): Promise<void>;
    /**
     * Get recent matches
     */
    getRecentMatches(limit?: number): Promise<any[]>;
}
export declare const rankingService: RankingService;
//# sourceMappingURL=ranking.d.ts.map