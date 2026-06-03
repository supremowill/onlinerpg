<?php
defined('MYAAC') or die('Direct access not allowed!');

$title = 'Premiacoes Semanais';
$isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
if (!$isAdmin) {
	header('Location: ?subtopic=news');
	exit;
}

function weekly_awards_call_backend()
{
	$endpoint = getenv('WEEKLY_AWARD_ENDPOINT') ?: 'http://app:3000/api/internal/weekly-awards/process';
	$secret = getenv('WEEKLY_AWARD_SECRET') ?: (getenv('JWT_SECRET') ?: '');
	if ($secret === '') {
		return [false, 'Segredo da premiacao nao configurado.'];
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
		return [false, 'Backend retornou HTTP ' . $status . '. ' . ($response ?: '')];
	}

	$decoded = json_decode($response, true);
	if (!is_array($decoded)) {
		return [false, 'Backend retornou JSON invalido.'];
	}

	if (empty($decoded['success'])) {
		return [false, $decoded['error'] ?? ($decoded['detail'] ?? 'Falha ao processar premiacao.')];
	}

	if (!empty($decoded['duplicate'])) {
		return [true, 'Esta semana ja foi premiada. Nenhum item duplicado foi entregue.'];
	}

	if (!empty($decoded['noWinner'])) {
		return [true, 'Nao houve jogador elegivel na semana anterior.'];
	}

	$award = $decoded['award'] ?? [];
	$winner = $award['winner_name'] ?? 'jogador';
	$item = $award['item_name'] ?? 'item basico';
	return [true, 'Premiacao processada: ' . $winner . ' recebeu ' . $item . '.'];
}

function weekly_awards_format_date($value)
{
	if (!$value) return '-';
	$timestamp = strtotime($value);
	return $timestamp ? date('d/m/Y H:i', $timestamp) : '-';
}

$message = '';
$messageOk = true;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'process_previous') {
	list($messageOk, $message) = weekly_awards_call_backend();
}

$awards = [];
$loadError = '';
if (!$pdo) {
	$loadError = 'Banco de dados offline.';
} else {
	try {
		$stmt = $pdo->query("
			SELECT id, week_id, week_start, week_end, winner_name, avg_score, top10_sum,
			       best_score, total_valid_matches, item_name, item_rarity, status,
			       error_message, news_entry_id, news_published, delivered_at, updated_at
			FROM weekly_awards
			ORDER BY week_start DESC
			LIMIT 50
		");
		$awards = $stmt->fetchAll(PDO::FETCH_ASSOC);
	} catch (Exception $e) {
		$loadError = 'Erro ao carregar premiacoes: ' . $e->getMessage();
	}
}
?>

<style>
	.weekly-awards-wrap { color:#000; font-size:11px; }
	.weekly-awards-status { padding:2px 6px; color:#fff; font-weight:bold; border-radius:2px; }
	.weekly-awards-completed { background:#228b22; }
	.weekly-awards-error { background:#b22222; }
	.weekly-awards-no_winner { background:#7a5c00; }
	.weekly-awards-pending, .weekly-awards-processing { background:#555; }
	.weekly-awards-toolbar { background:#d4c0a1; border:1px solid #8d7652; padding:8px; margin-bottom:10px; }
	.weekly-awards-button { font-weight:bold; cursor:pointer; padding:4px 10px; }
	.weekly-awards-muted { color:#555; font-size:10px; }
</style>

<div class="weekly-awards-wrap">
	<p>
		Historico da premiacao automatica do Ranking Semanal por Media. O processamento usa as 10 melhores partidas
		da semana anterior, exige minimo de 10 partidas validas e entrega 1 item basico aleatorio.
	</p>

	<?php if ($message !== ''): ?>
		<div style="padding:8px; margin-bottom:10px; border:1px solid <?php echo $messageOk ? '#228b22' : '#b22222'; ?>; background:<?php echo $messageOk ? '#dff0d8' : '#f2dede'; ?>;">
			<?php echo htmlspecialchars($message); ?>
		</div>
	<?php endif; ?>

	<?php if ($loadError !== ''): ?>
		<div style="padding:8px; margin-bottom:10px; border:1px solid #b22222; background:#f2dede;">
			<?php echo htmlspecialchars($loadError); ?>
		</div>
	<?php endif; ?>

	<div class="weekly-awards-toolbar">
		<form method="post" action="?subtopic=admin/weekly_awards" style="margin:0;" onsubmit="return confirm('Processar a premiacao da semana anterior agora? Premiacao concluida nao sera duplicada.');">
			<input type="hidden" name="action" value="process_previous" />
			<button type="submit" class="weekly-awards-button">Processar Semana Anterior</button>
			<span class="weekly-awards-muted">Use para corrigir erro/pendencia ou testar o fechamento manual.</span>
		</form>
	</div>

	<table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
		<tr bgcolor="#D4C0A1">
			<td><b>Semana</b></td>
			<td><b>Vencedor</b></td>
			<td align="right"><b>Media</b></td>
			<td align="right"><b>Soma Top 10</b></td>
			<td><b>Item</b></td>
			<td><b>Status</b></td>
			<td><b>Entrega</b></td>
			<td><b>Noticia</b></td>
		</tr>
		<?php if (empty($awards)): ?>
			<tr bgcolor="#F1E0C6">
				<td colspan="8" align="center" style="padding:12px;">Nenhuma premiacao registrada ainda.</td>
			</tr>
		<?php else: ?>
			<?php foreach ($awards as $award): ?>
				<?php
					$status = $award['status'] ?: 'pending';
					$statusClass = 'weekly-awards-' . preg_replace('/[^a-z_]/', '', strtolower($status));
					$newsPublished = isset($award['news_published']) && pg_to_bool($award['news_published']);
				?>
				<tr bgcolor="#F1E0C6" title="<?php echo htmlspecialchars($award['error_message'] ?? ''); ?>">
					<td>
						<?php echo htmlspecialchars($award['week_id']); ?><br/>
						<span class="weekly-awards-muted">
							<?php echo weekly_awards_format_date($award['week_start']); ?> ate <?php echo weekly_awards_format_date($award['week_end']); ?>
						</span>
					</td>
					<td><?php echo htmlspecialchars($award['winner_name'] ?: '-'); ?></td>
					<td align="right"><?php echo htmlspecialchars($award['avg_score'] ?: '-'); ?></td>
					<td align="right"><?php echo htmlspecialchars($award['top10_sum'] ?: '-'); ?></td>
					<td>
						<?php echo htmlspecialchars($award['item_name'] ?: '-'); ?><br/>
						<span class="weekly-awards-muted"><?php echo htmlspecialchars($award['item_rarity'] ?: ''); ?></span>
					</td>
					<td><span class="weekly-awards-status <?php echo $statusClass; ?>"><?php echo htmlspecialchars($status); ?></span></td>
					<td><?php echo weekly_awards_format_date($award['delivered_at']); ?></td>
					<td><?php echo $newsPublished ? htmlspecialchars($award['news_entry_id'] ?: 'publicada') : '-'; ?></td>
				</tr>
			<?php endforeach; ?>
		<?php endif; ?>
	</table>
</div>
