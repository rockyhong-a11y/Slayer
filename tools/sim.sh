#!/usr/bin/env bash
# Balance simulator: replay the rules headlessly and print the B1..B5 table.
#
#   tools/sim.sh            100 runs per policy (the sample size DESIGN names)
#   SIM_RUNS=1000 tools/sim.sh
#
# A wrapper, not a convenience: it resolves Godot the same way capture.sh does,
# and gives the loop one fixed command to run instead of an invocation that
# embeds a machine-specific binary path.
#
# Env:
#   GODOT_BIN  path to the Godot 4 binary (else looked up on PATH)
#   SIM_RUNS   runs per measurement (default 100)
#   SIM_SEED   RNG seed (default 1234)
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
	echo "sim: no Godot binary found. Install Godot 4.x or set GODOT_BIN." >&2
	exit 127
fi

# No window needed, so no xvfb: the simulator never touches the renderer.
# Audio is forced to dummy for the same reason capture.sh does it -- ALSA on a
# machine with no sound card buries the output in errors.
"$GODOT" --headless --audio-driver Dummy --path "$ROOT" \
	--script res://tools/balance_sim.gd
