import fs from 'fs';
import path from 'path';
import { PoolClient } from 'pg';
import { getPool } from '../database/db';
import { ItemDatabase } from '../data/ItemDatabase';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEK_REFERENCE_MS = new Date('2026-05-11T03:01:00Z').getTime(); // Monday 00:01 BRT

type WeeklyWinner = {
    playerId: number;
    playerName: string;
    avgScore: number;
    top10Sum: number;
    bestScore: number;
    totalValidMatches: number;
    bestScoreAt: Date;
};

type WeekWindow = {
    weekId: string;
    start: Date;
    end: Date;
};

type ProcessOptions = {
    force?: boolean;
    now?: Date;
};

export class WeeklyAwardService {
    public getPreviousWeekWindow(now = new Date()): WeekWindow {
        const elapsedWeeks = Math.floor((now.getTime() - WEEK_REFERENCE_MS) / WEEK_MS);
        const currentWeekStartMs = WEEK_REFERENCE_MS + elapsedWeeks * WEEK_MS;
        const start = new Date(currentWeekStartMs - WEEK_MS);
        const end = new Date(currentWeekStartMs);
        return {
            weekId: start.toISOString().slice(0, 10),
            start,
            end,
        };
    }

    public getCurrentWeekWindow(now = new Date()): WeekWindow {
        const elapsedWeeks = Math.floor((now.getTime() - WEEK_REFERENCE_MS) / WEEK_MS);
        const start = new Date(WEEK_REFERENCE_MS + elapsedWeeks * WEEK_MS);
        const end = new Date(start.getTime() + WEEK_MS);
        return {
            weekId: start.toISOString().slice(0, 10),
            start,
            end,
        };
    }

    public async listAwards(limit = 30): Promise<any[]> {
        const pool = getPool();
        const result = await pool.query(
            `SELECT id, week_id, week_start, week_end, winner_player_id, winner_name,
                    avg_score, top10_sum, best_score, total_valid_matches, best_score_at,
                    item_id, item_name, item_rarity, status, error_message,
                    news_entry_id, news_published, created_at, delivered_at, updated_at
             FROM weekly_awards
             ORDER BY week_start DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    public async getWeeklyWinnerForWindow(start: Date, end: Date): Promise<WeeklyWinner | null> {
        const pool = getPool();
        const result = await pool.query(this.winnerSql(), [start, end]);
        if (result.rows.length === 0) return null;
        return this.mapWinner(result.rows[0]);
    }

    public async processPreviousWeek(options: ProcessOptions = {}): Promise<any> {
        const window = this.getPreviousWeekWindow(options.now);
        return this.processWindow(window, options.force === true);
    }

    public async processWindow(window: WeekWindow, force = false): Promise<any> {
        const pool = getPool();
        const client = await pool.connect();
        let committed = false;
        let awardRow: any = null;
        let shouldPublishNews = false;

        try {
            await client.query('BEGIN');

            const existing = await client.query(
                'SELECT * FROM weekly_awards WHERE week_id = $1 FOR UPDATE',
                [window.weekId]
            );

            if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
                await client.query('COMMIT');
                committed = true;
                let completedAward = existing.rows[0];
                if (!completedAward.news_published) {
                    try {
                        const newsEntryId = this.publishNews(completedAward);
                        const updated = await client.query(
                            `UPDATE weekly_awards
                             SET news_entry_id = $1, news_published = TRUE, error_message = NULL, updated_at = NOW()
                             WHERE id = $2
                             RETURNING *`,
                            [newsEntryId, completedAward.id]
                        );
                        completedAward = updated.rows[0] || completedAward;
                    } catch (err: any) {
                        await client.query(
                            `UPDATE weekly_awards
                             SET error_message = $1, updated_at = NOW()
                             WHERE id = $2`,
                            [`Item ja entregue, mas falha ao publicar noticia: ${err.message}`, completedAward.id]
                        );
                        completedAward.error_message = `Item ja entregue, mas falha ao publicar noticia: ${err.message}`;
                    }
                }
                return { success: true, duplicate: true, award: completedAward };
            }

            if (existing.rows.length > 0 && !force && existing.rows[0].status === 'processing') {
                await client.query('COMMIT');
                committed = true;
                return { success: false, processing: true, award: existing.rows[0] };
            }

            const winnerResult = await client.query(this.winnerSql(), [window.start, window.end]);
            if (winnerResult.rows.length === 0) {
                awardRow = await this.upsertAward(client, window, {
                    status: 'no_winner',
                    error_message: 'Nenhum jogador elegivel com pelo menos 10 partidas validas na semana.',
                });
                await client.query('COMMIT');
                committed = true;
                return { success: true, noWinner: true, award: awardRow };
            }

            const winner = this.mapWinner(winnerResult.rows[0]);
            const item = this.pickRandomBasicItem();
            if (!item) {
                awardRow = await this.upsertAward(client, window, {
                    winner_player_id: winner.playerId,
                    winner_name: winner.playerName,
                    avg_score: winner.avgScore,
                    top10_sum: winner.top10Sum,
                    best_score: winner.bestScore,
                    total_valid_matches: winner.totalValidMatches,
                    best_score_at: winner.bestScoreAt,
                    status: 'error',
                    error_message: 'Nenhum item basico disponivel para sorteio.',
                });
                await client.query('COMMIT');
                committed = true;
                return { success: false, error: 'Nenhum item basico disponivel para sorteio.', award: awardRow };
            }

            await this.upsertAward(client, window, {
                winner_player_id: winner.playerId,
                winner_name: winner.playerName,
                avg_score: winner.avgScore,
                top10_sum: winner.top10Sum,
                best_score: winner.bestScore,
                total_valid_matches: winner.totalValidMatches,
                best_score_at: winner.bestScoreAt,
                item_id: item.id,
                item_name: item.name,
                item_rarity: item.rarity,
                status: 'processing',
                error_message: null,
                news_published: false,
            });

            const playerResult = await client.query(
                'SELECT id, inventory FROM players WHERE id = $1 FOR UPDATE',
                [winner.playerId]
            );
            if (playerResult.rows.length === 0) {
                awardRow = await this.upsertAward(client, window, {
                    status: 'error',
                    error_message: `Jogador vencedor nao encontrado: ${winner.playerName}`,
                });
                await client.query('COMMIT');
                committed = true;
                return { success: false, error: 'Jogador vencedor nao encontrado.', award: awardRow };
            }

            const inventory = Array.isArray(playerResult.rows[0].inventory)
                ? [...playerResult.rows[0].inventory]
                : [];
            inventory.push(item.id);
            await client.query('UPDATE players SET inventory = $1 WHERE id = $2', [
                JSON.stringify(inventory),
                winner.playerId,
            ]);

            awardRow = await this.upsertAward(client, window, {
                winner_player_id: winner.playerId,
                winner_name: winner.playerName,
                avg_score: winner.avgScore,
                top10_sum: winner.top10Sum,
                best_score: winner.bestScore,
                total_valid_matches: winner.totalValidMatches,
                best_score_at: winner.bestScoreAt,
                item_id: item.id,
                item_name: item.name,
                item_rarity: item.rarity,
                status: 'completed',
                error_message: null,
                delivered_at: new Date(),
                news_published: false,
            });
            shouldPublishNews = true;

            await client.query('COMMIT');
            committed = true;
        } catch (err: any) {
            if (!committed) await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        if (shouldPublishNews && awardRow) {
            try {
                const newsEntryId = this.publishNews(awardRow);
                const updated = await getPool().query(
                    `UPDATE weekly_awards
                     SET news_entry_id = $1, news_published = TRUE, updated_at = NOW()
                     WHERE id = $2
                     RETURNING *`,
                    [newsEntryId, awardRow.id]
                );
                awardRow = updated.rows[0] || awardRow;
            } catch (err: any) {
                await getPool().query(
                    `UPDATE weekly_awards
                     SET news_published = FALSE, error_message = $1, updated_at = NOW()
                     WHERE id = $2`,
                    [`Item entregue, mas falha ao publicar noticia: ${err.message}`, awardRow.id]
                );
                awardRow.error_message = `Item entregue, mas falha ao publicar noticia: ${err.message}`;
            }
        }

        return { success: true, award: awardRow };
    }

    private winnerSql(): string {
        return `
            WITH ranked AS (
                SELECT r.id, r.player_name, LOWER(r.player_name) AS player_key, r.score, r.created_at,
                       ROW_NUMBER() OVER (
                           PARTITION BY LOWER(r.player_name)
                           ORDER BY r.score DESC, r.created_at ASC, r.id ASC
                       ) AS rn
                FROM ranking r
                WHERE r.created_at >= $1
                  AND r.created_at < $2
            ),
            top10 AS (
                SELECT * FROM ranked WHERE rn <= 10
            ),
            top10_best AS (
                SELECT player_key, created_at AS best_score_at
                FROM (
                    SELECT player_key, created_at,
                           ROW_NUMBER() OVER (
                               PARTITION BY player_key
                               ORDER BY score DESC, created_at ASC, id ASC
                           ) AS best_rn
                    FROM top10
                ) best
                WHERE best_rn = 1
            ),
            player_totals AS (
                SELECT LOWER(player_name) AS player_key, COUNT(*) AS total_valid_matches
                FROM ranking
                WHERE created_at >= $1
                  AND created_at < $2
                GROUP BY LOWER(player_name)
            )
            SELECT p.id AS player_id,
                   MIN(t.player_name) AS player_name,
                   ROUND(AVG(t.score)::numeric, 1) AS avg_score,
                   SUM(t.score)::integer AS top10_sum,
                   MAX(t.score)::integer AS best_score,
                   MAX(pt.total_valid_matches)::integer AS total_valid_matches,
                   b.best_score_at AS best_score_at
            FROM top10 t
            JOIN players p ON LOWER(p.username) = t.player_key
            JOIN player_totals pt ON pt.player_key = t.player_key
            JOIN top10_best b ON b.player_key = t.player_key
            GROUP BY p.id, t.player_key, b.best_score_at
            HAVING COUNT(*) >= 10
            ORDER BY avg_score DESC,
                     top10_sum DESC,
                     best_score DESC,
                     total_valid_matches DESC,
                     best_score_at ASC,
                     p.id ASC
            LIMIT 1`;
    }

    private mapWinner(row: any): WeeklyWinner {
        return {
            playerId: Number(row.player_id),
            playerName: row.player_name,
            avgScore: Number(row.avg_score),
            top10Sum: Number(row.top10_sum),
            bestScore: Number(row.best_score),
            totalValidMatches: Number(row.total_valid_matches),
            bestScoreAt: new Date(row.best_score_at),
        };
    }

    private pickRandomBasicItem(): { id: string; name: string; rarity: string } | null {
        const basicItems = Object.values(ItemDatabase).filter(item => item.rarity === 'basic');
        if (basicItems.length === 0) return null;
        const index = Math.floor(Math.random() * basicItems.length);
        return basicItems[index];
    }

    private async upsertAward(client: PoolClient, window: WeekWindow, values: Record<string, any>): Promise<any> {
        const merged = {
            winner_player_id: null,
            winner_name: null,
            avg_score: null,
            top10_sum: null,
            best_score: null,
            total_valid_matches: null,
            best_score_at: null,
            item_id: null,
            item_name: null,
            item_rarity: null,
            status: 'pending',
            error_message: null,
            delivered_at: null,
            news_entry_id: null,
            news_published: false,
            ...values,
        };

        const result = await client.query(
            `INSERT INTO weekly_awards (
                week_id, week_start, week_end, winner_player_id, winner_name,
                avg_score, top10_sum, best_score, total_valid_matches, best_score_at,
                item_id, item_name, item_rarity, status, error_message,
                delivered_at, news_entry_id, news_published
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             ON CONFLICT (week_id) DO UPDATE SET
                winner_player_id = COALESCE(EXCLUDED.winner_player_id, weekly_awards.winner_player_id),
                winner_name = COALESCE(EXCLUDED.winner_name, weekly_awards.winner_name),
                avg_score = COALESCE(EXCLUDED.avg_score, weekly_awards.avg_score),
                top10_sum = COALESCE(EXCLUDED.top10_sum, weekly_awards.top10_sum),
                best_score = COALESCE(EXCLUDED.best_score, weekly_awards.best_score),
                total_valid_matches = COALESCE(EXCLUDED.total_valid_matches, weekly_awards.total_valid_matches),
                best_score_at = COALESCE(EXCLUDED.best_score_at, weekly_awards.best_score_at),
                item_id = COALESCE(EXCLUDED.item_id, weekly_awards.item_id),
                item_name = COALESCE(EXCLUDED.item_name, weekly_awards.item_name),
                item_rarity = COALESCE(EXCLUDED.item_rarity, weekly_awards.item_rarity),
                status = EXCLUDED.status,
                error_message = EXCLUDED.error_message,
                delivered_at = COALESCE(EXCLUDED.delivered_at, weekly_awards.delivered_at),
                news_entry_id = COALESCE(EXCLUDED.news_entry_id, weekly_awards.news_entry_id),
                news_published = EXCLUDED.news_published,
                updated_at = NOW()
             RETURNING *`,
            [
                window.weekId,
                window.start,
                window.end,
                merged.winner_player_id,
                merged.winner_name,
                merged.avg_score,
                merged.top10_sum,
                merged.best_score,
                merged.total_valid_matches,
                merged.best_score_at,
                merged.item_id,
                merged.item_name,
                merged.item_rarity,
                merged.status,
                merged.error_message,
                merged.delivered_at,
                merged.news_entry_id,
                merged.news_published,
            ]
        );
        return result.rows[0];
    }

    private publishNews(award: any): string {
        const updatesPath = this.resolveUpdatesPath();
        const updates = this.readUpdates(updatesPath);
        const entryId = `weekly-award-${award.week_id}`;

        const existingIndex = updates.findIndex((entry: any) => entry && entry.id === entryId);
        const update = {
            id: entryId,
            date: new Date().toISOString(),
            type: 'Novidade',
            target: 'Vencedor do Ranking Semanal',
            description: `O jogador **${award.winner_name}** venceu o Ranking Semanal por Media com **${award.avg_score}** pontos nas 10 melhores partidas da semana. Como recompensa, recebeu o item basico **${award.item_name}**. Parabens ao campeao!`,
        };

        if (existingIndex >= 0) {
            updates[existingIndex] = update;
        } else {
            updates.push(update);
        }

        fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2), 'utf8');
        return entryId;
    }

    private resolveUpdatesPath(): string {
        const candidates = [
            process.env.UPDATES_JSON_PATH,
            path.resolve(__dirname, '../../public/updates.json'),
            path.resolve(__dirname, '../../../client/updates.json'),
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) return candidate;
        }

        return candidates[candidates.length - 1];
    }

    private readUpdates(updatesPath: string): any[] {
        if (!fs.existsSync(updatesPath)) return [];
        const raw = fs.readFileSync(updatesPath, 'utf8');
        const decoded = JSON.parse(raw || '[]');
        return Array.isArray(decoded) ? decoded : [];
    }
}

export const weeklyAwardService = new WeeklyAwardService();
