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

@export var server_url: String = "wss://play.sobrevivencia.online/ws"
@export var auto_reconnect: bool = true
@export var ping_interval: float = 2.0
@export var coalesce_game_state_packets: bool = true

var socket: WebSocketPeer = WebSocketPeer.new()
var connected_to_server: bool = false
var player_id: String = ""
var server_version: String = ""
var tick_rate: int = 20
var reconnect_attempts: int = 0
var max_reconnect_attempts: int = 5
var _last_ping_msec: int = 0
var _ping_timer: float = 0.0
var _pending_url: String = ""
var latest_game_state_text: String = ""

func connect_to_server(url: String = "") -> void:
	if url != "":
		_pending_url = url
	else:
		_pending_url = server_url
	var err: int = socket.connect_to_url(_pending_url)
	if err != OK:
		push_warning("WebSocket connect failed: %s" % err)

func _process(delta: float) -> void:
	socket.poll()
	var state: int = socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		if not connected_to_server:
			connected_to_server = true
			reconnect_attempts = 0
			connected.emit()
		_poll_packets()
		_ping_timer += delta
		if _ping_timer >= ping_interval:
			_ping_timer = 0.0
			_last_ping_msec = Time.get_ticks_msec()
			send_message({"type": "PING"})
	elif state == WebSocketPeer.STATE_CLOSED:
		if connected_to_server:
			var code: int = socket.get_close_code()
			var reason: String = socket.get_close_reason()
			connected_to_server = false
			disconnected.emit(code, reason)
			if auto_reconnect and reconnect_attempts < max_reconnect_attempts:
				reconnect_attempts += 1
				var delay: float = minf(10.0, pow(2.0, reconnect_attempts))
				await get_tree().create_timer(delay).timeout
				connect_to_server(_pending_url)

func _poll_packets() -> void:
	latest_game_state_text = ""
	while socket.get_available_packet_count() > 0:
		var text: String = socket.get_packet().get_string_from_utf8()
		if coalesce_game_state_packets and text.find("\"type\":\"GAME_STATE\"") >= 0:
			latest_game_state_text = text
			continue
		var msg: Variant = JSON.parse_string(text)
		if typeof(msg) != TYPE_DICTIONARY:
			continue
		var message: Dictionary = msg
		_handle_message(message)
	if latest_game_state_text != "":
		var state_msg: Variant = JSON.parse_string(latest_game_state_text)
		if typeof(state_msg) == TYPE_DICTIONARY:
			var state_message: Dictionary = state_msg
			_handle_message(state_message)

func _handle_message(msg: Dictionary) -> void:
	var payload: Dictionary = {}
	var raw_payload: Variant = msg.get("payload", {})
	if typeof(raw_payload) == TYPE_DICTIONARY:
		payload = raw_payload
	match str(msg.get("type", "")):
		"WELCOME":
			player_id = str(payload.get("playerId", ""))
			server_version = str(payload.get("serverVersion", ""))
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

func join_queue(player_name: String, build: Dictionary = {}, loadout: Array = [], platform: String = "godot") -> void:
	send_message({"type": "JOIN_QUEUE", "payload": {"name": player_name, "build": build, "loadout": loadout, "platform": platform}})

func join_queue_with_token(token: String, build: Dictionary = {}, loadout: Array = [], platform: String = "godot") -> void:
	send_message({"type": "JOIN_QUEUE", "payload": {"token": token, "build": build, "loadout": loadout, "platform": platform}})

func leave_queue() -> void:
	send_message({"type": "LEAVE_QUEUE"})

func select_platform(platform: String) -> void:
	send_message({"type": "SELECT_PLATFORM", "payload": {"platform": platform}})

func send_input(keys: Dictionary, mouse_x: float = 0.0, mouse_y: float = 0.0, joystick_x: float = 0.0, joystick_y: float = 0.0, world_x: float = 0.0, world_z: float = 0.0, is_aiming: bool = false) -> void:
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

func upgrade_chosen(skill: String, option: String) -> void:
	send_message({"type": "UPGRADE_SELECT", "payload": {"skill": skill, "option": option}})

func move_to(x: float, z: float) -> void:
	send_message({"type": "MOVE_TO", "payload": {"x": x, "z": z}})

func disconnect_from_server() -> void:
	auto_reconnect = false
	socket.close()
