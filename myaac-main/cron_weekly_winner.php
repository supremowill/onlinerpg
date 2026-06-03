<?php
// cron_weekly_winner.php - runs on Monday 00:01 BRT to process the weekly ranking award.

if (php_sapi_name() !== 'cli') {
    header('HTTP/1.0 403 Forbidden');
    die("Forbidden: This script can only be run via command line interface.\n");
}

$endpoint = getenv('WEEKLY_AWARD_ENDPOINT') ?: 'http://app:3000/api/internal/weekly-awards/process';
$secret = getenv('WEEKLY_AWARD_SECRET') ?: (getenv('JWT_SECRET') ?: '');

if ($secret === '') {
    die("Weekly award secret is not configured. Set WEEKLY_AWARD_SECRET or JWT_SECRET.\n");
}

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\nX-Weekly-Award-Secret: " . $secret . "\r\n",
        'content' => '{}',
        'timeout' => 20,
        'ignore_errors' => true,
    ],
]);

$response = file_get_contents($endpoint, false, $context);
$statusLine = $http_response_header[0] ?? 'HTTP/1.1 000 Unknown';
preg_match('/\s(\d{3})\s/', $statusLine, $matches);
$status = isset($matches[1]) ? (int)$matches[1] : 0;

if ($response === false || $status < 200 || $status >= 300) {
    echo "Error: weekly award processing failed with status {$status}.\n";
    if ($response !== false) {
        echo $response . "\n";
    }
    exit(1);
}

$decoded = json_decode($response, true);
if (!is_array($decoded)) {
    echo "Error: backend returned invalid JSON.\n";
    echo $response . "\n";
    exit(1);
}

if (!empty($decoded['duplicate'])) {
    echo "Weekly award already processed for this week.\n";
    exit(0);
}

if (!empty($decoded['noWinner'])) {
    echo "No eligible weekly winner found.\n";
    exit(0);
}

if (empty($decoded['success'])) {
    echo "Error: weekly award backend reported failure.\n";
    echo $response . "\n";
    exit(1);
}

$award = $decoded['award'] ?? [];
$winner = $award['winner_name'] ?? 'unknown';
$item = $award['item_name'] ?? 'unknown item';
$score = $award['avg_score'] ?? '0';

echo "Success: weekly award delivered to {$winner} ({$item}) with average {$score}.\n";
