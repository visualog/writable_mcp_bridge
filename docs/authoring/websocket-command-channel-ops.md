# WebSocket Command Channel Ops

Date: 2026-04-13

## Purpose

This note describes the first command-enabled WebSocket phase for Xbridge.
It is the operator/developer guide for a limited bidirectional transport, not a replacement for HTTP or SSE.

Use this phase to validate whether a small command set can travel safely over WebSocket while the bridge continues to rely on:

- HTTP for source of truth
- SSE for realtime state and lifecycle visibility

## Staged Contract

The command-enabled WebSocket phase should follow this order:

1. connect
2. hello / session bind
3. mirrored lifecycle events
4. read-only command submit
5. ack
6. result
7. disconnect / reconnect / resume

Only after the above is stable should the channel expand beyond inspection-style commands.

## What Remains Authoritative

Keep these authoritative:

- HTTP read and write APIs
- SSE event stream
- plugin session registration and health checks

Treat WebSocket as a transport layer, not as the final source of truth.

Rules:

- if WS and HTTP disagree, HTTP wins
- if WS and SSE disagree on recent activity, SSE wins for realtime context and HTTP wins for final confirmation
- if WS is stale or disconnected, fall back to HTTP/SSE without blocking the workflow

## Supported Commands For Phase 1

Start with low-risk commands that are easy to compare against HTTP:

- `ping`
- `get_selection`
- `get_metadata`
- `get_node_details`

Why these first:

- they are read-only
- they are easy to validate against current HTTP output
- they expose routing, sequencing, and reconnect correctness before any write behavior is allowed

## Failure Handling

Handle these failure modes explicitly:

- stale socket after plugin re-register
- duplicate delivery after reconnect
- out-of-order command events
- session mismatch
- transport drop during command execution
- WS success that does not match HTTP result

Recommended behavior:

- emit explicit failure rather than silent retry
- keep sequence numbers monotonic
- bound replay windows
- mark the channel non-authoritative on mismatch
- recover by re-checking `health` and `sessions` before resending commands

## Safe Live Validation

Validate the command-enabled phase in this order:

1. Confirm `GET /health`.
2. Confirm `GET /api/sessions`.
3. Confirm SSE is still active.
4. Open WS as a secondary channel only.
5. Send one read-only command, starting with `get_selection` or `get_metadata`.
6. Compare the WS result with the HTTP result for the same payload.
7. Disconnect the socket and verify HTTP/SSE still work unchanged.

What to look for:

- the socket connects reliably
- the hello/session bind matches the active plugin session
- command ack/result arrive in order
- reconnect does not duplicate the same command result
- the bridge remains usable when WS is closed

## Staged Rollout

### Stage 1. Read-Only Command Channel

- allow only inspection commands
- keep HTTP and SSE authoritative
- use WS to prove routing and resume behavior

### Stage 2. Narrow Inspection Expansion

- add `get_component_variant_details`
- add `get_instance_details`
- add bounded `search_nodes`

Only expand if Stage 1 remains stable over reconnects.

### Stage 3. Limited Mutation

Consider a few low-risk writes only after inspection stability is proven.

Do not move bulk or destructive write flows into WS first.

## Operational Rule

If the command channel becomes hard to reason about, stop using it as a primary path and revert to the HTTP + SSE workflow for production decisions.

