#!/bin/zsh
set -euo pipefail

SERVICE_NAME="writable-mcp-bridge"
ACCOUNT_NAME="figma-access-token"

TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  printf "Paste Figma personal access token: "
  read -rs TOKEN
  printf "\n"
fi

if [ -z "$TOKEN" ]; then
  echo "Figma token is required." >&2
  exit 1
fi

security add-generic-password \
  -a "$ACCOUNT_NAME" \
  -s "$SERVICE_NAME" \
  -w "$TOKEN" \
  -U >/dev/null

echo "Saved Figma token to macOS Keychain (${SERVICE_NAME}/${ACCOUNT_NAME})."
