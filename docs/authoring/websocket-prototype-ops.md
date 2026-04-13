# WebSocket Prototype Ops

Date: 2026-04-13

## Purpose

This note is for the experimental WebSocket phase of Xbridge.
It is intentionally narrow:

- describe what the prototype is for
- explain how it differs from SSE
- define what is mirrored versus authoritative
- show how to validate it safely without depending on it for production behavior

The recommended architecture remains:

1. SSE for realtime state delivery
2. WebSocket later for bidirectional command transport

## What The Prototype Is For

The WebSocket prototype is a transport experiment, not a new source of truth.
It should help us answer whether a single bidirectional channel can eventually carry:

- command submit
- command ack
- command result
- progress updates
- replay or resume hints

It exists to de-risk the future transport path, not to replace the current HTTP and SSE flows.

## How It Differs From SSE

SSE is server-to-client only and is the primary realtime observability channel.
WebSocket is bidirectional and should stay experimental until the event model is already stable.

Use the distinction like this:

- SSE = live status, session, queue, and detail refresh hints
- WebSocket = possible future command transport and interactive session mirror

If a client only needs to know "what changed," SSE is the right channel.
If a client needs to send a command and get an ack/result on one connection, that is the WebSocket experiment.

## Mirrored Versus Authoritative

Treat the following as authoritative:

- HTTP read APIs
- plugin session state registered in the bridge
- command execution results that are already persisted or returned by the current bridge path

Treat the following as mirrored:

- WebSocket command lifecycle events
- live progress updates
- connection state and reconnect hints
- replay metadata

Practical rule:

- if WebSocket and HTTP disagree, HTTP wins
- if WebSocket and SSE disagree on recent activity, use SSE for realtime context and HTTP for final confirmation

## Safe Validation

Validate the prototype in a way that cannot break existing workflows:

1. Confirm the bridge is healthy with `GET /health`.
2. Confirm the active session with `GET /api/sessions`.
3. Confirm SSE still works before testing WebSocket.
4. Open the WebSocket prototype only as a secondary channel.
5. Compare mirrored events against the HTTP result for the same command.
6. Close the socket and verify the HTTP path still works unchanged.

Validation should answer three questions:

- Does the socket connect reliably?
- Do mirrored lifecycle events match HTTP outcomes?
- Can the bridge recover cleanly when the socket is dropped?

## What To Avoid

- Do not remove or bypass HTTP endpoints.
- Do not treat the WebSocket prototype as production authoritative.
- Do not require plugin UI changes before transport behavior is proven.
- Do not debug transport issues by reading source code first; validate the channel contract and compare it with HTTP/SSE output.

## Exit Criteria

The prototype is useful only if it proves one of these:

- a single connection can safely mirror command lifecycle state
- reconnect/resume behavior is stable enough to measure
- the future command transport path is clearly better than polling for some workflows

If those are not true, keep SSE and HTTP as the primary paths.

