extends Node
## State of a single run. Reset whenever a run starts or the player dies.

const START_HP := 27
const START_ATK := 6

## Rooms to survive for a win. Reaching room ROOMS_PER_RUN + 1 clears the run.
const ROOMS_PER_RUN := 10

## Damage rolls as base + randi_range(-DMG_VARIANCE, DMG_VARIANCE).
const DMG_VARIANCE := 1

## Reward deltas. Indexed by REWARD_* below so the simulator and the reward
## screen cannot drift apart.
const REWARD_MAX_HP := 0
const REWARD_ATK := 1
const REWARD_HEAL := 2

const REWARD_MAX_HP_GAIN := 8
const REWARD_MAX_HP_HEAL := 8
const REWARD_ATK_GAIN := 2
const REWARD_HEAL_AMOUNT := 12

var max_hp := START_HP
var hp := START_HP
var atk := START_ATK
var room := 1

func reset() -> void:
	max_hp = START_HP
	hp = START_HP
	atk = START_ATK
	room = 1

func is_alive() -> bool:
	return hp > 0

## True once the player has taken the reward for the last room.
func is_cleared() -> bool:
	return room > ROOMS_PER_RUN

## Applied by the reward screen and by the balance simulator alike, so a
## balance tweak here changes both at once.
func apply_reward(choice: int) -> void:
	match choice:
		REWARD_MAX_HP:
			max_hp += REWARD_MAX_HP_GAIN
			hp = mini(max_hp, hp + REWARD_MAX_HP_HEAL)
		REWARD_ATK:
			atk += REWARD_ATK_GAIN
		REWARD_HEAL:
			hp = mini(max_hp, hp + REWARD_HEAL_AMOUNT)

## Enemy growth per room. HP is tuned to keep a fight around three exchanges
## at every room number, so the ramp the player actually feels is the enemy's
## ATK -- the damage taken per fight -- rather than the fight getting longer.
const ENEMY_HP_BASE := 12
const ENEMY_HP_PER_ROOM := 2
const ENEMY_ATK_BASE := 3
const ENEMY_ATK_ROOMS_PER_POINT := 4

## Enemy stats are a pure function of room number, so balance is readable
## in one place instead of scattered across encounters.
func enemy_hp() -> int:
	return ENEMY_HP_BASE + room * ENEMY_HP_PER_ROOM

func enemy_atk() -> int:
	return ENEMY_ATK_BASE + floori(float(room) / float(ENEMY_ATK_ROOMS_PER_POINT))
