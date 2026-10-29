#!/usr/bin/env bash
# Visual QA capture: open a real window, screenshot one screen, close.
#
#   tools/capture.sh [screen] [output.png]
#
#   screen   value for GAME_START (title|dungeon|combat|reward|victory). Default: title
#   output   PNG path. Default: qa_shots/<screen>.png
#
# Env:
#   GODOT_BIN  path to the Godot 4 binary (else looked up on PATH)
#
# Audio is forced to the dummy driver: a machine with no sound card makes ALSA
# spew errors that would otherwise drown out real ones in the capture log.
#   QA_FRAME   frames to wait before capturing (default 90, see qa_capture.gd)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCREEN="${1:-title}"
OUT="${2:-$ROOT/qa_shots/$SCREEN.png}"

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
	echo "capture: no Godot binary found. Install Godot 4.x or set GODOT_BIN." >&2
	exit 127
fi

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

# A headless import once, so the first windowed run does not spend its frames
# importing resources (which would capture a half-built screen).
"$GODOT" --headless --import --path "$ROOT" >/dev/null 2>&1 || true

# The capture needs a real window. Without a display, rent a virtual one.
RUNNER=()
if [[ -z "${DISPLAY:-}" ]]; then
	if ! command -v xvfb-run >/dev/null 2>&1; then
		echo "capture: no DISPLAY and no xvfb-run. Install xvfb or run with a desktop." >&2
		exit 127
	fi
	RUNNER=(xvfb-run -a -s "-screen 0 1280x720x24")
fi

GAME_START="$SCREEN" QA_SHOT="$OUT" "${RUNNER[@]}" \
	"$GODOT" --path "$ROOT" --resolution 960x540 --audio-driver Dummy

if [[ ! -s "$OUT" ]]; then
	echo "capture: ran but produced no PNG at $OUT" >&2
	exit 1
fi
echo "$OUT"
