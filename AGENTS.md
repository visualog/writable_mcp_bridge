# Xbridge Agent Guide

This repo is a local Figma bridge plus agent harness. The goal is to let agents inspect and author Figma files without guessing routes from `src/server.js`.

## Start Here

1. Check server health first: `GET http://127.0.0.1:3846/health`.
2. Confirm `serverVersion`, `transportCapabilities`, and `transportHealth`.
3. Check active sessions only when needed: `GET /api/sessions`.
4. Prefer page discovery before node reads: `GET /api/pages?pluginId=<pluginId>`.
5. Use WS/SSE where available, but keep HTTP polling fallback valid.
6. Read the matching recipe in `docs/agent-recipes/` before editing code.
7. If a route fails, check `docs/troubleshooting/` before opening server internals.

## Common Commands

```bash
npm run start:keychain
curl -s http://127.0.0.1:3846/health
node scripts/agent-preflight.mjs
node scripts/create-xlog-candidate.mjs --title "..."
npm test
node --test tests/session-state-heartbeat-preflight.test.js
node --test tests/websocket-command-channel.integration.test.js
```

## Preferred Inspection Flow

```text
/health -> /api/pages -> target read API -> /api/runtime-ops when debugging
```

Avoid starting with `/api/sessions` for every task. It is useful, but page or node-specific routes are usually faster and less noisy.

## Safety Rules

- Do not revert unrelated dirty files.
- Do not assume `activePlugins` means every Figma file/page is inspectable.
- Do not assume a green plugin UI means every detail API is stable.
- Do not remove HTTP fallback while WS/SSE is still being validated.
- Do not commit `.DS_Store`.

## Change Validation

- Server/API changes: run `node --check src/server.js` and targeted `node --test`.
- Streaming changes: run `node --test tests/websocket-command-channel.integration.test.js tests/ws-events.integration.test.js`.
- Broad changes: run `npm test`.
- Live confidence: run `node scripts/agent-preflight.mjs` against the local server.

## Handoff Format

When passing work to another agent, include:

- `task`
- `context`
- `changedFiles`
- `tests`
- `risks`
- `nextSteps`

Use `docs/handoff/xlink-message-schema.md` for the canonical shape.

For xlog/devlog candidates, use `scripts/create-xlog-candidate.mjs` and the schema in `docs/handoff/xlog-entry-schema.md`.
