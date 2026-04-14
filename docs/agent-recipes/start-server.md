# Start Server

Use this when the bridge UI says the server is unavailable or when `/health` fails.

## Command

```bash
npm run start:keychain
```

The default local origin is:

```text
http://127.0.0.1:3846
```

## Verify

```bash
curl -s http://127.0.0.1:3846/health
node scripts/agent-preflight.mjs
```

Expected health fields:

- `ok: true`
- `server: "writable-mcp-bridge"`
- `serverVersion`
- `transportCapabilities`
- `runtimeFeatureFlags`
- `transportHealth`

If the version or transport fields are missing, an older server process is probably running.
