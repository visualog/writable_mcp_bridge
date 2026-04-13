# Streaming-First Ops

Date: 2026-04-13

## Purpose

This note explains what became streaming-first in Xbridge, what still falls back to HTTP/polling, and what operators should watch in health and UI when the bridge is live.

Streaming-first means:

- SSE carries realtime state and lifecycle hints first.
- WebSocket is the streaming command channel for the approved inspection path.
- HTTP remains the source of truth for reads and writes.
- polling is a recovery fallback, not the normal operating path.

## What Became Streaming-First

The realtime path now prefers push delivery for:

- health transitions
- session registration and heartbeat changes
- queue activity
- command lifecycle updates
- selected-node refresh hints

The intent is to reduce the delay between bridge state changes and what the user or agent sees.

## What Is Fallback

Fallback stays in place for anything that must keep working when live transport is missing or unstable:

- HTTP read APIs
- HTTP write APIs
- plugin polling only when the live command channel is unavailable or stale
- page discovery through `GET /api/pages`
- metadata/detail reads when SSE or WS is unavailable

Practical rule:

- if live transport is healthy, use SSE first and keep WS as the command-capable secondary path
- if WebSocket fails or becomes stale, fall back to HTTP and polling only for recovery
- if SSE and WS disagree, HTTP remains the final confirmation path

## How WS Failure Falls Back To Polling

When WebSocket is unavailable, disconnected, or non-authoritative:

1. Keep the bridge usable through HTTP.
2. Continue session and command polling through the existing plugin path.
3. Re-check `GET /health` and `GET /api/sessions`.
4. Resume inspection through HTTP endpoints and SSE, then return to WS when the live channel is stable again.

The key behavior is continuity:

- a WS failure should not block command execution
- a WS failure should not invalidate HTTP or SSE reads
- the client should return to polling only for the parts that still need recovery

## What Operators Should Look For

### In Health

Operators should confirm:

- `GET /health` is OK
- `GET /api/sessions` shows the expected plugin session
- realtime events continue to arrive if SSE is enabled
- queue or recovery counters do not climb unexpectedly

### In UI

Operators should look for:

- a visible connected or streaming state
- a fallback or polling indicator when live transport is down
- current session identity matching the open Figma file/page
- last event or last refresh recency
- recovery or re-register status if the bridge was restarted

### In Failure States

Operators should assume a fallback path is active when:

- WS reconnect loops
- SSE stops emitting while HTTP still works
- the plugin reports stale session state
- `/api/pages` or detail reads appear stale until re-register

## Operational Order

Use this order for live validation:

1. Check `GET /health`.
2. Check `GET /api/sessions`.
3. Confirm SSE activity.
4. Try WS only as a secondary channel.
5. If WS fails, use HTTP plus polling without stopping the workflow.

## Decision Rule

If the live transport path makes the system harder to trust than HTTP plus fallback polling, do not force it.
Keep the bridge useful through HTTP and polling, and treat streaming as the default realtime layer rather than a dependency.

## Reproducible Validation Loop

Use this when you want a quick live or semi-live check of the streaming-first path:

```bash
PLUGIN_ID=page:streaming-first-validation \
BASE_URL=http://127.0.0.1:3846 \
node scripts/validate-streaming-first.mjs
```

What it checks:

- `/health` and `/api/runtime-ops` parity
- SSE stream delivery
- WS hello and direct read ACK/RESULT
- plugin command pickup ACK/RESULT
- polling fallback when WS pickup is not acknowledged in time
