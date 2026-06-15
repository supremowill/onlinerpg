extends Node3D
class_name EntityManager

@export var factory_path: NodePath

var factory: EntityFactory
var entities: Dictionary = {}
var last_snapshot_tick: int = 0
var boss_types: Array = [
	"TheMightyOne", "SuperBoss", "Gangplank", "RainhaDasTrevas", "PlantaCarnivora",
	"FeiticeiroImortal", "LichKing", "CaoDosInfernos", "MestraDaIlusao", "Farao",
	"GuardiãoDoLimbo", "GuardiÃ£oDoLimbo", "GuardiaoDoLimbo", "Minos", "Cerbero",
	"Plutão", "PlutÃ£o", "Plutao", "Fúria", "FÃºria", "Furia", "Megera",
	"Minotauro", "Geriao", "Lúcifer", "LÃºcifer", "Lucifer", "EspectroDeRaziel"
]

func _ready() -> void:
	factory = get_node(factory_path) as EntityFactory

func apply_snapshot(snapshot: Dictionary) -> void:
	last_snapshot_tick = int(snapshot.get("tick", last_snapshot_tick))
	var seen: Dictionary = {}
	_sync_collection(_snapshot_array(snapshot, "players"), "player", seen)
	_sync_collection(_snapshot_array(snapshot, "enemies"), "enemy", seen)
	_sync_collection(_snapshot_array(snapshot, "projectiles"), "projectile", seen)
	_sync_collection(_snapshot_array(snapshot, "orbs"), "orb", seen)
	_sync_collection(_snapshot_array(snapshot, "dynamicEntities"), "dynamic", seen)
	_remove_missing(seen)

func _snapshot_array(snapshot: Dictionary, key: String) -> Array:
	var value: Variant = snapshot.get(key, [])
	if typeof(value) == TYPE_ARRAY:
		return value
	return []

func _sync_collection(items: Array, category: String, seen: Dictionary) -> void:
	for snapshot: Variant in items:
		if typeof(snapshot) != TYPE_DICTIONARY:
			continue
		var snapshot_data: Dictionary = snapshot
		var id: String = str(snapshot_data.get("id", ""))
		if id == "":
			continue
		seen[id] = true
		var entry: Variant = entities.get(id)
		if entry == null:
			var node: Node3D = _create_node(category, snapshot_data)
			add_child(node)
			entry = {"node": node, "category": category}
			entities[id] = entry
		var entry_data: Dictionary = entry
		var visual: Node = entry_data["node"] as Node
		if visual.has_method("apply_snapshot"):
			visual.apply_snapshot(snapshot_data)

func _create_node(category: String, snapshot: Dictionary) -> Node3D:
	match category:
		"player":
			return factory.create_player(snapshot)
		"enemy":
			var type_id: String = str(snapshot.get("type", ""))
			if boss_types.has(type_id):
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
	for id: Variant in entities.keys():
		if not seen.has(id):
			var entry_data: Dictionary = entities[id]
			var node: Node = entry_data["node"] as Node
			if node.has_method("despawn"):
				node.despawn()
			else:
				node.queue_free()
			entities.erase(id)

func get_entity_node(entity_id: String) -> Node3D:
	var entry: Variant = entities.get(entity_id)
	if typeof(entry) != TYPE_DICTIONARY:
		return null
	var entry_data: Dictionary = entry
	return entry_data.get("node") as Node3D

func get_first_player_node() -> Node3D:
	for id: Variant in entities.keys():
		var entry: Variant = entities[id]
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var entry_data: Dictionary = entry
		if str(entry_data.get("category", "")) == "player":
			return entry_data.get("node") as Node3D
	return null
