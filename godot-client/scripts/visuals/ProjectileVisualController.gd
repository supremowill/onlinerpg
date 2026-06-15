extends BaseVisualController
class_name ProjectileVisualController

func apply_snapshot(snapshot: Dictionary) -> void:
	super.apply_snapshot(snapshot)
	var color_value: int = int(snapshot.get("color", 0xffffff))
	var color: Color = Color8((color_value >> 16) & 255, (color_value >> 8) & 255, color_value & 255)
	color = _resolve_projectile_color(str(snapshot.get("specialEffect", special_effect)), color)
	var visual_key: String = str(snapshot.get("visualEffect", "")).to_lower()
	var effect_key: String = str(snapshot.get("specialEffect", special_effect)).to_lower()
	if effect_key != "red_cone_fireball" and visual_key != "player_arrow":
		modulate_model(color)
	var visual_radius: float = maxf(0.18, float(snapshot.get("hitboxRadius", 0.18)))
	if model_root:
		var scale_multiplier: float = 1.0
		if effect_key == "red_cone_fireball":
			scale_multiplier = 1.35
		if visual_key == "player_arrow":
			model_root.scale = Vector3.ONE
		else:
			model_root.scale = Vector3.ONE * clampf(visual_radius / 0.18, 0.75, 2.6) * scale_multiplier

func _update_animation(_snapshot: Dictionary) -> void:
	play_animation("run", "Animation")

func _resolve_projectile_color(effect_key: String, fallback: Color) -> Color:
	var lowered: String = effect_key.to_lower()
	if lowered == "limbo_poison" or lowered == "limbo_poison_chance":
		return Color(0.25, 1.0, 0.18)
	if lowered == "limbo_burn":
		return Color(1.0, 0.22, 0.05)
	if lowered == "limbo_ice_slow":
		return Color(0.32, 0.82, 1.0)
	if lowered == "red_cone_fireball":
		return Color(1.0, 0.28, 0.05)
	if lowered == "erg_base_slime":
		return Color(0.66, 0.33, 1.0)
	return fallback
