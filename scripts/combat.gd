extends Control
## Combat step: trade blows one exchange at a time. Deliberately simple —
## the loop grows this into the real system.

var enemy_hp: int
var enemy_atk: int
var log_lines: PackedStringArray = []

func _ready() -> void:
	enemy_hp = Run.enemy_hp()
	enemy_atk = Run.enemy_atk()
	_redraw()

func _redraw() -> void:
	# remove_child first: queue_free alone defers to end of frame, so the old
	# labels would draw on top of the new ones for a frame and land in captures.
	for child in get_children():
		remove_child(child)
		child.queue_free()

	Ui.backdrop(self, Color(0.11, 0.07, 0.08))
	Ui.label(self, "COMBAT - ROOM %d" % Run.room, Vector2(60, 36), 26)

	Ui.label(self, "YOU  %d/%d" % [Run.hp, Run.max_hp], Vector2(60, 110), 20, Color(0.4, 0.7, 0.95))
	Ui.bar(self, Vector2(60, 140), Vector2(300, 16), float(Run.hp) / float(Run.max_hp), Color(0.3, 0.8, 0.4))

	Ui.label(self, "ENEMY  %d/%d" % [enemy_hp, Run.enemy_hp()], Vector2(560, 110), 20, Color(0.9, 0.45, 0.45))
	Ui.bar(self, Vector2(560, 140), Vector2(300, 16), float(enemy_hp) / float(Run.enemy_hp()), Color(0.85, 0.3, 0.3))

	var y := 220.0
	for line in log_lines:
		Ui.label(self, line, Vector2(60, y), 18, Color(0.75, 0.75, 0.8))
		y += 28.0

	Ui.label(self, "[ Space ] strike", Vector2(390, 470), 22, Color(0.85, 0.75, 0.4))

func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("ui_accept"):
		return

	var dealt := Run.atk + randi_range(-1, 1)
	enemy_hp -= dealt
	_log("You strike for %d." % dealt)

	if enemy_hp <= 0:
		_log("Enemy falls.")
		_redraw()
		await get_tree().create_timer(0.4).timeout
		get_tree().change_scene_to_file("res://scenes/reward.tscn")
		return

	var taken := enemy_atk + randi_range(-1, 1)
	Run.hp -= taken
	_log("Enemy hits for %d." % taken)

	if not Run.is_alive():
		Run.hp = 0
		_log("You died in room %d." % Run.room)
		_redraw()
		await get_tree().create_timer(0.8).timeout
		get_tree().change_scene_to_file("res://scenes/title.tscn")
		return

	_redraw()

func _log(line: String) -> void:
	log_lines.append(line)
	if log_lines.size() > 5:
		log_lines.remove_at(0)
