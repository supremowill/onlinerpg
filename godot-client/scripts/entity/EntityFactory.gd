extends Node
class_name EntityFactory

const PLAYER_DEFAULT: String = "res://scenes/entities/players/default_player.tscn"
const ENEMY_DEFAULT: String = "res://scenes/entities/enemies/default_enemy.tscn"
const BOSS_DEFAULT: String = "res://scenes/entities/bosses/default_boss.tscn"
const PROJECTILE_DEFAULT: String = "res://scenes/entities/projectiles/default_projectile.tscn"
const ORB_XP: String = "res://scenes/entities/orbs/xp_orb.tscn"
const DYNAMIC_ZONE_DEFAULT: String = "res://scenes/entities/dynamic/default_zone.tscn"

var scene_map: Dictionary = {
	"players/default_player.tscn": PLAYER_DEFAULT,
	"enemies/default_enemy.tscn": ENEMY_DEFAULT,
	"enemies/lobo_macabro.tscn": "res://scenes/entities/enemies/lobo_macabro.tscn",
	"enemies/farao.tscn": "res://scenes/entities/enemies/farao.tscn",
	"bosses/default_boss.tscn": BOSS_DEFAULT,
	"projectiles/default_projectile.tscn": PROJECTILE_DEFAULT,
	"orbs/xp_orb.tscn": ORB_XP,
	"dynamic/default_zone.tscn": DYNAMIC_ZONE_DEFAULT,
	"player": PLAYER_DEFAULT,
	"PurpleCube": "res://scenes/entities/enemies/purple_cube.tscn",
	"RedCone": "res://scenes/entities/enemies/red_cone.tscn",
	"EnemyTower": "res://scenes/entities/enemies/enemy_tower.tscn",
	"GuardianGuerreiro": "res://scenes/entities/enemies/guardian_guerreiro.tscn",
	"GuardianMago": "res://scenes/entities/enemies/guardian_mago.tscn",
	"GuardianArqueiro": "res://scenes/entities/enemies/guardian_arqueiro.tscn",
	"BruxaDoGelo": "res://scenes/entities/enemies/bruxa_do_gelo.tscn",
	"EscravoGlacial": "res://scenes/entities/enemies/escravo_glacial.tscn",
	"LoboMacabro": "res://scenes/entities/enemies/lobo_macabro.tscn",
	"BombardeiroInsano": "res://scenes/entities/enemies/bombardeiro_insano.tscn",
	"CloneIlusorio": "res://scenes/entities/enemies/clone_ilusorio.tscn",
	"AlmaAmaldicoada": "res://scenes/entities/enemies/alma_amaldicoada.tscn",
	"AlmaErrante": "res://scenes/entities/enemies/caveira_explosiva.tscn",
	"CaveiraExplosiva": "res://scenes/entities/enemies/caveira_explosiva.tscn",
	"EspectroSombrio": "res://scenes/entities/enemies/espectro_sombrio.tscn",
	"BrotoCarnivoro": "res://scenes/entities/enemies/broto_carnivoro.tscn",
	"CloneSmith": "res://scenes/entities/enemies/clone_smith.tscn",
	"EscaravelhoFarao": "res://scenes/entities/enemies/escaravelho_farao.tscn",
	"Ghoul": "res://scenes/entities/enemies/ghoul.tscn",
	"Valkyr": "res://scenes/entities/enemies/valkyr.tscn",
	"MatilhaGeometra": "res://scenes/entities/enemies/matilha_geometra.tscn",
	"DoutorDoenca": "res://scenes/entities/enemies/doutor_doenca.tscn",
	"Smith": "res://scenes/entities/enemies/smith.tscn",
	"Farao": "res://scenes/entities/enemies/farao.tscn",
	"FaraoEnemy": "res://scenes/entities/enemies/farao.tscn",
	"MestraDaIlusao": "res://scenes/entities/bosses/mestra_da_ilusao.tscn",
	"TheMightyOne": "res://scenes/entities/bosses/the_mighty_one.tscn",
	"SuperBoss": "res://scenes/entities/bosses/super_boss.tscn",
	"Gangplank": "res://scenes/entities/bosses/gangplank.tscn",
	"RainhaDasTrevas": "res://scenes/entities/bosses/rainha_das_trevas.tscn",
	"PlantaCarnivora": "res://scenes/entities/bosses/planta_carnivora.tscn",
	"FeiticeiroImortal": "res://scenes/entities/bosses/feiticeiro_imortal.tscn",
	"LichKing": "res://scenes/entities/bosses/lich_king.tscn",
	"CaoDosInfernos": "res://scenes/entities/bosses/cao_dos_infernos.tscn",
	"GuardiãoDoLimbo": "res://scenes/entities/bosses/guardiao_do_limbo.tscn",
	"GuardiÃ£oDoLimbo": "res://scenes/entities/bosses/guardiao_do_limbo.tscn",
	"GuardiaoDoLimbo": "res://scenes/entities/bosses/guardiao_do_limbo.tscn",
	"Minos": "res://scenes/entities/bosses/minos.tscn",
	"Cerbero": "res://scenes/entities/bosses/cerbero.tscn",
	"Plutão": "res://scenes/entities/bosses/plutao.tscn",
	"PlutÃ£o": "res://scenes/entities/bosses/plutao.tscn",
	"Plutao": "res://scenes/entities/bosses/plutao.tscn",
	"Fúria": "res://scenes/entities/bosses/furia.tscn",
	"FÃºria": "res://scenes/entities/bosses/furia.tscn",
	"Furia": "res://scenes/entities/bosses/furia.tscn",
	"Megera": "res://scenes/entities/bosses/megera.tscn",
	"Minotauro": "res://scenes/entities/bosses/minotauro.tscn",
	"Geriao": "res://scenes/entities/bosses/geriao.tscn",
	"Lúcifer": "res://scenes/entities/bosses/lucifer.tscn",
	"LÃºcifer": "res://scenes/entities/bosses/lucifer.tscn",
	"Lucifer": "res://scenes/entities/bosses/lucifer.tscn",
	"EspectroDeRaziel": "res://scenes/entities/bosses/espectro_de_raziel.tscn",
	"limbo_poison": PROJECTILE_DEFAULT,
	"limbo_poison_chance": PROJECTILE_DEFAULT,
	"limbo_burn": PROJECTILE_DEFAULT,
	"limbo_ice_slow": PROJECTILE_DEFAULT,
	"red_cone_fireball": "res://scenes/entities/projectiles/red_cone_fireball.tscn",
	"player_arrow": "res://scenes/entities/projectiles/player_arrow.tscn",
	"projectile": PROJECTILE_DEFAULT,
	"xp": ORB_XP,
	"dynamic": DYNAMIC_ZONE_DEFAULT
}

func register_scene(type_id: String, scene_path: String) -> void:
	scene_map[type_id] = scene_path

func create_player(snapshot: Dictionary) -> Node3D:
	return _instantiate(str(scene_map.get("player", PLAYER_DEFAULT)), snapshot)

func create_enemy(snapshot: Dictionary) -> Node3D:
	var type_id: String = str(snapshot.get("type", ""))
	var path: String = str(scene_map.get(type_id, ENEMY_DEFAULT))
	return _instantiate(path, snapshot)

func create_boss(snapshot: Dictionary) -> Node3D:
	var type_id: String = str(snapshot.get("type", ""))
	var path: String = str(scene_map.get(type_id, BOSS_DEFAULT))
	return _instantiate(path, snapshot)

func create_projectile(snapshot: Dictionary) -> Node3D:
	var visual: String = str(snapshot.get("visualEffect", ""))
	var special: String = str(snapshot.get("specialEffect", ""))
	var key: String = visual if visual != "" else special
	var path: String = str(scene_map.get(key, PROJECTILE_DEFAULT))
	return _instantiate(path, snapshot)

func create_orb(snapshot: Dictionary) -> Node3D:
	var type_id: String = str(snapshot.get("type", "xp"))
	var path: String = str(scene_map.get(type_id, ORB_XP))
	return _instantiate(path, snapshot)

func create_dynamic_entity(snapshot: Dictionary) -> Node3D:
	var type_id: String = str(snapshot.get("type", "dynamic"))
	var radius: float = float(snapshot.get("radius", 0.0))
	if radius > 0.0:
		var path: String = str(scene_map.get(type_id, DYNAMIC_ZONE_DEFAULT))
		if path == PROJECTILE_DEFAULT:
			path = DYNAMIC_ZONE_DEFAULT
		return _instantiate(path, snapshot)
	return _instantiate(PROJECTILE_DEFAULT, snapshot)

func _instantiate(scene_path: String, snapshot: Dictionary) -> Node3D:
	var packed: PackedScene = load(scene_path) as PackedScene
	if packed == null:
		push_warning("Missing visual scene: %s" % scene_path)
		packed = load(ENEMY_DEFAULT) as PackedScene
	var node: Node3D = packed.instantiate()
	if node.has_method("setup_from_snapshot"):
		node.setup_from_snapshot(snapshot)
	return node
