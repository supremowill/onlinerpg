extends Node3D
class_name DynamicZoneVisualController

var zone_id: String = ""
var zone_type: String = ""
var zone_radius: float = 1.0
var disk: MeshInstance3D
var material: StandardMaterial3D

func _ready() -> void:
	_ensure_visual()

func setup_from_snapshot(snapshot: Dictionary) -> void:
	apply_snapshot(snapshot)

func apply_snapshot(snapshot: Dictionary) -> void:
	_ensure_visual()
	zone_id = str(snapshot.get("id", zone_id))
	zone_type = str(snapshot.get("type", zone_type))
	zone_radius = maxf(0.05, float(snapshot.get("radius", zone_radius)))
	position = Vector3(float(snapshot.get("x", position.x)), float(snapshot.get("y", 0.0)) + 0.035, float(snapshot.get("z", position.z)))
	rotation.y = float(snapshot.get("rotY", rotation.y))
	scale = Vector3(zone_radius, 1.0, zone_radius)

	var opacity: float = clampf(float(snapshot.get("opacity", 0.55)), 0.12, 0.72)
	var zone_color: Color = _resolve_zone_color(zone_type)
	zone_color.a = opacity
	material.albedo_color = zone_color
	material.emission = Color(zone_color.r, zone_color.g, zone_color.b, 1.0)

func despawn() -> void:
	queue_free()

func _ensure_visual() -> void:
	if disk != null:
		return
	disk = MeshInstance3D.new()
	var mesh: CylinderMesh = CylinderMesh.new()
	mesh.top_radius = 1.0
	mesh.bottom_radius = 1.0
	mesh.height = 0.03
	mesh.radial_segments = 64
	disk.mesh = mesh
	material = StandardMaterial3D.new()
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.no_depth_test = true
	material.albedo_color = Color(0.4, 0.8, 1.0, 0.35)
	material.emission_enabled = true
	material.emission = Color(0.4, 0.8, 1.0, 1.0)
	material.emission_energy_multiplier = 0.9
	disk.set_surface_override_material(0, material)
	add_child(disk)

func _resolve_zone_color(zone_key: String) -> Color:
	var lowered: String = zone_key.to_lower()
	if lowered.find("limbo_enemy_aura") >= 0:
		return Color(0.35, 0.95, 1.0, 0.28)
	if lowered.find("limbo_prison") >= 0 or lowered.find("cocito") >= 0 or lowered.find("juramento") >= 0 or lowered.find("gelo") >= 0:
		return Color(0.28, 0.76, 1.0, 0.46)
	if lowered.find("coin") >= 0 or lowered.find("moeda") >= 0 or lowered.find("ouro") >= 0 or lowered.find("cofre") >= 0:
		return Color(1.0, 0.78, 0.12, 0.44)
	if lowered.find("erg_worker_dead") >= 0:
		return Color(0.30, 0.11, 0.58, 0.24)
	if lowered.find("erg_worker_critical") >= 0:
		return Color(0.95, 0.20, 0.22, 0.50)
	if lowered.find("erg_worker_damaged") >= 0:
		return Color(0.96, 0.62, 0.10, 0.48)
	if lowered.find("erg") >= 0 or lowered.find("hive") >= 0 or lowered.find("colmeia") >= 0:
		return Color(0.66, 0.33, 1.0, 0.44)
	if lowered.find("predator") >= 0 or lowered.find("bastiao") >= 0 or lowered.find("bastion") >= 0:
		return Color(0.22, 0.74, 0.97, 0.44)
	if lowered.find("stage") >= 0 or lowered.find("palco") >= 0 or lowered.find("mentira") >= 0 or lowered.find("swap") >= 0:
		return Color(0.9, 0.18, 1.0, 0.42)
	if lowered.find("vomito") >= 0 or lowered.find("putrefato") >= 0 or lowered.find("digestao") >= 0 or lowered.find("gas") >= 0:
		return Color(0.2, 1.0, 0.24, 0.42)
	if lowered.find("cinzas") >= 0 or lowered.find("heretico") >= 0 or lowered.find("ressurreicao") >= 0:
		return Color(1.0, 0.25, 0.05, 0.46)
	if lowered.find("limbo_warning") >= 0 or lowered.find("correntes") >= 0 or lowered.find("prisao") >= 0:
		return Color(1.0, 0.08, 0.08, 0.46)
	if lowered.find("ice") >= 0 or lowered.find("gelo") >= 0 or lowered.find("blizzard") >= 0 or lowered.find("nevasca") >= 0:
		return Color(0.32, 0.82, 1.0, 0.42)
	if lowered.find("poison") >= 0 or lowered.find("toxic") >= 0 or lowered.find("tox") >= 0 or lowered.find("praga") >= 0:
		return Color(0.2, 1.0, 0.24, 0.38)
	if lowered.find("fire") >= 0 or lowered.find("inferno") >= 0 or lowered.find("explosion") >= 0 or lowered.find("fogo") >= 0:
		return Color(1.0, 0.25, 0.05, 0.42)
	if lowered.find("mestra") >= 0 or lowered.find("arcane") >= 0 or lowered.find("distortion") >= 0:
		return Color(0.95, 0.0, 1.0, 0.42)
	if lowered.find("item") >= 0:
		return Color(1.0, 0.86, 0.22, 0.38)
	if lowered.find("warning") >= 0 or lowered.find("strike") >= 0:
		return Color(1.0, 0.0, 0.0, 0.44)
	return Color(0.36, 0.8, 1.0, 0.35)
