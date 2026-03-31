# Writable Bridge Stage 6 Undo Last Batch 설계

## 목표
Add an in-memory `undo_last_batch` command that can safely revert the most recent supported mutation batch in the current plugin session.

## 범위
Stage 6 supports undo for:
- `update_text`
- `bulk_update_texts`
- `rename_node`
- `bulk_rename_nodes`
- `update_node`
- `bulk_update_nodes`

Stage 6 does not support undo for:
- `duplicate_node`
- `move_node`
- `delete_node`
- `reorder_child`
- `set_component_property`

Those operations either need more state capture or explicit approval handling that should be added later.

## 설계

### 히스토리 모델
Keep one in-memory batch only:
- `lastUndoBatch`
- overwritten on each supported mutating command
- cleared after successful undo

Batch shape:
- `type`
- `createdAt`
- `steps[]`

Each step stores the inverse operation needed to restore prior state.

### 역연산 캡처 규칙

#### Text updates
Capture previous `characters` before applying new text.

#### Node rename
Capture previous `name` before applying the rename.

#### Node updates
Use the same supported fields as `update_node` and `bulk_update_nodes`.
Before mutation:
1. build a preview
2. inspect `changedFields`
3. build an inverse payload from `before`

The inverse payload should contain only changed fields so undo remains narrow.

### Undo execution
When `undo_last_batch` runs:
1. ensure a batch exists
2. replay inverse steps in reverse order
3. return a list of reverted nodes
4. clear `lastUndoBatch`

## Error handling
- if no undo batch exists: return a clear error
- if an inverse step fails: abort and report the failing step

## 검증
Live verification should cover:
1. rename a node, then undo
2. update a safe style field like opacity, then undo
3. update text, then undo

Because Stage 6 is session-memory only, bridge restart should clear undo history.
