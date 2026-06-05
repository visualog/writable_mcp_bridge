# Designer Workflow Live Readiness

- ok: false
- reason: no_live_session
- serverVersion: 0.5.65
- transport: standby
- commandReadiness: unavailable
- writeReadiness: unavailable
- requiresExplicitPluginId: false
- explicitPluginId: (none)
- livePluginIds: (none)

## Summary

활성 Figma plugin session이 없어 live workflow runner를 실행할 수 없습니다.

## Next Actions

- Figma에서 Xbridge 플러그인 패널을 열고 heartbeat가 active가 될 때까지 기다리세요.
- /health에서 commandReadiness와 writeReadiness가 ready인지 다시 확인하세요.
