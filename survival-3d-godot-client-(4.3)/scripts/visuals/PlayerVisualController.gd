extends BaseVisualController
class_name PlayerVisualController

func _update_animation(snapshot: Dictionary) -> void:
	if is_dead:
		play_animation("death", "idle")
	elif hp < previous_hp:
		play_animation("hit", "idle")
	elif snapshot.get("isUltActive", false):
		play_animation("skill_r", "idle")
	elif snapshot.get("isDashing", false):
		play_animation("skill_q", "run")
	elif global_position.distance_to(target_position) > 0.05:
		play_animation("run", "idle")
	else:
		play_animation("idle")

