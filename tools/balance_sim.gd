extends SceneTree
## Headless balance simulator. Replays the combat and reward rules many times
## and prints the B1..B5 table from docs/DESIGN.md.
##
##   godot --headless --path . --script res://tools/balance_sim.gd
##
## It does not rely on the Run autoload being present -- it loads
## run_state.gd directly and keeps its own instance per simulated run. Every
## number it uses comes from that file, which is the point: tune balance there
## and this table moves with it.
##
## Env:
##   SIM_RUNS  runs per measurement (default 100, the sample size DESIGN names)
##   SIM_SEED  RNG seed (default 1234), so two balance passes are comparable

const RunState := preload("res://scripts/run_state.gd")

const DEFAULT_RUNS := 100
const DEFAULT_SEED := 1234

## A combat that never resolves would hang the loop. Player ATK is far above
## zero today, but a bad tune could change that, and a hang is harder to
## diagnose than a loud failure.
const MAX_EXCHANGES := 1000

## Reward policy meaning "roll one of the three", used for B1..B4.
const POLICY_RANDOM := -1

var _rng := RandomNumberGenerator.new()
var _runaway := false


func _initialize() -> void:
	var runs := DEFAULT_RUNS
	var runs_env := OS.get_environment("SIM_RUNS")
	if runs_env.is_valid_int():
		runs = maxi(1, runs_env.to_int())

	var rng_seed := DEFAULT_SEED
	var seed_env := OS.get_environment("SIM_SEED")
	if seed_env.is_valid_int():
		rng_seed = seed_env.to_int()

	_rng.seed = rng_seed

	var mixed := _measure(runs, POLICY_RANDOM)
	var pure := {}
	pure[RunState.REWARD_MAX_HP] = _measure(runs, RunState.REWARD_MAX_HP)
	pure[RunState.REWARD_ATK] = _measure(runs, RunState.REWARD_ATK)
	pure[RunState.REWARD_HEAL] = _measure(runs, RunState.REWARD_HEAL)

	_report(runs, rng_seed, mixed, pure)
	quit()


## Plays `runs` runs under one reward policy and returns the raw tallies.
func _measure(runs: int, policy: int) -> Dictionary:
	var wins := 0
	var flawless := 0
	var early_deaths := 0
	var death_rooms := 0

	for _i in runs:
		var result := _play_run(policy)
		if result["won"]:
			wins += 1
			if result["flawless"]:
				flawless += 1
		else:
			death_rooms += int(result["room"])
			if int(result["room"]) <= 2:
				early_deaths += 1

	var deaths := runs - wins
	var avg_death_room := 0.0
	if deaths > 0:
		avg_death_room = float(death_rooms) / float(deaths)

	return {
		"runs": runs,
		"wins": wins,
		"flawless": flawless,
		"early_deaths": early_deaths,
		"avg_death_room": avg_death_room,
		"deaths": deaths,
	}


## One run, room 1 until death or clear. Mirrors combat.gd exchange for
## exchange: the player swings first and the enemy only answers if it lives.
func _play_run(policy: int) -> Dictionary:
	var run: RunState = RunState.new()
	run.reset()
	var took_damage := false

	while true:
		var enemy_hp := run.enemy_hp()
		var enemy_atk := run.enemy_atk()

		for _exchange in MAX_EXCHANGES:
			enemy_hp -= run.atk + _rng.randi_range(-RunState.DMG_VARIANCE, RunState.DMG_VARIANCE)
			if enemy_hp <= 0:
				break

			var taken := enemy_atk + _rng.randi_range(-RunState.DMG_VARIANCE, RunState.DMG_VARIANCE)
			run.hp -= taken
			if taken > 0:
				took_damage = true
			if not run.is_alive():
				break

		if enemy_hp > 0 and run.is_alive():
			_runaway = true
			break

		if not run.is_alive():
			var death_room := run.room
			run.free()
			return {"won": false, "room": death_room, "flawless": false}

		var choice := policy
		if choice == POLICY_RANDOM:
			choice = _rng.randi_range(0, 2)
		run.apply_reward(choice)
		run.room += 1

		if run.is_cleared():
			run.free()
			return {"won": true, "room": RunState.ROOMS_PER_RUN, "flawless": not took_damage}

	run.free()
	return {"won": false, "room": 0, "flawless": false}


func _report(runs: int, rng_seed: int, mixed: Dictionary, pure: Dictionary) -> void:
	var win_pct := _pct(int(mixed["wins"]), runs)
	var early_pct := _pct(int(mixed["early_deaths"]), runs)
	var flawless_pct := _pct(int(mixed["flawless"]), runs)
	var avg_death := float(mixed["avg_death_room"])
	var deaths := int(mixed["deaths"])

	var pure_pct := {}
	var top_pure := 0.0
	for choice in pure:
		var pct := _pct(int(pure[choice]["wins"]), runs)
		pure_pct[choice] = pct
		top_pure = maxf(top_pure, pct)

	print("")
	print("BALANCE SIM  --  %d runs per policy, seed %d, %d rooms per run"
		% [runs, rng_seed, RunState.ROOMS_PER_RUN])
	print("start HP %d  ATK %d   enemy HP %d+%dn  ATK %d+n/%d   damage +/-%d"
		% [RunState.START_HP, RunState.START_ATK,
			RunState.ENEMY_HP_BASE, RunState.ENEMY_HP_PER_ROOM,
			RunState.ENEMY_ATK_BASE, RunState.ENEMY_ATK_ROOMS_PER_POINT,
			RunState.DMG_VARIANCE])
	print("")
	print("  #   measure                        value      band           result")
	print("  --------------------------------------------------------------------")
	_row("B1", "clear rate (10 rooms)", "%.1f%%" % win_pct, "30-50%",
		win_pct >= 30.0 and win_pct <= 50.0)
	_row("B2", "avg death room", "%.2f" % avg_death, "5-9",
		deaths > 0 and avg_death >= 5.0 and avg_death <= 9.0)
	_row("B3", "death in room 1-2", "%.1f%%" % early_pct, "< 5%", early_pct < 5.0)
	_row("B4", "flawless clears", "%.1f%%" % flawless_pct, "< 2%", flawless_pct < 2.0)
	_row("B5", "best single-pick clear rate", "%.1f%%" % top_pure, "< 80%", top_pure < 80.0)
	print("")
	print("  B5 detail -- always taking the same reward, %d runs each:" % runs)
	print("    +%d MAX HP : %.1f%%" % [RunState.REWARD_MAX_HP_GAIN, float(pure_pct[RunState.REWARD_MAX_HP])])
	print("    +%d ATK    : %.1f%%" % [RunState.REWARD_ATK_GAIN, float(pure_pct[RunState.REWARD_ATK])])
	print("    HEAL %d    : %.1f%%" % [RunState.REWARD_HEAL_AMOUNT, float(pure_pct[RunState.REWARD_HEAL])])
	print("")
	print("  B2 is averaged over the %d runs that ended in death." % deaths)
	print("  B3 and B4 are shares of all %d runs." % runs)

	if deaths == 0:
		print("")
		print("  NOTE: no run ended in death, so B2 has nothing to average and fails.")
	if _runaway:
		print("")
		print("  ERROR: a combat hit %d exchanges without resolving. Player ATK may be"
			% MAX_EXCHANGES)
		print("         at or below zero. The numbers above are not trustworthy.")
	print("")


func _row(id: String, measure: String, value: String, band: String, passed: bool) -> void:
	print("  %-4s%-30s %-10s %-14s %s" % [id, measure, value, band, "PASS" if passed else "FAIL"])


func _pct(count: int, total: int) -> float:
	return 100.0 * float(count) / float(total)
