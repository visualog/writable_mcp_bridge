# Search Nodes Troubleshooting

## Purpose

This note documents what to do when `search_nodes` behaves intermittently or returns results that are too sparse for implementation work.

The goal is to avoid treating a discovery helper as if it were already a full inspection API.

## Decision Tree

### 1. Is the bridge healthy and is a plugin session active?

- Check `GET /health`.
- Check `GET /api/sessions`.
- If there is no active plugin session, reopen the Figma plugin and re-register the session.

### 2. Is the query too broad for the current session state?

- Narrow the query to the current page or target node.
- Lower `maxDepth`.
- Lower `maxResults`.
- If the future `detailLevel` option is available, lower the detail level to `light` before asking for richer detail.

### 3. Is the current page or selection stale?

- Re-open the correct page in Figma.
- Re-register the plugin session.
- Refresh heartbeat polling before retrying the search.
- If the bridge returns `ERR_PLUGIN_SESSION_STALE` or `ERR_PLUGIN_SESSION_OFFLINE`, treat it as session recovery work, not query tuning.

### 4. Does `search_nodes` still fail on a stable session?

- Treat the result as a bridge issue rather than a user workflow issue.
- Capture `/api/runtime-ops` output.
- Record the plugin id, page id, query, and timeout behavior.
- Escalate to a richer inspection path once it exists.

## Error Contract

- Timeout responses map to `ERR_SEARCH_NODES_TIMEOUT` (HTTP 504).
- Missing selection responses map to `ERR_SELECTION_REQUIRED` (HTTP 409).
- Session preflight errors preserve explicit bridge runtime codes such as `ERR_PLUGIN_SESSION_STALE` and `ERR_PLUGIN_SESSION_OFFLINE`.

## Retry Behavior

- The bridge applies bounded retry with backoff only for transient delivery failures.
- Validation failures (including missing selection) are not retried.

## Practical Recovery Pattern

1. Confirm health and session state.
2. Retry with a smaller search surface.
3. Re-open and re-register if the session looks stale.
4. If the query still fails, stop guessing and move to a more structured read API.

## Notes

- `search_nodes` is useful for discovery.
- It is not a replacement for node-level detail extraction.
- Intermittent failures should be treated as a signal to narrow the search or switch to a more explicit read contract.
