extends Control
## Explore step of the loop: show the room ahead and what waits in it.

func _ready() -> void:
	Ui.backdrop(self, Color(0.09, 0.08, 0.11))
	_draw_hud()

	Ui.label(self, "ROOM %d" % Run.room, Vector2(60, 110), 40)
	Ui.label(self, "A hostile blocks the way.", Vector2(60, 170), 20, Color(0.7, 0.7, 0.8))

	# Placeholder actors until real art exists.
	var player := ColorRect.new()
	player.position = Vector2(180, 300)
	player.size = Vector2(60, 90)
	player.color = Color(0.4, 0.7, 0.95)
	add_child(player)
	Ui.label(self, "YOU", Vector2(185, 400), 16, Color(0.4, 0.7, 0.95))

	var enemy := ColorRect.new()
	enemy.position = Vector2(700, 300)
	enemy.size = Vector2(60, 90)
	enemy.color = Color(0.9, 0.35, 0.35)
	add_child(enemy)
	Ui.label(self, "HP %d / ATK %d" % [Run.enemy_hp(), Run.enemy_atk()], Vector2(640, 400), 16, Color(0.9, 0.5, 0.5))

	Ui.label(self, "[ Space ] engage", Vector2(390, 470), 22, Color(0.85, 0.75, 0.4))

func _draw_hud() -> void:
	Ui.label(self, "HP %d/%d" % [Run.hp, Run.max_hp], Vector2(60, 40), 20)
	Ui.bar(self, Vector2(60, 70), Vector2(240, 14), float(Run.hp) / float(Run.max_hp), Color(0.3, 0.8, 0.4))
	Ui.label(self, "ATK %d" % Run.atk, Vector2(330, 40), 20, Color(0.85, 0.75, 0.4))

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		get_tree().change_scene_to_file("res://scenes/combat.tscn")
