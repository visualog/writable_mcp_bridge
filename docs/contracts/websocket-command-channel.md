# WebSocket Command Channel Contract

## Path

```text
/api/ws?pluginId=<pluginId>
```

## Request

```json
{
  "type": "ws.command.request",
  "requestId": "req-1",
  "pluginId": "page:example",
  "command": "get_metadata",
  "args": {
    "targetNodeId": "10:1",
    "includeJson": true
  }
}
```

## Expected Events

- `ws.hello`
- `ws.command.ack`
- `ws.command.result`
- `ws.command.error`

## Supported Read Commands

- `ping`
- `get_selection`
- `get_metadata`
- `get_node_details`
- `get_component_variant_details`
- `get_instance_details`

HTTP fallback remains required.
