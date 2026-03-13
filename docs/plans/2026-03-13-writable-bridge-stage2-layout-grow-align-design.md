# writable bridge stage2 layout grow/align design

## Goal

Add the minimum missing auto layout child controls required for practical stack editing:
- `layoutGrow`
- `layoutAlign`

## Why this stage matters

The bridge can already move nodes, reorder children, and edit container auto layout properties. It still cannot correctly finish many real layout edits because children inside auto layout parents often need fill behavior or explicit alignment overrides.

## Scope

Add support for:
- `layoutGrow`
- `layoutAlign`

Only apply these fields when the target node exposes them. Fail explicitly when a node type does not support them.

## API strategy

Do not add new endpoints. Extend:
- `/api/update-node`
- `/api/bulk-update-nodes`
- MCP `update_node`
- MCP `bulk_update_nodes`

## Verification target

Live-check on a known Figma frame by:
1. duplicating a test node inside an auto layout parent
2. setting `layoutGrow`
3. setting `layoutAlign`
4. confirming the bridge returns success

## Out of scope

- constraints
- min/max sizing
- instance properties
- semantic layout commands
