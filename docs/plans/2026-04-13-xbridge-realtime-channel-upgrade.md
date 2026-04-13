# Xbridge Realtime Channel Upgrade Plan

Date: 2026-04-13

## Goal

Upgrade Xbridge from a polling-dominant bridge into a realtime-capable bridge that:

- reduces the gap between `health` and actual read-call stability
- exposes live session, queue, and command lifecycle events
- improves plugin UI responsiveness without removing the current HTTP fallback path
- creates a safe path toward WebSocket-based bidirectional command transport

## Product Decision

Xbridge should adopt:

1. **SSE first**
2. **WebSocket second**

This is intentional.

SSE is the lowest-risk way to add realtime state delivery for:

- bridge health
- session changes
- queue changes
- command lifecycle updates
- selected-node detail refresh hints

WebSocket should be introduced only after SSE-based observability and event contracts are stable.

## Why SSE First

Current Xbridge already has:

- HTTP request entrypoints
- command queueing
- plugin polling via `/plugin/commands`
- plugin result delivery via `/plugin/results`

That means the missing capability is not "transport exists vs does not exist".
The missing capability is "the outside world and plugin UI do not receive state changes as they happen."

SSE solves that with minimal architectural risk.

Benefits:

- keeps existing APIs intact
- adds server-to-client streaming without replacing command endpoints
- makes debugging easier
- reduces the "health looks fine but read path feels unstable" ambiguity

## Why WebSocket Second

WebSocket is the right long-term transport for:

- bidirectional command/result channels
- progress updates
- cancellation
- ack/retry semantics
- future agent-to-bridge interactive sessions

But it has more moving parts:

- connection lifecycle
- reconnect and resume
- session auth and routing
- duplicate delivery protection
- stale connection cleanup

So WebSocket should be layered on after the event model is proven by SSE.

## Phase Plan

### Phase 1. SSE Event Backbone

Add an SSE endpoint such as:

- `GET /api/events`

Optional filters:

- `pluginId`
- `channel`
- `eventTypes`

Initial event types:

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

Done when:

- an external client can subscribe once and receive bridge state changes without polling
- plugin UI can subscribe to event hints for lightweight live refresh

### Phase 2. Plugin UI Realtime Consumption

Update plugin UI to consume SSE when available.

Target behaviors:

- live session status updates
- live queue/health indicator
- selected node detail panel refresh hints
- optional "event stream connected" badge

Fallback:

- if SSE is unavailable, keep current polling behavior

Done when:

- the plugin panel no longer depends only on fixed polling for status freshness

### Phase 3. Event Contract + Reliability Diagnostics

Document and test the event payload contract.

Each event should include:

- `event`
- `at`
- `pluginId` when applicable
- `sequence`
- `payload`

Add:

- monotonic sequence id
- recent event ring buffer
- optional replay via `Last-Event-ID`

Done when:

- clients can detect missed events
- debugging no longer requires reading server internals

### Phase 4. WebSocket Experimental Command Channel

Add a WebSocket endpoint such as:

- `GET /api/ws`

Initial scope:

- external clients only
- command lifecycle mirror
- optional command submit/ack

Do not replace plugin polling yet.

Done when:

- external tools can submit commands and receive ack/progress/result over one channel

### Phase 5. Plugin Transport Upgrade Feasibility

Evaluate whether the Figma plugin itself should move from polling to WebSocket.

Questions to answer:

- Does the plugin runtime keep a stable socket connection?
- How should reconnect/resume work?
- Is WebSocket more stable than `/plugin/commands` polling in practice?

Done when:

- we have a measured decision, not a guess

## Workstream Split

### Workstream A. Architecture and Event Contract

Own:

- new plan docs
- event schema
- channel naming
- sequence/replay semantics

### Workstream B. Server SSE Runtime

Own:

- `src/server.js`
- SSE connection registry
- event broadcasting
- integration with session/queue/command lifecycle

### Workstream C. Plugin UI Integration

Own:

- `figma-plugin/ui.html`
- EventSource hookup
- realtime badges/panels
- graceful fallback to polling

### Workstream D. Tests and Docs

Own:

- SSE integration tests
- event payload fixtures
- agent-facing docs
- README updates

## Acceptance Criteria

### Realtime Baseline

- `/api/events` streams valid SSE frames
- connection remains open while server is healthy
- at least session and command lifecycle events are emitted

### Stability

- health and realtime events agree on recent failure state
- sequence ids are monotonic
- event subscribers do not leak memory after disconnect

### UX

- plugin UI can display live bridge/session status without manual refresh
- selected-node detail panel can refresh based on event hints

### Backward Compatibility

- all current HTTP APIs still work
- if SSE/WebSocket is unavailable, the bridge remains usable through existing polling

## Immediate Next Step

Implement **Phase 1** only:

- SSE endpoint
- event emitter/backbone
- minimal event contract
- tests

Then integrate the plugin UI on top of that.
