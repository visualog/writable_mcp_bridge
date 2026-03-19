# Cross-File Clone Design

## Goal
Add a first-slice cross-file clone workflow so the writable bridge can read a selected subtree from one Figma file and recreate a structurally similar subtree inside another connected Figma file.

## Scope
This slice supports:
- one selected source root at a time
- one explicit target parent in another file
- source node serialization for `FRAME`, `GROUP`, `RECTANGLE`, and `TEXT`
- optional shallow placeholder support for `INSTANCE`
- preservation of name, type, relative position, size, text content, solid fill color, opacity, and corner radius where available
- bounded traversal depth and child count for safety

Out of scope for this slice:
- pixel-perfect recreation of every Figma property
- image fills, strokes, effects, blur, and advanced typography
- auto layout reconstruction beyond the minimum fields already supported by `update_node`
- bidirectional sync after clone
- arbitrary multi-root copy/paste workflows
- direct import of unpublished local components across files

## Problem
The Apple Community file exposes local component metadata, but those keys are not published library keys and cannot be imported with `importComponentByKeyAsync`. We need a stronger bridge path that can inspect a source file directly and replay its structure inside the current writable target file.

## Approach
Use two plugin sessions instead of relying on published library import:
- a source-session command serializes the currently selected node subtree into a compact JSON snapshot
- a target-session command replays that snapshot under a chosen parent using existing node creation and update primitives

The bridge server remains the coordinator. It stores no long-lived file state. Each command runs against the active plugin session for that file, which keeps the design safe and explicit.

## Snapshot Shape
Each serialized node should include:
- `name`
- `type`
- `x`, `y`, `width`, `height`
- `visible`, `opacity`
- `cornerRadius`
- `fillColor` for first solid fill only
- `characters` for text
- `children`

For `INSTANCE`, the first slice should emit:
- `type: "INSTANCE"`
- original `name`
- geometry fields
- no deep internal child snapshot

The target replay command may convert unsupported nodes into placeholder frames or rectangles with preserved names so the recreated structure still communicates hierarchy.

## Safety
- require an explicit `sourcePluginId` and `targetPluginId`
- require an explicit `targetParentId`
- reject cloning when the source selection is empty
- clamp traversal depth and maximum node count
- reject unsupported node types instead of silently mutating them unless placeholder mode is enabled
- return a compact replay report with created node ids and skipped node summaries

## User Flow
1. Open the source reference file and run `Writable MCP Bridge`
2. Open the target working file and run `Writable MCP Bridge`
3. Select the source root in the source file
4. Call a bridge command like `snapshot_selection`
5. Call a bridge command like `recreate_snapshot` against the target parent
6. Refine the recreated structure with existing write tools

## First Verification Target
Use the Apple Community file as the source and the current `4:3` Today frame as the target. Start with a small source subtree such as a header or section block before attempting a larger screen slice.
