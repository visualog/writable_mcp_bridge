# Streaming-First Ops

Date: 2026-04-16

## Purpose

This note explains what became streaming-first in Xbridge, what still falls back to HTTP/polling, and which health, runtime, and plugin UI signals matter most when the bridge is live.

Streaming-first means:

- SSE carries realtime state and lifecycle hints first.
- WebSocket is the streaming command channel for the approved inspection path.
- HTTP remains the source of truth for reads and writes.
- polling is a recovery fallback, not the normal operating path.

As of the current streaming-first rollout, operators should read the bridge in this order:

- `activeSessionResolution` answers "which plugin session is authoritative right now?"
- `commandReadiness` answers "is the command path actually ready, not just connected?"
- `transportHealth` answers "is fallback pressure low enough that streaming is still the primary path?"
- `/plugin/commands.queue.pollingFallbackMode` answers "is polling intentionally blocked because streaming is healthy?"

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
- plugin polling only when the live command channel is unavailable, stale, or explicitly in recovery
- page discovery through `GET /api/pages`
- metadata/detail reads when SSE or WS is unavailable

Practical rule:

- if live transport is healthy, use SSE first and keep WS as the command-capable secondary path
- if WebSocket fails or becomes stale, fall back to HTTP and polling only for recovery
- if SSE and WS disagree, HTTP remains the final confirmation path

`POLLING_FALLBACK_MODE=recovery_only` is now the important operator default:

- ready WS + live session can intentionally block polling delivery even when commands are queued
- that block is observable through `queue.pollingFallbackMode.blocked`, `queue.pollingFallbackMode.reason`, and `queue.deferredByPolicyBlock`
- a blocked polling path is healthy if command readiness is `ready` and WS acknowledgements continue to arrive
- a blocked polling path is unhealthy if readiness degrades, recent expirations appear, or WS ack/result counters stall

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
- `GET /health` reports the expected `serverVersion` and transport capability flags for the current build
- `GET /health` includes `activeSessionResolution` so the active route is explicit when more than one plugin session exists
- `GET /health` includes `commandReadiness` so "connected" and "command ready" are not confused
- `GET /health` includes `transportHealth` with active SSE/WS counts, recent ack/result/fallback counts, fallback rate/pressure, trend status, and a grade
- `GET /api/sessions` shows the expected plugin session
- `GET /api/runtime-ops` mirrors the same session/transport state and adds queue-level policy diagnostics
- realtime events continue to arrive if SSE is enabled
- queue or recovery counters do not climb unexpectedly

Priority fields to read in `/health` or `/api/runtime-ops`:

- `activeSessionResolution.status|primaryPluginId|summary`
- `commandReadiness.status|reason|summary`
- `commandReadiness.timingBottleneckStage|timingBottleneckDurationMs|timingLagThresholdMs`
- `transportHealth.fallbackPressureRate`
- `transportHealth.fallbackIncidenceTrend.status`
- `transportHealth.counters.pollingDeferredByWsGuardTotal|pollingDeferredByReadyCapTotal|pollingDeferredByPolicyBlockTotal`

### In UI

Operators should look for:

- a visible connected or streaming state
- a fallback or polling indicator when live transport is down
- current session identity matching the open Figma file/page
- last event or last refresh recency
- recovery or re-register status if the bridge was restarted
- lifecycle/timeline hints that show whether lag is happening before dispatch, before ack, or near timeout

Quick interpretation labels:

- `fallback risk: stable` means fallback pressure is currently low
- `fallback risk: watch` means fallback incidence is rising and needs closer tracking
- `fallback risk: high` means polling fallback pressure is high and WS/session recovery checks should be immediate
- `readiness risk: stable/watch/high` maps command readiness into an immediate action priority
- `operational state` is shown as `connected/disconnected · command-ready/not-ready · healthy/degraded`
- `fallback phase: recovery` means fallback is currently a recovery path
- `fallback phase: outage` means fallback pressure is likely part of an active incident and needs immediate checks
- `deferred by class` shows how many fallback candidates are held by policy (`critical/standard/detail`)
- `deferred by tuning` shows whether guard is base, queue-pressure, or near-timeout driven
- `polling mode` shows fallback policy mode (`legacy` or `recovery_only`) and whether ready-state fallback is currently blocked
- `deferred by policy block` indicates how many polling candidates were intentionally held back by recovery-only policy
- `ready fallback cap` indicates whether ready-state polling delivery was rate-limited instead of fully blocked
- `lifecycle status` summarizes recent command completion/expiration mix
- `timeline tail` is the fastest way to spot whether lag is happening at enqueue, dispatch, ack, or complete

### In Failure States

Operators should assume a fallback path is active when:

- WS reconnect loops
- SSE stops emitting while HTTP still works
- the plugin reports stale session state
- `/api/pages` or detail reads appear stale until re-register

Operators should assume the system is in a streaming-but-degraded state when:

- WS is still connected but `commandReadiness.status` is `degraded`
- `queue.pollingFallbackMode.blocked` is true while `commandReadiness.recentExpiredCommand` is also true
- `transportHealth.fallbackIncidenceTrend.status` moves from `stable` to `watch` or `high`
- `commandReadiness.reason` shifts to `queue_dispatch_ack_lag`, `pending_recovery`, or another non-ready state

## Operational Order

Use this order for live validation:

1. Check `GET /health`.
2. Check `GET /api/sessions`.
3. Check `GET /api/runtime-ops` for `transportHealth`, `activeSessionResolution`, `commandReadiness`, and queue policy diagnostics.
4. Confirm SSE activity.
5. Try WS only as a secondary channel.
6. If WS fails, use HTTP plus polling without stopping the workflow.

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
- policy-aware fallback behavior so `recovery_only` mode does not register a false failure when polling was intentionally blocked

For longer-running confidence checks, use the soak note:

- [Streaming-First Soak Ops](./streaming-first-soak-ops.md)
