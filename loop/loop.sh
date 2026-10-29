#!/usr/bin/env bash
# Run Claude Code headlessly, forever, one fresh session per iteration.
#
# No --continue on purpose: every iteration starts with no memory. All state
# lives in docs/DESIGN.md, docs/STATUS.md and docs/feedback/INBOX.md, so a
# session that cannot remember is forced to write down what the next one needs.
#
#   loop/loop.sh            start looping
#   touch loop/STOP         stop after the current iteration finishes
#
# Env:
#   CLAUDE_BIN    claude executable (default: claude)
#   CLAUDE_ARGS   extra flags for claude (default: --permission-mode acceptEdits)
#   LOOP_SLEEP    seconds between iterations (default: 5)
#   LOOP_MAX      stop after N iterations (default: 0 = unlimited)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STOP_FILE="$ROOT/loop/STOP"
PROMPT_FILE="$ROOT/loop/PROMPT.md"
LOG_DIR="$ROOT/loop/logs"

CLAUDE_BIN="${CLAUDE_BIN:-claude}"
CLAUDE_ARGS="${CLAUDE_ARGS:---permission-mode acceptEdits}"
LOOP_SLEEP="${LOOP_SLEEP:-5}"
LOOP_MAX="${LOOP_MAX:-0}"

if ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
	echo "loop: '$CLAUDE_BIN' not found. Install Claude Code or set CLAUDE_BIN." >&2
	exit 127
fi
if [[ ! -f "$PROMPT_FILE" ]]; then
	echo "loop: missing $PROMPT_FILE" >&2
	exit 1
fi

mkdir -p "$LOG_DIR"
# Leftover STOP from a previous run would stop this one before it starts.
if [[ -f "$STOP_FILE" ]]; then
	echo "loop: removing stale $STOP_FILE"
	rm -f "$STOP_FILE"
fi

trap 'echo; echo "loop: interrupted."; exit 130' INT TERM

iter=0
while true; do
	if [[ -f "$STOP_FILE" ]]; then
		echo "loop: STOP file found. Stopping after $iter iteration(s)."
		[[ -s "$STOP_FILE" ]] && { echo "loop: reason ->"; cat "$STOP_FILE"; }
		break
	fi
	if (( LOOP_MAX > 0 && iter >= LOOP_MAX )); then
		echo "loop: reached LOOP_MAX=$LOOP_MAX. Stopping."
		break
	fi

	iter=$((iter + 1))
	log="$LOG_DIR/iter-$(printf '%04d' "$iter").log"
	echo "=== iteration $iter  $(date -u '+%Y-%m-%dT%H:%M:%SZ')  -> $log"

	cd "$ROOT"
	# shellcheck disable=SC2086
	"$CLAUDE_BIN" -p "$(cat "$PROMPT_FILE")" $CLAUDE_ARGS 2>&1 | tee "$log"
	status=${PIPESTATUS[0]}
	echo "=== iteration $iter finished (exit $status)"

	# A crash is not a reason to spin: back off before trying again.
	if (( status != 0 )); then
		echo "loop: non-zero exit, backing off 30s"
		sleep 30
	else
		sleep "$LOOP_SLEEP"
	fi
done
