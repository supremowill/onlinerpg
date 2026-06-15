extends CanvasLayer
class_name DamageNumberManager

@export var camera_path: NodePath
@export var entity_manager_path: NodePath
@export_range(10, 200, 1) var pool_size: int = 80
@export var max_active_numbers: int = 100

var camera: Camera3D
var entity_manager: EntityManager
var root: Control
var pool: Array[Label] = []
var active_numbers: Array[Dictionary] = []

func _ready() -> void:
	layer = 25
	root = Control.new()
	root.name = "DamageNumberRoot"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	if camera_path != NodePath():
		camera = get_node_or_null(camera_path) as Camera3D
	if entity_manager_path != NodePath():
		entity_manager = get_node_or_null(entity_manager_path) as EntityManager
	_build_pool()

func configure(camera_node: Camera3D, entity_manager_node: EntityManager) -> void:
	camera = camera_node
	entity_manager = entity_manager_node

func show_hit_event(event_payload: Dictionary) -> void:
	var raw_data: Variant = event_payload.get("data", {})
	if typeof(raw_data) != TYPE_DICTIONARY:
		return
	var data: Dictionary = raw_data
	var text_type: String = str(data.get("type", "NORMAL")).to_upper()
	var value: int = int(round(float(data.get("value", 0.0))))
	if value <= 0 and text_type != "MISS":
		return

	var world_position: Vector3 = _resolve_world_position(data)
	show_damage(world_position, value, text_type)

func show_damage(world_position: Vector3, value: int, text_type: String = "NORMAL") -> void:
	if camera == null or not is_instance_valid(camera):
		return
	if camera.is_position_behind(world_position):
		return

	var screen_position: Vector2 = camera.unproject_position(world_position)
	var viewport_size: Vector2 = get_viewport().get_visible_rect().size
	if screen_position.x < -80.0 or screen_position.y < -80.0 or screen_position.x > viewport_size.x + 80.0 or screen_position.y > viewport_size.y + 80.0:
		return

	var label: Label = _take_label()
	if label == null:
		return

	var style: Dictionary = _style_for_type(text_type)
	label.text = _format_value(value, text_type)
	label.visible = true
	label.modulate = Color(1.0, 1.0, 1.0, 1.0)
	label.add_theme_color_override("font_color", style["color"] as Color)
	label.add_theme_font_size_override("font_size", int(style["font_size"]))
	label.add_theme_constant_override("outline_size", int(style["outline_size"]))
	label.add_theme_color_override("font_outline_color", Color(0.0, 0.0, 0.0, 0.95))

	var jitter_x: float = randf_range(-18.0, 18.0)
	var jitter_y: float = randf_range(-8.0, 8.0)
	var start_position: Vector2 = screen_position + Vector2(jitter_x, jitter_y)
	label.position = start_position
	label.pivot_offset = label.size * 0.5
	label.scale = Vector2.ONE * float(style["start_scale"])

	active_numbers.append({
		"label": label,
		"elapsed": 0.0,
		"duration": float(style["duration"]),
		"start_position": start_position,
		"rise": float(style["rise"]),
		"start_scale": float(style["start_scale"]),
		"mid_scale": float(style["mid_scale"]),
		"end_scale": float(style["end_scale"])
	})

	if active_numbers.size() > max_active_numbers:
		_finish_number(0)

func _process(delta: float) -> void:
	for index: int in range(active_numbers.size() - 1, -1, -1):
		var entry: Dictionary = active_numbers[index]
		var label: Label = entry["label"] as Label
		if label == null or not is_instance_valid(label):
			active_numbers.remove_at(index)
			continue

		var elapsed: float = float(entry["elapsed"]) + delta
		var duration: float = maxf(0.01, float(entry["duration"]))
		var t: float = clampf(elapsed / duration, 0.0, 1.0)
		var eased: float = 1.0 - pow(1.0 - t, 2.0)
		var start_position: Vector2 = entry["start_position"] as Vector2
		var rise: float = float(entry["rise"])
		label.position = start_position + Vector2(0.0, -rise * eased)

		var scale_value: float
		if t < 0.16:
			scale_value = lerpf(float(entry["start_scale"]), float(entry["mid_scale"]), t / 0.16)
		else:
			scale_value = lerpf(float(entry["mid_scale"]), float(entry["end_scale"]), (t - 0.16) / 0.84)
		label.scale = Vector2.ONE * scale_value
		label.modulate.a = clampf(1.0 - maxf(0.0, (t - 0.55) / 0.45), 0.0, 1.0)
		entry["elapsed"] = elapsed
		active_numbers[index] = entry

		if elapsed >= duration:
			_finish_number(index)

func _build_pool() -> void:
	for pool_index: int in range(pool_size):
		var label: Label = Label.new()
		label.name = "DamageNumber_%03d" % pool_index
		label.visible = false
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.custom_minimum_size = Vector2(180.0, 38.0)
		label.size = Vector2(180.0, 38.0)
		label.add_theme_font_size_override("font_size", 15)
		label.add_theme_constant_override("outline_size", 4)
		label.add_theme_color_override("font_outline_color", Color.BLACK)
		root.add_child(label)
		pool.append(label)

func _take_label() -> Label:
	if pool.is_empty():
		if active_numbers.is_empty():
			return null
		_finish_number(0)
	if pool.is_empty():
		return null
	return pool.pop_back()

func _finish_number(index: int) -> void:
	if index < 0 or index >= active_numbers.size():
		return
	var entry: Dictionary = active_numbers[index]
	var label: Label = entry["label"] as Label
	active_numbers.remove_at(index)
	if label == null or not is_instance_valid(label):
		return
	label.visible = false
	label.text = ""
	label.modulate = Color.WHITE
	label.position = Vector2(-9999.0, -9999.0)
	label.scale = Vector2.ONE
	pool.append(label)

func _resolve_world_position(data: Dictionary) -> Vector3:
	var target_id: String = str(data.get("targetId", ""))
	var target_node: Node3D = null
	if entity_manager != null and target_id != "":
		target_node = entity_manager.get_entity_node(target_id)

	if target_node != null and is_instance_valid(target_node):
		var y_offset: float = float(data.get("y", 1.8))
		var target_position: Vector3 = target_node.global_position
		return Vector3(
			float(data.get("x", target_position.x)),
			target_position.y + y_offset,
			float(data.get("z", target_position.z))
		)

	return Vector3(
		float(data.get("x", 0.0)),
		float(data.get("y", 1.8)),
		float(data.get("z", 0.0))
	)

func _format_value(value: int, text_type: String) -> String:
	var upper_type: String = text_type.to_upper()
	if upper_type == "MISS" or value <= 0:
		return "MISS"

	var number_text: String
	if value >= 1000000:
		number_text = "%.1fM" % (float(value) / 1000000.0)
	elif value >= 10000:
		number_text = "%dK" % int(round(float(value) / 1000.0))
	else:
		number_text = str(value)

	match upper_type:
		"HEAL":
			return "+%s" % number_text
		"TOXIC", "POISON":
			return "POISON %s" % number_text
		"THORNS", "REFLECT":
			return "REFLECT %s" % number_text
		"SPELLVAMP":
			return "VAMP +%s" % number_text
		"LIFESTEAL":
			return "LIFE +%s" % number_text
		"CRIT":
			return "%s!" % number_text
		"SHIELD":
			return "SHIELD %s" % number_text
	return number_text

func _style_for_type(text_type: String) -> Dictionary:
	match text_type.to_upper():
		"CRIT":
			return {"color": Color(1.0, 0.16, 0.16, 1.0), "font_size": 21, "duration": 1.25, "rise": 104.0, "start_scale": 1.6, "mid_scale": 1.3, "end_scale": 0.9, "outline_size": 5}
		"HEAL":
			return {"color": Color(0.0, 1.0, 0.27, 1.0), "font_size": 15, "duration": 1.05, "rise": 76.0, "start_scale": 1.15, "mid_scale": 1.0, "end_scale": 0.85, "outline_size": 4}
		"SHIELD":
			return {"color": Color(1.0, 0.84, 0.0, 1.0), "font_size": 15, "duration": 1.05, "rise": 72.0, "start_scale": 1.15, "mid_scale": 1.0, "end_scale": 0.85, "outline_size": 4}
		"TOXIC", "POISON":
			return {"color": Color(0.22, 1.0, 0.08, 1.0), "font_size": 13, "duration": 0.9, "rise": 64.0, "start_scale": 1.05, "mid_scale": 0.95, "end_scale": 0.82, "outline_size": 4}
		"THORNS", "REFLECT":
			return {"color": Color(1.0, 0.47, 0.0, 1.0), "font_size": 13, "duration": 1.0, "rise": 70.0, "start_scale": 1.08, "mid_scale": 0.98, "end_scale": 0.84, "outline_size": 4}
		"SPELLVAMP":
			return {"color": Color(0.74, 0.08, 1.0, 1.0), "font_size": 13, "duration": 1.0, "rise": 70.0, "start_scale": 1.08, "mid_scale": 0.98, "end_scale": 0.84, "outline_size": 4}
		"LIFESTEAL":
			return {"color": Color(1.0, 0.08, 0.58, 1.0), "font_size": 13, "duration": 1.0, "rise": 70.0, "start_scale": 1.08, "mid_scale": 0.98, "end_scale": 0.84, "outline_size": 4}
		"MISS":
			return {"color": Color(0.82, 0.82, 0.88, 1.0), "font_size": 15, "duration": 0.85, "rise": 58.0, "start_scale": 1.0, "mid_scale": 0.95, "end_scale": 0.82, "outline_size": 4}
	return {"color": Color.WHITE, "font_size": 15, "duration": 1.0, "rise": 80.0, "start_scale": 1.15, "mid_scale": 1.0, "end_scale": 0.85, "outline_size": 4}
