#!/bin/zsh
set -euo pipefail

SERVICE_NAME="writable-mcp-bridge"
FIGMA_ACCOUNT_NAME="figma-access-token"
AI_KEY_ACCOUNT_NAME="xbridge-ai-api-key"
AI_MODEL_ACCOUNT_NAME="xbridge-ai-model"
AI_BASE_URL_ACCOUNT_NAME="xbridge-ai-base-url"
AI_PROVIDER_ACCOUNT_NAME="xbridge-ai-provider"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

read_keychain_value() {
  local account_name="$1"
  security find-generic-password -a "$account_name" -s "$SERVICE_NAME" -w 2>/dev/null || true
}

TOKEN="$(read_keychain_value "$FIGMA_ACCOUNT_NAME")"

if [ -n "$TOKEN" ]; then
  export FIGMA_ACCESS_TOKEN="$TOKEN"
else
  echo "No Figma token found in macOS Keychain; starting without FIGMA_ACCESS_TOKEN." >&2
  echo "Figma REST account/library endpoints will require: npm run set:keychain-token -- YOUR_TOKEN" >&2
fi
AI_KEY="$(read_keychain_value "$AI_KEY_ACCOUNT_NAME")"
AI_MODEL="$(read_keychain_value "$AI_MODEL_ACCOUNT_NAME")"
AI_BASE_URL="$(read_keychain_value "$AI_BASE_URL_ACCOUNT_NAME")"
AI_PROVIDER="$(read_keychain_value "$AI_PROVIDER_ACCOUNT_NAME")"

if [ -n "$AI_KEY" ]; then
  export XBRIDGE_AI_API_KEY="$AI_KEY"
fi

if [ -n "$AI_MODEL" ]; then
  export XBRIDGE_AI_MODEL="$AI_MODEL"
fi

if [ -n "$AI_BASE_URL" ]; then
  export XBRIDGE_AI_BASE_URL="$AI_BASE_URL"
fi

if [ -n "$AI_PROVIDER" ]; then
  export XBRIDGE_AI_PROVIDER="$AI_PROVIDER"
fi

cd "$PROJECT_ROOT"
exec npm start -- "$@"
