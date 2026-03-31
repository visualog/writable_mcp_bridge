# promote_section 설계

## 목표
Add a semantic `promote_section` command that promotes a section-like node earlier in its container hierarchy with optional spacing normalization.

## 범위
- Operates on an explicit `sectionId`
- Default behavior promotes within the current parent to index `0`
- Optional `destinationParentId`
- Optional `normalizeSpacing`
- Supports `previewOnly`

## Why this command exists
Current bridge primitives already support move and spacing normalization, but callers still need to decide low-level operations manually. `promote_section` should encode the common UI intent: make a section more primary.

## 입력
- `sectionId`
- `destinationParentId` optional
- `index` optional, default `0`
- `normalizeSpacing` optional object
  - `spacing`
  - `mode`
  - `recursive`
- `previewOnly` default `true`

## 출력
- `section`
- `sourceParentId`
- `destinationParentId`
- `operation`
- `movePlan`
- `spacingPlan` optional
- `previewOnly`

## 안전 규칙 rules
- Default to preview-only
- Reject unsupported node types early
- If source and destination are already the same with same index, return `noop`
- Only run spacing normalization when the destination container supports auto layout

## Undo behavior
- Move itself is not yet covered by `undo_last_batch`
- Optional spacing normalization is already undoable through the existing normalize path
- Output should clearly state which parts are undo-covered
