# Plugin To Local Handoff Contract

## Purpose

This document defines the minimum payload contract for handing off a Figma-side design task from the plugin AI designer to the local implementation agent.

The goal is to keep the handoff:

- small enough to send reliably
- explicit enough for a coding agent to act on without re-reading the whole file
- extensible enough for richer implementation workflows later

This is the contract for implementation handoff, not the full plugin chat state and not the full bridge transport envelope.

## Contract Boundary

The plugin AI designer is responsible for:

- understanding the current Figma context
- collecting the minimum implementation intent
- packaging a stable handoff request

The local implementation agent is responsible for:

- deciding how to map the request into code changes
- reading additional local repo context
- reporting execution status and outcome

The bridge is responsible for:

- transporting this payload
- assigning request identifiers if needed
- exposing execution status

## Design Rules

1. The payload must be usable even if only one frame or one selection is involved.
2. The payload must separate user intent from Figma context.
3. The payload must not require the local agent to parse raw plugin UI state.
4. The payload should prefer summaries and stable references over huge snapshots.
5. Rich scene data is allowed, but only as optional context.

## Minimum Payload

The minimum handoff payload is a single JSON object with these required top-level fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `version` | string | yes | Contract version for compatibility checks |
| `handoffId` | string | yes | Unique request identifier |
| `requestedAt` | string | yes | ISO-8601 timestamp for the handoff |
| `source` | object | yes | Where the request came from |
| `intent` | object | yes | What the local agent is being asked to implement |
| `figmaContext` | object | yes | Minimum Figma context needed for implementation |

## Schema Draft

```json
{
  "version": "0.1",
  "handoffId": "handoff_01HZY6Y8K0YB6T6E3V4D2Z9Q7A",
  "requestedAt": "2026-04-21T08:15:30.000Z",
  "source": {
    "pluginSessionId": "plugin_abc123",
    "figmaFileKey": "ABCD1234",
    "figmaFileName": "Marketing Site",
    "pageId": "12:45",
    "pageName": "Landing"
  },
  "intent": {
    "mode": "implement_selection",
    "summary": "Implement the selected hero section in the local React app.",
    "userRequest": "이 화면을 반응형 React 섹션으로 구현해줘",
    "targets": [
      {
        "nodeId": "144:900",
        "nodeName": "Hero / Default",
        "role": "primary"
      }
    ],
    "deliverables": [
      "responsive UI implementation",
      "reusable component extraction"
    ],
    "constraints": [
      "match current layout hierarchy",
      "preserve CTA copy"
    ]
  },
  "figmaContext": {
    "selection": {
      "nodeIds": ["144:900"],
      "primaryNodeId": "144:900"
    },
    "selectionSummary": "Selected node is a hero section with headline, supporting copy, CTA group, and media card.",
    "designSystem": {
      "libraryHints": ["Button", "Card", "Section"],
      "tokenHints": ["color.surface.default", "space.24", "radius.lg"]
    },
    "snapshot": {
      "included": false
    }
  }
}
```

## Required Field Definitions

### `version`

- Current draft value: `0.1`
- Purpose: lets the bridge and local agent reject incompatible payloads safely

### `handoffId`

- Unique per implementation request
- Must stay stable across retries for the same logical request

### `requestedAt`

- ISO-8601 UTC timestamp
- Used for ordering, debugging, and retry visibility

### `source`

Minimum required fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `pluginSessionId` | string | Active plugin session that created the request |
| `figmaFileKey` | string | Figma file identity |
| `figmaFileName` | string | Human-readable file name |
| `pageId` | string | Page identity at request time |
| `pageName` | string | Human-readable page name |

This block tells the local side where the request originated without forcing it to understand full plugin runtime state.

### `intent`

Minimum required fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `mode` | string | Requested implementation mode |
| `summary` | string | Short machine-readable and human-readable task summary |
| `userRequest` | string | Original or normalized user request |
| `targets` | array | Which Figma nodes the request refers to |

Allowed initial `mode` values:

- `implement_selection`
- `implement_screen`
- `update_existing_code`
- `generate_component`

Each `targets[]` item should include:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `nodeId` | string | yes | Figma node identity |
| `nodeName` | string | yes | Human-readable node name |
| `role` | string | no | Optional role such as `primary`, `supporting`, `reference` |

Optional but recommended fields:

- `deliverables`
- `constraints`
- `acceptanceCriteria`
- `implementationNotes`

### `figmaContext`

Minimum required fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `selection` | object | Stable selection reference |
| `selectionSummary` | string | Compact summary of what is selected |
| `designSystem` | object | Optional hints the local agent can use immediately |
| `snapshot` | object | Whether a richer snapshot is attached |

`selection` minimum fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeIds` | string[] | All selected or targeted nodes |
| `primaryNodeId` | string | Main node for implementation |

`designSystem` is optional in richness but recommended in presence. It may contain:

- `libraryHints`
- `tokenHints`
- `componentHints`

`snapshot` should begin as a lightweight descriptor:

```json
{
  "included": false
}
```

If later phases need richer data, this can evolve to:

```json
{
  "included": true,
  "format": "scene_snapshot_v1",
  "payload": {}
}
```

## Minimum Viable Interpretation

The local implementation agent should be able to start work if it has only:

- the user request
- the target node ids
- a short selection summary
- file and page identity

That is the minimum viable contract.

Everything else is an acceleration layer, not a hard dependency.

## Explicitly Out Of Scope

This contract does not yet define:

- transport authentication
- streaming status events
- local execution result payloads
- full scene graph serialization rules
- plugin chat transcript persistence
- diff/patch return format back into Figma

Those should be defined in separate contracts.

## Validation Rules

The bridge or local entrypoint should reject the handoff if:

- `version` is missing or unsupported
- `handoffId` is missing
- `intent.mode` is missing
- `intent.summary` is empty
- `intent.targets` is empty
- `figmaContext.selection.primaryNodeId` is missing
- `source.figmaFileKey` is missing

The bridge should warn, but not necessarily reject, if:

- `selectionSummary` is missing
- `designSystem` hints are empty
- `snapshot.included` is `false`

## Recommended Transport Shape

This payload should be nested inside a thin bridge request envelope instead of mixing transport metadata into the contract itself.

Example:

```json
{
  "type": "plugin_local_handoff",
  "payload": {
    "...": "contract object above"
  }
}
```

## Implementation Notes

Suggested mapping points for future code:

- plugin-side shaping module:
  - `src/plugin-handoff-contract.js`
- local agent entrypoint:
  - bridge route or local agent adapter
- tests:
  - `tests/plugin-handoff-contract.test.js`

## Initial Decision

For the first implementation pass, keep the handoff contract:

- selection-centric
- summary-first
- snapshot-optional
- versioned from day one

That gives the team a stable minimum contract without forcing the plugin AI designer or the local agent to finalize every advanced workflow up front.
