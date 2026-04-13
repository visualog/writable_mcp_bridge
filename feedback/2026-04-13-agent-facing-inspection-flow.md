# Agent-Facing Figma Inspection Flow

Date: 2026-04-13

## Purpose

This guide is for external coding agents that need to inspect a live Figma file through Xbridge.

Do not open `server.js` to guess endpoint names. Use the flow below.

## Recommended Flow

### 1. Check Bridge Health

Use `/health` first.

```bash
curl -s http://127.0.0.1:3846/health
```

Read these fields:

- `ok`
- `activePlugins`
- `currentReadHealth`
- `recentFailedTotal`
- `lastFailureCommand`
- `observability.queue.historicalFailedTotal`

Interpretation:

- `currentReadHealth: "healthy"` means no recent read failures in the active window.
- `recentFailedTotal` is the recent-window failure count.
- `historicalFailedTotal` is cumulative history and can be non-zero even when the bridge is currently healthy.

### 2. Resolve The Active Session

If you already know the `pluginId`, use it directly.

If not, call:

```bash
curl -s http://127.0.0.1:3846/api/sessions
```

Prefer a live session from the target file/page.

Useful fields:

- `pluginId`
- `state`
- `fileName`
- `pageName`
- `pageId`
- `lastSeenAt`

### 3. List Pages When Cross-Page Discovery Is Needed

```bash
curl -s "http://127.0.0.1:3846/api/pages?pluginId=page:4814:2634"
```

Use this when the current page is empty or the target component is likely on another page.

### 4. Read Broad Structure With Metadata

Use metadata for broad discovery and fallback inspection.

```bash
curl -s --json '{
  "pluginId": "page:4814:2634",
  "targetNodeId": "1:43",
  "includeJson": true
}' http://127.0.0.1:3846/api/get-metadata
```

Use this to identify:

- rough hierarchy
- node ids
- page/file context
- XML summary
- structured JSON tree when `includeJson` is enabled

### 5. Inspect Component Sets With Component Variant Details

Use this for component sets and variant families.

```bash
curl -s --json '{
  "pluginId": "page:4814:2634",
  "targetNodeId": "1:43",
  "includeChildren": true,
  "maxDepth": 3
}' http://127.0.0.1:3846/api/get-component-variant-details
```

Use this to read:

- component set identity
- variant axes
- `componentPropertyDefinitions`
- variants
- variant child visibility
- layout fields per variant

Important:

- `componentPropertyDefinitions` should be treated as authoritative when read from the `COMPONENT_SET`.
- Variant components can expose local detail, but the set-level definitions are the stable contract.

### 6. Inspect Live Usage With Instance Details

Use this for actual instances placed in a design.

```bash
curl -s --json '{
  "pluginId": "page:4814:2634",
  "targetNodeId": "2:203",
  "includeResolvedChildren": true
}' http://127.0.0.1:3846/api/get-instance-details
```

Use this to read:

- instance id/name/type
- source component
- source component set
- current `variantProperties`
- current `componentProperties`
- layout mode
- gap and padding
- resolved children when requested

### 7. Read Single Node Details

Use this when you know the exact node and need implementation fields.

```bash
curl -s --json '{
  "pluginId": "page:4814:2634",
  "targetNodeId": "2:203",
  "includeChildren": true,
  "maxDepth": 2
}' http://127.0.0.1:3846/api/get-node-details
```

Use this to read:

- layout mode
- item spacing
- padding
- sizing modes
- layout align/grow
- fills/strokes/effects where available
- children when requested

## Fallback Interpretation

Some detail endpoints may return a metadata fallback instead of a full detail response.

Fallback is not a hard failure. It means Xbridge could still inspect the target through metadata, but some implementation-specific fields may be partial.

Look for:

- `source: "metadata_fallback"`
- `fallback.used: true`
- `fallback.reason`
- `fallback.fromCommand: "get_metadata"`

Recommended agent behavior:

- If full detail is returned, use it as the implementation source of truth.
- If `metadata_fallback` is returned, use it for hierarchy and dimensions, but avoid claiming exact variant or override behavior unless present.
- If `currentReadHealth` is unhealthy, retry after checking session state.

## Minimal Implementation Checklist

Before coding from Figma, collect:

- active `pluginId`
- target `pageId`
- target node id
- layout mode
- gap / `itemSpacing`
- padding
- width and height
- variant state if the node is an instance
- component property definitions if the node comes from a component set
- fallback/completeness status

If any of these are missing, say so explicitly instead of inferring from coordinates.
