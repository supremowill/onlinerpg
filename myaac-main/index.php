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
                    ✨ Ticker de Notícias: Bem-vindo ao Survival 3D! Monte sua build usando as Torres de Essência Vermelha, Verde ou Roxa. Dispute o topo nos Rankings!
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
    if ($name === 'core.gifts_system') return false;
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
    $news_menu[] = ['name' => 'Jogar Agora (Porta 80)', 'link' => 'play', 'link_full' => 'http://' . $hostOnly . ':80', 'target_blank' => ' target="_blank"', 'style_color' => 'style="color: #ff9900 !important; font-weight:bold;"'];

    $account_menu = [
        ['name' => 'Criar Conta', 'link' => 'account/create', 'link_full' => '?subtopic=account/create', 'target_blank' => '', 'style_color' => ''],
        ['name' => 'Gerenciar Conta', 'link' => 'account/manage', 'link_full' => '?subtopic=account/manage', 'target_blank' => '', 'style_color' => ''],
        ['name' => 'Como Jogar / Downloads', 'link' => 'downloads', 'link_full' => '?subtopic=downloads', 'target_blank' => '', 'style_color' => ''],
    ];
    if ($isAdmin) {
        $account_menu[] = ['name' => 'Bloquear Usuários', 'link' => 'admin/block', 'link_full' => '?subtopic=admin/block', 'target_blank' => '', 'style_color' => 'style="color: #ff3333 !important; font-weight:bold;"'];
        $account_menu[] = ['name' => 'Balanceamento de Jogo', 'link' => 'admin/balance', 'link_full' => '?subtopic=admin/balance', 'target_blank' => '', 'style_color' => 'style="color: #ff9900 !important; font-weight:bold;"'];
    }

    $menus = [
        MENU_CATEGORY_NEWS => $news_menu,
        MENU_CATEGORY_ACCOUNT => $account_menu,
        MENU_CATEGORY_COMMUNITY => [
            ['name' => 'Rankings', 'link' => 'highscores', 'link_full' => '?subtopic=highscores', 'target_blank' => '', 'style_color' => ''],
            ['name' => 'Melhores Builds', 'link' => 'builds', 'link_full' => '?subtopic=builds', 'target_blank' => '', 'style_color' => 'style="color: #ffd700 !important; font-weight:bold;"'],
            ['name' => 'Quem está Online?', 'link' => 'online', 'link_full' => '?subtopic=online', 'target_blank' => '', 'style_color' => ''],
        ],
        MENU_CATEGORY_LIBRARY => [
            ['name' => 'Wiki do Jogo', 'link' => 'wiki', 'link_full' => '?subtopic=wiki', 'target_blank' => '', 'style_color' => 'style="color: #00ffff !important;"'],
            ['name' => 'Criaturas & Chefes', 'link' => 'creatures', 'link_full' => '?subtopic=creatures', 'target_blank' => '', 'style_color' => ''],
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
    ]
];

$GLOBAL_ULTIMATES = [
    'red' => ['Sobrecarga Cósmica', 'Chuva de Tetraedros', 'Raio do Oblívio', 'Corte Dimensional'],
    'green' => ['Sobrecarga Cósmica', 'Bastião de Titânio', 'Terremoto Geométrico', 'Armadura Reativa'],
    'purple' => ['Sobrecarga Cósmica', 'Singularidade', 'Distorção Temporal', 'Reset Dimensional']
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
                
                let borderHex = \'#ff3333\';
                if (build.color === \'green\') borderHex = \'#22c55e\';
                if (build.color === \'purple\') borderHex = \'#a855f7\';
                
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
                'colorName' => ($color === 'red' ? 'Vermelha' : ($color === 'green' ? 'Verde' : 'Roxa')),
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
                    SELECT player_name, score,
                           ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC) as rn
                    FROM ranking
                    WHERE created_at >= date_trunc('week', NOW() - INTERVAL '1 minute') + INTERVAL '1 minute'
                )
                SELECT player_name, ROUND(AVG(score)) as avg_score
                FROM weekly_ranked
                WHERE rn <= 10
                GROUP BY player_name
                HAVING COUNT(*) >= 10
                ORDER BY avg_score DESC
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
        <ul>
            <li><span style="color:#ff3333; font-weight:bold;">Torre Vermelha (Dano/Lifesteal/Crítico):</span> Aumente seu dano base, obtenha cura por roubo de vida, desfira acertos críticos e ataque alvos próximos em área (cleave).</li>
            <li><span style="color:#228b22; font-weight:bold;">Torre Verde (Defesa/Vida/Espinhos):</span> Ganhe bônus de HP máximo, regenere vida passivamente, reflita dano como espinhos e sobreviva a um golpe fatal com invulnerabilidade temporária (Cheat Death).</li>
            <li><span style="color:#800080; font-weight:bold;">Torre Roxa (Magia/CDR/Vampirismo):</span> Reduza o tempo de recarga de suas magias, cure-se ao causar dano mágico (spellvamp), esquive de golpes e crie uma aura tóxica prejudicial a inimigos ao redor.</li>
        </ul>
        <br/>
        <strong>Pronto para a batalha?</strong> Registre uma conta gratuita, clique em Jogar para entrar na arena multiplayer e desafiar os monstros mais terríveis do Limbo!
        <br/><br/>
        <center>
            <a href="?subtopic=account/create" style="text-decoration:none; margin-right:20px;">
                <img src="templates/tibiacom/images/global/buttons/_sbutton_createaccount.gif" alt="Criar Conta" style="border:0; cursor:pointer;" />
            </a>
            <a href="http://' . $hostOnly . ':80" target="_blank" style="text-decoration:none;">
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
                        SELECT player_name, score, collapse_level, kills, deaths,
                                ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC) as rn
                        FROM ranking
                        WHERE created_at >= date_trunc('week', NOW() - INTERVAL '1 minute') + INTERVAL '1 minute'
                    )
                    SELECT player_name, 
                           ROUND(AVG(score)) as avg_score, 
                           MAX(collapse_level) as max_level,
                           SUM(kills) as total_kills,
                           SUM(deaths) as total_deaths,
                           COUNT(*) as matches_played
                    FROM weekly_ranked
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
    $tower_stats = ['red' => 0, 'green' => 0, 'purple' => 0];
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
                
                $colorName = ($color === 'red' ? 'Vermelha' : ($color === 'green' ? 'Verde' : 'Roxa'));
                $colorHex = ($color === 'red' ? '#ff3333' : ($color === 'green' ? '#22c55e' : '#a855f7'));
                $colorEmoji = ($color === 'red' ? '🔺' : ($color === 'green' ? '🟩' : '🟣'));
                
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
        $top_builds_html = '<tr bgcolor="#F1E0C6"><td colspan="6" align="center" style="color:red;">Banco de dados offline.</td></tr>';
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
    </div>';
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
                    if (isset($user['is_blocked']) && $user['is_blocked']) {
                        $error = 'Sua conta foi bloqueada pelo administrador.';
                    } else {
                        $_SESSION['player_id'] = $user['id'];
                        $_SESSION['player_name'] = $user['username'];
                        $_SESSION['is_admin'] = isset($user['is_admin']) && $user['is_admin'];
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
                if ($chk && $chk['is_blocked']) {
                    session_destroy();
                    header('Location: ?subtopic=account/manage');
                    exit;
                }
                // Refresh admin session status
                $_SESSION['is_admin'] = isset($chk['is_admin']) && $chk['is_admin'];
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
        if ($pdo) {
            try {
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
                    
                    $colorEmoji = ($color === 'red' ? '🔺' : ($color === 'green' ? '🟩' : '🟣'));
                    $colorName = ($color === 'red' ? 'Vermelha' : ($color === 'green' ? 'Verde' : 'Roxa'));
                    $colorHex = ($color === 'red' ? '#ff3333' : ($color === 'green' ? '#22c55e' : '#a855f7'));
                    
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
            } catch (Exception $e) {
                $matchesHtml = '<tr bgcolor="#F1E0C6"><td colspan="7" align="center" style="color:red;">Erro: ' . $e->getMessage() . '</td></tr>';
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
        <br/>
        
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
        O Survival 3D roda inteiramente no seu navegador web de forma direta! Não há necessidade de realizar downloads pesados ou instalar programas adicionais. O jogo utiliza HTML5, WebGL (Three.js) e WebSockets.
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
            <a href="http://' . $hostOnly . ':80" target="_blank" style="text-decoration:none;">
                <img src="templates/tibiacom/images/global/buttons/_sbutton_buynow.gif" alt="Jogar Agora" style="border:0; cursor:pointer;" /><br/>
                <span style="font-weight:bold; font-size:12px; color:#ff9900;">[ CLIQUE AQUI PARA ABRIR O JOGO ]</span>
            </a>
        </center>
    </div>';
} else if ($subtopic === 'monsters' || $subtopic === 'creatures' || $subtopic === 'bosses') {
    $title = "Criaturas & Chefes";
    
    $enemies = [];
    if (file_exists('game_data.json')) {
        $gameData = json_decode(file_get_contents('game_data.json'), true);
        $enemies = $gameData['enemies'] ?? [];
    }

    // Translation and detail mapping for bestiary
    $bestiaryDetails = [
        'PurpleCube' => [
            'name' => 'Cubo Roxo',
            'difficulty' => 'E',
            'shape' => 'box',
            'lore' => 'A unidade básica da infestação geométrica. Move-se de forma errática em direção ao jogador e ataca à curta distância.',
            'skills' => []
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
                ['name' => 'Golpe Impactante (Ativa)', 'type' => 'active', 'desc' => 'Desfere um golpe frontal que atordoa o jogador afetado por 1.5s.']
            ]
        ],
        'GuardianMago' => [
            'name' => 'Guardião Mago',
            'difficulty' => 'C',
            'shape' => 'octahedron',
            'lore' => 'Um canalizador octaédrico de cor azul escura que ataca a longas distâncias usando magias de congelamento.',
            'skills' => [
                ['name' => 'Estase de Gelo (Ativa)', 'type' => 'active', 'desc' => 'Atira um projétil de gelo que congela o jogador por 2 segundos ao impacto.']
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
            'skills' => []
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
            'lore' => 'O soberano da morte e do gelo. Ele caminha de forma lenta, mas gera uma aura de congelamento mortal de 4m ao seu redor que pune jogadores desavisados.',
            'skills' => [
                ['name' => 'Geada do Necro (Passiva)', 'type' => 'passive', 'desc' => 'Congela jogadores que entrarem em sua aura gélida por muito tempo.']
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
        'BruxaDoGelo' => [
            'name' => 'Bruxa do Gelo',
            'difficulty' => 'C',
            'shape' => 'sphere',
            'lore' => 'Uma feiticeira congelante que desacelera e congela jogadores à distância.',
            'skills' => []
        ],
        'MestraDaIlusao' => [
            'name' => 'Mestra da Ilusão',
            'difficulty' => 'B',
            'shape' => 'tetrahedron',
            'lore' => 'Uma ladra de mentes que esquiva de golpes com facilidade.',
            'skills' => []
        ],
        'BombardeiroInsano' => [
            'name' => 'Bombardeiro Insano',
            'difficulty' => 'B',
            'shape' => 'cube',
            'lore' => 'Um servo piromaníaco que incinera tudo o que vê.',
            'skills' => []
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
        'SenhorDoenca' => [
            'name' => 'Senhor Doença',
            'difficulty' => 'A',
            'shape' => 'sphere',
            'lore' => 'O Senhor Doença (Doutor Doença) espalha pragas e patógenos mortais. Ele tenta manter distância dos jogadores para atacá-los com debuffs debilitantes de sua roleta de vírus.',
            'skills' => [
                ['name' => 'Roleta de Patógenos (Passiva)', 'type' => 'passive', 'desc' => 'Ataques básicos têm 35% de chance de aplicar Febre, Paralisia, Mão Trêmula, Imunidade Baixa, Visão Turva, Cansaço Viral, Incapacidade ou Hemorragia.'],
                ['name' => 'Sobrevivência Viral (Passiva)', 'type' => 'passive', 'desc' => 'Regenera 5 HP/s por doença ativa no jogador (máx 15 HP/s).'],
                ['name' => 'Injeção Geométrica (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 6s. Dispara pirâmide que causa 100% de dano e garante a aplicação de um vírus aleatório.'],
                ['name' => 'Nuvem de Esporos (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 12s. Cria nuvem venenosa (raio 8) por 5 segundos que causa 10 de dano/s e tenta infectar com patógenos.'],
                ['name' => 'Surto Epidêmico (Ativa)', 'type' => 'active', 'desc' => 'Cooldown 20s. Pulso radial que eleva o nível/acúmulo dos patógenos no jogador, ou aplica um novo patógeno.']
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
    
    // Append scripted Farao and Doutor Doenca (Senhor Doenca) if not parsed from JSON
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
            'spawn' => 'Spawn único global que se manifesta após 5 minutos (300 segundos) de partida.',
            'lore' => $bestiaryDetails['Farao']['lore'],
            'skills' => $bestiaryDetails['Farao']['skills']
        ];
    }
    if (!$hasDoenca) {
        $finalBestiary[] = [
            'id' => 'SenhorDoenca',
            'name' => 'Senhor Doença',
            'category' => 'boss',
            'difficulty' => 'A',
            'color' => '#00ff00',
            'shape' => 'sphere',
            'hp' => 20000,
            'speed' => 3.5,
            'xp' => 10000,
            'score' => 5000,
            'spawn' => 'Renasce periodicamente na arena.',
            'lore' => $bestiaryDetails['SenhorDoenca']['lore'],
            'skills' => $bestiaryDetails['SenhorDoenca']['skills']
        ];
    }

    $bestiaryJson = json_encode($finalBestiary, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

    $content = '
    <div class="Headline" style="font-weight:bold; font-size:13px; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; margin-bottom:10px;">Bestiário Oficial do Survival 3D</div>
    <p style="font-size:10px; color:#000; margin-top:0; margin-bottom:12px;">Consulte o guia estatístico e as habilidades de todos os adversários na arena de simulação.</p>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    
    <style>
        .bestiary-container {
            display: flex;
            gap: 15px;
            height: 600px;
            font-family: Arial, sans-serif;
            color: #333;
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
                    <button class="dossier-tab-btn" data-tab="spawn">Spawn & SpawnTimer</button>
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
    
    <script>
        const bestiaryData = ' . $bestiaryJson . ';
        let activeId = "Farao";
        let currentFilter = "all";
        let searchQuery = "";
        
        let scene, camera, renderer, currentMesh;
        
        function init3D() {
            const container = document.getElementById("canvas-container");
            if (!container) return;
            
            if(typeof THREE === "undefined") {
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
            container.innerHTML = "";
            
            const categoryMap = {
                comum: "Comum",
                minion: "Comum",
                structure: "Estrutura",
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
                    matchesCategory = (item.category === "comum" || item.category === "minion" || item.category === "structure");
                } else if (currentFilter === "guardião") {
                    matchesCategory = (item.category === "guardião" || item.category === "defender");
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
                
                card.innerHTML = `
                    <div class="creature-icon-placeholder">
                        <span class="creature-shape-dot" style="background-color: ${item.color}; border-radius: ${item.shape === "sphere" ? "50%" : "0"}"></span>
                    </div>
                    <div class="creature-card-info">
                        <div class="creature-card-name">${item.name}</div>
                        <div class="creature-card-cat">${catName}</div>
                    </div>
                    <span class="creature-card-difficulty" style="background-color: ${diffColor}">${item.difficulty}</span>
                `;
                
                card.addEventListener("click", () => {
                    selectCreature(item.id);
                });
                
                container.appendChild(card);
            });
        }
        
        function selectCreature(id) {
            activeId = id;
            
            // Re-render cards to show selected status
            document.querySelectorAll(".creature-card").forEach(c => c.classList.remove("selected"));
            renderCards();
            
            const item = bestiaryData.find(b => b.id === id);
            if (!item) return;
            
            // Populate Dossier
            document.getElementById("dossier-name").textContent = item.name;
            
            const categoryMap = {
                comum: "Criatura Comum (Sentinela)",
                minion: "Criatura Comum (Minion)",
                structure: "Estrutura Defensiva",
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
            
            // Populate Skills Tab
            const skillsWrapper = document.getElementById("skills-wrapper");
            skillsWrapper.innerHTML = "";
            
            if (item.skills && item.skills.length > 0) {
                item.skills.forEach(skill => {
                    const el = document.createElement("div");
                    el.className = "skill-item";
                    const badgeBg = skill.type === "passive" ? "#0288d1" : "#e65100";
                    const badgeText = skill.type === "passive" ? "Passiva" : "Ativa";
                    
                    el.innerHTML = `
                        <div class="skill-header">
                            <span class="skill-name">${skill.name}</span>
                            <span class="skill-badge" style="background-color: ${badgeBg}">${badgeText}</span>
                        </div>
                        <p class="skill-desc">${skill.desc}</p>
                    `;
                    skillsWrapper.appendChild(el);
                });
            } else {
                skillsWrapper.innerHTML = `
                    <div style="font-size:10px; color:#666; font-style:italic; padding: 10px 0; text-align:center;">
                        Esta criatura não possui habilidades especiais ativas. Causa dano físico padrão de contato.
                    </div>
                `;
            }
            
            // Populate Spawn Tab
            document.getElementById("spawn-text").innerHTML = `
                <p style="margin: 0 0 6px 0;"><strong>Temporizador de Respawn:</strong></p>
                <p style="margin: 0 0 10px 0; color:#000;">${item.spawn}</p>
                <p style="margin: 0 0 6px 0;"><strong>Recompensa de Abate:</strong></p>
                <p style="margin: 0; color:#000;">Derrubar esta entidade recompensa os jogadores com <strong>${item.xp.toLocaleString()} XP</strong> e adiciona <strong>${item.score.toLocaleString()} pontos</strong> ao ranking geral da partida.</p>
            `;
            
            // Update model
            update3DModel(item.shape, item.color);
        }
        
        // Search Input Event
        document.getElementById("bestiary-search").addEventListener("input", (e) => {
            searchQuery = e.target.value;
            renderCards();
        });
        
        // Filter Tabs Event
        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                currentFilter = e.target.dataset.filter;
                renderCards();
            });
        });
        
        // Tab Views inside dossier
        document.querySelectorAll(".dossier-tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".dossier-tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".dossier-tab-panel").forEach(p => p.classList.remove("active"));
                
                e.target.classList.add("active");
                document.getElementById("panel-" + e.target.dataset.tab).classList.add("active");
            });
        });
        
        // Start Bestiary UI
        window.addEventListener("DOMContentLoaded", () => {
            init3D();
            renderCards();
            selectCreature(activeId);
        });
    </script>';
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

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['post_update_x'])) { // input type="image" submits as name_x
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
                $statusText = $p['is_blocked'] ? '<span style="color:red; font-weight:bold;">Bloqueado</span>' : '<span style="color:green; font-weight:bold;">Ativo</span>';
                $roleText = $p['is_admin'] ? 'Administrador' : 'Jogador';
                $createdAt = isset($p['created_at']) ? date('d/m/Y H:i', strtotime($p['created_at'])) : '-';

                $actionHtml = '';
                if ($p['id'] == $_SESSION['player_id']) {
                    $actionHtml = '<span style="color:#777; font-style:italic;">Você</span>';
                } else {
                    $btnAction = $p['is_blocked'] ? 'unblock' : 'block';
                    $btnLabel = $p['is_blocked'] ? 'Desbloquear' : 'Bloquear';
                    $btnStyle = $p['is_blocked'] ? 'background-color:#4CAF50; color:white; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; border-radius:2px;' : 'background-color:#f44336; color:white; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; border-radius:2px;';
                    $confirmMsg = $p['is_blocked'] ? 'Tem certeza que deseja desbloquear este usuário?' : 'Tem certeza que deseja bloquear este usuário?';

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
} else if ($subtopic === 'admin/balance') {
    $title = "Balanceamento de Jogo";
    $isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'];
    if (!$isAdmin) {
        header('Location: ?subtopic=news');
        exit;
    }

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
} else if ($subtopic === 'wiki') {
    $title = "Biblioteca Wiki";
    $content = '
    <div class="Headline" style="font-weight:bold; font-size:13px; color:#5A2800; border-bottom:1px solid #5A2800; padding-bottom:5px; margin-bottom:15px;">Guia Geral do Jogador: Atributos, Magias e Torres de Essência</div>
    <div class="Text" style="font-size:11px; line-height:140%; color:#000;">
        Bem-vindo à Wiki oficial do <strong>Survival 3D</strong>! Abaixo você encontrará os dados completos sobre a evolução do herói, o funcionamento detalhado de suas habilidades ativas e a árvore de passivas de cada Torre de Essência.
        <br/><br/>
        
        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-bottom:20px;">
            <tr bgcolor="#D4C0A1">
                <td colspan="2" style="color:#000; font-weight:bold;"><b>1. Atributos Iniciais do Herói (Nível 1) & Crescimento</b></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td width="35%"><strong>Vida Máxima (Max HP):</strong></td>
                <td>100 HP <span style="color:#666;">(+50% de ganho exponencial a cada nível atingido: MaxHP * 1.5)</span></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td><strong>Velocidade de Movimento:</strong></td>
                <td>5.0 unidades por segundo</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td><strong>Ataque Básico:</strong></td>
                <td>A cada 500ms (0.5 segundos, permitindo até 2 projéteis por segundo)</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td><strong>Escalonamento de Dano:</strong></td>
                <td>Dano = 40 × (Nível × 2.0) <span style="color:#666;">(Nível 1 = 80 de dano, Nível 5 = 400, Nível 10 = 800, Nível 20 = 1600)</span></td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td><strong>Chance de Crítico:</strong></td>
                <td>5% de chance base para todos os ataques e habilidades.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td><strong>Curva de Progressão (XP):</strong></td>
                <td>Nível 2 exige 10 XP. A partir disso, o custo para o próximo nível cresce em <strong>1.8x</strong> cumulativos.</td>
            </tr>
        </table>

        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-bottom:20px;">
            <tr bgcolor="#D4C0A1">
                <td colspan="3" style="color:#000; font-weight:bold;"><b>2. Habilidades Ativas Base (Q, W, E, R)</b></td>
            </tr>
            <tr bgcolor="#505050" style="color:#FFF; font-weight:bold; font-size:10px;">
                <td width="12%" align="center">Tecla</td>
                <td width="28%">Habilidade</td>
                <td width="60%">Descrição e Cooldown</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>[ Q ]</strong></td>
                <td><strong>Corrida Geométrica (Dash)</strong></td>
                <td>O jogador corre rapidamente (0.2s, 30.0 u/s) na direção desejada com imunidade a controles. Ao terminar, dispara um leque de **8 projéteis** causando 40% do dano base do jogador. <br/><strong>Tempo de Recarga:</strong> 5.0 segundos.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>[ W ]</strong></td>
                <td><strong>Onda Defensiva (Repel)</strong></td>
                <td>Emite uma onda circular de 10.0 unidades de raio que empurra inimigos próximos e reflete/reverte projéteis inimigos em voo de volta contra eles. <br/><strong>Tempo de Recarga:</strong> 8.0 segundos.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>[ E ]</strong></td>
                <td><strong>Escudo de Partículas (Shield)</strong></td>
                <td>Gera um escudo protetor eletromagnético por 15 segundos que absorve dano de até **150% da vida máxima** do jogador. <br/><strong>Tempo de Recarga:</strong> 20.0 segundos.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>[ R ]</strong></td>
                <td><strong>Sobrecarga Cósmica (Ultimate)</strong></td>
                <td>Ativa uma canalização divina que multiplica todo o dano causado pelo herói em **4.0x (400%)** por 25 segundos. No nível de skill 3, reduz o cooldown do ataque básico em 1.5x. <br/><strong>Tempo de Recarga:</strong> 50.0 segundos.</td>
            </tr>
        </table>

        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-bottom:20px;">
            <tr bgcolor="#D4C0A1">
                <td colspan="4" style="color:#000; font-weight:bold;"><b>3. Especialização das Torres (Passivas de Andares)</b></td>
            </tr>
            <tr bgcolor="#505050" style="color:#FFF; font-weight:bold; font-size:10px;">
                <td width="10%">Andar</td>
                <td width="30%" style="color:#ff3333;">Torre Vermelha (Dano)</td>
                <td width="30%" style="color:#228b22;">Torre Verde (Defesa)</td>
                <td width="30%" style="color:#800080;">Torre Roxa (Mágica/CDR)</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Andar 1</strong></td>
                <td><strong>+20% Chance Crítica:</strong> Eleva chance crítica para 25%.</td>
                <td><strong>+25% Vida Máxima:</strong> Aumenta o HP máximo base.</td>
                <td><strong>+30% CDR:</strong> Recarga das habilidades acelerada.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Andar 2</strong></td>
                <td><strong>10% Lifesteal:</strong> Cura ao bater com ataques básicos.</td>
                <td><strong>Reflexo de Espinhos:</strong> Devolve 15% do dano recebido.</td>
                <td><strong>20% Spellvamp:</strong> Cura baseada no dano de habilidades.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Andar 3</strong></td>
                <td><strong>Cleave Básico:</strong> Ataques causam dano em área.</td>
                <td><strong>Escudo Estático:</strong> Escudo fora de combate. Ao quebrar detona.</td>
                <td><strong>Spellblade:</strong> Próximo hit após magia ganha +30% de dano.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Andar 4</strong></td>
                <td><strong>Tetraedro Explosion:</strong> 4º golpe gera explosão de dano.</td>
                <td><strong>Cheat Death:</strong> Evita a morte fatal com imunidade por 2s.</td>
                <td><strong>Aura Tóxica:</strong> Causa dano tóxico a inimigos próximos por segundo.</td>
            </tr>
        </table>

        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-bottom:20px;">
            <tr bgcolor="#D4C0A1">
                <td colspan="3" style="color:#000; font-weight:bold;"><b>4. Mutações de Ultimate no Nível 20 (Baseadas na Torre Ativa)</b></td>
            </tr>
            <tr bgcolor="#505050" style="color:#FFF; font-weight:bold; font-size:10px;">
                <td width="20%">Torre Selecionada</td>
                <td width="30%">Nome da Evolução</td>
                <td width="50%">Efeito da Ultimate Mutada (R)</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td style="color:#ff3333; font-weight:bold;">Torre Vermelha</td>
                <td><strong>Chuva de Tetraedros<br/>Raio do Oblívio<br/>Corte Dimensional</strong></td>
                <td>Chuva de meteoros tetraédricos em área, causando dano massivo contínuo por 4s.<br/>Dispara um megashoot em linha reta de calor extremo que derrete inimigos.<br/>Dobra a velocidade e ataca inimigos em sequência com cortes críticos rápidos.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td style="color:#228b22; font-weight:bold;">Torre Verde</td>
                <td><strong>Bastião de Titânio<br/>Terremoto Geométrico<br/>Armadura Reativa</strong></td>
                <td>Gera um escudo impenetrável de 100% do HP máximo e imunidade total por 6s.<br/>Cria terremotos contínuos ao seu redor que dão dano e Stun (1s) a cada pulso.<br/>Reflete 50% do dano sofrido e atordoa o atacante por 1s.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td style="color:#800080; font-weight:bold;">Torre Roxa</td>
                <td><strong>Singularidade<br/>Distorção Temporal<br/>Reset Dimensional</strong></td>
                <td>Dispara um orbe que cria um buraco negro puxando inimigos próximos por 4s.<br/>Cria campo que congela inimigos e reduz tempo de recarga de suas magias em 80%.<br/>Blink à frente. Ao usar a ultimate, reseta instantaneamente os cooldowns de Q, W, E.</td>
            </tr>
        </table>

        <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
            <tr bgcolor="#D4C0A1">
                <td colspan="3" style="color:#000; font-weight:bold;"><b>5. Árvore de Upgrades do Herói (Níveis 5, 10, 15 e 20 Geral)</b></td>
            </tr>
            <tr bgcolor="#505050" style="color:#FFF; font-weight:bold; font-size:10px;">
                <td width="15%">Nível</td>
                <td width="25%">Nome do Aprimoramento</td>
                <td width="60%">Efeito de Modificação de Habilidade</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Nível 5</strong></td>
                <td><strong>Impacto Estilhaçante<br/>Rastro de Pólvora<br/>Convergência Assassina</strong></td>
                <td>Esferas do dash aplicam Armor Fracture (-25% defesa, 4s). Cooldown reduzido em 1s.<br/>Durante o dash, deixa minas no chão a cada 0.1s. Inimigos que pisam sofrem dano + queimadura.<br/>Cone de disparo estreito. Se 3+ esferas acertam o mesmo alvo: Silence 2s + buff Attack Speed.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Nível 10</strong></td>
                <td><strong>Campo de Hemorragia<br/>Refração Vital<br/>Vácuo Magnético</strong></td>
                <td>Inimigos repelidos recebem Bleed (5s, 10% do seu dano atual por segundo).<br/>Cada projétil revertido cura 3% HP máx. Se reverter 3+, limpa todos os debuffs da tela.<br/>Em vez de empurrar, puxa inimigos para o centro e aplica Slow 70% por 3s.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Nível 15</strong></td>
                <td><strong>Carapaça Reativa<br/>Bateria de Sobrecarga<br/>Fortaleza Inabalável</strong></td>
                <td>Ao receber dano no escudo, dispara projétil automático no atacante (50% dano absorvido).<br/>10% do dano absorvido pelo escudo é convertido em XP.<br/>Shield HP dobra (3x vida máx). Imune a Stun/Freeze/Root enquanto ativo.</td>
            </tr>
            <tr bgcolor="#F1E0C6" style="color:#000;">
                <td align="center"><strong>Nível 20 (Geral)</strong></td>
                <td><strong>Fúria Infinita<br/>Distorção Temporal<br/>Singularidade do Colapso</strong></td>
                <td>Cada abate durante a Ultimate adiciona +1s de duração.<br/>Durante a Ultimate, cooldowns de Q/W/E caem para 1 segundo.<br/>Armazena dano evitado. Ao fim da Ultimate, explode 200% do dano em raio 20.</td>
            </tr>
        </table>
    </div>';
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
