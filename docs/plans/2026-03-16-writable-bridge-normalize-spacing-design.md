# Writable Bridge Normalize Spacing 설계

## 목표
Add a semantic `normalize_spacing` command that standardizes auto layout padding and gaps for an explicit container subtree.

## 범위
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

## 설계

### 대상 선택
Resolve `containerId` to a single node. The node must expose auto layout fields.

If `recursive` is `true`, include descendant nodes that also expose:
- `layoutMode`
- `itemSpacing`
- padding fields

### 변경 동작
For each targeted node:
- if `mode` includes `gap`, set `itemSpacing = spacing`
- if `mode` includes `padding`, set all four paddings to `spacing`

### undo 동작
Capture previews before mutation and store the inverse as an `update_node` batch so `undo_last_batch` can revert the normalization.

### Output
Return:
- target root id
- recursive flag
- affected node count
- per-node updates

## 검증
Use a disposable auto layout stack:
1. normalize root only
2. normalize recursively
3. undo the last batch
