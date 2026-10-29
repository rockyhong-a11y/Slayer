extends Control
## Terminal screen of a winning run: the last room's reward was taken and the
## player is still alive. The only way out is back to the title.

func _ready() -> void:
	Ui.backdrop(self, Color(0.07, 0.1, 0.08))
	Ui.label(self, "RUN CLEARED", Vector2(297, 140), 54)
	Ui.label(self, "%d rooms survived" % Run.ROOMS_PER_RUN, Vector2(391, 220), 20, Color(0.6, 0.75, 0.6))

	Ui.label(self, "HP %d/%d" % [Run.hp, Run.max_hp], Vector2(336, 300), 24, Color(0.4, 0.8, 0.5))
	Ui.label(self, "ATK %d" % Run.atk, Vector2(546, 300), 24, Color(0.85, 0.75, 0.4))

	Ui.label(self, "[ Space ] back to title", Vector2(370, 430), 22, Color(0.85, 0.75, 0.4))

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		get_tree().change_scene_to_file("res://scenes/title.tscn")
