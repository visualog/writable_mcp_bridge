# Xbridge WS Limited Command Channel Plan

Date: 2026-04-13

## Goal

Move Xbridge from an experimental WebSocket mirror into a limited command channel that can safely carry a small set of bidirectional requests without replacing the existing HTTP and SSE paths.

This is a controlled step, not a transport rewrite.

## Scope

The limited WebSocket channel should be used for:

- command submit
- command ack
- command result
- light progress or state hints
- reconnect and replay metadata

It should not yet be used for:

- replacing HTTP as the source of truth
- replacing SSE as the primary realtime observability path
- high-risk write orchestration
- plugin runtime migration

## Authoritative Sources

Keep these authoritative:

- HTTP read and write APIs
- SSE event stream for realtime state and lifecycle visibility
- plugin session registration and health checks through the HTTP bridge

Treat WebSocket as mirrored transport until it proves it can match those sources reliably.

Practical rule:

- if WS disagrees with HTTP, HTTP wins
- if WS disagrees with SSE on recent state, SSE wins for live context and HTTP wins for final confirmation

## Staged Rollout

### Stage 1. Mirror Plus Read-Only Submit

Allow WS to mirror lifecycle events and carry only low-risk command submits.

Recommended first commands:

- `ping`
- `get_selection`
- `get_metadata`
- `get_node_details`

Why these first:

- they are easy to verify against HTTP
- they are low-risk and easy to classify as stale or invalid
- they help validate routing, sequencing, and reconnect behavior before any write-heavy flow

### Stage 2. Narrow Inspection Bundle

Expand to a few more inspection commands once Stage 1 is stable:

- `get_component_variant_details`
- `get_instance_details`
- `search_nodes` with bounded scope and detail level

Only expand if the mirror and HTTP outputs stay aligned across reconnects.

### Stage 3. Limited Mutation Channel

Consider a small write subset only after the inspection path is proven:

- single-node text updates
- safe property updates on a selected instance
- clearly idempotent or easily replayed operations

Do not move bulk or destructive actions into WS first.

### Stage 4. Optional Plugin Runtime Adoption

Only evaluate plugin-side adoption after the command channel is stable and measurable.

At that point, answer whether WS is actually better than polling for the plugin runtime.

## Failure Modes

The limited channel should explicitly handle these cases:

- stale socket after plugin re-register
- duplicate delivery after reconnect
- out-of-order lifecycle frames
- mismatched session id or plugin id
- transport drop during command execution
- WS mirror saying success when HTTP later reports failure

Recommended response behavior:

- prefer explicit failure over silent retry
- preserve sequence numbers
- keep replay bounded
- on mismatch, fall back to HTTP/SSE and mark WS as non-authoritative

## Validation

Validate the limited command channel safely in this order:

1. Confirm `GET /health`.
2. Confirm `GET /api/sessions`.
3. Confirm SSE is still live.
4. Open WS as a secondary channel only.
5. Send one read-only command.
6. Compare WS result to the same HTTP result.
7. Drop the socket and confirm HTTP/SSE still work unchanged.

## Exit Criteria

The limited channel is ready to keep only if:

- it routes the first read-only commands reliably
- it survives reconnect without duplicating results
- it stays aligned with HTTP and SSE on session identity and command status

If those conditions are not met, keep WS in mirror-only mode and continue using HTTP/SSE as the primary paths.

