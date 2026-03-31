# Writable Bridge Stage 5 Preview Changes 설계

## 목표
Add a non-mutating preview command for node updates so the bridge can show what `update_node` or `bulk_update_nodes` would change before applying it.

## 범위
Stage 5 adds:
- `preview_changes` for one or many node update payloads
- normalized before/after snapshots for supported Stage 1-4 safe node fields

Stage 5 does not add:
- rollback history
- actual mutation bundling
- visual diff rendering

## 설계
The plugin will calculate previews without mutating nodes.

For each update payload:
1. Resolve the target node using the same `target` semantics as `update_node`
2. Read the current supported fields from the live node
3. Compute the next-state projection by overlaying requested values
4. Return:
   - node id/name/type
   - target type (`self` or `parent` resolution)
   - `before`
   - `after`
   - `changedFields`

Supported preview fields:
- `visible`
- `fillColor`
- `cornerRadius`
- `opacity`
- `x`, `y`, `width`, `height`
- auto layout fields already supported by `update_node`

## API 형태
- HTTP: `/api/preview-changes`
- MCP tool: `preview_changes`

Input supports either:
- `nodeId` + update payload for a single preview
- `updates[]` for batch preview

## Error handling
Preview should fail if:
- node is missing
- target node does not support a requested field
- fill color is invalid

## 검증
Use a known frame and one safe node.
- Run `preview_changes`
- confirm response shows `changedFields`
- confirm screenshot is unchanged before/after
