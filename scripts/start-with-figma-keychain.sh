#!/bin/zsh
set -euo pipefail

SERVICE_NAME="writable-mcp-bridge"
ACCOUNT_NAME="figma-access-token"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TOKEN="$(security find-generic-password -a "$ACCOUNT_NAME" -s "$SERVICE_NAME" -w 2>/dev/null || true)"

if [ -z "$TOKEN" ]; then
  echo "No Figma token found in macOS Keychain." >&2
  echo "Run: npm run set:keychain-token -- YOUR_TOKEN" >&2
  exit 1
fi

export FIGMA_ACCESS_TOKEN="$TOKEN"
cd "$PROJECT_ROOT"
exec npm start -- "$@"
