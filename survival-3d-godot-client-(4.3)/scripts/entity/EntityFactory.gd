extends Node
class_name EntityFactory

const PLAYER_DEFAULT := "res://scenes/entities/players/default_player.tscn"
const ENEMY_DEFAULT := "res://scenes/entities/enemies/default_enemy.tscn"
const BOSS_DEFAULT := "res://scenes/entities/bosses/default_boss.tscn"
const PROJECTILE_DEFAULT := "res://scenes/entities/projectiles/default_projectile.tscn"
const ORB_XP := "res://scenes/entities/orbs/xp_orb.tscn"

var scene_map := {
	"players/default_player.tscn": PLAYER_DEFAULT,
	"enemies/default_enemy.tscn": ENEMY_DEFAULT,
	"enemies/lobo_macabro.tscn": "res://scenes/entities/enemies/lobo_macabro.tscn",
	"enemies/farao.tscn": "res://scenes/entities/enemies/farao.tscn",
	"bosses/default_boss.tscn": BOSS_DEFAULT,
	"projectiles/default_projectile.tscn": PROJECTILE_DEFAULT,
	"orbs/xp_orb.tscn": ORB_XP,
	"player": PLAYER_DEFAULT,
	"PurpleCube": ENEMY_DEFAULT,
	"RedCone": ENEMY_DEFAULT,
	"EnemyTower": ENEMY_DEFAULT,
	"GuardianGuerreiro": ENEMY_DEFAULT,
	"GuardianMago": ENEMY_DEFAULT,
	"GuardianArqueiro": ENEMY_DEFAULT,
	"LoboMacabro": "res://scenes/entities/enemies/lobo_macabro.tscn",
	"Farao": "res://scenes/entities/enemies/farao.tscn",
	"FaraoEnemy": "res://scenes/entities/enemies/farao.tscn",
	"TheMightyOne": BOSS_DEFAULT,
	"SuperBoss": BOSS_DEFAULT,
	"Gangplank": BOSS_DEFAULT,
	"RainhaDasTrevas": BOSS_DEFAULT,
	"PlantaCarnivora": BOSS_DEFAULT,
	"FeiticeiroImortal": BOSS_DEFAULT,
	"LichKing": BOSS_DEFAULT,
	"CaoDosInfernos": BOSS_DEFAULT,
	"MestraDaIlusao": BOSS_DEFAULT,
	"projectile": PROJECTILE_DEFAULT,
	"xp": ORB_XP
}

func register_scene(type_id: String, scene_path: String) -> void:
	scene_map[type_id] = scene_path

func create_player(snapshot: Dictionary) -> Node3D:
	return _instantiate(scene_map.get("player", PLAYER_DEFAULT), snapshot)

func create_enemy(snapshot: Dictionary) -> Node3D:
	var type_id := str(snapshot.get("type", ""))
	var path := str(scene_map.get(type_id, ENEMY_DEFAULT))
	return _instantiate(path, snapshot)

func create_boss(snapshot: Dictionary) -> Node3D:
	var type_id := str(snapshot.get("type", ""))
	var path := str(scene_map.get(type_id, BOSS_DEFAULT))
	return _instantiate(path, snapshot)

func create_projectile(snapshot: Dictionary) -> Node3D:
	var special := str(snapshot.get("specialEffect", ""))
	var path := str(scene_map.get(special, PROJECTILE_DEFAULT))
	return _instantiate(path, snapshot)

func create_orb(snapshot: Dictionary) -> Node3D:
	var type_id := str(snapshot.get("type", "xp"))
	var path := str(scene_map.get(type_id, ORB_XP))
	return _instantiate(path, snapshot)

func create_dynamic_entity(snapshot: Dictionary) -> Node3D:
	return _instantiate(PROJECTILE_DEFAULT, snapshot)

func _instantiate(scene_path: String, snapshot: Dictionary) -> Node3D:
	var packed := load(scene_path)
	if packed == null:
		push_warning("Missing visual scene: %s" % scene_path)
		packed = load(ENEMY_DEFAULT)
	var node: Node3D = packed.instantiate()
	if node.has_method("setup_from_snapshot"):
		node.setup_from_snapshot(snapshot)
	return node

