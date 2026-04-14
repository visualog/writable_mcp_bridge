# Xbridge REST API Contract

The OpenAPI source of truth is `docs/writable-mcp-bridge.openapi.yaml`.

## High-Value Routes

- `GET /health`
- `GET /api/runtime-ops`
- `GET /api/sessions`
- `GET /api/pages?pluginId=<pluginId>`
- `POST /api/get-metadata`
- `POST /api/get-node-details`
- `POST /api/get-component-variant-details`
- `POST /api/get-instance-details`

## Agent Rule

Do not infer routes from implementation code first. Check this contract, OpenAPI, and recipes.
