# WebSocket Stage 2 Inspection Expansion

Date: 2026-04-13

## Purpose

This note documents the second WebSocket phase for Xbridge.
It expands the channel from read-only command routing into a broader inspection bundle while keeping HTTP and SSE authoritative.

The goal is not to make WebSocket primary.
The goal is to prove that a slightly richer inspection set can stay in sync with the current bridge behavior.

## Enabled Inspection Commands

Stage 2 should include these commands over WebSocket:

- `get_selection`
- `get_metadata`
- `get_node_details`
- `get_component_variant_details`
- `get_instance_details`
- `search_nodes` with bounded scope and explicit `detailLevel`

Keep the Stage 1 commands active:

- `ping`

## What Remains Authoritative

Keep these as the source of truth:

- HTTP read and write APIs
- SSE for realtime state and lifecycle visibility
- plugin session registration and health status through the HTTP bridge

WebSocket remains a transport mirror for inspection.

Rules:

- if WS and HTTP disagree, HTTP wins
- if WS and SSE disagree on recent activity, SSE wins for live context and HTTP wins for final confirmation
- if WS becomes stale after reconnect, re-check `health` and `sessions` before trusting it again

## Safe Comparison Pattern

Compare WebSocket against HTTP in a controlled way:

1. Use the same `pluginId` and `targetNodeId` for both paths.
2. Run the WebSocket command first for inspection.
3. Run the equivalent HTTP request immediately after.
4. Compare only the fields that are expected to match.
5. Treat any layout, variant, or instance mismatch as a reason to fall back to HTTP/SSE.

What to compare:

- node identity
- visibility
- geometry
- layout fields
- variant properties
- component property definitions
- child ordering
- child visibility

What not to compare too aggressively:

- timing jitter
- transient connection metadata
- event timestamps

## Failure Handling

Stage 2 should explicitly handle:

- stale socket after plugin re-register
- duplicate delivery after reconnect
- out-of-order responses
- mismatched session id or plugin id
- partial `search_nodes` results
- detail responses that fall back to sparse metadata

Recommended response behavior:

- prefer explicit failure over silent retry
- preserve sequence numbers
- keep replay bounded
- mark the channel non-authoritative on mismatch
- use HTTP/SSE to recover the current truth before resending

## Before Any Mutation Channel Is Considered

Do not move to mutation over WebSocket until all of these are true:

- the Stage 2 inspection bundle stays aligned with HTTP across reconnects
- `get_node_details`, `get_component_variant_details`, and `get_instance_details` are stable on real designs
- `search_nodes` remains bounded and predictable
- SSE still agrees with current session and queue state
- reconnect does not duplicate inspection results
- the team can explain which fields are authoritative versus mirrored without ambiguity

If any of those conditions fail, keep WebSocket inspection-only and continue to use HTTP plus SSE as the operational truth.

## Exit Criteria

Stage 2 is successful when:

- the expanded inspection bundle can be used for real implementation work
- HTTP remains the final confirmation path
- SSE continues to provide live health and lifecycle visibility
- no mutation semantics are implied yet

