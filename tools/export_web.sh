#!/usr/bin/env bash
# Export the game as a browser build (Godot Web / HTML5).
#
#   tools/export_web.sh [output_dir]       default: build/web
#
# The result is a static directory: serve it over HTTP and the game runs in a
# browser. file:// does not work -- the engine fetches its own wasm.
#
# The preset uses the single-threaded template on purpose, so the build needs
# no COOP/COEP cross-origin isolation headers and works on any plain static
# host, GitHub Pages included.
#
# Env:
#   GODOT_BIN  path to the Godot 4 binary (else looked up on PATH)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/build/web}"

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
	echo "export_web: no Godot binary found. Install Godot 4.x or set GODOT_BIN." >&2
	exit 127
fi

# Export templates are a separate ~1GB download from the engine itself, and
# the export fails with an unhelpful message when they are missing.
TPL_DIR="${HOME}/.local/share/godot/export_templates/4.3.stable"
if [[ ! -f "$TPL_DIR/web_nothreads_release.zip" ]]; then
	echo "export_web: missing web export template." >&2
	echo "  expected: $TPL_DIR/web_nothreads_release.zip" >&2
	echo "  see README 'web build' for how to install it." >&2
	exit 1
fi

mkdir -p "$OUT"
"$GODOT" --headless --import --path "$ROOT" >/dev/null 2>&1 || true
"$GODOT" --headless --audio-driver Dummy --path "$ROOT" \
	--export-release "Web" "$OUT/index.html"

if [[ ! -s "$OUT/index.wasm" ]]; then
	echo "export_web: export ran but produced no wasm in $OUT" >&2
	exit 1
fi
echo "$OUT"
du -sh "$OUT"
