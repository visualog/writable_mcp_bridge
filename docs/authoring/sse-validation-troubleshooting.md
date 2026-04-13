# SSE Validation Troubleshooting

Date: 2026-04-13

## Purpose

Use this note when the SSE foundation is live and you need to confirm that the bridge you are testing is the current one, not an older process.

Keep this flow short:

1. Verify the server is healthy.
2. Verify SSE is streaming.
3. Confirm the process behind port `3846` is the latest one.
4. Test `/api/pages` with the active `pluginId` only.

## 1. Verify SSE

The bridge should expose SSE at:

- `GET /api/events`

Quick check:

```bash
curl -N http://127.0.0.1:3846/api/events
```

What to look for:

- the connection stays open
- events arrive without repeated reconnect loops
- event frames include a stable `event`, `sequence`, `at`, and `payload`

If `/health` is green but SSE stays silent, treat that as a transport issue, not a file/content issue.

## 2. Distinguish Old Process From Latest Code

The most common failure is an older bridge process still holding the port.

Check the port owner:

```bash
lsof -ti tcp:3846
```

Interpretation:

- one PID usually means one live bridge process
- multiple PIDs usually means stale processes are still around
- if the PID does not match the process you most recently started, you are likely testing older code

Recommended sanity checks:

```bash
curl -s http://127.0.0.1:3846/health
curl -s http://127.0.0.1:3846/api/sessions
```

Use the newest process only. If you restarted the bridge but SSE or page reads still behave like the old version, assume the old process is still active until proven otherwise.

## 3. Test `/api/pages` Safely

Use `/api/pages` as a discovery call, not as a signal that node details are ready.

Safe pattern:

```bash
curl -s "http://127.0.0.1:3846/api/pages?pluginId=$PLUGIN_ID"
```

Rules:

- use the `pluginId` from `/api/sessions`
- do not guess page ids from memory when the session may have been re-registered
- use the response to confirm the active page list, then move to `get_metadata`, `get_component_variant_details`, or `get_instance_details`
- if the list looks stale, refresh the plugin session before retrying

What not to do:

- do not treat `/api/pages` as a replacement for detail reads
- do not use it without confirming the current `pluginId`
- do not debug page data before verifying that the bridge process is the latest one

## Practical Recovery Pattern

1. Check `/health`.
2. Check `/api/sessions`.
3. Confirm only one current bridge process owns port `3846`.
4. Open SSE with `curl -N /api/events`.
5. Re-run `/api/pages?pluginId=...`.
6. If the result still looks stale, re-register the plugin session and try again.

## Decision Rule

If SSE is alive but `/api/pages` or later reads are stale, the issue is usually:

- wrong `pluginId`
- stale process on port `3846`
- session registration mismatch

Do not escalate to source code inspection until those three checks are done.

