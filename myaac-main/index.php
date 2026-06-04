<?php
// Start session for login tracking
session_start();

define('MYAAC', true);
define('MENU_CATEGORY_NEWS', 1);
define('MENU_CATEGORY_ACCOUNT', 2);
define('MENU_CATEGORY_COMMUNITY', 3);
define('MENU_CATEGORY_FORUM', 4);
define('MENU_CATEGORY_LIBRARY', 5);
define('MENU_CATEGORY_SHOP', 6);

define('BASE_URL', '/');
define('PAGE', $_GET['subtopic'] ?? 'news');

// Configuration template settings
$template_path = 'templates/tibiacom';
$template_index = 'index.php';

$config = [
    'menu_default_links_color' => '#ffffff',
    'menu_categories' => [
        MENU_CATEGORY_NEWS => ['id' => 'news', 'name' => 'Notícias'],
        MENU_CATEGORY_ACCOUNT => ['id' => 'account', 'name' => 'Conta'],
        MENU_CATEGORY_COMMUNITY => ['id' => 'community', 'name' => 'Comunidade'],
        MENU_CATEGORY_FORUM => ['id' => 'forum', 'name' => 'Fórum'],
        MENU_CATEGORY_LIBRARY => ['id' => 'library', 'name' => 'Biblioteca Wiki'],
        MENU_CATEGORY_SHOP => ['id' => 'shops', 'name' => 'Shop'],
    ],
    'background_image' => 'background-artwork.jpg',
    'logo_image' => 'tibia-logo-artwork-top.png',
    'logo_monster' => 'Wyrm',
    'boxes' => 'highscores,newcomer,gallery,networks,poll',
    'network_facebook' => 'tibia',
    'network_twitter' => 'tibia',
    'template_allow_change' => false
];

// PDO Database connection to game's PostgreSQL database
$dbUrl = getenv('DATABASE_URL') ?: "postgresql://survival:survival_secret@db:5432/survival_game";
$pdo = null;
$dbError = '';

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
    $dbError = $e->getMessage();
}

// Calculate online players
$playersOnlineCount = 0;
if ($pdo) {
    try {
        $stmt = $pdo->query("
            SELECT COALESCE(SUM(players_in_room), 0) as online_count 
            FROM (
                SELECT DISTINCT ON (room_id) players_in_room, created_at 
                FROM ranking 
                WHERE created_at > NOW() - INTERVAL '2 minutes' 
                ORDER BY room_id, created_at DESC
            ) as active_rooms
        ");
        $playersOnlineCount = (int)$stmt->fetchColumn();
    } catch (Exception $e) {
        $playersOnlineCount = 0;
    }
}

$status = [
    'online' => ($pdo ? true : false),
    'players' => $playersOnlineCount
];

$logged = isset($_SESSION['player_id']);
$subtopic = $_GET['subtopic'] ?? 'news';
$hostOnly = explode(':', $_SERVER['HTTP_HOST'] ?? 'localhost')[0];

function generateJWT($id, $username, $isAdmin) {
    $secret = getenv('JWT_SECRET') ?: 'sua_chave_jwt_super_secreta_123456';
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $iat = time();
    $exp = $iat + (30 * 24 * 60 * 60); // 30 days
    $payload = json_encode([
        'id' => (int)$id,
        'username' => $username,
        'is_admin' => (bool)$isAdmin,
        'iat' => $iat,
        'exp' => $exp
    ]);
    
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

// Mock Database Engine for templates
class MockDB {
    public function hasTable($table) { return false; }
    public function query($sql) { return new MockDBResult(); }
}
class MockDBResult {
    public function rowCount() { return 0; }
    public function fetch($mode = null) { return null; }
}
$db = new MockDB();
define('TABLE_PREFIX', '');

// Mock Twig Engine
class MockTwig {
    public function display($template, $data = []) {
        global $template_path;
        if ($template === 'highscores.html.twig') {
            echo '
            <div class="Themebox" id="Themebox_Highscores" style="background-image:url(' . $template_path . '/images/themeboxes/highscores/highscores.png);">
              <div style="padding-top:35px; padding-left:10px; padding-right:10px;">
                <table style="width:100%; border:0; font-size:10px; color:#F1E0C6;">';
            if (isset($data['topPlayers'])) {
                $rank = 1;
                foreach ($data['topPlayers'] as $player) {
                    echo '<tr>';
                    echo '  <td style="width:10%; text-align:right;">' . $rank++ . '.</td>';
                    echo '  <td>' . htmlspecialchars($player['name']) . '</td>';
                    echo '  <td style="text-align:right;">' . $player['score'] . '</td>';
                    echo '</tr>';
                }
            }
            echo '
                </table>
                <div style="text-align:center; margin-top:5px;"><a href="?subtopic=highscores" style="color:#FFF;">Ver Rankings</a></div>
              </div>
              <div class="Bottom" style="background-image:url(' . $template_path . '/images/general/box-bottom.gif);"></div>
            </div>';
        } else if ($template === 'newcomer.html.twig') {
            echo '
            <div class="Themebox" id="Themebox_Newcomer" style="background-image:url(' . $template_path . '/images/themeboxes/newcomer/newcomerbox.gif);">
              <div style="padding-top:50px; padding-left:10px; padding-right:10px; color:#F1E0C6; font-size:10px; text-align:center;">
                Novo no Survival 3D?<br/>
                <a href="?subtopic=account/create" style="color:#FFF; font-weight:bold;">Criar Conta Agora!</a>
              </div>
              <div class="Bottom" style="background-image:url(' . $template_path . '/images/general/box-bottom.gif);"></div>
            </div>';
        } else if ($template === 'networks.html.twig') {
            echo '
            <div class="Themebox" id="Themebox_Networks" style="background-image:url(' . $template_path . '/images/themeboxes/networks/networksbox.png);">
              <div style="padding-top:50px; padding-left:10px; padding-right:10px; text-align:center;">
                <a href="https://facebook.com" target="_blank" style="color:#F1E0C6; font-size:10px;"><img src="images/facebook_16x16.png" style="vertical-align:middle; margin-right:5px; border:0;"/>Facebook</a><br/><br/>
                <a href="https://instagram.com" target="_blank" style="color:#F1E0C6; font-size:10px;"><img src="images/instagram_16x16.png" style="vertical-align:middle; margin-right:5px; border:0;"/>Instagram</a>
              </div>
              <div class="Bottom" style="background-image:url(' . $template_path . '/images/general/box-bottom.gif);"></div>
            </div>';
        } else if ($template === 'poll.html.twig') {
            echo '
            <div class="Themebox" id="Themebox_Poll" style="background-image:url(' . $template_path . '/images/themeboxes/current-poll/currentpollbox.gif);">
              <div style="padding-top:45px; padding-left:10px; padding-right:10px; color:#F1E0C6; font-size:10px; text-align:center;">
                <strong>Qual a sua Torre favorita?</strong><br/><br/>
                <form method="post" action="?subtopic=news" style="margin:0; padding:0;">
                  <input type="radio" name="vote" value="red"/> Vermelha<br/>
                  <input type="radio" name="vote" value="green"/> Verde<br/>
                  <input type="radio" name="vote" value="purple"/> Roxa<br/>
                  <input type="radio" name="vote" value="poison"/> Veneno<br/>
                  <input type="submit" value="Votar" style="background:#505050; color:#FFF; border:1px solid #000; font-size:9px; cursor:pointer; padding:2px 5px; margin-top:5px;"/>
                </form>
              </div>
              <div class="Bottom" style="background-image:url(' . $template_path . '/images/general/box-bottom.gif);"></div>
            </div>';
        } else if ($template === 'gallery.html.twig') {
            echo '
            <div class="Themebox" id="Themebox_Gallery" style="background-image:url(' . $template_path . '/images/themeboxes/gallery/gallerybox.gif);">
              <div style="padding-top:50px; text-align:center;">
                <a href="?subtopic=play"><img src="' . $template_path . '/images/header/tibia-logo-artwork-top.gif" style="width:100px; border:1px solid #000;"/></a>
              </div>
              <div class="Bottom" style="background-image:url(' . $template_path . '/images/general/box-bottom.gif);"></div>
            </div>';
        }
    }
    public function addGlobal($name, $value) {}
}

class MockTwigLoader {
    public function prependPath($path) {}
}

class MockHooks {
    public function trigger($name) {}
}

$twig = new MockTwig();
$twig_loader = new MockTwigLoader();
$hooks = new MockHooks();
define('HOOK_TIBIACOM_BORDER_3', 'tibiaborder3');

// Helper Functions
function pg_to_bool($val) {
    if ($val === true || $val === 't' || $val === 'true' || $val == 1 || $val === '1') {
        return true;
    }
    return false;
}

function escapeHtml($str) {
    return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function template_place_holder($name) {
    if ($name === 'head_start') {
        return '<meta charset="UTF-8"><title>Survival 3D - Painel de Controle Oficial</title>';
    }
    return '';
}

function tickers() {
    return '
    <div id="Themebox_Ticker" style="margin-bottom:10px;">
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#D4C0A1">
                <td style="color:#000; font-size:10px; font-weight:bold; padding:5px;">
                    ✨ Ticker de Notícias: Bem-vindo ao Survival 3D! Monte sua build usando as Torres de Essência Vermelha, Verde, Roxa ou Veneno. Dispute o topo nos Rankings!
                </td>
            </tr>
        </table>
    </div>';
}

function template_footer() {
    return '© 2026 Survival 3D Game Server. Todos os direitos reservados. Jogue diretamente em seu navegador.';
}

function getLink($topic) {
    return '?subtopic=' . urlencode($topic);
}

function setting($name) {
    if ($name === 'core.gifts_system') return true;
    if ($name === 'core.template_allow_change') return false;
    return '';
}

function getTopPlayers($limit = 5) {
    global $pdo;
    if (!$pdo) {
        return [
            ['name' => 'DemoPlayer1', 'score' => 2500],
            ['name' => 'DemoPlayer2', 'score' => 1800],
            ['name' => 'DemoPlayer3', 'score' => 1200]
        ];
    }
    try {
        $stmt = $pdo->prepare("SELECT player_name as name, score FROM ranking ORDER BY score DESC LIMIT :limit");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        return [['name' => 'DemoPlayer1', 'score' => 999]];
    }
}

function get_template_menus() {
    global $hostOnly;
    $isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
    
    $news_menu = [
        ['name' => 'Últimas Notícias', 'link' => 'news', 'link_full' => '?subtopic=news', 'target_blank' => '', 'style_color' => ''],
        ['name' => 'Changelogs / Atualizações', 'link' => 'changelogs', 'link_full' => '?subtopic=changelogs', 'target_blank' => '', 'style_color' => 'style="color: #00ff00 !important;"']
    ];
    if ($isAdmin) {
        $news_menu[] = ['name' => 'Postar Atualização', 'link' => 'updates/post', 'link_full' => '?subtopic=updates/post', 'target_blank' => '', 'style_color' => 'style="color: #999 !important;"'];
    }
    $news_menu[] = ['name' => 'Jogar Agora (Porta 80)', 'link' => 'play', 'link_full' => 'http://' . $hostOnly . ':80/?v=' . time(), 'target_blank' => ' target="_blank"', 'style_color' => 'style="color: #ff9900 !important; font-weight:bold;"'];

    $account_menu = [
        ['name' => 'Criar Conta', 'link' => 'account/create', 'link_full' => '?subtopic=account/create', 'target_blank' => '', 'style_color' => ''],
        ['name' => 'Gerenciar Conta', 'link' => 'account/manage', 'link_full' => '?subtopic=account/manage', 'target_blank' => '', 'style_color' => ''],
        ['name' => 'Como Jogar / Downloads', 'link' => 'downloads', 'link_full' => '?subtopic=downloads', 'target_blank' => '', 'style_color' => ''],
    ];
    if ($isAdmin) {
        $account_menu[] = ['name' => 'Bloquear Usuários', 'link' => 'admin/block', 'link_full' => '?subtopic=admin/block', 'target_blank' => '', 'style_color' => 'style="color: #ff3333 !important; font-weight:bold;"'];
        $account_menu[] = ['name' => 'Balanceamento de Jogo', 'link' => 'admin/balance', 'link_full' => '?subtopic=admin/balance', 'target_blank' => '', 'style_color' => 'style="color: #ff9900 !important; font-weight:bold;"'];
        $account_menu[] = ['name' => 'Premiações Semanais', 'link' => 'admin/weekly_awards', 'link_full' => '?subtopic=admin/weekly_awards', 'target_blank' => '', 'style_color' => 'style="color: #66ccff !important; font-weight:bold;"'];
        $account_menu[] = ['name' => 'Admin Watch (Live)', 'link' => 'admin_watch', 'link_full' => '?subtopic=admin_watch', 'target_blank' => '', 'style_color' => 'style="color: #00ff00 !important; font-weight:bold;"'];
        $account_menu[] = ['name' => 'Imagens dos Itens', 'link' => 'admin/item_images', 'link_full' => '?subtopic=admin/item_images', 'target_blank' => '', 'style_color' => 'style="color: #ffcc00 !important; font-weight:bold;"'];
    }

    $menus = [
        MENU_CATEGORY_NEWS => $news_menu,
        MENU_CATEGORY_ACCOUNT => $account_menu,
        MENU_CATEGORY_COMMUNITY => [
            ['name' => 'Rankings', 'link' => 'highscores', 'link_full' => '?subtopic=highscores', 'target_blank' => '', 'style_color' => ''],
            ['name' => 'Analise de Dano', 'link' => 'damage-analysis', 'link_full' => '?subtopic=damage-analysis', 'target_blank' => '', 'style_color' => 'style="color: #ff6666 !important; font-weight:bold;"'],
            ['name' => 'Melhores Builds', 'link' => 'builds', 'link_full' => '?subtopic=builds', 'target_blank' => '', 'style_color' => 'style="color: #ffd700 !important; font-weight:bold;"'],
            ['name' => 'Quem está Online?', 'link' => 'online', 'link_full' => '?subtopic=online', 'target_blank' => '', 'style_color' => ''],
        ],
        MENU_CATEGORY_LIBRARY => [
            ['name' => 'Wiki do Jogo', 'link' => 'wiki', 'link_full' => '?subtopic=wiki', 'target_blank' => '', 'style_color' => 'style="color: #00ffff !important;"'],
            ['name' => 'Criaturas & Chefes', 'link' => 'wiki&tab=bestiary', 'link_full' => '?subtopic=wiki&tab=bestiary', 'target_blank' => '', 'style_color' => ''],
            ['name' => 'Itens & Evoluções', 'link' => 'wiki&tab=items', 'link_full' => '?subtopic=wiki&tab=items', 'target_blank' => '', 'style_color' => ''],
        ],
        MENU_CATEGORY_SHOP => [
            ['name' => 'Mercado Quântico', 'link' => 'market', 'link_full' => '?subtopic=market', 'target_blank' => '', 'style_color' => 'style="color: #ff00ff !important; font-weight:bold;"'],
            ['name' => 'Reciclador de Itens', 'link' => 'tradein', 'link_full' => '?subtopic=tradein', 'target_blank' => '', 'style_color' => 'style="color: #00ffff !important; font-weight:bold;"'],
        ]
    ];
    return $menus;
}

// Global builds translation arrays for bestiary/ranking/wiki/account pages
$GLOBAL_PASSIVES = [
    'red' => [
        ['+15% Dano', '+10% Speed', '+20% Crítico'],
        ['10% Lifesteal', '+20% Dano (<30% HP)', 'Ignora 25% Armor'],
        ['Dano escala c/ hits', 'Ataque Cleave', '+70% Dano / -30% AS'],
        ['Kill = Cura+Speed', '4º Hit Explode', 'Dano x2 (<20% HP)']
    ],
    'green' => [
        ['+25% HP Max', 'Redução Dano Flat', 'Imune a Knockback'],
        ['Regen 1% HP/s', '+30% Defesa (>80% HP)', 'Reflete 15% Dano'],
        ['Ataques geram Taunt', 'Aura Redução Dano', 'Cura de itens x2'],
        ['Escudo fora combate', 'Sobrevive 1 Hit Kill', 'Escudo quebrado explode']
    ],
    'purple' => [
        ['+25% Escudo Max', '+15% Move Speed', '+CDR'],
        ['Dano extra após skill', 'Escudo Defletor', 'Vampirismo Mágico'],
        ['10% Esquiva', 'Ataques dão Slow', 'Orbes extras no hit'],
        ['Kill reseta CDs', 'Hitbox magias +30%', 'Aura tóxica DPS']
    ],
    'poison' => [
        ['+20% Attack Speed', '+15% Move Speed', 'Tiro Tóxico'],
        ['Passos Leves (+20% MS)', 'Presas Gêmeas (Heal)', 'Dardo Cegante (Cegueira)'],
        ['Miasma Menor (Poça morte)', 'Toxina Paralisante (Slow)', 'Foco Infeccioso (+20% dmg)'],
        ['Contaminação (Detonação)', 'Armadilha Cúbica (Shroom)', 'Espalhar a Peste']
    ]
];

$GLOBAL_ULTIMATES = [
    'red' => ['Sobrecarga Cósmica', 'Chuva de Tetraedros', 'Raio do Oblívio', 'Corte Dimensional'],
    'green' => ['Sobrecarga Cósmica', 'Bastião de Titânio', 'Terremoto Geométrico', 'Armadura Reativa'],
    'purple' => ['Sobrecarga Cósmica', 'Singularidade', 'Distorção Temporal', 'Reset Dimensional'],
    'poison' => ['Frasco de Peçonha', 'Campo de Fungos', 'Olhar da Górgona', 'Raio da Peste']
];

// Modal HTML block for all pages (Rankings, My Account, Melhores Builds)
$modalHtml = '
<style>
.builds-modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.75);
    z-index: 9999;
    align-items: center;
    justify-content: center;
}
.builds-modal {
    background-color: #F1E0C6;
    border: 3px double #5A2800;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    width: 90%;
    max-width: 600px;
    border-radius: 4px;
    overflow: hidden;
    font-family: Verdana, Arial, Times New Roman, sans-serif;
    color: #000;
}
.builds-modal-header {
    background-color: #5A2800;
    color: #FFF;
    padding: 10px 14px;
    font-weight: bold;
    font-size: 13px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #3d1a00;
}
.builds-modal-close {
    color: #FFF;
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
    background: none;
    border: none;
    padding: 0;
    transition: color 0.2s;
}
.builds-modal-close:hover {
    color: #ff5555;
}
.builds-modal-body {
    padding: 15px;
    max-height: 450px;
    overflow-y: auto;
    background-color: #F1E0C6;
}
.build-card {
    background-color: #D4C0A1;
    border: 1px solid #505050;
    margin-bottom: 12px;
    padding: 12px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.15);
}
.build-card-header {
    border-bottom: 1px dashed #5A2800;
    padding-bottom: 6px;
    margin-bottom: 10px;
    font-size: 11px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.build-badge {
    padding: 3px 8px;
    font-size: 10px;
    font-weight: bold;
    color: #FFF;
    border-radius: 3px;
    text-shadow: 1px 1px 1px rgba(0,0,0,0.4);
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.build-badge-red { background: linear-gradient(to bottom, #dc2626, #991b1b); }
.build-badge-green { background: linear-gradient(to bottom, #16a34a, #14532d); }
.build-badge-purple { background: linear-gradient(to bottom, #7c3aed, #581c87); }
.build-badge-poison { background: linear-gradient(to bottom, #10b981, #065f46); }

.build-card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 11px;
}
.build-item {
    background: rgba(255, 255, 255, 0.4);
    padding: 6px 8px;
    border-radius: 3px;
    border-left: 3px solid #5A2800;
}
.build-item-label {
    font-size: 9px;
    color: #666;
    text-transform: uppercase;
    font-weight: bold;
    margin-bottom: 2px;
}
.build-item-value {
    font-weight: bold;
    color: #111;
}
.builds-loading {
    text-align: center;
    padding: 40px;
    font-size: 12px;
    color: #5A2800;
    font-weight: bold;
}
.builds-empty {
    text-align: center;
    padding: 30px;
    font-size: 11px;
    color: #666;
}
</style>

<div id="buildsModalOverlay" class="builds-modal-overlay" onclick="closeBuildsModal(event)">
    <div class="builds-modal" onclick="event.stopPropagation()">
        <div class="builds-modal-header">
            <span id="buildsModalTitle">Builds do Jogador</span>
            <button class="builds-modal-close" onclick="closeBuildsModal()">&#10006;</button>
        </div>
        <div class="builds-modal-body" id="buildsModalBody">
            <div class="builds-loading">Carregando builds do jogador...</div>
        </div>
    </div>
</div>

<script>
function showPlayerBuilds(name) {
    const overlay = document.getElementById(\'buildsModalOverlay\');
    const title = document.getElementById(\'buildsModalTitle\');
    const body = document.getElementById(\'buildsModalBody\');
    
    title.innerText = \'Últimas 3 Builds de: \' + name;
    body.innerHTML = \'<div class="builds-loading">Carregando builds...</div>\';
    overlay.style.display = \'flex\';
    
    fetch(\'?subtopic=player_builds&name=\' + encodeURIComponent(name))
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                body.innerHTML = \'<div class="builds-empty" style="color:red;">\' + data.error + \'</div>\';
                return;
            }
            if (!data.builds || data.builds.length === 0) {
                body.innerHTML = \'<div class="builds-empty">Nenhuma partida recente registrada para este jogador com dados de build.</div>\';
                return;
            }
            
            let html = \'\';
            data.builds.forEach((build, index) => {
                let badgeClass = \'build-badge-red\';
                if (build.color === \'green\') badgeClass = \'build-badge-green\';
                if (build.color === \'purple\') badgeClass = \'build-badge-purple\';
                if (build.color === \'poison\') badgeClass = \'build-badge-poison\';
                
                let borderHex = \'#ff3333\';
                if (build.color === \'green\') borderHex = \'#22c55e\';
                if (build.color === \'purple\') borderHex = \'#a855f7\';
                if (build.color === \'poison\') borderHex = \'#10b981\';
                
                html += \'<div class="build-card" style="border-left: 5px solid \' + borderHex + \';">\';
                html += \'  <div class="build-card-header">\';
                html += \'    <div><strong>Batalha #\' + (index + 1) + \'</strong> - \' + build.date + \'</div>\';
                html += \'    <span class="build-badge \' + badgeClass + \'">Torre \' + build.colorName + \'</span>\';
                html += \'  </div>\';
                html += \'  <div style="font-size:10px; margin-bottom:8px; display:flex; justify-content:space-between; background:rgba(0,0,0,0.06); padding:5px 8px; border-radius:3px; color:#333;">\';
                html += \'    <span>Pontos: <strong>\' + build.score + \'</strong></span>\';
                html += \'    <span>Andar: <strong>\' + build.level + \'</strong></span>\';
                html += \'    <span>Duração: <strong>\' + build.duration + \'</strong></span>\';
                html += \'    <span>Abates/Mortes: <strong>\' + build.kills + \'/\' + build.deaths + \'</strong></span>\';
                html += \'  </div>\';
                html += \'  <div class="build-card-grid">\';
                html += \'    <div class="build-item">\';
                html += \'      <div class="build-item-label">Andar 1 (Nível 5)</div>\';
                html += \'      <div class="build-item-value">\' + build.passives[0] + \'</div>\';
                html += \'    </div>\';
                html += \'    <div class="build-item">\';
                html += \'      <div class="build-item-label">Andar 2 (Nível 10)</div>\';
                html += \'      <div class="build-item-value">\' + build.passives[1] + \'</div>\';
                html += \'    </div>\';
                html += \'    <div class="build-item">\';
                html += \'      <div class="build-item-label">Andar 3 (Nível 15)</div>\';
                html += \'      <div class="build-item-value">\' + build.passives[2] + \'</div>\';
                html += \'    </div>\';
                html += \'    <div class="build-item">\';
                html += \'      <div class="build-item-label">Andar 4 (Nível 20)</div>\';
                html += \'      <div class="build-item-value">\' + build.passives[3] + \'</div>\';
                html += \'    </div>\';
                html += \'    <div class="build-item" style="grid-column: span 2; border-left-color: #d97706; background: rgba(217, 119, 6, 0.06);">\';
                html += \'      <div class="build-item-label" style="color:#d97706;">Ultimate Mutada (Andar 5)</div>\';
                html += \'      <div class="build-item-value" style="color:#b45309; font-size:12px; margin-top:2px;">\' + build.ultimate + \'</div>\';
                html += \'    </div>\';
                html += \'  </div>\';
                html += \'</div>\';
            });
            body.innerHTML = html;
        })
        .catch(err => {
            body.innerHTML = \'<div class="builds-empty" style="color:red;">Falha ao carregar dados do servidor.</div>\';
        });
}

function closeBuildsModal(event) {
    document.getElementById(\'buildsModalOverlay\').style.display = \'none\';
}
</script>
';

// Router Logic
$title = "Últimas Notícias";
$content = "";

if ($subtopic === 'player_builds') {
    header('Content-Type: application/json');
    $playerName = trim($_GET['name'] ?? '');
    if (empty($playerName)) {
        echo json_encode(['error' => 'Jogador não especificado']);
        exit;
    }
    
    if (!$pdo) {
        echo json_encode(['error' => 'Banco de dados indisponível']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT score, collapse_level, kills, deaths, survival_time_seconds, 
                   build_color, build_floor1, build_floor2, build_floor3, build_floor4, build_floor5, 
                   created_at 
            FROM ranking 
            WHERE LOWER(player_name) = LOWER(:name) 
            ORDER BY created_at DESC 
            LIMIT 3
        ");
        $stmt->execute([':name' => $playerName]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $builds = [];
        foreach ($rows as $row) {
            $color = $row['build_color'] ?: 'red';
            $f1 = (int)$row['build_floor1'];
            $f2 = (int)$row['build_floor2'];
            $f3 = (int)$row['build_floor3'];
            $f4 = (int)$row['build_floor4'];
            $f5 = (int)$row['build_floor5'];
            
            $passives = [
                $GLOBAL_PASSIVES[$color][0][$f1] ?? 'Desconhecido',
                $GLOBAL_PASSIVES[$color][1][$f2] ?? 'Desconhecido',
                $GLOBAL_PASSIVES[$color][2][$f3] ?? 'Desconhecido',
                $GLOBAL_PASSIVES[$color][3][$f4] ?? 'Desconhecido',
            ];
            $ultimate = $GLOBAL_ULTIMATES[$color][$f5] ?? 'Sobrecarga Cósmica';
            
            $minutes = floor($row['survival_time_seconds'] / 60);
            $seconds = $row['survival_time_seconds'] % 60;
            $duration = sprintf("%02d:%02d", $minutes, $seconds);
            
            $builds[] = [
                'score' => $row['score'],
                'level' => $row['collapse_level'],
                'kills' => $row['kills'],
                'deaths' => $row['deaths'],
                'duration' => $duration,
                'color' => $color,
                'colorName' => ($color === 'red' ? 'Vermelha' : ($color === 'green' ? 'Verde' : ($color === 'poison' ? 'Veneno' : 'Roxa'))),
                'passives' => $passives,
                'ultimate' => $ultimate,
                'date' => date('d/m/Y H:i', strtotime($row['created_at']))
            ];
        }
        
        echo json_encode(['player' => $playerName, 'builds' => $builds]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Erro ao buscar builds: ' . $e->getMessage()]);
    }
    exit;
} else if ($subtopic === 'news') {
    $title = "Últimas Notícias";
    
    // Fetch current weekly leader
    $weeklyLeaderHtml = '';
    if ($pdo) {
        try {
            $sql = "
                WITH weekly_ranked AS (
                    SELECT id, player_name, LOWER(player_name) AS player_key, score, created_at,
                           ROW_NUMBER() OVER (
                               PARTITION BY LOWER(player_name)
                               ORDER BY score DESC, created_at ASC, id ASC
                           ) as rn
                    FROM ranking
                    WHERE created_at >= date_trunc('week', NOW() - INTERVAL '1 minute') + INTERVAL '1 minute'
                ),
                top10 AS (
                    SELECT * FROM weekly_ranked WHERE rn <= 10
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
                    WHERE created_at >= date_trunc('week', NOW() - INTERVAL '1 minute') + INTERVAL '1 minute'
                    GROUP BY LOWER(player_name)
                )
                SELECT MIN(t.player_name) AS player_name,
                       ROUND(AVG(t.score)::numeric, 1) as avg_score,
                       SUM(t.score)::integer as top10_sum,
                       MAX(t.score)::integer as best_score,
                       MAX(pt.total_valid_matches)::integer as total_valid_matches,
                       b.best_score_at as best_score_at
                FROM top10 t
                JOIN player_totals pt ON pt.player_key = t.player_key
                JOIN top10_best b ON b.player_key = t.player_key
                GROUP BY t.player_key, b.best_score_at
                HAVING COUNT(*) >= 10
                ORDER BY avg_score DESC,
                         top10_sum DESC,
                         best_score DESC,
                         total_valid_matches DESC,
                         best_score_at ASC,
                         MIN(t.player_name) ASC
                LIMIT 1";
            $stmt = $pdo->query($sql);
            $leader = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($leader) {
                $weeklyLeaderHtml = '
                <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); border: 1px solid #B8860B; padding: 12px; border-radius: 4px; margin-bottom: 20px; color: #000; display: flex; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: Tahoma, Geneva, sans-serif;">
                    <div style="font-size: 24px; margin-right: 15px;">👑</div>
                    <div>
                        <div style="font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #5A2800;">Líder Semanal Atual</div>
                        <div style="font-size: 15px; font-weight: bold; margin-top: 2px; color: #000;">
                            ' . htmlspecialchars($leader['player_name']) . ' 
                            <span style="font-weight: normal; font-size: 11px; color: #333;">- Média de <strong>' . $leader['avg_score'] . '</strong> pontos</span>
                        </div>
                    </div>
                </div>';
            }
        } catch (Exception $e) {
            // Ignore error silently
        }
    }

    $content = $weeklyLeaderHtml . '
    <div class="Headline" style="font-weight:bold; font-size:14px; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; margin-bottom:10px;">Bem-vindo ao Survival 3D!</div>
    <div class="Text" style="font-size:11px; line-height:140%; color:#000;">
        O <strong>Survival 3D</strong> é um jogo de RPG de sobrevivência multijogador em tempo real executado direto no seu navegador. Enfrente hordas de monstros geométricos e personalize seu estilo com as Torres de Essência:
        <ul style="font-size:11px; margin-top:5px; padding-left:18px; line-height:180%; color:#000;">
            <li><span style="color:#ff3333; font-weight:bold;">Torre Vermelha (Dano/Lifesteal/Crítico):</span> Aumente seu dano base, obtenha cura por roubo de vida, desfira acertos críticos e ataque alvos próximos em área (cleave).</li>
            <li><span style="color:#228b22; font-weight:bold;">Torre Verde (Defesa/Vida/Espinhos):</span> Ganhe bônus de HP máximo, regenere vida passivamente, reflita dano como espinhos e sobreviva a um golpe fatal com invulnerabilidade temporária (Cheat Death).</li>
            <li><span style="color:#800080; font-weight:bold;">Torre Roxa (Magia/CDR/Vampirismo):</span> Reduza o tempo de recarga de suas magias, cure-se ao causar dano mágico (spellvamp), esquive de golpes e crie uma aura tóxica prejudicial a inimigos ao redor.</li>
            <li><span style="color:#10b981; font-weight:bold;">Torre de Veneno (DoT/Kiting/Evasão):</span> Aplique stacks de veneno, cegue inimigos, crie poças tóxicas no campo e espalhe a peste entre hordas inimigas.</li>
        </ul>
        <br/>
        <strong>Pronto para a batalha?</strong> Registre uma conta gratuita, clique em Jogar para entrar na arena multiplayer e desafiar os monstros mais terríveis do Limbo!
        <br/><br/>
        <center>
            <a href="?subtopic=account/create" style="text-decoration:none; margin-right:20px;">
                <img src="templates/tibiacom/images/global/buttons/_sbutton_createaccount.gif" alt="Criar Conta" style="border:0; cursor:pointer;" />
            </a>
            <a href="http://' . $hostOnly . ':80/?v=' . time() . '" target="_blank" style="text-decoration:none;">
                <img src="templates/tibiacom/images/global/buttons/_sbutton_login.gif" alt="Jogar" style="border:0; cursor:pointer;" />
            </a>
        </center>
    </div>';

    // Append updates from updates.json
    $updatesHtml = '';
    $updates = [];
    if (file_exists('updates.json')) {
        $updates = json_decode(file_get_contents('updates.json'), true);
    }
    
    if (!empty($updates)) {
        $updatesHtml .= '
        <br/><br/>
        <div class="Headline" style="font-weight:bold; font-size:14px; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; margin-bottom:15px;">Novidades e Atualizações</div>';
        $updates = array_reverse($updates);
        foreach ($updates as $up) {
            $type = $up['type'] ?? 'Novidade';
            $target = $up['target'] ?? '';
            $desc = $up['description'] ?? '';
            $date = isset($up['date']) ? date('d/m/Y H:i', strtotime($up['date'])) : 'Recém-lançado';
            
            $badgeColor = '#505050';
            if ($type === 'Buff') $badgeColor = '#228b22';
            else if ($type === 'Nerf') $badgeColor = '#b22222';
            else if ($type === 'Correção') $badgeColor = '#0000ff';
            else if ($type === 'Ajuste') $badgeColor = '#d2691e';
            else if ($type === 'Novidade') $badgeColor = '#800080';
            
            $updatesHtml .= '
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-bottom:15px;">
                <tr bgcolor="#D4C0A1">
                    <td style="color:#000; font-size:11px; font-weight:bold;">
                        <span style="background-color:' . $badgeColor . '; color:#FFF; padding:2px 6px; border-radius:3px; font-size:9px; margin-right:5px;">' . htmlspecialchars($type) . '</span>
                        ' . htmlspecialchars($target) . '
                        <span style="float:right; color:#555; font-size:10px; font-weight:normal;">' . $date . '</span>
                    </td>
                </tr>
                <tr bgcolor="#F1E0C6">
                    <td style="color:#000; font-size:11px; line-height:140%; padding:8px;">
                        ' . nl2br(htmlspecialchars($desc)) . '
                    </td>
                </tr>
            </table>';
        }
    }
    $content .= $updatesHtml;
} else if ($subtopic === 'damage-analysis') {
    $title = "Telemetria Geral de Dano";
    $apiBase = 'http://' . ($_SERVER['HTTP_HOST'] ?? '18.231.110.109');
    $apiBase = preg_replace('/:\d+$/', '', $apiBase);
    $content = '
    <p style="font-size:11px;color:#000;margin-bottom:12px;">Esta aba mostra uma leitura geral das ultimas partidas com telemetria: tempo medio de sobrevivencia, dano medio recebido por tempo e pico de dano comparado com a media geral.</p>
    <div id="damage-analysis-root" style="background:#F1E0C6;border:1px solid #5A2800;padding:10px;color:#000;">
        <div id="damage-analysis-status">Carregando analise...</div>
        <div id="damage-analysis-content" style="display:none;">
            <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
                <button id="damage-refresh-btn" type="button">Atualizar</button>
            </div>
            <div id="damage-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px;"></div>
            <canvas id="damage-chart" width="720" height="260" style="width:100%;height:260px;background:#fff;border:1px solid #8B6F47;"></canvas>
            <div id="damage-peak-summary" style="margin-top:10px;background:#D4C0A1;border:1px solid #8B6F47;padding:8px;"></div>
            <div id="damage-type-table" style="margin-top:10px;"></div>
        </div>
    </div>
    <script>
    (function(){
        const apiUrl = "' . $apiBase . '/api/damage-analysis?limit=100";
        let summary = null;
        const statusEl = document.getElementById("damage-analysis-status");
        const contentEl = document.getElementById("damage-analysis-content");
        const cardsEl = document.getElementById("damage-cards");
        const peakEl = document.getElementById("damage-peak-summary");
        const tableEl = document.getElementById("damage-type-table");
        const canvas = document.getElementById("damage-chart");
        const ctx = canvas.getContext("2d");

        function fmtTime(seconds) {
            const m = Math.floor((seconds || 0) / 60);
            const s = Math.floor((seconds || 0) % 60).toString().padStart(2, "0");
            return m + ":" + s;
        }

        function fmtNum(value) {
            return Math.round(value || 0).toLocaleString("pt-BR");
        }

        function sourceLabel(type) {
            const labels = {
                boss: "Bosses",
                common: "Comuns",
                elite: "Elites",
                summon: "Invocados",
                status: "Status",
                trap: "Armadilhas",
                environment: "Ambiente",
                unknown: "Sem fonte antiga"
            };
            return labels[type] || type;
        }

        function drawChart(data) {
            const buckets = data?.timeline || [];
            ctx.clearRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle = "#fff";
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.strokeStyle = "#8B6F47";
            ctx.strokeRect(40,16,canvas.width-56,canvas.height-48);
            if (!buckets.length) return;
            const maxDamage = Math.max(1, ...buckets.map(b => b.avgDamage || 0), data.avgPeakDamage || 0, data.highestPeak?.totalDamage || 0);
            const plotW = canvas.width - 72;
            const plotH = canvas.height - 72;
            const avgSurvival = data.avgSurvivalTime || 0;
            const maxTime = Math.max(...buckets.map(b => b.endTime || 0), avgSurvival, 10);

            ctx.beginPath();
            buckets.forEach((b, i) => {
                const x = 40 + ((b.startTime || 0) / maxTime) * plotW;
                const y = 16 + plotH - ((b.avgDamage || 0) / maxDamage) * plotH;
                if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            });
            ctx.strokeStyle = "#b00020";
            ctx.lineWidth = 2;
            ctx.stroke();

            if (data.avgPeakDamage) {
                const yAvgPeak = 16 + plotH - (data.avgPeakDamage / maxDamage) * plotH;
                ctx.setLineDash([5,4]);
                ctx.beginPath();
                ctx.moveTo(40, yAvgPeak);
                ctx.lineTo(40 + plotW, yAvgPeak);
                ctx.strokeStyle = "#7a4b00";
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = "#7a4b00";
                ctx.fillText("Pico medio", 46, yAvgPeak - 4);
            }

            if (avgSurvival > 0) {
                const xSurvival = 40 + (avgSurvival / maxTime) * plotW;
                ctx.setLineDash([3,3]);
                ctx.beginPath();
                ctx.moveTo(xSurvival, 16);
                ctx.lineTo(xSurvival, 16 + plotH);
                ctx.strokeStyle = "#1d4ed8";
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = "#1d4ed8";
                ctx.fillText("Tempo medio", Math.max(42, xSurvival - 36), canvas.height - 18);
            }

            buckets.forEach((b, i) => {
                const x = 40 + ((b.startTime || 0) / maxTime) * plotW;
                const y = 16 + plotH - ((b.avgDamage || 0) / maxDamage) * plotH;
                ctx.fillStyle = b.spikeRate >= 0.5 ? "#ff0000" : "#5A2800";
                ctx.beginPath();
                ctx.arc(x, y, b.spikeRate >= 0.5 ? 5 : 3, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.fillStyle = "#000";
            ctx.font = "11px serif";
            ctx.fillText("Dano medio recebido por faixa de tempo", 44, 12);
            ctx.fillText("0", 20, canvas.height - 33);
            ctx.fillText(String(Math.round(maxDamage)), 8, 24);
        }

        function renderSummary() {
            if (!summary) return;
            const highest = summary.highestPeak || {};
            const sampleSize = summary.sampleSize || 0;
            cardsEl.innerHTML = [
                ["Partidas analisadas", sampleSize],
                ["Tempo medio", fmtTime(summary.avgSurvivalTime || 0)],
                ["Dano medio total", fmtNum(summary.avgTotalDamage || 0)],
                ["Pico medio", fmtNum(summary.avgPeakDamage || 0)],
                ["Dano medio final 10s", fmtNum(summary.avgFinalWindowDamage || 0)],
                ["Maior pico", highest.totalDamage ? fmtNum(highest.totalDamage) : "-"]
            ].map(card => `<div style="background:#D4C0A1;border:1px solid #8B6F47;padding:8px;"><div style="font-size:10px;color:#5A2800;">${card[0]}</div><strong>${card[1]}</strong></div>`).join("");

            peakEl.innerHTML = highest.totalDamage
                ? `<strong>Maior pico observado:</strong> ${fmtNum(highest.totalDamage)} de dano entre ${fmtTime(highest.startTime)} e ${fmtTime(highest.endTime)}. Fonte dominante: <strong>${highest.mainSourceName || "-"}</strong> (${sourceLabel(highest.mainSourceType || "unknown")}). Sobrevivencia da partida: ${fmtTime(highest.survivalTime || 0)}.`
                : "Ainda nao ha pico de dano suficiente para consolidar a leitura.";

            const byType = summary.damageByType || [];
            tableEl.innerHTML = "<h3 style=\"margin:8px 0;color:#5A2800;\">Media de dano por tipo de fonte</h3>" +
                byType.map(row =>
                    `<div style="display:grid;grid-template-columns:1fr 90px 70px;gap:8px;border-top:1px solid #8B6F47;padding:4px 0;"><span>${sourceLabel(row.type)}</span><strong>${fmtNum(row.avgDamage || 0)}</strong><span>${Math.round((row.percent || 0) * 100)}%</span></div>`
                ).join("");
            drawChart(summary);
        }

        async function load() {
            statusEl.textContent = "Carregando analise...";
            try {
                const res = await fetch(apiUrl);
                summary = await res.json();
                const hasData = (summary.sampleSize || 0) > 0;
                statusEl.style.display = hasData ? "none" : "block";
                statusEl.textContent = hasData ? "" : "Nenhuma partida com telemetria registrada ainda.";
                contentEl.style.display = hasData ? "block" : "none";
                renderSummary();
            } catch(e) {
                statusEl.textContent = "Erro ao carregar analise de dano.";
            }
        }

        document.getElementById("damage-refresh-btn").addEventListener("click", load);
        load();
    })();
    </script>';
} else if ($subtopic === 'highscores') {
    $title = "Rankings";
    $type = $_GET['type'] ?? 'general'; // general, weekly, farm, kpm, survival, records

    $content = '
    <p style="font-size:11px; color:#000; margin-bottom:15px;">Abaixo estão listados os melhores sobreviventes da arena de Survival 3D de acordo com as pontuações registradas. Clique no nome de qualquer jogador para ver suas builds recentes.</p>
    <center style="margin-bottom:15px; background-color:#D4C0A1; padding:6px; border:1px solid #505050; line-height:180%;">
        <a href="?subtopic=highscores&type=general" style="font-weight:' . ($type === 'general' ? 'bold' : 'normal') . '; color:' . ($type === 'general' ? '#800000' : '#444') . '; text-decoration:none; margin-right:12px; font-size:11px;">[ Geral (Média) ]</a>
        <a href="?subtopic=highscores&type=weekly" style="font-weight:' . ($type === 'weekly' ? 'bold' : 'normal') . '; color:' . ($type === 'weekly' ? '#800000' : '#444') . '; text-decoration:none; margin-right:12px; font-size:11px;">[ Semanal (Média) ]</a>
        <a href="?subtopic=highscores&type=farm" style="font-weight:' . ($type === 'farm' ? 'bold' : 'normal') . '; color:' . ($type === 'farm' ? '#800000' : '#444') . '; text-decoration:none; margin-right:12px; font-size:11px;">[ Farms (Média Kills) ]</a>
        <a href="?subtopic=highscores&type=kpm" style="font-weight:' . ($type === 'kpm' ? 'bold' : 'normal') . '; color:' . ($type === 'kpm' ? '#800000' : '#444') . '; text-decoration:none; margin-right:12px; font-size:11px;">[ Farm/Minuto (Média KPM) ]</a>
        <a href="?subtopic=highscores&type=survival" style="font-weight:' . ($type === 'survival' ? 'bold' : 'normal') . '; color:' . ($type === 'survival' ? '#800000' : '#444') . '; text-decoration:none; margin-right:12px; font-size:11px;">[ Sobrevivência (Média Tempo) ]</a>
        <a href="?subtopic=highscores&type=records" style="font-weight:' . ($type === 'records' ? 'bold' : 'normal') . '; color:' . ($type === 'records' ? '#800000' : '#444') . '; text-decoration:none; font-size:11px;">[ Recordes (Single Match) ]</a>
    </center>';

    if ($type === 'general') {
        $content .= '
        <p style="font-size:10px; color:#666; margin-top:-10px; margin-bottom:10px;">* Mostrando a média dos 10 melhores scores do jogador. Apenas jogadores com <strong>pelo menos 10 partidas jogadas</strong> no total são qualificados.</p>
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#505050">
                <td width="5%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Rank</td>
                <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Nome</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Média Score (Top 10)</td>
                <td width="12%" style="color:white; font-weight:bold; font-size:11px;">Melhor Andar</td>
                <td width="10%" style="color:white; font-weight:bold; font-size:11px;">Total Kills</td>
                <td width="10%" style="color:white; font-weight:bold; font-size:11px;">Total Mortes</td>
                <td width="18%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Partidas Totais</td>
            </tr>';
        if ($pdo) {
            try {
                $sql = "
                    WITH ranked_scores AS (
                        SELECT player_name, score, collapse_level, kills, deaths,
                                ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC) as rn
                        FROM ranking
                    )
                    SELECT player_name, 
                           ROUND(AVG(score)) as avg_score, 
                           MAX(collapse_level) as max_level,
                           SUM(kills) as total_kills,
                           SUM(deaths) as total_deaths,
                           COUNT(*) as matches_played
                    FROM ranked_scores
                    WHERE rn <= 10
                    GROUP BY player_name
                    HAVING COUNT(*) >= 10
                    ORDER BY avg_score DESC
                    LIMIT 50";
                $stmt = $pdo->query($sql);
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    $content .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center">' . $rank++ . '</td>
                        <td><a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; text-decoration:underline; font-weight:bold;">' . htmlspecialchars($row['player_name']) . '</a></td>
                        <td><strong>' . $row['avg_score'] . '</strong></td>
                        <td>Andar ' . $row['max_level'] . '</td>
                        <td>' . $row['total_kills'] . '</td>
                        <td>' . $row['total_deaths'] . '</td>
                        <td align="center">' . $row['matches_played'] . '</td>
                    </tr>';
                }
                if ($rank === 1) {
                    $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:#000;">Nenhum recorde registrado com 10+ partidas.</td></tr>';
                }
            } catch (Exception $e) {
                $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Erro no banco de dados: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
            }
        } else {
            $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Banco de dados offline.</td></tr>';
        }
        $content .= '</table>';
    } else if ($type === 'weekly') {
        $content .= '
        <p style="font-size:10px; color:#666; margin-top:-10px; margin-bottom:10px;">* Mostrando a média dos 10 melhores scores obtidos na semana atual. O ranking reseta toda <strong>segunda-feira às 00:01</strong>. Apenas jogadores com <strong>pelo menos 10 partidas jogadas na semana</strong> são qualificados.</p>
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#505050">
                <td width="5%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Rank</td>
                <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Nome</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Média Score (Semanal)</td>
                <td width="12%" style="color:white; font-weight:bold; font-size:11px;">Melhor Andar</td>
                <td width="10%" style="color:white; font-weight:bold; font-size:11px;">Kills na Semana</td>
                <td width="10%" style="color:white; font-weight:bold; font-size:11px;">Mortes na Semana</td>
                <td width="18%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Partidas na Semana</td>
            </tr>';
        if ($pdo) {
            try {
                $sql = "
                    WITH weekly_ranked AS (
                        SELECT id, player_name, LOWER(player_name) AS player_key, score, collapse_level, kills, deaths, created_at,
                                ROW_NUMBER() OVER (
                                    PARTITION BY LOWER(player_name)
                                    ORDER BY score DESC, created_at ASC, id ASC
                                ) as rn
                        FROM ranking
                        WHERE created_at >= date_trunc('week', NOW() - INTERVAL '1 minute') + INTERVAL '1 minute'
                    ),
                    top10 AS (
                        SELECT * FROM weekly_ranked WHERE rn <= 10
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
                        WHERE created_at >= date_trunc('week', NOW() - INTERVAL '1 minute') + INTERVAL '1 minute'
                        GROUP BY LOWER(player_name)
                    )
                    SELECT MIN(t.player_name) as player_name,
                           ROUND(AVG(t.score)::numeric, 1) as avg_score, 
                           MAX(t.collapse_level) as max_level,
                           SUM(t.kills) as total_kills,
                           SUM(t.deaths) as total_deaths,
                           MAX(pt.total_valid_matches) as matches_played,
                           SUM(t.score)::integer as top10_sum,
                           MAX(t.score)::integer as best_score,
                           b.best_score_at as best_score_at
                    FROM top10 t
                    JOIN player_totals pt ON pt.player_key = t.player_key
                    JOIN top10_best b ON b.player_key = t.player_key
                    GROUP BY t.player_key, b.best_score_at
                    HAVING COUNT(*) >= 10
                    ORDER BY avg_score DESC,
                             top10_sum DESC,
                             best_score DESC,
                             matches_played DESC,
                             best_score_at ASC,
                             MIN(t.player_name) ASC
                    LIMIT 50";
                $stmt = $pdo->query($sql);
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    $content .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center">' . $rank++ . '</td>
                        <td><a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; text-decoration:underline; font-weight:bold;">' . htmlspecialchars($row['player_name']) . '</a></td>
                        <td><strong>' . $row['avg_score'] . '</strong></td>
                        <td>Andar ' . $row['max_level'] . '</td>
                        <td>' . $row['total_kills'] . '</td>
                        <td>' . $row['total_deaths'] . '</td>
                        <td align="center">' . $row['matches_played'] . '</td>
                    </tr>';
                }
                if ($rank === 1) {
                    $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:#000;">Nenhum jogador disputou 10+ partidas na semana atual ainda.</td></tr>';
                }
            } catch (Exception $e) {
                $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Erro no banco de dados: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
            }
        } else {
            $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Banco de dados offline.</td></tr>';
        }
        $content .= '</table>';
    } else if ($type === 'farm') {
        $content .= '
        <p style="font-size:10px; color:#666; margin-top:-10px; margin-bottom:10px;">* Mostrando a média de abates (kills) das 10 partidas com mais abates do jogador. Apenas jogadores com <strong>pelo menos 10 partidas jogadas</strong> no total são qualificados.</p>
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#505050">
                <td width="5%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Rank</td>
                <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Nome</td>
                <td width="20%" style="color:white; font-weight:bold; font-size:11px;">Média Kills (Top 10)</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Melhor Partida (Kills)</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Total de Kills</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Partidas Totais</td>
            </tr>';
        if ($pdo) {
            try {
                $sql = "
                    WITH ranked_kills AS (
                        SELECT player_name, kills,
                                ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY kills DESC) as rn
                        FROM ranking
                    )
                    SELECT player_name, 
                           ROUND(AVG(kills), 1) as avg_kills, 
                           MAX(kills) as max_kills,
                           SUM(kills) as total_kills,
                           COUNT(*) as matches_played
                    FROM ranked_kills
                    WHERE rn <= 10
                    GROUP BY player_name
                    HAVING COUNT(*) >= 10
                    ORDER BY avg_kills DESC
                    LIMIT 50";
                $stmt = $pdo->query($sql);
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    $content .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center">' . $rank++ . '</td>
                        <td><a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; text-decoration:underline; font-weight:bold;">' . htmlspecialchars($row['player_name']) . '</a></td>
                        <td><strong>' . $row['avg_kills'] . ' abates</strong></td>
                        <td>' . $row['max_kills'] . ' abates</td>
                        <td>' . $row['total_kills'] . '</td>
                        <td align="center">' . $row['matches_played'] . '</td>
                    </tr>';
                }
                if ($rank === 1) {
                    $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:#000;">Nenhum jogador qualificado para o Ranking de Farms.</td></tr>';
                }
            } catch (Exception $e) {
                $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Erro: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
            }
        } else {
            $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Banco de dados offline.</td></tr>';
        }
        $content .= '</table>';
    } else if ($type === 'kpm') {
        $content .= '
        <p style="font-size:10px; color:#666; margin-top:-10px; margin-bottom:10px;">* Mostrando a média de abates por minuto (KPM) das 10 partidas com maior eficiência de farm. Apenas jogadores com <strong>pelo menos 10 partidas jogadas</strong> no total são qualificados.</p>
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#505050">
                <td width="5%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Rank</td>
                <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Nome</td>
                <td width="20%" style="color:white; font-weight:bold; font-size:11px;">Média Kills/Minuto</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Melhor KPM (Partida)</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Total de Kills</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Partidas Totais</td>
            </tr>';
        if ($pdo) {
            try {
                $sql = "
                    WITH ranked_kpm AS (
                        SELECT player_name, kills,
                               (kills::numeric / (NULLIF(survival_time_seconds, 0)::numeric / 60.0)) as kpm,
                               ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY (kills::numeric / (NULLIF(survival_time_seconds, 0)::numeric / 60.0)) DESC) as rn
                        FROM ranking
                        WHERE survival_time_seconds > 0
                    )
                    SELECT player_name, 
                           ROUND(AVG(kpm), 2) as avg_kpm, 
                           ROUND(MAX(kpm), 2) as max_kpm,
                           SUM(kills) as total_kills,
                           COUNT(*) as matches_played
                    FROM ranked_kpm
                    WHERE rn <= 10
                    GROUP BY player_name
                    HAVING COUNT(*) >= 10
                    ORDER BY avg_kpm DESC
                    LIMIT 50";
                $stmt = $pdo->query($sql);
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    $content .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center">' . $rank++ . '</td>
                        <td><a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; text-decoration:underline; font-weight:bold;">' . htmlspecialchars($row['player_name']) . '</a></td>
                        <td><strong>' . $row['avg_kpm'] . ' kills/min</strong></td>
                        <td>' . $row['max_kpm'] . ' /min</td>
                        <td>' . $row['total_kills'] . '</td>
                        <td align="center">' . $row['matches_played'] . '</td>
                    </tr>';
                }
                if ($rank === 1) {
                    $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:#000;">Nenhum jogador qualificado para o Ranking de Eficiência de Farm.</td></tr>';
                }
            } catch (Exception $e) {
                $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Erro: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
            }
        } else {
            $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Banco de dados offline.</td></tr>';
        }
        $content .= '</table>';
    } else if ($type === 'survival') {
        $content .= '
        <p style="font-size:10px; color:#666; margin-top:-10px; margin-bottom:10px;">* Mostrando a média de tempo sobrevivência das 10 partidas com maior tempo do jogador. Apenas jogadores com <strong>pelo menos 10 partidas jogadas</strong> no total são qualificados.</p>
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#505050">
                <td width="5%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Rank</td>
                <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Nome</td>
                <td width="20%" style="color:white; font-weight:bold; font-size:11px;">Média Tempo (Top 10)</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Melhor Tempo</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Tempo Total</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Partidas Totais</td>
            </tr>';
        if ($pdo) {
            try {
                $sql = "
                    WITH ranked_time AS (
                        SELECT player_name, survival_time_seconds,
                                ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY survival_time_seconds DESC) as rn
                        FROM ranking
                    )
                    SELECT player_name, 
                           ROUND(AVG(survival_time_seconds)) as avg_time, 
                           MAX(survival_time_seconds) as max_time,
                           SUM(survival_time_seconds) as total_time,
                           COUNT(*) as matches_played
                    FROM ranked_time
                    WHERE rn <= 10
                    GROUP BY player_name
                    HAVING COUNT(*) >= 10
                    ORDER BY avg_time DESC
                    LIMIT 50";
                $stmt = $pdo->query($sql);
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    
                    $avgMinutes = floor($row['avg_time'] / 60);
                    $avgSeconds = $row['avg_time'] % 60;
                    $avgTimeStr = sprintf("%02d:%02d", $avgMinutes, $avgSeconds);
                    
                    $maxMinutes = floor($row['max_time'] / 60);
                    $maxSeconds = $row['max_time'] % 60;
                    $maxTimeStr = sprintf("%02d:%02d", $maxMinutes, $maxSeconds);
                    
                    $totHours = floor($row['total_time'] / 3600);
                    $totMinutes = floor(($row['total_time'] % 3600) / 60);
                    $totalTimeStr = $totHours > 0 ? "{$totHours}h {$totMinutes}m" : "{$totMinutes}m";

                    $content .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center">' . $rank++ . '</td>
                        <td><a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; text-decoration:underline; font-weight:bold;">' . htmlspecialchars($row['player_name']) . '</a></td>
                        <td><strong>' . $avgTimeStr . '</strong></td>
                        <td>' . $maxTimeStr . '</td>
                        <td>' . $totalTimeStr . '</td>
                        <td align="center">' . $row['matches_played'] . '</td>
                    </tr>';
                }
                if ($rank === 1) {
                    $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:#000;">Nenhum jogador qualificado para o Ranking de Sobrevivência.</td></tr>';
                }
            } catch (Exception $e) {
                $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Erro: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
            }
        } else {
            $content .= '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Banco de dados offline.</td></tr>';
        }
        $content .= '</table>';
    } else { // records
        $content .= '
        <p style="font-size:10px; color:#666; margin-top:-10px; margin-bottom:10px;">* Mostrando os maiores recordes históricos obtidos em uma única partida. Sem limite mínimo de partidas jogadas.</p>
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#505050">
                <td width="5%" style="color:white; font-weight:bold; font-size:11px; text-align:center;">Rank</td>
                <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Nome</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Score Recorde</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Andar Atingido</td>
                <td width="10%" style="color:white; font-weight:bold; font-size:11px;">Abates</td>
                <td width="10%" style="color:white; font-weight:bold; font-size:11px;">Mortes</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:11px;">Tempo Sobrevivido</td>
            </tr>';
        if ($pdo) {
            try {
                $stmt = $pdo->query("SELECT player_name, score, collapse_level, kills, deaths, survival_time_seconds FROM ranking ORDER BY score DESC, survival_time_seconds DESC LIMIT 50");
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    $minutes = floor($row['survival_time_seconds'] / 60);
                    $seconds = $row['survival_time_seconds'] % 60;
                    $timeStr = sprintf("%02d:%02d", $minutes, $seconds);
                    $content .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center">' . $rank++ . '</td>
                        <td><a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; text-decoration:underline; font-weight:bold;">' . htmlspecialchars($row['player_name']) . '</a></td>
                        <td><strong>' . $row['score'] . '</strong></td>
                        <td>Andar ' . $row['collapse_level'] . '</td>
                        <td>' . $row['kills'] . '</td>
                        <td>' . $row['deaths'] . '</td>
                        <td>' . $timeStr . '</td>
                    </tr>';
                }
                if ($rank === 1) {
                    $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:#000;">Nenhum recorde registrado ainda.</td></tr>';
                }
            } catch (Exception $e) {
                $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Erro: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
            }
        } else {
            $content .= '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Banco de dados offline.</td></tr>';
        }
        $content .= '</table>';
    }
} else if ($subtopic === 'builds') {
    $title = "Melhores Builds";
    
    // Tower Stats query
    $tower_stats = ['red' => 0, 'green' => 0, 'purple' => 0, 'poison' => 0];
    $total_runs = 0;
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT build_color, COUNT(*) as count FROM ranking WHERE build_color IS NOT NULL GROUP BY build_color");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $col = $row['build_color'];
                if (isset($tower_stats[$col])) {
                    $tower_stats[$col] += (int)$row['count'];
                    $total_runs += (int)$row['count'];
                }
            }
        } catch (Exception $e) {}
    }
    
    $pct_red = $total_runs > 0 ? round(($tower_stats['red'] / $total_runs) * 100, 1) : 0;
    $pct_green = $total_runs > 0 ? round(($tower_stats['green'] / $total_runs) * 100, 1) : 0;
    $pct_purple = $total_runs > 0 ? round(($tower_stats['purple'] / $total_runs) * 100, 1) : 0;
    $pct_poison = $total_runs > 0 ? round(($tower_stats['poison'] / $total_runs) * 100, 1) : 0;
    
    // Top 10 builds query
    $top_builds_html = '';
    if ($pdo) {
        try {
            $stmt = $pdo->query("
                SELECT player_name, score, collapse_level, kills, deaths, survival_time_seconds,
                       build_color, build_floor1, build_floor2, build_floor3, build_floor4, build_floor5, created_at
                FROM ranking
                WHERE build_color IS NOT NULL
                ORDER BY score DESC, survival_time_seconds DESC
                LIMIT 10
            ");
            $rank = 1;
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                
                $color = $row['build_color'] ?: 'red';
                $f1 = (int)$row['build_floor1'];
                $f2 = (int)$row['build_floor2'];
                $f3 = (int)$row['build_floor3'];
                $f4 = (int)$row['build_floor4'];
                $f5 = (int)$row['build_floor5'];
                
                $passives = [
                    $GLOBAL_PASSIVES[$color][0][$f1] ?? 'Desconhecido',
                    $GLOBAL_PASSIVES[$color][1][$f2] ?? 'Desconhecido',
                    $GLOBAL_PASSIVES[$color][2][$f3] ?? 'Desconhecido',
                    $GLOBAL_PASSIVES[$color][3][$f4] ?? 'Desconhecido',
                ];
                $ultimate = $GLOBAL_ULTIMATES[$color][$f5] ?? 'Sobrecarga Cósmica';
                
                $colorName = ($color === 'red' ? 'Vermelha' : ($color === 'green' ? 'Verde' : ($color === 'poison' ? 'Veneno' : 'Roxa')));
                $colorHex = ($color === 'red' ? '#ff3333' : ($color === 'green' ? '#22c55e' : ($color === 'poison' ? '#10b981' : '#a855f7')));
                $colorEmoji = ($color === 'red' ? '🔺' : ($color === 'green' ? '🟩' : ($color === 'poison' ? '☠️' : '🟣')));
                
                $top_builds_html .= '
                <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                    <td align="center" style="font-weight:bold;">' . $rank++ . '</td>
                    <td>
                        <a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; font-weight:bold; text-decoration:underline;">' . htmlspecialchars($row['player_name']) . '</a>
                    </td>
                    <td><strong>' . $row['score'] . '</strong> <span style="font-size:9px; color:#555;">(Andar ' . $row['collapse_level'] . ')</span></td>
                    <td><span style="color:' . $colorHex . '; font-weight:bold;">' . $colorEmoji . ' Torre ' . $colorName . '</span></td>
                    <td style="font-size:10px; line-height:120%;">
                        • Nvl 5: ' . htmlspecialchars($passives[0]) . '<br/>
                        • Nvl 10: ' . htmlspecialchars($passives[1]) . '<br/>
                        • Nvl 15: ' . htmlspecialchars($passives[2]) . '<br/>
                        • Nvl 20: ' . htmlspecialchars($passives[3]) . '
                    </td>
                    <td style="color:#b45309; font-weight:bold;">' . htmlspecialchars($ultimate) . '</td>
                </tr>';
            }
            if ($rank === 1) {
                $top_builds_html = '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:#000;">Nenhum recorde de build registrado ainda.</td></tr>';
            }
        } catch (Exception $e) {
            $top_builds_html = '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Erro: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
        }
    } else {
        $top_builds_html = '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:#000;">Banco de dados offline.</td></tr>';
    }
    
    // Top 10 scores per essence tower queries
    $tower_rankings_html = ['red' => '', 'green' => '', 'purple' => '', 'poison' => ''];
    if ($pdo) {
        foreach (['red', 'green', 'purple', 'poison'] as $color) {
            try {
                $stmt = $pdo->prepare("
                    SELECT player_name, score, collapse_level, kills, deaths, survival_time_seconds,
                           build_color, build_floor1, build_floor2, build_floor3, build_floor4, build_floor5, created_at
                    FROM ranking
                    WHERE build_color = :color
                    ORDER BY score DESC, survival_time_seconds DESC
                    LIMIT 10
                ");
                $stmt->execute(['color' => $color]);
                
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    
                    $f1 = (int)$row['build_floor1'];
                    $f2 = (int)$row['build_floor2'];
                    $f3 = (int)$row['build_floor3'];
                    $f4 = (int)$row['build_floor4'];
                    $f5 = (int)$row['build_floor5'];
                    
                    $passives = [
                        $GLOBAL_PASSIVES[$color][0][$f1] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][1][$f2] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][2][$f3] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][3][$f4] ?? 'Desconhecido',
                    ];
                    $ultimate = $GLOBAL_ULTIMATES[$color][$f5] ?? 'Sobrecarga Cósmica';
                    
                    $tower_rankings_html[$color] .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center" style="font-weight:bold;">' . $rank++ . '</td>
                        <td>
                            <a href="javascript:void(0);" onclick="showPlayerBuilds(\'' . addslashes($row['player_name']) . '\')" style="color:#000; font-weight:bold; text-decoration:underline;">' . htmlspecialchars($row['player_name']) . '</a>
                        </td>
                        <td><strong>' . $row['score'] . '</strong> <span style="font-size:9px; color:#555;">(Andar ' . $row['collapse_level'] . ')</span></td>
                        <td style="font-size:10px; line-height:120%;">
                            • Nvl 5: ' . htmlspecialchars($passives[0]) . '<br/>
                            • Nvl 10: ' . htmlspecialchars($passives[1]) . '<br/>
                            • Nvl 15: ' . htmlspecialchars($passives[2]) . '<br/>
                            • Nvl 20: ' . htmlspecialchars($passives[3]) . '
                        </td>
                        <td style="color:#b45309; font-weight:bold;">' . htmlspecialchars($ultimate) . '</td>
                    </tr>';
                }
                
                if ($rank === 1) {
                    $tower_rankings_html[$color] = '<tr bgcolor="#F1E0C6"><td colspan="5" align="center" style="color:#000; padding:10px;">Nenhum recorde registrado para esta torre.</td></tr>';
                }
            } catch (Exception $e) {
                $tower_rankings_html[$color] = '<tr bgcolor="#F1E0C6"><td colspan="5" align="center" style="color:red; padding:10px;">Erro: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
            }
        }
    } else {
        foreach (['red', 'green', 'purple', 'poison'] as $color) {
            $tower_rankings_html[$color] = '<tr bgcolor="#F1E0C6"><td colspan="5" align="center" style="color:red; padding:10px;">Banco de dados offline.</td></tr>';
        }
    }
    
    $content = '
    <p style="font-size:11px; color:#000; margin-bottom:15px;">Aqui você pode comparar as melhores builds do servidor, ver qual Torre de Essência está mais popular ("em alta") e analisar o que os melhores sobreviventes estão usando. Clique no nome de qualquer jogador para ver suas builds recentes.</p>
    
    <div style="background:#D4C0A1; border:1px solid #505050; padding:12px; margin-bottom:15px; border-radius:4px; font-family:Verdana; color:#000;">
        <h3 style="margin-top:0; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; font-size:12px;">🔥 Popularidade das Torres ("Towers em Alta")</h3>
        <p style="font-size:10px; color:#555; margin-bottom:12px;">Abaixo é mostrada a frequência relativa com que cada Torre é selecionada em todas as partidas registradas.</p>
        
        <!-- Red Tower -->
        <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:bold; margin-bottom:3px;">
                <span style="color:#a82424;">🔺 Torre Vermelha (Ataque/Crítico)</span>
                <span>' . $pct_red . '% (' . $tower_stats['red'] . ' partidas)</span>
            </div>
            <div style="background:#bba88e; border:1px solid #776655; height:12px; border-radius:3px; overflow:hidden;">
                <div style="background:linear-gradient(to right, #ea580c, #dc2626); width:' . $pct_red . '%; height:100%; box-shadow:inset 0 1px 3px rgba(255,255,255,0.3);"></div>
            </div>
        </div>

        <!-- Green Tower -->
        <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:bold; margin-bottom:3px;">
                <span style="color:#1b703a;">🟩 Torre Verde (Defesa/Regen/Thorns)</span>
                <span>' . $pct_green . '% (' . $tower_stats['green'] . ' partidas)</span>
            </div>
            <div style="background:#bba88e; border:1px solid #776655; height:12px; border-radius:3px; overflow:hidden;">
                <div style="background:linear-gradient(to right, #22c55e, #16a34a); width:' . $pct_green . '%; height:100%; box-shadow:inset 0 1px 3px rgba(255,255,255,0.3);"></div>
            </div>
        </div>

        <!-- Purple Tower -->
        <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:bold; margin-bottom:3px;">
                <span style="color:#5b21b6;">🟣 Torre Roxa (Magia/CDR/Vampirismo)</span>
                <span>' . $pct_purple . '% (' . $tower_stats['purple'] . ' partidas)</span>
            </div>
            <div style="background:#bba88e; border:1px solid #776655; height:12px; border-radius:3px; overflow:hidden;">
                <div style="background:linear-gradient(to right, #a855f7, #7c3aed); width:' . $pct_purple . '%; height:100%; box-shadow:inset 0 1px 3px rgba(255,255,255,0.3);"></div>
            </div>
        </div>

        <!-- Poison Tower -->
        <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:bold; margin-bottom:3px;">
                <span style="color:#059669;">☠️ Torre de Veneno (DoT/Kiting/Evasão)</span>
                <span>' . $pct_poison . '% (' . $tower_stats['poison'] . ' partidas)</span>
            </div>
            <div style="background:#bba88e; border:1px solid #776655; height:12px; border-radius:3px; overflow:hidden;">
                <div style="background:linear-gradient(to right, #10b981, #059669); width:' . $pct_poison . '%; height:100%; box-shadow:inset 0 1px 3px rgba(255,255,255,0.3);"></div>
            </div>
        </div>
    </div>
    
    <div style="background:#D4C0A1; border:1px solid #505050; padding:12px; border-radius:4px; font-family:Verdana; color:#000;">
        <h3 style="margin-top:0; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; font-size:12px;">🏆 As 10 Melhores Partidas e suas Builds</h3>
        <p style="font-size:10px; color:#555; margin-bottom:10px;">Compare abaixo as configurações de passivas e ultimates utilizadas nas partidas de maior pontuação do Survival 3D.</p>
        
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#505050">
                <td width="5%" style="color:white; font-weight:bold; font-size:10px; text-align:center;">Rank</td>
                <td width="20%" style="color:white; font-weight:bold; font-size:10px;">Jogador</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:10px;">Score (Andar)</td>
                <td width="18%" style="color:white; font-weight:bold; font-size:10px;">Torre</td>
                <td width="27%" style="color:white; font-weight:bold; font-size:10px;">Passivas Escolhidas</td>
                <td width="15%" style="color:white; font-weight:bold; font-size:10px;">Ultimate Mutada</td>
            </tr>
            ' . $top_builds_html . '
        </table>
    </div>
    
    <div style="background:#D4C0A1; border:1px solid #505050; padding:12px; margin-top:15px; border-radius:4px; font-family:Verdana; color:#000;">
        <h3 style="margin-top:0; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; font-size:12px;">🏆 Top 10 Builds por Torre de Essência</h3>
        <p style="font-size:10px; color:#555; margin-bottom:12px;">Selecione a torre abaixo para analisar as 10 partidas de maior pontuação de cada elemento.</p>
        
        <div style="display: flex; gap: 8px; border-bottom: 2px solid #5A2800; padding-bottom: 8px; margin-bottom: 12px;">
            <button class="build-tab-btn active" onclick="openBuildTab(event, \'build-red\')" style="padding: 8px 12px; font-weight: bold; background: #D4C0A1; border: 1px solid #5A2800; border-bottom: none; border-radius: 4px 4px 0 0; cursor: pointer; color: #a82424;">🔺 Vermelha</button>
            <button class="build-tab-btn" onclick="openBuildTab(event, \'build-green\')" style="padding: 8px 12px; font-weight: bold; background: #c5b297; border: 1px solid #776655; border-bottom: none; border-radius: 4px 4px 0 0; cursor: pointer; color: #1b703a;">🟩 Verde</button>
            <button class="build-tab-btn" onclick="openBuildTab(event, \'build-purple\')" style="padding: 8px 12px; font-weight: bold; background: #c5b297; border: 1px solid #776655; border-bottom: none; border-radius: 4px 4px 0 0; cursor: pointer; color: #5b21b6;">🟣 Roxa</button>
            <button class="build-tab-btn" onclick="openBuildTab(event, \'build-poison\')" style="padding: 8px 12px; font-weight: bold; background: #c5b297; border: 1px solid #776655; border-bottom: none; border-radius: 4px 4px 0 0; cursor: pointer; color: #059669;">☠️ Veneno</button>
        </div>
        
        <!-- Red content -->
        <div id="build-red" class="build-tab-content" style="display: block;">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#505050">
                    <td width="5%" style="color:white; font-weight:bold; font-size:10px; text-align:center;">Rank</td>
                    <td width="25%" style="color:white; font-weight:bold; font-size:10px;">Jogador</td>
                    <td width="20%" style="color:white; font-weight:bold; font-size:10px;">Score (Andar)</td>
                    <td width="35%" style="color:white; font-weight:bold; font-size:10px;">Passivas Escolhidas</td>
                    <td width="15%" style="color:white; font-weight:bold; font-size:10px;">Ultimate Mutada</td>
                </tr>
                ' . $tower_rankings_html['red'] . '
            </table>
        </div>
        
        <!-- Green content -->
        <div id="build-green" class="build-tab-content" style="display: none;">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#505050">
                    <td width="5%" style="color:white; font-weight:bold; font-size:10px; text-align:center;">Rank</td>
                    <td width="25%" style="color:white; font-weight:bold; font-size:10px;">Jogador</td>
                    <td width="20%" style="color:white; font-weight:bold; font-size:10px;">Score (Andar)</td>
                    <td width="35%" style="color:white; font-weight:bold; font-size:10px;">Passivas Escolhidas</td>
                    <td width="15%" style="color:white; font-weight:bold; font-size:10px;">Ultimate Mutada</td>
                </tr>
                ' . $tower_rankings_html['green'] . '
            </table>
        </div>
        
        <!-- Purple content -->
        <div id="build-purple" class="build-tab-content" style="display: none;">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#505050">
                    <td width="5%" style="color:white; font-weight:bold; font-size:10px; text-align:center;">Rank</td>
                    <td width="25%" style="color:white; font-weight:bold; font-size:10px;">Jogador</td>
                    <td width="20%" style="color:white; font-weight:bold; font-size:10px;">Score (Andar)</td>
                    <td width="35%" style="color:white; font-weight:bold; font-size:10px;">Passivas Escolhidas</td>
                    <td width="15%" style="color:white; font-weight:bold; font-size:10px;">Ultimate Mutada</td>
                </tr>
                ' . $tower_rankings_html['purple'] . '
            </table>
        </div>
        
        <!-- Poison content -->
        <div id="build-poison" class="build-tab-content" style="display: none;">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#505050">
                    <td width="5%" style="color:white; font-weight:bold; font-size:10px; text-align:center;">Rank</td>
                    <td width="25%" style="color:white; font-weight:bold; font-size:10px;">Jogador</td>
                    <td width="20%" style="color:white; font-weight:bold; font-size:10px;">Score (Andar)</td>
                    <td width="35%" style="color:white; font-weight:bold; font-size:10px;">Passivas Escolhidas</td>
                    <td width="15%" style="color:white; font-weight:bold; font-size:10px;">Ultimate Mutada</td>
                </tr>
                ' . $tower_rankings_html['poison'] . '
            </table>
        </div>
    </div>
    
    <script>
    function openBuildTab(evt, tabId) {
        const contents = document.getElementsByClassName("build-tab-content");
        for (let i = 0; i < contents.length; i++) {
            contents[i].style.display = "none";
        }
        const buttons = document.getElementsByClassName("build-tab-btn");
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].classList.remove("active");
            buttons[i].style.background = "#c5b297";
            buttons[i].style.border = "1px solid #776655";
            buttons[i].style.borderBottom = "none";
        }
        document.getElementById(tabId).style.display = "block";
        evt.currentTarget.classList.add("active");
        evt.currentTarget.style.background = "#D4C0A1";
        evt.currentTarget.style.border = "1px solid #5A2800";
        evt.currentTarget.style.borderBottom = "none";
    }
    </script>';
} else if ($subtopic === 'online') {
    $title = "Quem está Online?";
    $content = '
    <p style="font-size:11px; color:#000; margin-bottom:15px;">Abaixo está a lista de jogadores com atividades ou partidas registradas nos últimos 5 minutos.</p>
    <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
        <tr bgcolor="#505050">
            <td width="40%" style="color:white; font-weight:bold; font-size:11px;">Nome do Jogador</td>
            <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Status</td>
            <td width="30%" style="color:white; font-weight:bold; font-size:11px;">Última Atividade</td>
        </tr>';
    
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT username, last_login FROM players WHERE last_login > NOW() - INTERVAL '5 minutes' ORDER BY last_login DESC");
            $rank = 1;
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                $content .= '
                <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                    <td><strong>' . htmlspecialchars($row['username']) . '</strong></td>
                    <td><span style="color:green; font-weight:bold;">Online</span></td>
                    <td>' . $row['last_login'] . '</td>
                </tr>';
                $rank++;
            }
            if ($rank === 1) {
                $content .= '<tr bgcolor="#F1E0C6"><td colspan="3" align="center" style="color:#000;">Nenhum jogador ativo nos últimos 5 minutos.</td></tr>';
            }
        } catch (Exception $e) {
            $content .= '<tr bgcolor="#F1E0C6"><td colspan="3" align="center" style="color:red;">Erro: ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
        }
    } else {
        $content .= '<tr bgcolor="#F1E0C6"><td colspan="3" align="center" style="color:red;">Banco de dados offline.</td></tr>';
    }
    $content .= '</table>';
} else if ($subtopic === 'account/create') {
    $title = "Criar Conta";
    $error = '';
    $success = '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['username'])) {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $passwordConfirm = $_POST['password_confirm'] ?? '';

        if (strlen($username) < 3 || strlen($username) > 20 || !preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
            $error = 'O nome de usuário deve conter de 3 a 20 caracteres e incluir apenas letras, números e sublinhados.';
        } else if (strlen($password) < 6) {
            $error = 'A senha deve conter no mínimo 6 caracteres.';
        } else if ($password !== $passwordConfirm) {
            $error = 'As senhas digitadas não coincidem.';
        } else if ($pdo) {
            try {
                $stmt = $pdo->prepare("SELECT id FROM players WHERE LOWER(username) = LOWER(:username)");
                $stmt->execute([':username' => $username]);
                if ($stmt->fetch()) {
                    $error = 'Este nome de conta já está em uso.';
                } else {
                    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
                    $stmt = $pdo->prepare("INSERT INTO players (username, password_hash) VALUES (:username, :hash)");
                    $stmt->execute([':username' => $username, ':hash' => $hash]);
                    $success = 'Conta criada com sucesso! Você já pode entrar no jogo ou efetuar login no painel.';
                }
            } catch (Exception $e) {
                $error = 'Falha no cadastro: ' . $e->getMessage();
            }
        } else {
            $error = 'Banco de dados não disponível no momento.';
        }
    }

    if ($error) {
        $content .= '<div style="color:#FFF; background:#8b0000; border:1px solid red; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">⚠️ ' . htmlspecialchars($error) . '</div>';
    }
    if ($success) {
        $content .= '<div style="color:#000; background:#98fb98; border:1px solid green; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">✅ ' . htmlspecialchars($success) . '</div>';
    }

    $content .= '
    <form method="post" action="?subtopic=account/create">
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#D4C0A1">
                <td colspan="2" style="color:#000; font-weight:bold; font-size:12px;"><b>Informações do Cadastro</b></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                <td width="35%"><strong>Nome da Conta (Usuário):</strong></td>
                <td><input type="text" name="username" value="' . htmlspecialchars($_POST['username'] ?? '') . '" style="width:200px;" required /></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                <td><strong>Senha:</strong></td>
                <td><input type="password" name="password" style="width:200px;" required /></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                <td><strong>Confirmar Senha:</strong></td>
                <td><input type="password" name="password_confirm" style="width:200px;" required /></td>
            </tr>
        </table>
        <br/>
        <center>
            <input type="image" src="templates/tibiacom/images/global/buttons/_sbutton_submit.gif" style="border:0;" />
        </center>
    </form>';
} else if ($subtopic === 'market') {
    $title = "Mercado Quântico";
    ob_start();
    require 'system/pages/market.php';
    $content = ob_get_clean();
} else if ($subtopic === 'tradein') {
    $title = "Reciclador de Fragmentos";
    ob_start();
    require 'system/pages/tradein.php';
    $content = ob_get_clean();
} else if ($subtopic === 'admin_watch') {
    if (!isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
        header('Location: ?subtopic=news');
        exit;
    }
    $title = "Admin Watch - Monitor do Servidor";
    ob_start();
    require 'system/pages/admin_watch.php';
    $content = ob_get_clean();
} else if ($subtopic === 'account/manage') {
    $title = "Gerenciar Conta";
    $error = '';
    $success = '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['username'])) {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        if ($pdo) {
            try {
                $stmt = $pdo->prepare("SELECT id, username, password_hash, is_admin, is_blocked FROM players WHERE LOWER(username) = LOWER(:username)");
                $stmt->execute([':username' => $username]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($user && password_verify($password, $user['password_hash'])) {
                    if (isset($user['is_blocked']) && pg_to_bool($user['is_blocked'])) {
                        $error = 'Sua conta foi bloqueada pelo administrador.';
                    } else {
                        $_SESSION['player_id'] = $user['id'];
                        $_SESSION['player_name'] = $user['username'];
                        $_SESSION['is_admin'] = isset($user['is_admin']) && pg_to_bool($user['is_admin']);
                        $stmt = $pdo->prepare("UPDATE players SET last_login = NOW() WHERE id = :id");
                        $stmt->execute([':id' => $user['id']]);
                        header('Location: ?subtopic=account/manage');
                        exit;
                    }
                } else {
                    $error = 'Nome de conta ou senha incorretos.';
                }
            } catch (Exception $e) {
                $error = 'Erro de login: ' . $e->getMessage();
            }
        } else {
            $error = 'Conexão com o banco de dados offline.';
        }
    }

    if ($logged) {
        $player_name = $_SESSION['player_name'];
        if ($pdo) {
            try {
                // Real-time block check
                $stmt = $pdo->prepare("SELECT is_blocked, is_admin FROM players WHERE id = :id");
                $stmt->execute([':id' => $_SESSION['player_id']]);
                $chk = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($chk && pg_to_bool($chk['is_blocked'])) {
                    session_destroy();
                    header('Location: ?subtopic=account/manage');
                    exit;
                }
                // Refresh admin session status
                $_SESSION['is_admin'] = isset($chk['is_admin']) && pg_to_bool($chk['is_admin']);
            } catch (Exception $e) {}
        }

        // Process password change
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['change_password'])) {
            $oldPassword = $_POST['old_password'] ?? '';
            $newPassword = $_POST['new_password'] ?? '';
            $confirmPassword = $_POST['confirm_password'] ?? '';

            if (empty($oldPassword) || empty($newPassword) || empty($confirmPassword)) {
                $error = 'Por favor, preencha todos os campos.';
            } else if (strlen($newPassword) < 6) {
                $error = 'A nova senha deve conter no mínimo 6 caracteres.';
            } else if ($newPassword !== $confirmPassword) {
                $error = 'A nova senha e a confirmação não coincidem.';
            } else if ($pdo) {
                try {
                    $stmt = $pdo->prepare("SELECT password_hash FROM players WHERE id = :id");
                    $stmt->execute([':id' => $_SESSION['player_id']]);
                    $user = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($user && password_verify($oldPassword, $user['password_hash'])) {
                        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
                        $stmt = $pdo->prepare("UPDATE players SET password_hash = :hash WHERE id = :id");
                        $stmt->execute([':hash' => $newHash, ':id' => $_SESSION['player_id']]);
                        $success = 'Senha alterada com sucesso!';
                    } else {
                        $error = 'Senha antiga incorreta.';
                    }
                } catch (Exception $e) {
                    $error = 'Erro ao alterar senha: ' . $e->getMessage();
                }
            } else {
                $error = 'Banco de dados não disponível.';
            }
        }

        $matchesHtml = '';
        $bestMatchesHtml = '';
        if ($pdo) {
            try {
                // Query 1: Recent Matches (ordered by created_at DESC)
                $stmt = $pdo->prepare("
                    SELECT score, collapse_level, kills, deaths, survival_time_seconds, created_at,
                           build_color, build_floor1, build_floor2, build_floor3, build_floor4, build_floor5
                    FROM ranking 
                    WHERE LOWER(player_name) = LOWER(:name) 
                    ORDER BY created_at DESC 
                    LIMIT 10
                ");
                $stmt->execute([':name' => $player_name]);
                $rank = 1;
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rank % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    $minutes = floor($row['survival_time_seconds'] / 60);
                    $seconds = $row['survival_time_seconds'] % 60;
                    $timeStr = sprintf("%02d:%02d", $minutes, $seconds);
                    
                    // Build processing
                    $color = $row['build_color'] ?: 'red';
                    $f1 = (int)$row['build_floor1'];
                    $f2 = (int)$row['build_floor2'];
                    $f3 = (int)$row['build_floor3'];
                    $f4 = (int)$row['build_floor4'];
                    $f5 = (int)$row['build_floor5'];
                    
                    $passives = [
                        $GLOBAL_PASSIVES[$color][0][$f1] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][1][$f2] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][2][$f3] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][3][$f4] ?? 'Desconhecido',
                    ];
                    $ultimate = $GLOBAL_ULTIMATES[$color][$f5] ?? 'Sobrecarga Cósmica';
                    
                    $colorEmoji = ($color === 'red' ? '🔺' : ($color === 'green' ? '🟩' : ($color === 'poison' ? '☠️' : '🟣')));
                    $colorName = ($color === 'red' ? 'Vermelha' : ($color === 'green' ? 'Verde' : ($color === 'poison' ? 'Veneno' : 'Roxa')));
                    $colorHex = ($color === 'red' ? '#ff3333' : ($color === 'green' ? '#22c55e' : ($color === 'poison' ? '#10b981' : '#a855f7')));
                    
                    $buildTitle = "Passivas:\n• Andar 1: " . $passives[0] . "\n• Andar 2: " . $passives[1] . "\n• Andar 3: " . $passives[2] . "\n• Andar 4: " . $passives[3] . "\nUltimate:\n" . $ultimate;
                    
                    $buildSummaryHtml = '
                    <div style="font-weight:bold; color:' . $colorHex . '; cursor:help;" title="' . htmlspecialchars($buildTitle) . '">
                        ' . $colorEmoji . ' ' . $colorName . '
                    </div>
                    <div style="font-size:9px; color:#555; cursor:help;" title="' . htmlspecialchars($buildTitle) . '">
                        ' . htmlspecialchars($ultimate) . '
                    </div>';
                    
                    $matchesHtml .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td>' . htmlspecialchars($row['created_at']) . '</td>
                        <td>' . $row['score'] . '</td>
                        <td>' . $buildSummaryHtml . '</td>
                        <td>Andar ' . $row['collapse_level'] . '</td>
                        <td>' . $row['kills'] . '</td>
                        <td>' . $row['deaths'] . '</td>
                        <td>' . $timeStr . '</td>
                    </tr>';
                    $rank++;
                }
                if ($rank === 1) {
                    $matchesHtml = '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:#000;">Nenhuma partida registrada para esta conta. Entre no jogo e divirta-se!</td></tr>';
                }

                // Query 2: Best Matches (ordered by score DESC)
                $stmtBest = $pdo->prepare("
                    SELECT score, collapse_level, kills, deaths, survival_time_seconds, created_at,
                           build_color, build_floor1, build_floor2, build_floor3, build_floor4, build_floor5
                    FROM ranking 
                    WHERE LOWER(player_name) = LOWER(:name) 
                    ORDER BY score DESC 
                    LIMIT 10
                ");
                $stmtBest->execute([':name' => $player_name]);
                $rankBest = 1;
                while ($row = $stmtBest->fetch(PDO::FETCH_ASSOC)) {
                    $bgColor = ($rankBest % 2 == 0) ? '#D4C0A1' : '#F1E0C6';
                    $minutes = floor($row['survival_time_seconds'] / 60);
                    $seconds = $row['survival_time_seconds'] % 60;
                    $timeStr = sprintf("%02d:%02d", $minutes, $seconds);
                    
                    // Build processing
                    $color = $row['build_color'] ?: 'red';
                    $f1 = (int)$row['build_floor1'];
                    $f2 = (int)$row['build_floor2'];
                    $f3 = (int)$row['build_floor3'];
                    $f4 = (int)$row['build_floor4'];
                    $f5 = (int)$row['build_floor5'];
                    
                    $passives = [
                        $GLOBAL_PASSIVES[$color][0][$f1] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][1][$f2] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][2][$f3] ?? 'Desconhecido',
                        $GLOBAL_PASSIVES[$color][3][$f4] ?? 'Desconhecido',
                    ];
                    $ultimate = $GLOBAL_ULTIMATES[$color][$f5] ?? 'Sobrecarga Cósmica';
                    
                    $colorEmoji = ($color === 'red' ? '🔺' : ($color === 'green' ? '🟩' : ($color === 'poison' ? '☠️' : '🟣')));
                    $colorName = ($color === 'red' ? 'Vermelha' : ($color === 'green' ? 'Verde' : ($color === 'poison' ? 'Veneno' : 'Roxa')));
                    $colorHex = ($color === 'red' ? '#ff3333' : ($color === 'green' ? '#22c55e' : ($color === 'poison' ? '#10b981' : '#a855f7')));
                    
                    $buildTitle = "Passivas:\n• Andar 1: " . $passives[0] . "\n• Andar 2: " . $passives[1] . "\n• Andar 3: " . $passives[2] . "\n• Andar 4: " . $passives[3] . "\nUltimate:\n" . $ultimate;
                    
                    $buildSummaryHtml = '
                    <div style="font-weight:bold; color:' . $colorHex . '; cursor:help;" title="' . htmlspecialchars($buildTitle) . '">
                        ' . $colorEmoji . ' ' . $colorName . '
                    </div>
                    <div style="font-size:9px; color:#555; cursor:help;" title="' . htmlspecialchars($buildTitle) . '">
                        ' . htmlspecialchars($ultimate) . '
                    </div>';
                    
                    $bestMatchesHtml .= '
                    <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                        <td align="center"><strong>' . $rankBest . 'º</strong></td>
                        <td>' . date('d/m/Y H:i', strtotime($row['created_at'])) . '</td>
                        <td>' . $row['score'] . '</td>
                        <td>' . $buildSummaryHtml . '</td>
                        <td>Andar ' . $row['collapse_level'] . '</td>
                        <td>' . $row['kills'] . '</td>
                        <td>' . $row['deaths'] . '</td>
                        <td>' . $timeStr . '</td>
                    </tr>';
                    $rankBest++;
                }
                if ($rankBest === 1) {
                    $bestMatchesHtml = '<tr bgcolor="#F1E0C6"><td colspan="8" align="center" style="color:#000;">Nenhuma partida registrada para esta conta. Entre no jogo e divirta-se!</td></tr>';
                }
            } catch (Exception $e) {
                $matchesHtml = '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Erro: ' . $e->getMessage() . '</td></tr>';
                $bestMatchesHtml = '<tr bgcolor="#F1E0C6"><td colspan="8" align="center" style="color:red;">Erro: ' . $e->getMessage() . '</td></tr>';
            }
        }

        $content = '';
        if ($error) {
            $content .= '<div style="color:#FFF; background:#8b0000; border:1px solid red; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">⚠️ ' . htmlspecialchars($error) . '</div>';
        }
        if ($success) {
            $content .= '<div style="color:#000; background:#98fb98; border:1px solid green; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">✅ ' . htmlspecialchars($success) . '</div>';
        }

        $content .= '
        <div style="font-size:12px; margin-bottom:15px; color:#000;">Bem-vindo de volta, <strong>' . htmlspecialchars($player_name) . '</strong>! Veja abaixo os dados da sua conta e estatísticas das suas partidas.</div>
        
        <style>
        .account-tabs {
            display: flex;
            border-bottom: 2px solid #5A2800;
            margin-bottom: 15px;
            gap: 4px;
        }
        .account-tab-btn {
            background-color: #D4C0A1;
            color: #000;
            border: 1px solid #5A2800;
            border-bottom: none;
            padding: 6px 14px;
            font-weight: bold;
            cursor: pointer;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            font-size: 11px;
            font-family: Verdana, Arial, sans-serif;
            transition: all 0.2s;
        }
        .account-tab-btn:hover {
            background-color: #F1E0C6;
        }
        .account-tab-btn.active {
            background-color: #5A2800;
            color: #FFF;
        }
        .account-tab-content {
            display: none;
        }
        .account-tab-content.active {
            display: block;
        }
        </style>
        
        <script>
        function openAccountTab(evt, tabId) {
            var i, contents, tabs;
            contents = document.getElementsByClassName("account-tab-content");
            for (i = 0; i < contents.length; i++) {
                contents[i].style.display = "none";
            }
            tabs = document.getElementsByClassName("account-tab-btn");
            for (i = 0; i < tabs.length; i++) {
                tabs[i].classList.remove("active");
            }
            document.getElementById(tabId).style.display = "block";
            evt.currentTarget.classList.add("active");
        }
        </script>
        
        <div class="account-tabs">
            <button class="account-tab-btn active" onclick="openAccountTab(event, \'tab-general\')">Painel Geral</button>
            <button class="account-tab-btn" onclick="openAccountTab(event, \'tab-recent\')">Partidas Recentes</button>
            <button class="account-tab-btn" onclick="openAccountTab(event, \'tab-best\')">🏆 10 Melhores Partidas</button>
        </div>
        
        <!-- TAB GENERAL -->
        <div id="tab-general" class="account-tab-content" style="display: block;">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#D4C0A1">
                    <td colspan="2" style="color:#000; font-weight:bold;"><b>Informações do Usuário</b></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                    <td width="30%"><strong>Nome da Conta:</strong></td>
                    <td>' . htmlspecialchars($player_name) . '</td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                    <td><strong>Status:</strong></td>
                    <td><span style="color:green; font-weight:bold;">Conta Ativa</span></td>
                </tr>
            </table>
            <br/>

            <form method="post" action="?subtopic=account/manage">
                <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                    <tr bgcolor="#D4C0A1">
                        <td colspan="2" style="color:#000; font-weight:bold;"><b>Alterar Senha</b></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                        <td width="30%"><strong>Senha Antiga:</strong></td>
                        <td><input type="password" name="old_password" style="width:200px;" required /></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                        <td><strong>Nova Senha:</strong></td>
                        <td><input type="password" name="new_password" style="width:200px;" required /></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                        <td><strong>Confirmar Nova Senha:</strong></td>
                        <td><input type="password" name="confirm_password" style="width:200px;" required /></td>
                    </tr>
                </table>
                <br/>
                <center>
                    <button type="submit" name="change_password" style="background-color:#D4C0A1; color:#000; border:1px solid #505050; padding:5px 12px; font-weight:bold; cursor:pointer; font-size:11px; border-radius:2px;">Alterar Senha</button>
                </center>
            </form>
        </div>
        
        <!-- TAB RECENT -->
        <div id="tab-recent" class="account-tab-content" style="display: none;">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#D4C0A1">
                    <td colspan="7" style="color:#000; font-weight:bold;"><b>Registro de Partidas Recentes</b></td>
                </tr>
                <tr bgcolor="#505050">
                    <td style="color:white; font-weight:bold; font-size:11px;">Data</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Pontos</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Build Utilizada</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Andar Atingido</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Abates (Kills)</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Mortes</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Tempo de Sobrevivência</td>
                </tr>
                ' . $matchesHtml . '
            </table>
        </div>
        
        <!-- TAB BEST -->
        <div id="tab-best" class="account-tab-content" style="display: none;">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#D4C0A1">
                    <td colspan="8" style="color:#000; font-weight:bold;"><b>🏆 As 10 Melhores Partidas do Usuário</b></td>
                </tr>
                <tr bgcolor="#505050">
                    <td style="color:white; font-weight:bold; font-size:11px; text-align:center;">Posição</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Data</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Pontos</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Build Utilizada</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Andar Atingido</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Abates (Kills)</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Mortes</td>
                    <td style="color:white; font-weight:bold; font-size:11px;">Tempo de Sobrevivência</td>
                </tr>
                ' . $bestMatchesHtml . '
            </table>
        </div>
        
        <br/>
        <center>
            <a href="?subtopic=account/logout"><img src="templates/tibiacom/images/global/buttons/_sbutton_logout.gif" style="border:0;" /></a>
        </center>';
    } else {
        if ($error) {
            $content .= '<div style="color:#FFF; background:#8b0000; border:1px solid red; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">⚠️ ' . htmlspecialchars($error) . '</div>';
        }
        
        $content .= '
        <p style="font-size:11px; color:#000;">Por favor, informe suas credenciais de cadastro para acessar a conta.</p>
        <form method="post" action="?subtopic=account/manage">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#D4C0A1">
                    <td colspan="2" style="color:#000; font-weight:bold; font-size:12px;"><b>Acesso ao Painel</b></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                    <td width="35%"><strong>Nome do Usuário:</strong></td>
                    <td><input type="text" name="username" style="width:200px;" required /></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                    <td><strong>Senha:</strong></td>
                    <td><input type="password" name="password" style="width:200px;" required /></td>
                </tr>
            </table>
            <br/>
            <center>
                <input type="image" src="templates/tibiacom/images/global/buttons/_sbutton_submit.gif" style="border:0;" />
            </center>
        </form>';
    }
} else if ($subtopic === 'account/logout') {
    session_destroy();
    header('Location: ?subtopic=account/manage');
    exit;
} else if ($subtopic === 'downloads') {
    $title = "Como Jogar";
    $content = '
    <div class="Headline" style="font-weight:bold; font-size:14px; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; margin-bottom:10px;">Como Jogar Survival 3D</div>
    <div class="Text" style="font-size:11px; line-height:140%; color:#000;">
        <center style="margin: 15px 0; padding: 15px; border: 1px solid #5A2800; background: rgba(90, 40, 0, 0.1);">
            <strong style="font-size:14px;">NOVO: Aplicativo Desktop</strong><br/><br/>
            Baixe o nosso aplicativo oficial para ter uma experiência melhor, com janela dedicada e atualizações automáticas!<br/><br/>
            <a href="http://' . $hostOnly . '/downloads/Online_RPG_Setup_1.0.0.exe" download style="display:inline-block; padding:10px 20px; background:#1b4f72; color:#fff; text-decoration:none; border-radius:5px; font-weight:bold; border: 1px solid #154360;">
                ⬇️ Download do Instalador (.exe)
            </a>
        </center>
        <br/>
        O Survival 3D também roda inteiramente no seu navegador web de forma direta! Não há necessidade de realizar downloads pesados ou instalar programas adicionais. O jogo utiliza HTML5, WebGL (Three.js) e WebSockets.
        <br/><br/>
        <strong>Requisitos de Sistema:</strong>
        <ul>
            <li>Um navegador moderno (Google Chrome, Firefox, Microsoft Edge ou Safari).</li>
            <li>Placa de vídeo compatível com WebGL (padrão em computadores e celulares modernos).</li>
            <li>Conexão estável com a internet (para sincronização multiplayer).</li>
        </ul>
        <br/>
        <strong>Passo a Passo para Começar:</strong>
        <ol>
            <li><a href="?subtopic=account/create" style="color:#ff9900; font-weight:bold;">Crie uma conta gratuita</a> neste website.</li>
            <li>Acesse o link do servidor clicando no banner abaixo.</li>
            <li>Realize o login com a conta cadastrada.</li>
            <li>Escolha a cor da sua Torre de Essência favorita e configure as passivas.</li>
            <li>Escolha a fila de matchmaking (PC ou Celular) e inicie a partida!</li>
        </ol>
        <br/><br/>
        <center>
            <a href="http://' . $hostOnly . ':80/?v=' . time() . '" target="_blank" style="text-decoration:none;">
                <img src="templates/tibiacom/images/global/buttons/_sbutton_buynow.gif" alt="Jogar Agora" style="border:0; cursor:pointer;" /><br/>
                <span style="font-weight:bold; font-size:12px; color:#ff9900;">[ CLIQUE AQUI PARA ABRIR O JOGO ]</span>
            </a>
        </center>
    </div>';
} else if ($subtopic === 'monsters' || $subtopic === 'creatures' || $subtopic === 'bosses') {
    header('Location: ?subtopic=wiki&tab=bestiary');
    exit;
} else if ($subtopic === 'updates' || $subtopic === 'changelogs') {
    $title = "Notas de Atualização";
    $content = '<p style="font-size:11px; color:#000; margin-bottom:15px;">Fique por dentro de todos os buffs, nerfs, ajustes e correções que foram realizados no Survival 3D.</p>';
    
    $updates = [];
    if (file_exists('updates.json')) {
        $updates = json_decode(file_get_contents('updates.json'), true);
    }
    
    if (empty($updates)) {
        $content .= '<p style="color:#000; font-style:italic;">Nenhuma atualização registrada.</p>';
    } else {
        $updates = array_reverse($updates);
        foreach ($updates as $up) {
            $type = $up['type'] ?? 'Novidade';
            $target = $up['target'] ?? '';
            $desc = $up['description'] ?? '';
            $date = isset($up['date']) ? date('d/m/Y H:i', strtotime($up['date'])) : 'Recém-lançado';
            
            $badgeColor = '#505050';
            if ($type === 'Buff') $badgeColor = '#228b22';
            else if ($type === 'Nerf') $badgeColor = '#b22222';
            else if ($type === 'Correção') $badgeColor = '#0000ff';
            else if ($type === 'Ajuste') $badgeColor = '#d2691e';
            else if ($type === 'Novidade') $badgeColor = '#800080';
            
            $content .= '
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-bottom:15px;">
                <tr bgcolor="#D4C0A1">
                    <td style="color:#000; font-size:11px; font-weight:bold;">
                        <span style="background-color:' . $badgeColor . '; color:#FFF; padding:2px 6px; border-radius:3px; font-size:9px; margin-right:5px;">' . htmlspecialchars($type) . '</span>
                        ' . htmlspecialchars($target) . '
                        <span style="float:right; color:#555; font-size:10px; font-weight:normal;">' . $date . '</span>
                    </td>
                </tr>
                <tr bgcolor="#F1E0C6">
                    <td style="color:#000; font-size:11px; line-height:140%; padding:8px;">
                        ' . nl2br(htmlspecialchars($desc)) . '
                    </td>
                </tr>
            </table>';
        }
    }
} else if ($subtopic === 'updates/post') {
    $title = "Postar Atualização";
    $isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
    if (!$isAdmin) {
        header('Location: ?subtopic=news');
        exit;
    }
    $error = '';
    $success = '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST') { // input type="image" submits as name_x
        $type = $_POST['type'] ?? 'Novidade';
        $target = trim($_POST['target'] ?? '');
        $description = trim($_POST['description'] ?? '');

        if (empty($target) || empty($description)) {
            $error = 'Por favor, preencha todos os campos do formulário.';
        } else {
            $updatesPath = 'updates.json';
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
                'type' => $type,
                'target' => $target,
                'description' => $description
            ];

            $updates[] = $newUpdate;

            if (file_put_contents($updatesPath, json_encode($updates, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                $success = 'Atualização postada com sucesso! A nota já está ativa na web e no changelog in-game.';
            } else {
                $error = 'Falha ao salvar no arquivo updates.json. Verifique as permissões de gravação.';
            }
        }
    }

    if ($error) {
        $content .= '<div style="color:#FFF; background:#8b0000; border:1px solid red; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">⚠️ ' . htmlspecialchars($error) . '</div>';
    }
    if ($success) {
        $content .= '<div style="color:#000; background:#98fb98; border:1px solid green; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">✅ ' . htmlspecialchars($success) . '</div>';
    }

    $content .= '
    <p style="font-size:11px; color:#000; margin-bottom:15px;">Use este formulário para anunciar buffs, nerfs ou correções efetuadas. A atualização será compartilhada instantaneamente com o cliente do jogo.</p>
    <form method="post" action="?subtopic=updates/post">
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#D4C0A1">
                <td colspan="2" style="color:#000; font-weight:bold; font-size:12px;"><b>Publicar Nota de Atualização</b></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                <td width="30%"><strong>Tipo da Nota:</strong></td>
                <td>
                    <select name="type" style="width:200px;">
                        <option value="Novidade">Novidade (Anúncios gerais)</option>
                        <option value="Buff">Buff (Aumento de poder)</option>
                        <option value="Nerf">Nerf (Redução de poder)</option>
                        <option value="Ajuste">Ajuste (Rebalanceamentos)</option>
                        <option value="Correção">Correção (Ajustes de bugs)</option>
                    </select>
                </td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                <td><strong>Alvo / Tema:</strong></td>
                <td><input type="text" name="target" placeholder="ex: Boss Smith, Torre Roxa, Tempo de Recarga" style="width:300px;" required /></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
                <td><strong>Descrição da Nota:</strong></td>
                <td><textarea name="description" placeholder="Descreva os ajustes realizados..." style="width:95%; height:120px;" required></textarea></td>
            </tr>
        </table>
        <br/>
        <center>
            <input type="image" name="post_update" src="templates/tibiacom/images/global/buttons/_sbutton_submit.gif" style="border:0;" />
        </center>
    </form>';
} else if ($subtopic === 'admin/block') {
    $title = "Bloquear Usuários";
    $isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
    if (!$isAdmin) {
        header('Location: ?subtopic=news');
        exit;
    }

    $error = '';
    $success = '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
        $targetId = intval($_POST['target_id'] ?? 0);
        $action = $_POST['action'] ?? '';

        if ($targetId === intval($_SESSION['player_id'])) {
            $error = 'Você não pode alterar o status de bloqueio da sua própria conta.';
        } else if ($targetId > 0 && ($action === 'block' || $action === 'unblock')) {
            $isBlockedVal = ($action === 'block') ? 1 : 0;
            if ($pdo) {
                try {
                    $stmt = $pdo->prepare("UPDATE players SET is_blocked = :blocked WHERE id = :id");
                    $stmt->execute([':blocked' => $isBlockedVal, ':id' => $targetId]);
                    $success = 'O status do usuário foi atualizado com sucesso.';
                } catch (Exception $e) {
                    $error = 'Erro ao atualizar status: ' . $e->getMessage();
                }
            } else {
                $error = 'Banco de dados não disponível.';
            }
        } else {
            $error = 'Ação ou ID inválido.';
        }
    }

    // Fetch all players
    $playersHtml = '';
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT id, username, is_admin, is_blocked, created_at FROM players ORDER BY username ASC");
            $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $bgCounter = 0;
            foreach ($players as $p) {
                $bgColor = ($bgCounter++ % 2 === 0) ? '#F1E0C6' : '#D4C0A1';
                $isBlocked = pg_to_bool($p['is_blocked']);
                $isAdminRole = pg_to_bool($p['is_admin']);
                $statusText = $isBlocked ? '<span style="color:red; font-weight:bold;">Bloqueado</span>' : '<span style="color:green; font-weight:bold;">Ativo</span>';
                $roleText = $isAdminRole ? 'Administrador' : 'Jogador';
                $createdAt = isset($p['created_at']) ? date('d/m/Y H:i', strtotime($p['created_at'])) : '-';

                $actionHtml = '';
                if ($p['id'] == $_SESSION['player_id']) {
                    $actionHtml = '<span style="color:#777; font-style:italic;">Você</span>';
                } else {
                    $btnAction = $isBlocked ? 'unblock' : 'block';
                    $btnLabel = $isBlocked ? 'Desbloquear' : 'Bloquear';
                    $btnStyle = $isBlocked ? 'background-color:#4CAF50; color:white; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; border-radius:2px;' : 'background-color:#f44336; color:white; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; border-radius:2px;';
                    $confirmMsg = $isBlocked ? 'Tem certeza que deseja desbloquear este usuário?' : 'Tem certeza que deseja bloquear este usuário?';

                    $actionHtml = '
                    <form method="post" action="?subtopic=admin/block" style="margin:0; padding:0;" onsubmit="return confirm(\'' . $confirmMsg . '\');">
                        <input type="hidden" name="target_id" value="' . $p['id'] . '" />
                        <input type="hidden" name="action" value="' . $btnAction . '" />
                        <button type="submit" style="' . $btnStyle . '">' . $btnLabel . '</button>
                    </form>';
                }

                $playersHtml .= '
                <tr bgcolor="' . $bgColor . '" style="color:#000; font-size:11px;">
                    <td>' . $p['id'] . '</td>
                    <td><strong>' . htmlspecialchars($p['username']) . '</strong></td>
                    <td>' . $roleText . '</td>
                    <td>' . $statusText . '</td>
                    <td>' . $createdAt . '</td>
                    <td align="center">' . $actionHtml . '</td>
                </tr>';
            }
        } catch (Exception $e) {
            $playersHtml = '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Erro ao buscar usuários: ' . $e->getMessage() . '</td></tr>';
        }
    } else {
        $playersHtml = '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Banco de dados offline.</td></tr>';
    }

    $content = '';
    if ($error) {
        $content .= '<div style="color:#FFF; background:#8b0000; border:1px solid red; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">⚠️ ' . htmlspecialchars($error) . '</div>';
    }
    if ($success) {
        $content .= '<div style="color:#000; background:#98fb98; border:1px solid green; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">✅ ' . htmlspecialchars($success) . '</div>';
    }

    $content .= '
    <p style="font-size:11px; color:#000; margin-bottom:15px;">Gerencie o acesso dos jogadores ao jogo e ao website. Usuários bloqueados serão impedidos de efetuar login ou serão deslogados imediatamente se estiverem ativos.</p>
    <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
        <tr bgcolor="#D4C0A1">
            <td colspan="6" style="color:#000; font-weight:bold; font-size:12px;"><b>Painel de Moderação de Usuários</b></td>
        </tr>
        <tr bgcolor="#505050" style="color:white; font-weight:bold; font-size:11px;">
            <td width="5%">ID</td>
            <td width="30%">Nome do Usuário</td>
            <td width="20%">Cargo</td>
            <td width="15%">Status</td>
            <td width="15%">Criado em</td>
            <td width="15%" align="center">Ações</td>
        </tr>
        ' . $playersHtml . '
    </table>';
} else if ($subtopic === 'admin/item_images') {
    $title = "Imagens dos Itens";
    $isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
    if (!$isAdmin) {
        header('Location: ?subtopic=news');
        exit;
    }
    ob_start();
    require 'system/pages/admin_item_images.php';
    $content = ob_get_clean();
} else if ($subtopic === 'admin/weekly_awards') {
    $title = "Premiações Semanais";
    $isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
    if (!$isAdmin) {
        header('Location: ?subtopic=news');
        exit;
    }
    ob_start();
    require 'system/pages/admin_weekly_awards.php';
    $content = ob_get_clean();
} else if ($subtopic === 'admin/balance') {
    $title = "Balanceamento de Jogo";
    $isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
    if (!$isAdmin) {
        header('Location: ?subtopic=news');
        exit;
    }

    ob_start();
    require 'system/pages/admin_balance.php';
    $content = ob_get_clean();

    if (false) {
    $error = '';
    $success = '';

    $gameDataPath = 'game_data.json';
    if (!file_exists($gameDataPath)) {
        $error = 'Arquivo game_data.json não encontrado.';
        $gameData = [];
    } else {
        $gameData = json_decode(file_get_contents($gameDataPath), true);
        if (!$gameData) {
            $error = 'Erro ao decodificar game_data.json.';
            $gameData = [];
        }
    }

    $entity = $_GET['entity'] ?? 'Player';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($error)) {
        if ($entity === 'Player') {
            $gameData['player']['hp'] = intval($_POST['hp']);
            $gameData['player']['speed'] = floatval($_POST['speed']);
            $gameData['player']['attackCooldownMs'] = intval($_POST['attackCooldownMs']);
            $gameData['player']['defense'] = intval($_POST['defense'] ?? 100);
            $gameData['player']['projectileSpeed'] = floatval($_POST['projectileSpeed']);
            $gameData['player']['projectileLifetime'] = floatval($_POST['projectileLifetime']);
            $gameData['player']['hitboxRadius'] = floatval($_POST['hitboxRadius']);
            $gameData['player']['xpToFirstLevel'] = intval($_POST['xpToFirstLevel']);
            $gameData['player']['xpMultiplier'] = floatval($_POST['xpMultiplier']);
            $gameData['player']['levelHpMultiplier'] = floatval($_POST['levelHpMultiplier']);
            $gameData['player']['baseDamage'] = intval($_POST['baseDamage'] ?? 40);
            $gameData['player']['levelDamageMultiplier'] = floatval($_POST['levelDamageMultiplier'] ?? 2.0);
            $gameData['player']['critChance'] = floatval($_POST['critChance']) / 100.0;
            $gameData['player']['critDamageMultiplier'] = floatval($_POST['critDamageMultiplier'] ?? 2.0);
        } else {
            // Edit Enemy
            if (isset($gameData['enemies'][$entity])) {
                $gameData['enemies'][$entity]['name'] = $_POST['name'];
                $gameData['enemies'][$entity]['category'] = $_POST['category'];
                $gameData['enemies'][$entity]['stats']['hp'] = intval($_POST['hp']);
                $gameData['enemies'][$entity]['stats']['speed'] = floatval($_POST['speed']);
                $gameData['enemies'][$entity]['stats']['damage'] = intval($_POST['damage']);
                $gameData['enemies'][$entity]['stats']['defense'] = intval($_POST['defense'] ?? 0);
                $gameData['enemies'][$entity]['stats']['attackRange'] = floatval($_POST['attackRange']);
                $gameData['enemies'][$entity]['stats']['attackCooldown'] = intval($_POST['attackCooldown']);
                $gameData['enemies'][$entity]['stats']['hitboxRadius'] = floatval($_POST['hitboxRadius']);
                $gameData['enemies'][$entity]['stats']['xp'] = intval($_POST['xp']);
                $gameData['enemies'][$entity]['stats']['score'] = intval($_POST['score']);

                // Boss/Spawn fields
                if (isset($_POST['spawnTimer'])) {
                    if (!isset($gameData['enemies'][$entity]['spawn'])) $gameData['enemies'][$entity]['spawn'] = [];
                    $gameData['enemies'][$entity]['spawn']['timer'] = intval($_POST['spawnTimer']);
                    $gameData['enemies'][$entity]['spawn']['isBoss'] = isset($_POST['isBoss']);
                    $gameData['enemies'][$entity]['spawn']['isUnique'] = isset($_POST['isUnique']);
                }
                // AI fields
                if (isset($_POST['aggroRange'])) {
                    if (!isset($gameData['enemies'][$entity]['ai'])) $gameData['enemies'][$entity]['ai'] = ['profile' => 'chaser'];
                    $gameData['enemies'][$entity]['ai']['aggroRange'] = intval($_POST['aggroRange']);
                    if (isset($_POST['auraRadius'])) {
                        if (!isset($gameData['enemies'][$entity]['ai']['params'])) $gameData['enemies'][$entity]['ai']['params'] = [];
                        $gameData['enemies'][$entity]['ai']['params']['auraRadius'] = intval($_POST['auraRadius']);
                    }
                }
                // Visual fields
                if (isset($_POST['visualColor'])) {
                    if (!isset($gameData['enemies'][$entity]['visuals'])) $gameData['enemies'][$entity]['visuals'] = [];
                    $gameData['enemies'][$entity]['visuals']['color'] = $_POST['visualColor'];
                    $gameData['enemies'][$entity]['visuals']['scale'] = floatval($_POST['visualScale'] ?? 1);
                    if (!empty($_POST['visualEmissive'])) {
                        $gameData['enemies'][$entity]['visuals']['emissive'] = $_POST['visualEmissive'];
                    }
                }
            }
        }

        // Save to file
        if (file_put_contents($gameDataPath, json_encode($gameData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))) {
            $success = 'Alterações salvas com sucesso no arquivo JSON.';
            
            // Trigger Hot-Reload via cURL
            $ch = curl_init('http://app:3000/api/admin/reload-data');
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 3);
            $response = curl_exec($ch);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($response) {
                $resJson = json_decode($response, true);
                if ($resJson && isset($resJson['success']) && $resJson['success']) {
                    $success .= ' Servidor do jogo recarregado (Hot-Reload) com sucesso!';
                } else {
                    $error = 'Alterações salvas, mas o Hot-Reload do servidor falhou: ' . ($resJson['error'] ?? $response);
                }
            } else {
                $error = 'Alterações salvas, mas erro de conexão para Hot-Reload: ' . ($curlError ?: 'Servidor do jogo inacessível.');
            }
        } else {
            $error = 'Falha ao gravar no arquivo game_data.json.';
        }
    }

    $leftColumnHtml = '<table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">';
    $leftColumnHtml .= '<tr bgcolor="#D4C0A1"><td style="color:#000; font-weight:bold; font-size:11px;"><b>Entidades</b></td></tr>';
    
    // Player link
    $activeStyle = ($entity === 'Player') ? 'background-color:#FFF; font-weight:bold;' : '';
    $leftColumnHtml .= '<tr bgcolor="#F1E0C6" style="' . $activeStyle . '"><td><a href="?subtopic=admin/balance&entity=Player" style="color:#000; text-decoration:none; display:block; padding:4px;">🛡️ Jogador</a></td></tr>';
    
    // Enemies links
    if (isset($gameData['enemies'])) {
        foreach ($gameData['enemies'] as $key => $def) {
            $activeStyle = ($entity === $key) ? 'background-color:#FFF; font-weight:bold;' : '';
            $leftColumnHtml .= '<tr bgcolor="#F1E0C6" style="' . $activeStyle . '"><td><a href="?subtopic=admin/balance&entity=' . urlencode($key) . '" style="color:#000; text-decoration:none; display:block; padding:4px;">👾 ' . htmlspecialchars($def['name'] ?? $key) . '</a></td></tr>';
        }
    }
    $leftColumnHtml .= '</table>';

    $rightColumnHtml = '';
    if ($entity === 'Player') {
        $pStats = $gameData['player'] ?? [];
        $defenseVal = isset($pStats['defense']) ? intval($pStats['defense']) : 100;
        $rightColumnHtml = '
        <form method="post" action="?subtopic=admin/balance&entity=Player">
            <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                <tr bgcolor="#D4C0A1">
                    <td colspan="2" style="color:#000; font-weight:bold; font-size:11px;"><b>Editar Stats do Jogador</b></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000;">
                    <td width="40%"><b>HP Base:</b></td>
                    <td><input type="number" name="hp" value="' . intval($pStats['hp'] ?? 100) . '" style="width:90%;" required /></td>
                </tr>
                <tr bgcolor="#D4C0A1" style="color:#000;">
                    <td><b>Velocidade Base:</b></td>
                    <td><input type="number" step="0.1" name="speed" value="' . floatval($pStats['speed'] ?? 5) . '" style="width:90%;" required /></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000;">
                    <td><b>Cooldown de Ataque (ms):</b></td>
                    <td><input type="number" name="attackCooldownMs" value="' . intval($pStats['attackCooldownMs'] ?? 500) . '" style="width:90%;" required /></td>
                </tr>
                <tr bgcolor="#D4C0A1" style="color:#000;">
                    <td><b>Defesa Base (Pontos):</b></td>
                    <td><input type="number" name="defense" value="' . $defenseVal . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Padrão: 100)</span></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000;">
                    <td><b>Velocidade do Projétil:</b></td>
                    <td><input type="number" step="0.1" name="projectileSpeed" value="' . floatval($pStats['projectileSpeed'] ?? 15) . '" style="width:90%;" required /></td>
                </tr>
                <tr bgcolor="#D4C0A1" style="color:#000;">
                    <td><b>Tempo Vida Projétil (s):</b></td>
                    <td><input type="number" step="0.1" name="projectileLifetime" value="' . floatval($pStats['projectileLifetime'] ?? 3) . '" style="width:90%;" required /></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000;">
                    <td><b>Raio da Hitbox:</b></td>
                    <td><input type="number" step="0.01" name="hitboxRadius" value="' . floatval($pStats['hitboxRadius'] ?? 0.5) . '" style="width:90%;" required /></td>
                </tr>
                <tr bgcolor="#D4C0A1" style="color:#000;">
                    <td><b>XP para Level 2 (Primeiro Level):</b></td>
                    <td><input type="number" name="xpToFirstLevel" value="' . intval($pStats['xpToFirstLevel'] ?? 10) . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Aumentar dificulta o Up inicial)</span></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000;">
                    <td><b>Multiplicador de XP por Level (xp/lv):</b></td>
                    <td><input type="number" step="0.1" name="xpMultiplier" value="' . floatval($pStats['xpMultiplier'] ?? 1.8) . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Aumentar dificulta o Up; diminuir facilita. Ex: 1.8 = +80% XP por nível)</span></td>
                </tr>
                <tr bgcolor="#D4C0A1" style="color:#000;">
                    <td><b>Multiplicador de HP por Level (hp/lv):</b></td>
                    <td><input type="number" step="0.1" name="levelHpMultiplier" value="' . floatval($pStats['levelHpMultiplier'] ?? 1.5) . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Ex: 1.3 = +30% HP por nível)</span></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000;">
                    <td><b>Ataque Base (Dano):</b></td>
                    <td><input type="number" name="baseDamage" value="' . intval($pStats['baseDamage'] ?? 40) . '" style="width:90%;" required /></td>
                </tr>
                <tr bgcolor="#D4C0A1" style="color:#000;">
                    <td><b>Multiplicador de Ataque por Level (atq/lv):</b></td>
                    <td><input type="number" step="0.1" name="levelDamageMultiplier" value="' . floatval($pStats['levelDamageMultiplier'] ?? 2.0) . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Ex: 2.0 = dobra o dano a cada nível base)</span></td>
                </tr>
                <tr bgcolor="#F1E0C6" style="color:#000;">
                    <td><b>Chance de Crítico Base (%):</b></td>
                    <td><input type="number" step="0.1" name="critChance" value="' . floatval(($pStats['critChance'] ?? 0.05) * 100) . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Ex: 5 = 5% de chance base de crítico)</span></td>
                </tr>
                <tr bgcolor="#D4C0A1" style="color:#000;">
                    <td><b>Multiplicador de Dano Crítico:</b></td>
                    <td><input type="number" step="0.1" name="critDamageMultiplier" value="' . floatval($pStats['critDamageMultiplier'] ?? 2.0) . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Ex: 2.0 = 200% de dano normal)</span></td>
                </tr>
            </table>
            <br/>
            <center>
                <input type="submit" value="Salvar Alterações" style="font-weight:bold; padding:5px 15px; cursor:pointer;" />
            </center>
        </form>';
    } else {
        if (isset($gameData['enemies'][$entity])) {
            $enemyDef = $gameData['enemies'][$entity];
            $eStats = $enemyDef['stats'] ?? [];
            $defenseVal = isset($eStats['defense']) ? intval($eStats['defense']) : 0;
            $rightColumnHtml = '
            <form method="post" action="?subtopic=admin/balance&entity=' . urlencode($entity) . '">
                <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
                    <tr bgcolor="#D4C0A1">
                        <td colspan="2" style="color:#000; font-weight:bold; font-size:11px;"><b>Editar Inimigo: ' . htmlspecialchars($enemyDef['name'] ?? $entity) . '</b></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td width="40%"><b>Nome:</b></td>
                        <td><input type="text" name="name" value="' . htmlspecialchars($enemyDef['name'] ?? '') . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>Categoria:</b></td>
                        <td>
                            <select name="category" style="width:92%;">
                                <option value="basic"' . (($enemyDef['category'] ?? '') === 'basic' ? ' selected' : '') . '>Basic (Básico)</option>
                                <option value="boss"' . (($enemyDef['category'] ?? '') === 'boss' ? ' selected' : '') . '>Boss (Chefe)</option>
                                <option value="structure"' . (($enemyDef['category'] ?? '') === 'structure' ? ' selected' : '') . '>Structure (Estrutura)</option>
                                <option value="defender"' . (($enemyDef['category'] ?? '') === 'defender' ? ' selected' : '') . '>Defender (Defensor)</option>
                                <option value="minion"' . (($enemyDef['category'] ?? '') === 'minion' ? ' selected' : '') . '>Minion (Lacaio)</option>
                            </select>
                        </td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>HP Base:</b></td>
                        <td><input type="number" name="hp" value="' . intval($eStats['hp'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>Velocidade:</b></td>
                        <td><input type="number" step="0.1" name="speed" value="' . floatval($eStats['speed'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>Dano Base:</b></td>
                        <td><input type="number" name="damage" value="' . intval($eStats['damage'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>Defesa (Pontos):</b></td>
                        <td><input type="number" name="defense" value="' . $defenseVal . '" style="width:90%;" required /> <span style="font-size:9px; color:#555;">(Limite: 500 = 40% mit.)</span></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>Alcance de Ataque:</b></td>
                        <td><input type="number" step="0.1" name="attackRange" value="' . floatval($eStats['attackRange'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>Cooldown de Ataque (ms):</b></td>
                        <td><input type="number" name="attackCooldown" value="' . intval($eStats['attackCooldown'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>Raio da Hitbox:</b></td>
                        <td><input type="number" step="0.01" name="hitboxRadius" value="' . floatval($eStats['hitboxRadius'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>XP Concedida:</b></td>
                        <td><input type="number" name="xp" value="' . intval($eStats['xp'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>Score Concedido:</b></td>
                        <td><input type="number" name="score" value="' . intval($eStats['score'] ?? 0) . '" style="width:90%;" required /></td>
                    </tr>
                </table>

                <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-top:10px;">
                    <tr bgcolor="#D4C0A1">
                        <td colspan="2" style="color:#000; font-weight:bold; font-size:11px;"><b>⚔️ Spawn & AI</b></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td width="40%"><b>Tempo de Spawn (seg):</b></td>
                        <td><input type="number" name="spawnTimer" value="' . intval($enemyDef['spawn']['timer'] ?? 0) . '" style="width:90%;" /> <span style="font-size:9px; color:#555;">(0 = spawn padrão por wave)</span></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>É Boss:</b></td>
                        <td><input type="checkbox" name="isBoss" value="1"' . (!empty($enemyDef['spawn']['isBoss']) ? ' checked' : '') . ' /> <span style="font-size:9px; color:#555;">(Aparece como boss especial)</span></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>É Único:</b></td>
                        <td><input type="checkbox" name="isUnique" value="1"' . (!empty($enemyDef['spawn']['isUnique']) ? ' checked' : '') . ' /> <span style="font-size:9px; color:#555;">(Apenas 1 por partida)</span></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>Raio de Aggro:</b></td>
                        <td><input type="number" name="aggroRange" value="' . intval($enemyDef['ai']['aggroRange'] ?? 20) . '" style="width:90%;" /></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>Raio da Aura:</b></td>
                        <td><input type="number" name="auraRadius" value="' . intval($enemyDef['ai']['params']['auraRadius'] ?? 0) . '" style="width:90%;" /> <span style="font-size:9px; color:#555;">(0 = sem aura)</span></td>
                    </tr>
                </table>

                <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-top:10px;">
                    <tr bgcolor="#D4C0A1">
                        <td colspan="2" style="color:#000; font-weight:bold; font-size:11px;"><b>🎨 Visual</b></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td width="40%"><b>Cor Principal:</b></td>
                        <td><input type="color" name="visualColor" value="' . htmlspecialchars($enemyDef['visuals']['color'] ?? '#FF0000') . '" style="width:50px; height:25px; cursor:pointer;" /> <span style="font-size:9px; color:#555;">' . htmlspecialchars($enemyDef['visuals']['color'] ?? '#FF0000') . '</span></td>
                    </tr>
                    <tr bgcolor="#D4C0A1" style="color:#000;">
                        <td><b>Escala (Tamanho):</b></td>
                        <td><input type="number" step="0.1" name="visualScale" value="' . floatval($enemyDef['visuals']['scale'] ?? 1) . '" style="width:90%;" /></td>
                    </tr>
                    <tr bgcolor="#F1E0C6" style="color:#000;">
                        <td><b>Cor Emissiva (Glow):</b></td>
                        <td><input type="color" name="visualEmissive" value="' . htmlspecialchars($enemyDef['visuals']['emissive'] ?? '#000000') . '" style="width:50px; height:25px; cursor:pointer;" /> <span style="font-size:9px; color:#555;">' . htmlspecialchars($enemyDef['visuals']['emissive'] ?? '#000000') . '</span></td>
                    </tr>
                </table>

                <br/>
                <center>
                    <input type="submit" value="Salvar Alterações" style="font-weight:bold; padding:5px 15px; cursor:pointer;" />
                </center>
            </form>';
        } else {
            $rightColumnHtml = '<div style="color:red; font-weight:bold;">Inimigo não encontrado.</div>';
        }
    }

    $content = '';
    if ($error) {
        $content .= '<div style="color:#FFF; background:#8b0000; border:1px solid red; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">⚠️ ' . htmlspecialchars($error) . '</div>';
    }
    if ($success) {
        $content .= '<div style="color:#000; background:#98fb98; border:1px solid green; padding:8px; margin-bottom:15px; font-weight:bold; font-size:11px;">✅ ' . htmlspecialchars($success) . '</div>';
    }

    $content .= '
    <p style="font-size:11px; color:#000; margin-bottom:15px;">
        Ajuste os parâmetros de balanceamento de dano, defesa e atributos base para o Jogador e todos os Inimigos do jogo. 
        Ao salvar, o arquivo <code>game_data.json</code> será atualizado e um comando de <strong>Hot-Reload</strong> será enviado ao servidor para aplicar as alterações em tempo real.
    </p>
    <table border="0" cellpadding="0" cellspacing="10" width="100%">
        <tr valign="top">
            <td width="30%">
                ' . $leftColumnHtml . '
            </td>
            <td width="70%">
                ' . $rightColumnHtml . '
            </td>
        </tr>
    </table>';
    }
} else if ($subtopic === 'wiki') {
    $title = "Biblioteca Wiki";
    $activeTab = $_GET['tab'] ?? 'hero';
    
    // Read game_data.json to populate the bestiary dynamically
    $enemies = [];
    if (file_exists('game_data.json')) {
        $gameData = json_decode(file_get_contents('game_data.json'), true);
        $enemies = $gameData['enemies'] ?? [];
    }

    // Read custom item names & images mappings
    $names_mapping = [];
    if (file_exists('item_names.json')) {
        $names_mapping = json_decode(file_get_contents('item_names.json'), true) ?: [];
    }
    $images_mapping = [];
    if (file_exists('item_images.json')) {
        $images_mapping = json_decode(file_get_contents('item_images.json'), true) ?: [];
    }
    $wikiDropRates = ['basic' => 18.0, 'epic' => 1.5, 'legendary' => 0.5];
    if (file_exists('item_drop_rates.json')) {
        $ratesJson = json_decode(file_get_contents('item_drop_rates.json'), true);
        if (is_array($ratesJson) && isset($ratesJson['basic']) && isset($ratesJson['epic']) && isset($ratesJson['legendary'])) {
            $wikiDropRates = $ratesJson;
        }
    }
    
    // Detail mapping for bestiary
    $bestiaryDetails = [
        'PurpleCube' => [
            'name' => 'Cubo Roxo',
            'difficulty' => 'E',
            'shape' => 'box',
            'lore' => 'A unidade básica da infestação geométrica. Move-se de forma errática em direção ao jogador e ataca à curta distância.',
            'skills' => []
        ],
        'EscaravelhoFarao' => [
            'name' => 'Escaravelho Sagrado',
            'difficulty' => 'D',
            'shape' => 'sphere',
            'lore' => 'Insetos sagrados despertados pela presença invasora na tumba. Eles atacam em enxames rápidos e implacáveis.',
            'skills' => [
                ['name' => 'Investida Rápida (Passiva)', 'type' => 'passive', 'desc' => 'Persegue o jogador com extrema velocidade (8.0 u/s) e ataque feroz de contato.']
            ]
        ],
        'RedCone' => [
            'name' => 'Cone Vermelho',
            'difficulty' => 'D',
            'shape' => 'cone',
            'lore' => 'Uma sentinela defensiva imóvel de alta resistência que dispara projéteis lineares rápidos em qualquer um em sua linha de visão.',
            'skills' => []
        ],
        'EnemyTower' => [
            'name' => 'Torre Inimiga',
            'difficulty' => 'D',
            'shape' => 'cylinder',
            'lore' => 'Estruturas cilíndricas que disparam feixes defensivos de longo alcance para afastar os jogadores de áreas seguras.',
            'skills' => []
        ],
        'GuardianGuerreiro' => [
            'name' => 'Guardião Guerreiro',
            'difficulty' => 'C',
            'shape' => 'box',
            'lore' => 'Um soldado de infantaria pesado de cor vermelha escura que usa escudo de energia para atordoar invasores.',
            'skills' => [
                ['name' => 'Golpe Impactante (Passiva)', 'type' => 'passive', 'desc' => 'Desfere um golpe de contato que atordoa o jogador afetado por 1.0s (100% de chance).']
            ]
        ],
        'GuardianMago' => [
            'name' => 'Guardião Mago',
            'difficulty' => 'C',
            'shape' => 'octahedron',
            'lore' => 'Um canalizador octaédrico de cor azul escura que ataca a longas distâncias usando magias de congelamento.',
            'skills' => [
                ['name' => 'Estase de Gelo (Passiva)', 'type' => 'passive', 'desc' => 'Ataques mágicos aplicam congelamento de 2 segundos ao impacto.']
            ]
        ],
        'GuardianArqueiro' => [
            'name' => 'Guardião Arqueiro',
            'difficulty' => 'C',
            'shape' => 'cone',
            'lore' => 'Um batedor cônico verde escuro extremamente veloz. Ele tenta manter distância segura do jogador e disparar flechas de precisão.',
            'skills' => [
                ['name' => 'Disparo de Retirada (Passiva)', 'type' => 'passive', 'desc' => 'Corra para trás se o jogador se aproximar a menos de 6 metros.']
            ]
        ],
        'MatilhaGeometra' => [
            'name' => 'Lobo Geométrico',
            'difficulty' => 'D',
            'shape' => 'box',
            'lore' => 'Crias velozes criadas pelas chamas do Cão dos Infernos. Caçam em conjunto e atacam em bandos coordenados.',
            'skills' => []
        ],
        'CloneIlusorio' => [
            'name' => 'Clone Ilusório',
            'difficulty' => 'E',
            'shape' => 'tetrahedron',
            'lore' => 'Cópias falsas geradas para enganar os desafiantes. Embora tenham apenas 1 HP, seu toque desorienta completamente o herói.',
            'skills' => [
                ['name' => 'Toque Desorientador (Passiva)', 'type' => 'passive', 'desc' => 'Causa desorientação por 1 segundo ao tocar o jogador.']
            ]
        ],
        'BruxaDoGelo' => [
            'name' => 'Bruxa do Gelo',
            'difficulty' => 'C',
            'shape' => 'sphere',
            'lore' => 'Uma feiticeira congelante que desacelera e congela jogadores à distância.',
            'skills' => [
                ['name' => 'Crio-toque (Passiva)', 'type' => 'passive', 'desc' => 'Habilidades e ataques mágicos aplicam congelamento de 2.0s.']
            ]
        ],
        'MestraDaIlusao' => [
            'name' => 'Mestra da Ilusão',
            'difficulty' => 'B',
            'shape' => 'tetrahedron',
            'lore' => 'Uma ladra de mentes que esquiva de golpes com facilidade.',
            'skills' => [
                ['name' => 'Esquiva Ilusória (Passiva)', 'type' => 'passive', 'desc' => 'Garante 25% de chance de esquivar de qualquer dano.']
            ]
        ],
        'BombardeiroInsano' => [
            'name' => 'Bombardeiro Insano',
            'difficulty' => 'B',
            'shape' => 'bombardeiro',
            'lore' => 'O Guardião da Pirâmide Vermelha. Composto de prismas e pirâmides flutuantes com uma cabeça tetraédrica de brilho vermelho pulsante. Utiliza táticas implacáveis de bombardeio com física avançada de repuxo (knockback). Todo o dano causado por suas habilidades é estritamente físico.',
            'skills' => [
                ['name' => 'Bomba Saltitante (Ativa - Q)', 'type' => 'active', 'desc' => 'Lança uma bomba preditiva que salta 2 vezes em direção ao alvo, explodindo ao impacto e causando 1.5x o dano físico básico.'],
                ['name' => 'Carga Concentrada (Ativa - W)', 'type' => 'active', 'desc' => 'Lança uma carga explosiva na meia distância caso o jogador chegue muito perto. Explode após 1.5s, empurrando o jogador e o próprio boss para longe da explosão e causando 0.5x o dano físico.'],
                ['name' => 'Campo Minado Hexplosivo (Ativa - E)', 'type' => 'active', 'desc' => 'Espalha preditivamente um campo com 8 minas terrestres duradouras (20s) na trajetória do jogador. Cada mina causa 1.2x o dano ao contato.'],
                ['name' => 'Mega Bomba Infernal (Ativa - R)', 'type' => 'active', 'desc' => 'Cria uma imensa zona de perigo sob a posição do alvo que detona após 3.5s, descarregando 4.0x o dano básico em uma área de efeito massiva com 12 metros de raio.']
            ]
        ],
        'GuardiaoDoLimbo' => [
            'name' => 'Guardião do Limbo',
            'difficulty' => 'C',
            'shape' => 'cylinder',
            'lore' => 'Sentinela primordial das profundezas. Move-se quase imperceptivelmente lento, mas seus golpes reduzem a velocidade do herói.',
            'skills' => [
                ['name' => 'Toque do Limbo (Passiva)', 'type' => 'passive', 'desc' => 'Lentidão de 15% por 3 segundos em ataques básicos.']
            ]
        ],
        'Minos' => [
            'name' => 'Minos, o Árbitro',
            'difficulty' => 'B',
            'shape' => 'box',
            'lore' => 'O juiz das almas perdidas no limbo. Pune intrusos com ataques massivos à distância.',
            'skills' => []
        ],
        'Cerbero' => [
            'name' => 'Cérbero Geométrico',
            'difficulty' => 'B',
            'shape' => 'cao',
            'lore' => 'A fera tricefálica do submundo digital. Suas mordidas regeneram sua vida.',
            'skills' => [
                ['name' => 'Sede Vampírica (Passiva)', 'type' => 'passive', 'desc' => 'Regenera 5% do dano físico causado como vida.']
            ]
        ],
        'Plutao' => [
            'name' => 'Plutão, o Dourado',
            'difficulty' => 'B',
            'shape' => 'sphere',
            'lore' => 'Uma entidade divina dourada do limbo que canaliza orbes estelares de energia de alta precisão.',
            'skills' => []
        ],
        'Furia' => [
            'name' => 'Fúria, o Furioso',
            'difficulty' => 'B',
            'shape' => 'octahedron',
            'lore' => 'A encarnação geométrica de pura raiva concentrada. Move-se rápido e ataca impiedosamente.',
            'skills' => []
        ],
        'Megera' => [
            'name' => 'Megera das Chamas',
            'difficulty' => 'A',
            'shape' => 'cone',
            'lore' => 'Uma bruxa de fogo elemental imune a efeitos de controle.',
            'skills' => [
                ['name' => 'Mente Inflexível (Passiva)', 'type' => 'passive', 'desc' => 'Imunidade total a qualquer efeito de controle de grupo (CC).']
            ]
        ],
        'Minotauro' => [
            'name' => 'Minotauro de Sangue',
            'difficulty' => 'B',
            'shape' => 'box',
            'lore' => 'Besta feroz sedenta por batalhas prolongadas na arena.',
            'skills' => [
                ['name' => 'Frenesi Vampírico (Passiva)', 'type' => 'passive', 'desc' => 'Regenera 5% do dano causado como vida.']
            ]
        ],
        'Geriao' => [
            'name' => 'Gerião, a Ilusão',
            'difficulty' => 'A',
            'shape' => 'tetrahedron',
            'lore' => 'Espírito que dobra as dimensões espaciais para evadir ameaças.',
            'skills' => [
                ['name' => 'Distorção de Desvio (Passiva)', 'type' => 'passive', 'desc' => 'Garante 20% de chance de esquivar de qualquer ataque.']
            ]
        ],
        'EspectroDeRaziel' => [
            'name' => 'Espectro de Raziel',
            'difficulty' => 'A',
            'shape' => 'sphere',
            'lore' => 'Espírito guerreiro ancestral. Suas lâminas perfuram a defesa do herói, tirando uma parcela da sua força vital.',
            'skills' => [
                ['name' => 'Ataque Vampírico (Passiva)', 'type' => 'passive', 'desc' => 'Ataques causam dano real de 5% da vida máxima do herói.']
            ]
        ],
        'Smith' => [
            'name' => 'Agent Smith',
            'difficulty' => 'S',
            'shape' => 'smith',
            'lore' => 'Uma anomalia de sistema na forma de uma inteligência artificial autogerida e altamente invasiva. Ele se replica continuamente, infectando e substituindo dados na matriz de simulação para sobrecarregar a memória dos desafiantes.',
            'skills' => [
                ['name' => 'Sobrescrita Global (Ativa)', 'type' => 'active', 'desc' => 'Inicia ciclos de multiplicação, criando clones exatos de si mesmo que perseguem o jogador.'],
                ['name' => 'Contaminação Metódica (Passiva)', 'type' => 'passive', 'desc' => 'Cada golpe desferido por seus clones rouba 1% da experiência (XP) do jogador, impedindo sua progressão.'],
                ['name' => 'Protocolo de Resiliência (Passiva)', 'type' => 'passive', 'desc' => 'Cada clone ativo em batalha aumenta o dano bruto do Agent Smith original em 2% de forma cumulativa.'],
                ['name' => 'Salto de Protocolo (Ativa)', 'type' => 'active', 'desc' => 'Teleporta-se em distâncias de até 15 metros se for cercado ou receber muito dano concentrado.'],
                ['name' => 'Tela Azul de Erro (Passiva)', 'type' => 'passive', 'desc' => 'Ao ser eliminado, aciona um dump de tela azul no visor que simula travamento do sistema por alguns segundos.']
            ]
        ],
        'CaoDosInfernos' => [
            'name' => 'Cão dos Infernos',
            'difficulty' => 'A',
            'shape' => 'cao',
            'lore' => 'Um predador implacável forjado na essência das chamas cúbicas. Ele lidera uma matilha assassina e caça ativamente o jogador com velocidade formidável, tirando proveito de efeitos de sangramento e ataques velozes em área.',
            'skills' => [
                ['name' => 'Matilha Geométrica (Passiva)', 'type' => 'passive', 'desc' => 'Invoca e mantém até 4 lobos menores que auxiliam nos ataques físicos.'],
                ['name' => 'Investida Implacável (Ativa)', 'type' => 'active', 'desc' => 'Mira por 1s e realiza uma investida rápida a velocidade 25, causando 50 de dano e atordoando por 0.5s quem estiver no caminho.'],
                ['name' => 'Prismas Sombrios (Ativa)', 'type' => 'active', 'desc' => 'Morde o alvo aplicando sangramento de 10 de dano por segundo por 4s e curando o Cão em 15% do dano causado.'],
                ['name' => 'Evisceração Cúbica (Ativa)', 'type' => 'active', 'desc' => 'Causa 40 de dano em área (raio 6m) e regenera a vida de toda a matilha aliada próxima.'],
                ['name' => 'Chamado do Abismo (Ativa)', 'type' => 'active', 'desc' => 'Entra em frenesi por 15s: aumenta 1.2x de tamanho, duplica sua velocidade, ganha um escudo de 2000 HP e invoca a matilha máxima.']
            ]
        ],
        'SuperBoss' => [
            'name' => 'Super Boss',
            'difficulty' => 'B',
            'shape' => 'sphere',
            'lore' => 'Uma anomalia esférica violeta gigante que atrai gravitacionalmente os jogadores para perto, drenando suas vidas.',
            'skills' => [
                ['name' => 'Sucção de Matéria (Passiva)', 'type' => 'passive', 'desc' => 'Atrai jogadores em um raio de 8 metros com força gravitacional contínua.']
            ]
        ],
        'RainhaDasTrevas' => [
            'name' => 'Rainha das Trevas',
            'difficulty' => 'S',
            'shape' => 'cylinder',
            'lore' => 'A soberana da escuridão absoluta. Ela flutua a altas velocidades cortando a luz da arena com seu corpo cilíndrico de energia escura.',
            'skills' => []
        ],
        'Gangplank' => [
            'name' => 'Gangplank',
            'difficulty' => 'A',
            'shape' => 'box',
            'lore' => 'O flagelo dos mares cúbicos. Ele possui alta defesa natural de 10% e dispara barris de pólvora explosivos que causam enorme dano em área.',
            'skills' => [
                ['name' => 'Barril de Pólvora (Ativa)', 'type' => 'active', 'desc' => 'Coloca barris explosivos na arena que explodem em cadeia se forem atingidos.'],
                ['name' => 'Determinação Ferrosa (Passiva)', 'type' => 'passive', 'desc' => 'Reduz todo dano recebido em 10% através de sua blindagem natural.']
            ]
        ],
        'PlantaCarnivora' => [
            'name' => 'Planta Carnívora Rainha',
            'difficulty' => 'B',
            'shape' => 'cylinder',
            'lore' => 'Um organismo vegetal hostil gigante. Embora estática, sua mordida causa danos enormes a curta distância com veneno poderoso.',
            'skills' => [
                ['name' => 'Cuspe Ácido (Passiva)', 'type' => 'passive', 'desc' => 'Seus projéteis causam 8 de dano por segundo de veneno durante 3 segundos.']
            ]
        ],
        'FeiticeiroImortal' => [
            'name' => 'Lord Vouldemord',
            'difficulty' => 'A',
            'shape' => 'sphere',
            'lore' => 'Um mestre das artes sombrias que transcendeu a morte física através de rituais proibidos. Ele flutua como uma esfera índigo.',
            'skills' => []
        ],
        'LichKing' => [
            'name' => 'Lich King',
            'difficulty' => 'S',
            'shape' => 'box',
            'lore' => 'O soberano da morte and do gelo. Ele caminha de forma lenta, mas gera uma aura de congelamento mortal de 4m ao seu redor que pune jogadores desavisados.',
            'skills' => [
                ['name' => 'Geada do Necro (Passiva)', 'type' => 'passive', 'desc' => 'Desacelera em 30% a velocidade de qualquer jogador dentro da aura de 4m (1.5s de duração).']
            ]
        ],
        'TheMightyOne' => [
            'name' => 'O Poderoso',
            'difficulty' => 'S',
            'shape' => 'box',
            'lore' => 'Um colosso maciço de granito escuro que se move a passos lentos, mas exerce uma força gravitacional gigantesca na arena, puxando todos os oponentes para si.',
            'skills' => [
                ['name' => 'Aura Gravitacional (Passiva)', 'type' => 'passive', 'desc' => 'Exerce uma força de atração em uma área de 25m, puxando jogadores para perto de seu corpo massivo.'],
                ['name' => 'Esmagamento Cúbico (Ativa)', 'type' => 'active', 'desc' => 'Descarrega um golpe de 100 de dano instantâneo na área de sua hitbox colossal de 4 metros.']
            ]
        ],
        'Lucifer' => [
            'name' => 'Lúcifer Cósmico',
            'difficulty' => 'S',
            'shape' => 'icosahedron',
            'lore' => 'O portador da luz das estrelas decaído. Ataca a distâncias extremas de 50 metros com lentidão gélida de 90%.',
            'skills' => [
                ['name' => 'Grito da Estrela Caída (Passiva)', 'type' => 'passive', 'desc' => 'Ataques de longa distância causam slow extremo de 90% por um longo período.']
            ]
        ],
        'Farao' => [
            'name' => 'O Faraó',
            'difficulty' => 'SS',
            'shape' => 'farao',
            'lore' => 'A entidade suprema e governante das areias do Limbo. O Faraó flutua silenciosamente na arena e se move apenas por teletransporte, canalizando as forças cósmicas e antigas pragas para expurgar quem ousar entrar em sua tumba.',
            'skills' => [
                ['name' => 'Divindade Intocável (Passiva)', 'type' => 'passive', 'desc' => 'Imunidade total contra qualquer tipo de lentidão, enraizamento, sangramento, silenciamento ou debuff.'],
                ['name' => 'Maldição Dourada (Passiva)', 'type' => 'passive', 'desc' => 'Reflete 10% de todo dano recebido diretamente de volta para o atacante.'],
                ['name' => 'Areias do Tempo (Passiva)', 'type' => 'passive', 'desc' => 'Jogadores que ficam parados acumulam lentidão de 1% por segundo (limite de 70% slow). Voltar a se mover limpa o acúmulo.'],
                ['name' => 'Escaravelhos da Tumba (Passiva)', 'type' => 'passive', 'desc' => 'A cada 12 segundos, invoca 3 Escaravelhos guiados de 200 HP que perseguem o jogador mais próximo e explodem causando 50 de dano.'],
                ['name' => 'Raio de Rá (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 15s. Sinaliza uma área por 1.5s e dispara um feixe de luz divina que causa 30% da vida máxima como dano real e inflige queimadura de 20 DPS por 5s.'],
                ['name' => 'Prisão de Gizé (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 25s. Envolve o jogador e dá apenas 1 segundo para escapar de seu raio. Caso contrário, enraíza o alvo por 3 segundos.'],
                ['name' => 'Julgamento de Osíris (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 45s. Limita a zona segura verde a uma metade aleatória da arena por 4s. Quem estiver fora dela ao fim do temporizador sofre 99% da vida máxima como dano verdadeiro.'],
                ['name' => 'Praga de Gafanhotos (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 20s. Dispara nuvem de insetos guiados que causam cegueira por 4s e 10 de dano por segundo.'],
                ['name' => 'Colapso Monumental (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 65s (apenas abaixo de 50% HP). Levita no céu por 3s e faz chover 8 colossais blocos de templo que causam 500 de dano e barram o mapa por 10s.']
            ]
        ],
        'DoutorDoenca' => [
            'name' => 'Doutor Doença',
            'difficulty' => 'A',
            'shape' => 'cube',
            'lore' => 'Um mestre virulento da infestação patogênica. Ele se recusa a entrar em combate corpo-a-corpo, mantendo sempre distância perfeita enquanto bombardeia os desafiantes com esporos e agulhas, curando a si mesmo baseando-se no número de patógenos que infectam a vítima.',
            'skills' => [
                ['name' => 'Roleta de Patógenos (Passiva)', 'type' => 'passive', 'desc' => 'Ataques básicos têm 35% de chance de aplicar Febre, Paralisia, Mão Trêmula, Imunidade Baixa, Visão Turva, Cansaço Viral, Incapacidade ou Hemorragia.'],
                ['name' => 'Sobrevivência Viral (Passiva)', 'type' => 'passive', 'desc' => 'Regenera 5 a 15 HP/s baseado nos patógenos ativos no jogador.'],
                ['name' => 'Esporo Homing (Ativa - Básico)', 'type' => 'active', 'desc' => 'A cada 2s dispara um esporo guiado lento que persegue por 3s e explode.'],
                ['name' => 'Injeção Geométrica (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 6s. Dispara agulha em linha reta que causa 100% de dano e garante a aplicação de um vírus aleatório.'],
                ['name' => 'Nuvem de Esporos (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 12s. Cria nuvem venenosa (raio 8) por 5 segundos que causa dano e infecção contínua.'],
                ['name' => 'Surto Epidêmico (Ativa - Ultimate)', 'type' => 'active', 'desc' => 'Cooldown 20s. Pulso radial de 15m que eleva o nível dos patógenos no jogador, ou aplica um novo.']
            ]
        ]
    ];
    
    $finalBestiary = [];
    foreach ($enemies as $id => $enemy) {
        $details = $bestiaryDetails[$id] ?? [
            'name' => $enemy['name'] ?? $id,
            'difficulty' => 'C',
            'shape' => $enemy['visuals']['shape'] ?? 'box',
            'lore' => 'Uma criatura hostil habitando a arena geométrica.',
            'skills' => []
        ];
        
        $speed = $enemy['stats']['speed'] ?? 0;
        if ($speed > 0 && $speed < 0.1) {
            $speed = $speed * 100;
        }
        
        $finalBestiary[] = [
            'id' => $id,
            'name' => $details['name'],
            'category' => $enemy['category'] ?? 'comum',
            'difficulty' => $details['difficulty'],
            'color' => $enemy['visuals']['color'] ?? '#fff',
            'shape' => $details['shape'],
            'hp' => $enemy['stats']['hp'] ?? 0,
            'speed' => $speed,
            'xp' => $enemy['stats']['xp'] ?? 0,
            'score' => $enemy['stats']['score'] ?? 0,
            'spawn' => isset($enemy['spawn']['timer']) ? "Renasce a cada " . $enemy['spawn']['timer'] . " segundos." : "Spawn periódico padrão.",
            'lore' => $details['lore'],
            'skills' => $details['skills']
        ];
    }
    
    // Add Farao and SenhorDoenca if missing
    $hasFarao = false;
    $hasDoenca = false;
    foreach ($finalBestiary as $b) {
        if ($b['id'] === 'Farao' || $b['id'] === 'farao') $hasFarao = true;
        if ($b['id'] === 'SenhorDoenca' || $b['id'] === 'DoutorDoenca' || $b['id'] === 'SenhorDoença') $hasDoenca = true;
    }
    
    if (!$hasFarao) {
        $finalBestiary[] = [
            'id' => 'Farao',
            'name' => 'O Faraó',
            'category' => 'deus',
            'difficulty' => 'SS',
            'color' => '#ffd700',
            'shape' => 'farao',
            'hp' => 150000,
            'speed' => 0,
            'xp' => 1000000,
            'score' => 100000,
            'spawn' => 'Spawn único global que se manifesta após 5 minutos de partida.',
            'lore' => $bestiaryDetails['Farao']['lore'],
            'skills' => $bestiaryDetails['Farao']['skills']
        ];
    }
    if (!$hasDoenca) {
        $finalBestiary[] = [
            'id' => 'DoutorDoenca',
            'name' => 'Doutor Doença',
            'category' => 'boss',
            'difficulty' => 'A',
            'color' => '#32CD32',
            'shape' => 'cube',
            'hp' => 100000,
            'speed' => 3.5,
            'xp' => 50000,
            'score' => 25000,
            'spawn' => 'Renasce a cada 360 segundos (6 minutos).',
            'lore' => $bestiaryDetails['DoutorDoenca']['lore'],
            'skills' => $bestiaryDetails['DoutorDoenca']['skills']
        ];
    }
    
    $bestiaryJson = json_encode($finalBestiary, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    
    // Tabs settings
    $tabHeroActive = ($activeTab === 'hero') ? ' active' : '';
    $tabTowersActive = ($activeTab === 'towers') ? ' active' : '';
    $tabItemsActive = ($activeTab === 'items') ? ' active' : '';
    $tabBestiaryActive = ($activeTab === 'bestiary') ? ' active' : '';
    $tabBossesActive = ($activeTab === 'bosses') ? ' active' : '';
    
    $tabHeroStyle = ($activeTab === 'hero') ? 'display: block;' : 'display: none;';
    $tabTowersStyle = ($activeTab === 'towers') ? 'display: block;' : 'display: none;';
    $tabItemsStyle = ($activeTab === 'items') ? 'display: block;' : 'display: none;';
    $tabBestiaryStyle = ($activeTab === 'bestiary') ? 'display: block;' : 'display: none;';
    $tabBossesStyle = ($activeTab === 'bosses') ? 'display: block;' : 'display: none;';
    
    $content = '
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <style>
        .wiki-container {
            font-family: Arial, sans-serif;
            margin-top: 10px;
        }
        .wiki-tabs {
            display: flex;
            border-bottom: 2px solid #5A2800;
            background: #e7dbcd;
            border-radius: 4px 4px 0 0;
            padding: 5px 5px 0 5px;
            gap: 4px;
        }
        .wiki-tablink {
            background: #d4c0a1;
            border: 1px solid #5A2800;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            color: #5A2800;
            padding: 8px 14px;
            cursor: pointer;
            font-weight: bold;
            font-size: 11px;
            transition: all 0.2s ease;
        }
        .wiki-tablink:hover {
            background: #b29b7a;
            color: #000;
        }
        .wiki-tablink.active {
            background: #5A2800;
            color: #FFF;
            border-color: #5A2800;
        }
        .wiki-tabcontent {
            background: #f9f4ec;
            border: 1px solid #5A2800;
            border-top: none;
            border-radius: 0 0 4px 4px;
            padding: 15px;
            animation: wikiFadeIn 0.3s ease;
        }
        @keyframes wikiFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .wiki-table {
            border-collapse: collapse;
            width: 100%;
            border: 1px solid #505050;
            margin-bottom: 20px;
        }
        .wiki-table tr.header {
            background: #d4c0a1;
            font-weight: bold;
            color: #000;
        }
        .wiki-table th, .wiki-table td {
            border: 1px solid #505050;
            padding: 8px;
            font-size: 11px;
            color: #000;
            vertical-align: top;
        }
        
        .wiki-section-title {
            font-weight: bold;
            font-size: 13px;
            color: #5A2800;
            border-bottom: 1px solid #5A2800;
            padding-bottom: 4px;
            margin: 15px 0 10px 0;
        }
        
        /* Bestiary styles */
        .bestiary-container {
            display: flex;
            gap: 15px;
            height: 600px;
        }
        .bestiary-list {
            width: 45%;
            display: flex;
            flex-direction: column;
            gap: 6px;
            border-right: 1px solid #b29b7a;
            padding-right: 10px;
            overflow-y: auto;
        }
        .bestiary-search {
            width: 100%;
            padding: 6px;
            border: 1px solid #5A2800;
            background: #FFF;
            color: #000;
            border-radius: 3px;
            box-sizing: border-box;
            font-size: 11px;
            margin-bottom: 5px;
        }
        .bestiary-filter-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            margin-bottom: 8px;
        }
        .filter-btn {
            background: #d4c0a1;
            border: 1px solid #5A2800;
            color: #5A2800;
            padding: 3px 5px;
            font-size: 9px;
            cursor: pointer;
            border-radius: 2px;
        }
        .filter-btn.active, .filter-btn:hover {
            background: #5A2800;
            color: #FFF;
        }
        .creature-card {
            background: #e7dbcd;
            border: 1px solid #b29b7a;
            border-radius: 4px;
            padding: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
        }
        .creature-card:hover, .creature-card.selected {
            background: #d4c0a1;
            border-color: #5A2800;
        }
        .creature-shape-dot {
            width: 12px;
            height: 12px;
            border: 1px solid #000;
            display: inline-block;
        }
        .creature-card-info {
            flex: 1;
        }
        .creature-card-name {
            font-weight: bold;
            font-size: 11px;
            color: #5A2800;
        }
        .creature-card-cat {
            font-size: 8px;
            color: #666;
            text-transform: uppercase;
        }
        .creature-card-difficulty {
            font-weight: bold;
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 2px;
            color: #FFF;
            float: right;
        }
        
        .bestiary-dossier {
            width: 55%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow-y: auto;
            padding-right: 5px;
        }
        .dossier-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #5A2800;
            padding-bottom: 3px;
        }
        .dossier-name {
            font-size: 14px;
            font-weight: bold;
            color: #5A2800;
            margin: 0;
        }
        .dossier-category {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
        }
        .dossier-lore {
            font-size: 10.5px;
            line-height: 140%;
            color: #333;
            font-style: italic;
            background: #f9f4ec;
            border-left: 3px solid #5A2800;
            padding: 5px 8px;
            margin: 0;
        }
        .dossier-section-title {
            font-size: 10px;
            font-weight: bold;
            color: #5A2800;
            border-bottom: 1px solid #b29b7a;
            padding-bottom: 2px;
            margin-bottom: 5px;
            text-transform: uppercase;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
        }
        .stat-box {
            background: #f9f4ec;
            border: 1px solid #b29b7a;
            border-radius: 3px;
            padding: 4px 6px;
        }
        .stat-label {
            font-size: 8px;
            text-transform: uppercase;
            color: #666;
        }
        .stat-val {
            font-size: 11px;
            font-weight: bold;
            color: #000;
        }
        .dossier-tabs {
            display: flex;
            border-bottom: 1px solid #b29b7a;
            margin-bottom: 6px;
        }
        .dossier-tab-btn {
            background: transparent;
            border: none;
            padding: 4px 8px;
            font-size: 10px;
            cursor: pointer;
            color: #666;
            border-bottom: 2px solid transparent;
        }
        .dossier-tab-btn.active {
            color: #5A2800;
            font-weight: bold;
            border-bottom-color: #5A2800;
        }
        .dossier-tab-panel {
            display: none;
        }
        .dossier-tab-panel.active {
            display: block;
        }
        .skill-item {
            background: #f9f4ec;
            border: 1px solid #b29b7a;
            border-radius: 3px;
            padding: 6px;
            margin-bottom: 5px;
        }
        .skill-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
        }
        .skill-name {
            font-weight: bold;
            font-size: 10px;
            color: #5A2800;
        }
        .skill-badge {
            font-size: 8px;
            padding: 1px 3px;
            border-radius: 2px;
            text-transform: uppercase;
            color: #FFF;
        }
        .skill-desc {
            font-size: 9.5px;
            color: #444;
            line-height: 130%;
        }
        @keyframes scan {
            0% { top: 0%; }
            50% { top: 100%; }
            100% { top: 0%; }
        }
    </style>
    
    <div class="wiki-container">
        <!-- Wiki Tabs -->
        <div class="wiki-tabs">
            <button class="wiki-tablink' . $tabHeroActive . '" onclick="openWikiTab(event, \'tab-hero\')">🛡️ O Herói & Upgrades</button>
            <button class="wiki-tablink' . $tabTowersActive . '" onclick="openWikiTab(event, \'tab-towers\')">🗼 Torres de Essência</button>
            <button class="wiki-tablink' . $tabItemsActive . '" onclick="openWikiTab(event, \'tab-items\')">🎒 Itens & Evoluções</button>
            <button class="wiki-tablink' . $tabBestiaryActive . '" onclick="openWikiTab(event, \'tab-bestiary\')">📖 Bestiário 3D</button>
            <button class="wiki-tablink' . $tabBossesActive . '" onclick="openWikiTab(event, \'tab-bosses\')">💀 Chefes & Drops Lendários</button>
        </div>
        
        <!-- Tab 1: Hero & Upgrades -->
        <div id="tab-hero" class="wiki-tabcontent" style="' . $tabHeroStyle . '">
            <div class="wiki-section-title">1. Atributos Iniciais do Herói & Evolução de Nível</div>
            <p style="font-size:11px; line-height:140%; color:#000;">
                O Herói é a representação do jogador na arena de simulação 3D. Seus atributos bases e escalonamento são definidos conforme os parâmetros oficiais abaixo:
            </p>
            <table class="wiki-table">
                <tr class="header">
                    <th width="30%">Atributo</th>
                    <th width="35%">Valor Base (Nível 1)</th>
                    <th width="35%">Crescimento por Nível</th>
                </tr>
                <tr>
                    <td><strong>Vida Máxima (Max HP)</strong></td>
                    <td>120 HP</td>
                    <td>Aumenta exponencialmente em <strong>1.3x (30%)</strong> a cada nível.</td>
                </tr>
                <tr>
                    <td><strong>Dano Base (Ataque)</strong></td>
                    <td>40 Dano</td>
                    <td>Aumenta linearmente em <strong>2.0x</strong> por nível (Ex: Nível 5 = 400 dano, Nível 10 = 800, Nível 20 = 1600).</td>
                </tr>
                <tr>
                    <td><strong>Velocidade de Movimento</strong></td>
                    <td>5.0 unidades / segundo</td>
                    <td>Constante (modificado por passivas ou itens).</td>
                </tr>
                <tr>
                    <td><strong>Velocidade de Ataque (AS)</strong></td>
                    <td>A cada 500ms (2 projéteis / segundo)</td>
                    <td>Constante (pode ser reduzido na Ultimate Nível 3).</td>
                </tr>
                <tr>
                    <td><strong>Chance Crítica Base</strong></td>
                    <td>5% Chance</td>
                    <td>Garante dano dobrado (200%) no acerto crítico.</td>
                </tr>
                <tr>
                    <td><strong>Curva de Experiência (XP)</strong></td>
                    <td>10 XP para o Nível 2</td>
                    <td>Custo aumenta em <strong>1.5x</strong> por nível subsequente.</td>
                </tr>
                <tr>
                    <td><strong>Hitbox & Defesa</strong></td>
                    <td>Raio: 0.5m | Defesa: 90</td>
                    <td>Defesa mitiga danos físicos e mágicos. Hitbox define o tamanho da colisão.</td>
                </tr>
            </table>
            
            <div class="wiki-section-title">2. Habilidades Ativas do Jogador</div>
            <table class="wiki-table">
                <tr class="header">
                    <th width="10%">Tecla</th>
                    <th width="20%">Habilidade</th>
                    <th width="20%">Atributos Técnicos</th>
                    <th width="50%">Efeito Detalhado</th>
                </tr>
                <tr>
                    <td align="center"><strong>[ Q ]</strong></td>
                    <td><strong>Corrida Geométrica</strong><br/><span style="color:#666;">(Dash)</span></td>
                    <td>Cooldown: 5.0s<br/>Duração: 0.2s<br/>Velocidade: 30.0 u/s</td>
                    <td>Avança rapidamente na direção atual com imunidade temporária a efeitos de controle (CC). Ao terminar, dispara um leque de <strong>8 esferas</strong>, cada uma causando 40% do dano de ataque do jogador.</td>
                </tr>
                <tr>
                    <td align="center"><strong>[ W ]</strong></td>
                    <td><strong>Onda Defensiva</strong><br/><span style="color:#666;">(Repel)</span></td>
                    <td>Cooldown: 8.0s<br/>Raio de Ação: 10.0m</td>
                    <td>Conjura um pulso de energia circular que empurra todos os inimigos próximos para longe e reverte a direção de projéteis inimigos na área, fazendo-os voar contra os monstros causadores.</td>
                </tr>
                <tr>
                    <td align="center"><strong>[ E ]</strong></td>
                    <td><strong>Escudo de Partículas</strong><br/><span style="color:#666;">(Shield)</span></td>
                    <td>Cooldown: 20.0s<br/>Duração: 15.0s<br/>Escudo: 1.5x Max HP</td>
                    <td>Gera uma bolha protetora eletromagnética que absorve danos equivalentes a até 150% do HP máximo do herói. A absorção protege contra golpes fatais enquanto ativa.</td>
                </tr>
                <tr>
                    <td align="center"><strong>[ R ]</strong></td>
                    <td><strong>Sobrecarga Cósmica</strong><br/><span style="color:#666;">(Ultimate)</span></td>
                    <td>Cooldown: 50.0s<br/>Duração: 25.0s<br/>Multiplicador: 4.0x</td>
                    <td>O herói entra em sobrecarga cósmica divina, aumentando todo o dano causado em <strong>4x (400%)</strong>. No nível de skill 3, a ultimate também acelera a velocidade dos ataques básicos em 1.5x.</td>
                </tr>
            </table>
            
            <div class="wiki-section-title">3. Árvore de Upgrades do Herói (Níveis 5, 10, 15 e 20)</div>
            <p style="font-size:11px; line-height:140%; color:#000;">
                Ao atingir determinados níveis na partida (5, 10, 15 e 20), o jogador escolhe uma especialização que modifica permanentemente suas habilidades básicas ou ultimate:
            </p>
            <table class="wiki-table">
                <tr class="header">
                    <th width="15%">Nível</th>
                    <th width="25%">Nome do Upgrade</th>
                    <th width="60%">Efeito da Modificação</th>
                </tr>
                <tr>
                    <td rowspan="3" align="center" style="vertical-align:middle;"><strong>Nível 5</strong><br/><span style="color:#666;">(Aprimora Q)</span></td>
                    <td><strong>Impacto Estilhaçante</strong></td>
                    <td>As esferas do dash aplicam Fratura de Armadura (reduz defesa em 25% por 4s) e reduz o cooldown do Dash em 1.0s.</td>
                </tr>
                <tr>
                    <td><strong>Rastro de Pólvora</strong></td>
                    <td>Deixa minas explosivas no chão a cada 0.1s durante o dash. Inimigos que as pisarem sofrem dano físico e queimadura contínua.</td>
                </tr>
                <tr>
                    <td><strong>Convergência Assassina</strong></td>
                    <td>Fecha o leque do disparo do dash, tornando-o concentrado. Se 3+ esferas acertarem o mesmo alvo, aplica Silenciar por 2s e concede velocidade de ataque.</td>
                </tr>
                
                <tr>
                    <td rowspan="3" align="center" style="vertical-align:middle;"><strong>Nível 10</strong><br/><span style="color:#666;">(Aprimora W)</span></td>
                    <td><strong>Campo de Hemorragia</strong></td>
                    <td>Inimigos empurrados sofrem Sangramento (Bleed) por 5 segundos, sofrendo 10% do dano bruto do jogador por segundo.</td>
                </tr>
                <tr>
                    <td><strong>Refração Vital</strong></td>
                    <td>Cada projétil repelido cura 3% do HP máximo. Caso reflita 3 ou mais projéteis de uma só vez, limpa todos os debuffs aplicados ao herói.</td>
                </tr>
                <tr>
                    <td><strong>Vácuo Magnético</strong></td>
                    <td>Muda o repel. Em vez de empurrar, puxa todos os inimigos no raio para o centro e aplica lentidão extrema de 70% por 3 segundos.</td>
                </tr>
                
                <tr>
                    <td rowspan="3" align="center" style="vertical-align:middle;"><strong>Nível 15</strong><br/><span style="color:#666;">(Aprimora E)</span></td>
                    <td><strong>Carapaça Reativa</strong></td>
                    <td>Ao sofrer dano no escudo, rebate automaticamente disparos lasers contra o atacante, devolvendo 50% do dano mitigado.</td>
                </tr>
                <tr>
                    <td><strong>Bateria de Sobrecarga</strong></td>
                    <td>Converte 10% de todo dano absorvido pelo escudo de partículas diretamente em pontos de experiência (XP) para subir de nível.</td>
                </tr>
                <tr>
                    <td><strong>Fortaleza Inabalável</strong></td>
                    <td>Dobra a capacidade do escudo (passa para 3x a vida máxima do jogador) e concede imunidade a atordoamentos, congelamentos e enraizamentos enquanto o escudo durar.</td>
                </tr>
                
                <tr>
                    <td rowspan="3" align="center" style="vertical-align:middle;"><strong>Nível 20</strong><br/><span style="color:#666;">(Passivas Gerais)</span></td>
                    <td><strong>Fúria Infinita</strong></td>
                    <td>Durante a canalização da Ultimate, cada monstro abatido estende a duração total da Ultimate em +1.0 segundo.</td>
                </tr>
                <tr>
                    <td><strong>Distorção Temporal</strong></td>
                    <td>Distorce as recargas durante a Ultimate, fixando o tempo de recarga de Q, W e E em apenas 1.0 segundo.</td>
                </tr>
                <tr>
                    <td><strong>Singularidade do Colapso</strong></td>
                    <td>Armazena todos os danos evitados ou recebidos durante a Ultimate. Ao expirar, causa 200% desse valor acumulado como explosão em área (raio 20).</td>
                </tr>
            </table>
        </div>
        
        <!-- Tab 2: Towers -->
        <div id="tab-towers" class="wiki-tabcontent" style="' . $tabTowersStyle . '">
            <div class="wiki-section-title">Especialização das Torres de Essência</div>
            <p style="font-size:11px; line-height:140%; color:#000;">
                As Torres de Essência são marcos estratégicos na arena. Os jogadores podem depositar essências colhidas para subir andares (1 ao 4) de uma torre activa, destravando passivas monumentais na partida. Apenas uma torre pode ser ativa de cada vez, mas os bônus acumulados são permanentes:
            </p>
            <table class="wiki-table">
                <tr class="header">
                    <th width="8%">Andar</th>
                    <th width="23%" style="color:#ff3333;">🔥 Torre Vermelha (Ofensiva / Dano)</th>
                    <th width="23%" style="color:#228b22;">🌲 Torre Verde (Defesa / Resistência)</th>
                    <th width="23%" style="color:#800080;">🔮 Torre Roxa (Mágica / CDR / Vamp)</th>
                    <th width="23%" style="color:#10b981;">☠️ Torre de Veneno (DoT / Kiting)</th>
                </tr>
                <tr>
                    <td align="center"><strong>Andar 1</strong></td>
                    <td><strong>+20% Chance de Crítico</strong><br/>Chance de crítico total sobe para 25% base.</td>
                    <td><strong>+25% Vida Máxima</strong><br/>Aumenta a reserva máxima de HP do herói.</td>
                    <td><strong>+30% Cooldown Reduction</strong><br/>Acelera a recarga de todas as habilidades.</td>
                    <td><strong>+20% Attack Speed / +15% MS / Tiro Tóxico</strong><br/>Velocidade de ataque, mobilidade ou projéteis envenenados.</td>
                </tr>
                <tr>
                    <td align="center"><strong>Andar 2</strong></td>
                    <td><strong>10% Roubo de Vida (Lifesteal)</strong><br/>Recupera vida ao desferir ataques básicos físicos.</td>
                    <td><strong>Espinhos Reativos (15%)</strong><br/>Reflete 15% de todo dano sofrido de volta ao agressor.</td>
                    <td><strong>20% Spellvamp</strong><br/>Cura a si mesmo baseada em 20% do dano de suas mágicas.</td>
                    <td><strong>Passos Leves / Presas Gêmeas / Dardo Cegante</strong><br/>+20% MS, cura em alvos envenenados ou 10% chance cegar.</td>
                </tr>
                <tr>
                    <td align="center"><strong>Andar 3</strong></td>
                    <td><strong>Danos Físicos em Área (Cleave)</strong><br/>Ataques básicos causam dano em área em cone frontal.</td>
                    <td><strong>Escudo Estático de Energia</strong><br/>Gera barreira passiva fora de combate. Explode ao quebrar.</td>
                    <td><strong>Spellblade (+30% Dano)</strong><br/>Próximo hit básico após conjurar magia causa +30% dano.</td>
                    <td><strong>Miasma Menor / Toxina / Foco Infeccioso</strong><br/>Poças tóxicas na morte, slow em alvos ou +20% dano em envenenados.</td>
                </tr>
                <tr>
                    <td align="center"><strong>Andar 4</strong></td>
                    <td><strong>Explosão de Tetraedro</strong><br/>Cada 4º hit físico consecutivo explode causando dano real.</td>
                    <td><strong>Burlar a Morte (Cheat Death)</strong><br/>Evita o golpe fatal uma vez, ficando imune por 2.0s.</td>
                    <td><strong>Aura Tóxica de Fogo</strong><br/>Queima inimigos próximos continuamente com dano de veneno/s.</td>
                    <td><strong>Contaminação / Armadilha / Espalhar</strong><br/>Detonação de stacks, cogumelos armadilha ou propagação de veneno.</td>
                </tr>
            </table>
            
            <div class="wiki-section-title">Mutações de Ultimate no Nível 20 baseadas na Torre Ativa</div>
            <p style="font-size:11px; line-height:140%; color:#000;">
                Ao atingir o Nível 20, além do upgrade geral, o jogador ganha acesso a uma <strong>Ultimate Mutada</strong> exclusiva de acordo com a torre que estiver selecionada no momento da ativação:
            </p>
            <table class="wiki-table">
                <tr class="header">
                    <th width="20%">Torre Ativa</th>
                    <th width="30%">Nome da Habilidade Mutada</th>
                    <th width="50%">Efeito Especial Adicional da Ultimate (R)</th>
                </tr>
                <tr>
                    <td style="color:#ff3333; font-weight:bold;">Torre Vermelha</td>
                    <td><strong>Chuva de Tetraedros<br/>Raio do Oblívio<br/>Corte Dimensional</strong></td>
                    <td>Chove projéteis tetraédricos massivos do céu por 4s na arena.<br/>Canaliza um super laser frontal que derrete defesas inimigas.<br/>Aumenta velocidade em 100% e desfere cortes invisíveis críticos rápidos.</td>
                </tr>
                <tr>
                    <td style="color:#228b22; font-weight:bold;">Torre Verde</td>
                    <td><strong>Bastião de Titânio<br/>Terremoto Geométrico<br/>Armadura Reativa</strong></td>
                    <td>Concede escudo de 100% HP máximo e imunidade total por 6 segundos.<br/>Cria ondas de choque que atordoam (1s) e danificam oponentes ao redor.<br/>Reflete 50% de todo dano e atordoa o atacante por 1 segundo.</td>
                </tr>
                <tr>
                    <td style="color:#800080; font-weight:bold;">Torre Roxa</td>
                    <td><strong>Singularidade Cósmica<br/>Distorção Temporal<br/>Reset Dimensional</strong></td>
                    <td>Cria um buraco negro gravitacional que atrai inimigos ao centro por 4s.<br/>Congela inimigos no campo e acelera cooldowns próprios em 80%.<br/>Permite teletransportes rápidos e reseta as recargas de Q, W e E ao usar.</td>
                </tr>
                <tr>
                    <td style="color:#10b981; font-weight:bold;">Torre de Veneno</td>
                    <td><strong>Campo de Fungos<br/>Olhar da Górgona<br/>Raio da Peste</strong></td>
                    <td>Gera cogumelos invisíveis que explodem com 5 stacks de veneno e slow 80%.<br/>Flash em cone: Stun 4s de frente, slow 80% de costas.<br/>Ataques viram lasers penetrantes por 8s que atravessam hordas inteiras.</td>
                </tr>
            </table>
        </div>
        
        <!-- Tab 3: Bestiary -->
        <div id="tab-bestiary" class="wiki-tabcontent" style="' . $tabBestiaryStyle . '">
            <div class="bestiary-container">
                <!-- Lista de Inimigos (Esquerda) -->
                <div class="bestiary-list">
                    <input type="text" id="bestiary-search" class="bestiary-search" placeholder="Procurar criatura..." />
                    <div class="bestiary-filter-tabs">
                        <button class="filter-btn active" data-filter="all">Todos</button>
                        <button class="filter-btn" data-filter="comum">Comuns</button>
                        <button class="filter-btn" data-filter="guardião">Guardiões</button>
                        <button class="filter-btn" data-filter="boss">Chefes</button>
                    </div>
                    <div id="cards-wrapper" style="display:flex; flex-direction:column; gap:6px; overflow-y:auto; flex:1;">
                        <!-- Populado por JS -->
                    </div>
                </div>
                
                <!-- Detalhes do Inimigo (Direita) -->
                <div class="bestiary-dossier" id="bestiary-dossier">
                    <!-- Port de Visualização Holográfica 3D -->
                    <div class="dossier-viewport" style="height: 150px; position: relative; background: radial-gradient(circle at 50% 70%, rgba(212, 167, 0, 0.15) 0%, rgba(241, 224, 198, 0) 70%); border: 1px solid #5A2800; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                        <div class="scanner-line" style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #d4a700, transparent); animation: scan 3s linear infinite; z-index: 2; pointer-events: none; opacity: 0.6;"></div>
                        <div id="canvas-container" style="width: 100%; height: 100%;"></div>
                        <div class="viewport-hud" style="position: absolute; bottom: 5px; left: 10px; right: 10px; z-index: 2; pointer-events: none; font-size: 8px; color: #5A2800; display: flex; justify-content: space-between; font-weight: bold;">
                            <span>ESCANEAMENTO MÁGICO [ATIVO]</span>
                            <span id="shape-info">CUBO</span>
                        </div>
                    </div>
                    
                    <div class="dossier-header">
                        <div>
                            <h3 class="dossier-name" id="dossier-name">Nome do Monstro</h3>
                            <span class="dossier-category" id="dossier-category">Categoria</span>
                        </div>
                        <span class="creature-card-difficulty" id="dossier-difficulty" style="font-size: 11px; padding: 2px 6px;">C</span>
                    </div>
                    
                    <p class="dossier-lore" id="dossier-lore">Lore descritivo da criatura.</p>
                    
                    <div>
                        <div class="dossier-section-title">Atributos de Combate</div>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <span class="stat-label">Vida Máxima (HP)</span>
                                <div class="stat-val" id="stat-hp">0</div>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">Velocidade</span>
                                <div class="stat-val" id="stat-speed">0</div>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">XP Concedida</span>
                                <div class="stat-val" id="stat-xp">0</div>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">Pontuação Base</span>
                                <div class="stat-val" id="stat-score">0</div>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <div class="dossier-tabs">
                            <button class="dossier-tab-btn active" data-tab="skills">Habilidades</button>
                            <button class="dossier-tab-btn" data-tab="spawn">Spawn & Temporizador</button>
                        </div>
                        <div class="dossier-tab-panel active" id="panel-skills">
                            <div id="skills-wrapper">
                                <!-- Populado por JS -->
                            </div>
                        </div>
                        <div class="dossier-tab-panel" id="panel-spawn">
                            <div class="skill-item" id="spawn-text" style="font-size: 10px; line-height:140%;">
                                Informações sobre o temporizador e localizadores de renascimento do monstro.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tab 4: Bosses & Legendary Drops -->
        <div id="tab-bosses" class="wiki-tabcontent" style="' . $tabBossesStyle . '">
            <div class="wiki-section-title">Recompensas e Drops Lendários de Chefões (Bosses)</div>
            <p style="font-size:11px; line-height:140%; color:#000;">
                Ao derrotar os grandes chefes supremos na arena, eles deixam cair no chão **Itens Lendários** em forma de buffs temporários extremamente fortes ou mutações de estado persistentes. Colete-os no mapa para amplificar seu poder:
            </p>
            <table class="wiki-table">
                <tr class="header">
                    <th width="15%">Chefe Origem</th>
                    <th width="20%">Item Dropado</th>
                    <th width="15%">Duração do Buff</th>
                    <th width="50%">Efeitos Estatísticos Detalhados</th>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Gangplank</td>
                    <td style="color:#e65100; font-weight:bold;">⚔️ Sabre Pirata</td>
                    <td>120 segundos</td>
                    <td>Concede bônus de **+10% de dano físico bruto** em todos os ataques e habilidades físicas.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Rainha das Trevas</td>
                    <td style="color:#9c27b0; font-weight:bold;">👑 Aura da Rainha</td>
                    <td>30 segundos</td>
                    <td>Garante um aumento massivo de **+25% na velocidade de ataque** e **+15% no dano de habilidades**.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Planta Carnívora Rainha</td>
                    <td style="color:#4caf50; font-weight:bold;">🌱 Seiva Regenerativa</td>
                    <td>45 segundos</td>
                    <td>Concede **+5% de Roubo de Vida (Lifesteal)**, aumenta a **velocidade de movimento em +15%** e o **dano geral em +10%**.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Lord Vouldemord</td>
                    <td style="color:#d32f2f; font-weight:bold;">🌌 Essência Negra</td>
                    <td>120 segundos</td>
                    <td>Aumenta o **dano mágico em +50%**, concede **+3% de lifesteal geral** e garante **+15% de redução de recarga (CDR)**.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Espectro de Raziel</td>
                    <td style="color:#0288d1; font-weight:bold;">👻 Essência Espectral de Raziel</td>
                    <td>180 segundos</td>
                    <td>Invoca **5 almas orbitais espectrais** ao redor do herói. Elas causam **5% da vida máxima** dos monstros + 3 de dano plano (multiplicado pelo nível) a cada colisão.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Agent Smith</td>
                    <td style="color:#00ff00; font-weight:bold;">💾 Fragmento de Código-Fonte</td>
                    <td>300 segundos</td>
                    <td>Item consumível especial. Ao ser utilizado, ativa o protocolo de retrocesso temporal, **voltando o estado da partida em 30 segundos no tempo** enquanto o jogador **preserva todo o XP e nível** que acumulou.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold; color:#d32f2f;">Lich King (Arthas)</td>
                    <td style="color:#ffd700; font-weight:bold; font-size:12px;">❄️ Alma de Arthas</td>
                    <td style="font-weight:bold;">Especial / Permanente</td>
                    <td>O drop mais poderoso do jogo. Concede os seguintes efeitos persistentes:<br/>
                        1. **+30% de Dano Amplificado** geral em tudo.<br/>
                        2. **+5% de Roubo de Vida (Lifesteal)** em todos os golpes.<br/>
                        3. **Lentidão Crionírica (30% Slow, 1.5s)** aplicada em qualquer alvo atingido.<br/>
                        4. **Imunidade Glacial**: O herói ignora o atrito e não desliza no chão escorregadio de gelo da arena.
                    </td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Doutor Doença</td>
                    <td style="color:#32CD32; font-weight:bold;">🧪 Soro Mutagênico Perfeito</td>
                    <td>90 segundos</td>
                    <td>Purifica instantaneamente todos os debuffs negativos ativos no jogador, e concede uma aura onde **todo o dano de veneno (DoT) é convertido em cura** enquanto ativo. Além disso, aumenta regeneração de vida natural em +20 HP/s.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">O Poderoso</td>
                    <td style="color:#505050; font-weight:bold;">🌀 Colapso Cósmico</td>
                    <td>Permanente global</td>
                    <td>Não dropa um item físico, mas sua queda aciona o evento **MONUMENTAL DE COLAPSO**. Todos os inimigos restantes na arena ganham um buff de escalonamento global permanente, tornando o jogo muito mais difícil e insano a partir deste ponto. Recompensa o time com 30.000 XP.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">O Faraó</td>
                    <td style="color:#ffd700; font-weight:bold;">👑 Glória Suprema</td>
                    <td>Partida</td>
                    <td>Super chefe final que recompensa com a quantia absurda de **1.000.000 XP** e 100.000 pontos no placar, garantindo o topo do ranking instantaneamente aos sobreviventes que conquistarem sua tumba.</td>
                </tr>
            </table>
        </div>
        
        <!-- Tab 5: Items & Evolutions -->
        <div id="tab-items" class="wiki-tabcontent" style="' . $tabItemsStyle . '">
            <!-- 1. Explicação das Mecânicas e Evoluções -->
            <div class="wiki-section-title">⚙️ Mecânicas de Loadout & Evolução de Itens em Partida</div>
            <p style="font-size:11px; line-height:140%; color:#000; margin-bottom: 12px;">
                Os itens que você ganha nas partidas são salvos persistentemente na sua conta. Antes de entrar na arena, você pode configurar o seu <strong>Loadout de 3 Itens</strong>.
            </p>
            
            <table class="wiki-table">
                <tr class="header">
                    <th width="30%">Mecânica</th>
                    <th width="70%">Funcionamento Detalhado e Evoluções</th>
                </tr>
                <tr>
                    <td><strong>Regras de Equipamento (Slots)</strong></td>
                    <td>Seu loadout possui exatamente <strong>3 slots</strong> para equipar itens de seu inventário. Para balancear o poder dos jogadores, aplicam-se restrições estritas de raridade no loadout:
                        <br/>• Máximo de <strong>1 Item Lendário</strong> equipado.
                        <br/>• Máximo de <strong>2 Itens Épicos</strong> equipados.
                        <br/>• Máximo de <strong>3 Itens Básicos</strong> equipados.
                    </td>
                </tr>
                <tr>
                    <td><strong>Evolução em Partida (In-Match Scaling)</strong></td>
                    <td>Todos os itens equipados iniciam a partida no <strong>Nível 0</strong> (status base). Conforme você joga, os seus itens evoluem:
                        <br/>• A cada <strong>100 Cubos Roxos</strong> (Purple Cubes) derrotados, todos os seus itens sobem de nível automaticamente.
                        <br/>• Cada nível adiciona <strong>+1% de eficácia global</strong> aos status dos itens (chances de proc, dano e duração dos efeitos).
                        <br/>• O limite de evolução é o <strong>Nível 10</strong> (+10% de melhoria máxima no total, atingido ao derrotar 1.000 Cubos Roxos).
                        <br/>• Exemplo: Um item com 5% de chance de proc passará a ter 5.5% de chance de proc no Nível 10.
                    </td>
                </tr>
                <tr>
                    <td><strong>LootEngine (Drop de Itens)</strong></td>
                    <td>Ao final de cada partida, o sistema calcula a sua recompensa.
                        <br/>• <strong>Elegibilidade:</strong> Para se enquadrar como elegível para as chances de drop, o jogador deve atingir o tempo mínimo de sobrevivência de <strong>5 minutos</strong> na partida E uma pontuação individual mínima de <strong>100.000 pontos</strong>.
                        <br/>• <strong>Chance Base (Configurada):</strong>
                        <br/>&nbsp;&nbsp;&nbsp;&nbsp;- <strong>Básico:</strong> ' . htmlspecialchars($wikiDropRates['basic']) . '%
                        <br/>&nbsp;&nbsp;&nbsp;&nbsp;- <strong>Épico:</strong> ' . htmlspecialchars($wikiDropRates['epic']) . '%
                        <br/>&nbsp;&nbsp;&nbsp;&nbsp;- <strong>Lendário:</strong> ' . htmlspecialchars($wikiDropRates['legendary']) . '%
                        <br/>&nbsp;&nbsp;&nbsp;&nbsp;- <strong>Nenhum Drop:</strong> ' . htmlspecialchars(max(0, 100 - ($wikiDropRates['basic'] + $wikiDropRates['epic'] + $wikiDropRates['legendary']))) . '%
                        <br/>• <strong>Escalonamento por Tempo:</strong> A cada 10 minutos de sobrevivência na partida, a chance de drop Básico aumenta em <strong>+1%</strong> (reduzindo a chance de Nenhum Drop na mesma proporção).
                    </td>
                </tr>
                <tr>
                    <td><strong>Sistema de Reciclagem (Trade-In)</strong></td>
                    <td>No menu <strong>Trade-In</strong> da sua conta no site, você pode reciclar itens indesejados ou repetidos em troca de moedas ou fusões de maior poder:
                        <br/>• <strong>Queimar Básico:</strong> Concede 10 Premium Coins.
                        <br/>• <strong>Funde 5 Básicos:</strong> Gera 1 Item Épico aleatório.
                        <br/>• <strong>Queimar Épico:</strong> Concede 100 Premium Coins.
                        <br/>• <strong>Funde 5 Épicos:</strong> Gera 1 Item Lendário aleatório.
                        <br/>• <strong>Queimar Lendário:</strong> Concede 500 Premium Coins.
                    </td>
                </tr>
                <tr>
                    <td><strong>Moeda Premium & Mercado (CoinMarket)</strong></td>
                    <td>O ecossistema econômico gira em torno das Premium Coins (R$ 1,00 = 100 Moedas):
                        <br/>• <strong>Tibia Coins Style (P2P):</strong> Os jogadores podem vender e comprar moedas entre si de forma segura por meio do site.
                        <br/>• <strong>Taxa Administrativa (10% Sink):</strong> Para controle de inflação do ecossistema, todas as transações P2P sofrem uma dedução de 10% do valor total das moedas.
                    </td>
                </tr>
            </table>

            <!-- 2. Enciclopédia Interativa de Itens -->
            <div class="wiki-section-title">🎒 Enciclopédia Completa de Itens do Jogo</div>
            <p style="font-size:11px; line-height:140%; color:#000; margin-bottom:12px;">
                Veja abaixo a lista completa dos 51 itens disponíveis e seus efeitos mecânicos. Use o campo de busca ou os filtros de raridade para navegar.
            </p>
            
            <div style="display: flex; gap: 10px; margin-bottom: 12px; align-items: center;">
                <input type="text" id="wiki-item-search" style="padding: 6px; border: 1px solid #5A2800; border-radius: 3px; font-size: 11px; width: 220px;" placeholder="Procurar item pelo nome..." />
                <div style="display: flex; gap: 4px;" id="wiki-item-filters">
                    <button class="filter-btn active" data-rarity="all">Todos</button>
                    <button class="filter-btn" data-rarity="basic" style="color: #4caf50; font-weight: bold;">Básicos</button>
                    <button class="filter-btn" data-rarity="epic" style="color: #9c27b0; font-weight: bold;">Épicos</button>
                    <button class="filter-btn" data-rarity="legendary" style="color: #ff9800; font-weight: bold;">Lendários</button>
                </div>
            </div>
            
            <div id="wiki-items-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; max-height: 500px; overflow-y: auto; padding: 5px; border: 1px solid #b29b7a; border-radius: 4px; background: #e7dbcd;">
                <!-- Preenchido dinamicamente via JS -->
            </div>
        </div>
    </div>
    
    <script>
        const bestiaryData = ' . $bestiaryJson . ';
        
        // Items Database for wiki tab
        const itemsDatabase = [
            { id: "espada_basica", name: "Lâmina Fragmentada", rarity: "basic", img: "item1.png", desc: "Inicia a partida com +15% de Dano Físico." },
            { id: "escudo_ferro", name: "Escudo Primitivo", rarity: "basic", img: "item2.png", desc: "Inicia a partida com +15% de Defesa." },
            { id: "bota_velocidade", name: "Propulsor de Íons", rarity: "basic", img: "item3.png", desc: "Inicia a partida com +10% de Velocidade de Movimento." },
            { id: "pocao_vida", name: "Injetor de Nanobots", rarity: "basic", img: "item4.png", desc: "Inicia a partida com +20% de HP Máximo." },
            { id: "armadura_aco", name: "Chassi Reforçado", rarity: "basic", img: "item5.png", desc: "Inicia a partida com +10% de Defesa e +10% de HP Máximo." },
            { id: "amuleto_magico", name: "Núcleo de Ressonância", rarity: "epic", img: "item6.png", desc: "Reduz o tempo de recarga de todas as habilidades em 15%." },
            { id: "prisma_faiscas", name: "Prisma de Faiscas", rarity: "basic", img: "item7.png", desc: "5% de chance ao atacar de aplicar Queimadura (Ignite)." },
            { id: "cubo_toxico", name: "Cubo Tóxico", rarity: "basic", img: "item8.png", desc: "5% de chance ao atacar de aplicar 1 stack de Veneno (Poison)." },
            { id: "lamina_triangular", name: "Lâmina Triangular", rarity: "basic", img: "item9.png", desc: "Ataques ganham 5% de chance de aplicar Sangramento (Bleed)." },
            { id: "cilindro_corrosivo", name: "Cilindro Corrosivo", rarity: "basic", img: "item10.png", desc: "3% de chance de aplicar Corrosão (Acid)." },
            { id: "orbe_enfermo", name: "Orbe Enfermo", rarity: "basic", img: "item11.png", desc: "2% de chance de aplicar Praga (Plague) no inimigo." },
            { id: "icosaedro_gelido", name: "Icosaedro Gélido", rarity: "basic", img: "item12.png", desc: "1% de chance de causar Congelamento (Freeze) por 1s." },
            { id: "bloco_pesado", name: "Bloco Pesado", rarity: "basic", img: "item13.png", desc: "2% de chance de aplicar Atordoamento (Stun)." },
            { id: "raizes_poligonais", name: "Raízes Poligonais", rarity: "basic", img: "item14.png", desc: "5% de chance de causar Enraizamento (Root)." },
            { id: "cone_lentidao", name: "Cone da Lentidão", rarity: "basic", img: "item15.png", desc: "10% de chance de aplicar Lentidão (Slow) de 20%." },
            { id: "luz_prismatica", name: "Luz Prismática", rarity: "basic", img: "item16.png", desc: "2% de chance de causar Cegueira (Blind)." },
            { id: "esfera_mudo", name: "Esfera do Mudo", rarity: "basic", img: "item17.png", desc: "5% de chance de aplicar Silenciamento (Silence)." },
            { id: "espelho_distorcido", name: "Espelho Distorcido", rarity: "basic", img: "item18.png", desc: "3% de chance de causar Confusão (Confusion)." },
            { id: "tetraedro_panico", name: "Tetraedro do Pânico", rarity: "basic", img: "item19.png", desc: "2% de chance de causar Medo (Fear)." },
            { id: "placa_provocador", name: "Placa do Provocador", rarity: "basic", img: "item20.png", desc: "Reduz o dano recebido de inimigos sob efeito de Provocação (Taunt) em 5%." },
            { id: "lente_fenda", name: "Lente da Fenda", rarity: "basic", img: "item21.png", desc: "5% de chance de aplicar Vulnerabilidade (Vulnerable)." },
            { id: "tijolo_exaustivo", name: "Tijolo Exaustivo", rarity: "basic", img: "item22.png", desc: "5% de chance de aplicar Fraqueza (Weakness)." },
            { id: "circulo_cansaco", name: "Círculo do Cansaço", rarity: "basic", img: "item23.png", desc: "5% de chance de aplicar Exaustão (Exhaust)." },
            { id: "seta_marcadora", name: "Seta Marcadora", rarity: "basic", img: "item24.png", desc: "5% de chance de aplicar Marca do Caçador (Marked)." },
            { id: "cunha_serrilhada", name: "Cunha Serrilhada", rarity: "basic", img: "item25.png", desc: "5% de chance de aplicar Anti-Cura (Mortal Wounds)." },
            { id: "cristal_vitalidade", name: "Cristal de Vitalidade", rarity: "basic", img: "item26.png", desc: "Inicia a partida com buff constante de Regeneração (Regen)." },
            { id: "vento_cubico", name: "Vento Cúbico", rarity: "basic", img: "item27.png", desc: "Inicia a partida com Aceleração (Haste) (+5% Move/Atk Speed)." },
            { id: "estilhaco_furia", name: "Estilhaço de Fúria", rarity: "basic", img: "item28.png", desc: "Se HP cair abaixo de 20%, ativa Fúria (Enrage) por 3s (Cooldown: 60s)." },
            { id: "mini_escudo_planar", name: "Mini-Escudo Planar", rarity: "basic", img: "item29.png", desc: "Ao receber dano letal, ativa Escudo Divino (Aegis) por 1s (1 vez por partida)." },
            { id: "cacto_geometrico", name: "Cacto Geométrico", rarity: "basic", img: "item30.png", desc: "Garante 5% de chance de aplicar o buff de Espinhos (Thorns) por 5s ao ser atacado." },
            { id: "presa_poligono", name: "Presa de Polígono", rarity: "basic", img: "item31.png", desc: "Garante +2% global de Vampirismo (Lifesteal)." },
            { id: "peso_balanceador", name: "Peso Balanceador", rarity: "basic", img: "item32.png", desc: "+10% de HP Máximo, aplica -5% permanente de Lentidão (Slow) em si mesmo." },
            { id: "motor_hasteado", name: "Motor Hasteado", rarity: "basic", img: "item33.png", desc: "Ganha +10% de MoveSpeed, mas aplica -5% de dano base." },
            { id: "frasco_sangue", name: "Frasco Quadrado de Sangue", rarity: "basic", img: "item34.png", desc: "Aumenta o dano do status Sangramento (Bleed) causado em 15%." },
            { id: "frasco_veneno", name: "Frasco Quadrado de Veneno", rarity: "basic", img: "item35.png", desc: "Aumenta o limite máximo de Stacks do seu Veneno (Poison) em +2." },
            { id: "relogio_triangular", name: "Relógio Triangular", rarity: "basic", img: "item36.png", desc: "Aumenta a duração de todos os status de CC (Freeze, Stun, Root) causados em +0.5s." },
            { id: "dodecaedro_carnificina", name: "Dodecaedro da Carnificina", rarity: "epic", img: "item37.png", desc: "Se o inimigo estiver sob efeito de Sangramento, seus acertos críticos têm 100% de chance de aplicar Fúria (Enrage) em você por 2s." },
            { id: "bastiao_gelo", name: "Bastião de Gelo", rarity: "epic", img: "item38.png", desc: "Quando sua vida cai abaixo de 30%, ativa Escudo Divino (Aegis) por 3s e aplica Congelamento (Freeze) em área (AoE 5m) por 2s. (Cooldown: 120s)." },
            { id: "casco_toxico", name: "Casco Tóxico Farpado", rarity: "epic", img: "item39.png", desc: "Aplica permanentemente Espinhos (Thorns) (+15%). Inimigos que sofrem dano dos seus espinhos recebem 2 stacks de Veneno (Poison)." },
            { id: "lamina_sanguessuga", name: "Lâmina Sanguessuga", rarity: "epic", img: "item40.png", desc: "Aumenta seu Vampirismo (Lifesteal) em +5%. Se você atacar um alvo com Vulnerabilidade, o lifesteal dobra." },
            { id: "epidemia_acida", name: "Epidemia Ácida", rarity: "epic", img: "item41.png", desc: "Sempre que a sua Praga (Plague) se espalhar após a morte de um inimigo, ela espalha também 2 stacks de Corrosão (Acid)." },
            { id: "olho_aterrorizante", name: "O Olho Aterrorizante", rarity: "epic", img: "item42.png", desc: "Ao receber dano corpo-a-corpo superior a 15% do seu HP máximo de uma vez, ativa Medo (Fear) no atacante e aplica Marca do Caçador (Marked) nele." },
            { id: "megafone_conico", name: "Megafone Cônico", rarity: "epic", img: "item43.png", desc: "A cada 30 segundos, emite um pulso que aplica Provocação (Taunt) em todos num raio de 10 metros, mas garante a você Escudo Divino (Aegis) por 3 segundos." },
            { id: "grilhoes_cansaco", name: "Grilhões do Cansaço", rarity: "epic", img: "item44.png", desc: "Todo inimigo que sofrer Enraizamento (Root) por você sofrerá automaticamente Exaustão (Exhaust) pelo dobro do tempo." },
            { id: "pendulo_curativo", name: "Pêndulo Curativo", rarity: "epic", img: "item45.png", desc: "Se você não receber dano por 10 segundos, ganha um buff fortíssimo de Regeneração (Regen). O buff cessa ao tomar dano, mas aplica Anti-Cura (Mortal Wounds) no atacante." },
            { id: "prisma_duelista", name: "Prisma do Duelista", rarity: "epic", img: "item46.png", desc: "Seus ataques alternam: o 1º golpe aplica Fraqueza (Weakness), o 2º aplica Queimadura (Ignite) e o 3º aplica Confusão (Confusion)." },
            { id: "cubo_infinito", name: "Cubo do Infinito", rarity: "legendary", img: "item47.png", desc: "A cada 10 segundos, alterna automaticamente o jogador entre 3 estados de Buff massivo contínuo: Regen+Haste, Enrage puro, Aegis intermitente." },
            { id: "prisma_calamidade", name: "Prisma da Calamidade", rarity: "legendary", img: "item48.png", desc: "Remove a sua habilidade de causar dano físico direto, mas 100% de seus acertos aplicam um \"Super DoT\" (Poison, Acid, Ignite, Plague)." },
            { id: "tetraedro_distorcao", name: "Tetraedro da Distorção Temporal", rarity: "legendary", img: "item49.png", desc: "Você fica em estado permanente de Aceleração (Haste) Extrema (+50% Velocidade). Inimigos que entrarem num raio de 8 metros ao seu redor sofrem Lentidão (Slow) de -70% constante e perdem a habilidade de conjurar magias (Silenciamento)." },
            { id: "coroa_gelida", name: "Coroa Gélida do Lich", rarity: "legendary", img: "item50.png", desc: "Seus ataques normais passam a ser golpes de gelo físico em área (AoE 45°). Inimigos atingidos são imobilizados por Congelamento (Freeze) por 1s. Todo dano causado a inimigos congelados concede 10% de Vampirismo (Lifesteal) direto para a vida máxima." },
            { id: "coracao_raziel", name: "O Coração Cúbico de Raziel", rarity: "legendary", img: "item51.png", desc: "\"Engana a Morte\". Ao receber o golpe fatal, cura 100% HP, aplica Cegueira (Blind) e Confusão (Confusion) em toda a tela por 5s, e ganha Escudo Divino (Aegis) por 4s (1x por partida)." }
        ];
        
        const customItemNames = ' . json_encode($names_mapping) . ';
        const customItemImages = ' . json_encode($images_mapping) . ';
        if (customItemNames) {
            itemsDatabase.forEach(item => {
                if (customItemNames[item.id]) {
                    item.name = customItemNames[item.id];
                }
            });
        }
        if (customItemImages) {
            itemsDatabase.forEach(item => {
                if (customItemImages[item.id]) {
                    item.img = customItemImages[item.id];
                }
            });
        }
        
        let activeId = "Farao";
        let currentFilter = "all";
        let searchQuery = "";
        
        let scene, camera, renderer, currentMesh;
        
        function openWikiTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("wiki-tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tablinks = document.getElementsByClassName("wiki-tablink");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";
            
            if (tabName === "tab-bestiary") {
                if (!scene) {
                    setTimeout(() => {
                        init3D();
                        renderCards();
                        selectCreature(activeId);
                    }, 50);
                }
            } else if (tabName === "tab-items") {
                setTimeout(() => {
                    renderItemsGrid();
                }, 50);
            }
        }

        let itemFilter = "all";
        let itemSearchQuery = "";

        const rarityMap = {
            basic: { name: "Básico", color: "#4caf50" },
            epic: { name: "Épico", color: "#9c27b0" },
            legendary: { name: "Lendário", color: "#ff9800" }
        };

        function renderItemsGrid() {
            const container = document.getElementById("wiki-items-grid");
            if (!container) return;
            container.innerHTML = "";

            const filtered = itemsDatabase.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) || 
                                     item.desc.toLowerCase().includes(itemSearchQuery.toLowerCase());
                const matchesRarity = itemFilter === "all" || item.rarity === itemFilter;
                return matchesSearch && matchesRarity;
            });

            if (filtered.length === 0) {
                container.innerHTML = "<div style=\'grid-column: 1/-1; text-align:center; padding:20px; font-size:11px; color:#5A2800; font-style:italic;\'>Nenhum item encontrado.</div>";
                return;
            }

            filtered.forEach(item => {
                const card = document.createElement("div");
                card.style.background = "#f9f4ec";
                card.style.border = "1px solid #b29b7a";
                card.style.borderRadius = "4px";
                card.style.padding = "10px";
                card.style.display = "flex";
                card.style.flexDirection = "column";
                card.style.gap = "8px";
                card.style.boxSizing = "border-box";
                card.style.position = "relative";
                card.style.transition = "all 0.2s ease";
                card.className = "wiki-item-card";

                const rInfo = rarityMap[item.rarity] || { name: "Desconhecido", color: "#666" };

                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="items/${item.img}" style="width:32px; height:32px; image-rendering: pixelated; border:1px solid #5A2800; border-radius:4px; background:#e7dbcd; padding:2px;" onerror="this.src=\'items/item1.png\';" />
                        <div>
                            <div style="font-weight:bold; font-size:11px; color:#5A2800;">${item.name}</div>
                            <div style="font-size:9px; color:${rInfo.color}; font-weight:bold; text-transform:uppercase;">${rInfo.name}</div>
                        </div>
                    </div>
                    <div style="font-size:10px; color:#333; line-height:130%; flex: 1;">${item.desc}</div>
                `;

                // Hover effects
                card.onmouseover = () => {
                    card.style.borderColor = rInfo.color;
                    card.style.boxShadow = `0 2px 8px ${rInfo.color}33`;
                };
                card.onmouseout = () => {
                    card.style.borderColor = "#b29b7a";
                    card.style.boxShadow = "none";
                };

                container.appendChild(card);
            });
        }
        
        function init3D() {
            const container = document.getElementById("canvas-container");
            if (!container) return;
            
            if (typeof THREE === "undefined") {
                container.innerHTML = "<div style=\'text-align:center; padding-top:50px; font-size:10px; color:#5A2800;\'>[Erro ao carregar renderizador 3D]</div>";
                return;
            }
            
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
            camera.position.set(0, 1.8, 6.5);
            camera.lookAt(0, 0.5, 0);
            
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            container.appendChild(renderer.domElement);
            
            const ambient = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambient);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(4, 8, 5);
            scene.add(dirLight);
            
            const glowLight = new THREE.PointLight(0xd4a700, 0.9, 8);
            glowLight.position.set(0, 1.5, 1.5);
            scene.add(glowLight);
            
            const gridHelper = new THREE.GridHelper(8, 12, 0x5a2800, 0x5a2800);
            gridHelper.position.y = -0.8;
            scene.add(gridHelper);
            
            const ringGeo = new THREE.RingGeometry(1.6, 1.65, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a700, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -0.79;
            scene.add(ring);
            
            let isDragging = false;
            let previousMousePosition = { x: 0, y: 0 };
            
            container.addEventListener("mousedown", (e) => {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            });
            
            container.addEventListener("mousemove", (e) => {
                if (!isDragging || !currentMesh) return;
                const deltaMove = {
                    x: e.clientX - previousMousePosition.x,
                    y: e.clientY - previousMousePosition.y
                };
                currentMesh.rotation.y += deltaMove.x * 0.005;
                currentMesh.rotation.x += deltaMove.y * 0.005;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            });
            
            window.addEventListener("mouseup", () => { isDragging = false; });
            
            function animate() {
                requestAnimationFrame(animate);
                if (currentMesh && !isDragging) {
                    currentMesh.rotation.y += 0.008;
                }
                ring.rotation.z += 0.002;
                renderer.render(scene, camera);
            }
            animate();
        }
        
        function update3DModel(shapeType, colorHex) {
            if (typeof THREE === "undefined" || !scene) return;
            if (currentMesh) scene.remove(currentMesh);
            
            const group = new THREE.Group();
            const colorVal = parseInt(colorHex.replace("#", "0x"));
            
            const mat = new THREE.MeshStandardMaterial({
                color: colorVal,
                emissive: colorVal,
                emissiveIntensity: 0.25,
                metalness: shapeType === "farao" || shapeType === "smith" ? 0.7 : 0.3,
                roughness: 0.4
            });
            
            document.getElementById("shape-info").textContent = shapeType.toUpperCase();
            
            if (shapeType === "farao") {
                const bodyGeo = new THREE.BoxGeometry(1.1, 1.5, 0.7);
                const body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.75;
                group.add(body);
                
                const headGeo = new THREE.BoxGeometry(0.7, 0.5, 0.5);
                const headMat = new THREE.MeshStandardMaterial({ color: 0xd4a700, metalness: 0.8 });
                const head = new THREE.Mesh(headGeo, headMat);
                head.position.y = 1.7;
                group.add(head);
                
                const crownGeo = new THREE.ConeGeometry(0.25, 0.7, 4);
                const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700 });
                const crown = new THREE.Mesh(crownGeo, crownMat);
                crown.position.y = 2.3;
                crown.rotation.y = Math.PI / 4;
                group.add(crown);
            } else if (shapeType === "smith") {
                const bodyGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
                const body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.55;
                group.add(body);
                
                const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                const headMat = new THREE.MeshStandardMaterial({ color: 0x505050 });
                const head = new THREE.Mesh(headGeo, headMat);
                head.position.y = 1.35;
                group.add(head);
                
                const visorGeo = new THREE.BoxGeometry(0.4, 0.1, 0.08);
                const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const visor = new THREE.Mesh(visorGeo, visorMat);
                visor.position.set(0, 1.35, 0.26);
                group.add(visor);
            } else if (shapeType === "cao") {
                const bodyGeo = new THREE.BoxGeometry(1.4, 0.7, 0.7);
                const body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.35;
                group.add(body);
                
                const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
                const head = new THREE.Mesh(headGeo, mat);
                head.position.set(0.8, 0.55, 0);
                group.add(head);
                
                const spikeGeo = new THREE.ConeGeometry(0.15, 0.4, 4);
                const spikeMat = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
                const spike1 = new THREE.Mesh(spikeGeo, spikeMat);
                spike1.position.set(-0.2, 0.7, 0);
                const spike2 = spike1.clone();
                spike2.position.x = 0.2;
                group.add(spike1);
                group.add(spike2);
            } else if (shapeType === "bombardeiro") {
                // Base: Pyramid (Cylinder Geometry with top radius 0)
                const baseGeo = new THREE.CylinderGeometry(0, 1.2, 2.5, 4);
                const baseMesh = new THREE.Mesh(baseGeo, mat);
                baseMesh.position.y = 1.25;
                baseMesh.rotation.y = Math.PI / 4;
                group.add(baseMesh);

                // Head: Tetrahedron
                const headGeo = new THREE.TetrahedronGeometry(0.8, 0);
                const headMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 });
                const headMesh = new THREE.Mesh(headGeo, headMat);
                headMesh.position.set(0, 1.5, 0);
                baseMesh.add(headMesh);

                // Arms/Bombs: Icosahedrons
                const bombGeo = new THREE.IcosahedronGeometry(0.5, 0);
                const bombMat = new THREE.MeshStandardMaterial({ color: 0xff4500, roughness: 0.5 });
                const bombL = new THREE.Mesh(bombGeo, bombMat);
                bombL.position.set(-1.2, 0.5, 0);
                const bombR = new THREE.Mesh(bombGeo, bombMat);
                bombR.position.set(1.2, 0.5, 0);
                baseMesh.add(bombL);
                baseMesh.add(bombR);

                // Wicks: Cylinders
                const wickGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
                const wickMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
                const wickL = new THREE.Mesh(wickGeo, wickMat);
                wickL.position.set(0, 0.6, 0);
                bombL.add(wickL);
                const wickR = new THREE.Mesh(wickGeo, wickMat);
                wickR.position.set(0, 0.6, 0);
                bombR.add(wickR);
            } else if (shapeType === "box" || shapeType === "cube") {
                const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.6;
                group.add(mesh);
            } else if (shapeType === "cone") {
                const geo = new THREE.ConeGeometry(0.8, 1.8, 8);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.9;
                group.add(mesh);
            } else if (shapeType === "cylinder") {
                const geo = new THREE.CylinderGeometry(0.6, 0.8, 1.8, 12);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.9;
                group.add(mesh);
            } else if (shapeType === "sphere") {
                const geo = new THREE.SphereGeometry(0.85, 24, 24);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.85;
                group.add(mesh);
            } else if (shapeType === "octahedron") {
                const geo = new THREE.OctahedronGeometry(0.9, 0);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.9;
                group.add(mesh);
            } else if (shapeType === "tetrahedron") {
                const geo = new THREE.TetrahedronGeometry(0.9, 0);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.9;
                group.add(mesh);
            } else if (shapeType === "icosahedron") {
                const geo = new THREE.IcosahedronGeometry(0.9, 0);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.9;
                group.add(mesh);
            } else if (shapeType === "dodecahedron") {
                const geo = new THREE.DodecahedronGeometry(0.9, 0);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.9;
                group.add(mesh);
            } else if (shapeType === "torus") {
                const geo = new THREE.TorusGeometry(0.6, 0.2, 8, 24);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.8;
                mesh.rotation.x = Math.PI / 3;
                group.add(mesh);
            } else {
                const geo = new THREE.BoxGeometry(1, 1, 1);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = 0.5;
                group.add(mesh);
            }
            
            currentMesh = group;
            scene.add(currentMesh);
        }
        
        function renderCards() {
            const container = document.getElementById("cards-wrapper");
            if (!container) return;
            container.innerHTML = "";
            
            const categoryMap = {
                basic: "Comum",
                comum: "Comum",
                minion: "Lacaio",
                structure: "Estrutura",
                guardian: "Guardião",
                guardião: "Guardião",
                defender: "Defensor",
                boss: "Chefe",
                miniboss: "Mini Chefe",
                deus: "Deus"
            };
            
            const difficultyColors = {
                E: "#4caf50",
                D: "#0288d1",
                C: "#9c27b0",
                B: "#ff9800",
                A: "#e65100",
                S: "#d32f2f",
                SS: "#ffd700"
            };
            
            const filtered = bestiaryData.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
                
                let matchesCategory = false;
                if (currentFilter === "all") {
                    matchesCategory = true;
                } else if (currentFilter === "comum") {
                    matchesCategory = (item.category === "comum" || item.category === "minion" || item.category === "structure" || item.category === "basic");
                } else if (currentFilter === "guardião") {
                    matchesCategory = (item.category === "guardião" || item.category === "defender" || item.category === "guardian");
                } else if (currentFilter === "boss") {
                    matchesCategory = (item.category === "boss" || item.category === "miniboss" || item.category === "deus");
                }
                
                return matchesSearch && matchesCategory;
            });
            
            if (filtered.length === 0) {
                container.innerHTML = "<div style=\'text-align:center; padding:20px; font-size:10px; color:#5A2800; font-style:italic;\'>Nenhuma criatura encontrada.</div>";
                return;
            }
            
            filtered.forEach(item => {
                const card = document.createElement("div");
                card.className = "creature-card" + (item.id === activeId ? " selected" : "");
                
                const catName = categoryMap[item.category] || item.category;
                const diffColor = difficultyColors[item.difficulty] || "#505050";
                
                card.innerHTML = `<div class="creature-icon-placeholder"><span class="creature-shape-dot" style="background-color: ${item.color}; border-radius: ${item.shape === "sphere" ? "50%" : "0"}"></span></div><div class="creature-card-info"><div class="creature-card-name">${item.name}</div><div class="creature-card-cat">${catName}</div></div><span class="creature-card-difficulty" style="background-color: ${diffColor}">${item.difficulty}</span>`;
                
                card.addEventListener("click", () => {
                    selectCreature(item.id);
                });
                
                container.appendChild(card);
            });
        }
        
        function selectCreature(id) {
            activeId = id;
            
            document.querySelectorAll(".creature-card").forEach(c => c.classList.remove("selected"));
            renderCards();
            
            const item = bestiaryData.find(b => b.id === id);
            if (!item) return;
            
            document.getElementById("dossier-name").textContent = item.name;
            
            const categoryMap = {
                basic: "Criatura Comum (Lacaio)",
                comum: "Criatura Comum",
                minion: "Criatura Comum (Minion)",
                structure: "Estrutura Defensiva",
                guardian: "Guardião de Elite",
                guardião: "Guardião de Elite",
                defender: "Guardião Defensor",
                boss: "Chefe de Simulação (Boss)",
                miniboss: "Mini Chefe de Limbo",
                deus: "Entidade Divina Suprema (Boss Final)"
            };
            document.getElementById("dossier-category").textContent = categoryMap[item.category] || item.category;
            
            const difficultyColors = {
                E: "#4caf50",
                D: "#0288d1",
                C: "#9c27b0",
                B: "#ff9800",
                A: "#e65100",
                S: "#d32f2f",
                SS: "#ffd700"
            };
            const diffColor = difficultyColors[item.difficulty] || "#505050";
            const diffElement = document.getElementById("dossier-difficulty");
            diffElement.textContent = item.difficulty;
            diffElement.style.backgroundColor = diffColor;
            
            document.getElementById("dossier-lore").textContent = item.lore;
            
            document.getElementById("stat-hp").textContent = item.hp.toLocaleString();
            document.getElementById("stat-speed").textContent = item.speed === 0 ? "Imóvel / Teleporte" : item.speed.toFixed(1) + " u/s";
            document.getElementById("stat-xp").textContent = item.xp.toLocaleString() + " XP";
            document.getElementById("stat-score").textContent = item.score.toLocaleString() + " pts";
            
            const skillsWrapper = document.getElementById("skills-wrapper");
            skillsWrapper.innerHTML = "";
            
            if (item.skills && item.skills.length > 0) {
                item.skills.forEach(skill => {
                    const el = document.createElement("div");
                    el.className = "skill-item";
                    const badgeBg = skill.type === "passive" ? "#0288d1" : "#e65100";
                    const badgeText = skill.type === "passive" ? "Passiva" : "Ativa";
                    
                    el.innerHTML = `<div class="skill-header"><span class="skill-name">${skill.name}</span><span class="skill-badge" style="background-color: ${badgeBg}">${badgeText}</span></div><p class="skill-desc">${skill.desc}</p>`;
                    skillsWrapper.appendChild(el);
                });
            } else {
                skillsWrapper.innerHTML = `
                    <div style="font-size:10px; color:#666; font-style:italic; padding: 10px 0; text-align:center;">
                        Esta criatura não possui habilidades especiais ativas. Causa dano físico padrão de contato.
                    </div>
                `;
            }
            
            document.getElementById("spawn-text").innerHTML = `<p style="margin: 0 0 6px 0;"><strong>Temporizador de Respawn:</strong></p><p style="margin: 0 0 10px 0; color:#000;">${item.spawn}</p><p style="margin: 0 0 6px 0;"><strong>Recompensa de Abate:</strong></p><p style="margin: 0; color:#000;">Derrubar esta entidade recompensa os jogadores com <strong>${item.xp.toLocaleString()} XP</strong> e adiciona <strong>${item.score.toLocaleString()} pontos</strong> ao ranking geral da partida.</p>`;
            
            update3DModel(item.shape, item.color);
        }
        
        // Search Input Event
        document.getElementById("bestiary-search").addEventListener("input", (e) => {
            searchQuery = e.target.value;
            renderCards();
        });
        
        // Filter Tabs Event
        document.querySelectorAll(".bestiary-filter-tabs .filter-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".bestiary-filter-tabs .filter-btn").forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                currentFilter = e.target.dataset.filter;
                renderCards();
            });
        });
        
        // Tab Views inside dossier
        document.querySelectorAll(".bestiary-dossier .dossier-tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".bestiary-dossier .dossier-tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".bestiary-dossier .dossier-tab-panel").forEach(p => p.classList.remove("active"));
                
                e.target.classList.add("active");
                document.getElementById("panel-" + e.target.dataset.tab).classList.add("active");
            });
        });

        // Bind item filter buttons
        document.querySelectorAll("#wiki-item-filters .filter-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll("#wiki-item-filters .filter-btn").forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                itemFilter = e.target.dataset.rarity;
                renderItemsGrid();
            });
        });

        // Bind item search input
        document.getElementById("wiki-item-search").addEventListener("input", (e) => {
            itemSearchQuery = e.target.value;
            renderItemsGrid();
        });
        
        // Start Bestiary & Items UI
        window.addEventListener("DOMContentLoaded", () => {
            const activeTab = "' . $activeTab . '";
            if (activeTab === "bestiary") {
                init3D();
                renderCards();
                selectCreature(activeId);
            } else if (activeTab === "items") {
                renderItemsGrid();
            }
        });
    </script>';
} else {
    // Redirect to news
    header('Location: ?subtopic=news');
    exit;
}

// Append builds modal HTML and JS on all pages (Rankings, My Account, Melhores Builds, etc.)
if ($subtopic !== 'player_builds') {
    $content .= $modalHtml;
}

// Render the TibiaCom layout
require $template_path . '/' . $template_index;
?>
