extends Node
## Headless playthrough driver -- the measurement for DoD Q1 ("한 판 완주").
##
## Captures cannot prove the loop runs: capture.sh never presses a key, so it
## can only show that one screen draws. This node presses the keys. When
## PLAY_RUNS is set it watches the live scene tree, feeds each screen the input
## it asks for, and checks every screen change against the loop DESIGN 2
## describes. An illegal jump, a screen that stops answering, or a run that
## never ends is a failure and exits non-zero.
##
## It drives the real scenes, not a model of them -- that is the whole point.
## tools/balance_sim.gd replays the *rules*; this replays the *game*. The two
## can disagree, and if they ever do, this one is the truth.
##
## Inactive unless PLAY_RUNS is set, so normal play and capture.sh are
## untouched by it being an autoload.
##
## Env:
##   PLAY_RUNS    runs to play before reporting. Default 10.
##   PLAY_BUDGET  wall-clock budget for the whole session, seconds. Default 300.
##   PLAY_STALL   how long one screen may sit unchanged before it counts as
##                hung, seconds. Default 20.

const DEFAULT_RUNS := 10
const DEFAULT_BUDGET_SEC := 300
const DEFAULT_STALL_SEC := 20

## The loop DESIGN 2 describes, as the only screen changes allowed.
## combat -> title is death; reward -> victory is the tenth room cleared.
## boot is the entry point and may route anywhere -- that is what GAME_START is.
const LOOP := {
	"boot": ["title", "dungeon", "combat", "reward", "victory"],
	"title": ["dungeon"],
	"dungeon": ["combat"],
	"combat": ["reward", "title"],
	"reward": ["dungeon", "victory"],
	"victory": ["title"],
}

## Cycled across reward screens so a session exercises all three branches of
## apply_reward() rather than hammering one of them.
const REWARD_KEYS := [KEY_1, KEY_2, KEY_3]

var _active := false
var _runs_target := DEFAULT_RUNS
var _budget_ms := DEFAULT_BUDGET_SEC * 1000
var _stall_ms := DEFAULT_STALL_SEC * 1000

var _screen := ""
var _screen_since_ms := 0
var _pressed_here := false
var _reward_i := 0

var _runs_done := 0
var _clears := 0
var _deaths := 0
var _changes := 0
var _illegal := 0
var _first_run_trail: PackedStringArray = []
var _finished := false


func _ready() -> void:
	var runs_env := OS.get_environment("PLAY_RUNS")
	if not runs_env.is_valid_int():
		return
	_active = true
	_runs_target = maxi(1, runs_env.to_int())

	var budget_env := OS.get_environment("PLAY_BUDGET")
	if budget_env.is_valid_int():
		_budget_ms = maxi(1, budget_env.to_int()) * 1000
	var stall_env := OS.get_environment("PLAY_STALL")
	if stall_env.is_valid_int():
		_stall_ms = maxi(1, stall_env.to_int()) * 1000

	_screen_since_ms = Time.get_ticks_msec()
	print("[play] driving %d run(s), budget %ds, stall limit %ds"
		% [_runs_target, _budget_ms / 1000, _stall_ms / 1000])


func _process(_delta: float) -> void:
	if not _active or _finished:
		return

	if Time.get_ticks_msec() > _budget_ms:
		_fail("ran out of the %ds budget after %d run(s)" % [_budget_ms / 1000, _runs_done])
		return

	var scene := get_tree().current_scene
	if scene == null:
		return  # boot defers the first scene change by a frame

	var screen := _screen_of(scene)
	if screen != _screen:
		_enter(screen)
		if _finished:
			return
	elif Time.get_ticks_msec() - _screen_since_ms > _stall_ms:
		_fail("screen '%s' did not change for %ds" % [_screen, _stall_ms / 1000])
		return

	_press(scene)


## Scene file path -> the screen name used by LOOP and GAME_START.
func _screen_of(scene: Node) -> String:
	return scene.scene_file_path.get_file().get_basename()


func _enter(screen: String) -> void:
	# Read before _end_run bumps the counter, so the trail keeps the screen the
	# first run actually ended on instead of stopping one short of it.
	var first_run := _runs_done == 0

	if not _screen.is_empty():
		_changes += 1
		if not LOOP.has(_screen) or not (screen in LOOP[_screen]):
			_illegal += 1
			_fail("illegal screen change %s -> %s (allowed: %s)"
				% [_screen, screen, ", ".join(LOOP.get(_screen, []))])
			return

	if first_run:
		_first_run_trail.append(screen)

	if not _screen.is_empty():
		# A run ends the moment the player is out of the dungeon, either way.
		if _screen == "combat" and screen == "title":
			_deaths += 1
			_end_run("DEATH in room %d" % Run.room)
		elif screen == "victory":
			_clears += 1
			_end_run("CLEAR, hp %d/%d atk %d" % [Run.hp, Run.max_hp, Run.atk])

	_screen = screen
	_screen_since_ms = Time.get_ticks_msec()
	_pressed_here = false


func _end_run(outcome: String) -> void:
	_runs_done += 1
	print("[play] run %d: %s" % [_runs_done, outcome])
	if _runs_done >= _runs_target:
		_report()


func _press(scene: Node) -> void:
	# One press per visit everywhere except combat, which needs a swing per
	# exchange. Scene changes are deferred, so a second press on a screen that
	# has already acted would reach a node still in the tree and fire its
	# transition twice. Checked before _wanted_key, which has a side effect:
	# asking twice would advance the reward cycle without a press to show.
	if _pressed_here and _screen != "combat":
		return
	var key := _wanted_key(scene)
	if key == KEY_NONE:
		return
	_pressed_here = true
	_send(key)


func _wanted_key(scene: Node) -> int:
	match _screen:
		"title", "dungeon", "victory":
			return KEY_SPACE
		"combat":
			# Stop swinging once the fight is decided: combat.gd waits on a
			# timer before changing scene, and a strike inside that window
			# would resolve the fight a second time.
			var enemy_hp = scene.get("enemy_hp")
			if enemy_hp == null:
				return KEY_NONE
			if int(enemy_hp) <= 0 or not Run.is_alive():
				return KEY_NONE
			return KEY_SPACE
		"reward":
			var key: int = REWARD_KEYS[_reward_i % REWARD_KEYS.size()]
			_reward_i += 1
			return key
	return KEY_NONE


## push_input, not Input.parse_input_event: push_input is synchronous, so the
## screen has already reacted by the time this returns and the next frame sees
## real post-input state instead of a guess.
func _send(keycode: int) -> void:
	var down := InputEventKey.new()
	down.keycode = keycode
	down.physical_keycode = keycode
	down.pressed = true
	get_viewport().push_input(down)

	# Release too, so no key is left logically held down. Every screen ignores
	# releases, so this changes nothing today -- it just keeps a later screen
	# that polls Input from seeing a key stuck down forever.
	var up := InputEventKey.new()
	up.keycode = keycode
	up.physical_keycode = keycode
	up.pressed = false
	get_viewport().push_input(up)


func _fail(reason: String) -> void:
	printerr("[play] FAIL: %s" % reason)
	_report(reason)


func _report(failure: String = "") -> void:
	if _finished:
		return
	_finished = true

	var ok := failure.is_empty() and _illegal == 0 and _runs_done >= _runs_target

	print("")
	print("PLAYTHROUGH  --  %d run(s) requested" % _runs_target)
	print("")
	print("  runs completed      %d" % _runs_done)
	print("  clears              %d" % _clears)
	print("  deaths              %d" % _deaths)
	print("  screen changes      %d" % _changes)
	print("  illegal changes     %d" % _illegal)
	print("")
	print("  first run, screen by screen:")
	print("    %s" % " > ".join(_first_run_trail))
	print("")
	if not failure.is_empty():
		print("  Q1  full run, start -> death or clear      FAIL")
		print("      %s" % failure)
	else:
		print("  Q1  full run, start -> death or clear      PASS")
	# Both endings in one session is not required by Q1 -- which asks for death
	# OR clear -- but seeing only one means half the loop went untested here.
	if ok and (_clears == 0 or _deaths == 0):
		print("")
		print("  NOTE: only one ending occurred in this session (%d clears, %d deaths)."
			% [_clears, _deaths])
		print("        Q1 asks for death OR clear, so this still passes, but the")
		print("        other ending's path was not exercised. Raise PLAY_RUNS.")
	print("")

	get_tree().quit(0 if ok else 1)
