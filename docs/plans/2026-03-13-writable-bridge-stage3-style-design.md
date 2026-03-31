# writable bridge stage3 style controls design

## 목표

Add lightweight visual styling controls that are useful for hierarchy tuning without opening the full complexity of strokes, effects, or text styling:
- `cornerRadius`
- `opacity`

## 이 단계가 중요한 이유

The bridge can already restructure screens and edit layout behavior. It still lacks two low-risk controls that are frequently needed in UI exploration:
- softening or sharpening blocks with radius changes
- reducing emphasis through opacity

These controls are enough to test hierarchy and tone on real screens without stepping into full visual system editing.

## 범위

Add support for:
- `cornerRadius`
- `opacity`

Rules:
- only apply `cornerRadius` to nodes that expose the property
- only apply `opacity` to nodes that expose the property
- fail clearly on unsupported node types

## API strategy

Do not add new endpoints. Extend:
- `/api/update-node`
- `/api/bulk-update-nodes`
- MCP `update_node`
- MCP `bulk_update_nodes`

## 검증 target

Use a disposable duplicate inside the existing `home-fab-create-focus-v1` frame:
1. duplicate a quick-start card
2. set `cornerRadius`
3. set `opacity`
4. confirm success
5. delete the duplicate

## Out of scope

- strokes
- shadows/effects
- blend modes
- gradients
- typography
