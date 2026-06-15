extends Node3D
class_name BaseVisualController

@export var interpolation_speed := 14.0
@export var default_scale := Vector3.ONE
@export var hp_bar_path: NodePath
@export var model_root_path: NodePath
@export var animation_player_path: NodePath
@export var animation_tree_path: NodePath
@export var status_anchor_path: NodePath

var entity_id := ""
var entity_type := ""
var hp := 0.0
var max_hp := 1.0
var is_dead := false
var current_animation := ""
var previous_hp := 0.0
var target_position := Vector3.ZERO
var last_position := Vector3.ZERO
var target_rot_y := 0.0
var status_effects: Array = []
var special_effect := ""
var model_root: Node3D
var hp_bar: Node3D
var animation_player: AnimationPlayer
var animation_tree: AnimationTree
var status_anchor: Node3D
var _spawned := false

func _ready() -> void:
	model_root = get_node_or_null(model_root_path) as Node3D
	hp_bar = get_node_or_null(hp_bar_path) as Node3D
	animation_player = get_node_or_null(animation_player_path) as AnimationPlayer
	animation_tree = get_node_or_null(animation_tree_path) as AnimationTree
	status_anchor = get_node_or_null(status_anchor_path) as Node3D
	target_position = global_position
	last_position = global_position
	play_animation("spawn")

func setup_from_snapshot(snapshot: Dictionary) -> void:
	entity_id = str(snapshot.get("id", ""))
	entity_type = str(snapshot.get("type", entity_type))

func apply_snapshot(snapshot: Dictionary) -> void:
	setup_from_snapshot(snapshot)
	previous_hp = hp
	hp = float(snapshot.get("hp", hp))
	max_hp = max(1.0, float(snapshot.get("maxHp", max_hp)))
	is_dead = bool(snapshot.get("isDead", false)) or hp <= 0.0
	status_effects = snapshot.get("statusEffects", [])
	special_effect = str(snapshot.get("specialEffect", special_effect))
	target_position = Vector3(float(snapshot.get("x", 0.0)), float(snapshot.get("y", 0.0)), float(snapshot.get("z", 0.0)))
	target_rot_y = float(snapshot.get("rotY", target_rot_y))
	if snapshot.has("scaleX") or snapshot.has("scaleY") or snapshot.has("scaleZ"):
		scale = Vector3(float(snapshot.get("scaleX", default_scale.x)), float(snapshot.get("scaleY", default_scale.y)), float(snapshot.get("scaleZ", default_scale.z)))
	_update_hp_visual()
	_update_material(snapshot)
	_update_status_visuals()
	_update_animation(snapshot)

func _process(delta: float) -> void:
	global_position = global_position.lerp(target_position, clamp(delta * interpolation_speed, 0.0, 1.0))
	rotation.y = lerp_angle(rotation.y, target_rot_y, clamp(delta * interpolation_speed, 0.0, 1.0))
	last_position = global_position

func _update_hp_visual() -> void:
	if hp_bar:
		var ratio := clamp(hp / max_hp, 0.0, 1.0)
		hp_bar.scale.x = max(0.02, ratio)

func _update_material(snapshot: Dictionary) -> void:
	if not model_root:
		return
	if snapshot.get("isInvulnerable", false):
		modulate_model(Color(1.0, 0.9, 0.35))
	elif snapshot.get("shieldActive", false) or snapshot.get("isShieldActive", false):
		modulate_model(Color(0.45, 0.85, 1.0))
	else:
		modulate_model(Color.WHITE)

func modulate_model(color: Color) -> void:
	if not model_root:
		return
	_modulate_node(model_root, color)

func _modulate_node(node: Node, color: Color) -> void:
	if node is MeshInstance3D:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		node.material_override = mat
	for child in node.get_children():
		_modulate_node(child, color)

func _update_status_visuals() -> void:
	if not status_anchor:
		return
	for child in status_anchor.get_children():
		child.queue_free()
	for status in status_effects:
		if typeof(status) != TYPE_DICTIONARY:
			continue
		var id := str(status.get("id", ""))
		if id == "":
			continue
		var marker := MeshInstance3D.new()
		var sphere := SphereMesh.new()
		sphere.radius = 0.08
		sphere.height = 0.16
		marker.mesh = sphere
		var mat := StandardMaterial3D.new()
		mat.albedo_color = _status_color(id)
		marker.material_override = mat
		marker.position = Vector3(status_anchor.get_child_count() * 0.18, 0, 0)
		status_anchor.add_child(marker)

func _status_color(id: String) -> Color:
	match id:
		"poison", "plague", "acid":
			return Color(0.2, 1.0, 0.2)
		"burning", "ignite":
			return Color(1.0, 0.28, 0.05)
		"bleeding", "bleed", "mortalWounds":
			return Color(0.8, 0.0, 0.0)
		"frozen", "freeze", "slowed", "slow":
			return Color(0.35, 0.8, 1.0)
		"stunned", "rooted":
			return Color(1.0, 0.9, 0.2)
		"blind", "silenced":
			return Color(0.45, 0.3, 0.85)
	return Color(1.0, 1.0, 1.0)

func _update_animation(snapshot: Dictionary) -> void:
	if is_dead:
		play_animation("death", "idle")
	elif hp < previous_hp:
		play_animation("hit", "idle")
	elif snapshot.get("isDashing", false) or global_position.distance_to(target_position) > 0.05:
		play_animation("run", "idle")
	else:
		play_animation("idle")

func play_animation(name: String, fallback := "") -> void:
	if current_animation == name:
		return
	var requested := name
	if animation_player and animation_player.has_animation(name):
		animation_player.play(name)
	elif fallback != "" and animation_player and animation_player.has_animation(fallback):
		requested = fallback
		animation_player.play(fallback)
	else:
		requested = fallback if fallback != "" else "idle"
	current_animation = requested

func despawn() -> void:
	queue_free()
