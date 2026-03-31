# Writable Bridge Move Section 설계

## 목표
Add a semantic `move_section` command that reorders or reparents an explicit section/container node without requiring the caller to choose between low-level `move_node` and `reorder_child`.

## 범위
`move_section` supports:
- moving an explicit target container into a destination parent
- reordering within the current parent when `destinationParentId` is omitted
- optional `index`

`move_section` does not support:
- fuzzy section lookup by text
- automatic destination discovery
- document-wide heuristic layout changes

## 설계

### Input
- `sectionId`
- `destinationParentId` optional
- `index` optional

### Validation
Target node must be a container-like node:
- `FRAME`
- `SECTION`
- `INSTANCE`
- `COMPONENT`
- `COMPONENT_SET`

Destination parent must support child insertion.

### Behavior
1. Resolve the target section
2. Resolve destination parent:
   - explicit `destinationParentId`
   - else current parent
3. If destination parent is the current parent and `index` is provided, reorder
4. Otherwise move into the destination parent at the optional index

### Output
Return:
- moved node id/name/type
- source parent id
- destination parent id
- final child index

## 검증
Use a disposable frame stack:
1. move a section down within the same parent
2. move it back
3. optionally move into another parent frame and back
