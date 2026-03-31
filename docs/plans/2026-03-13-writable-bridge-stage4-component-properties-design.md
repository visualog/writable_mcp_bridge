# Writable Bridge Stage 4 Component Properties 설계

## 목표
Add a read/write layer for Figma component properties so the bridge can inspect instance-level configurable properties and, when explicitly approved, apply property changes through the plugin runtime.

## 범위
Stage 4 adds two capabilities:
- `list_component_properties`: inspect component properties for a target node or current selection
- `set_component_property`: apply a single component property value to an instance node

This stage does not add:
- bulk component property writes
- instance swap workflows
- variant inference
- approval workflow enforcement inside the bridge itself

Approval remains an operator rule in the assistant workflow: real Figma mutations through `set_component_property` require explicit user approval first.

## 설계

### 읽기 경로
The plugin should:
1. Resolve the target node by `targetNodeId` or current selection
2. Verify the node exposes `componentProperties`
3. Return a normalized payload with:
   - node id/name/type
   - `isInstance`
   - `propertyCount`
   - list of properties containing property name, type, current value, and preferred values if present

The server should expose this through:
- HTTP: `/api/list-component-properties`
- MCP tool: `list_component_properties`

### 쓰기 경로
The plugin should:
1. Resolve the node by `nodeId`
2. Verify it is an instance node with `setProperties`
3. Verify the property exists on `componentProperties`
4. Apply `setProperties({ [propertyName]: value })`
5. Return the refreshed normalized property snapshot for that property

The server should expose this through:
- HTTP: `/api/set-component-property`
- MCP tool: `set_component_property`

### Value handling
To keep Stage 4 tight, the bridge will accept:
- string values
- boolean values

That covers common Figma component property types used in practice:
- text properties
- boolean properties
- variant values
- instance swap ids represented as strings

No conversion layer will be added in Stage 4 beyond pass-through validation.

## Error handling
The plugin should fail clearly when:
- target node is missing
- node has no component properties
- node is not writable through `setProperties`
- requested property name does not exist

## 검증
Live verification for Stage 4 should be split:
1. `list_component_properties` can be verified immediately on a known instance
2. `set_component_property` implementation can be smoke-tested only after explicit user approval for a disposable test instance
