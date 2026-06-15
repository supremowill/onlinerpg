extends BaseVisualController
class_name OrbVisualController

var spin_speed: float = 2.5

func apply_snapshot(snapshot: Dictionary) -> void:
	var patched: Dictionary = snapshot.duplicate()
	patched["y"] = patched.get("y", 0.35)
	patched["hp"] = 1
	patched["maxHp"] = 1
	super.apply_snapshot(patched)

func _process(delta: float) -> void:
	super._process(delta)
	rotation.y += spin_speed * delta

func _update_animation(_snapshot: Dictionary) -> void:
	play_animation("idle")
