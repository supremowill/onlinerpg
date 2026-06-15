extends BaseVisualController
class_name PlayerVisualController

func _update_animation(snapshot: Dictionary) -> void:
	if is_dead:
		play_animation("death", "idle")
	elif hp < previous_hp:
		play_animation("hit", "idle")
	elif bool(snapshot.get("isUltActive", false)):
		play_animation("skill_r", "idle")
	elif bool(snapshot.get("isDashing", false)):
		play_animation("skill_q", "run")
	elif bool(snapshot.get("isAttacking", false)):
		play_animation("attack", "idle")
	elif _is_moving():
		play_animation(_directional_run_animation(), "run")
	else:
		play_animation("idle")

func _is_moving() -> bool:
	if snapshot_movement_delta.length_squared() > 0.0004:
		return true
	var pending_delta: Vector3 = target_position - global_position
	pending_delta.y = 0.0
	return pending_delta.length_squared() > 0.0025

func _directional_run_animation() -> String:
	var movement: Vector3 = snapshot_movement_delta
	if movement.length_squared() <= 0.0004:
		movement = target_position - global_position
	movement.y = 0.0
	if movement.length_squared() <= 0.0004:
		return "run_forward"
	movement = movement.normalized()

	var facing: Vector3 = Vector3(sin(target_rot_y), 0.0, cos(target_rot_y)).normalized()
	var right: Vector3 = Vector3(cos(target_rot_y), 0.0, -sin(target_rot_y)).normalized()
	var forward_amount: float = movement.dot(facing)
	var side_amount: float = movement.dot(right)

	if absf(side_amount) > absf(forward_amount):
		if side_amount < 0.0:
			return "run_left"
		return "run_right"
	if forward_amount < 0.0:
		return "run_back"
	return "run_forward"
