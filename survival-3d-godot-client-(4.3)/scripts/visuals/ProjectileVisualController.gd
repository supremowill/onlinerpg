extends BaseVisualController
class_name ProjectileVisualController

func apply_snapshot(snapshot: Dictionary) -> void:
	super.apply_snapshot(snapshot)
	var color_value := int(snapshot.get("color", 0xffffff))
	var color := Color8((color_value >> 16) & 255, (color_value >> 8) & 255, color_value & 255)
	modulate_model(color)

func _update_animation(_snapshot: Dictionary) -> void:
	play_animation("run", "idle")
