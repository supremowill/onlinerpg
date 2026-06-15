extends Node3D
class_name WorldVisuals

@export var entity_manager_path: NodePath
@export var camera_path: NodePath
@export var camera_offset: Vector3 = Vector3(0.0, 20.0, 12.0)
@export var camera_lerp_speed: float = 3.0

var local_player_id: String = ""
var entity_manager: EntityManager
var camera: Camera3D
var obstacles_root: Node3D

func _ready() -> void:
	entity_manager = get_node(entity_manager_path) as EntityManager
	camera = get_node(camera_path) as Camera3D
	obstacles_root = Node3D.new()
	obstacles_root.name = "Obstacles"
	add_child(obstacles_root)
	if camera:
		camera.fov = 75.0
		camera.near = 0.1
		camera.far = 1000.0

func setup_match(player_id: String, obstacles: Array) -> void:
	local_player_id = player_id
	_clear_obstacles()
	_create_obstacles(obstacles)

func _process(delta: float) -> void:
	if local_player_id == "" or not entity_manager or not camera:
		return
	var target: Node3D = entity_manager.get_entity_node(local_player_id)
	if target == null:
		target = entity_manager.get_first_player_node()
	if target == null:
		return
	var desired_position: Vector3 = target.global_position + camera_offset
	var factor: float = clampf(delta * camera_lerp_speed, 0.0, 1.0)
	camera.global_position = camera.global_position.lerp(desired_position, factor)
	camera.look_at(target.global_position, Vector3.UP)

func _create_obstacles(obstacles: Array) -> void:
	for obstacle: Variant in obstacles:
		if typeof(obstacle) != TYPE_DICTIONARY:
			continue
		var data: Dictionary = obstacle
		var mesh_instance: MeshInstance3D = MeshInstance3D.new()
		mesh_instance.name = "Obstacle"
		var box: BoxMesh = BoxMesh.new()
		var width: float = float(data.get("width", 1.0))
		var depth: float = float(data.get("depth", 1.0))
		box.size = Vector3(width, 4.0, depth)
		mesh_instance.mesh = box
		mesh_instance.position = Vector3(float(data.get("x", 0.0)), 2.0, float(data.get("z", 0.0)))
		var material: StandardMaterial3D = StandardMaterial3D.new()
		material.albedo_color = Color(0.27, 0.27, 0.27, 1.0)
		material.roughness = 0.9
		mesh_instance.material_override = material
		obstacles_root.add_child(mesh_instance)

func _clear_obstacles() -> void:
	for child: Node in obstacles_root.get_children():
		child.queue_free()
