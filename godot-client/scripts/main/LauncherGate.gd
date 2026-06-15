extends RefCounted

const TEST_BYPASS_ENV: String = "SURVIVAL3D_ALLOW_DIRECT_RUN"
const LAUNCHER_FLAG_ENV: String = "SURVIVAL3D_LAUNCHER"
const LAUNCHER_GAME_VERSION_ENV: String = "SURVIVAL3D_GAME_VERSION"
const LAUNCH_TICKET_ENV: String = "SURVIVAL3D_LAUNCH_TICKET"
const LAUNCH_TICKET_ARG: String = "--launcher-ticket"

static func validate_startup(expected_game_version: String) -> Dictionary:
	if _allows_development_bypass():
		return _ok("debug/editor/test bypass")

	if OS.get_environment(LAUNCHER_FLAG_ENV) != "1":
		return _fail("Este jogo precisa ser iniciado pelo Launcher.")

	var ticket_path: String = _find_ticket_path()
	if ticket_path.is_empty():
		return _fail("Autorizacao temporaria do Launcher nao foi encontrada.")

	if not FileAccess.file_exists(ticket_path):
		return _fail("Autorizacao temporaria do Launcher expirou ou foi removida.")

	var ticket_text: String = _read_ticket(ticket_path)
	if ticket_text.is_empty():
		return _fail("Autorizacao temporaria do Launcher esta vazia.")

	var parser: JSON = JSON.new()
	var parse_error: Error = parser.parse(ticket_text)
	if parse_error != OK:
		return _fail("Autorizacao temporaria do Launcher esta invalida.")

	var parsed: Variant = parser.data
	if typeof(parsed) != TYPE_DICTIONARY:
		return _fail("Autorizacao temporaria do Launcher nao esta no formato esperado.")

	var ticket: Dictionary = parsed
	var ticket_version: String = _get_ticket_string(ticket, "Version", "version")
	var env_game_version: String = OS.get_environment(LAUNCHER_GAME_VERSION_ENV)
	if not expected_game_version.is_empty() and ticket_version != expected_game_version:
		return _fail("Versao autorizada pelo Launcher nao corresponde a versao do jogo.")

	if not env_game_version.is_empty() and ticket_version != env_game_version:
		return _fail("Versao do jogo informada pelo Launcher nao corresponde ao ticket.")

	var launcher_version: String = _get_ticket_string(ticket, "LauncherVersion", "launcherVersion")
	if launcher_version.is_empty():
		return _fail("Ticket do Launcher nao informa a versao do Launcher.")

	var nonce: String = _get_ticket_string(ticket, "Nonce", "nonce")
	if nonce.length() < 16:
		return _fail("Ticket do Launcher nao possui identificador valido.")

	var expires_at: String = _get_ticket_string(ticket, "ExpiresAtUtc", "expiresAtUtc")
	var expires_unix: float = _parse_utc_datetime(expires_at)
	if expires_unix <= 0.0:
		return _fail("Ticket do Launcher possui expiracao invalida.")

	var now_unix: float = Time.get_unix_time_from_system()
	if now_unix > expires_unix:
		return _fail("Autorizacao temporaria do Launcher expirou.")

	return _ok("launcher ticket valid")

static func show_blocked_screen(parent: Node, reason: String) -> void:
	var layer: CanvasLayer = CanvasLayer.new()
	layer.layer = 100
	parent.add_child(layer)

	var root: Control = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	layer.add_child(root)

	var background: ColorRect = ColorRect.new()
	background.color = Color(0.02, 0.02, 0.03, 1.0)
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(background)

	var panel: PanelContainer = PanelContainer.new()
	panel.custom_minimum_size = Vector2(620, 220)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.position = Vector2(-310, -110)
	root.add_child(panel)

	var content: VBoxContainer = VBoxContainer.new()
	content.add_theme_constant_override("separation", 14)
	content.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 24
	content.offset_top = 22
	content.offset_right = -24
	content.offset_bottom = -22
	panel.add_child(content)

	var title: Label = Label.new()
	title.text = "Abra pelo Launcher"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 26)
	content.add_child(title)

	var message: Label = Label.new()
	message.text = "Este jogo precisa ser iniciado pelo Launcher.\nAbra o Launcher para verificar atualizacoes e iniciar corretamente."
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message.add_theme_font_size_override("font_size", 17)
	content.add_child(message)

	var detail: Label = Label.new()
	detail.text = reason
	detail.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail.add_theme_color_override("font_color", Color(1.0, 0.72, 0.35, 1.0))
	content.add_child(detail)

static func _allows_development_bypass() -> bool:
	if OS.is_debug_build():
		return true
	return OS.get_environment(TEST_BYPASS_ENV) == "1"

static func _find_ticket_path() -> String:
	var args: PackedStringArray = OS.get_cmdline_args()
	for index: int in range(args.size()):
		if args[index] == LAUNCH_TICKET_ARG and index + 1 < args.size():
			return args[index + 1]

	var env_path: String = OS.get_environment(LAUNCH_TICKET_ENV)
	if not env_path.is_empty():
		return env_path

	return ""

static func _read_ticket(ticket_path: String) -> String:
	var file: FileAccess = FileAccess.open(ticket_path, FileAccess.READ)
	if file == null:
		return ""
	var text: String = file.get_as_text()
	file.close()
	return text

static func _get_ticket_string(ticket: Dictionary, pascal_key: String, camel_key: String) -> String:
	var value: Variant = ticket.get(pascal_key, ticket.get(camel_key, ""))
	if typeof(value) == TYPE_STRING:
		return value.strip_edges()
	return str(value).strip_edges()

static func _parse_utc_datetime(raw_value: String) -> float:
	var text: String = raw_value.strip_edges()
	if text.is_empty():
		return 0.0

	var plus_index: int = text.find("+")
	if plus_index >= 0:
		text = text.substr(0, plus_index)

	var z_index: int = text.find("Z")
	if z_index >= 0:
		text = text.substr(0, z_index)

	var dot_index: int = text.find(".")
	if dot_index >= 0:
		text = text.substr(0, dot_index)

	text = text.replace("T", " ")
	return float(Time.get_unix_time_from_datetime_string(text))

static func _ok(detail: String) -> Dictionary:
	return {
		"ok": true,
		"reason": detail
	}

static func _fail(reason: String) -> Dictionary:
	return {
		"ok": false,
		"reason": reason
	}
