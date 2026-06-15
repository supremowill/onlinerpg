extends BaseVisualController
class_name EnemyVisualController

func _update_animation(snapshot: Dictionary) -> void:
	if is_dead:
		play_animation("death", "idle")
	elif hp < previous_hp:
		play_animation("hit", "idle")
	elif snapshot.get("isChanneling", false) or snapshot.get("isChannelingW", false):
		play_animation("attack", "idle")
	elif global_position.distance_to(target_position) > 0.05:
		play_animation("run", "idle")
	else:
		play_animation("idle")

