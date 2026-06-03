<?php
// myaac-main/system/pages/tradein.php
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
<style>
    .tradein-container {
        font-family: Verdana, Arial, sans-serif;
        color: #3A1A05;
        margin: 10px 0;
    }
    .tradein-title {
        font-size: 1.6rem;
        color: #5A2800;
        font-weight: bold;
        border-bottom: 2px solid #5A2800;
        padding-bottom: 5px;
        margin-bottom: 15px;
    }
    .tradein-economy-bar {
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
    .tradein-coins {
        color: #B25900;
        font-weight: bold;
    }
    .tradein-inventory-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 10px;
        margin-top: 15px;
        max-height: 350px;
        overflow-y: auto;
        padding: 10px;
        background-color: #E6D5BC;
        border: 1px solid #D4C0A1;
    }
    .tradein-item-card {
        background-color: #F1E0C6;
        border: 1px solid #5A2800;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: bold;
        transition: background 0.2s, border-color 0.2s;
        user-select: none;
        box-shadow: 1px 1px 3px rgba(0,0,0,0.05);
    }
    .tradein-item-card:hover {
        background-color: #D4C0A1;
        border-color: #A05000;
    }
    .tradein-item-card.selected {
        background-color: #A05000;
        color: #F1E0C6;
        border-color: #5A2800;
        box-shadow: inset 0 0 5px rgba(0,0,0,0.4);
    }
    .tradein-item-icon-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 40px;
        margin-bottom: 8px;
    }
    .tradein-item-icon {
        width: 36px;
        height: 36px;
        object-fit: contain;
    }
    .tradein-item-rarity {
        font-size: 0.65rem;
        text-transform: uppercase;
        font-weight: bold;
        margin-top: 3px;
    }
    .rarity-basic { color: #666; }
    .rarity-epic { color: #800080; }
    .rarity-legendary { color: #b35900; }
    .tradein-item-card.selected .rarity-basic { color: #d4c0a1 !important; }
    .tradein-item-card.selected .rarity-epic { color: #f3e8ff !important; }
    .tradein-item-card.selected .rarity-legendary { color: #ffebcc !important; }
    .tradein-btn-trade {
        display: block;
        width: 100%;
        padding: 12px;
        background: linear-gradient(to bottom, #966c46, #533821);
        border: 1px solid #3f250a;
        color: #f1e0c6;
        font-family: Verdana, Arial, sans-serif;
        font-size: 0.9rem;
        font-weight: bold;
        cursor: pointer;
        text-shadow: 1px 1px #000;
        margin-top: 20px;
        transition: background 0.2s;
    }
    .tradein-btn-trade:hover {
        background: linear-gradient(to bottom, #b3855c, #6d4b2f);
    }
    .tradein-btn-trade:active {
        background: #48301b;
    }
    .tradein-btn-trade:disabled {
        background: #cccccc;
        color: #666666;
        border-color: #999999;
        text-shadow: none;
        cursor: not-allowed;
    }
    .tradein-btn-action {
        background: linear-gradient(to bottom, #966c46, #533821);
        border: 1px solid #3f250a;
        color: #f1e0c6;
        padding: 6px 12px;
        font-weight: bold;
        cursor: pointer;
        text-shadow: 1px 1px #000;
        text-decoration: none;
        display: inline-block;
    }
    .tradein-btn-action:hover {
        background: linear-gradient(to bottom, #b3855c, #6d4b2f);
    }
    .tradein-empty-text {
        color: #666;
        font-style: italic;
        text-align: center;
        grid-column: span 4;
        padding: 20px 0;
        font-size: 0.85rem;
    }
</style>

<div class="tradein-container">
    <div class="tradein-title">Reciclador de Fragmentos</div>
    
    <div class="tradein-economy-bar">
        <span>Jogador: <strong style="color: #5A2800;"><?php echo htmlspecialchars($player_name ?: 'Convidado'); ?></strong> | Seu Saldo Atual:</span>
        <span class="tradein-coins" id="coin-balance">-- Coins</span>
    </div>

    <?php if (!$is_logged): ?>
        <div style="text-align:center; padding:40px 20px; border:2px dashed #d9534f; background-color:#f2dede; color:#a94442;">
            <h3 style="margin-top:0; color:#a94442; font-weight:bold;">Autenticação Necessária</h3>
            <p>Por favor, faça login em sua conta para acessar o reciclador de itens.</p>
            <a href="?subtopic=account/manage" class="tradein-btn-action" style="margin-top:10px;">Entrar na Conta</a>
        </div>
    <?php else: ?>
        <p style="color: #666; font-size: 0.85rem;">Selecione os itens do seu inventário de jogo que deseja desconstruir e reciclar. Cada item reciclado renderá <strong>10 Coins</strong>.</p>

        <div class="tradein-inventory-grid" id="inventory-grid">
            <div class="tradein-empty-text">Buscando itens no inventário...</div>
        </div>

        <button class="tradein-btn-trade" id="btn-trade" disabled onclick="performTradeIn()">Desconstruir Selecionados (+0 Coins)</button>
    <?php endif; ?>
</div>

<script>
    // Configurações de API Dinâmicas
    const host = window.location.hostname;
    const gamePort = (host === 'localhost' || host === '127.0.0.1') ? '3000' : '';
    const API_URL = window.location.protocol + '//' + host + (gamePort ? ':' + gamePort : '') + '/api';
    const ITEMS_BASE_URL = window.location.origin + '/items/';

    // Mapeamento dinâmico e fallback de imagens e nomes
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

    // Token do PHP ou do localStorage
    let token = <?php echo json_encode($session_token); ?> || localStorage.getItem('onlinerpg_token');
    if (token) {
        localStorage.setItem('onlinerpg_token', token);
    }

    let inventoryData = [];
    let coinsData = 0;
    let selectedItems = [];

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

    if (token) {
        fetchData();
    }

    async function fetchData() {
        try {
            const res = await fetch(`${API_URL}/user/data`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                inventoryData = data.inventory || [];
                coinsData = data.coins || 0;
                render();
            } else {
                console.error('Sessão expirada no game server.');
            }
        } catch(e) {
            console.error('Erro ao conectar com o Game Server:', e);
        }
    }

    function render() {
        document.getElementById('coin-balance').innerText = `${coinsData} Coins`;
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';
        
        if (inventoryData.length === 0) {
            grid.innerHTML = '<div class="tradein-empty-text">Seu inventário está vazio. Drope itens jogando para poder reciclá-los.</div>';
            document.getElementById('btn-trade').disabled = true;
            return;
        }

        inventoryData.forEach((itemId, idx) => {
            const div = document.createElement('div');
            div.className = 'tradein-item-card';
            if (selectedItems.some(item => item.index === idx)) {
                div.classList.add('selected');
            }

            const name = ITEM_NAMES[itemId] || itemId;
            const rarity = ITEM_RARITIES[itemId] || 'basic';
            
            div.innerHTML = `
                <div class="tradein-item-icon-container">
                    <img src="${getItemImageUrl(itemId)}" class="tradein-item-icon" />
                </div>
                <div style="font-size: 0.8rem; margin-bottom: 2px;">${name}</div>
                <div class="tradein-item-rarity rarity-${rarity}">${rarity}</div>
            `;
            
            const uniqueId = { id: itemId, index: idx };
            
            div.onclick = () => {
                const isSelected = selectedItems.some(item => item.index === idx);
                if (isSelected) {
                    selectedItems = selectedItems.filter(item => item.index !== idx);
                    div.classList.remove('selected');
                } else {
                    selectedItems.push(uniqueId);
                    div.classList.add('selected');
                }
                updateButton();
            };
            grid.appendChild(div);
        });
    }

    function updateButton() {
        const btn = document.getElementById('btn-trade');
        const gain = selectedItems.length * 10;
        btn.innerText = `Desconstruir Selecionados (+${gain} Coins)`;
        btn.disabled = selectedItems.length === 0;
    }

    async function performTradeIn() {
        if (selectedItems.length === 0) return alert('Selecione pelo menos um item.');
        
        const itemsToSell = selectedItems.map(item => item.id);

        try {
            const res = await fetch(`${API_URL}/user/tradein`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ itemsToSell })
            });

            if (res.ok) {
                const data = await res.json();
                coinsData = data.coins;
                inventoryData = data.inventory;
                selectedItems = [];
                render();
                updateButton();
                alert(`Sucesso! Você desconstruiu os itens e recebeu +${data.gained} Coins.`);
            } else {
                alert('Erro ao processar Trade-In.');
            }
        } catch(e) {
            alert('Falha na comunicação.');
        }
    }
</script>
