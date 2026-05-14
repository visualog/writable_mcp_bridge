#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
PORT_VALUE="${PORT:-3850}"

exec env PORT="$PORT_VALUE" \
  node \
  --import "$ROOT_DIR/src/ai-designer-suggestions-loader.mjs" \
  "$ROOT_DIR/src/server.js"
