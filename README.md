# Writable Figma MCP Prototype

This project provides a local MCP server and a Figma plugin bridge for writing directly into an open Figma file.

## What it does

- Exposes MCP tools over stdio
- Keeps a local HTTP bridge at `http://localhost:3845`
- Lets a Figma plugin execute write operations inside the current document
- Supports first-slice authoring for frames, rectangles, text, auto layout updates, and component-property mutations
- Supports text font updates through `fontFamily`, `fontStyle`, and `fontSize`
- Adds official-MCP-inspired read helpers for sparse selection XML (`get_metadata`) and token/style usage inspection (`get_variable_defs`)

## Quick start

1. Start the bridge server:

```bash
npm start
```

2. Open Figma desktop and run the `Writable MCP Bridge` plugin in the target file.
3. Keep the plugin window open until it shows a connected state.
4. Confirm the bridge is healthy:

```bash
curl -s http://127.0.0.1:3846/health
```

5. Use MCP tools or local HTTP requests to create and update nodes in that connected file.

If the bridge restarts, re-open the plugin so it can register again.

## Available MCP tools

- `get_active_plugins`
- `get_selection`
- `get_metadata`
- `get_variable_defs`
- `search_design_system`
- `list_text_nodes`
- `search_nodes`
- `snapshot_selection`
- `search_library_assets`
- `recreate_snapshot`
- `search_file_components`
- `list_component_properties`
- `update_text`
- `set_component_property`
- `bind_variable`
- `preview_changes`
- `rename_node`
- `bulk_rename_nodes`
- `bulk_update_texts`
- `update_node`
- `bulk_update_nodes`
- `create_node`
- `import_library_component`
- `duplicate_node`
- `move_node`
- `move_section`
- `promote_section`
- `normalize_spacing`
- `apply_naming_rule`
- `delete_node`
- `reorder_child`
- `undo_last_batch`

## Project structure

- `src/server.js`: stdio MCP server + local HTTP bridge
- `figma-plugin/manifest.json`: Figma plugin manifest
- `figma-plugin/code.js`: plugin runtime that reads and updates text nodes
- `figma-plugin/ui.html`: plugin UI that connects to the local bridge

## Run the local server

```bash
npm start
```

The process serves two things at once:

- MCP over stdio for Codex
- HTTP bridge on the first free localhost port in `3845-3849` for the Figma plugin

## Load the Figma plugin

1. Open Figma desktop.
2. Go to Plugins > Development > Import plugin from manifest.
3. Pick `figma-plugin/manifest.json`.
4. Run the `Writable MCP Bridge` plugin and keep it open.
5. If the manifest changed, re-import or re-run the plugin so the new allowed localhost ports are available.

## Typical flow

1. Start the local server with `npm start`.
2. Run the Figma plugin inside the target file.
3. Select a frame in Figma.
4. Call `list_text_nodes` from MCP to inspect writable text nodes.
5. Call `update_text`, `rename_node`, `list_component_properties`, `preview_changes`, or their related variants with target node IDs.

## HTTP usage examples

### Create a text node with `SF Compact Text`

```bash
curl -s -X POST http://127.0.0.1:3846/api/create-node \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "parentId": "33011:2910",
    "nodeType": "TEXT",
    "name": "SCREEN_TITLE",
    "characters": "切角矩形 16:27:26",
    "fontFamily": "SF Compact Text",
    "fontStyle": "Semibold",
    "fontSize": 28,
    "x": 72,
    "y": 548,
    "width": 214,
    "height": 34
  }'
```

### Update an existing text node font and content

```bash
curl -s -X POST http://127.0.0.1:3846/api/update-node \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33011:2915",
    "characters": "切角矩形 16:27:26",
    "fontFamily": "SF Compact Text",
    "fontStyle": "Semibold",
    "fontSize": 28
  }'
```

### Convert a frame into a vertical auto layout container

```bash
curl -s -X POST http://127.0.0.1:3846/api/update-node \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33011:2910",
    "layoutMode": "VERTICAL",
    "primaryAxisSizingMode": "AUTO",
    "counterAxisSizingMode": "FIXED",
    "primaryAxisAlignItems": "MIN",
    "counterAxisAlignItems": "CENTER",
    "paddingTop": 24,
    "paddingRight": 20,
    "paddingBottom": 32,
    "paddingLeft": 20,
    "itemSpacing": 28
  }'
```

### Bulk-update multiple text nodes

```bash
curl -s -X POST http://127.0.0.1:3846/api/bulk-update-nodes \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "updates": [
      {
        "nodeId": "33011:2915",
        "fontFamily": "SF Compact Text",
        "fontStyle": "Semibold",
        "fontSize": 28
      },
      {
        "nodeId": "33011:2914",
        "fontFamily": "SF Compact Text",
        "fontStyle": "Regular",
        "fontSize": 17
      }
    ]
  }'
```

### Get a sparse XML outline for the current selection

```bash
curl -s -X POST http://127.0.0.1:3846/api/get-metadata \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "targetNodeId": "33011:2910",
    "maxDepth": 3,
    "maxNodes": 120
  }'
```

### Inspect variables and shared styles used in a selection

```bash
curl -s -X POST http://127.0.0.1:3846/api/get-variable-defs \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "targetNodeId": "33011:2910",
    "maxDepth": 4,
    "maxNodes": 180
  }'
```

### Search the local design system, with optional external library file keys

```bash
curl -s -X POST http://127.0.0.1:3846/api/search-design-system \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "file:T2OpQl80MZvjobGFz57VSF",
    "query": "button",
    "includeComponents": true,
    "includeStyles": true,
    "includeVariables": true,
    "fileKeys": ["YOUR_LIBRARY_FILE_KEY"],
    "maxResults": 20
  }'
```

### Bind or unbind a variable on a supported property

```bash
curl -s -X POST http://127.0.0.1:3846/api/bind-variable \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33011:2910",
    "property": "fills.color",
    "variableId": "VariableID:2611:99"
  }'
```

## Recommended authoring approach

- Use official Figma MCP for discovery-oriented reads when convenient
- Use this bridge for stable write operations
- Use `get_metadata` when you need a bounded page or selection outline without the heavier `snapshot_selection` payload
- Use `get_variable_defs` when you need token and shared-style usage from the current canvas without leaving the local bridge
- Use `search_design_system` to search local components, local styles, local variables, and optional REST-backed library metadata through one entry point
- Use `bind_variable` to connect reusable local or imported variables to node fields instead of hardcoding paint values
- Build screens incrementally:
  1. Create a wrapper frame
  2. Turn containers into auto layout frames
  3. Create text nodes with explicit font settings
  4. Move toward library component placement and token binding

For screen work, prefer command-shaped mutations over arbitrary script execution. This bridge is intended to grow into a stable authoring layer rather than a general-purpose remote code runner.

## Multi-file sessions

When the plugin is open in multiple Figma files at once, each file now registers as its own bridge session derived from the file key. Use `get_active_plugins` to inspect the available `pluginId` values and pass the intended `pluginId` explicitly when working across a source file and a target file.

## Optional Figma REST access

For published library components, component sets, and styles that are not on the current page tree, set a Figma personal access token before starting the bridge:

```bash
export FIGMA_ACCESS_TOKEN=...
npm start
```

Then call `search_library_assets` with the library file key. The bridge queries official Figma REST endpoints like `/v1/files/:file_key/components`, `/component_sets`, and `/styles`, then filters the results locally for Codex.

Once you have a published component or component-set `key`, call `import_library_component` with the destination `parentId` to place an instance into the current document.

For Community files or source files that expose local components instead of published library keys, call `search_file_components` to inspect file component metadata using the same Figma personal access token.

## Cross-file clone workflow

For layouts that cannot be imported as published library components:

1. Open the plugin in the source file.
2. Open the plugin in the target file.
3. Call `snapshot_selection` against the source session.
4. Call `recreate_snapshot` against the target session and target parent.

The first slice recreates `FRAME`, `GROUP`, `RECTANGLE`, and `TEXT` structure directly and converts `INSTANCE` nodes into placeholder frames.

## Notes

- This prototype updates text nodes, renames nodes, changes node visibility, applies solid fill colors, can change corner radius and opacity, can create first-slice nodes (`FRAME`, `TEXT`, `RECTANGLE`), can duplicate nodes, can move nodes into a target parent, can delete nodes, can reorder children within a parent, can inspect component properties, and can update a safe subset of auto layout properties.
- Text node creation and node updates support `fontFamily`, `fontStyle`, and `fontSize`.
- `search_nodes` is a lightweight page-tree discovery helper intended to avoid slow full-text traversal when you need to find frames, sections, or instances by name.
- `get_metadata` mirrors the official Figma MCP sparse-XML workflow for the current selection, explicit target, or full page when nothing is selected.
- `get_variable_defs` mirrors the official Figma MCP token-inspection workflow and reports bound variables plus applied shared styles for the current selection, explicit target, or full page when nothing is selected.
- `search_design_system` is the bridge counterpart to the official Figma MCP search flow. It searches the open file for local components, local shared styles, and local variables, then can merge in external library/file matches when `FIGMA_ACCESS_TOKEN` and `fileKeys` are provided.
- `snapshot_selection` serializes a bounded subtree from one open file so it can be replayed elsewhere.
- `search_library_assets` is a server-side discovery helper for published library assets and requires `FIGMA_ACCESS_TOKEN`.
- `recreate_snapshot` replays a bounded serialized subtree into another connected file.
- `search_file_components` inspects file-level component metadata, which is especially useful for Community files that are not published as importable libraries.
- `import_library_component` imports published library components or component sets into the current document by key and inserts an instance into a target parent.
- `bind_variable` binds or unbinds supported simple fields plus `fills.color` / `strokes.color` using a local variable id or an importable variable key.
- `move_section` is a semantic helper for explicitly moving or reordering container-like nodes without choosing low-level move vs reorder commands yourself.
- `promote_section` is a semantic helper that promotes a section-like node earlier in its container hierarchy and can optionally normalize destination spacing.
- `normalize_spacing` is a semantic helper for setting explicit gap and/or padding values on an auto layout container and, optionally, its descendant container subtree.
- `apply_naming_rule` is a semantic helper that previews or applies deterministic slash-and-kebab-case rename plans for known subtree patterns.
- Supported naming presets include generic scaffolding (`content-screen-basic`) and AI-specific screen semantics (`ai-chat-screen`) in addition to the existing app/header/tab/card/fab presets.
- Component property writes are supported through `set_component_property`, but actual design mutations through component properties should only be run after explicit user approval.
- `preview_changes` is non-mutating and returns before/after snapshots for supported node updates.
- `undo_last_batch` currently supports the last batch from text updates, node renames, variable bindings, and `update_node` / `bulk_update_nodes` mutations in the current plugin session only.
- Supported auto layout fields: `layoutMode`, `itemSpacing`, `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `primaryAxisSizingMode`, `counterAxisSizingMode`, `layoutGrow`, `layoutAlign`.
- Text updates load the fonts already used by each node before writing.
- If you pass a new text font through `fontFamily` or `fontStyle`, the plugin loads that font before applying it.
- If the plugin is not open, write tools will time out after 30 seconds.
- The plugin manifest includes `teamlibrary` permission so future library-variable workflows can use `figma.teamLibrary` when needed.
- The plugin probes `http://localhost:3845` through `http://localhost:3849` and connects to the first healthy bridge origin it finds.
- If you want structured calendar-cell updates next, add a higher-level tool on top of `bulk_update_texts`.
