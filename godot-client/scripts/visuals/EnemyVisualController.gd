extends BaseVisualController
class_name EnemyVisualController

var last_attack_sequence: int = -1

func _update_animation(snapshot: Dictionary) -> void:
	if is_dead:
		play_animation("death", "idle")
	elif hp < previous_hp:
		play_animation("hit", "idle")
	elif entity_type == "RedCone":
		_update_red_cone_animation(snapshot)
	elif bool(snapshot.get("isChanneling", false)) or bool(snapshot.get("isChannelingW", false)):
		play_animation("attack", "idle")
	elif global_position.distance_to(target_position) > 0.05:
		play_animation("run", "idle")
	else:
		play_animation("idle")

func _update_red_cone_animation(snapshot: Dictionary) -> void:
	var attack_sequence: int = int(snapshot.get("attackSequence", last_attack_sequence))
	if bool(snapshot.get("isChanneling", false)) and attack_sequence != last_attack_sequence:
		last_attack_sequence = attack_sequence
		current_animation = ""
		play_animation("attack", "Scene")
		return
	if current_animation == "":
		play_animation("idle")
