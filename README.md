# Writable Figma MCP Prototype

This project provides a local MCP server and a Figma plugin bridge that can write text into an open Figma file.

## What it does

- Exposes MCP tools over stdio
- Keeps a local HTTP bridge at `http://localhost:3845`
- Lets a Figma plugin execute write operations inside the current document

## Available MCP tools

- `get_active_plugins`
- `get_selection`
- `list_text_nodes`
- `search_nodes`
- `search_library_assets`
- `list_component_properties`
- `update_text`
- `set_component_property`
- `preview_changes`
- `rename_node`
- `bulk_rename_nodes`
- `bulk_update_texts`
- `update_node`
- `bulk_update_nodes`
- `create_node`
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

## Optional Figma REST access

For published library components, component sets, and styles that are not on the current page tree, set a Figma personal access token before starting the bridge:

```bash
export FIGMA_ACCESS_TOKEN=...
npm start
```

Then call `search_library_assets` with the library file key. The bridge queries official Figma REST endpoints like `/v1/files/:file_key/components`, `/component_sets`, and `/styles`, then filters the results locally for Codex.

## Notes

- This prototype updates text nodes, renames nodes, changes node visibility, applies solid fill colors, can change corner radius and opacity, can create first-slice nodes (`FRAME`, `TEXT`, `RECTANGLE`), can duplicate nodes, can move nodes into a target parent, can delete nodes, can reorder children within a parent, can inspect component properties, and can update a safe subset of auto layout properties.
- `search_nodes` is a lightweight page-tree discovery helper intended to avoid slow full-text traversal when you need to find frames, sections, or instances by name.
- `search_library_assets` is a server-side discovery helper for published library assets and requires `FIGMA_ACCESS_TOKEN`.
- `move_section` is a semantic helper for explicitly moving or reordering container-like nodes without choosing low-level move vs reorder commands yourself.
- `promote_section` is a semantic helper that promotes a section-like node earlier in its container hierarchy and can optionally normalize destination spacing.
- `normalize_spacing` is a semantic helper for setting explicit gap and/or padding values on an auto layout container and, optionally, its descendant container subtree.
- `apply_naming_rule` is a semantic helper that previews or applies deterministic slash-and-kebab-case rename plans for known subtree patterns.
- Supported naming presets include generic scaffolding (`content-screen-basic`) and AI-specific screen semantics (`ai-chat-screen`) in addition to the existing app/header/tab/card/fab presets.
- Component property writes are supported through `set_component_property`, but actual design mutations through component properties should only be run after explicit user approval.
- `preview_changes` is non-mutating and returns before/after snapshots for supported node updates.
- `undo_last_batch` currently supports the last batch from text updates, node renames, and `update_node` / `bulk_update_nodes` mutations in the current plugin session only.
- Supported auto layout fields: `layoutMode`, `itemSpacing`, `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `primaryAxisSizingMode`, `counterAxisSizingMode`, `layoutGrow`, `layoutAlign`.
- Text updates load the fonts already used by each node before writing.
- If the plugin is not open, write tools will time out after 30 seconds.
- The plugin manifest includes `teamlibrary` permission so future library-variable workflows can use `figma.teamLibrary` when needed.
- The plugin probes `http://localhost:3845` through `http://localhost:3849` and connects to the first healthy bridge origin it finds.
- If you want structured calendar-cell updates next, add a higher-level tool on top of `bulk_update_texts`.
