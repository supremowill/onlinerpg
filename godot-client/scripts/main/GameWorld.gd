extends Node3D

const LauncherGateScript = preload("res://scripts/main/LauncherGate.gd")

@onready var network: NetworkClient = $NetworkClient
@onready var auth: Node = $AuthClient
@onready var entity_manager: EntityManager = $EntityManager
@onready var world_visuals: Node = $WorldVisuals
@onready var matchmaking_ui: Node = $MatchmakingUI
@onready var game_hud: Node = $GameHUD
@onready var damage_number_manager: Node = $DamageNumberManager

@export var auto_connect: bool = false
@export var server_url: String = "wss://play.sobrevivencia.online/ws"
@export var api_base_url: String = "https://play.sobrevivencia.online"
@export var debug_player_name: String = "GodotTester"
@export var show_offline_preview: bool = true

var _input_send_timer: float = 0.0
var _input_send_interval: float = 0.05
var _mouse_x: float = 0.0
var _mouse_y: float = 0.0
var _world_x: float = 0.0
var _world_z: float = 0.0
var _in_match: bool = false
var _startup_blocked: bool = false

func _ready() -> void:
	var launcher_result: Dictionary = LauncherGateScript.validate_startup(_get_game_version())
	if not bool(launcher_result.get("ok", false)):
		_startup_blocked = true
		LauncherGateScript.show_blocked_screen(self, str(launcher_result.get("reason", "")))
		return

	_ensure_input_actions()
	network.server_url = server_url
	auth.api_base_url = api_base_url
	matchmaking_ui.configure(auth, network)
	game_hud.configure(network)
	matchmaking_ui.game_started.connect(_on_game_started)
	network.game_state.connect(_on_game_state)
	network.game_event.connect(_on_game_event)
	network.game_over.connect(_on_game_over)
	network.upgrade_prompt.connect(game_hud.show_upgrade_prompt)
	network.latency_updated.connect(game_hud.update_latency)
	network.connected.connect(_on_connected)
	network.disconnected.connect(_on_disconnected)
	network.server_error.connect(_on_server_error)
	if auto_connect:
		network.connect_to_server(server_url)
	elif show_offline_preview:
		call_deferred("_spawn_offline_preview")
	damage_number_manager.configure($Camera3D, entity_manager)

func _process(delta: float) -> void:
	if _startup_blocked:
		return
	if network.connected_to_server:
		_input_send_timer += delta
		if _input_send_timer >= _input_send_interval:
			_input_send_timer = 0.0
			_update_mouse_aim()
			var keys: Dictionary = {
				"w": Input.is_action_pressed("move_forward"),
				"a": Input.is_action_pressed("move_left"),
				"s": Input.is_action_pressed("move_back"),
				"d": Input.is_action_pressed("move_right")
			}
			network.send_input(keys, _mouse_x, _mouse_y, 0.0, 0.0, _world_x, _world_z, false)
			_update_local_player_aim()

func _input(event: InputEvent) -> void:
	if _startup_blocked:
		return
	if event.is_action_pressed("attack"):
		network.attack_start()
	if event.is_action_released("attack"):
		network.attack_stop()
	if event.is_action_pressed("skill_q"):
		network.use_skill("q")
	if event.is_action_pressed("skill_w"):
		network.use_skill("w")
	if event.is_action_pressed("skill_e"):
		network.use_skill("e")
	if event.is_action_pressed("skill_r"):
		network.use_skill("r")
	if event.is_action_pressed("skill_jump"):
		network.use_skill("jump")

func _on_connected() -> void:
	print("Connected to game server.")

func _on_disconnected(code: int, reason: String) -> void:
	print("Disconnected: ", code, " ", reason)

func _on_server_error(payload: Dictionary) -> void:
	push_warning("Server error: %s" % payload)

func _on_game_started(payload: Dictionary) -> void:
	var raw_obstacles: Variant = payload.get("obstacles", [])
	var obstacles: Array = raw_obstacles if typeof(raw_obstacles) == TYPE_ARRAY else []
	world_visuals.setup_match(str(payload.get("yourPlayerId", "")), obstacles)
	_in_match = true
	game_hud.show_hud()

func _on_game_state(snapshot: Dictionary) -> void:
	entity_manager.apply_snapshot(snapshot)
	if _in_match:
		game_hud.update_snapshot(snapshot, network.player_id)

func _on_game_event(payload: Dictionary) -> void:
	if str(payload.get("event", "")) == "HIT_NUMBER":
		damage_number_manager.show_hit_event(payload)

func _on_game_over(_payload: Dictionary) -> void:
	_in_match = false
	game_hud.hide_hud()

func _update_mouse_aim() -> void:
	var viewport_size: Vector2 = get_viewport().get_visible_rect().size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return
	var mouse_pos: Vector2 = get_viewport().get_mouse_position()
	_mouse_x = (mouse_pos.x / viewport_size.x) * 2.0 - 1.0
	_mouse_y = -((mouse_pos.y / viewport_size.y) * 2.0 - 1.0)
	var camera: Camera3D = $Camera3D
	var origin: Vector3 = camera.project_ray_origin(mouse_pos)
	var direction: Vector3 = camera.project_ray_normal(mouse_pos)
	if absf(direction.y) < 0.0001:
		return
	var distance: float = -origin.y / direction.y
	if distance < 0.0:
		return
	var target: Vector3 = origin + direction * distance
	_world_x = target.x
	_world_z = target.z

func _update_local_player_aim() -> void:
	if network.player_id == "":
		return
	var player_node: Node3D = entity_manager.get_entity_node(network.player_id)
	if player_node == null:
		return
	var aim_delta: Vector3 = Vector3(_world_x - player_node.global_position.x, 0.0, _world_z - player_node.global_position.z)
	if aim_delta.length_squared() <= 0.001:
		return
	var aim_rot_y: float = atan2(aim_delta.x, aim_delta.z)
	player_node.rotation.y = aim_rot_y
	if player_node is BaseVisualController:
		(player_node as BaseVisualController).target_rot_y = aim_rot_y

func _spawn_offline_preview() -> void:
	world_visuals.setup_match("preview-player", [
		{"x": 6.0, "z": 6.0, "width": 2.0, "depth": 6.0},
		{"x": -7.0, "z": 4.0, "width": 5.0, "depth": 1.5},
		{"x": 3.0, "z": -8.0, "width": 3.0, "depth": 3.0}
	])
	var preview_snapshot: Dictionary = {
		"tick": 0,
		"players": [
			{"id": "preview-player", "name": "preview", "type": "player", "x": 0.0, "y": 0.0, "z": 0.0, "rotY": 0.0, "hp": 120.0, "maxHp": 120.0, "shieldHp": 35.0, "shieldMaxHp": 50.0, "isShieldActive": true, "level": 1, "score": 0, "build": {"buildingColor": "poison", "floor1": 2, "floor2": 0, "floor3": 0, "floor4": 2}, "loadoutItems": ["frasco_veneno", "bota_velocidade", "cristal_vitalidade"], "loadoutLevel": 1, "skillCooldowns": {"q": 0, "w": 1200, "e": 0, "r": 5200}, "activeBuff": "regen", "tempBuff": "", "timedBuffs": ["haste"], "buffTimers": {"regen": 6200, "haste": 2800, "poison": 4400}, "statusEffects": [{"id": "poison", "stacks": 3}]}
		],
		"enemies": [
			{"id": "preview-enemy", "type": "PurpleCube", "x": 2.4, "y": 0.0, "z": 0.0, "rotY": 0.0, "hp": 80.0, "maxHp": 100.0},
			{"id": "preview-boss", "type": "MestraDaIlusao", "x": -2.4, "y": 0.0, "z": 0.0, "rotY": 0.0, "hp": 450.0, "maxHp": 600.0, "isChanneling": true}
		],
		"projectiles": [
			{"id": "preview-projectile", "type": "projectile", "x": 0.0, "y": 0.6, "z": -2.0, "rotY": 0.0, "hp": 1.0, "maxHp": 1.0, "color": 16766720}
		],
		"orbs": [
			{"id": "preview-orb", "type": "xp", "x": 1.2, "y": 0.35, "z": -1.4}
		],
		"dynamicEntities": []
	}
	entity_manager.apply_snapshot(preview_snapshot)
	damage_number_manager.show_damage(Vector3(2.4, 2.0, 0.0), 128, "NORMAL")
	damage_number_manager.show_damage(Vector3(-2.4, 3.2, 0.0), 512, "CRIT")
	damage_number_manager.show_damage(Vector3(0.0, 2.0, 0.0), 36, "HEAL")
	game_hud.hide_hud()

func _ensure_input_actions() -> void:
	_add_key_action("move_forward", KEY_W)
	_add_key_action("move_left", KEY_A)
	_add_key_action("move_back", KEY_S)
	_add_key_action("move_right", KEY_D)
	_add_mouse_action("attack", MOUSE_BUTTON_LEFT)
	_add_key_action("skill_q", KEY_1)
	_add_key_action("skill_q", KEY_Q)
	_add_key_action("skill_w", KEY_2)
	_add_key_action("skill_w", KEY_E)
	_add_key_action("skill_e", KEY_3)
	_add_key_action("skill_e", KEY_R)
	_add_key_action("skill_r", KEY_4)
	_add_key_action("skill_r", KEY_F)
	_add_key_action("skill_jump", KEY_SPACE)

func _add_key_action(action: StringName, keycode: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event: InputEventKey = InputEventKey.new()
	event.physical_keycode = keycode
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)

func _add_mouse_action(action: StringName, button_index: MouseButton) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event: InputEventMouseButton = InputEventMouseButton.new()
	event.button_index = button_index
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)

func _get_game_version() -> String:
	return str(ProjectSettings.get_setting("application/config/version", "")).strip_edges()
