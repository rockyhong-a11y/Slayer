extends Node
## State of a single run. Reset whenever a run starts or the player dies.

const START_HP := 30
const START_ATK := 6

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

## Enemy stats are a pure function of room number, so balance is readable
## in one place instead of scattered across encounters.
func enemy_hp() -> int:
	return 10 + room * 4

func enemy_atk() -> int:
	return 2 + room
