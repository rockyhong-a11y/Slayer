#!/usr/bin/env bash
# Playthrough check (DoD Q1): drive the real game with real key presses from
# the title screen to death or a 10-room clear, and fail loudly on anything
# that is not the loop DESIGN 2 describes.
#
#   tools/play.sh            10 runs
#   PLAY_RUNS=30 tools/play.sh
#
# This is not the balance simulator. sim.sh replays the rules in isolation;
# this one plays the actual scenes, so it catches breakage sim.sh cannot see --
# a screen that never routes onward, a transition wired to the wrong scene.
#
# Env:
#   GODOT_BIN    path to the Godot 4 binary (else looked up on PATH)
#   PLAY_RUNS    runs to play (default 10)
#   PLAY_BUDGET  wall-clock budget in seconds (default 300)
#   PLAY_STALL   per-screen hang limit in seconds (default 20)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GODOT="${GODOT_BIN:-}"
if [[ -z "$GODOT" ]]; then
	for candidate in godot godot4 godot-4 Godot; do
		if command -v "$candidate" >/dev/null 2>&1; then
			GODOT="$(command -v "$candidate")"
			break
		fi
	done
fi
if [[ -z "$GODOT" ]]; then
	echo "play: no Godot binary found. Install Godot 4.x or set GODOT_BIN." >&2
	exit 127
fi

export PLAY_RUNS="${PLAY_RUNS:-10}"

# Headless, unlike capture.sh: nothing here reads the rendered frame, and
# push_input reaches the scene tree without a window. Audio is forced to dummy
# for the same reason the other tools do it -- ALSA on a machine with no sound
# card buries real output in errors.
"$GODOT" --headless --audio-driver Dummy --path "$ROOT"
