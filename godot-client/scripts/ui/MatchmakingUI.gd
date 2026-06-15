extends CanvasLayer
class_name MatchmakingUI

signal game_started(payload: Dictionary)

const CONFIG_PATH: String = "user://lobby_config.cfg"
const MAX_LOADOUT_ITEMS: int = 3
const ITEM_IMAGE_MAP_PATH: String = "res://assets/data/item_images.json"

const TOWER_DATA: Dictionary = {
	"red": {
		"display": "Torre Vermelha",
		"focus": "Dano / Burst",
		"ult": "Raio de Fogo Simples",
		"floors": [
			{"level": 1, "title": "Status", "options": ["+15% Dano", "+10% Speed", "+20% Critico"]},
			{"level": 2, "title": "Ataque", "options": ["10% Lifesteal", "+20% Dano (<30% HP)", "Ignora 25% Armor"]},
			{"level": 3, "title": "Efeito", "options": ["Dano escala c/ hits", "Ataque Cleave", "+70% Dano / -30% AS"]},
			{"level": 4, "title": "Condicional", "options": ["Kill = Cura+Speed", "4o Hit Explode", "Dano x2 (<20% HP)"]}
		]
	},
	"green": {
		"display": "Torre Verde",
		"focus": "Tank / Defesa",
		"ult": "Escudo de Poligonos",
		"floors": [
			{"level": 1, "title": "Status", "options": ["+25% HP Max", "Reducao Dano Flat", "Imune a Knockback"]},
			{"level": 2, "title": "Defesa", "options": ["Regen 1% HP/s", "+30% Defesa (>80% HP)", "Reflete 15% Dano"]},
			{"level": 3, "title": "Presenca", "options": ["Ataques geram Taunt", "Aura Reducao Dano", "Cura de itens x2"]},
			{"level": 4, "title": "Condicional", "options": ["Escudo fora combate", "Sobrevive 1 Hit Kill", "Escudo quebrado explode"]}
		]
	},
	"purple": {
		"display": "Torre Roxa",
		"focus": "Magia / Utilidade",
		"ult": "Pulso Arcano",
		"floors": [
			{"level": 1, "title": "Status", "options": ["+25% Escudo Max", "+15% Move Speed", "+CDR"]},
			{"level": 2, "title": "Magia", "options": ["Dano extra apos skill", "Escudo Defletor", "Vampirismo Magico"]},
			{"level": 3, "title": "Controle", "options": ["10% Esquiva", "Ataques dao Slow", "Orbes extras no hit"]},
			{"level": 4, "title": "Condicional", "options": ["Kill reseta CDs", "Hitbox magias +30%", "Aura toxica DPS"]}
		]
	},
	"poison": {
		"display": "Torre do Veneno",
		"focus": "DoT / Kiting / Evasao",
		"ult": "Frasco de Peconha",
		"floors": [
			{"level": 1, "title": "Status", "options": ["+20% Attack Speed", "+15% Move Speed permanent", "Tiro Toxico"]},
			{"level": 2, "title": "Kiting", "options": ["Passos Leves (+20% MS)", "Presas Gemeas (Heal)", "Dardo Cegante (Cegueira)"]},
			{"level": 3, "title": "Efeito", "options": ["Miasma Menor (Poca morte)", "Toxina Paralisante (Slow)", "Foco Infeccioso (+20% dmg)"]},
			{"level": 4, "title": "Condicional", "options": ["Contaminacao (Detonacao)", "Armadilha Cubica (Shroom)", "Espalhar a Peste (Transfer Stacks)"]}
		]
	},
	"coin": {
		"display": "Torre Coringa",
		"focus": "Perde / Ganha",
		"ult": "Giro da Moeda",
		"floors": [
			{"level": 1, "title": "A Primeira Aposta", "options": ["Cara Agressiva", "Coroa Vital", "Moeda Rapida"]},
			{"level": 2, "title": "Troca de Combate", "options": ["Critico Endividado", "Pancada Pesada", "Ataque Instavel"]},
			{"level": 3, "title": "Preco da Sobrevivencia", "options": ["Sanguessuga Fragil", "Armadura Cobrada", "Folego de Risco"]},
			{"level": 4, "title": "Divida Alta", "options": ["Poder no Desespero", "Seguranca Cara", "Tudo ou Nada"]}
		]
	},
	"predator_hive": {
		"display": "Bastiao Predador da Colmeia",
		"focus": "Mobilidade / Defesa / Ergs",
		"ult": "Dominio do Bastiao Predador",
		"floors": [
			{"level": 1, "title": "Corpo Predador", "options": ["Reflexo Felino [PREDADOR]", "Pele Cinetica [GUARDIAO]", "Garras da Colmeia [ERG]"]},
			{"level": 2, "title": "Guarda e Impacto", "options": ["Braco de Bastiao [GUARDIAO]", "Aparar Geometrico [GUARDIAO]", "Chamado dos Ergs [ERG]"]},
			{"level": 3, "title": "Colmeia Adaptativa", "options": ["Enxame de Fragmentos [ERG]", "Regeneracao Mutante [ERG]", "Carapaca Viva [ERG]"]},
			{"level": 4, "title": "Sinergia Avancada", "options": ["Contra-Ataque Cinetico [PREDADOR]", "Muralha Predadora [GUARDIAO]", "Evolucao da Ninhada [ERG]"]}
		]
	}
}

const ITEM_DATA: Dictionary = {
	"espada_basica": {"display": "Lamina Fragmentada", "rarity": "basic"},
	"escudo_ferro": {"display": "Escudo Primitivo", "rarity": "basic"},
	"bota_velocidade": {"display": "Propulsor de Ions", "rarity": "basic"},
	"pocao_vida": {"display": "Injetor de Nanobots", "rarity": "basic"},
	"armadura_aco": {"display": "Chassi Reforcado", "rarity": "basic"},
	"amuleto_magico": {"display": "Nucleo de Ressonancia", "rarity": "epic"},
	"prisma_faiscas": {"display": "Prisma de Faiscas", "rarity": "basic"},
	"cubo_toxico": {"display": "Cubo Toxico", "rarity": "basic"},
	"lamina_triangular": {"display": "Lamina Triangular", "rarity": "basic"},
	"cilindro_corrosivo": {"display": "Cilindro Corrosivo", "rarity": "basic"},
	"orbe_enfermo": {"display": "Orbe Enfermo", "rarity": "basic"},
	"icosaedro_gelido": {"display": "Icosaedro Gelido", "rarity": "basic"},
	"bloco_pesado": {"display": "Bloco Pesado", "rarity": "basic"},
	"raizes_poligonais": {"display": "Raizes Poligonais", "rarity": "basic"},
	"cone_lentidao": {"display": "Cone de Lentidao", "rarity": "basic"},
	"luz_prismatica": {"display": "Luz Prismatica", "rarity": "basic"},
	"esfera_mudo": {"display": "Esfera do Silencio", "rarity": "basic"},
	"espelho_distorcido": {"display": "Espelho Distorcido", "rarity": "basic"},
	"tetraedro_panico": {"display": "Tetraedro do Panico", "rarity": "basic"},
	"placa_provocador": {"display": "Placa Provocadora", "rarity": "basic"},
	"lente_fenda": {"display": "Lente de Fenda", "rarity": "basic"},
	"tijolo_exaustivo": {"display": "Tijolo Exaustivo", "rarity": "basic"},
	"circulo_cansaco": {"display": "Circulo do Cansaco", "rarity": "basic"},
	"seta_marcadora": {"display": "Seta Marcadora", "rarity": "basic"},
	"cunha_serrilhada": {"display": "Cunha Serrilhada", "rarity": "basic"},
	"cristal_vitalidade": {"display": "Cristal da Vitalidade", "rarity": "basic"},
	"vento_cubico": {"display": "Vento Cubico", "rarity": "basic"},
	"estilhaco_furia": {"display": "Estilhaco de Furia", "rarity": "basic"},
	"mini_escudo_planar": {"display": "Mini Escudo Planar", "rarity": "basic"},
	"cacto_geometrico": {"display": "Cacto Geometrico", "rarity": "basic"},
	"presa_poligono": {"display": "Presa Poligonal", "rarity": "basic"},
	"peso_balanceador": {"display": "Peso Balanceador", "rarity": "basic"},
	"motor_hasteado": {"display": "Motor Hasteado", "rarity": "basic"},
	"frasco_sangue": {"display": "Frasco de Sangue", "rarity": "basic"},
	"frasco_veneno": {"display": "Frasco de Veneno", "rarity": "basic"},
	"relogio_triangular": {"display": "Relogio Triangular", "rarity": "basic"},
	"dodecaedro_carnificina": {"display": "Dodecaedro da Carnificina", "rarity": "epic"},
	"bastiao_gelo": {"display": "Bastiao de Gelo", "rarity": "epic"},
	"casco_toxico": {"display": "Casco Toxico", "rarity": "epic"},
	"lamina_sanguessuga": {"display": "Lamina Sanguessuga", "rarity": "epic"},
	"epidemia_acida": {"display": "Epidemia Acida", "rarity": "epic"},
	"olho_aterrorizante": {"display": "Olho Aterrorizante", "rarity": "epic"},
	"megafone_conico": {"display": "Megafone Conico", "rarity": "epic"},
	"grilhoes_cansaco": {"display": "Grilhoes do Cansaco", "rarity": "epic"},
	"pendulo_curativo": {"display": "Pendulo Curativo", "rarity": "epic"},
	"prisma_duelista": {"display": "Prisma Duelista", "rarity": "epic"},
	"cubo_infinito": {"display": "Cubo Infinito", "rarity": "legendary"},
	"prisma_calamidade": {"display": "Prisma da Calamidade", "rarity": "legendary"},
	"tetraedro_distorcao": {"display": "Tetraedro da Distorcao", "rarity": "legendary"},
	"coroa_gelida": {"display": "Coroa Gelida", "rarity": "legendary"},
	"coracao_raziel": {"display": "Coracao de Raziel", "rarity": "legendary"}
}

var auth: Node
var network: NetworkClient
var selected_platform: String = "pc"
var selected_tower_color: String = "red"
var selected_passives: Dictionary = {1: 0, 2: 0, 3: 0, 4: 0}
var inventory: Array = []
var selected_loadout: Array = []
var login_mode: bool = true

var overlay: ColorRect
var panel: PanelContainer
var title_label: Label
var subtitle_label: Label
var login_tab: Button
var register_tab: Button
var username_input: LineEdit
var password_input: LineEdit
var submit_button: Button
var logout_button: Button
var pc_button: Button
var mobile_button: Button
var status_label: Label
var user_label: Label
var match_label: Label
var tower_button: Button
var tower_summary_label: Label
var loadout_button: Button
var loadout_summary_label: Label
var modal_layer: ColorRect
var modal_title_label: Label
var modal_body: VBoxContainer
var modal_close_button: Button
var game_over_layer: ColorRect
var game_over_body: VBoxContainer
var inventory_request: HTTPRequest
var root_box: HBoxContainer
var auth_panel: PanelContainer
var lobby_panel: PanelContainer
var lobby_title_label: Label
var lobby_subtitle_label: Label
var platform_label: Label
var tower_cards_container: HBoxContainer
var tower_details_container: VBoxContainer
var loadout_slots_container: HBoxContainer
var inventory_grid: GridContainer
var icon_base_url: String = "https://play.sobrevivencia.online"
var item_image_map: Dictionary = {}
var item_icon_cache: Dictionary = {}
var item_icon_targets: Dictionary = {}

func _ready() -> void:
	_load_local_config()
	_load_item_image_map()
	_build_ui()
	_build_modal()
	_build_game_over()
	_build_inventory_request()
	_show_logged_out()

func configure(auth_client: Node, network_client: NetworkClient) -> void:
	auth = auth_client
	network = network_client
	icon_base_url = str(auth.get("api_base_url")).trim_suffix("/")
	auth.session_checked.connect(_on_session_checked)
	auth.auth_success.connect(_on_auth_success)
	auth.auth_failed.connect(_on_auth_failed)
	auth.logged_out.connect(_on_logged_out)
	network.welcome.connect(_on_welcome)
	network.queue_status.connect(_on_queue_status)
	network.match_found.connect(_on_match_found)
	network.game_start.connect(_on_game_start)
	network.game_over.connect(_on_game_over)
	network.player_died.connect(_on_player_died)
	network.server_error.connect(_on_server_error)
	network.disconnected.connect(_on_disconnected)
	status_label.text = "Verificando sessao..."
	auth.verify_saved_session()

func get_current_build() -> Dictionary:
	return {
		"buildingColor": selected_tower_color,
		"floor1": int(selected_passives.get(1, 0)),
		"floor2": int(selected_passives.get(2, 0)),
		"floor3": int(selected_passives.get(3, 0)),
		"floor4": int(selected_passives.get(4, 0))
	}

func get_loadout() -> Array:
	_filter_loadout_against_inventory()
	return selected_loadout.duplicate()

func _build_ui() -> void:
	overlay = ColorRect.new()
	overlay.color = Color(0, 0, 0, 0.56)
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)

	var margin: MarginContainer = MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 42)
	margin.add_theme_constant_override("margin_top", 34)
	margin.add_theme_constant_override("margin_right", 42)
	margin.add_theme_constant_override("margin_bottom", 34)
	overlay.add_child(margin)

	root_box = HBoxContainer.new()
	root_box.alignment = BoxContainer.ALIGNMENT_CENTER
	root_box.add_theme_constant_override("separation", 26)
	margin.add_child(root_box)

	auth_panel = PanelContainer.new()
	auth_panel.custom_minimum_size = Vector2(390, 0)
	auth_panel.add_theme_stylebox_override("panel", _make_panel_style(Color(0.035, 0.04, 0.055, 0.86), Color(0.0, 0.88, 0.95, 0.34), 8, 1))
	root_box.add_child(auth_panel)

	var box: VBoxContainer = VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	box.add_theme_constant_override("margin_left", 18)
	box.add_theme_constant_override("margin_right", 18)
	auth_panel.add_child(box)

	title_label = Label.new()
	title_label.text = "SOBREVIVENCIA 3D"
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override("font_size", 28)
	box.add_child(title_label)

	subtitle_label = Label.new()
	subtitle_label.text = "MULTIPLAYER ONLINE"
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle_label.add_theme_color_override("font_color", Color(0.62, 0.9, 1.0, 1.0))
	box.add_child(subtitle_label)

	var tabs: HBoxContainer = HBoxContainer.new()
	tabs.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_child(tabs)

	login_tab = Button.new()
	login_tab.text = "Login"
	login_tab.pressed.connect(_show_login_mode)
	tabs.add_child(login_tab)

	register_tab = Button.new()
	register_tab.text = "Registrar"
	register_tab.pressed.connect(_show_register_mode)
	tabs.add_child(register_tab)

	username_input = LineEdit.new()
	username_input.placeholder_text = "Usuario"
	username_input.max_length = 15
	box.add_child(username_input)

	password_input = LineEdit.new()
	password_input.placeholder_text = "Senha"
	password_input.secret = true
	password_input.max_length = 30
	box.add_child(password_input)

	submit_button = Button.new()
	submit_button.text = "Entrar"
	submit_button.pressed.connect(_on_submit_pressed)
	box.add_child(submit_button)

	user_label = Label.new()
	user_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	user_label.visible = false
	box.add_child(user_label)

	logout_button = Button.new()
	logout_button.text = "Sair"
	logout_button.visible = false
	logout_button.pressed.connect(_on_logout_pressed)
	box.add_child(logout_button)

	status_label = Label.new()
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.add_theme_color_override("font_color", Color(0.95, 0.95, 0.98, 1.0))
	box.add_child(status_label)

	match_label = Label.new()
	match_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	match_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	match_label.add_theme_color_override("font_color", Color(0.58, 0.86, 1.0, 1.0))
	box.add_child(match_label)

	lobby_panel = PanelContainer.new()
	lobby_panel.custom_minimum_size = Vector2(820, 0)
	lobby_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	lobby_panel.visible = false
	lobby_panel.add_theme_stylebox_override("panel", _make_panel_style(Color(0.03, 0.035, 0.05, 0.78), Color(0.0, 0.95, 0.82, 0.24), 8, 1))
	root_box.add_child(lobby_panel)

	var lobby: VBoxContainer = VBoxContainer.new()
	lobby.size_flags_vertical = Control.SIZE_EXPAND_FILL
	lobby.add_theme_constant_override("separation", 12)
	lobby_panel.add_child(lobby)

	lobby_title_label = Label.new()
	lobby_title_label.text = "Preparacao da Partida"
	lobby_title_label.add_theme_font_size_override("font_size", 22)
	lobby_title_label.add_theme_color_override("font_color", Color(0.97, 0.98, 1.0, 1.0))
	lobby.add_child(lobby_title_label)

	lobby_subtitle_label = Label.new()
	lobby_subtitle_label.text = "Escolha sua Torre de Essencia, equipe 3 itens e entre na fila."
	lobby_subtitle_label.add_theme_color_override("font_color", Color(0.72, 0.78, 0.86, 1.0))
	lobby.add_child(lobby_subtitle_label)

	var setup_scroll: ScrollContainer = ScrollContainer.new()
	setup_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	setup_scroll.custom_minimum_size = Vector2(780, 0)
	lobby.add_child(setup_scroll)

	var setup_body: VBoxContainer = VBoxContainer.new()
	setup_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	setup_body.add_theme_constant_override("separation", 10)
	setup_scroll.add_child(setup_body)

	tower_cards_container = HBoxContainer.new()
	tower_cards_container.add_theme_constant_override("separation", 8)
	setup_body.add_child(tower_cards_container)

	tower_details_container = VBoxContainer.new()
	tower_details_container.add_theme_constant_override("separation", 8)
	setup_body.add_child(tower_details_container)

	tower_button = Button.new()
	tower_button.text = "Editar passivas da torre"
	tower_button.visible = false
	tower_button.pressed.connect(_open_tower_modal)
	setup_body.add_child(tower_button)

	tower_summary_label = Label.new()
	tower_summary_label.visible = false
	tower_summary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	tower_summary_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	setup_body.add_child(tower_summary_label)

	var loadout_header: HBoxContainer = HBoxContainer.new()
	loadout_header.alignment = BoxContainer.ALIGNMENT_CENTER
	setup_body.add_child(loadout_header)

	loadout_summary_label = Label.new()
	loadout_summary_label.visible = false
	loadout_summary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	loadout_header.add_child(loadout_summary_label)

	loadout_button = Button.new()
	loadout_button.text = "Atualizar inventario"
	loadout_button.visible = false
	loadout_button.pressed.connect(_open_loadout_modal)
	loadout_header.add_child(loadout_button)

	loadout_slots_container = HBoxContainer.new()
	loadout_slots_container.alignment = BoxContainer.ALIGNMENT_CENTER
	loadout_slots_container.add_theme_constant_override("separation", 8)
	setup_body.add_child(loadout_slots_container)

	var inventory_scroll: ScrollContainer = ScrollContainer.new()
	inventory_scroll.custom_minimum_size = Vector2(760, 150)
	setup_body.add_child(inventory_scroll)

	inventory_grid = GridContainer.new()
	inventory_grid.columns = 3
	inventory_grid.add_theme_constant_override("h_separation", 8)
	inventory_grid.add_theme_constant_override("v_separation", 8)
	inventory_scroll.add_child(inventory_grid)

	platform_label = Label.new()
	platform_label.text = "Escolha sua plataforma para entrar na fila"
	platform_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	platform_label.add_theme_color_override("font_color", Color(0.88, 0.92, 0.96, 1.0))
	lobby.add_child(platform_label)

	var platforms: HBoxContainer = HBoxContainer.new()
	platforms.alignment = BoxContainer.ALIGNMENT_CENTER
	platforms.add_theme_constant_override("separation", 10)
	lobby.add_child(platforms)

	pc_button = Button.new()
	pc_button.text = "JOGAR"
	pc_button.custom_minimum_size = Vector2(220, 52)
	pc_button.disabled = true
	pc_button.pressed.connect(func() -> void: _start_queue("pc"))
	platforms.add_child(pc_button)

	mobile_button = Button.new()
	mobile_button.text = "Mobile"
	mobile_button.custom_minimum_size = Vector2(120, 44)
	mobile_button.disabled = true
	mobile_button.pressed.connect(func() -> void: _start_queue("mobile"))
	platforms.add_child(mobile_button)

	_update_tower_summary()
	_update_loadout_summary()

func _build_modal() -> void:
	modal_layer = ColorRect.new()
	modal_layer.color = Color(0, 0, 0, 0.88)
	modal_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal_layer.visible = false
	add_child(modal_layer)

	var center: CenterContainer = CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal_layer.add_child(center)

	var modal_panel: PanelContainer = PanelContainer.new()
	modal_panel.custom_minimum_size = Vector2(720, 560)
	center.add_child(modal_panel)

	var outer: VBoxContainer = VBoxContainer.new()
	outer.add_theme_constant_override("separation", 10)
	modal_panel.add_child(outer)

	modal_title_label = Label.new()
	modal_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	modal_title_label.add_theme_font_size_override("font_size", 24)
	outer.add_child(modal_title_label)

	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(680, 430)
	outer.add_child(scroll)

	modal_body = VBoxContainer.new()
	modal_body.add_theme_constant_override("separation", 10)
	scroll.add_child(modal_body)

	modal_close_button = Button.new()
	modal_close_button.text = "SALVAR E FECHAR"
	modal_close_button.pressed.connect(_close_modal)
	outer.add_child(modal_close_button)

func _build_game_over() -> void:
	game_over_layer = ColorRect.new()
	game_over_layer.color = Color(0, 0, 0, 0.9)
	game_over_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	game_over_layer.visible = false
	add_child(game_over_layer)

	var center: CenterContainer = CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	game_over_layer.add_child(center)

	var game_over_panel: PanelContainer = PanelContainer.new()
	game_over_panel.custom_minimum_size = Vector2(720, 0)
	center.add_child(game_over_panel)

	game_over_body = VBoxContainer.new()
	game_over_body.add_theme_constant_override("separation", 10)
	game_over_panel.add_child(game_over_body)

func _build_inventory_request() -> void:
	inventory_request = HTTPRequest.new()
	inventory_request.request_completed.connect(_on_inventory_request_completed)
	add_child(inventory_request)

func _show_login_mode() -> void:
	login_mode = true
	login_tab.disabled = true
	register_tab.disabled = false
	username_input.placeholder_text = "Usuario"
	password_input.placeholder_text = "Senha"
	submit_button.text = "Entrar"
	status_label.text = ""

func _show_register_mode() -> void:
	login_mode = false
	login_tab.disabled = false
	register_tab.disabled = true
	username_input.placeholder_text = "Usuario (3-15 chars)"
	password_input.placeholder_text = "Senha (min 6 chars)"
	submit_button.text = "Registrar"
	status_label.text = ""

func _on_submit_pressed() -> void:
	_set_auth_enabled(false)
	status_label.text = "Aguarde..."
	if login_mode:
		auth.login(username_input.text, password_input.text)
	else:
		auth.register(username_input.text, password_input.text)

func _on_logout_pressed() -> void:
	auth.logout()

func _start_queue(platform_id: String) -> void:
	if auth.get_token() == "":
		status_label.text = "Voce precisa fazer login primeiro."
		return
	selected_platform = platform_id
	pc_button.disabled = true
	mobile_button.disabled = true
	status_label.text = "Conectando ao servidor..."
	match_label.text = ""
	if network.connected_to_server:
		_join_queue()
	else:
		network.connect_to_server()

func _join_queue() -> void:
	status_label.text = "Procurando partida..."
	network.join_queue_with_token(auth.get_token(), get_current_build(), get_loadout(), selected_platform)
	network.select_platform(selected_platform)

func _on_session_checked(is_logged_in: bool, checked_username: String) -> void:
	if is_logged_in:
		_show_logged_in(checked_username)
	else:
		_show_logged_out()

func _on_auth_success(auth_username: String) -> void:
	_show_logged_in(auth_username)

func _on_auth_failed(message: String) -> void:
	_set_auth_enabled(true)
	status_label.text = message

func _on_logged_out() -> void:
	_show_logged_out()

func _on_welcome(_payload: Dictionary) -> void:
	if auth.get_token() != "":
		_join_queue()

func _on_queue_status(payload: Dictionary) -> void:
	var players: int = int(payload.get("playersInQueue", 0))
	var wait_seconds: int = int(ceil(float(payload.get("estimatedWaitMs", 0)) / 1000.0))
	status_label.text = "Na fila (%d jogadores) - ~%ds" % [players, wait_seconds]

func _on_match_found(payload: Dictionary) -> void:
	var names: Array = []
	var raw_players: Variant = payload.get("players", [])
	if typeof(raw_players) == TYPE_ARRAY:
		for raw_player: Variant in raw_players:
			if typeof(raw_player) == TYPE_DICTIONARY:
				var player_data: Dictionary = raw_player
				names.append(str(player_data.get("name", "Player")))
	status_label.text = "Partida encontrada!"
	match_label.text = "Jogadores:\n" + "\n".join(names)

func _on_game_start(payload: Dictionary) -> void:
	overlay.visible = false
	modal_layer.visible = false
	game_over_layer.visible = false
	game_started.emit(payload)

func _on_player_died(payload: Dictionary) -> void:
	var dead_player_name: String = str(payload.get("playerName", "Jogador"))
	match_label.text = "%s foi abatido. Espectando jogadores vivos..." % dead_player_name

func _on_game_over(payload: Dictionary) -> void:
	overlay.visible = false
	modal_layer.visible = false
	game_over_layer.visible = true
	_clear_children(game_over_body)

	var title: Label = _make_label("FIM DE JOGO", 34, HORIZONTAL_ALIGNMENT_CENTER)
	game_over_body.add_child(title)

	var my_id: String = str(network.player_id)
	var my_score: Dictionary = _find_my_score(payload, my_id)
	var final_score: int = int(my_score.get("score", 0))
	var match_time: float = float(payload.get("time", 0.0))
	var collapse_level: int = int(payload.get("collapseLevel", 0))
	game_over_body.add_child(_make_label("Score: %d    Tempo: %s    Colapso: %d" % [final_score, _format_time(match_time), collapse_level], 18, HORIZONTAL_ALIGNMENT_CENTER))

	_add_death_summary(my_score)
	_add_final_scores(payload)
	_add_dropped_items(payload, my_id)

	var buttons: HBoxContainer = HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	game_over_body.add_child(buttons)

	var restart_button: Button = Button.new()
	restart_button.text = "Jogar Novamente"
	restart_button.pressed.connect(_restart_scene)
	buttons.add_child(restart_button)

	var dashboard_button: Button = Button.new()
	dashboard_button.text = "Voltar ao Lobby"
	dashboard_button.pressed.connect(_return_to_lobby)
	buttons.add_child(dashboard_button)

func _on_server_error(payload: Dictionary) -> void:
	status_label.text = str(payload.get("message", "Erro do servidor."))
	pc_button.disabled = auth.get_token() == ""
	mobile_button.disabled = auth.get_token() == ""

func _on_disconnected(_code: int, reason: String) -> void:
	if overlay.visible:
		status_label.text = "Desconectado. %s" % reason
		pc_button.disabled = auth.get_token() == ""
		mobile_button.disabled = auth.get_token() == ""

func _show_logged_in(auth_username: String) -> void:
	_set_auth_enabled(false)
	lobby_panel.visible = true
	username_input.visible = false
	password_input.visible = false
	submit_button.visible = false
	login_tab.visible = false
	register_tab.visible = false
	user_label.visible = true
	user_label.text = "Bem-vindo, %s!" % auth_username
	logout_button.visible = true
	tower_button.visible = true
	tower_summary_label.visible = true
	loadout_button.visible = true
	loadout_summary_label.visible = true
	pc_button.disabled = false
	mobile_button.disabled = false
	status_label.text = "Pronto para entrar na fila."
	_fetch_inventory()
	_update_tower_summary()
	_update_loadout_summary()

func _show_logged_out() -> void:
	overlay.visible = true
	game_over_layer.visible = false
	modal_layer.visible = false
	lobby_panel.visible = false
	_set_auth_enabled(true)
	username_input.visible = true
	password_input.visible = true
	submit_button.visible = true
	login_tab.visible = true
	register_tab.visible = true
	user_label.visible = false
	logout_button.visible = false
	tower_button.visible = false
	tower_summary_label.visible = false
	loadout_button.visible = false
	loadout_summary_label.visible = false
	pc_button.disabled = true
	mobile_button.disabled = true
	match_label.text = ""
	status_label.text = "Faca login para jogar."
	_show_login_mode()

func _set_auth_enabled(enabled: bool) -> void:
	username_input.editable = enabled
	password_input.editable = enabled
	submit_button.disabled = not enabled

func _open_tower_modal() -> void:
	modal_layer.visible = true
	modal_title_label.text = "TORRES DE ESSENCIA"
	_clear_children(modal_body)

	var tower_row: HBoxContainer = HBoxContainer.new()
	tower_row.alignment = BoxContainer.ALIGNMENT_CENTER
	modal_body.add_child(tower_row)

	for tower_id: String in ["red", "green", "purple", "poison", "coin", "predator_hive"]:
		var tower_info: Dictionary = TOWER_DATA[tower_id]
		var select_button: Button = Button.new()
		select_button.text = "%s\n%s" % [str(tower_info.get("display", tower_id)), str(tower_info.get("focus", ""))]
		select_button.toggle_mode = true
		select_button.button_pressed = tower_id == selected_tower_color
		select_button.pressed.connect(func() -> void: _select_tower(tower_id))
		tower_row.add_child(select_button)

	var current_tower: Dictionary = TOWER_DATA[selected_tower_color]
	var ultimate_label: Label = _make_label("Andar 5 - Ultimate Basica: %s\nDesperta e sofre mutacao ao atingir o Nivel 20" % str(current_tower.get("ult", "")), 15, HORIZONTAL_ALIGNMENT_CENTER)
	modal_body.add_child(ultimate_label)

	var floors: Array = current_tower.get("floors", [])
	for floor_index: int in range(floors.size() - 1, -1, -1):
		var floor_data: Dictionary = floors[floor_index]
		_add_floor_row(floor_data)

func _select_tower(tower_id: String) -> void:
	selected_tower_color = tower_id
	selected_passives = {1: 0, 2: 0, 3: 0, 4: 0}
	_save_local_config()
	_update_tower_summary()
	if modal_layer.visible and modal_title_label.text == "TORRES DE ESSENCIA":
		_open_tower_modal()

func _add_floor_row(floor_data: Dictionary) -> void:
	var row: VBoxContainer = VBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	modal_body.add_child(row)

	var level_number: int = int(floor_data.get("level", 1))
	var header: Label = _make_label("Andar %d - %s" % [level_number, str(floor_data.get("title", ""))], 16, HORIZONTAL_ALIGNMENT_LEFT)
	row.add_child(header)

	var options_row: HBoxContainer = HBoxContainer.new()
	row.add_child(options_row)

	var options: Array = floor_data.get("options", [])
	for option_index: int in range(options.size()):
		var option_button: Button = Button.new()
		option_button.text = str(options[option_index])
		option_button.toggle_mode = true
		option_button.button_pressed = int(selected_passives.get(level_number, 0)) == option_index
		option_button.custom_minimum_size = Vector2(200, 48)
		option_button.pressed.connect(func() -> void: _select_passive(level_number, option_index))
		options_row.add_child(option_button)

func _select_passive(level_number: int, option_index: int) -> void:
	selected_passives[level_number] = option_index
	_save_local_config()
	_update_tower_summary()
	_open_tower_modal()

func _open_loadout_modal() -> void:
	modal_layer.visible = true
	modal_title_label.text = "INVENTARIO & LOADOUT"
	_fetch_inventory()
	_render_loadout_modal("Carregando inventario...")

func _render_loadout_modal(message: String = "") -> void:
	_clear_children(modal_body)
	modal_body.add_child(_make_label("Selecione ate 3 itens. Maximo: 1 lendario, 2 epicos e 3 basicos.", 15, HORIZONTAL_ALIGNMENT_CENTER))
	if message != "":
		modal_body.add_child(_make_label(message, 14, HORIZONTAL_ALIGNMENT_CENTER))
	_update_loadout_summary()

	var counts: Dictionary = _count_selected_rarities()
	var warning: String = _loadout_warning(counts)
	if warning != "":
		var warning_label: Label = _make_label(warning, 14, HORIZONTAL_ALIGNMENT_CENTER)
		warning_label.modulate = Color(1.0, 0.25, 0.25)
		modal_body.add_child(warning_label)

	if inventory.is_empty():
		modal_body.add_child(_make_label("Seu inventario esta vazio. Obtenha itens jogando e negociando pelo site.", 15, HORIZONTAL_ALIGNMENT_CENTER))
		return

	var grid: GridContainer = GridContainer.new()
	grid.columns = 3
	modal_body.add_child(grid)

	for raw_entry: Variant in inventory:
		if typeof(raw_entry) == TYPE_DICTIONARY:
			var entry: Dictionary = raw_entry
			var item_id: String = str(entry.get("id", ""))
			if item_id != "":
				grid.add_child(_make_item_card(entry))

func _toggle_loadout_item(item_id: String) -> void:
	if selected_loadout.has(item_id):
		selected_loadout.erase(item_id)
	else:
		var entry: Dictionary = _item_entry(item_id)
		var rarity: String = str(entry.get("rarity", "basic"))
		var counts: Dictionary = _count_selected_rarities()
		if selected_loadout.size() >= MAX_LOADOUT_ITEMS:
			_render_loadout_modal("Voce so pode equipar no maximo 3 itens.")
			return
		if rarity == "legendary" and int(counts.get("legendary", 0)) >= 1:
			_render_loadout_modal("Limite lendario excedido: apenas 1 lendario.")
			return
		if rarity == "epic" and int(counts.get("epic", 0)) >= 2:
			_render_loadout_modal("Limite epico excedido: no maximo 2 epicos.")
			return
		selected_loadout.append(item_id)
	_save_local_config()
	_update_loadout_summary()
	_render_loadout_modal()

func _fetch_inventory() -> void:
	if auth == null or auth.get_token() == "":
		return
	var base_url: String = str(auth.get("api_base_url")).trim_suffix("/")
	var endpoint: String = "%s/api/user/data" % base_url
	var headers: PackedStringArray = PackedStringArray(["Authorization: Bearer %s" % auth.get_token()])
	var error: int = inventory_request.request(endpoint, headers, HTTPClient.METHOD_GET)
	if error != OK:
		_render_loadout_modal("Nao foi possivel carregar o inventario agora.")

func _on_inventory_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if response_code < 200 or response_code >= 300:
		inventory = []
		_filter_loadout_against_inventory()
		_update_loadout_summary()
		if modal_layer.visible and modal_title_label.text == "INVENTARIO & LOADOUT":
			_render_loadout_modal("Nao foi possivel carregar o inventario.")
		return

	var text_body: String = body.get_string_from_utf8()
	var parser: JSON = JSON.new()
	var parse_error: int = parser.parse(text_body)
	if parse_error != OK or typeof(parser.data) != TYPE_DICTIONARY:
		inventory = []
		_update_loadout_summary()
		return

	var data: Dictionary = parser.data
	var raw_inventory: Variant = data.get("inventory", [])
	inventory = []
	if typeof(raw_inventory) == TYPE_ARRAY:
		for raw_id: Variant in raw_inventory:
			var item_id: String = str(raw_id)
			var entry: Dictionary = _item_entry(item_id)
			entry["id"] = item_id
			inventory.append(entry)
	_filter_loadout_against_inventory()
	_update_loadout_summary()
	if modal_layer.visible and modal_title_label.text == "INVENTARIO & LOADOUT":
		_render_loadout_modal()

func _item_entry(item_id: String) -> Dictionary:
	var defaults: Dictionary = {"display": item_id, "rarity": "basic"}
	if ITEM_DATA.has(item_id):
		var entry: Dictionary = ITEM_DATA[item_id].duplicate()
		entry["id"] = item_id
		return entry
	defaults["id"] = item_id
	return defaults

func _filter_loadout_against_inventory() -> void:
	if inventory.is_empty():
		return
	var valid_ids: Array = []
	for raw_entry: Variant in inventory:
		if typeof(raw_entry) == TYPE_DICTIONARY:
			var entry: Dictionary = raw_entry
			valid_ids.append(str(entry.get("id", "")))
	var filtered: Array = []
	for raw_id: Variant in selected_loadout:
		var item_id: String = str(raw_id)
		if valid_ids.has(item_id) and not filtered.has(item_id):
			filtered.append(item_id)
	selected_loadout = filtered

func _count_selected_rarities() -> Dictionary:
	var counts: Dictionary = {"basic": 0, "epic": 0, "legendary": 0}
	for raw_id: Variant in selected_loadout:
		var entry: Dictionary = _item_entry(str(raw_id))
		var rarity: String = str(entry.get("rarity", "basic"))
		counts[rarity] = int(counts.get(rarity, 0)) + 1
	return counts

func _loadout_warning(counts: Dictionary) -> String:
	if selected_loadout.size() > MAX_LOADOUT_ITEMS:
		return "Limite excedido: %d/3 itens." % selected_loadout.size()
	if int(counts.get("legendary", 0)) > 1:
		return "Limite excedido: somente 1 lendario."
	if int(counts.get("epic", 0)) > 2:
		return "Limite excedido: somente 2 epicos."
	return ""

func _update_tower_summary() -> void:
	var tower_info: Dictionary = TOWER_DATA[selected_tower_color]
	var floors: Array = tower_info.get("floors", [])
	var selected_names: Array = []
	for floor_index: int in range(floors.size()):
		var floor_data: Dictionary = floors[floor_index]
		var options: Array = floor_data.get("options", [])
		var option_index: int = int(selected_passives.get(floor_index + 1, 0))
		if option_index >= 0 and option_index < options.size():
			selected_names.append(str(options[option_index]))
	tower_summary_label.text = "%s - %s\n[%s]" % [str(tower_info.get("display", selected_tower_color)), str(tower_info.get("focus", "")), " | ".join(selected_names)]
	_refresh_tower_cards()
	_refresh_tower_details()

func _update_loadout_summary() -> void:
	loadout_summary_label.text = "%d/3 Itens Equipados" % selected_loadout.size()
	_refresh_loadout_slots()
	_refresh_inventory_grid()

func _refresh_tower_cards() -> void:
	if tower_cards_container == null:
		return
	_clear_children(tower_cards_container)
	for tower_id: String in ["red", "green", "purple", "poison", "coin", "predator_hive"]:
		tower_cards_container.add_child(_make_tower_card(tower_id))

func _make_tower_card(tower_id: String) -> Button:
	var tower_info: Dictionary = TOWER_DATA[tower_id]
	var is_selected: bool = tower_id == selected_tower_color
	var button: Button = Button.new()
	button.custom_minimum_size = Vector2(176, 92)
	button.text = ""
	button.tooltip_text = str(tower_info.get("display", tower_id))
	button.add_theme_stylebox_override("normal", _make_panel_style(Color(0.05, 0.06, 0.08, 0.88), _tower_color(tower_id).darkened(0.15), 7, 1))
	button.add_theme_stylebox_override("hover", _make_panel_style(Color(0.07, 0.08, 0.11, 0.95), _tower_color(tower_id), 7, 2))
	button.add_theme_stylebox_override("pressed", _make_panel_style(Color(0.03, 0.08, 0.09, 0.95), _tower_color(tower_id), 7, 2))
	if is_selected:
		button.add_theme_stylebox_override("normal", _make_panel_style(Color(0.03, 0.09, 0.09, 0.95), _tower_color(tower_id), 7, 2))
	button.pressed.connect(_select_tower.bind(tower_id))

	var content: VBoxContainer = VBoxContainer.new()
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 10
	content.offset_top = 8
	content.offset_right = -10
	content.offset_bottom = -8
	content.add_theme_constant_override("separation", 4)
	button.add_child(content)

	var name_label: Label = _make_label(str(tower_info.get("display", tower_id)), 14, HORIZONTAL_ALIGNMENT_LEFT)
	name_label.add_theme_color_override("font_color", _tower_color(tower_id))
	content.add_child(name_label)

	var focus_label: Label = _make_label(str(tower_info.get("focus", "")), 11, HORIZONTAL_ALIGNMENT_LEFT)
	focus_label.add_theme_color_override("font_color", Color(0.8, 0.86, 0.92, 1.0))
	content.add_child(focus_label)

	var state_label: Label = _make_label("Selecionada" if is_selected else "Clique para escolher", 10, HORIZONTAL_ALIGNMENT_LEFT)
	state_label.add_theme_color_override("font_color", Color(0.55, 1.0, 0.86, 1.0) if is_selected else Color(0.56, 0.6, 0.68, 1.0))
	content.add_child(state_label)
	return button

func _refresh_tower_details() -> void:
	if tower_details_container == null:
		return
	_clear_children(tower_details_container)
	var tower_info: Dictionary = TOWER_DATA[selected_tower_color]
	var header: Label = _make_label("%s - %s" % [str(tower_info.get("display", selected_tower_color)), str(tower_info.get("focus", ""))], 16, HORIZONTAL_ALIGNMENT_LEFT)
	header.add_theme_color_override("font_color", _tower_color(selected_tower_color))
	tower_details_container.add_child(header)

	var floors: Array = tower_info.get("floors", [])
	for floor_index: int in range(floors.size()):
		var floor_data: Dictionary = floors[floor_index]
		var level_number: int = int(floor_data.get("level", floor_index + 1))
		var options: Array = floor_data.get("options", [])
		var option_index: int = int(selected_passives.get(level_number, 0))
		var option_text: String = "Nao selecionado"
		if option_index >= 0 and option_index < options.size():
			option_text = str(options[option_index])
		var row: Label = _make_label("Lv %d  %s: %s" % [level_number * 5, str(floor_data.get("title", "")), option_text], 12, HORIZONTAL_ALIGNMENT_LEFT)
		row.add_theme_color_override("font_color", Color(0.86, 0.9, 0.95, 1.0))
		tower_details_container.add_child(row)

	var ult_label: Label = _make_label("Lv 20  Ultimate: %s" % str(tower_info.get("ult", "")), 12, HORIZONTAL_ALIGNMENT_LEFT)
	ult_label.add_theme_color_override("font_color", Color(1.0, 0.86, 0.34, 1.0))
	tower_details_container.add_child(ult_label)

func _refresh_loadout_slots() -> void:
	if loadout_slots_container == null:
		return
	_clear_children(loadout_slots_container)
	for slot_index: int in range(MAX_LOADOUT_ITEMS):
		var item_id: String = ""
		if slot_index < selected_loadout.size():
			item_id = str(selected_loadout[slot_index])
		loadout_slots_container.add_child(_make_loadout_slot(slot_index, item_id))

func _make_loadout_slot(slot_index: int, item_id: String) -> PanelContainer:
	var slot: PanelContainer = PanelContainer.new()
	slot.custom_minimum_size = Vector2(210, 66)
	var border_color: Color = Color(0.22, 0.26, 0.32, 1.0)
	if item_id != "":
		border_color = _rarity_color(str(_item_entry(item_id).get("rarity", "basic")))
	slot.add_theme_stylebox_override("panel", _make_panel_style(Color(0.055, 0.06, 0.08, 0.9), border_color, 6, 1))

	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	slot.add_child(row)

	var icon: TextureRect = TextureRect.new()
	icon.custom_minimum_size = Vector2(42, 42)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	row.add_child(icon)

	var text_box: VBoxContainer = VBoxContainer.new()
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(text_box)

	if item_id == "":
		var empty_label: Label = _make_label("Slot %d" % (slot_index + 1), 12, HORIZONTAL_ALIGNMENT_LEFT)
		empty_label.autowrap_mode = TextServer.AUTOWRAP_OFF
		empty_label.clip_text = true
		empty_label.add_theme_color_override("font_color", Color(0.5, 0.55, 0.62, 1.0))
		text_box.add_child(empty_label)
		var empty_state: Label = _make_label("Vazio", 11, HORIZONTAL_ALIGNMENT_LEFT)
		empty_state.autowrap_mode = TextServer.AUTOWRAP_OFF
		empty_state.clip_text = true
		text_box.add_child(empty_state)
	else:
		var entry: Dictionary = _item_entry(item_id)
		var item_name: Label = _make_label(str(entry.get("display", item_id)), 12, HORIZONTAL_ALIGNMENT_LEFT)
		item_name.autowrap_mode = TextServer.AUTOWRAP_OFF
		item_name.clip_text = true
		text_box.add_child(item_name)
		var rarity_label: Label = _make_label(str(entry.get("rarity", "basic")).to_upper(), 10, HORIZONTAL_ALIGNMENT_LEFT)
		rarity_label.autowrap_mode = TextServer.AUTOWRAP_OFF
		rarity_label.clip_text = true
		rarity_label.add_theme_color_override("font_color", border_color)
		text_box.add_child(rarity_label)
		_apply_or_request_item_icon(item_id, icon)
	return slot

func _refresh_inventory_grid() -> void:
	if inventory_grid == null:
		return
	_clear_children(inventory_grid)
	if inventory.is_empty():
		var empty_label: Label = _make_label("Inventario vazio ou carregando...", 13, HORIZONTAL_ALIGNMENT_CENTER)
		empty_label.custom_minimum_size = Vector2(720, 40)
		inventory_grid.add_child(empty_label)
		return
	for raw_entry: Variant in inventory:
		if typeof(raw_entry) == TYPE_DICTIONARY:
			var entry: Dictionary = raw_entry
			var item_id: String = str(entry.get("id", ""))
			if item_id != "":
				inventory_grid.add_child(_make_item_card(entry))

func _make_item_card(entry: Dictionary) -> Button:
	var item_id: String = str(entry.get("id", ""))
	var item_display: String = str(entry.get("display", item_id))
	var rarity: String = str(entry.get("rarity", "basic"))
	var is_equipped: bool = selected_loadout.has(item_id)
	var border_color: Color = _rarity_color(rarity)

	var button: Button = Button.new()
	button.custom_minimum_size = Vector2(238, 70)
	button.text = ""
	button.tooltip_text = "%s - %s" % [item_display, rarity.to_upper()]
	var bg: Color = Color(0.055, 0.06, 0.08, 0.9)
	if is_equipped:
		bg = Color(0.03, 0.1, 0.085, 0.94)
	button.add_theme_stylebox_override("normal", _make_panel_style(bg, border_color, 6, 1 if not is_equipped else 2))
	button.add_theme_stylebox_override("hover", _make_panel_style(Color(0.075, 0.085, 0.11, 0.98), border_color, 6, 2))
	button.add_theme_stylebox_override("pressed", _make_panel_style(Color(0.03, 0.13, 0.11, 0.98), border_color, 6, 2))
	button.pressed.connect(_toggle_loadout_item.bind(item_id))

	var row: HBoxContainer = HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 8
	row.offset_top = 8
	row.offset_right = -8
	row.offset_bottom = -8
	row.add_theme_constant_override("separation", 8)
	button.add_child(row)

	var icon: TextureRect = TextureRect.new()
	icon.custom_minimum_size = Vector2(42, 42)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	row.add_child(icon)
	_apply_or_request_item_icon(item_id, icon)

	var text_box: VBoxContainer = VBoxContainer.new()
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(text_box)

	var name_label: Label = _make_label(item_display, 11, HORIZONTAL_ALIGNMENT_LEFT)
	name_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	name_label.clip_text = true
	text_box.add_child(name_label)

	var rarity_label: Label = _make_label(rarity.to_upper(), 9, HORIZONTAL_ALIGNMENT_LEFT)
	rarity_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	rarity_label.clip_text = true
	rarity_label.add_theme_color_override("font_color", border_color)
	text_box.add_child(rarity_label)

	if is_equipped:
		var equip_label: Label = _make_label("EQUIPADO", 9, HORIZONTAL_ALIGNMENT_LEFT)
		equip_label.autowrap_mode = TextServer.AUTOWRAP_OFF
		equip_label.clip_text = true
		equip_label.add_theme_color_override("font_color", Color(0.38, 1.0, 0.78, 1.0))
		text_box.add_child(equip_label)
	return button

func _load_item_image_map() -> void:
	if not FileAccess.file_exists(ITEM_IMAGE_MAP_PATH):
		return
	var file: FileAccess = FileAccess.open(ITEM_IMAGE_MAP_PATH, FileAccess.READ)
	if file == null:
		return
	var parser: JSON = JSON.new()
	var parse_error: Error = parser.parse(file.get_as_text())
	file.close()
	if parse_error == OK and typeof(parser.data) == TYPE_DICTIONARY:
		item_image_map = parser.data

func _apply_or_request_item_icon(item_id: String, target: TextureRect) -> void:
	if not is_instance_valid(target):
		return
	if target.is_queued_for_deletion():
		return

	if item_icon_cache.has(item_id):
		target.texture = item_icon_cache[item_id]
		return

	var targets: Array = item_icon_targets.get(item_id, [])
	var valid_targets: Array = []
	for raw_existing_target: Variant in targets:
		if typeof(raw_existing_target) != TYPE_OBJECT:
			continue
		if not is_instance_valid(raw_existing_target):
			continue
		if not (raw_existing_target is TextureRect):
			continue
		var existing_target: TextureRect = raw_existing_target as TextureRect
		if existing_target.is_queued_for_deletion():
			continue
		valid_targets.append(existing_target)

	valid_targets.append(target)
	item_icon_targets[item_id] = valid_targets
	if valid_targets.size() > 1:
		return

	var image_name: String = str(item_image_map.get(item_id, ""))
	if image_name == "":
		item_icon_targets.erase(item_id)
		return

	var request: HTTPRequest = HTTPRequest.new()
	add_child(request)
	request.request_completed.connect(_on_item_icon_request_completed.bind(item_id, request))
	var url: String = "%s/items/%s" % [icon_base_url.trim_suffix("/"), image_name]
	var error: int = request.request(url)
	if error != OK:
		item_icon_targets.erase(item_id)
		if is_instance_valid(request):
			request.queue_free()

func _on_item_icon_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, item_id: String, request: HTTPRequest) -> void:
	if is_instance_valid(request):
		request.queue_free()

	if response_code < 200 or response_code >= 300:
		item_icon_targets.erase(item_id)
		return

	var image: Image = Image.new()
	var error: Error = image.load_png_from_buffer(body)
	if error != OK:
		item_icon_targets.erase(item_id)
		return

	var texture: ImageTexture = ImageTexture.create_from_image(image)
	item_icon_cache[item_id] = texture

	var targets: Array = item_icon_targets.get(item_id, [])
	item_icon_targets.erase(item_id)
	for raw_target: Variant in targets:
		if typeof(raw_target) != TYPE_OBJECT:
			continue
		if not is_instance_valid(raw_target):
			continue
		if not (raw_target is TextureRect):
			continue
		var target_rect: TextureRect = raw_target as TextureRect
		if target_rect.is_queued_for_deletion():
			continue
		target_rect.texture = texture

func _tower_color(tower_id: String) -> Color:
	match tower_id:
		"red":
			return Color(1.0, 0.24, 0.18, 1.0)
		"green":
			return Color(0.35, 1.0, 0.46, 1.0)
		"purple":
			return Color(0.72, 0.45, 1.0, 1.0)
		"poison":
			return Color(0.25, 1.0, 0.72, 1.0)
		"coin":
			return Color(0.96, 0.62, 0.04, 1.0)
		"predator_hive":
			return Color(0.22, 0.74, 0.97, 1.0)
	return Color.WHITE

func _make_panel_style(bg: Color, border: Color, radius: int, border_width: int) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.border_width_left = border_width
	style.border_width_top = border_width
	style.border_width_right = border_width
	style.border_width_bottom = border_width
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.content_margin_left = 10
	style.content_margin_top = 8
	style.content_margin_right = 10
	style.content_margin_bottom = 8
	return style

func _close_modal() -> void:
	_save_local_config()
	modal_layer.visible = false

func _add_death_summary(my_score: Dictionary) -> void:
	var report: Variant = my_score.get("deathReport", {})
	if typeof(report) != TYPE_DICTIONARY:
		game_over_body.add_child(_make_label("Resumo da Morte: voce terminou sem morte registrada.", 16, HORIZONTAL_ALIGNMENT_CENTER))
		return
	var report_data: Dictionary = report
	var final_blow: Variant = report_data.get("finalBlow", {})
	if typeof(final_blow) != TYPE_DICTIONARY:
		game_over_body.add_child(_make_label("Resumo da Morte: voce terminou sem morte registrada.", 16, HORIZONTAL_ALIGNMENT_CENTER))
		return
	var blow_data: Dictionary = final_blow
	if blow_data.is_empty():
		game_over_body.add_child(_make_label("Resumo da Morte: voce terminou sem morte registrada.", 16, HORIZONTAL_ALIGNMENT_CENTER))
		return
	var top_contributor: Dictionary = {}
	if typeof(report_data.get("topContributor", {})) == TYPE_DICTIONARY:
		top_contributor = report_data.get("topContributor", {})
	var lines: Array = [
		"Resumo da Morte",
		"Eliminado por: %s" % str(blow_data.get("directSourceName", "Desconhecido")),
		"Ataque final: %s" % str(blow_data.get("abilityName", "Desconhecido")),
		"Dano final: %d" % int(round(float(blow_data.get("damage", 0)))),
		"Principal causador nos ultimos 10s: %s" % str(top_contributor.get("sourceName", "Desconhecido")),
		"Dano recebido nos ultimos 10s: %d" % int(round(float(report_data.get("totalDamageLast10s", 0)))),
		"Tempo da morte: %s" % _format_time(float(report_data.get("deathTime", 0))),
		"Level do player: %d" % int(report_data.get("playerLevel", 0))
	]
	game_over_body.add_child(_make_label("\n".join(lines), 15, HORIZONTAL_ALIGNMENT_LEFT))

func _add_final_scores(payload: Dictionary) -> void:
	var raw_scores: Variant = payload.get("scores", [])
	if typeof(raw_scores) != TYPE_ARRAY:
		return
	var lines: Array = ["Placar Final"]
	var index: int = 1
	for raw_score: Variant in raw_scores:
		if typeof(raw_score) == TYPE_DICTIONARY:
			var score_data: Dictionary = raw_score
			lines.append("%d. %s - %d pts" % [index, str(score_data.get("playerName", "Player")), int(score_data.get("score", 0))])
			index += 1
	game_over_body.add_child(_make_label("\n".join(lines), 16, HORIZONTAL_ALIGNMENT_CENTER))

func _add_dropped_items(payload: Dictionary, my_id: String) -> void:
	var raw_drops: Variant = payload.get("droppedItems", [])
	if typeof(raw_drops) != TYPE_ARRAY:
		return
	var lines: Array = []
	for raw_drop: Variant in raw_drops:
		if typeof(raw_drop) == TYPE_DICTIONARY:
			var drop_data: Dictionary = raw_drop
			if str(drop_data.get("playerId", "")) == my_id:
				var item_id: String = str(drop_data.get("itemId", ""))
				lines.append(str(_item_entry(item_id).get("display", item_id)))
	if lines.is_empty():
		return
	game_over_body.add_child(_make_label("Itens Recebidos\n%s" % "\n".join(lines), 16, HORIZONTAL_ALIGNMENT_CENTER))
	_fetch_inventory()

func _find_my_score(payload: Dictionary, my_id: String) -> Dictionary:
	var raw_scores: Variant = payload.get("scores", [])
	if typeof(raw_scores) == TYPE_ARRAY:
		for raw_score: Variant in raw_scores:
			if typeof(raw_score) == TYPE_DICTIONARY:
				var score_data: Dictionary = raw_score
				if str(score_data.get("playerId", "")) == my_id:
					return score_data
	return {}

func _restart_scene() -> void:
	get_tree().reload_current_scene()

func _return_to_lobby() -> void:
	game_over_layer.visible = false
	overlay.visible = true
	if auth != null and auth.get_token() != "":
		_show_logged_in(str(auth.get("username")))
	else:
		_show_logged_out()

func _load_local_config() -> void:
	var cfg: ConfigFile = ConfigFile.new()
	var error: int = cfg.load(CONFIG_PATH)
	if error != OK:
		return
	var tower_id: String = str(cfg.get_value("build", "tower", selected_tower_color))
	if TOWER_DATA.has(tower_id):
		selected_tower_color = tower_id
	for level_number: int in range(1, 5):
		selected_passives[level_number] = int(cfg.get_value("build", "floor%d" % level_number, 0))
	var saved_loadout: Variant = cfg.get_value("loadout", "items", [])
	if typeof(saved_loadout) == TYPE_ARRAY:
		selected_loadout = saved_loadout

func _save_local_config() -> void:
	var cfg: ConfigFile = ConfigFile.new()
	cfg.set_value("build", "tower", selected_tower_color)
	for level_number: int in range(1, 5):
		cfg.set_value("build", "floor%d" % level_number, int(selected_passives.get(level_number, 0)))
	cfg.set_value("loadout", "items", selected_loadout)
	cfg.save(CONFIG_PATH)

func _format_time(seconds: float) -> String:
	var total: int = int(floor(seconds))
	var minutes: int = int(floor(float(total) / 60.0))
	var secs: int = total % 60
	return "%d:%02d" % [minutes, secs]

func _rarity_color(rarity: String) -> Color:
	if rarity == "legendary":
		return Color(1.0, 0.84, 0.2, 1.0)
	if rarity == "epic":
		return Color(0.72, 0.38, 1.0, 1.0)
	return Color(0.85, 0.85, 0.85, 1.0)

func _make_label(text_value: String, font_size: int, alignment: HorizontalAlignment) -> Label:
	var label: Label = Label.new()
	label.text = text_value
	label.horizontal_alignment = alignment
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", font_size)
	return label

func _clear_children(parent_node: Node) -> void:
	for child_node: Node in parent_node.get_children():
		child_node.queue_free()
