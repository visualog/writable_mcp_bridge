# Xlog Entry Schema

Use this shape when preparing a devlog/xlog candidate.

```json
{
  "title": "Transport health observability",
  "type": "feature",
  "status": "done",
  "version": "0.5.19",
  "summary": "Added live transport health to /health and plugin UI.",
  "changedFiles": [
    "src/server.js",
    "figma-plugin/ui.html"
  ],
  "tests": [
    "npm test"
  ],
  "tags": [
    "xbridge",
    "streaming",
    "observability"
  ],
  "thumbnailHint": "Server status panel showing transport health"
}
```

Use this as a candidate payload. The xlog agent can decide final visual/card formatting.

Generate a candidate from Xbridge with:

```bash
node scripts/create-xlog-candidate.mjs --title "..."
```
