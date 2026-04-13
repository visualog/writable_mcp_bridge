# Xbridge Realtime Channel Ops

Date: 2026-04-13

## Purpose

This note is for external agents and implementation helpers.
It describes the recommended realtime inspection path for Xbridge without requiring anyone to inspect `server.js` for endpoint discovery.

Current transport roles:

- HTTP is the source of truth and final confirmation path.
- SSE is the default realtime hint channel.
- WebSocket is the command-capable streaming channel for the approved inspection subset.
- polling is the fallback for recovery, not the preferred steady-state path.

Use this as the operating order:

1. `GET /health`
2. `GET /api/sessions`
3. `GET /api/pages?pluginId=...`
4. `POST /api/get-metadata`
5. `POST /api/get-component-variant-details`
6. `POST /api/get-instance-details`
7. Interpret fallback and completeness fields before deciding whether the result is implementation-safe

The long-term transport plan is:

1. SSE first
2. WebSocket second

## Recommended Client Behavior

Clients should treat HTTP as the source of truth, SSE as the realtime hint channel, and WebSocket as the streaming command transport when available.

- Start with `GET /health`.
- Resolve the active session with `GET /api/sessions`.
- Use `GET /api/pages` when the target file or page is unclear.
- Read broad structure with `POST /api/get-metadata`.
- Escalate to component-set inspection with `POST /api/get-component-variant-details`.
- Escalate to instance inspection with `POST /api/get-instance-details`.
- Subscribe to SSE when available, but keep the HTTP path working as the fallback confirmation path.
- On SSE reconnect, resume from `Last-Event-ID` when the client and transport support it. Xbridge keeps a bounded recent-event buffer so missed frames can be replayed after reconnect.
- Treat `sequence` as the ordering key for event processing.

If SSE is unavailable, continue using the HTTP read APIs and polling only for recovery. Do not block implementation work on realtime transport availability.

## REST Examples

Use these examples as the canonical request pattern.

```bash
curl -s "$BASE_URL/health"

curl -s "$BASE_URL/api/sessions"

curl -s "$BASE_URL/api/pages?pluginId=$PLUGIN_ID"

curl -s -X POST "$BASE_URL/api/get-metadata" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "targetNodeId": "'"$TARGET_NODE_ID"'",
    "maxDepth": 3
  }'

curl -s -X POST "$BASE_URL/api/get-component-variant-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "targetNodeId": "'"$COMPONENT_NODE_ID"'",
    "includeChildren": true,
    "maxDepth": 2
  }'

curl -s -X POST "$BASE_URL/api/get-instance-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "targetNodeId": "'"$INSTANCE_NODE_ID"'",
    "includeResolvedChildren": true,
    "maxDepth": 2
  }'
```

## SSE Event Contract

The intended SSE endpoint is:

- `GET /api/events`

Optional filters:

- `pluginId`
- `channel`
- `eventTypes`

Each SSE event should carry a small, stable envelope:

- `event`
- `at`
- `sequence`
- `pluginId` when relevant
- `payload`

Example frame:

```text
event: queue.updated
id: 1042
data: {"event":"queue.updated","at":1712995200000,"sequence":1042,"pluginId":"page:817:417","payload":{"pending":3,"running":1}}
```

Initial event families to expect:

- `health.changed`
- `session.registered`
- `session.heartbeat`
- `session.state_changed`
- `queue.updated`
- `command.enqueued`
- `command.delivered`
- `command.completed`
- `command.failed`
- `selection.changed`
- `detail.refreshed`

## Detail Completeness Semantics

`detailCompleteness` is the agent-facing hint for how much of a node or inspection response is authoritative.

Recommended values:

- `full`
- `partial`
- `metadata_fallback`

Meaning:

- `full` means the response is structurally complete enough to implement from without guessing.
- `partial` means the response is useful and structured, but some fields are missing or derived.
- `metadata_fallback` means the bridge fell back to sparse metadata/XML-style output. Use it for orientation, not final implementation decisions.

Related fallback hint:

- `metadata_fallback: true` means the response should be treated as fallback-oriented even if some structured fields are present.

Practical rule:

- If `detailCompleteness` is `full`, the agent can code from it directly.
- If `detailCompleteness` is `partial`, the agent should verify any spacing, variant, or override detail before shipping.
- If `detailCompleteness` is `metadata_fallback`, the agent should use the response to find the right node or page, then re-read through `get-component-variant-details` or `get-instance-details`.

## Stage Path To WebSocket

The WebSocket path should stay staged and conservative.

### Stage 1. SSE Telemetry Only

- ship realtime health, session, queue, and detail refresh events
- keep existing HTTP commands unchanged
- prove the event contract before adding bidirectional transport

### Stage 2. SSE-Backed Client State

- let agents and plugin UI consume SSE for live status updates
- keep polling as a fallback recovery path
- use sequence numbers and replay hints to avoid missed transitions

### Stage 3. Experimental WebSocket Mirror

- introduce WebSocket as an additional transport
- mirror command lifecycle events first
- do not remove HTTP endpoints or SSE

### Stage 4. WebSocket Command Transport

- allow submit/ack/result over one connection
- keep replay, reconnect, and stale-session handling explicit
- only move the plugin runtime if the measured stability is better than HTTP plus fallback polling

## Operational Notes

- Do not depend on `server.js` for endpoint discovery during agent work.
- Use the flow above and the endpoint names in this note.
- Keep HTTP fallback paths intact while realtime transport matures.
- If an event stream or detail response looks stale, re-check `health` and `sessions` before assuming the node data is wrong.
