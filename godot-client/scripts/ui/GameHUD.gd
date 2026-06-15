extends CanvasLayer
class_name GameHUD

const TOWER_DETAILS: Dictionary = {
	"red": {
		"display": "Torre Vermelha",
		"color": Color(1.0, 0.3, 0.3, 1.0),
		"skills": [[" +15% Dano", "+10% Speed", "+20% Critico"], ["10% Lifesteal", "+20% Dano (<30% HP)", "Ignora 25% Armor"], ["Dano escala c/ hits", "Ataque Cleave", "+70% Dano / -30% AS"], ["Kill = Cura+Speed", "4o Hit Explode", "Dano x2 (<20% HP)"]],
		"ult": "RAIO"
	},
	"green": {
		"display": "Torre Verde",
		"color": Color(0.3, 1.0, 0.3, 1.0),
		"skills": [["+25% HP Max", "Reducao Dano Flat", "Imune a Knockback"], ["Regen 1% HP/s", "+30% Defesa (>80% HP)", "Reflete 15% Dano"], ["Ataques geram Taunt", "Aura Reducao Dano", "Cura de itens x2"], ["Escudo fora combate", "Sobrevive 1 Hit Kill", "Escudo quebrado explode"]],
		"ult": "ESCU"
	},
	"purple": {
		"display": "Torre Roxa",
		"color": Color(0.83, 0.3, 1.0, 1.0),
		"skills": [["+25% Escudo Max", "+15% Move Speed", "+CDR"], ["Dano extra apos skill", "Escudo Defletor", "Vampirismo Magico"], ["10% Esquiva", "Ataques dao Slow", "Orbes extras no hit"], ["Kill reseta CDs", "Hitbox magias +30%", "Aura toxica DPS"]],
		"ult": "PULS"
	},
	"poison": {
		"display": "Torre do Veneno",
		"color": Color(0.06, 0.72, 0.5, 1.0),
		"skills": [["+20% Attack Speed", "+15% Move Speed permanent", "Tiro Toxico"], ["Passos Leves (+20% MS)", "Presas Gemeas (Heal)", "Dardo Cegante"], ["Miasma Menor", "Toxina Paralisante", "Foco Infeccioso"], ["Contaminacao", "Armadilha Cubica", "Espalhar a Peste"]],
		"ult": "FRAS"
	},
	"coin": {
		"display": "Torre Coringa",
		"color": Color(0.96, 0.62, 0.04, 1.0),
		"skills": [["+18% Dano / -10% HP", "+22% HP / -10% Dano", "+15% Speed / -12% Def"], ["+18% Crit / -15% CritDmg", "+25% CritDmg / -10% AS", "+20% AS / -12% Dano"], ["6% Lifesteal", "+18% Def / -15% Speed", "+12% XP / -8% HP"], ["<35% HP: +30% dano", ">70% HP: -18% dano recebido", "5o Hit +80%"]],
		"ult": "GIRO"
	},
	"predator_hive": {
		"display": "Bastiao Predador da Colmeia",
		"color": Color(0.22, 0.74, 0.97, 1.0),
		"skills": [["Reflexo Felino", "Pele Cinetica", "Garras da Colmeia"], ["Braco de Bastiao", "Aparar Geometrico", "Chamado dos Ergs"], ["Enxame de Fragmentos", "Regeneracao Mutante", "Carapaca Viva"], ["Contra-Ataque Cinetico", "Muralha Predadora", "Evolucao da Ninhada"]],
		"ult": "BAST"
	}
}

const STATUS_NAMES: Dictionary = {
	"poison": "Veneno",
	"toxic": "Toxico",
	"plague": "Praga",
	"acid": "Corrosao",
	"burning": "Queimadura",
	"ignite": "Ignite",
	"bleeding": "Sangramento",
	"bleed": "Sangramento",
	"frozen": "Congelado",
	"freeze": "Congelado",
	"slowed": "Lentidao",
	"slow": "Lentidao",
	"stunned": "Atordoado",
	"rooted": "Enraizado",
	"blind": "Cegueira",
	"silenced": "Silencio",
	"confusion": "Confusao",
	"disoriented": "Desorientado",
	"regen": "Regeneracao",
	"haste": "Haste",
	"aegis": "Aegis",
	"shield": "Escudo",
	"enrage": "Furia",
	"thorns": "Espinhos",
	"lifesteal": "Roubo de Vida",
	"hive_wound": "Ferida de Colmeia"
}

const POSITIVE_STATUS: Dictionary = {
	"regen": true,
	"regeneration": true,
	"haste": true,
	"aegis": true,
	"shield": true,
	"enrage": true,
	"fury": true,
	"lifesteal": true,
	"spellvamp": true,
	"thorns": true,
	"speed": true,
	"invulnerable": true
}

var root: Control
var left_panel: PanelContainer
var hp_bar: ProgressBar
var hp_label: Label
var xp_bar: ProgressBar
var xp_label: Label
var shield_container: VBoxContainer
var shield_bar: ProgressBar
var shield_label: Label
var level_label: Label
var score_label: Label
var tower_label: Label
var passives_label: Label
var status_container: VBoxContainer
var loadout_container: HBoxContainer
var skill_labels: Dictionary = {}
var skill_cooldown_labels: Dictionary = {}
var upgrade_layer: ColorRect
var upgrade_panel: PanelContainer
var upgrade_title_label: Label
var upgrade_skill_label: Label
var upgrade_options_container: VBoxContainer
var top_right_panel: PanelContainer
var top_name_label: Label
var top_level_label: Label
var top_hp_bar: ProgressBar
var coin_state_panel: PanelContainer
var coin_state_icon_label: Label
var coin_state_title_label: Label
var coin_state_subtitle_label: Label
var coin_state_timer_bar: ProgressBar
var coin_state_flip_label: Label
var last_coin_state: String = ""
var coin_flip_tween: Tween
var latency_label: Label
var last_status_signature: String = ""
var network: NetworkClient

func _ready() -> void:
	_build_ui()
	_set_mouse_passthrough(root)
	_set_upgrade_modal_mouse_enabled()
	hide_hud()

func configure(network_client: NetworkClient) -> void:
	network = network_client

func show_hud() -> void:
	visible = true

func hide_hud() -> void:
	visible = false

func update_latency(ms: int) -> void:
	if latency_label:
		latency_label.text = "Ping: %dms" % ms

func show_upgrade_prompt(payload: Dictionary) -> void:
	var skill: String = str(payload.get("skill", ""))
	var raw_options: Variant = payload.get("options", [])
	if skill == "" or typeof(raw_options) != TYPE_ARRAY:
		return
	show_hud()
	upgrade_layer.visible = true
	upgrade_title_label.text = "Escolha sua Evolucao - Nivel %d" % int(payload.get("level", 0))
	upgrade_skill_label.text = _skill_display_name(skill)
	_clear_children(upgrade_options_container)
	var options: Array = raw_options
	for raw_option: Variant in options:
		if typeof(raw_option) == TYPE_DICTIONARY:
			var option_data: Dictionary = raw_option
			upgrade_options_container.add_child(_make_upgrade_card(skill, option_data))

func update_snapshot(snapshot: Dictionary, local_player_id: String) -> void:
	if local_player_id == "":
		return
	var player_data: Dictionary = _find_player(snapshot, local_player_id)
	if player_data.is_empty():
		return
	show_hud()
	_update_player_panel(player_data)
	_update_tower(player_data)
	_update_loadout(player_data)
	_update_statuses(player_data)
	_update_skills(player_data)
	_update_coin_state(player_data)
	_update_top_right(player_data)

func _build_ui() -> void:
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(root)
	_build_left_panel()
	_build_skill_bar()
	_build_coin_state_panel()
	_build_top_right()
	_build_latency()
	_build_upgrade_modal()

func _build_left_panel() -> void:
	left_panel = PanelContainer.new()
	left_panel.position = Vector2(20, 20)
	left_panel.custom_minimum_size = Vector2(245, 0)
	left_panel.add_theme_stylebox_override("panel", _style_box(Color(0.01, 0.0, 0.02, 0.72), Color(0.3, 0.3, 0.35, 0.9), 8, 1))
	root.add_child(left_panel)

	var box: VBoxContainer = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	left_panel.add_child(box)

	var hp_stack: Control = _bar_with_label(Color(0.92, 0.22, 0.2, 1.0), "HP: 0 / 0")
	hp_bar = hp_stack.get_node("Bar") as ProgressBar
	hp_label = hp_stack.get_node("Text") as Label
	box.add_child(hp_stack)

	var xp_stack: Control = _bar_with_label(Color(0.42, 0.24, 0.72, 1.0), "XP: 0 / 0")
	xp_stack.custom_minimum_size = Vector2(0, 18)
	xp_bar = xp_stack.get_node("Bar") as ProgressBar
	xp_label = xp_stack.get_node("Text") as Label
	xp_label.add_theme_font_size_override("font_size", 11)
	box.add_child(xp_stack)

	shield_container = VBoxContainer.new()
	var shield_stack: Control = _bar_with_label(Color(1.0, 0.82, 0.14, 1.0), "Escudo: 0")
	shield_bar = shield_stack.get_node("Bar") as ProgressBar
	shield_label = shield_stack.get_node("Text") as Label
	shield_container.add_child(shield_stack)
	box.add_child(shield_container)

	var stat_row: HBoxContainer = HBoxContainer.new()
	box.add_child(stat_row)
	level_label = _make_label("Nv. 1", 19, Color(0.0, 1.0, 1.0, 1.0))
	score_label = _make_label("Pts: 0", 19, Color(0.0, 1.0, 1.0, 1.0))
	score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	score_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stat_row.add_child(level_label)
	stat_row.add_child(score_label)

	var sep_a: HSeparator = HSeparator.new()
	box.add_child(sep_a)

	tower_label = _make_label("", 14, Color(0.1, 1.0, 0.72, 1.0))
	box.add_child(tower_label)

	passives_label = _make_label("", 12, Color(0.86, 0.86, 0.9, 1.0))
	passives_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(passives_label)

	var sep_b: HSeparator = HSeparator.new()
	box.add_child(sep_b)

	status_container = VBoxContainer.new()
	status_container.add_theme_constant_override("separation", 3)
	box.add_child(status_container)

	var sep_c: HSeparator = HSeparator.new()
	box.add_child(sep_c)

	loadout_container = HBoxContainer.new()
	loadout_container.alignment = BoxContainer.ALIGNMENT_CENTER
	loadout_container.add_theme_constant_override("separation", 7)
	box.add_child(loadout_container)

func _build_skill_bar() -> void:
	var skills_panel: PanelContainer = PanelContainer.new()
	skills_panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	skills_panel.offset_left = -170
	skills_panel.offset_right = 170
	skills_panel.offset_top = -95
	skills_panel.offset_bottom = -20
	skills_panel.add_theme_stylebox_override("panel", _style_box(Color(0.02, 0.02, 0.025, 0.86), Color(0.08, 0.08, 0.08, 1.0), 8, 1))
	root.add_child(skills_panel)

	var row: HBoxContainer = HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	skills_panel.add_child(row)

	_add_skill_slot(row, "q", "Q")
	_add_skill_slot(row, "w", "W")
	_add_skill_slot(row, "e", "E")
	_add_skill_slot(row, "r", "R")

func _build_coin_state_panel() -> void:
	coin_state_panel = PanelContainer.new()
	coin_state_panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	coin_state_panel.offset_left = -110
	coin_state_panel.offset_right = 110
	coin_state_panel.offset_top = -168
	coin_state_panel.offset_bottom = -106
	coin_state_panel.visible = false
	coin_state_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	coin_state_panel.add_theme_stylebox_override("panel", _style_box(Color(0.05, 0.035, 0.01, 0.88), Color(0.96, 0.62, 0.04, 0.85), 8, 2))
	root.add_child(coin_state_panel)

	var box: VBoxContainer = VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_theme_constant_override("separation", 4)
	coin_state_panel.add_child(box)

	var row: HBoxContainer = HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)

	coin_state_icon_label = _make_label("O", 24, Color(1.0, 0.84, 0.22, 1.0))
	coin_state_icon_label.custom_minimum_size = Vector2(32, 32)
	coin_state_icon_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	coin_state_icon_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(coin_state_icon_label)

	var text_box: VBoxContainer = VBoxContainer.new()
	text_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(text_box)

	coin_state_title_label = _make_label("CARA", 18, Color(1.0, 0.84, 0.22, 1.0))
	coin_state_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	text_box.add_child(coin_state_title_label)

	coin_state_subtitle_label = _make_label("Ofensivo", 11, Color(1.0, 0.92, 0.72, 0.92))
	coin_state_subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	text_box.add_child(coin_state_subtitle_label)

	coin_state_timer_bar = ProgressBar.new()
	coin_state_timer_bar.custom_minimum_size = Vector2(0, 5)
	coin_state_timer_bar.show_percentage = false
	coin_state_timer_bar.max_value = 100.0
	coin_state_timer_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	coin_state_timer_bar.add_theme_stylebox_override("background", _style_box(Color(1.0, 1.0, 1.0, 0.12), Color.TRANSPARENT, 3, 0))
	coin_state_timer_bar.add_theme_stylebox_override("fill", _style_box(Color(0.96, 0.62, 0.04, 1.0), Color.TRANSPARENT, 3, 0))
	box.add_child(coin_state_timer_bar)

	coin_state_flip_label = _make_label("A moeda girou!", 10, Color(1.0, 0.95, 0.58, 1.0))
	coin_state_flip_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	coin_state_flip_label.visible = false
	box.add_child(coin_state_flip_label)

func _build_top_right() -> void:
	top_right_panel = PanelContainer.new()
	top_right_panel.anchor_left = 1.0
	top_right_panel.anchor_right = 1.0
	top_right_panel.offset_left = -280
	top_right_panel.offset_right = -20
	top_right_panel.offset_top = 22
	top_right_panel.offset_bottom = 62
	top_right_panel.add_theme_stylebox_override("panel", _style_box(Color(0.0, 0.05, 0.06, 0.82), Color(0.0, 0.72, 0.82, 0.65), 4, 1))
	root.add_child(top_right_panel)

	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	top_right_panel.add_child(row)

	top_name_label = _make_label("player", 13, Color(0.85, 1.0, 1.0, 1.0))
	top_name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(top_name_label)

	top_level_label = _make_label("0 Lv.1", 13, Color(0.0, 1.0, 1.0, 1.0))
	row.add_child(top_level_label)

	top_hp_bar = ProgressBar.new()
	top_hp_bar.custom_minimum_size = Vector2(42, 10)
	top_hp_bar.show_percentage = false
	top_hp_bar.max_value = 100.0
	top_hp_bar.add_theme_stylebox_override("background", _style_box(Color(0.12, 0.12, 0.12, 1.0), Color.TRANSPARENT, 3, 0))
	top_hp_bar.add_theme_stylebox_override("fill", _style_box(Color(0.9, 0.2, 0.24, 1.0), Color.TRANSPARENT, 3, 0))
	row.add_child(top_hp_bar)

func _build_latency() -> void:
	latency_label = _make_label("Ping: --ms", 12, Color(0.7, 0.7, 0.7, 0.85))
	latency_label.anchor_top = 1.0
	latency_label.anchor_bottom = 1.0
	latency_label.offset_left = 8
	latency_label.offset_right = 150
	latency_label.offset_top = -24
	latency_label.offset_bottom = -4
	root.add_child(latency_label)

func _build_upgrade_modal() -> void:
	upgrade_layer = ColorRect.new()
	upgrade_layer.color = Color(0.0, 0.0, 0.0, 0.0)
	upgrade_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	upgrade_layer.visible = false
	root.add_child(upgrade_layer)

	upgrade_panel = PanelContainer.new()
	upgrade_panel.anchor_left = 1.0
	upgrade_panel.anchor_right = 1.0
	upgrade_panel.anchor_top = 0.5
	upgrade_panel.anchor_bottom = 0.5
	upgrade_panel.offset_left = -380
	upgrade_panel.offset_right = -20
	upgrade_panel.offset_top = -210
	upgrade_panel.offset_bottom = 210
	upgrade_panel.add_theme_stylebox_override("panel", _style_box(Color(0.02, 0.015, 0.06, 0.94), Color(0.18, 0.34, 0.95, 0.9), 8, 2))
	upgrade_layer.add_child(upgrade_panel)

	var box: VBoxContainer = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	upgrade_panel.add_child(box)

	upgrade_title_label = _make_label("EVOLUCAO DISPONIVEL", 17, Color(0.75, 0.86, 1.0, 1.0))
	upgrade_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	box.add_child(upgrade_title_label)

	upgrade_skill_label = _make_label("", 14, Color(1.0, 0.84, 0.25, 1.0))
	upgrade_skill_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	box.add_child(upgrade_skill_label)

	upgrade_options_container = VBoxContainer.new()
	upgrade_options_container.add_theme_constant_override("separation", 8)
	box.add_child(upgrade_options_container)

func _add_skill_slot(row: HBoxContainer, skill_key: String, key_text: String) -> void:
	var slot: PanelContainer = PanelContainer.new()
	slot.custom_minimum_size = Vector2(64, 64)
	slot.add_theme_stylebox_override("panel", _style_box(Color(0.07, 0.07, 0.08, 0.92), Color(0.45, 0.45, 0.5, 1.0), 7, 2))
	row.add_child(slot)

	var box: VBoxContainer = VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	slot.add_child(box)

	var key_label: Label = _make_label(key_text, 25, Color.WHITE)
	key_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(key_label)
	skill_labels[skill_key] = key_label

	var cooldown_label: Label = _make_label("", 12, Color(1.0, 0.85, 0.2, 1.0))
	cooldown_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(cooldown_label)
	skill_cooldown_labels[skill_key] = cooldown_label

func _make_upgrade_card(skill: String, option_data: Dictionary) -> Button:
	var option_id: String = str(option_data.get("id", ""))
	var title_text: String = str(option_data.get("name", option_id))
	var desc_text: String = str(option_data.get("description", ""))
	var card: Button = Button.new()
	card.custom_minimum_size = Vector2(330, 92)
	card.text = "%s\n%s" % [title_text, desc_text]
	card.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.tooltip_text = desc_text
	card.add_theme_font_size_override("font_size", 12)
	card.add_theme_color_override("font_color", Color.WHITE)
	card.add_theme_stylebox_override("normal", _style_box(Color(0.04, 0.06, 0.16, 0.94), Color(0.25, 0.45, 1.0, 0.8), 6, 1))
	card.add_theme_stylebox_override("hover", _style_box(Color(0.08, 0.12, 0.26, 0.98), Color(0.45, 0.95, 1.0, 1.0), 6, 2))
	card.add_theme_stylebox_override("pressed", _style_box(Color(0.0, 0.42, 0.56, 0.98), Color(0.75, 1.0, 1.0, 1.0), 6, 2))
	card.pressed.connect(func() -> void: _choose_upgrade(skill, option_id))
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	return card

func _choose_upgrade(skill: String, option_id: String) -> void:
	if option_id == "":
		return
	upgrade_layer.visible = false
	if network != null:
		network.upgrade_chosen(skill, option_id)

func _bar_with_label(fill_color: Color, text_value: String) -> Control:
	var holder: Control = Control.new()
	holder.custom_minimum_size = Vector2(220, 27)

	var bar: ProgressBar = ProgressBar.new()
	bar.name = "Bar"
	bar.set_anchors_preset(Control.PRESET_FULL_RECT)
	bar.max_value = 100.0
	bar.value = 100.0
	bar.show_percentage = false
	bar.add_theme_stylebox_override("background", _style_box(Color(0.12, 0.12, 0.12, 1.0), Color(0.0, 0.0, 0.0, 0.0), 4, 0))
	bar.add_theme_stylebox_override("fill", _style_box(fill_color, Color(0.0, 0.0, 0.0, 0.0), 4, 0))
	holder.add_child(bar)

	var label: Label = Label.new()
	label.name = "Text"
	label.text = text_value
	label.set_anchors_preset(Control.PRESET_FULL_RECT)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", Color.WHITE)
	holder.add_child(label)
	return holder

func _update_player_panel(player_data: Dictionary) -> void:
	var hp: float = float(player_data.get("hp", 0.0))
	var max_hp: float = maxf(1.0, float(player_data.get("maxHp", 1.0)))
	var hp_pct: float = clampf((hp / max_hp) * 100.0, 0.0, 100.0)
	hp_bar.value = hp_pct
	hp_label.text = "HP: %d / %d" % [int(ceil(hp)), int(ceil(max_hp))]

	var xp: float = float(player_data.get("xp", 0.0))
	var xp_next: float = maxf(1.0, float(player_data.get("xpNext", 1.0)))
	xp_bar.value = clampf((xp / xp_next) * 100.0, 0.0, 100.0)
	xp_label.text = "XP: %d / %d" % [int(ceil(xp)), int(ceil(xp_next))]

	var shield_hp: float = float(player_data.get("shieldHp", 0.0))
	var shield_max: float = maxf(1.0, float(player_data.get("shieldMaxHp", 1.0)))
	var shield_active: bool = bool(player_data.get("isShieldActive", false)) and shield_hp > 0.0
	shield_container.visible = shield_active
	if shield_active:
		shield_bar.value = clampf((shield_hp / shield_max) * 100.0, 0.0, 100.0)
		shield_label.text = "Escudo: %d" % int(ceil(shield_hp))

	level_label.text = "Nv. %d" % int(player_data.get("level", 1))
	score_label.text = "Pts: %d" % int(player_data.get("score", 0))

func _update_tower(player_data: Dictionary) -> void:
	var raw_build: Variant = player_data.get("build", {})
	if typeof(raw_build) != TYPE_DICTIONARY:
		tower_label.text = "Torre: --"
		passives_label.text = ""
		return
	var build_data: Dictionary = raw_build
	var tower_id: String = str(build_data.get("buildingColor", "red"))
	if not TOWER_DETAILS.has(tower_id):
		tower_id = "red"
	var tower_data: Dictionary = TOWER_DETAILS[tower_id]
	tower_label.text = "%s" % str(tower_data.get("display", "Torre"))
	tower_label.add_theme_color_override("font_color", tower_data.get("color", Color.WHITE))

	var skills: Array = tower_data.get("skills", [])
	var lines: Array = []
	for floor_index: int in range(4):
		if floor_index >= skills.size():
			continue
		var floor_options: Array = skills[floor_index]
		var option_index: int = int(build_data.get("floor%d" % (floor_index + 1), 0))
		if option_index >= 0 and option_index < floor_options.size():
			lines.append("- %s" % str(floor_options[option_index]))
	var coin_state: String = str(player_data.get("coinState", ""))
	if tower_id == "coin" and coin_state != "":
		lines.append("Estado: %s" % coin_state)
	if tower_id == "predator_hive" and bool(player_data.get("ergCentralBaseActive", false)):
		var biomass_pct: float = float(player_data.get("ergBiomassPct", 0.0)) * 100.0
		var base_level: int = int(player_data.get("ergBaseLevel", 1))
		var base_stacks: int = min(50, int(player_data.get("ergBaseStacks", 0)))
		var active_workers: int = int(player_data.get("ergActiveWorkers", 0))
		var integrity_text: String = ""
		var integrities: Array = player_data.get("ergWorkerIntegrities", [])
		for value: Variant in integrities:
			var pip_count: int = int(value)
			integrity_text += ("X" if pip_count <= 0 else "o".repeat(min(6, pip_count))) + " "
		var slime_text: String = " | Gosma Ativa" if bool(player_data.get("ergBaseSlimeEnabled", false)) else ""
		lines.append("Base Erg Nv.%d | %d/50 | Ergs %d/4%s" % [base_level, base_stacks, active_workers, slime_text])
		lines.append("Integridade: %s| Biomassa %.2f%%" % [integrity_text.strip_edges(), biomass_pct])
	passives_label.text = "\n".join(lines)

	var r_label: Label = skill_labels.get("r") as Label
	if r_label:
		r_label.text = str(tower_data.get("ult", "R"))
		if tower_id == "coin" and coin_state != "":
			r_label.text = _coin_state_short(coin_state)

func _update_coin_state(player_data: Dictionary) -> void:
	if coin_state_panel == null:
		return
	var raw_build: Variant = player_data.get("build", {})
	if typeof(raw_build) != TYPE_DICTIONARY:
		coin_state_panel.visible = false
		last_coin_state = ""
		return
	var build_data: Dictionary = raw_build
	var tower_id: String = str(build_data.get("buildingColor", "red"))
	var raw_state: String = str(player_data.get("coinState", ""))
	if tower_id != "coin" or raw_state == "":
		coin_state_panel.visible = false
		last_coin_state = ""
		return

	var normalized: String = raw_state.to_lower()
	var is_crown: bool = normalized.find("coroa") >= 0
	var is_absolute: bool = normalized.find("absoluto") >= 0
	var title_text: String = "ABS" if is_absolute else ("COROA" if is_crown else "CARA")
	var subtitle_text: String = "Defensivo" if is_crown else "Ofensivo"
	var icon_text: String = "C" if is_crown else "O"
	var main_color: Color = Color(0.58, 0.76, 1.0, 1.0) if is_crown else Color(1.0, 0.78, 0.18, 1.0)
	var border_color: Color = Color(0.35, 0.65, 1.0, 0.9) if is_crown else Color(0.96, 0.62, 0.04, 0.9)
	var panel_bg: Color = Color(0.01, 0.04, 0.08, 0.88) if is_crown else Color(0.05, 0.035, 0.01, 0.88)

	coin_state_panel.visible = true
	coin_state_panel.add_theme_stylebox_override("panel", _style_box(panel_bg, border_color, 8, 2))
	coin_state_icon_label.text = icon_text
	coin_state_icon_label.add_theme_color_override("font_color", main_color)
	coin_state_title_label.text = title_text
	coin_state_title_label.add_theme_color_override("font_color", main_color)
	coin_state_subtitle_label.text = subtitle_text
	coin_state_timer_bar.add_theme_stylebox_override("fill", _style_box(main_color, Color.TRANSPARENT, 3, 0))

	var timer_ms: float = maxf(0.0, float(player_data.get("coinStateTimer", 0.0)))
	var max_timer_ms: float = 2000.0
	if normalized.find("viciada") >= 0 or normalized.find("quebrada") >= 0:
		max_timer_ms = 12000.0
	elif is_absolute:
		max_timer_ms = 2000.0
	coin_state_timer_bar.value = clampf((timer_ms / max_timer_ms) * 100.0, 0.0, 100.0)

	if last_coin_state != "" and last_coin_state != raw_state:
		_play_coin_flip_feedback()
	last_coin_state = raw_state

func _play_coin_flip_feedback() -> void:
	if coin_flip_tween != null:
		coin_flip_tween.kill()
	coin_state_flip_label.visible = true
	coin_state_panel.scale = Vector2(1.0, 1.0)
	coin_flip_tween = create_tween()
	coin_flip_tween.set_parallel(true)
	coin_flip_tween.tween_property(coin_state_panel, "scale", Vector2(1.08, 1.08), 0.16)
	coin_flip_tween.tween_property(coin_state_panel, "modulate:a", 0.78, 0.16)
	coin_flip_tween.chain().tween_property(coin_state_panel, "scale", Vector2(1.0, 1.0), 0.22)
	coin_flip_tween.parallel().tween_property(coin_state_panel, "modulate:a", 1.0, 0.22)
	coin_flip_tween.chain().tween_callback(func() -> void:
		if coin_state_flip_label != null:
			coin_state_flip_label.visible = false
	)

func _update_loadout(player_data: Dictionary) -> void:
	_clear_children(loadout_container)
	var raw_items: Variant = player_data.get("loadoutItems", [])
	if typeof(raw_items) != TYPE_ARRAY or (raw_items as Array).is_empty():
		var empty_label: Label = _make_label("Sem Itens Equipados", 11, Color(0.45, 0.45, 0.48, 1.0))
		loadout_container.add_child(empty_label)
		return
	for raw_id: Variant in raw_items:
		var item_id: String = str(raw_id)
		var item_panel: PanelContainer = PanelContainer.new()
		item_panel.custom_minimum_size = Vector2(28, 28)
		item_panel.tooltip_text = item_id
		item_panel.add_theme_stylebox_override("panel", _style_box(Color(0.12, 0.12, 0.14, 0.9), Color(0.75, 0.75, 0.82, 1.0), 2, 1))
		var item_label: Label = _make_label(_item_initials(item_id), 9, Color.WHITE)
		item_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		item_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		item_panel.add_child(item_label)
		loadout_container.add_child(item_panel)
	if int(player_data.get("loadoutLevel", 0)) > 0:
		loadout_container.add_child(_make_label("Nv. %d" % int(player_data.get("loadoutLevel", 0)), 11, Color(1.0, 0.92, 0.35, 1.0)))

func _update_statuses(player_data: Dictionary) -> void:
	var entries: Array = _collect_status_entries(player_data)
	var signature: String = _entries_signature(entries)
	if signature == last_status_signature:
		return
	last_status_signature = signature
	_clear_children(status_container)
	if entries.is_empty():
		status_container.add_child(_make_label("Sem efeitos ativos", 12, Color(0.55, 0.55, 0.58, 1.0)))
		return
	for raw_entry: Variant in entries:
		if typeof(raw_entry) != TYPE_DICTIONARY:
			continue
		var entry: Dictionary = raw_entry
		var status_id: String = str(entry.get("id", ""))
		var label: Label = _make_label(_status_line(entry), 12, _status_color(status_id))
		status_container.add_child(label)

func _collect_status_entries(player_data: Dictionary) -> Array:
	var entries: Array = []
	var timers: Dictionary = {}
	if typeof(player_data.get("buffTimers", {})) == TYPE_DICTIONARY:
		timers = player_data.get("buffTimers", {})
	_add_status_entry(entries, str(player_data.get("activeBuff", "")), timers, 1)
	_add_status_entry(entries, str(player_data.get("tempBuff", "")), timers, 1)
	var raw_timed: Variant = player_data.get("timedBuffs", [])
	if typeof(raw_timed) == TYPE_ARRAY:
		for raw_buff: Variant in raw_timed:
			_add_status_entry(entries, str(raw_buff), timers, 1)
	var raw_status: Variant = player_data.get("statusEffects", [])
	if typeof(raw_status) == TYPE_ARRAY:
		for raw_effect: Variant in raw_status:
			if typeof(raw_effect) == TYPE_DICTIONARY:
				var effect_data: Dictionary = raw_effect
				_add_status_entry(entries, str(effect_data.get("id", "")), timers, int(effect_data.get("stacks", 1)))
	var raw_pathogens: Variant = player_data.get("pathogens", {})
	if typeof(raw_pathogens) == TYPE_DICTIONARY:
		var pathogens: Dictionary = raw_pathogens
		for status_key: Variant in pathogens.keys():
			_add_status_entry(entries, str(status_key), timers, int(pathogens[status_key]))
	return entries

func _add_status_entry(entries: Array, status_id: String, timers: Dictionary, stacks: int) -> void:
	if status_id == "" or status_id == "null":
		return
	for raw_entry: Variant in entries:
		if typeof(raw_entry) == TYPE_DICTIONARY:
			var entry_data: Dictionary = raw_entry
			if str(entry_data.get("id", "")) == status_id:
				entry_data["stacks"] = max(int(entry_data.get("stacks", 1)), stacks)
				return
	var duration_ms: float = float(timers.get(status_id, 0.0))
	entries.append({"id": status_id, "stacks": max(1, stacks), "timer": duration_ms})

func _update_skills(player_data: Dictionary) -> void:
	var raw_cooldowns: Variant = player_data.get("skillCooldowns", {})
	if typeof(raw_cooldowns) != TYPE_DICTIONARY:
		return
	var cooldowns: Dictionary = raw_cooldowns
	for skill_key: String in ["q", "w", "e", "r"]:
		var cd_label: Label = skill_cooldown_labels.get(skill_key) as Label
		if cd_label == null:
			continue
		var remaining_ms: float = float(cooldowns.get(skill_key, 0.0))
		if remaining_ms > 0.0:
			cd_label.text = "%.1fs" % (remaining_ms / 1000.0)
		else:
			cd_label.text = ""

func _update_top_right(player_data: Dictionary) -> void:
	top_name_label.text = str(player_data.get("name", "player"))
	top_level_label.text = "0 Lv.%d" % int(player_data.get("level", 1))
	var hp: float = float(player_data.get("hp", 0.0))
	var max_hp: float = maxf(1.0, float(player_data.get("maxHp", 1.0)))
	top_hp_bar.value = clampf((hp / max_hp) * 100.0, 0.0, 100.0)

func _skill_display_name(skill: String) -> String:
	match skill:
		"q":
			return "Q - Dash + Esferas"
		"w":
			return "W - Repulsao"
		"e":
			return "E - Escudo de Vida"
		"r":
			return "R - Ultimate / Mutacao"
	return skill.to_upper()

func _coin_state_short(coin_state: String) -> String:
	var normalized: String = coin_state.to_lower()
	if normalized.find("absoluto") >= 0:
		return "ABS"
	if normalized.find("coroa") >= 0:
		return "COROA"
	if normalized.find("cara") >= 0:
		return "CARA"
	return "GIRO"

func _find_player(snapshot: Dictionary, local_player_id: String) -> Dictionary:
	var raw_players: Variant = snapshot.get("players", [])
	if typeof(raw_players) == TYPE_ARRAY:
		for raw_player: Variant in raw_players:
			if typeof(raw_player) == TYPE_DICTIONARY:
				var player_data: Dictionary = raw_player
				if str(player_data.get("id", "")) == local_player_id:
					return player_data
	return {}

func _status_line(entry: Dictionary) -> String:
	var status_id: String = str(entry.get("id", ""))
	var display: String = str(STATUS_NAMES.get(status_id, status_id))
	var stacks: int = int(entry.get("stacks", 1))
	var timer: float = float(entry.get("timer", 0.0))
	var prefix: String = "+" if _is_positive(status_id) else "-"
	var text_value: String = "%s %s" % [prefix, display]
	if stacks > 1:
		text_value += " x%d" % stacks
	if timer > 0.0:
		text_value += "  %s" % _format_timer(timer)
	return text_value

func _format_timer(timer_ms: float) -> String:
	var seconds: float = timer_ms / 1000.0
	if seconds >= 10.0:
		return "%ds" % int(ceil(seconds))
	return "%.1fs" % seconds

func _entries_signature(entries: Array) -> String:
	var parts: Array = []
	for raw_entry: Variant in entries:
		if typeof(raw_entry) == TYPE_DICTIONARY:
			var entry: Dictionary = raw_entry
			parts.append("%s:%s:%d" % [str(entry.get("id", "")), str(entry.get("stacks", 1)), int(float(entry.get("timer", 0.0)) / 100.0)])
	return "|".join(parts)

func _status_color(status_id: String) -> Color:
	if _is_positive(status_id):
		return Color(0.15, 1.0, 0.56, 1.0)
	return Color(1.0, 0.42, 0.42, 1.0)

func _is_positive(status_id: String) -> bool:
	return bool(POSITIVE_STATUS.get(status_id.to_lower(), false))

func _item_initials(item_id: String) -> String:
	var parts: PackedStringArray = item_id.split("_")
	var result: String = ""
	for part: String in parts:
		if part.length() > 0 and result.length() < 3:
			result += part.substr(0, 1).to_upper()
	return result

func _make_label(text_value: String, font_size: int, color: Color) -> Label:
	var label: Label = Label.new()
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.text = text_value
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label

func _style_box(bg: Color, border: Color, radius: int, border_width: int) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_corner_radius_all(radius)
	style.set_border_width_all(border_width)
	return style

func _clear_children(parent_node: Node) -> void:
	for child_node: Node in parent_node.get_children():
		child_node.queue_free()

func _set_mouse_passthrough(node: Node) -> void:
	if node is Control:
		var control_node: Control = node as Control
		control_node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for child_node: Node in node.get_children():
		_set_mouse_passthrough(child_node)

func _set_upgrade_modal_mouse_enabled() -> void:
	if upgrade_layer == null:
		return
	upgrade_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if upgrade_panel:
		_set_mouse_stop_recursive(upgrade_panel)

func _set_mouse_stop_recursive(node: Node) -> void:
	if node is Control:
		var control_node: Control = node as Control
		control_node.mouse_filter = Control.MOUSE_FILTER_STOP
	for child_node: Node in node.get_children():
		_set_mouse_stop_recursive(child_node)
