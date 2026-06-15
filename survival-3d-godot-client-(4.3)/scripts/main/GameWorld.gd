extends Node3D

@onready var network: NetworkClient = $NetworkClient
@onready var entity_manager: EntityManager = $EntityManager

@export var auto_connect := false
@export var server_url := "ws://127.0.0.1:3000"
@export var debug_player_name := "GodotTester"

func _ready() -> void:
	_ensure_input_actions()
	network.server_url = server_url
	network.game_state.connect(entity_manager.apply_snapshot)
	network.connected.connect(_on_connected)
	network.disconnected.connect(_on_disconnected)
	network.server_error.connect(_on_server_error)
	if auto_connect:
		network.connect_to_server(server_url)

func _process(_delta: float) -> void:
	if network.is_connected:
		var keys := {
			"w": Input.is_action_pressed("move_forward"),
			"a": Input.is_action_pressed("move_left"),
			"s": Input.is_action_pressed("move_back"),
			"d": Input.is_action_pressed("move_right")
		}
		network.send_input(keys)

func _input(event: InputEvent) -> void:
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

func _on_connected() -> void:
	network.join_queue(debug_player_name, {}, [], "godot")

func _on_disconnected(code: int, reason: String) -> void:
	print("Disconnected: ", code, " ", reason)

func _on_server_error(payload: Dictionary) -> void:
	push_warning("Server error: %s" % payload)

func _ensure_input_actions() -> void:
	_add_key_action("move_forward", KEY_W)
	_add_key_action("move_left", KEY_A)
	_add_key_action("move_back", KEY_S)
	_add_key_action("move_right", KEY_D)
	_add_mouse_action("attack", MOUSE_BUTTON_LEFT)
	_add_key_action("skill_q", KEY_1)
	_add_key_action("skill_w", KEY_2)
	_add_key_action("skill_e", KEY_3)
	_add_key_action("skill_r", KEY_4)

func _add_key_action(action: StringName, keycode: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event := InputEventKey.new()
	event.physical_keycode = keycode
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)

func _add_mouse_action(action: StringName, button_index: MouseButton) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event := InputEventMouseButton.new()
	event.button_index = button_index
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)
