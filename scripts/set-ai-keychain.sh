#!/bin/zsh
set -euo pipefail

SERVICE_NAME="writable-mcp-bridge"
AI_KEY_ACCOUNT_NAME="xbridge-ai-api-key"
AI_MODEL_ACCOUNT_NAME="xbridge-ai-model"
AI_BASE_URL_ACCOUNT_NAME="xbridge-ai-base-url"
AI_PROVIDER_ACCOUNT_NAME="xbridge-ai-provider"

API_KEY="${1:-}"
MODEL="${2:-${XBRIDGE_AI_MODEL:-${OPENAI_MODEL:-nvidia/nemotron-3-nano-30b-a3b}}}"
BASE_URL="${3:-${XBRIDGE_AI_BASE_URL:-${OPENAI_BASE_URL:-https://integrate.api.nvidia.com/v1}}}"
PROVIDER="${4:-${XBRIDGE_AI_PROVIDER:-nvidia}}"

if [ -z "$API_KEY" ]; then
  printf "Paste AI API key: "
  read -rs API_KEY
  printf "\n"
fi

if [ -z "$API_KEY" ]; then
  echo "AI API key is required." >&2
  exit 1
fi

security add-generic-password \
  -a "$AI_KEY_ACCOUNT_NAME" \
  -s "$SERVICE_NAME" \
  -w "$API_KEY" \
  -U >/dev/null

security add-generic-password \
  -a "$AI_MODEL_ACCOUNT_NAME" \
  -s "$SERVICE_NAME" \
  -w "$MODEL" \
  -U >/dev/null

security add-generic-password \
  -a "$AI_BASE_URL_ACCOUNT_NAME" \
  -s "$SERVICE_NAME" \
  -w "$BASE_URL" \
  -U >/dev/null

security add-generic-password \
  -a "$AI_PROVIDER_ACCOUNT_NAME" \
  -s "$SERVICE_NAME" \
  -w "$PROVIDER" \
  -U >/dev/null

echo "Saved AI settings to macOS Keychain (${SERVICE_NAME}/${AI_KEY_ACCOUNT_NAME})."
echo "Model: ${MODEL}"
echo "Base URL: ${BASE_URL}"
echo "Provider: ${PROVIDER}"
