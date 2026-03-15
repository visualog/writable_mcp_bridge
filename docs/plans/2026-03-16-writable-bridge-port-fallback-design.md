# Writable Bridge Port Fallback Design

## Goal
Prevent local bridge startup failures when `127.0.0.1:3845` is already occupied by another process, including Figma itself.

## Constraint
Figma development plugins can only call local origins listed in `devAllowedDomains`. That means the fallback range must be explicit and finite.

## Design

### Allowed port range
Use this fixed range:
- `3845`
- `3846`
- `3847`
- `3848`
- `3849`

### Server behavior
On startup:
1. If `PORT` is set, try that first
2. Otherwise try the fixed range in order
3. Bind to the first available port
4. Print the chosen port in the server startup log

### Plugin behavior
The plugin UI should:
1. Probe the same port list via `/health`
2. Pick the first origin that returns a valid bridge health payload
3. Use that origin for register, selection publish, command poll, and result publish
4. Show the connected origin in the UI

### Health contract
The health response should expose:
- `ok`
- `port`
- `server`

This lets the plugin distinguish the writable bridge from unrelated local servers.

## Verification
1. Start one process on `3845`
2. Start the bridge
3. Confirm it binds to the next free allowed port
4. Reopen the plugin
5. Confirm UI shows the connected fallback origin
