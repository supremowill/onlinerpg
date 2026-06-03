<?php
// myaac-main/system/pages/market.php
// Get token from PHP session if logged in
$session_token = '';
$is_logged = false;
$player_name = '';
if (isset($_SESSION['player_id'])) {
    $session_token = generateJWT($_SESSION['player_id'], $_SESSION['player_name'], $_SESSION['is_admin'] ?? false);
    $is_logged = true;
    $player_name = $_SESSION['player_name'];
}

$images_mapping = [];
$mapping_path = __DIR__ . '/../../item_images.json';
if (file_exists($mapping_path)) {
    $images_mapping = json_decode(file_get_contents($mapping_path), true);
}

$names_mapping = [];
$names_path = __DIR__ . '/../../item_names.json';
if (file_exists($names_path)) {
    $names_mapping = json_decode(file_get_contents($names_path), true);
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Mercado Quântico - P2P Marketplace</title>
    <style>
    .market-container {
        font-family: Verdana, Arial, sans-serif;
        color: #3A1A05;
        margin: 10px 0;
    }
    .market-title {
        font-size: 1.6rem;
        color: #5A2800;
        font-weight: bold;
        border-bottom: 2px solid #5A2800;
        padding-bottom: 5px;
        margin-bottom: 15px;
    }
    .market-subtitle {
        font-size: 1.1rem;
        color: #5A2800;
        font-weight: bold;
        border-bottom: 1px solid #D4C0A1;
        padding-bottom: 5px;
        margin-top: 15px;
        margin-bottom: 10px;
    }
    .market-economy-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background-color: #D4C0A1;
        border: 1px solid #5A2800;
        margin-bottom: 20px;
        font-size: 0.9rem;
        font-weight: bold;
    }
    .market-coins {
        color: #B25900;
        font-weight: bold;
    }
    .market-layout-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 20px;
    }
    @media (max-width: 900px) {
        .market-layout-grid {
            grid-template-columns: 1fr;
        }
    }
    .market-panel {
        background-color: #F1E0C6;
        border: 1px solid #5A2800;
        padding: 15px;
        margin-bottom: 20px;
        box-shadow: 1px 1px 4px rgba(0,0,0,0.1);
    }
    .market-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        border: 1px solid #5A2800;
    }
    .market-table th {
        background-color: #5A2800;
        color: #F1E0C6;
        text-align: left;
        padding: 8px;
        font-size: 0.85rem;
        font-weight: bold;
        border: 1px solid #5A2800;
    }
    .market-table td {
        padding: 8px;
        border: 1px solid #D4C0A1;
        font-size: 0.85rem;
        vertical-align: middle;
    }
    .market-table tr:nth-child(even) td {
        background-color: #E6D5BC;
    }
    .market-table tr:nth-child(odd) td {
        background-color: #F1E0C6;
    }
    .market-table tr:hover td {
        background-color: #D4C0A1;
    }
    .market-item-name {
        font-weight: bold;
        color: #5A2800;
        font-size: 0.9rem;
    }
    .market-item-meta {
        font-size: 0.75rem;
        color: #666;
        margin-top: 2px;
    }
    .market-seller-badge {
        font-weight: bold;
        color: #3A1A05;
    }
    .market-price-badge {
        font-weight: bold;
        color: #A05000;
    }
    .market-item-rarity {
        font-size: 0.75rem;
        text-transform: uppercase;
        font-weight: bold;
    }
    .market-rarity-legendary { color: #b35900; }

    .market-item-icon {
        width: 32px;
        height: 32px;
        object-fit: contain;
        vertical-align: middle;
        margin-right: 8px;
    }
    .market-inventory-icon-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 40px;
        margin: 5px 0;
    }
    .market-inventory-icon {
        width: 36px;
        height: 36px;
        object-fit: contain;
    }

    /* Inventory Grid */
    .market-inventory-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 8px;
        max-height: 250px;
        overflow-y: auto;
        padding: 8px;
        background-color: #E6D5BC;
        border: 1px solid #D4C0A1;
        margin-top: 10px;
    }
    .market-inventory-item {
        background-color: #F1E0C6;
        border: 1px solid #5A2800;
        padding: 8px;
        text-align: center;
        font-size: 0.8rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 75px;
        box-shadow: 1px 1px 3px rgba(0,0,0,0.05);
    }
    .market-inventory-item:hover {
        background-color: #D4C0A1;
        border-color: #A05000;
    }
    .market-item-title {
        font-weight: bold;
        color: #3A1A05;
        font-size: 0.8rem;
    }

    /* Buttons */
    .market-btn {
        background: linear-gradient(to bottom, #966c46, #533821);
        border: 1px solid #3f250a;
        color: #f1e0c6;
        padding: 5px 10px;
        font-family: Verdana, Arial, sans-serif;
        font-size: 0.75rem;
        font-weight: bold;
        cursor: pointer;
        text-shadow: 1px 1px #000;
        transition: background 0.2s;
    }
    .market-btn:hover {
        background: linear-gradient(to bottom, #b3855c, #6d4b2f);
    }
    .market-btn:active {
        background: #48301b;
    }
    .market-btn:disabled {
        background: #cccccc;
        color: #666666;
        border-color: #999999;
        text-shadow: none;
        cursor: not-allowed;
    }
    .market-btn-sell {
        margin-top: 6px;
        padding: 3px 6px;
        font-size: 0.7rem;
    }
    .market-btn-cancel {
        background: linear-gradient(to bottom, #d9534f, #ac2925);
        border-color: #761c19;
    }
    .market-btn-cancel:hover {
        background: linear-gradient(to bottom, #e27c79, #c9302c);
    }

    /* Modal */
    .market-modal {
        display: none;
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        justify-content: center;
        align-items: center;
    }
    .market-modal-content {
        background-color: #F1E0C6;
        border: 3px double #5A2800;
        padding: 20px;
        width: 280px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        text-align: center;
        color: #3A1A05;
    }
    .market-modal-input {
        width: 70%;
        padding: 6px;
        margin: 12px 0;
        background-color: #FFF;
        border: 1px solid #5A2800;
        color: #3A1A05;
        font-size: 1rem;
        text-align: center;
        font-weight: bold;
    }
    .market-modal-buttons {
        display: flex;
        justify-content: space-around;
        margin-top: 10px;
    }

    .market-empty-text {
        color: #666;
        font-style: italic;
        font-size: 0.8rem;
        text-align: center;
        padding: 15px 0;
    }
    </style>
</head>
<body>

<div class="market-container">
    <div class="market-title">Mercado Quântico (P2P)</div>
    
    <div class="market-economy-bar">
        <span>Câmbio de Itens</span>
        <span>Jogador: <strong style="color: #5A2800;"><?php echo htmlspecialchars($player_name ?: 'Convidado'); ?></strong> | Saldo: <span class="market-coins" id="coin-balance">-- Coins</span></span>
    </div>

    <?php if (!$is_logged): ?>
        <div style="text-align:center; padding:40px 20px; border:2px dashed #d9534f; background-color:#f2dede; color:#a94442;">
            <h3 style="margin-top:0; color:#a94442; font-weight:bold;">Autenticação Necessária</h3>
            <p>Por favor, faça login em sua conta para acessar o mercado de itens.</p>
            <a href="?subtopic=account/manage" class="market-btn" style="text-decoration:none; display:inline-block; margin-top:10px;">Entrar na Conta</a>
        </div>
    <?php else: ?>
        <div class="market-layout-grid">
            <!-- Left Panel: Market Listings -->
            <div>
                <div class="market-panel">
                    <div class="market-subtitle" style="margin-top:0;">Itens à Venda</div>
                    <table class="market-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Vendedor</th>
                                <th>Preço</th>
                                <th style="width: 80px; text-align: center;">Ação</th>
                            </tr>
                        </thead>
                        <tbody id="offers-list">
                            <tr>
                                <td colspan="4" class="market-empty-text">Buscando ofertas ativas...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Right Panels: Inventory & My Listings -->
            <div>
                <div class="market-panel">
                    <div class="market-subtitle" style="margin-top:0;">Seu Inventário</div>
                    <p style="font-size:0.75rem; color:#666; margin-top:-5px; margin-bottom:10px;">Clique em "Vender" em um dos itens do seu personagem.</p>
                    <div class="market-inventory-grid" id="inventory-grid">
                        <div class="market-empty-text">Carregando inventário...</div>
                    </div>
                </div>

                <div class="market-panel">
                    <div class="market-subtitle" style="margin-top:0;">Minhas Vendas Ativas</div>
                    <table class="market-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Preço</th>
                                <th style="width: 80px; text-align: center;">Ação</th>
                            </tr>
                        </thead>
                        <tbody id="my-offers-list">
                            <tr>
                                <td colspan="3" class="market-empty-text">Você não tem ofertas ativas.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    <?php endif; ?>
</div>

<!-- Modal para colocar preço -->
<div class="market-modal" id="sell-modal">
    <div class="market-modal-content" style="text-align: center;">
        <h3 style="color:#5A2800; margin-top:0; font-weight:bold;" id="sell-modal-title">Vender Item</h3>
        <div style="margin: 12px 0;">
            <img id="sell-modal-img" src="" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <p style="font-size:0.8rem; color:#666; margin-top: 5px;">Defina o preço em Coins:</p>
        <input type="number" min="1" id="sell-price-input" class="market-modal-input" value="50" style="display: block; margin: 8px auto; width: 80%;">
        <div class="market-modal-buttons" style="justify-content: center; gap: 10px;">
            <button class="market-btn" onclick="submitSellOffer()">Confirmar</button>
            <button class="market-btn market-btn-cancel" onclick="closeSellModal()">Cancelar</button>
        </div>
    </div>
</div>

<script>
    // Configurações de API Dinâmicas
    const host = window.location.hostname;
    const gamePort = (host === 'localhost' || host === '127.0.0.1') ? '3000' : '';
    const API_URL = window.location.protocol + '//' + host + (gamePort ? ':' + gamePort : '') + '/api';
    const ITEMS_BASE_URL = window.location.origin + '/items/';

    // Mapeamento dinâmico e fallback de imagens
    const CUSTOM_ITEM_IMAGES = <?php echo json_encode($images_mapping); ?> || {};
    const CUSTOM_ITEM_NAMES = <?php echo json_encode($names_mapping); ?> || {};
    const DEFAULT_ITEM_IMAGES = {
        'espada_basica': 'item1.png',
        'escudo_ferro': 'item2.png',
        'bota_velocidade': 'item3.png',
        'pocao_vida': 'item4.png',
        'armadura_aco': 'item5.png',
        'amuleto_magico': 'item6.png',
        'prisma_faiscas': 'item7.png',
        'cubo_toxico': 'item8.png',
        'lamina_triangular': 'item9.png',
        'cilindro_corrosivo': 'item10.png',
        'orbe_enfermo': 'item11.png',
        'icosaedro_gelido': 'item12.png',
        'bloco_pesado': 'item13.png',
        'raizes_poligonais': 'item14.png',
        'cone_lentidao': 'item15.png',
        'luz_prismatica': 'item16.png',
        'esfera_mudo': 'item17.png',
        'espelho_distorcido': 'item18.png',
        'tetraedro_panico': 'item19.png',
        'placa_provocador': 'item20.png',
        'lente_fenda': 'item21.png',
        'tijolo_exaustivo': 'item22.png',
        'circulo_cansaco': 'item23.png',
        'seta_marcadora': 'item24.png',
        'cunha_serrilhada': 'item25.png',
        'cristal_vitalidade': 'item26.png',
        'vento_cubico': 'item27.png',
        'estilhaco_furia': 'item28.png',
        'mini_escudo_planar': 'item29.png',
        'cacto_geometrico': 'item30.png',
        'presa_poligono': 'item31.png',
        'peso_balanceador': 'item32.png',
        'motor_hasteado': 'item33.png',
        'frasco_sangue': 'item34.png',
        'frasco_veneno': 'item35.png',
        'relogio_triangular': 'item36.png',
        'dodecaedro_carnificina': 'item37.png',
        'bastiao_gelo': 'item38.png',
        'casco_toxico': 'item39.png',
        'lamina_sanguessuga': 'item40.png',
        'epidemia_acida': 'item41.png',
        'olho_aterrorizante': 'item42.png',
        'megafone_conico': 'item43.png',
        'grilhoes_cansaco': 'item44.png',
        'pendulo_curativo': 'item45.png',
        'prisma_duelista': 'item46.png',
        'cubo_infinito': 'item47.png',
        'prisma_calamidade': 'item48.png',
        'tetraedro_distorcao': 'item49.png',
        'coroa_gelida': 'item50.png',
        'coracao_raziel': 'item51.png'
    };

    function getItemImageUrl(itemId) {
        const filename = CUSTOM_ITEM_IMAGES[itemId] || DEFAULT_ITEM_IMAGES[itemId] || 'item1.png';
        return ITEMS_BASE_URL + filename;
    }

    // Token do PHP ou localStorage
    let token = <?php echo json_encode($session_token); ?> || localStorage.getItem('onlinerpg_token');
    if (token) {
        localStorage.setItem('onlinerpg_token', token);
    }

    let coinsData = 0;
    let inventoryData = [];
    let marketOffers = [];
    let currentUserId = null;

    const ITEM_NAMES = {
        'espada_basica': 'Lâmina Fragmentada',
        'escudo_ferro': 'Escudo Primitivo',
        'bota_velocidade': 'Propulsor de Íons',
        'pocao_vida': 'Injetor de Nanobots',
        'armadura_aco': 'Chassi Reforçado',
        'amuleto_magico': 'Núcleo de Ressonância',
        'prisma_faiscas': 'Prisma de Faiscas',
        'cubo_toxico': 'Cubo Tóxico',
        'lamina_triangular': 'Lâmina Triangular',
        'cilindro_corrosivo': 'Cilindro Corrosivo',
        'orbe_enfermo': 'Orbe Enfermo',
        'icosaedro_gelido': 'Icosaedro Gélido',
        'bloco_pesado': 'Bloco Pesado',
        'raizes_poligonais': 'Raízes Poligonais',
        'cone_lentidao': 'Cone da Lentidão',
        'luz_prismatica': 'Luz Prismática',
        'esfera_mudo': 'Esfera do Mudo',
        'espelho_distorcido': 'Espelho Distorcido',
        'tetraedro_panico': 'Tetraedro do Pânico',
        'placa_provocador': 'Placa do Provocador',
        'lente_fenda': 'Lente da Fenda',
        'tijolo_exaustivo': 'Tijolo Exaustivo',
        'circulo_cansaco': 'Círculo do Cansaço',
        'seta_marcadora': 'Seta Marcadora',
        'cunha_serrilhada': 'Cunha Serrilhada',
        'cristal_vitalidade': 'Cristal de Vitalidade',
        'vento_cubico': 'Vento Cúbico',
        'estilhaco_furia': 'Estilhaço de Fúria',
        'mini_escudo_planar': 'Mini-Escudo Planar',
        'cacto_geometrico': 'Cacto Geométrico',
        'presa_poligono': 'Presa de Polígono',
        'peso_balanceador': 'Peso Balanceador',
        'motor_hasteado': 'Motor Hasteado',
        'frasco_sangue': 'Frasco Quadrado de Sangue',
        'frasco_veneno': 'Frasco Quadrado de Veneno',
        'relogio_triangular': 'Relógio Triangular',
        'dodecaedro_carnificina': 'Dodecaedro da Carnificina',
        'bastiao_gelo': 'Bastião de Gelo',
        'casco_toxico': 'Casco Tóxico Farpado',
        'lamina_sanguessuga': 'Lâmina Sanguessuga',
        'epidemia_acida': 'Epidemia Ácida',
        'olho_aterrorizante': 'O Olho Aterrorizante',
        'megafone_conico': 'Megafone Cônico',
        'grilhoes_cansaco': 'Grilhões do Cansaço',
        'pendulo_curativo': 'Pêndulo Curativo',
        'prisma_duelista': 'Prisma do Duelista',
        'cubo_infinito': 'Cubo do Infinito',
        'prisma_calamidade': 'Prisma da Calamidade',
        'tetraedro_distorcao': 'Tetraedro da Distorção Temporal',
        'coroa_gelida': 'Coroa Gélida do Lich',
        'coracao_raziel': 'O Coração Cúbico de Raziel'
    };
    Object.assign(ITEM_NAMES, CUSTOM_ITEM_NAMES);

    const ITEM_RARITIES = {
        'espada_basica': 'basic',
        'escudo_ferro': 'basic',
        'bota_velocidade': 'basic',
        'pocao_vida': 'basic',
        'armadura_aco': 'basic',
        'amuleto_magico': 'epic',
        'prisma_faiscas': 'basic',
        'cubo_toxico': 'basic',
        'lamina_triangular': 'basic',
        'cilindro_corrosivo': 'basic',
        'orbe_enfermo': 'basic',
        'icosaedro_gelido': 'basic',
        'bloco_pesado': 'basic',
        'raizes_poligonais': 'basic',
        'cone_lentidao': 'basic',
        'luz_prismatica': 'basic',
        'esfera_mudo': 'basic',
        'espelho_distorcido': 'basic',
        'tetraedro_panico': 'basic',
        'placa_provocador': 'basic',
        'lente_fenda': 'basic',
        'tijolo_exaustivo': 'basic',
        'circulo_cansaco': 'basic',
        'seta_marcadora': 'basic',
        'cunha_serrilhada': 'basic',
        'cristal_vitalidade': 'basic',
        'vento_cubico': 'basic',
        'estilhaco_furia': 'basic',
        'mini_escudo_planar': 'basic',
        'cacto_geometrico': 'basic',
        'presa_poligono': 'basic',
        'peso_balanceador': 'basic',
        'motor_hasteado': 'basic',
        'frasco_sangue': 'basic',
        'frasco_veneno': 'basic',
        'relogio_triangular': 'basic',
        'dodecaedro_carnificina': 'epic',
        'bastiao_gelo': 'epic',
        'casco_toxico': 'epic',
        'lamina_sanguessuga': 'epic',
        'epidemia_acida': 'epic',
        'olho_aterrorizante': 'epic',
        'megafone_conico': 'epic',
        'grilhoes_cansaco': 'epic',
        'pendulo_curativo': 'epic',
        'prisma_duelista': 'epic',
        'cubo_infinito': 'legendary',
        'prisma_calamidade': 'legendary',
        'tetraedro_distorcao': 'legendary',
        'coroa_gelida': 'legendary',
        'coracao_raziel': 'legendary'
    };

    let itemToSellId = null;

    if (token) {
        fetchUserData();
    }

    async function fetchUserData() {
        try {
            const res = await fetch(`${API_URL}/user/data`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                coinsData = data.coins || 0;
                inventoryData = data.inventory || [];
                
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const decoded = JSON.parse(jsonPayload);
                currentUserId = decoded.id;

                document.getElementById('coin-balance').innerText = `${coinsData} Coins`;
                await fetchMarketOffers();
                render();
            } else {
                console.error("Sessão expirada no game server.");
            }
        } catch(e) {
            console.error("Falha ao comunicar com o servidor:", e);
        }
    }

    async function fetchMarketOffers() {
        try {
            const res = await fetch(`${API_URL}/market/offers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                marketOffers = await res.json();
            }
        } catch(e) {
            console.error("Falha ao buscar ofertas:", e);
        }
    }

    function render() {
        renderOffers();
        renderInventory();
        renderMyOffers();
    }

    function renderOffers() {
        const list = document.getElementById('offers-list');
        if (!list) return;
        list.innerHTML = '';

        const otherOffers = marketOffers.filter(o => o.seller_id !== currentUserId);

        if (otherOffers.length === 0) {
            list.innerHTML = '<tr><td colspan="4" class="market-empty-text">Nenhuma oferta de outro jogador ativa no momento.</td></tr>';
            return;
        }

        otherOffers.forEach(offer => {
            const tr = document.createElement('tr');

            const name = ITEM_NAMES[offer.item_id] || offer.item_id;
            const rarity = ITEM_RARITIES[offer.item_id] || 'basic';
            const canAfford = coinsData >= offer.price;

            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center;">
                        <img src="${getItemImageUrl(offer.item_id)}" class="market-item-icon" />
                        <div>
                            <span class="market-item-name">${name}</span><br/>
                            <span class="market-item-meta">Raridade: <span class="market-item-rarity market-rarity-${rarity}">${rarity}</span></span>
                        </div>
                    </div>
                </td>
                <td class="market-seller-badge">${offer.seller_name}</td>
                <td class="market-price-badge">${offer.price} Coins</td>
                <td style="text-align:center;">
                    <button class="market-btn" ${!canAfford ? 'disabled' : ''} onclick="buyOffer(${offer.id})">Comprar</button>
                </td>
            `;
            list.appendChild(tr);
        });
    }

    function renderInventory() {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;
        grid.innerHTML = '';

        if (inventoryData.length === 0) {
            grid.innerHTML = '<div class="market-empty-text" style="grid-column: span 3;">Inventário vazio.</div>';
            return;
        }

        inventoryData.forEach((itemId, index) => {
            const card = document.createElement('div');
            card.className = 'market-inventory-item';

            const name = ITEM_NAMES[itemId] || itemId;
            const rarity = ITEM_RARITIES[itemId] || 'basic';

            card.innerHTML = `
                <div>
                    <div class="market-inventory-icon-container">
                        <img src="${getItemImageUrl(itemId)}" class="market-inventory-icon" />
                    </div>
                    <div class="market-item-title">${name}</div>
                    <div class="market-item-rarity market-rarity-${rarity}" style="font-size:0.7rem; margin-top:2px;">${rarity}</div>
                </div>
                <button class="market-btn market-btn-sell" style="margin-top: 6px;" onclick="openSellModal('${itemId}')">Vender</button>
            `;
            grid.appendChild(card);
        });
    }

    function renderMyOffers() {
        const list = document.getElementById('my-offers-list');
        if (!list) return;
        list.innerHTML = '';

        const myOffers = marketOffers.filter(o => o.seller_id === currentUserId);

        if (myOffers.length === 0) {
            list.innerHTML = '<tr><td colspan="3" class="market-empty-text">Você não possui itens à venda.</td></tr>';
            return;
        }

        myOffers.forEach(offer => {
            const tr = document.createElement('tr');

            const name = ITEM_NAMES[offer.item_id] || offer.item_id;
            const rarity = ITEM_RARITIES[offer.item_id] || 'basic';

            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center;">
                        <img src="${getItemImageUrl(offer.item_id)}" class="market-item-icon" />
                        <div>
                            <span class="market-item-name">${name}</span><br/>
                            <span class="market-item-meta">Raridade: <span class="market-item-rarity market-rarity-${rarity}">${rarity}</span></span>
                        </div>
                    </div>
                </td>
                <td class="market-price-badge">${offer.price} Coins</td>
                <td style="text-align:center;">
                    <button class="market-btn market-btn-cancel" onclick="cancelOffer(${offer.id})">Cancelar</button>
                </td>
            `;
            list.appendChild(tr);
        });
    }

    function openSellModal(itemId) {
        itemToSellId = itemId;
        const name = ITEM_NAMES[itemId] || itemId;
        document.getElementById('sell-modal-title').innerText = `Vender ${name}`;
        document.getElementById('sell-modal-img').src = getItemImageUrl(itemId);
        document.getElementById('sell-modal').style.display = 'flex';
    }

    function closeSellModal() {
        document.getElementById('sell-modal').style.display = 'none';
        itemToSellId = null;
    }

    async function submitSellOffer() {
        if (!itemToSellId) return;
        const price = parseInt(document.getElementById('sell-price-input').value);
        if (isNaN(price) || price <= 0) {
            alert("Por favor, insira um preço válido maior que 0.");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/market/sell`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ itemId: itemToSellId, price })
            });

            if (res.ok) {
                closeSellModal();
                await fetchUserData();
                alert("Item anunciado com sucesso no Mercado!");
            } else {
                const err = await res.json();
                alert("Erro ao anunciar item: " + (err.error || "Desconhecido"));
            }
        } catch(e) {
            alert("Erro de conexão.");
        }
    }

    async function buyOffer(offerId) {
        if (!confirm("Deseja realmente comprar este item?")) return;

        try {
            const res = await fetch(`${API_URL}/market/buy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ offerId })
            });

            if (res.ok) {
                await fetchUserData();
                alert("Compra realizada com sucesso! O item foi adicionado ao seu inventário.");
            } else {
                const err = await res.json();
                alert("Falha na compra: " + (err.error || "Desconhecido"));
            }
        } catch(e) {
            alert("Erro de conexão.");
        }
    }

    async function cancelOffer(offerId) {
        if (!confirm("Deseja realmente cancelar esta venda e recuperar seu item?")) return;

        try {
            const res = await fetch(`${API_URL}/market/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ offerId })
            });

            if (res.ok) {
                await fetchUserData();
                alert("Oferta cancelada. O item voltou para o seu inventário.");
            } else {
                const err = await res.json();
                alert("Erro ao cancelar: " + (err.error || "Desconhecido"));
            }
        } catch(e) {
            alert("Erro de conexão.");
        }
    }
</script>
</body>
</html>
