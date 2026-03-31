# apply_naming_rule 설계

## 목표
Add a semantic `apply_naming_rule` bridge command that renames a subtree using safe pattern-mapped rules instead of generic recursive guesses.

## 범위
- Pattern-mapped only
- Unmatched nodes are left unchanged
- Supports preview-only mode before mutation
- Reuses existing rename and undo behavior through `bulk_rename_nodes`

## Why this approach
The bridge is used against live design files. Generic recursive renaming is too risky because it will over-match decorative frames and nested component internals. Pattern-mapped rules keep the blast radius explicit.

## Supported rule sets in v1
- `app-screen`
- `header-basic`
- `tab-bar-basic`
- `card-list-basic`
- `fab-basic`

## Matching model
Rules use structural heuristics, not current node names.
Examples:
- top-most horizontal frame with title-like text and action-like icons => `header/*`
- bottom-fixed horizontal container with multiple sibling items => `tab-bar/*`
- floating circular button near bottom edge => `fab/trigger`

## Command shape
Input:
- `rootNodeId`
- `ruleSet`
- `recursive` default `true`
- `previewOnly` default `true`

Output:
- `root`
- `ruleSet`
- `previewOnly`
- `matched`
- `renamed`
- `skipped`
- `updates`

## 안전 규칙 rules
- Default to preview-only
- Only rename matched nodes
- Skip duplicate target names rather than auto-suffixing
- Skip nodes inside instances/components unless they are the explicit root

## Undo behavior
Mutation path goes through `bulk_rename_nodes`, so existing `undo_last_batch` support applies without new undo logic.
