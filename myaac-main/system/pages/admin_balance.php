<?php
defined('MYAAC') or die('Direct access not allowed!');

$title = 'Balanceamento de Jogo';
$isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
if (!$isAdmin) {
	header('Location: ?subtopic=news');
	exit;
}

$gameDataPath = dirname(__DIR__, 2) . '/game_data.json';

function admin_balance_json_response($payload, $status = 200) {
	http_response_code($status);
	header('Content-Type: application/json; charset=utf-8');
	echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

function admin_balance_read_game_data($path) {
	if (!is_file($path)) {
		return [null, 'Arquivo game_data.json nao encontrado em: ' . $path];
	}
	$raw = file_get_contents($path);
	if ($raw === false) {
		return [null, 'Falha ao ler game_data.json. Verifique as permissoes.'];
	}
	$data = json_decode($raw, true);
	if (!is_array($data)) {
		return [null, 'Erro ao decodificar game_data.json: ' . json_last_error_msg()];
	}
	if (!isset($data['player']) || !is_array($data['player'])) {
		$data['player'] = [];
	}
	if (!isset($data['enemies']) || !is_array($data['enemies'])) {
		return [null, 'game_data.json nao possui o objeto enemies.'];
	}
	return [$data, ''];
}

function admin_balance_backup_file($path) {
	if (!is_file($path) || filesize($path) <= 0) {
		return '';
	}
	$roots = [];
	if (getenv('BALANCE_BACKUP_DIR')) {
		$roots[] = getenv('BALANCE_BACKUP_DIR');
	}
	$roots[] = dirname($path) . '/backups/balance';
	$roots[] = sys_get_temp_dir() . '/onlinerpg-balance-backups';
	$roots[] = '/var/www/persistent-backups/balance';
	$name = date('Ymd-His') . '-' . basename($path);
	$errors = [];
	foreach ($roots as $root) {
		if (!is_dir($root) && !@mkdir($root, 0775, true) && !is_dir($root)) {
			$errors[] = $root . ' sem permissao de criacao';
			continue;
		}
		if (!is_writable($root)) {
			$errors[] = $root . ' sem permissao de escrita';
			continue;
		}
		if (@copy($path, rtrim($root, '/\\') . DIRECTORY_SEPARATOR . $name)) {
			return '';
		}
		$errors[] = $root . ' falhou ao copiar';
	}
	error_log('Admin balance backup warning: ' . implode(' | ', $errors));
	return 'Aviso: backup automatico nao foi criado, mas o salvamento continuou.';
}

function admin_balance_save_game_data($path, $data) {
	$encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	if ($encoded === false) {
		return ['error' => 'Erro ao converter dados para JSON: ' . json_last_error_msg(), 'warning' => ''];
	}
	$dir = dirname($path);
	if (!is_dir($dir)) {
		return ['error' => 'Pasta do game_data.json nao encontrada: ' . $dir, 'warning' => ''];
	}
	if ((is_file($path) && !is_writable($path)) || !is_writable($dir)) {
		return ['error' => 'Sem permissao para gravar game_data.json. Verifique permissao do arquivo/pasta no servidor.', 'warning' => ''];
	}
	$warning = admin_balance_backup_file($path);
	$tmp = tempnam($dir, 'game_data_');
	if ($tmp === false) {
		return ['error' => 'Falha ao criar arquivo temporario para salvar game_data.json.', 'warning' => $warning];
	}
	if (file_put_contents($tmp, $encoded . PHP_EOL, LOCK_EX) === false) {
		@unlink($tmp);
		return ['error' => 'Falha ao gravar arquivo temporario do game_data.json.', 'warning' => $warning];
	}
	if (!@rename($tmp, $path)) {
		@unlink($tmp);
		return ['error' => 'Falha ao substituir game_data.json. Verifique permissao do arquivo/pasta.', 'warning' => $warning];
	}
	return ['error' => '', 'warning' => $warning];
}

function admin_balance_reload_server() {
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
	$json = json_decode($response, true);
	if (is_array($json) && isset($json['success']) && !$json['success']) {
		return [false, $json['error'] ?? 'Hot-Reload recusado pelo servidor.'];
	}
	return [true, 'Servidor do jogo recarregado com sucesso.'];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$payload = json_decode(file_get_contents('php://input'), true);
	if (!is_array($payload) || ($payload['action'] ?? '') !== 'save_balance') {
		admin_balance_json_response(['success' => false, 'error' => 'Payload JSON invalido ou acao invalida.'], 400);
	}
	$data = $payload['gameData'] ?? null;
	if (!is_array($data) || !isset($data['player']) || !isset($data['enemies']) || !is_array($data['enemies'])) {
		admin_balance_json_response(['success' => false, 'error' => 'Dados invalidos. O JSON precisa conter player e enemies.'], 400);
	}
	$save = admin_balance_save_game_data($gameDataPath, $data);
	if ($save['error'] !== '') {
		admin_balance_json_response(['success' => false, 'error' => $save['error'], 'warning' => $save['warning']], 500);
	}
	list($reloaded, $reloadMessage) = admin_balance_reload_server();
	$message = $reloaded ? 'Alteracoes salvas. ' . $reloadMessage : 'Alteracoes salvas, mas o Hot-Reload falhou: ' . $reloadMessage;
	if ($save['warning'] !== '') {
		$message .= ' ' . $save['warning'];
	}
	admin_balance_json_response(['success' => true, 'reloaded' => $reloaded, 'warning' => $save['warning'], 'message' => $message]);
}

list($gameData, $loadError) = admin_balance_read_game_data($gameDataPath);
if (!is_array($gameData)) {
	$gameData = ['version' => '1.0.0', 'player' => [], 'enemies' => []];
}
$gameDataJson = json_encode($gameData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
if ($gameDataJson === false) {
	$gameDataJson = "{\n  \"version\": \"1.0.0\",\n  \"player\": {},\n  \"enemies\": {}\n}";
	$loadError = trim($loadError . ' Erro ao preparar JSON para a tela: ' . json_last_error_msg());
}
$enemyCount = isset($gameData['enemies']) && is_array($gameData['enemies']) ? count($gameData['enemies']) : 0;
?>

<style>
.balance-admin-wrap{color:#000;font-size:11px}.balance-admin-toolbar{margin:0 0 10px 0;padding:8px;background:#d4c0a1;border:1px solid #8d7652}.balance-json-editor{font-family:Consolas,monospace;font-size:11px;min-height:620px;width:100%;box-sizing:border-box}.balance-save{font-weight:bold;padding:5px 15px;cursor:pointer}.balance-muted{color:#555;font-size:9px}.balance-status{padding:8px;margin-bottom:15px;font-weight:bold;font-size:11px}.balance-ok{color:#000;background:#98fb98;border:1px solid green}.balance-error{color:#fff;background:#8b0000;border:1px solid red}
</style>

<div class="balance-admin-wrap">
	<?php if ($loadError): ?>
		<div class="balance-status balance-error"><?php echo htmlspecialchars($loadError); ?></div>
	<?php endif; ?>
	<div id="balanceStatus"></div>
	<p style="font-size:11px;color:#000;margin-bottom:15px;">
		Editor de balanceamento carregado com <?php echo (int)$enemyCount; ?> entidades. Edite o JSON e clique em salvar. O backup agora e seguro: se a pasta de backup nao tiver permissao, o salvamento continua e apenas mostra aviso.
	</p>
	<div class="balance-admin-toolbar">
		<button id="formatJsonButton" type="button">Formatar JSON</button>
		<button id="balanceSaveButton" type="button" class="balance-save">Salvar Alteracoes</button>
		<span class="balance-muted">Arquivo: <?php echo htmlspecialchars($gameDataPath); ?></span>
	</div>
	<textarea id="balanceJsonEditor" class="balance-json-editor"><?php echo htmlspecialchars($gameDataJson, ENT_NOQUOTES, 'UTF-8'); ?></textarea>
</div>

<script>
(function(){
	const editor=document.getElementById('balanceJsonEditor');
	const statusEl=document.getElementById('balanceStatus');
	function showStatus(message,type){
		const cls=type==='error'?'balance-status balance-error':'balance-status balance-ok';
		statusEl.innerHTML='<div class="'+cls+'">'+String(message).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];})+'</div>';
	}
	function parseEditor(){
		const data=JSON.parse(editor.value);
		if(!data.player||!data.enemies||typeof data.enemies!=='object'||Array.isArray(data.enemies)){
			throw new Error('JSON precisa conter player e enemies.');
		}
		return data;
	}
	document.getElementById('formatJsonButton').addEventListener('click',function(){
		try{editor.value=JSON.stringify(parseEditor(),null,2);showStatus('JSON formatado.', 'success');}
		catch(error){showStatus('JSON invalido: '+error.message,'error');}
	});
	document.getElementById('balanceSaveButton').addEventListener('click',async function(){
		try{
			const gameData=parseEditor();
			showStatus('Salvando alteracoes...', 'success');
			const response=await fetch('?subtopic=admin/balance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_balance',gameData})});
			const text=await response.text();
			let data={};
			try{data=text?JSON.parse(text):{};}catch(e){throw new Error('Resposta invalida do servidor: '+text.slice(0,300));}
			if(!response.ok||!data.success){throw new Error(data.error||'Falha ao salvar.');}
			showStatus(data.message||'Alteracoes salvas com sucesso.',data.reloaded===false?'error':'success');
		}catch(error){showStatus(error.message,'error');}
	});
})();
</script>
