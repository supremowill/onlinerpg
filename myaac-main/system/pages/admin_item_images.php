<?php
// myaac-main/system/pages/admin_item_images.php
defined('MYAAC') or die('Direct access not allowed!');

$baseDir = dirname(__DIR__, 2); // /var/www/html
$path = $baseDir . '/item_images.json';
$itemsDir = $baseDir . '/items/';

function admin_item_images_backup_file($path, $bucket = 'items')
{
    if (!file_exists($path) || filesize($path) <= 0) {
        return '';
    }

    $safeBucket = preg_replace('/[^a-zA-Z0-9_\-]/', '', $bucket);
    $backupRoot = '/var/www/persistent-backups/' . ($safeBucket ?: 'items');
    if (!is_dir($backupRoot) && !mkdir($backupRoot, 0775, true)) {
        return 'Failed to create backup directory.';
    }

    $backupName = date('Ymd-His') . '-' . basename($path);
    if (!copy($path, $backupRoot . '/' . $backupName)) {
        return 'Failed to create backup before saving.';
    }

    return '';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['new_image'])) {
        $file = $_FILES['new_image'];
        if ($file['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($ext === 'png') {
                $filename = basename($file['name']);
                $filename = preg_replace("/[^a-zA-Z0-9_\-\.]/", "", $filename);
                $destination = $itemsDir . $filename;
                $backupError = admin_item_images_backup_file($destination, 'item_uploads');
                if ($backupError !== '') {
                    header('HTTP/1.1 500 Internal Server Error');
                    echo json_encode(['error' => $backupError]);
                    exit;
                }

                if (move_uploaded_file($file['tmp_name'], $destination)) {
                    header('Content-Type: application/json');
                    echo json_encode(['success' => true, 'filename' => $filename]);
                    exit;
                } else {
                    header('HTTP/1.1 500 Internal Server Error');
                    echo json_encode(['error' => 'Failed to move uploaded file']);
                    exit;
                }
            } else {
                header('HTTP/1.1 400 Bad Request');
                echo json_encode(['error' => 'Only PNG files are allowed']);
                exit;
            }
        } else {
            header('HTTP/1.1 400 Bad Request');
            echo json_encode(['error' => 'Upload error: ' . $file['error']]);
            exit;
        }
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if ($data) {
        if (isset($data['drop_rates'])) {
            $basic = (float)$data['drop_rates']['basic'];
            $epic = (float)$data['drop_rates']['epic'];
            $legendary = (float)$data['drop_rates']['legendary'];
            if ($basic + $epic + $legendary <= 100 && $basic >= 0 && $epic >= 0 && $legendary >= 0) {
                $dropRatesPath = $baseDir . '/item_drop_rates.json';
                $backupError = admin_item_images_backup_file($dropRatesPath, 'item_json');
                if ($backupError !== '') {
                    header('HTTP/1.1 500 Internal Server Error');
                    echo json_encode(['error' => $backupError]);
                    exit;
                }

                $ratesSaved = file_put_contents($dropRatesPath, json_encode([
                    'basic' => $basic,
                    'epic' => $epic,
                    'legendary' => $legendary
                ], JSON_PRETTY_PRINT)) !== false;

                if ($ratesSaved) {
                    // Try to hot-reload game server
                    $ch = curl_init('http://app:3000/api/admin/reload-data');
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
                    $response = curl_exec($ch);
                    curl_close($ch);

                    header('Content-Type: application/json');
                    echo json_encode(['success' => true]);
                    exit;
                } else {
                    header('HTTP/1.1 500 Internal Server Error');
                    echo json_encode(['error' => 'Failed to save drop rates to item_drop_rates.json']);
                    exit;
                }
            } else {
                header('HTTP/1.1 400 Bad Request');
                echo json_encode(['error' => 'Invalid drop rates values. Sum must not exceed 100% and rates must be non-negative.']);
                exit;
            }
        }

        if (isset($data['images']) && isset($data['names'])) {
            $imagesBackupError = admin_item_images_backup_file($path, 'item_json');
            $namesBackupError = admin_item_images_backup_file($baseDir . '/item_names.json', 'item_json');
            if ($imagesBackupError !== '' || $namesBackupError !== '') {
                header('HTTP/1.1 500 Internal Server Error');
                echo json_encode(['error' => $imagesBackupError ?: $namesBackupError]);
                exit;
            }

            $imagesSaved = file_put_contents($path, json_encode($data['images'], JSON_PRETTY_PRINT)) !== false;
            $namesSaved = file_put_contents($baseDir . '/item_names.json', json_encode($data['names'], JSON_PRETTY_PRINT)) !== false;
            if ($imagesSaved && $namesSaved) {
                header('Content-Type: application/json');
                echo json_encode(['success' => true]);
                exit;
            } else {
                header('HTTP/1.1 500 Internal Server Error');
                echo json_encode(['error' => 'Failed to save changes. Check file permissions.']);
                exit;
            }
        } else {
            // Fallback for auto-save of single image mapping
            $backupError = admin_item_images_backup_file($path, 'item_json');
            if ($backupError !== '') {
                header('HTTP/1.1 500 Internal Server Error');
                echo json_encode(['error' => $backupError]);
                exit;
            }

            if (file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT)) !== false) {
                header('Content-Type: application/json');
                echo json_encode(['success' => true]);
                exit;
            } else {
                header('HTTP/1.1 500 Internal Server Error');
                echo json_encode(['error' => 'Failed to write item_images.json. Check file permissions.']);
                exit;
            }
        }
    } else {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }
}

$mapping = [];
if (file_exists($path)) {
    $mapping = json_decode(file_get_contents($path), true) ?: [];
}

$dropRatesPath = $baseDir . '/item_drop_rates.json';
$dropRates = ['basic' => 18.0, 'epic' => 1.5, 'legendary' => 0.5];
if (file_exists($dropRatesPath)) {
    $ratesJson = json_decode(file_get_contents($dropRatesPath), true);
    if (is_array($ratesJson) && isset($ratesJson['basic']) && isset($ratesJson['epic']) && isset($ratesJson['legendary'])) {
        $dropRates = $ratesJson;
    }
}

$custom_names = [];
$namesPath = $baseDir . '/item_names.json';
if (file_exists($namesPath)) {
    $custom_names = json_decode(file_get_contents($namesPath), true) ?: [];
}

$all_images = [];
if (is_dir($itemsDir)) {
    $files = scandir($itemsDir);
    foreach ($files as $f) {
        if (strtolower(pathinfo($f, PATHINFO_EXTENSION)) === 'png') {
            $all_images[] = $f;
        }
    }
}
$all_images_json = json_encode($all_images);


// 51 items list
$items = [
    'espada_basica' => ['name' => 'Lâmina Fragmentada', 'rarity' => 'basic'],
    'escudo_ferro' => ['name' => 'Escudo Primitivo', 'rarity' => 'basic'],
    'bota_velocidade' => ['name' => 'Propulsor de Íons', 'rarity' => 'basic'],
    'pocao_vida' => ['name' => 'Injetor de Nanobots', 'rarity' => 'basic'],
    'armadura_aco' => ['name' => 'Chassi Reforçado', 'rarity' => 'basic'],
    'amuleto_magico' => ['name' => 'Núcleo de Ressonância', 'rarity' => 'epic'],
    'prisma_faiscas' => ['name' => 'Prisma de Faiscas', 'rarity' => 'basic'],
    'cubo_toxico' => ['name' => 'Cubo Tóxico', 'rarity' => 'basic'],
    'lamina_triangular' => ['name' => 'Lâmina Triangular', 'rarity' => 'basic'],
    'cilindro_corrosivo' => ['name' => 'Cilindro Corrosivo', 'rarity' => 'basic'],
    'orbe_enfermo' => ['name' => 'Orbe Enfermo', 'rarity' => 'basic'],
    'icosaedro_gelido' => ['name' => 'Icosaedro Gélido', 'rarity' => 'basic'],
    'bloco_pesado' => ['name' => 'Bloco Pesado', 'rarity' => 'basic'],
    'raizes_poligonais' => ['name' => 'Raízes Poligonais', 'rarity' => 'basic'],
    'cone_lentidao' => ['name' => 'Cone da Lentidão', 'rarity' => 'basic'],
    'luz_prismatica' => ['name' => 'Luz Prismática', 'rarity' => 'basic'],
    'esfera_mudo' => ['name' => 'Esfera do Mudo', 'rarity' => 'basic'],
    'espelho_distorcido' => ['name' => 'Espelho Distorcido', 'rarity' => 'basic'],
    'tetraedro_panico' => ['name' => 'Tetraedro do Pânico', 'rarity' => 'basic'],
    'placa_provocador' => ['name' => 'Placa do Provocador', 'rarity' => 'basic'],
    'lente_fenda' => ['name' => 'Lente da Fenda', 'rarity' => 'basic'],
    'tijolo_exaustivo' => ['name' => 'Tijolo Exaustivo', 'rarity' => 'basic'],
    'circulo_cansaco' => ['name' => 'Círculo do Cansaço', 'rarity' => 'basic'],
    'seta_marcadora' => ['name' => 'Seta Marcadora', 'rarity' => 'basic'],
    'cunha_serrilhada' => ['name' => 'Cunha Serrilhada', 'rarity' => 'basic'],
    'cristal_vitalidade' => ['name' => 'Cristal de Vitalidade', 'rarity' => 'basic'],
    'vento_cubico' => ['name' => 'Vento Cúbico', 'rarity' => 'basic'],
    'estilhaco_furia' => ['name' => 'Estilhaço de Fúria', 'rarity' => 'basic'],
    'mini_escudo_planar' => ['name' => 'Mini-Escudo Planar', 'rarity' => 'basic'],
    'cacto_geometrico' => ['name' => 'Cacto Geométrico', 'rarity' => 'basic'],
    'presa_poligono' => ['name' => 'Presa de Polígono', 'rarity' => 'basic'],
    'peso_balanceador' => ['name' => 'Peso Balanceador', 'rarity' => 'basic'],
    'motor_hasteado' => ['name' => 'Motor Hasteado', 'rarity' => 'basic'],
    'frasco_sangue' => ['name' => 'Frasco Quadrado de Sangue', 'rarity' => 'basic'],
    'frasco_veneno' => ['name' => 'Frasco Quadrado de Veneno', 'rarity' => 'basic'],
    'relogio_triangular' => ['name' => 'Relógio Triangular', 'rarity' => 'basic'],
    'dodecaedro_carnificina' => ['name' => 'Dodecaedro da Carnificina', 'rarity' => 'epic'],
    'bastiao_gelo' => ['name' => 'Bastião de Gelo', 'rarity' => 'epic'],
    'casco_toxico' => ['name' => 'Casco Tóxico Farpado', 'rarity' => 'epic'],
    'lamina_sanguessuga' => ['name' => 'Lâmina Sanguessuga', 'rarity' => 'epic'],
    'epidemia_acida' => ['name' => 'Epidemia Ácida', 'rarity' => 'epic'],
    'olho_aterrorizante' => ['name' => 'O Olho Aterrorizante', 'rarity' => 'epic'],
    'megafone_conico' => ['name' => 'Megafone Cônico', 'rarity' => 'epic'],
    'grilhoes_cansaco' => ['name' => 'Grilhões do Cansaço', 'rarity' => 'epic'],
    'pendulo_curativo' => ['name' => 'Pêndulo Curativo', 'rarity' => 'epic'],
    'prisma_duelista' => ['name' => 'Prisma do Duelista', 'rarity' => 'epic'],
    'cubo_infinito' => ['name' => 'Cubo do Infinito', 'rarity' => 'legendary'],
    'prisma_calamidade' => ['name' => 'Prisma da Calamidade', 'rarity' => 'legendary'],
    'tetraedro_distorcao' => ['name' => 'Tetraedro da Distorção Temporal', 'rarity' => 'legendary'],
    'coroa_gelida' => ['name' => 'Coroa Gélida do Lich', 'rarity' => 'legendary'],
    'coracao_raziel' => ['name' => 'O Coração Cúbico de Raziel', 'rarity' => 'legendary']
];

// Merge custom names
foreach ($items as $id => &$details) {
    if (isset($custom_names[$id])) {
        $details['name'] = $custom_names[$id];
    }
}
unset($details);

$rowsHtml = '';
$bgCounter = 0;
foreach ($items as $id => $details) {
    $bgColor = ($bgCounter++ % 2 === 0) ? '#F1E0C6' : '#D4C0A1';
    $currentImage = isset($mapping[$id]) ? $mapping[$id] : 'item1.png';
    
    $badgeColor = '#555';
    if ($details['rarity'] === 'epic') $badgeColor = '#800080';
    elseif ($details['rarity'] === 'legendary') $badgeColor = '#b35900';

    $rowsHtml .= '
    <tr bgcolor="' . $bgColor . '" class="item-row" data-id="' . $id . '" data-name="' . htmlspecialchars($details['name']) . '" style="color:#000; font-size:11px;">
        <td width="30%">
            <input type="text" class="tibia-item-name-input" data-id="' . $id . '" value="' . htmlspecialchars($details['name']) . '" style="width:90%; padding:4px; font-size:11px; border:1px solid #5a2800; font-weight:bold; color:#000; background:#fcfcfc;" /><br/>
            <small style="color:#555; font-family:monospace;">' . $id . '</small>
        </td>
        <td width="20%"><span style="color:' . $badgeColor . '; font-weight:bold; text-transform:uppercase;">' . $details['rarity'] . '</span></td>
        <td width="35%">
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:#e6d5bc; border:1px solid #5a2800; border-radius:4px;">
                    <img id="img-' . $id . '" src="" data-filename="' . $currentImage . '" style="width:28px; height:28px; object-fit:contain;" />
                </div>
                <span id="lbl-' . $id . '" style="font-family:monospace; font-weight:bold;">' . $currentImage . '</span>
            </div>
        </td>
        <td width="15%" align="center">
            <button class="tibia-admin-btn" onclick="openImageSelector(\'' . $id . '\')">Alterar Foto</button>
        </td>
    </tr>';
}

$content = '
<style>
    .tibia-admin-btn {
        background: linear-gradient(to bottom, #966c46, #533821);
        border: 1px solid #3f250a;
        color: #f1e0c6;
        padding: 4px 8px;
        font-family: Verdana, Arial, sans-serif;
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        text-shadow: 1px 1px #000;
        border-radius: 2px;
    }
    .tibia-admin-btn:hover {
        background: linear-gradient(to bottom, #b4855b, #6a4a2f);
    }
    .tibia-admin-btn-save {
        background: linear-gradient(to bottom, #ffb366, #b35900);
        border: 1px solid #4a2500;
        color: #fff;
        padding: 6px 15px;
        font-size: 11px;
        margin-left: 10px;
    }
    .tibia-admin-btn-save:hover {
        background: linear-gradient(to bottom, #ffd1a3, #e67300);
    }
    .tibia-admin-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.6);
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }
    .tibia-admin-modal-content {
        background-color: #f1e0c6;
        border: 2px solid #5a2800;
        padding: 15px;
        width: 80%;
        max-width: 650px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
    .gallery-grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(65px, 1fr));
        gap: 6px;
        max-height: 300px;
        overflow-y: auto;
        padding: 8px;
        background: #e6d5bc;
        border: 1px solid #5a2800;
        margin: 10px 0;
    }
    .gallery-grid-item {
        background: #f1e0c6;
        border: 1px solid #5a2800;
        padding: 4px;
        text-align: center;
        cursor: pointer;
        transition: transform 0.1s, border-color 0.1s;
    }
    .gallery-grid-item:hover {
        border-color: #b35900;
        transform: scale(1.05);
    }
</style>

<div class="tibia-admin-container">
    <p style="font-size:11px; color:#000; margin-bottom:15px;">
        Vincule cada um dos 51 itens equipáveis do jogo ao arquivo de imagem PNG correto.
        Suas alterações são salvas diretamente em <code>item_images.json</code> e serão refletidas no jogo e em todas as telas do site.
    </p>

    <!-- Drop Rates Management Table -->
    <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050" style="margin-bottom: 20px;">
        <tr bgcolor="#D4C0A1">
            <td colspan="4" style="color:#000; font-weight:bold; font-size:12px;"><b>Gerenciador de Taxa de Drop (Drop Rates)</b></td>
        </tr>
        <tr bgcolor="#F1E0C6" style="color:#000; font-size:11px;">
            <td width="25%">
                <b>Básicos:</b><br/>
                <input type="number" step="0.01" min="0" max="100" id="drop-basic" value="' . htmlspecialchars($dropRates['basic']) . '" style="width:80px; padding:4px; font-size:11px; border:1px solid #5a2800; background:#fcfcfc;" oninput="updateNoDropRate()" /> %
            </td>
            <td width="25%">
                <b>Épicos:</b><br/>
                <input type="number" step="0.01" min="0" max="100" id="drop-epic" value="' . htmlspecialchars($dropRates['epic']) . '" style="width:80px; padding:4px; font-size:11px; border:1px solid #5a2800; background:#fcfcfc;" oninput="updateNoDropRate()" /> %
            </td>
            <td width="25%">
                <b>Lendários:</b><br/>
                <input type="number" step="0.01" min="0" max="100" id="drop-legendary" value="' . htmlspecialchars($dropRates['legendary']) . '" style="width:80px; padding:4px; font-size:11px; border:1px solid #5a2800; background:#fcfcfc;" oninput="updateNoDropRate()" /> %
            </td>
            <td width="25%" align="center">
                <b>Chance de Não Cair Nada (Sem Drop):</b><br/>
                <span id="drop-none" style="font-weight:bold; font-size:13px; color:#5a2800;">80.00%</span>
            </td>
        </tr>
        <tr bgcolor="#D4C0A1">
            <td colspan="4" align="right">
                <span id="drop-warning" style="color:red; font-weight:bold; font-size:11px; margin-right:15px; display:none;">A soma das taxas não pode ultrapassar 100%!</span>
                <button class="tibia-admin-btn tibia-admin-btn-save" style="margin: 4px;" onclick="saveDropRates()">💾 SALVAR TAXAS</button>
            </td>
        </tr>
    </table>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <div>
            <input type="text" id="tibia-item-search" placeholder="Filtrar itens..." style="width:200px; padding:4px; font-size:11px; border:1px solid #5a2800;" />
        </div>
        <div>
            <button class="tibia-admin-btn tibia-admin-btn-save" onclick="saveAllMappings()">💾 SALVAR MAPEAMENTO</button>
        </div>
    </div>

    <table border="0" cellpadding="4" cellspacing="1" width="100%" bgcolor="#505050">
        <tr bgcolor="#D4C0A1">
            <td colspan="4" style="color:#000; font-weight:bold; font-size:12px;"><b>Gerenciador de Imagens dos Itens</b></td>
        </tr>
        <tr bgcolor="#505050" style="color:white; font-weight:bold; font-size:11px;">
            <td>Item</td>
            <td>Raridade</td>
            <td>Imagem Vinculada</td>
            <td align="center">Ações</td>
        </tr>
        ' . $rowsHtml . '
    </table>
</div>

<!-- Modal Galeria -->
<div class="tibia-admin-modal" id="gallery-modal">
    <div class="tibia-admin-modal-content">
        <h3 style="color:#5A2800; margin-top:0; font-weight:bold; font-size:14px; border-bottom:1px solid #5a2800; padding-bottom:5px;" id="modal-title">Selecionar Imagem</h3>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <input type="text" id="gallery-search" placeholder="Buscar por número (ex: item40)..." style="width:140px; padding:4px; font-size:11px; border:1px solid #5a2800;" />
            <button class="tibia-admin-btn" style="background: linear-gradient(to bottom, #4caf50, #2e7d32); margin-left:5px; padding:4px 8px; color:white;" onclick="document.getElementById(\'upload-input\').click()">Enviar PNG</button>
            <input type="file" id="upload-input" accept="image/png" style="display: none;" onchange="uploadImage(this)" />
            <div style="display:flex; align-items:center; gap:5px; font-size:11px; font-weight:bold; margin-left:auto;" id="pagination-controls">
                <button class="tibia-admin-btn" onclick="changePage(-1)">◄</button>
                <span id="page-indicator" style="padding:0 5px; font-family:monospace;">Pág. 1 / 16</span>
                <button class="tibia-admin-btn" onclick="changePage(1)">►</button>
            </div>
        </div>

        <div id="gallery-grid" class="gallery-grid-container">
            <!-- Gerado dinamicamente -->
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
            <button class="tibia-admin-btn" style="background:#8b0000;" onclick="closeImageSelector()">Cancelar</button>
        </div>
    </div>
</div>

<script>
    (function() {
        const ITEMS_BASE_URL = window.location.origin + "/items/";

        const allImageFilenames = ' . $all_images_json . ';
        const totalImages = allImageFilenames.length;
        const imagesPerPage = 80;

        let currentEditingItemId = null;
        let currentPage = 1;
        let isFiltering = false;
        let filteredImages = [];

        // Inicializa previews dos itens na tabela
        document.querySelectorAll(".item-row img").forEach(img => {
            const file = img.getAttribute("data-filename");
            img.src = ITEMS_BASE_URL + file;
        });

        window.uploadImage = async function(input) {
            if (!input.files || input.files.length === 0) return;
            const file = input.files[0];
            
            const formData = new FormData();
            formData.append("new_image", file);
            formData.append("upload_image", "1");

            try {
                const res = await fetch("?subtopic=admin/item_images", {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert("Imagem enviada com sucesso!");
                    allImageFilenames.push(data.filename);
                    if (currentEditingItemId) {
                        selectImage(data.filename);
                    }
                    renderGallery();
                } else {
                    alert("Erro ao enviar imagem: " + (data.error || "Desconhecido"));
                }
            } catch (e) {
                alert("Erro de conexão ao enviar imagem: " + e.message);
            }
            input.value = "";
        };

        // Filtro de Busca de Itens na tabela
        document.getElementById("tibia-item-search").addEventListener("input", function(e) {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll(".item-row").forEach(row => {
                const name = row.getAttribute("data-name").toLowerCase();
                const id = row.getAttribute("data-id").toLowerCase();
                if (name.includes(query) || id.includes(query)) {
                    row.style.display = "";
                } else {
                    row.style.display = "none";
                }
            });
        });

        // Filtro de Busca na Galeria do modal
        document.getElementById("gallery-search").addEventListener("input", function(e) {
            const query = e.target.value.toLowerCase().trim();
            if (query === "") {
                isFiltering = false;
                currentPage = 1;
                renderGallery();
                document.getElementById("pagination-controls").style.display = "flex";
            } else {
                isFiltering = true;
                filteredImages = allImageFilenames.filter(name => name.toLowerCase().includes(query));
                renderGallery();
                document.getElementById("pagination-controls").style.display = "none";
            }
        });

        window.openImageSelector = function(itemId) {
            currentEditingItemId = itemId;
            const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
            const itemName = row.getAttribute("data-name");

            document.getElementById("modal-title").innerText = `Escolher Foto para: ${itemName}`;
            document.getElementById("gallery-search").value = "";
            isFiltering = false;
            currentPage = 1;

            renderGallery();
            document.getElementById("pagination-controls").style.display = "flex";
            document.getElementById("gallery-modal").style.display = "flex";
        };

        window.closeImageSelector = function() {
            document.getElementById("gallery-modal").style.display = "none";
            currentEditingItemId = null;
        };

        function renderGallery() {
            const grid = document.getElementById("gallery-grid");
            grid.innerHTML = "";

            let listToRender = [];
            if (isFiltering) {
                listToRender = filteredImages;
            } else {
                const startIdx = (currentPage - 1) * imagesPerPage;
                const endIdx = Math.min(startIdx + imagesPerPage, allImageFilenames.length);
                listToRender = allImageFilenames.slice(startIdx, endIdx);

                const totalPages = Math.ceil(allImageFilenames.length / imagesPerPage);
                document.getElementById("page-indicator").innerText = `Pág. ${currentPage} / ${totalPages}`;
            }

            if (listToRender.length === 0) {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#5a2800; padding:15px; font-weight:bold;">Nenhuma imagem encontrada.</div>`;
                return;
            }

            listToRender.forEach(filename => {
                const div = document.createElement("div");
                div.className = "gallery-grid-item";
                div.onclick = () => selectImage(filename);
                div.innerHTML = `
                    <img src="${ITEMS_BASE_URL}${filename}" style="width:24px; height:24px; object-fit:contain;" loading="lazy" /><br/>
                    <span style="font-size:8px; color:#5a2800; font-family:monospace; display:block; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${filename}</span>
                `;
                grid.appendChild(div);
            });
        }

        window.changePage = function(dir) {
            const totalPages = Math.ceil(allImageFilenames.length / imagesPerPage);
            currentPage += dir;
            if (currentPage < 1) currentPage = 1;
            if (currentPage > totalPages) currentPage = totalPages;
            renderGallery();
        };

        async function selectImage(filename) {
            if (!currentEditingItemId) return;

            const img = document.getElementById(`img-${currentEditingItemId}`);
            img.src = ITEMS_BASE_URL + filename;
            img.setAttribute("data-filename", filename);

            const lbl = document.getElementById(`lbl-${currentEditingItemId}`);
            lbl.innerText = filename;

            closeImageSelector();

            // Auto-save the changes (both images and names)
            const mapping = {};
            const names = {};
            document.querySelectorAll(".item-row img").forEach(imgEl => {
                const itemId = imgEl.id.replace("img-", "");
                const file = imgEl.getAttribute("data-filename");
                mapping[itemId] = file;
            });
            document.querySelectorAll(".tibia-item-name-input").forEach(input => {
                const itemId = input.getAttribute("data-id");
                names[itemId] = input.value;
            });

            try {
                const res = await fetch("?subtopic=admin/item_images", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ images: mapping, names: names })
                });

                if (res.ok) {
                    console.log("Auto-saved successfully!");
                } else {
                    alert("Falha ao salvar as alterações no servidor.");
                }
            } catch (e) {
                alert("Erro ao conectar ao servidor para salvar: " + e.message);
            }
        }

        window.saveAllMappings = async function() {
            const mapping = {};
            const names = {};
            document.querySelectorAll(".item-row img").forEach(img => {
                const itemId = img.id.replace("img-", "");
                const file = img.getAttribute("data-filename");
                mapping[itemId] = file;
            });
            document.querySelectorAll(".tibia-item-name-input").forEach(input => {
                const itemId = input.getAttribute("data-id");
                names[itemId] = input.value;
            });

            try {
                const res = await fetch("?subtopic=admin/item_images", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ images: mapping, names: names })
                });

                if (res.ok) {
                    alert("Mapeamento e nomes dos itens atualizados com sucesso!");
                    // recarregar
                    window.location.reload();
                } else {
                    alert("Falha ao salvar as alterações no servidor.");
                }
            } catch (e) {
                alert("Erro ao conectar ao servidor para salvar: " + e.message);
            }
        };

        window.updateNoDropRate = function() {
            const basic = parseFloat(document.getElementById("drop-basic").value) || 0;
            const epic = parseFloat(document.getElementById("drop-epic").value) || 0;
            const legendary = parseFloat(document.getElementById("drop-legendary").value) || 0;
            const sum = basic + epic + legendary;
            const none = Math.max(0, 100 - sum);

            const noneEl = document.getElementById("drop-none");
            noneEl.innerText = none.toFixed(2) + "%";

            const warningEl = document.getElementById("drop-warning");
            if (sum > 100) {
                warningEl.style.display = "inline";
                noneEl.style.color = "red";
            } else {
                warningEl.style.display = "none";
                noneEl.style.color = "#5a2800";
            }
        };

        // Call initially
        window.updateNoDropRate();

        window.saveDropRates = async function() {
            const basic = parseFloat(document.getElementById("drop-basic").value) || 0;
            const epic = parseFloat(document.getElementById("drop-epic").value) || 0;
            const legendary = parseFloat(document.getElementById("drop-legendary").value) || 0;
            const sum = basic + epic + legendary;

            if (sum > 100) {
                alert("A soma das taxas de drop não pode exceder 100%!");
                return;
            }

            try {
                const res = await fetch("?subtopic=admin/item_images", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        drop_rates: { basic, epic, legendary }
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    alert("Taxas de drop atualizadas com sucesso!");
                } else {
                    alert("Erro ao salvar taxas de drop: " + (data.error || "Desconhecido"));
                }
            } catch (e) {
                alert("Erro de conexão ao salvar: " + e.message);
            }
        };
    })();
</script>
';

echo $content;
