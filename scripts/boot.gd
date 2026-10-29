extends Control
## Entry point. GAME_START picks which screen to open, so visual QA can jump
## straight to any screen without playing through to it.

const SCREENS := {
	"title": "res://scenes/title.tscn",
	"dungeon": "res://scenes/dungeon.tscn",
	"combat": "res://scenes/combat.tscn",
	"reward": "res://scenes/reward.tscn",
}

func _ready() -> void:
	var key := OS.get_environment("GAME_START")
	if key.is_empty():
		key = "title"
	if not SCREENS.has(key):
		printerr("[boot] unknown GAME_START '%s'. known: %s" % [key, ", ".join(SCREENS.keys())])
		key = "title"

	Run.reset()
	# Jumping straight to a mid-run screen needs plausible state to render.
	if key == "combat" or key == "reward":
		Run.room = 3
		Run.hp = 22

	print("[boot] start screen: %s" % key)
	get_tree().change_scene_to_file.call_deferred(SCREENS[key])
