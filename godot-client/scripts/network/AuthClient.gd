extends Node
class_name AuthClient

signal session_checked(is_logged_in: bool, username: String)
signal auth_success(username: String)
signal auth_failed(message: String)
signal logged_out

@export var api_base_url: String = "https://play.sobrevivencia.online"

const SESSION_PATH: String = "user://survival_session.cfg"

var token: String = ""
var username: String = ""
var _pending_operation: String = ""
var _http: HTTPRequest

func _ready() -> void:
	_http = HTTPRequest.new()
	add_child(_http)
	_http.request_completed.connect(_on_request_completed)
	_load_session()

func get_token() -> String:
	return token

func get_username() -> String:
	return username

func is_logged_in() -> bool:
	return token != "" and token.split(".").size() == 3

func verify_saved_session() -> void:
	if not is_logged_in():
		session_checked.emit(false, "")
		return
	_pending_operation = "verify"
	var headers: PackedStringArray = PackedStringArray(["Authorization: Bearer %s" % token])
	var err: int = _http.request(_url("/api/auth/me"), headers, HTTPClient.METHOD_GET)
	if err != OK:
		auth_failed.emit("Falha ao verificar sessao.")
		session_checked.emit(false, "")

func login(input_username: String, password: String) -> void:
	if input_username.strip_edges() == "" or password == "":
		auth_failed.emit("Informe usuario e senha.")
		return
	_pending_operation = "login"
	var body: String = JSON.stringify({"username": input_username.strip_edges(), "password": password})
	var headers: PackedStringArray = PackedStringArray(["Content-Type: application/json"])
	var err: int = _http.request(_url("/api/auth/login"), headers, HTTPClient.METHOD_POST, body)
	if err != OK:
		auth_failed.emit("Falha ao iniciar login.")

func register(input_username: String, password: String) -> void:
	if input_username.strip_edges().length() < 3:
		auth_failed.emit("Usuario precisa ter pelo menos 3 caracteres.")
		return
	if password.length() < 6:
		auth_failed.emit("Senha precisa ter pelo menos 6 caracteres.")
		return
	_pending_operation = "register"
	var body: String = JSON.stringify({"username": input_username.strip_edges(), "password": password})
	var headers: PackedStringArray = PackedStringArray(["Content-Type: application/json"])
	var err: int = _http.request(_url("/api/auth/register"), headers, HTTPClient.METHOD_POST, body)
	if err != OK:
		auth_failed.emit("Falha ao iniciar registro.")

func logout() -> void:
	token = ""
	username = ""
	var config: ConfigFile = ConfigFile.new()
	config.save(SESSION_PATH)
	logged_out.emit()

func _on_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	var text: String = body.get_string_from_utf8()
	var data: Dictionary = {}
	if text.strip_edges() != "":
		var json: JSON = JSON.new()
		var parse_error: int = json.parse(text)
		if parse_error == OK and typeof(json.data) == TYPE_DICTIONARY:
			data = json.data

	if response_code < 200 or response_code >= 300:
		var message: String = str(data.get("error", _default_error_message(response_code)))
		if _pending_operation == "verify":
			logout()
			session_checked.emit(false, "")
		else:
			auth_failed.emit(message)
		_pending_operation = ""
		return

	match _pending_operation:
		"login", "register":
			token = str(data.get("token", ""))
			username = str(data.get("username", ""))
			_save_session()
			auth_success.emit(username)
		"verify":
			username = str(data.get("username", username))
			_save_session()
			session_checked.emit(true, username)
	_pending_operation = ""

func _url(path: String) -> String:
	var base: String = api_base_url
	if base.ends_with("/"):
		base = base.substr(0, base.length() - 1)
	return base + path

func _default_error_message(response_code: int) -> String:
	match response_code:
		0:
			return "Nao foi possivel conectar na API."
		400:
			return "Dados invalidos."
		401:
			return "Usuario ou senha invalidos."
		404:
			return "Endpoint da API nao encontrado. Verifique a porta configurada."
		409:
			return "Usuario ja existe."
		500:
			return "Erro interno do servidor."
	return "Falha de autenticacao. Codigo %d." % response_code

func _load_session() -> void:
	var config: ConfigFile = ConfigFile.new()
	var err: int = config.load(SESSION_PATH)
	if err != OK:
		return
	token = str(config.get_value("auth", "token", ""))
	username = str(config.get_value("auth", "username", ""))

func _save_session() -> void:
	var config: ConfigFile = ConfigFile.new()
	config.set_value("auth", "token", token)
	config.set_value("auth", "username", username)
	config.save(SESSION_PATH)
