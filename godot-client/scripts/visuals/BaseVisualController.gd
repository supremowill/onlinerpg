extends Node3D
class_name BaseVisualController

@export var interpolation_speed: float = 14.0
@export var default_scale: Vector3 = Vector3.ONE
@export var hp_bar_path: NodePath
@export var model_root_path: NodePath
@export var animation_player_path: NodePath
@export var animation_tree_path: NodePath
@export var status_anchor_path: NodePath
@export var show_hitbox_visuals: bool = false

var entity_id: String = ""
var entity_type: String = ""
var hp: float = 0.0
var max_hp: float = 1.0
var is_dead: bool = false
var current_animation: String = ""
var previous_hp: float = 0.0
var target_position: Vector3 = Vector3.ZERO
var last_position: Vector3 = Vector3.ZERO
var snapshot_movement_delta: Vector3 = Vector3.ZERO
var target_rot_y: float = 0.0
var hitbox_radius: float = 0.0
var status_effects: Array = []
var special_effect: String = ""
var model_root: Node3D
var hp_bar: Node3D
var hp_fill: Node3D
var hitbox_disk: MeshInstance3D
var hitbox_material: StandardMaterial3D
var material_visual_state: String = ""
var status_visual_signature: String = "__init"
var animation_player: AnimationPlayer
var animation_tree: AnimationTree
var status_anchor: Node3D
var animation_aliases: Dictionary = {
	"idle": ["standing_idle_01", "standing idle 01", "idle", "idle_a", "idle_b", "idle_neutral", "idle_sword", "idle_gun", "spider_idle"],
	"run": ["standing_aim_walk_forward", "standing aim walk forward", "run", "running", "running_a", "running_b", "walk", "walking", "walking_a", "walking_b", "walking_c", "spider_walk"],
	"run_forward": ["standing_aim_walk_forward", "standing aim walk forward", "run", "running", "running_a", "running_b", "walk", "walking", "walking_a", "walking_b", "walking_c", "spider_walk"],
	"run_back": ["standing_aim_walk_back", "standing aim walk back", "run_back", "walk_back", "back", "walking_b", "walking_c", "spider_walk"],
	"run_left": ["standing_aim_walk_left", "standing aim walk left", "run_left", "walk_left", "walking_a", "walking_b", "spider_walk"],
	"run_right": ["standing_aim_walk_right", "standing aim walk right", "run_right", "walk_right", "walking_a", "walking_b", "spider_walk"],
	"attack": ["standing_draw_arrow", "standing draw arrow", "standing_aim_recoil", "standing aim recoil", "attack", "throw", "use_item", "use item", "interact", "staff_attack", "staff attack", "spell1", "spell2", "punch", "site", "scene", "plunge attack", "rear attack", "plunge_attack", "rear_attack", "sword_slash", "punch_left", "punch_right", "gun_shoot", "spider_attack"],
	"skill_q": ["standing_aim_overdraw", "standing aim overdraw", "standing_draw_arrow", "standing draw arrow", "roll", "jump", "jump_full_short", "run", "running_a", "walk", "walking_a", "spider_jump", "spider_walk"],
	"skill_w": ["spell1", "throw", "use_item", "interact", "site", "rear attack", "rear_attack", "punch_left", "sword_slash", "spider_attack"],
	"skill_e": ["spell2", "throw", "use_item", "site", "plunge attack", "plunge_attack", "punch_right", "kick_left", "kick_right", "sword_slash", "spider_attack"],
	"skill_r": ["spell2", "spell1", "throw", "use_item", "staff_attack", "staff attack", "site", "plunge attack", "rear attack", "plunge_attack", "rear_attack", "sword_slash", "interact", "wave", "spider_attack"],
	"hit": ["hit", "hit_a", "hit_b", "recievehit", "receivehit", "recievehit_2", "receivehit_2", "hitrecieve", "hitreceive", "hitrecieve_2", "spider_attack"],
	"death": ["death", "death_a", "death_b", "spider_death"],
	"spawn": ["spawn", "spawn_ground", "spawn_air", "idle", "idle_a", "spider_idle", "wave"]
}

func _ready() -> void:
	model_root = get_node_or_null(model_root_path) as Node3D
	hp_bar = get_node_or_null(hp_bar_path) as Node3D
	if hp_bar:
		hp_fill = hp_bar.get_node_or_null("Fill") as Node3D
	animation_player = get_node_or_null(animation_player_path) as AnimationPlayer
	animation_tree = get_node_or_null(animation_tree_path) as AnimationTree
	status_anchor = get_node_or_null(status_anchor_path) as Node3D
	if (animation_player == null or not _has_animation_player_content(animation_player)) and model_root:
		animation_player = _find_animation_player_with_animations(model_root)
	_configure_animation_loops()
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
	max_hp = maxf(1.0, float(snapshot.get("maxHp", max_hp)))
	is_dead = bool(snapshot.get("isDead", false)) or hp <= 0.0
	var raw_status_effects: Variant = snapshot.get("statusEffects", [])
	if typeof(raw_status_effects) == TYPE_ARRAY:
		status_effects = raw_status_effects
	else:
		status_effects = []
	special_effect = str(snapshot.get("specialEffect", special_effect))
	var next_target_position: Vector3 = Vector3(float(snapshot.get("x", 0.0)), float(snapshot.get("y", 0.0)), float(snapshot.get("z", 0.0)))
	snapshot_movement_delta = next_target_position - target_position
	snapshot_movement_delta.y = 0.0
	target_position = next_target_position
	target_rot_y = float(snapshot.get("rotY", target_rot_y))
	if snapshot.has("scaleX") or snapshot.has("scaleY") or snapshot.has("scaleZ"):
		scale = Vector3(float(snapshot.get("scaleX", default_scale.x)), float(snapshot.get("scaleY", default_scale.y)), float(snapshot.get("scaleZ", default_scale.z)))
	_update_hp_visual()
	_update_hitbox_visual(snapshot)
	_update_material(snapshot)
	_update_status_visuals()
	_update_animation(snapshot)

func _process(delta: float) -> void:
	var interpolation_factor: float = clampf(delta * interpolation_speed, 0.0, 1.0)
	global_position = global_position.lerp(target_position, interpolation_factor)
	rotation.y = target_rot_y
	_sync_hitbox_position()
	last_position = global_position

func _update_hp_visual() -> void:
	if hp_fill:
		var ratio: float = clampf(hp / max_hp, 0.0, 1.0)
		hp_fill.scale.x = maxf(0.001, ratio)
		hp_fill.position.x = -(1.0 - ratio) * 0.5

func _update_hitbox_visual(snapshot: Dictionary) -> void:
	if not show_hitbox_visuals or not snapshot.has("hitboxRadius"):
		if hitbox_disk:
			hitbox_disk.visible = false
		return
	hitbox_radius = maxf(0.05, float(snapshot.get("hitboxRadius", 0.0)))
	if hitbox_disk == null:
		hitbox_disk = MeshInstance3D.new()
		hitbox_disk.top_level = true
		var mesh: CylinderMesh = CylinderMesh.new()
		mesh.top_radius = 1.0
		mesh.bottom_radius = 1.0
		mesh.height = 0.025
		mesh.radial_segments = 48
		hitbox_disk.mesh = mesh
		hitbox_material = StandardMaterial3D.new()
		hitbox_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		hitbox_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		hitbox_material.no_depth_test = true
		hitbox_material.albedo_color = Color(1.0, 0.94, 0.25, 0.2)
		hitbox_material.emission_enabled = true
		hitbox_material.emission = Color(1.0, 0.88, 0.2, 1.0)
		hitbox_material.emission_energy_multiplier = 0.45
		hitbox_disk.set_surface_override_material(0, hitbox_material)
		add_child(hitbox_disk)
	hitbox_disk.visible = true
	hitbox_disk.scale = Vector3(hitbox_radius, 1.0, hitbox_radius)
	_sync_hitbox_position()

func _sync_hitbox_position() -> void:
	if hitbox_disk:
		hitbox_disk.global_position = Vector3(global_position.x, 0.045, global_position.z)

func _update_material(snapshot: Dictionary) -> void:
	if not model_root:
		return
	var next_state: String = "normal"
	if bool(snapshot.get("isInvulnerable", false)):
		next_state = "invulnerable"
	elif bool(snapshot.get("shieldActive", false)) or bool(snapshot.get("isShieldActive", false)):
		next_state = "shield"
	if next_state == material_visual_state:
		return
	material_visual_state = next_state
	if next_state == "invulnerable":
		modulate_model(Color(1.0, 0.9, 0.35))
	elif next_state == "shield":
		modulate_model(Color(0.45, 0.85, 1.0))
	else:
		clear_model_modulation()

func modulate_model(color: Color) -> void:
	if not model_root:
		return
	_modulate_node(model_root, color)

func clear_model_modulation() -> void:
	if not model_root:
		return
	_clear_modulation_node(model_root)

func _modulate_node(node: Node, color: Color) -> void:
	if node is MeshInstance3D:
		var mesh_node: MeshInstance3D = node as MeshInstance3D
		var mat: StandardMaterial3D = StandardMaterial3D.new()
		mat.albedo_color = color
		mesh_node.material_override = mat
	for child: Node in node.get_children():
		_modulate_node(child, color)

func _clear_modulation_node(node: Node) -> void:
	if node is MeshInstance3D:
		var mesh_node: MeshInstance3D = node as MeshInstance3D
		mesh_node.material_override = null
	for child: Node in node.get_children():
		_clear_modulation_node(child)

func _update_status_visuals() -> void:
	if not status_anchor:
		return
	var next_signature: String = _status_signature()
	if next_signature == status_visual_signature:
		return
	status_visual_signature = next_signature
	for child: Node in status_anchor.get_children():
		child.queue_free()
	for status: Variant in status_effects:
		if typeof(status) != TYPE_DICTIONARY:
			continue
		var status_data: Dictionary = status
		var id: String = str(status_data.get("id", ""))
		if id == "":
			continue
		var marker: MeshInstance3D = MeshInstance3D.new()
		var sphere: SphereMesh = SphereMesh.new()
		sphere.radius = 0.08
		sphere.height = 0.16
		marker.mesh = sphere
		var mat: StandardMaterial3D = StandardMaterial3D.new()
		mat.albedo_color = _status_color(id)
		marker.material_override = mat
		marker.position = Vector3(status_anchor.get_child_count() * 0.18, 0, 0)
		status_anchor.add_child(marker)

func _status_signature() -> String:
	var parts: Array = []
	for status: Variant in status_effects:
		if typeof(status) != TYPE_DICTIONARY:
			continue
		var status_data: Dictionary = status
		parts.append("%s:%s" % [str(status_data.get("id", "")), str(status_data.get("stacks", 0))])
	return "|".join(parts)

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
	elif bool(snapshot.get("isDashing", false)) or global_position.distance_to(target_position) > 0.05:
		play_animation("run", "idle")
	else:
		play_animation("idle")

func play_animation(animation_name: String, fallback: String = "") -> void:
	var requested: String = _resolve_animation(animation_name)
	if requested == "" and fallback != "":
		requested = _resolve_animation(fallback)
	if requested != "" and current_animation == requested:
		return
	if requested != "" and animation_player:
		animation_player.play(requested)
	else:
		requested = fallback if fallback != "" else "idle"
		if current_animation == requested:
			return
	current_animation = requested

func despawn() -> void:
	queue_free()

func _resolve_animation(animation_name: String) -> String:
	if animation_player == null:
		return ""
	if animation_player.has_animation(animation_name):
		return animation_name
	var candidates: Array = animation_aliases.get(animation_name, [animation_name])
	var animation_list: PackedStringArray = animation_player.get_animation_list()
	for candidate: Variant in candidates:
		var candidate_text: String = str(candidate).to_lower()
		for animation_key: StringName in animation_list:
			var available: String = str(animation_key)
			var lowered: String = available.to_lower()
			if lowered == candidate_text or lowered.ends_with("|" + candidate_text) or lowered.find(candidate_text) >= 0:
				return available
	return ""

func _find_animation_player_with_animations(node: Node) -> AnimationPlayer:
	var fallback_player: AnimationPlayer = null
	if node is AnimationPlayer:
		var player: AnimationPlayer = node as AnimationPlayer
		if _has_animation_player_content(player):
			return player
		fallback_player = player
	for child: Node in node.get_children():
		var found: AnimationPlayer = _find_animation_player_with_animations(child)
		if found != null and _has_animation_player_content(found):
			return found
		if fallback_player == null and found != null:
			fallback_player = found
	return fallback_player

func _has_animation_player_content(player: AnimationPlayer) -> bool:
	if player == null:
		return false
	return not player.get_animation_list().is_empty()

func _configure_animation_loops() -> void:
	if animation_player == null:
		return
	for animation_key: StringName in animation_player.get_animation_list():
		var animation_data: Animation = animation_player.get_animation(animation_key)
		if animation_data == null:
			continue
		var lowered: String = str(animation_key).to_lower()
		if lowered.find("idle") >= 0 or lowered.find("run") >= 0 or lowered.find("walk") >= 0:
			animation_data.loop_mode = Animation.LOOP_LINEAR
