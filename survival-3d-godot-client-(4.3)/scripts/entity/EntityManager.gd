extends Node3D
class_name EntityManager

@export var factory_path: NodePath

var factory: EntityFactory
var entities := {}
var last_snapshot_tick := 0

func _ready() -> void:
	factory = get_node(factory_path) as EntityFactory

func apply_snapshot(snapshot: Dictionary) -> void:
	last_snapshot_tick = int(snapshot.get("tick", last_snapshot_tick))
	var seen := {}
	_sync_collection(snapshot.get("players", []), "player", seen)
	_sync_collection(snapshot.get("enemies", []), "enemy", seen)
	_sync_collection(snapshot.get("projectiles", []), "projectile", seen)
	_sync_collection(snapshot.get("orbs", []), "orb", seen)
	_sync_collection(snapshot.get("dynamicEntities", []), "dynamic", seen)
	_remove_missing(seen)

func _sync_collection(items: Array, category: String, seen: Dictionary) -> void:
	for snapshot in items:
		if typeof(snapshot) != TYPE_DICTIONARY:
			continue
		var id := str(snapshot.get("id", ""))
		if id == "":
			continue
		seen[id] = true
		var entry = entities.get(id)
		if entry == null:
			var node := _create_node(category, snapshot)
			add_child(node)
			entry = {"node": node, "category": category}
			entities[id] = entry
		var visual: Node = entry["node"]
		if visual.has_method("apply_snapshot"):
			visual.apply_snapshot(snapshot)

func _create_node(category: String, snapshot: Dictionary) -> Node3D:
	match category:
		"player":
			return factory.create_player(snapshot)
		"enemy":
			var type_id := str(snapshot.get("type", ""))
			if type_id in ["TheMightyOne", "SuperBoss", "Gangplank", "RainhaDasTrevas", "PlantaCarnivora", "FeiticeiroImortal", "LichKing", "CaoDosInfernos", "MestraDaIlusao", "Farao"]:
				return factory.create_boss(snapshot)
			return factory.create_enemy(snapshot)
		"projectile":
			return factory.create_projectile(snapshot)
		"orb":
			return factory.create_orb(snapshot)
		"dynamic":
			return factory.create_dynamic_entity(snapshot)
	return factory.create_enemy(snapshot)

func _remove_missing(seen: Dictionary) -> void:
	for id in entities.keys():
		if not seen.has(id):
			var node: Node = entities[id]["node"]
			if node.has_method("despawn"):
				node.despawn()
			else:
				node.queue_free()
			entities.erase(id)

