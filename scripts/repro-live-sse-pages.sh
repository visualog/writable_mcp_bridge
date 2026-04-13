#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3846}"
PLUGIN_ID="${PLUGIN_ID:-}"
TARGET_NODE_ID="${TARGET_NODE_ID:-}"

if [[ -z "$PLUGIN_ID" ]]; then
  echo "PLUGIN_ID is required. Example: PLUGIN_ID=page:817:417"
  exit 1
fi

if [[ -z "$TARGET_NODE_ID" ]]; then
  echo "TARGET_NODE_ID is required for metadata check. Example: TARGET_NODE_ID=10:1"
  exit 1
fi

echo "[1/4] health"
curl -sS "${BASE_URL}/health"
echo
echo

echo "[2/4] SSE endpoint responds (first ~2s)"
curl -sS -N --max-time 2 "${BASE_URL}/api/events?pluginId=${PLUGIN_ID}" || true
echo
echo

echo "[3/4] pages endpoint for live pluginId"
curl -sS "${BASE_URL}/api/pages?pluginId=${PLUGIN_ID}"
echo
echo

echo "[4/4] metadata endpoint for live pluginId + target node"
curl -sS -X POST "${BASE_URL}/api/get-metadata" \
  -H 'Content-Type: application/json' \
  -d "{
    \"pluginId\": \"${PLUGIN_ID}\",
    \"targetNodeId\": \"${TARGET_NODE_ID}\",
    \"includeJson\": true,
    \"maxDepth\": 2,
    \"maxNodes\": 80
  }"
echo
