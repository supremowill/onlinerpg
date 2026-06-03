<?php
defined('MYAAC') or die('Direct access not allowed!');

$title = 'Balanceamento de Jogo';
$isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
if (!$isAdmin) {
	header('Location: ?subtopic=news');
	exit;
}

$gameDataPath = dirname(__DIR__, 2) . '/game_data.json';

function admin_balance_json_response($payload, $status = 200)
{
	http_response_code($status);
	header('Content-Type: application/json');
	echo json_encode($payload);
	exit;
}

function admin_balance_read_game_data($path)
{
	if (!file_exists($path)) {
		return [null, 'Arquivo game_data.json nao encontrado.'];
	}

	$raw = file_get_contents($path);
	$decoded = json_decode($raw, true);
	if (!is_array($decoded)) {
		return [null, 'Erro ao decodificar game_data.json: ' . json_last_error_msg()];
	}

	if (!isset($decoded['enemies']) || !is_array($decoded['enemies'])) {
		return [null, 'game_data.json nao possui o objeto enemies.'];
	}

	return [$decoded, ''];
}

function admin_balance_save_game_data($path, $gameData)
{
	$encoded = json_encode($gameData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	if ($encoded === false) {
		return 'Erro ao converter dados para JSON: ' . json_last_error_msg();
	}

	if (file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) === false) {
		return 'Falha ao gravar game_data.json.';
	}

	return '';
}

function admin_balance_reload_server()
{
	if (!function_exists('curl_init')) {
		return [false, 'PHP cURL nao esta disponivel.'];
	}

	$ch = curl_init('http://app:3000/api/admin/reload-data');
	curl_setopt($ch, CURLOPT_POST, 1);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_TIMEOUT, 5);
	$response = curl_exec($ch);
	$curlError = curl_error($ch);
	$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	curl_close($ch);

	if ($response === false || $status < 200 || $status >= 300) {
		return [false, $curlError ?: 'Hot-Reload falhou com HTTP ' . $status . '.'];
	}

	$decoded = json_decode($response, true);
	if (is_array($decoded) && isset($decoded['success']) && !$decoded['success']) {
		return [false, $decoded['error'] ?? 'Hot-Reload recusado pelo servidor.'];
	}

	return [true, 'Servidor do jogo recarregado com sucesso.'];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$payload = json_decode(file_get_contents('php://input'), true);
	if (!is_array($payload)) {
		admin_balance_json_response(['success' => false, 'error' => 'Payload JSON invalido.'], 400);
	}

	if (($payload['action'] ?? '') !== 'save_balance') {
		admin_balance_json_response(['success' => false, 'error' => 'Acao invalida.'], 400);
	}

	$gameData = $payload['gameData'] ?? null;
	if (!is_array($gameData) || !isset($gameData['player']) || !isset($gameData['enemies']) || !is_array($gameData['enemies'])) {
		admin_balance_json_response(['success' => false, 'error' => 'Dados invalidos. O JSON precisa conter player e enemies.'], 400);
	}

	$error = admin_balance_save_game_data($gameDataPath, $gameData);
	if ($error !== '') {
		admin_balance_json_response(['success' => false, 'error' => $error], 500);
	}

	list($reloaded, $reloadMessage) = admin_balance_reload_server();
	admin_balance_json_response([
		'success' => true,
		'reloaded' => $reloaded,
		'message' => $reloaded ? 'Alteracoes salvas. ' . $reloadMessage : 'Alteracoes salvas, mas o Hot-Reload falhou: ' . $reloadMessage,
	]);
}

list($gameData, $loadError) = admin_balance_read_game_data($gameDataPath);
if (!is_array($gameData)) {
	$gameData = ['version' => '1.0.0', 'player' => [], 'enemies' => []];
}

$gameDataJson = json_encode($gameData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
?>

<style>
	.balance-admin-wrap {
		color: #000;
		font-size: 11px;
	}

	.balance-admin-wrap input,
	.balance-admin-wrap select,
	.balance-admin-wrap textarea {
		box-sizing: border-box;
		max-width: 100%;
	}

	.balance-admin-wrap textarea {
		font-family: Consolas, monospace;
		font-size: 11px;
	}

	.balance-admin-toolbar {
		margin: 0 0 10px 0;
		padding: 8px;
		background: #d4c0a1;
		border: 1px solid #8d7652;
	}

	.balance-admin-toolbar button,
	.balance-admin-toolbar input {
		margin-top: 4px;
	}

	.balance-entity-link {
		color: #000;
		text-decoration: none;
		display: block;
		padding: 4px;
	}

	.balance-entity-link:hover {
		background: #fff2cc;
		color: #000;
	}

	.balance-muted {
		color: #555;
		font-size: 9px;
	}

	.balance-json-editor {
		min-height: 520px;
		width: 100%;
	}

	.balance-section {
		margin-bottom: 10px;
	}

	.balance-save {
		font-weight: bold;
		padding: 5px 15px;
		cursor: pointer;
	}
</style>

<div class="balance-admin-wrap">
	<?php if ($loadError): ?>
		<div style="color:#FFF; background:#8b0000; border:1px solid red; padding:8px; margin-bottom:15px; font-weight:bold;">
			<?php echo htmlspecialchars($loadError); ?>
		</div>
	<?php endif; ?>

	<div id="balanceStatus"></div>

	<p style="font-size:11px; color:#000; margin-bottom:15px;">
		Ajuste os parametros de balanceamento do jogador, inimigos, bosses, passivas e habilidades. Ao salvar, o arquivo
		<code>game_data.json</code> sera atualizado e o servidor tentara aplicar Hot-Reload automaticamente.
	</p>

	<div class="balance-admin-toolbar">
		<b>Filtro:</b>
		<input id="balanceFilter" type="text" placeholder="Buscar entidade..." style="width:220px;" />
		<button id="balanceSaveTop" type="button" class="balance-save">Salvar Alteracoes</button>
		<button id="balanceJsonTab" type="button">JSON Avancado</button>
	</div>

	<table border="0" cellpadding="0" cellspacing="10" width="100%">
		<tr valign="top">
			<td width="30%">
				<div id="balanceEntityList"></div>
			</td>
			<td width="70%">
				<div id="balanceEditor"></div>
			</td>
		</tr>
	</table>
</div>

<script>
(function () {
	let gameData = <?php echo $gameDataJson ?: '{"player":{},"enemies":{}}'; ?>;
	let selectedEntity = 'Player';
	let advancedJsonOpen = false;

	const routeUrl = '?subtopic=admin/balance';
	const listEl = document.getElementById('balanceEntityList');
	const editorEl = document.getElementById('balanceEditor');
	const statusEl = document.getElementById('balanceStatus');
	const filterEl = document.getElementById('balanceFilter');

	function ensureDefaultBalanceFields() {
		if (!gameData.player || typeof gameData.player !== 'object') {
			gameData.player = {};
		}
		if (!Object.prototype.hasOwnProperty.call(gameData.player, 'defense')) {
			gameData.player.defense = 0;
		}

		Object.keys(gameData.enemies || {}).forEach(function (id) {
			const enemy = gameData.enemies[id];
			if (!enemy || typeof enemy !== 'object') {
				return;
			}
			if (!enemy.stats || typeof enemy.stats !== 'object' || Array.isArray(enemy.stats)) {
				enemy.stats = {};
			}
			if (!Object.prototype.hasOwnProperty.call(enemy.stats, 'defense')) {
				enemy.stats.defense = 0;
			}
		});
	}

	function escapeHtml(value) {
		return String(value ?? '').replace(/[&<>"']/g, function (char) {
			return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'})[char];
		});
	}

	function labelize(key) {
		const labels = {
			hp: 'HP',
			speed: 'Velocidade',
			attackCooldownMs: 'Cooldown de Ataque (ms)',
			projectileSpeed: 'Velocidade do Projetil',
			projectileLifetime: 'Tempo Vida Projetil (s)',
			hitboxRadius: 'Raio da Hitbox',
			xpToFirstLevel: 'XP para Level 2',
			xpMultiplier: 'Multiplicador de XP por Level',
			levelHpMultiplier: 'Multiplicador de HP por Level',
			baseDamage: 'Ataque Base',
			levelDamageMultiplier: 'Multiplicador de Ataque por Level',
			critChance: 'Chance de Critico',
			critDamageMultiplier: 'Multiplicador de Dano Critico',
			attackRange: 'Alcance de Ataque',
			attackCooldown: 'Cooldown de Ataque',
			xp: 'XP Concedida',
			score: 'Score Concedido',
			aggroRange: 'Raio de Aggro',
			retreatRange: 'Raio de Recuo',
			idealRange: 'Distancia Ideal',
			timer: 'Tempo de Spawn',
			count: 'Quantidade',
			isBoss: 'E Boss',
			isUnique: 'E Unico',
			scale: 'Escala',
			color: 'Cor Principal',
			emissive: 'Cor Emissiva',
			shape: 'Forma',
			profile: 'Perfil',
			category: 'Categoria',
			name: 'Nome',
			id: 'ID'
		};
		return labels[key] || String(key).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, function (letter) {
			return letter.toUpperCase();
		});
	}

	function setByPath(root, path, value) {
		let cursor = root;
		path.slice(0, -1).forEach(function (key) {
			if (!cursor[key] || typeof cursor[key] !== 'object') {
				cursor[key] = {};
			}
			cursor = cursor[key];
		});
		cursor[path[path.length - 1]] = value;
	}

	function parseInput(input) {
		const type = input.dataset.type;
		if (type === 'number') {
			const value = Number(String(input.value).replace(',', '.'));
			return Number.isFinite(value) ? value : 0;
		}
		if (type === 'percent') {
			const value = Number(String(input.value).replace(',', '.'));
			return Number.isFinite(value) ? value / 100 : 0;
		}
		if (type === 'boolean') {
			return input.checked;
		}
		if (type === 'json') {
			return JSON.parse(input.value || 'null');
		}
		return input.value;
	}

	function bindFieldEvents(scope) {
		scope.querySelectorAll('[data-path]').forEach(function (input) {
			input.addEventListener('change', function () {
				try {
					setByPath(gameData, input.dataset.path.split('.'), parseInput(input));
					statusEl.innerHTML = '';
				} catch (error) {
					showStatus('JSON invalido no campo ' + (input.dataset.label || '') + ': ' + error.message, 'error');
				}
			});
		});
	}

	function tableStart(title) {
		return '<table class="balance-section" border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">' +
			'<tr bgcolor="#D4C0A1"><td colspan="2" style="color:#000; font-weight:bold; font-size:11px;"><b>' + escapeHtml(title) + '</b></td></tr>';
	}

	function tableEnd() {
		return '</table>';
	}

	function fieldRow(rootPath, key, value, rowIndex) {
		const bg = rowIndex % 2 === 0 ? '#F1E0C6' : '#D4C0A1';
		const path = rootPath.concat([key]).join('.');
		const label = labelize(key);
		const labelHtml = '<td width="40%"><b>' + escapeHtml(label) + ':</b></td>';

		if (typeof value === 'boolean') {
			return '<tr bgcolor="' + bg + '" style="color:#000;">' + labelHtml +
				'<td><input type="checkbox" data-type="boolean" data-path="' + escapeHtml(path) + '"' + (value ? ' checked' : '') + ' /></td></tr>';
		}

		if (Array.isArray(value) || (value && typeof value === 'object')) {
			return '<tr bgcolor="' + bg + '" style="color:#000;">' + labelHtml +
				'<td><textarea rows="6" style="width:95%;" data-type="json" data-label="' + escapeHtml(label) + '" data-path="' + escapeHtml(path) + '">' +
				escapeHtml(JSON.stringify(value, null, 2)) + '</textarea><br><span class="balance-muted">Edite como JSON.</span></td></tr>';
		}

		let type = 'text';
		let dataType = 'string';
		let valueForInput = value ?? '';
		let extra = '';

		if (typeof value === 'number') {
			type = 'number" step="any';
			dataType = 'number';
			if (key === 'critChance' && rootPath.join('.') === 'player') {
				dataType = 'percent';
				valueForInput = value * 100;
				extra = ' <span class="balance-muted">Valor em porcentagem. Ex: 5 = 5%.</span>';
			}
		}

		if (key.toLowerCase().includes('color') || key === 'emissive') {
			type = 'color';
		}

		return '<tr bgcolor="' + bg + '" style="color:#000;">' + labelHtml +
			'<td><input type="' + type + '" data-type="' + dataType + '" data-path="' + escapeHtml(path) + '" value="' + escapeHtml(valueForInput) + '" style="width:90%;" />' + extra + '</td></tr>';
	}

	function renderSimpleSection(title, rootPath, values, keys) {
		if (!values || typeof values !== 'object') {
			return '';
		}

		const fieldKeys = keys || Object.keys(values);
		if (fieldKeys.length === 0) {
			return '';
		}

		let html = tableStart(title);
		fieldKeys.forEach(function (key, index) {
			if (Object.prototype.hasOwnProperty.call(values, key)) {
				html += fieldRow(rootPath, key, values[key], index);
			}
		});
		return html + tableEnd();
	}

	function renderPlayer() {
		ensureDefaultBalanceFields();
		const player = gameData.player || {};
		const scalarKeys = Object.keys(player).filter(function (key) {
			return !player[key] || typeof player[key] !== 'object' || Array.isArray(player[key]);
		});

		let html = '<form id="balanceForm">' + renderSimpleSection('Editar Stats do Jogador', ['player'], player, scalarKeys);
		Object.keys(player).forEach(function (key) {
			if (player[key] && typeof player[key] === 'object' && !Array.isArray(player[key])) {
				html += renderSimpleSection(labelize(key), ['player', key], player[key]);
			} else if (Array.isArray(player[key])) {
				html += renderSimpleSection(labelize(key), ['player'], player, [key]);
			}
		});
		html += saveButtonHtml() + '</form>';
		editorEl.innerHTML = html;
		bindFieldEvents(editorEl);
		bindSaveButton();
	}

	function renderEnemy(entityId) {
		ensureDefaultBalanceFields();
		const enemy = (gameData.enemies || {})[entityId];
		if (!enemy) {
			editorEl.innerHTML = '<div style="color:red; font-weight:bold;">Inimigo nao encontrado.</div>';
			return;
		}

		let html = '<form id="balanceForm">';
		html += renderSimpleSection('Editar Inimigo: ' + (enemy.name || entityId), ['enemies', entityId], enemy, ['id', 'name', 'category']);

		['stats', 'scaling', 'spawn', 'ai', 'visuals'].forEach(function (group) {
			if (enemy[group] && typeof enemy[group] === 'object' && !Array.isArray(enemy[group])) {
				const keys = group === 'ai' ? Object.keys(enemy[group]).filter(function (key) { return key !== 'params'; }) : undefined;
				html += renderSimpleSection(labelize(group), ['enemies', entityId, group], enemy[group], keys);
				if (group === 'ai' && enemy.ai && enemy.ai.params && typeof enemy.ai.params === 'object') {
					html += renderSimpleSection('AI Params', ['enemies', entityId, 'ai', 'params'], enemy.ai.params);
				}
			}
		});

		['passives', 'skills', 'abilities', 'phases', 'drops'].forEach(function (group) {
			if (Object.prototype.hasOwnProperty.call(enemy, group)) {
				html += renderSimpleSection(labelize(group), ['enemies', entityId], enemy, [group]);
			}
		});

		const remainingKeys = Object.keys(enemy).filter(function (key) {
			return ['id', 'name', 'category', 'stats', 'scaling', 'spawn', 'ai', 'visuals', 'passives', 'skills', 'abilities', 'phases', 'drops'].indexOf(key) === -1;
		});
		if (remainingKeys.length) {
			html += renderSimpleSection('Outros Campos', ['enemies', entityId], enemy, remainingKeys);
		}

		html += saveButtonHtml() + '</form>';
		editorEl.innerHTML = html;
		bindFieldEvents(editorEl);
		bindSaveButton();
	}

	function saveButtonHtml() {
		return '<br><center><button type="submit" class="balance-save">Salvar Alteracoes</button></center>';
	}

	function bindSaveButton() {
		const form = document.getElementById('balanceForm');
		if (!form) {
			return;
		}
		form.addEventListener('submit', function (event) {
			event.preventDefault();
			saveBalance();
		});
	}

	function renderAdvancedJson() {
		editorEl.innerHTML = tableStart('JSON Avancado') +
			'<tr bgcolor="#F1E0C6" style="color:#000;"><td colspan="2"><textarea id="balanceJsonEditor" class="balance-json-editor">' +
			escapeHtml(JSON.stringify(gameData, null, 2)) +
			'</textarea><br><span class="balance-muted">Use esta area para editar campos complexos em massa. Clique em Aplicar JSON antes de salvar.</span></td></tr>' +
			tableEnd() +
			'<center><button type="button" id="applyJsonButton" class="balance-save">Aplicar JSON</button> ' +
			'<button type="button" id="saveJsonButton" class="balance-save">Salvar Alteracoes</button></center>';

		document.getElementById('applyJsonButton').addEventListener('click', function () {
			try {
				const parsed = JSON.parse(document.getElementById('balanceJsonEditor').value);
				if (!parsed.player || !parsed.enemies) {
					throw new Error('JSON precisa conter player e enemies.');
				}
				gameData = parsed;
				ensureDefaultBalanceFields();
				selectedEntity = 'Player';
				advancedJsonOpen = false;
				showStatus('JSON aplicado no editor. Agora salve para gravar no servidor.', 'success');
				render();
			} catch (error) {
				showStatus('JSON invalido: ' + error.message, 'error');
			}
		});

		document.getElementById('saveJsonButton').addEventListener('click', function () {
			try {
				const parsed = JSON.parse(document.getElementById('balanceJsonEditor').value);
				if (!parsed.player || !parsed.enemies) {
					throw new Error('JSON precisa conter player e enemies.');
				}
				gameData = parsed;
				ensureDefaultBalanceFields();
				saveBalance();
			} catch (error) {
				showStatus('JSON invalido: ' + error.message, 'error');
			}
		});
	}

	function renderEntityList() {
		const filter = filterEl.value.toLowerCase();
		let html = '<table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">';
		html += '<tr bgcolor="#D4C0A1"><td style="color:#000; font-weight:bold; font-size:11px;"><b>Entidades</b></td></tr>';

		const playerActive = selectedEntity === 'Player' && !advancedJsonOpen ? 'background-color:#FFF; font-weight:bold;' : '';
		if (!filter || 'jogador player'.includes(filter)) {
			html += '<tr bgcolor="#F1E0C6" style="' + playerActive + '"><td><a href="#" class="balance-entity-link" data-entity="Player">[Player] Jogador</a></td></tr>';
		}

		const enemies = gameData.enemies || {};
		Object.keys(enemies).sort(function (a, b) {
			return String(enemies[a].name || a).localeCompare(String(enemies[b].name || b));
		}).forEach(function (id) {
			const enemy = enemies[id] || {};
			const label = String(enemy.name || id);
			if (filter && !(label + ' ' + id + ' ' + (enemy.category || '')).toLowerCase().includes(filter)) {
				return;
			}
			const active = selectedEntity === id && !advancedJsonOpen ? 'background-color:#FFF; font-weight:bold;' : '';
			html += '<tr bgcolor="#F1E0C6" style="' + active + '"><td><a href="#" class="balance-entity-link" data-entity="' + escapeHtml(id) + '">[Mob] ' + escapeHtml(label) + '</a></td></tr>';
		});

		html += '</table>';
		listEl.innerHTML = html;
		listEl.querySelectorAll('[data-entity]').forEach(function (link) {
			link.addEventListener('click', function (event) {
				event.preventDefault();
				selectedEntity = link.dataset.entity;
				advancedJsonOpen = false;
				render();
			});
		});
	}

	function render() {
		renderEntityList();
		if (advancedJsonOpen) {
			renderAdvancedJson();
			return;
		}
		if (selectedEntity === 'Player') {
			renderPlayer();
			return;
		}
		renderEnemy(selectedEntity);
	}

	function showStatus(message, type) {
		const style = type === 'error'
			? 'color:#FFF; background:#8b0000; border:1px solid red;'
			: 'color:#000; background:#98fb98; border:1px solid green;';
		statusEl.innerHTML = '<div style="' + style + ' padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">' + escapeHtml(message) + '</div>';
	}

	async function saveBalance() {
		try {
			ensureDefaultBalanceFields();
			const response = await fetch(routeUrl, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({action: 'save_balance', gameData: gameData})
			});
			const data = await response.json().catch(function () { return {}; });
			if (!response.ok || !data.success) {
				throw new Error(data.error || 'Falha ao salvar.');
			}
			showStatus(data.message || 'Alteracoes salvas com sucesso.', data.reloaded === false ? 'error' : 'success');
		} catch (error) {
			showStatus(error.message, 'error');
		}
	}

	document.getElementById('balanceSaveTop').addEventListener('click', saveBalance);
	document.getElementById('balanceJsonTab').addEventListener('click', function () {
		advancedJsonOpen = true;
		render();
	});
	filterEl.addEventListener('input', renderEntityList);

	ensureDefaultBalanceFields();
	render();
})();
</script>
