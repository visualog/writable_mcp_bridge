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
- `list_component_properties`
- `update_text`
- `set_component_property`
- `preview_changes`
- `rename_node`
- `bulk_rename_nodes`
- `bulk_update_texts`
- `update_node`
- `bulk_update_nodes`
- `duplicate_node`
- `move_node`
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

## Notes

- This prototype updates text nodes, renames nodes, changes node visibility, applies solid fill colors, can change corner radius and opacity, can duplicate nodes, can move nodes into a target parent, can delete nodes, can reorder children within a parent, can inspect component properties, and can update a safe subset of auto layout properties.
- Component property writes are supported through `set_component_property`, but actual design mutations through component properties should only be run after explicit user approval.
- `preview_changes` is non-mutating and returns before/after snapshots for supported node updates.
- `undo_last_batch` currently supports the last batch from text updates, node renames, and `update_node` / `bulk_update_nodes` mutations in the current plugin session only.
- Supported auto layout fields: `layoutMode`, `itemSpacing`, `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `primaryAxisSizingMode`, `counterAxisSizingMode`, `layoutGrow`, `layoutAlign`.
- Text updates load the fonts already used by each node before writing.
- If the plugin is not open, write tools will time out after 30 seconds.
- The plugin probes `http://localhost:3845` through `http://localhost:3849` and connects to the first healthy bridge origin it finds.
- If you want structured calendar-cell updates next, add a higher-level tool on top of `bulk_update_texts`.
