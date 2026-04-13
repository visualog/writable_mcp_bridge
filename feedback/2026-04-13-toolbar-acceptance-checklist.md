# Toolbar Read Acceptance Checklist

Date: 2026-04-13

## Purpose

This checklist turns the `pattern/toolbar` review case into a repeatable acceptance scenario for implementation-grade read flows.

The bridge passes this scenario only if it answers the toolbar questions from explicit node fields, not by inferring layout from coordinates.
In practice, the checklist is meant to be usable without coordinate inference.

## Scenario

- target file: `FDS_Inspector`
- target page: the page that contains `Section 1`
- target node family: `pattern/toolbar`
- expected reading style: structural fields first, coordinates only as supporting evidence

## Executable Setup

1. Start bridge and plugin:
   - `npm run start:keychain`
   - Open Figma plugin in the target file and keep it connected.
2. Export runtime values:
   - `export BASE_URL=http://127.0.0.1:3846`
   - `export PLUGIN_ID=page:817:417`
   - `export TARGET_NODE_ID=33011:2910`
   - `export VARIANT_NODE_ID=1:43`
   - `export INSTANCE_NODE_ID=1:779`
3. Run the acceptance helper:
   - `scripts/acceptance-implementation-read-flow.sh`

## API Steps (copy/paste)

`/api/get-node-details` using `targetNodeId`:

```bash
curl -sS -X POST "$BASE_URL/api/get-node-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "targetNodeId": "'"$TARGET_NODE_ID"'",
    "detailLevel": "full",
    "includeChildren": true,
    "maxDepth": 3
  }'
```

`/api/get-node-details` using `nodeId` alias:

```bash
curl -sS -X POST "$BASE_URL/api/get-node-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "nodeId": "'"$TARGET_NODE_ID"'",
    "detailLevel": "full",
    "includeChildren": true,
    "maxDepth": 3
  }'
```

`/api/get-component-variant-details` using `targetNodeId`:

```bash
curl -sS -X POST "$BASE_URL/api/get-component-variant-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "targetNodeId": "'"$VARIANT_NODE_ID"'",
    "detailLevel": "full",
    "includeChildren": true,
    "maxDepth": 2
  }'
```

`/api/get-component-variant-details` using `nodeId` alias:

```bash
curl -sS -X POST "$BASE_URL/api/get-component-variant-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "nodeId": "'"$VARIANT_NODE_ID"'",
    "detailLevel": "full",
    "includeChildren": true,
    "maxDepth": 2
  }'
```

`/api/get-instance-details` using `targetNodeId`:

```bash
curl -sS -X POST "$BASE_URL/api/get-instance-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "targetNodeId": "'"$INSTANCE_NODE_ID"'",
    "detailLevel": "full",
    "includeResolvedChildren": true,
    "maxDepth": 2
  }'
```

`/api/get-instance-details` using `nodeId` alias:

```bash
curl -sS -X POST "$BASE_URL/api/get-instance-details" \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "'"$PLUGIN_ID"'",
    "nodeId": "'"$INSTANCE_NODE_ID"'",
    "detailLevel": "full",
    "includeResolvedChildren": true,
    "maxDepth": 2
  }'
```

## Acceptance Rule

If any answer depends on counting `x`/`y` deltas, reconstructing spacing from child positions, or guessing variant state from screenshots, the scenario fails.

## Questions

1. What is the root auto-layout direction?
2. What is the root padding?
3. What is the gap between buttons?
4. What is the gap between buttons and dividers?
5. What variants exist?
6. Which children are visible in each variant?
7. Which variants contain status text?
8. Which variants show badge or dot states?
9. Which instance properties or overrides differ by variant?

## Evidence Format

For each answer, capture:

- the explicit node field or read API used
- whether the value came from `get_node_details`, `get_component_variant_details`, `get_instance_details`, or `get_metadata`
- whether the value is explicit or inferred

## Pass Criteria

- all 9 answers are available from the bridge output
- no manual coordinate inference is required
- toolbar structure can be translated into code without a follow-up correction round for spacing or variant state

## Fail Criteria

- any answer requires guessing from screenshot geometry
- variant-specific visibility cannot be read directly
- instance override differences are not visible in the bridge output
- the read flow stops at sparse XML without a structured follow-up path

## Failure Diagnostics

- old process alive:
  - `lsof -ti tcp:3846`
  - if multiple PIDs are shown, terminate stale ones and restart `npm run start:keychain`
- wrong pluginId:
  - `curl -sS "$BASE_URL/api/sessions"`
  - verify the `pluginId` in requests matches the active session for the open file/page
- node missing:
  - run one request with an invalid id and confirm explicit server error (`Target node not found`/`Node not found`)
  - then re-check node id from Figma selection and re-run the same endpoint
