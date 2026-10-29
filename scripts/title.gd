extends Control

func _ready() -> void:
	Ui.backdrop(self, Color(0.07, 0.07, 0.1))
	Ui.label(self, "SLAYER", Vector2(340, 170), 64)
	Ui.label(self, "a roguelike dungeon crawler", Vector2(338, 250), 20, Color(0.6, 0.6, 0.7))
	Ui.label(self, "[ Space ] descend", Vector2(390, 400), 22, Color(0.85, 0.75, 0.4))

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		Run.reset()
		get_tree().change_scene_to_file("res://scenes/dungeon.tscn")
