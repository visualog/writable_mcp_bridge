#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3846}"
PLUGIN_ID="${PLUGIN_ID:-default}"
TARGET_NODE_ID="${TARGET_NODE_ID:-33011:2910}"
VARIANT_NODE_ID="${VARIANT_NODE_ID:-1:43}"
INSTANCE_NODE_ID="${INSTANCE_NODE_ID:-1:779}"

echo "[acceptance] base=${BASE_URL} pluginId=${PLUGIN_ID}"
echo "[acceptance] target=${TARGET_NODE_ID} variant=${VARIANT_NODE_ID} instance=${INSTANCE_NODE_ID}"

post_json() {
  local endpoint="$1"
  local payload="$2"
  curl -sS -X POST "${BASE_URL}${endpoint}" \
    -H 'Content-Type: application/json' \
    -d "${payload}"
}

echo ""
echo "== 0) Health and Session =="
curl -sS "${BASE_URL}/health"
echo ""
curl -sS "${BASE_URL}/api/sessions"
echo ""

echo ""
echo "== 1) /api/get-node-details (targetNodeId) =="
post_json "/api/get-node-details" "{
  \"pluginId\": \"${PLUGIN_ID}\",
  \"targetNodeId\": \"${TARGET_NODE_ID}\",
  \"detailLevel\": \"full\",
  \"includeChildren\": true,
  \"maxDepth\": 3
}"
echo ""

echo ""
echo "== 1b) /api/get-node-details (nodeId alias) =="
post_json "/api/get-node-details" "{
  \"pluginId\": \"${PLUGIN_ID}\",
  \"nodeId\": \"${TARGET_NODE_ID}\",
  \"detailLevel\": \"full\",
  \"includeChildren\": true,
  \"maxDepth\": 3
}"
echo ""

echo ""
echo "== 2) /api/get-component-variant-details (targetNodeId) =="
post_json "/api/get-component-variant-details" "{
  \"pluginId\": \"${PLUGIN_ID}\",
  \"targetNodeId\": \"${VARIANT_NODE_ID}\",
  \"detailLevel\": \"full\",
  \"includeChildren\": true,
  \"maxDepth\": 2
}"
echo ""

echo ""
echo "== 2b) /api/get-component-variant-details (nodeId alias) =="
post_json "/api/get-component-variant-details" "{
  \"pluginId\": \"${PLUGIN_ID}\",
  \"nodeId\": \"${VARIANT_NODE_ID}\",
  \"detailLevel\": \"full\",
  \"includeChildren\": true,
  \"maxDepth\": 2
}"
echo ""

echo ""
echo "== 3) /api/get-instance-details (targetNodeId) =="
post_json "/api/get-instance-details" "{
  \"pluginId\": \"${PLUGIN_ID}\",
  \"targetNodeId\": \"${INSTANCE_NODE_ID}\",
  \"detailLevel\": \"full\",
  \"includeResolvedChildren\": true,
  \"maxDepth\": 2
}"
echo ""

echo ""
echo "== 3b) /api/get-instance-details (nodeId alias) =="
post_json "/api/get-instance-details" "{
  \"pluginId\": \"${PLUGIN_ID}\",
  \"nodeId\": \"${INSTANCE_NODE_ID}\",
  \"detailLevel\": \"full\",
  \"includeResolvedChildren\": true,
  \"maxDepth\": 2
}"
echo ""

echo ""
echo "== Failure Diagnostics =="
echo "[old process alive] lsof -ti tcp:3846"
lsof -ti tcp:3846 || true
echo "[wrong pluginId] curl -sS ${BASE_URL}/api/sessions"
curl -sS "${BASE_URL}/api/sessions"
echo ""
echo "[node missing] run API once with an invalid nodeId to verify explicit error path"
post_json "/api/get-node-details" "{
  \"pluginId\": \"${PLUGIN_ID}\",
  \"targetNodeId\": \"missing:node\",
  \"detailLevel\": \"layout\"
}" || true
echo ""
