extends Control
## Reward step: one pick, then the next room.

const CHOICES := [
	{"key": "1", "text": "+8 MAX HP (and heal 8)"},
	{"key": "2", "text": "+2 ATK"},
	{"key": "3", "text": "HEAL 12"},
]

func _ready() -> void:
	Ui.backdrop(self, Color(0.07, 0.1, 0.08))
	Ui.label(self, "ROOM %d CLEARED" % Run.room, Vector2(60, 36), 26)
	Ui.label(self, "HP %d/%d   ATK %d" % [Run.hp, Run.max_hp, Run.atk], Vector2(60, 80), 20, Color(0.7, 0.8, 0.7))
	Ui.label(self, "Choose a reward:", Vector2(60, 160), 22)

	var y := 220.0
	for choice in CHOICES:
		Ui.label(self, "[ %s ]  %s" % [choice["key"], choice["text"]], Vector2(80, y), 20, Color(0.85, 0.8, 0.5))
		y += 44.0

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.is_pressed() and not event.is_echo()):
		return

	match (event as InputEventKey).keycode:
		KEY_1:
			Run.max_hp += 8
			Run.hp = mini(Run.max_hp, Run.hp + 8)
		KEY_2:
			Run.atk += 2
		KEY_3:
			Run.hp = mini(Run.max_hp, Run.hp + 12)
		_:
			return

	Run.room += 1
	get_tree().change_scene_to_file("res://scenes/dungeon.tscn")
