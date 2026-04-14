# Stale Server Process

## Symptoms

- `/health` returns `ok: true`, but expected fields are missing.
- `serverVersion` does not match the plugin UI.
- `transportCapabilities` or `transportHealth` is absent.
- Tests pass locally, but the live plugin behaves like an older bridge.

## Fix

```bash
lsof -ti tcp:3846
npm run start:keychain
curl -s http://127.0.0.1:3846/health
```

If a process is still holding the port, stop it intentionally, then restart from the current repo.

## Rule

Do not debug API behavior against a server that does not expose the current `/health` contract.
