# Writable Bridge Normalize Spacing Design

## Goal
Add a semantic `normalize_spacing` command that standardizes auto layout padding and gaps for an explicit container subtree.

## Scope
`normalize_spacing` supports:
- explicit `containerId`
- explicit numeric `spacing`
- `mode`: `both`, `gap`, or `padding`
- optional `recursive`

Defaults:
- `spacing = 8`
- `mode = both`
- `recursive = false`

`normalize_spacing` does not support:
- heuristic spacing scale inference
- document-wide application
- typography or size normalization

## Design

### Target selection
Resolve `containerId` to a single node. The node must expose auto layout fields.

If `recursive` is `true`, include descendant nodes that also expose:
- `layoutMode`
- `itemSpacing`
- padding fields

### Mutation behavior
For each targeted node:
- if `mode` includes `gap`, set `itemSpacing = spacing`
- if `mode` includes `padding`, set all four paddings to `spacing`

### Undo behavior
Capture previews before mutation and store the inverse as an `update_node` batch so `undo_last_batch` can revert the normalization.

### Output
Return:
- target root id
- recursive flag
- affected node count
- per-node updates

## Verification
Use a disposable auto layout stack:
1. normalize root only
2. normalize recursively
3. undo the last batch
