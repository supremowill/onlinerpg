<?php
// cron_weekly_winner.php - runs on Monday at 00:01 to record the weekly winner in updates.json

if (php_sapi_name() !== 'cli') {
    header('HTTP/1.0 403 Forbidden');
    die("Forbidden: This script can only be run via command line interface.\n");
}

$dbUrl = getenv('DATABASE_URL') ?: "postgresql://survival:survival_secret@db:5432/survival_game";
$pdo = null;

try {
    if (preg_match('/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/', $dbUrl, $matches)) {
        $user = $matches[1];
        $pass = $matches[2];
        $host = $matches[3];
        $port = $matches[4];
        $dbname = explode('?', $matches[5])[0];
        $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5
        ]);
    } else {
        $pdo = new PDO("pgsql:host=db;port=5432;dbname=survival_game", "survival", "survival_secret", [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5
        ]);
    }
} catch (Exception $e) {
    die("Database connection failed: " . $e->getMessage() . "\n");
}

if ($pdo) {
    try {
        // Query the weekly winner from the week that JUST ended
        // The week ended on Monday at 00:01:00, so we check created_at in the previous week range
        $sql = "
            WITH weekly_ranked AS (
                SELECT player_name, score,
                        ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC) as rn
                FROM ranking
                WHERE created_at >= date_trunc('week', NOW() - INTERVAL '1 week' - INTERVAL '1 minute') + INTERVAL '1 minute'
                  AND created_at < date_trunc('week', NOW() - INTERVAL '1 minute') + INTERVAL '1 minute'
            )
            SELECT player_name, ROUND(AVG(score)) as avg_score
            FROM weekly_ranked
            WHERE rn <= 10
            GROUP BY player_name
            HAVING COUNT(*) >= 10
            ORDER BY avg_score DESC
            LIMIT 1";
        
        $stmt = $pdo->query($sql);
        $winner = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($winner) {
            $winnerName = $winner['player_name'];
            $winnerScore = $winner['avg_score'];
            
            $updatesPath = __DIR__ . '/updates.json';
            $updates = [];
            if (file_exists($updatesPath)) {
                $updates = json_decode(file_get_contents($updatesPath), true);
            }
            if (!is_array($updates)) {
                $updates = [];
            }
            
            $newUpdate = [
                'id' => (string)time(),
                'date' => date('Y-m-d\TH:i:s.v\Z'),
                'type' => 'Novidade',
                'target' => '👑 Vencedor do Ranking Semanal',
                'description' => "🏆 O jogador **" . $winnerName . "** conquistou a vitória no Ranking Semanal de Média (que se encerrou hoje) com uma média incrível de **" . $winnerScore . "** pontos no seu Top 10 de partidas! Parabéns ao grande campeão da semana! 🎖️"
            ];
            
            $updates[] = $newUpdate;
            
            if (file_put_contents($updatesPath, json_encode($updates, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                echo "Success: Weekly winner " . $winnerName . " posted to updates.json.\n";
            } else {
                echo "Error: Failed to write to updates.json.\n";
            }
        } else {
            echo "No winner found for the weekly ranking (minimum 10 matches required).\n";
        }
    } catch (Exception $e) {
        echo "Database error: " . $e->getMessage() . "\n";
    }
}
