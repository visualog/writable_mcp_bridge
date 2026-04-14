# Recovery: Server Down Or Stale

Use this when the plugin UI reports server unavailable, stale server, or missing transport fields.

## Checks

```bash
curl -s http://127.0.0.1:3846/health
lsof -ti tcp:3846
```

## Recovery

1. Stop old local server process if needed.
2. Run `npm run start:keychain`.
3. Re-run `/health`.
4. Confirm `serverVersion`, `transportCapabilities`, and `transportHealth`.
5. Re-register the plugin session if current file metadata is stale.

## Signals Of Old Server

- `/health` works but lacks `transportCapabilities`.
- `/health` works but lacks `transportHealth`.
- `serverVersion` differs from the plugin UI version.
- `/api/pages` or detail APIs behave unlike the current tests.
