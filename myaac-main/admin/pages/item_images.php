<?php
// myaac-main/admin/pages/item_images.php
defined('MYAAC') or die('Direct access not allowed!');
$title = 'Item Images Manager';

$baseDir = dirname(__DIR__, 2); // /var/www/html
$path = $baseDir . '/item_images.json';
$itemsDir = $baseDir . '/items/';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['new_image'])) {
        $file = $_FILES['new_image'];
        if ($file['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($ext === 'png') {
                $filename = basename($file['name']);
                $filename = preg_replace("/[^a-zA-Z0-9_\-\.]/", "", $filename);
                if (move_uploaded_file($file['tmp_name'], $itemsDir . $filename)) {
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
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
        exit;
    } else {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }
}

$mapping = [];
if (file_exists($path)) {
    $mapping = json_decode(file_get_contents($path), true);
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


// Map the items list exactly as defined in the game client database
$items = [
    'espada_basica' => ['name' => 'Lâmina Fragmentada', 'rarity' => 'basic'],
    'escudo_ferro' => ['name' => 'Escudo Primitivo', 'rarity' => 'basic'],
    'bota_velocidade' => ['name' => 'Propulsor de Íons', 'rarity' => 'basic'],
    'pocao_vida' => ['name' => 'Injetor de Nanobots', 'rarity' => 'basic'],
    'armadura_aco' => ['name' => 'Chassi Reforçado', 'rarity' => 'basic'],
    'amuleto_magico' => ['name' => 'Núcleo de Ressonância', 'rarity' => 'epic'],

    // --- 🟢 ITENS BÁSICOS ---
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

    // --- 🟣 ITENS ÉPICOS ---
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

    // --- 🟠 ITENS LENDÁRIOS ---
    'cubo_infinito' => ['name' => 'Cubo do Infinito', 'rarity' => 'legendary'],
    'prisma_calamidade' => ['name' => 'Prisma da Calamidade', 'rarity' => 'legendary'],
    'tetraedro_distorcao' => ['name' => 'Tetraedro da Distorção Temporal', 'rarity' => 'legendary'],
    'coroa_gelida' => ['name' => 'Coroa Gélida do Lich', 'rarity' => 'legendary'],
    'coracao_raziel' => ['name' => 'O Coração Cúbico de Raziel', 'rarity' => 'legendary']
];

$twig->display('admin.item_images.html.twig', [
    'items' => $items,
    'mapping' => $mapping,
    'all_images' => $all_images,
    'api_url' => BASE_URL . 'admin/?p=item_images'
]);
