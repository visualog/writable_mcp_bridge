# WS-First Read

Use WS-first for live read/detail checks when the WebSocket channel is available.

## Supported Read Commands

- `ping`
- `get_selection`
- `get_metadata`
- `get_node_details`
- `get_component_variant_details`
- `get_instance_details`

## Flow

1. Open `/api/ws?pluginId=<pluginId>`.
2. Wait for `ws.hello`.
3. Send `ws.command.request`.
4. Wait for `ws.command.ack`.
5. Wait for `ws.command.result`.
6. If unsupported or timed out, fall back to the HTTP endpoint.

## Validation

```bash
node --test tests/websocket-command-channel.integration.test.js
```

Do not remove HTTP fallback until soak and live usage prove WS-only is stable.
