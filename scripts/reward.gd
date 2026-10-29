extends Control
## Reward step: one pick, then the next room.

## Labels are built from the Run constants so the screen cannot advertise a
## number the simulator is not actually applying.
func _choices() -> Array:
	return [
		{"key": "1", "text": "+%d MAX HP (and heal %d)" % [Run.REWARD_MAX_HP_GAIN, Run.REWARD_MAX_HP_HEAL]},
		{"key": "2", "text": "+%d ATK" % Run.REWARD_ATK_GAIN},
		{"key": "3", "text": "HEAL %d" % Run.REWARD_HEAL_AMOUNT},
	]

func _ready() -> void:
	Ui.backdrop(self, Color(0.07, 0.1, 0.08))
	Ui.label(self, "ROOM %d CLEARED" % Run.room, Vector2(60, 36), 26)
	Ui.label(self, "HP %d/%d   ATK %d" % [Run.hp, Run.max_hp, Run.atk], Vector2(60, 80), 20, Color(0.7, 0.8, 0.7))
	Ui.label(self, "Choose a reward:", Vector2(60, 160), 22)

	var y := 220.0
	for choice in _choices():
		Ui.label(self, "[ %s ]  %s" % [choice["key"], choice["text"]], Vector2(80, y), 20, Color(0.85, 0.8, 0.5))
		y += 44.0

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.is_pressed() and not event.is_echo()):
		return

	match (event as InputEventKey).keycode:
		KEY_1:
			Run.apply_reward(Run.REWARD_MAX_HP)
		KEY_2:
			Run.apply_reward(Run.REWARD_ATK)
		KEY_3:
			Run.apply_reward(Run.REWARD_HEAL)
		_:
			return

	Run.room += 1
	get_tree().change_scene_to_file("res://scenes/dungeon.tscn")
