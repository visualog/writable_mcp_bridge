# Streaming-First Soak Ops

Date: 2026-04-14

## Purpose

This note describes the longer-running soak validation loop for Xbridge streaming-first transport.
Use it after the short smoke check passes and you want to confirm the live path stays stable across repeated runs.

Soak validation is meant to answer:

- does SSE remain connected across repeated validation cycles?
- does WebSocket hello / direct read / plugin pickup stay stable?
- do health and runtime parity stay aligned over time?
- do late runs regress even when the first run looks good?

## Recommended Validation Order

1. Check `GET /health`.
2. Check `GET /api/sessions`.
3. Run the short streaming-first smoke validator once.
4. Run the soak validator for multiple iterations.
5. Inspect the first failing run, not just the final exit code.
6. Re-run with a smaller iteration count if you need a quick repro.

## Soak Command

Use the soak runner directly with a profile preset:

```bash
BASE_URL=http://127.0.0.1:3846 \
node scripts/validate-streaming-first-soak.mjs --profile=standard
```

Available profiles:

- `quick` for CI and local sanity checks, usually 2 iterations with no delay
- `standard` for everyday soak validation, usually 20 iterations with short spacing
- `long` for deeper confidence runs, usually 50 iterations with a wider spacing window

Use `standard` as the preflight pass before a long live run. If the standard pass fails immediately on every iteration, restart the local Xbridge server from the latest code before spending time on `long`.

## Long Soak Run

Use the long preset when you want to validate stability over a longer live window:

```bash
BASE_URL=http://127.0.0.1:3846 \
node scripts/validate-streaming-first-soak.mjs --profile=long
```

Recommended long-run flow:

1. Confirm `GET /health` and `GET /api/sessions` are healthy.
2. Run the short streaming-first validator once.
3. Run `standard` soak and confirm the live server is on the latest code.
4. Start `long` only after the standard pass is clean.
5. Keep the server session undisturbed while the run is active.
6. Save the JSON summary and the console iteration lines together.
7. Inspect the first failing iteration before changing transport code.

If you need a deterministic capture for later review, redirect the JSON summary and stderr iteration log into a dated log file while keeping the command itself unchanged.

If you want the run to stop on the first failure:

```bash
BASE_URL=http://127.0.0.1:3846 \
node scripts/validate-streaming-first-soak.mjs --profile=quick --fail-fast=true
```

## What The Soak Runner Checks

Each iteration reuses the short streaming-first validator and records:

- `/health` and `/api/runtime-ops` parity
- SSE connection and first event delivery
- WebSocket hello and direct read ACK / RESULT
- plugin command pickup stability
- fallback behavior when the pickup path is delayed

The final JSON summary includes:

- the selected profile, if any
- pass / fail counts
- the completed iteration count
- min / max / average iteration duration
- requested and effective concurrency, plus the highest in-flight run count observed
- total inter-iteration delay spent waiting
- per-run resource snapshots from the short validator, including memory and active handle counts
- the first failing iteration, if any
- a trimmed failure list for quick triage

If you need to tune a preset without losing the profile baseline, pass explicit overrides after the profile, for example `--profile=standard --iterations=30`.

## Long Soak Checklist

Before you start:

- latest server restart confirmed
- `standard` soak already passed
- live `BASE_URL` is correct
- no stale local process is shadowing the intended server
- shell session has enough time to leave the run untouched

During the run:

- watch the iteration lines for the first failure
- note whether failures are immediate or begin after several clean passes
- verify the iteration count reaches the expected `long` total
- keep the console output and JSON summary together

After the run:

- record pass / fail counts
- record min / max / average iteration duration
- record total delay and observed max in-flight count
- record resource peaks if they moved noticeably from `standard`
- classify any failure as immediate, intermittent, or late-run

## Log Template

Use the matching template note for a fill-in record of a future long soak:

- [Streaming-First Long Soak Log Template](./streaming-first-soak-log-template.md)

## What Operators Should Watch

- repeated reconnect loops
- increasing iteration duration over time
- missing SSE frames after a stable first run
- WebSocket hello arriving but read ACK / RESULT missing
- health and runtime parity drifting apart
- failure only appearing after several clean iterations

## Recovery Rules

- If the soak runner fails once, inspect the failing iteration before changing the code.
- If the failure looks transient, re-run with `--profile=quick --fail-fast=true`.
- If the failure repeats, treat it as a transport regression rather than a one-off glitch.
- Keep HTTP and SSE as the confirmation path while investigating soak failures.
