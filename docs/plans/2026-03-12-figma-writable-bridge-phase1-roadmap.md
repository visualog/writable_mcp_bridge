# Figma Writable Bridge Phase 1 Roadmap

## Goal

Bring the local writable Figma bridge to a practical "design editing" baseline. Phase 1 should support real screen rearrangement, layer cleanup, safe component-state edits, and reversible change batches without trying to become a full Figma clone.

## Scope

Phase 1 includes:
- `delete_node`
- `reorder_child`
- `layoutGrow`
- `layoutAlign`
- `cornerRadius`
- `opacity`
- `list_component_properties`
- `set_component_property`
- `preview_changes`
- `undo_last_batch`
- `move_section`
- `promote_section`
- `normalize_spacing`
- `apply_naming_rule`

Already completed before this roadmap:
- `rename_node`
- `bulk_rename_nodes`
- `move_node`
- `duplicate_node`
- base auto layout properties
- `fillColor`
- `visible`
- text update tools

Out of scope for Phase 1:
- instance swap
- variant switching by component set
- constraints
- typography system edits
- gradient/image fills
- node creation/insertion
- snapshot rollback

## Operating Rules

### Approval gate

The bridge may implement component-property editing, but actual Figma changes that modify component properties must be approved before execution.

### Safety bias

All high-impact edits should move toward:
- preview first
- batch apply second
- undo available immediately after apply

### Scope control

Semantic commands must operate on explicit target frames or sections. They should not perform broad document-wide edits by default.

## Recommended Delivery Order

### Stage 1: Core destructive and ordering controls

Add:
- `delete_node`
- `reorder_child`

Why first:
- current layout work is blocked when unused nodes or wrong child order remain in place
- many Figma auto layout fixes depend on child order, not absolute position

Verification:
- delete a duplicated test node
- reorder children inside a known auto layout frame
- confirm the visual order changes in Figma

### Stage 2: Missing layout controls

Add:
- `layoutGrow`
- `layoutAlign`

Why now:
- current bridge can reorder sections but cannot finish many auto layout fixes cleanly
- these two properties unlock realistic container behavior inside stacks and rows

Verification:
- update one child to fill available width
- update another child to fixed alignment
- confirm in a real frame such as `home-fab-re`

### Stage 3: Lightweight style controls

Add:
- `cornerRadius`
- `opacity`

Why now:
- enough styling control to create variations and hierarchy without expanding into full paint/effect editing

Verification:
- reduce opacity on a support banner
- soften cards with radius adjustment
- confirm no unsupported-node silent failures

### Stage 4: Component property inspection

Add:
- `list_component_properties`

Why now:
- inspection is low risk
- it enables informed approval requests later

Output should include:
- node id
- node name
- whether it is an instance
- available component properties
- current values
- variant-related metadata when exposed by the Figma API

Verification:
- inspect known instances inside `home-fab-re`
- confirm output is readable enough to reference in approval requests

### Stage 5: Component property editing

Add:
- `set_component_property`

Guardrail:
- implementation is allowed
- actual use on design files requires explicit approval each time unless the user broadens the rule later

Verification:
- test only on a throwaway instance first
- log property name, old value, new value
- reject unsupported properties clearly

### Stage 6: Preview and undo

Add:
- `preview_changes`
- `undo_last_batch`

Why this is critical:
- once destructive and component-level edits exist, rollback stops the bridge from becoming brittle

Recommended model:
- preview returns a structured list of intended node mutations
- apply records a reversible batch in memory
- undo replays the inverse operations for the last batch only

Limit:
- Phase 1 undo can be in-memory and single-session
- persistent snapshots belong to Phase 2

### Stage 7: Semantic editing commands

Add:
- `move_section`
- `promote_section`
- `normalize_spacing`
- `apply_naming_rule`

Why last:
- these should be built on top of stable low-level primitives
- semantic commands are useful only when the underlying edit model is predictable

Definitions:
- `move_section`: reparent or reorder a named or targeted section in its parent stack
- `promote_section`: increase the visual priority of a section using spacing/order/basic style adjustments
- `normalize_spacing`: align container gaps and paddings to a chosen spacing scale
- `apply_naming_rule`: rename a target subtree using the agreed naming standard

Verification:
- run all four commands on `home-fab-re`
- compare before/after screenshots

## Suggested Technical Shape

### Low-level plugin/runtime

Extend the plugin runtime with:
- property-specific helpers
- explicit capability checks per node type
- clear errors for unsupported fields

### HTTP bridge

Add narrow endpoints only when they provide clarity. Otherwise prefer extending:
- `/api/update-node`
- `/api/bulk-update-nodes`

Semantic commands can have dedicated endpoints if they need custom logic.

### MCP layer

Expose:
- raw low-level tools
- semantic helpers as separate tools

Do not hide destructive operations behind ambiguous command names.

## Validation Standard

Each stage should finish with:
1. syntax check for `/Users/im_018/Documents/GitHub/Project/디자인토킹/src/server.js`
2. syntax check for `/Users/im_018/Documents/GitHub/Project/디자인토킹/figma-plugin/code.js`
3. bridge restart
4. plugin reconnect
5. one live verification in Figma

## Phase 1 Exit Criteria

Phase 1 is complete when all of the following are true:
- sections can be reordered reliably in auto layout parents
- nodes can be deleted safely
- common layout alignment/fill behavior can be edited
- lightweight visual hierarchy changes can be applied
- component properties can be inspected and changed with approval
- the last change batch can be previewed and undone
- naming and spacing can be normalized through semantic helpers

## Recommended Next Action

Implement Stage 1 next:
- `delete_node`
- `reorder_child`

Reason:
- these unlock the most blocked layout edits for the least complexity
- they also form the base for later semantic commands
