# Xlink Message Schema

Use this shape when passing work between agents.

```json
{
  "task": "Short imperative task",
  "context": "Relevant background and target files",
  "changedFiles": [
    "src/server.js"
  ],
  "tests": [
    {
      "command": "npm test",
      "result": "passed"
    }
  ],
  "risks": [
    "Live Figma session was not available"
  ],
  "nextSteps": [
    "Run live preflight after plugin reload"
  ]
}
```

Keep handoffs short, concrete, and test-oriented.
