# Transport Health Contract

`transportHealth` summarizes live streaming posture for agents and the plugin UI.

## Sources

- `GET /health`
- `GET /api/runtime-ops`

## Shape

```json
{
  "grade": "healthy",
  "summary": "스트리밍 연결이 안정적입니다.",
  "reason": "활성 SSE/WS 클라이언트와 최근 스트림 신호가 유지되고 있습니다.",
  "activeClients": {
    "sse": 1,
    "ws": 0,
    "total": 1
  },
  "recent": {
    "recentWsAckTotal": 0,
    "recentWsResultTotal": 0,
    "recentFallbackTotal": 0,
    "recentDeliveredTotal": 0,
    "recentSignalTotal": 0,
    "fallbackRate": 0
  },
  "fallbackRate": 0,
  "wsDispatchSuccessRate": 0
}
```

## Grades

- `healthy`: streaming clients or recent streaming signals are present with low fallback pressure.
- `degraded`: fallback pressure or command failures are rising.
- `unhealthy`: recent failures or fallback pressure are high.
- `standby`: no active streaming signal yet.

## Agent Rule

Use `transportHealth` to decide whether to trust WS-first reads or to lean on HTTP fallback for a task.
