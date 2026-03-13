# home-fab-re auto layout bridge design

Target scope is the second bridge upgrade stage after rename support.

## Goal

Add writable bridge support for a safe subset of Figma auto layout properties so `home-fab-re` can be rearranged without component property edits.

## Scope

Supported properties in this stage:
- `layoutMode`
- `itemSpacing`
- `paddingLeft`
- `paddingRight`
- `paddingTop`
- `paddingBottom`
- `primaryAxisAlignItems`
- `counterAxisAlignItems`
- `primaryAxisSizingMode`
- `counterAxisSizingMode`

Out of scope:
- component properties
- variant switching
- instance swap
- constraints
- layoutGrow/layoutAlign
- min/max sizing
- wrap/grid behavior

## Reasoning

This subset is enough to reorganize container hierarchy inside `home-fab-re` while keeping the bridge low-risk. These properties map directly to common frame layout edits and avoid component-level side effects.

## Safety rule

Only nodes that already support auto layout fields should be updated. If a node does not expose a requested property, the bridge should fail clearly instead of silently skipping.

## API shape

Extend `update_node` and `bulk_update_nodes` to accept the auto layout fields above.

## Verification

- syntax checks for `src/server.js` and `figma-plugin/code.js`
- bridge restart
- successful call through `/api/update-node` or `/api/bulk-update-nodes`
- confirm changed layout fields on a target frame in `home-fab-re`
