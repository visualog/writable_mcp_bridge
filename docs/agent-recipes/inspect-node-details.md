# Inspect Node Details

Use detail APIs when metadata is too coarse for implementation.

## Node Detail

```bash
curl -s --json '{"pluginId":"<pluginId>","targetNodeId":"<nodeId>"}' \
  http://127.0.0.1:3846/api/get-node-details
```

## Component Variant Detail

```bash
curl -s --json '{"pluginId":"<pluginId>","targetNodeId":"<componentOrSetId>"}' \
  http://127.0.0.1:3846/api/get-component-variant-details
```

## Instance Detail

```bash
curl -s --json '{"pluginId":"<pluginId>","targetNodeId":"<instanceId>"}' \
  http://127.0.0.1:3846/api/get-instance-details
```

## Fallback Behavior

If plugin-native detail fails, Xbridge may return `metadata_fallback`. This is still useful for layout, variant properties, and component property definitions, but it is not the same as full plugin detail.

See `../troubleshooting/detail-api-fallback.md`.
