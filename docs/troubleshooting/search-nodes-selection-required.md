# Search Nodes Requires Context

`search_nodes` can fail when no selection or target context is available.

## Symptoms

- `ERR_SELECTION_REQUIRED`
- `No selection available`
- search works after selecting a frame in Figma

## Safer Alternatives

- Use `/api/pages` to discover page ids.
- Use `/api/get-metadata` with a `targetNodeId`.
- Use detail APIs when the target node id is known.

## Rule

When asking another agent to inspect a file, provide either a `pluginId` plus page id or ask it to run page discovery first.
