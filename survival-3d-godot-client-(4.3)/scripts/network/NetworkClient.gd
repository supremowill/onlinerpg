extends Node
class_name NetworkClient

signal connected
signal disconnected(code: int, reason: String)
signal welcome(payload: Dictionary)
signal queue_status(payload: Dictionary)
signal match_found(payload: Dictionary)
signal game_start(payload: Dictionary)
signal game_state(snapshot: Dictionary)
signal game_event(payload: Dictionary)
signal game_over(payload: Dictionary)
signal upgrade_prompt(payload: Dictionary)
signal player_died(payload: Dictionary)
signal server_error(payload: Dictionary)
signal latency_updated(latency_ms: int)

@export var server_url := "ws://127.0.0.1:3000"
@export var auto_reconnect := true
@export var ping_interval := 2.0

var socket := WebSocketPeer.new()
var is_connected := false
var player_id := ""
var server_version := ""
var tick_rate := 20
var reconnect_attempts := 0
var max_reconnect_attempts := 5
var _last_ping_msec := 0
var _ping_timer := 0.0
var _pending_url := ""

func connect_to_server(url := "") -> void:
	_pending_url = url if url != "" else server_url
	var err := socket.connect_to_url(_pending_url)
	if err != OK:
		push_warning("WebSocket connect failed: %s" % err)

func _process(delta: float) -> void:
	socket.poll()
	var state := socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		if not is_connected:
			is_connected = true
			reconnect_attempts = 0
			connected.emit()
		_poll_packets()
		_ping_timer += delta
		if _ping_timer >= ping_interval:
			_ping_timer = 0.0
			_last_ping_msec = Time.get_ticks_msec()
			send_message({"type": "PING"})
	elif state == WebSocketPeer.STATE_CLOSED:
		if is_connected:
			var code := socket.get_close_code()
			var reason := socket.get_close_reason()
			is_connected = false
			disconnected.emit(code, reason)
			if auto_reconnect and reconnect_attempts < max_reconnect_attempts:
				reconnect_attempts += 1
				await get_tree().create_timer(min(10.0, pow(2.0, reconnect_attempts))).timeout
				connect_to_server(_pending_url)

func _poll_packets() -> void:
	while socket.get_available_packet_count() > 0:
		var text := socket.get_packet().get_string_from_utf8()
		var msg = JSON.parse_string(text)
		if typeof(msg) != TYPE_DICTIONARY:
			continue
		_handle_message(msg)

func _handle_message(msg: Dictionary) -> void:
	var payload: Dictionary = msg.get("payload", {})
	match msg.get("type", ""):
		"WELCOME":
			player_id = payload.get("playerId", "")
			server_version = payload.get("serverVersion", "")
			tick_rate = int(payload.get("tickRate", tick_rate))
			welcome.emit(payload)
		"QUEUE_STATUS":
			queue_status.emit(payload)
		"MATCH_FOUND":
			match_found.emit(payload)
		"GAME_START":
			game_start.emit(payload)
		"GAME_STATE":
			game_state.emit(payload)
		"EVENT":
			game_event.emit(payload)
		"GAME_OVER":
			game_over.emit(payload)
		"UPGRADE_PROMPT":
			upgrade_prompt.emit(payload)
		"PLAYER_DIED":
			player_died.emit(payload)
		"PONG":
			latency_updated.emit(Time.get_ticks_msec() - _last_ping_msec)
		"ERROR":
			server_error.emit(payload)

func send_message(message: Dictionary) -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(message))

func join_queue(player_name: String, build := {}, loadout := [], platform := "godot") -> void:
	send_message({"type": "JOIN_QUEUE", "payload": {"name": player_name, "build": build, "loadout": loadout, "platform": platform}})

func join_queue_with_token(token: String, build := {}, loadout := [], platform := "godot") -> void:
	send_message({"type": "JOIN_QUEUE", "payload": {"token": token, "build": build, "loadout": loadout, "platform": platform}})

func leave_queue() -> void:
	send_message({"type": "LEAVE_QUEUE"})

func send_input(keys: Dictionary, mouse_x := 0.0, mouse_y := 0.0, joystick_x := 0.0, joystick_y := 0.0, world_x := 0.0, world_z := 0.0, is_aiming := false) -> void:
	send_message({
		"type": "INPUT_STATE",
		"payload": {
			"keys": keys,
			"mouseX": mouse_x,
			"mouseY": mouse_y,
			"joystickX": joystick_x,
			"joystickY": joystick_y,
			"worldX": world_x,
			"worldZ": world_z,
			"isAiming": is_aiming
		}
	})

func attack_start() -> void:
	send_message({"type": "ATTACK_START"})

func attack_stop() -> void:
	send_message({"type": "ATTACK_STOP"})

func use_skill(skill: String) -> void:
	send_message({"type": "USE_SKILL", "payload": {"skill": skill}})

func choose_upgrade(skill_key: String) -> void:
	send_message({"type": "CHOOSE_UPGRADE", "payload": {"skillKey": skill_key}})

func upgrade_chosen(skill: String, option: int) -> void:
	send_message({"type": "UPGRADE_SELECT", "payload": {"skill": skill, "option": option}})

func move_to(x: float, z: float) -> void:
	send_message({"type": "MOVE_TO", "payload": {"x": x, "z": z}})

func disconnect_from_server() -> void:
	auto_reconnect = false
	socket.close()

