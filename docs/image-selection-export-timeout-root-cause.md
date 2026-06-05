# 이미지 선택 분석 실패 원인 리포트

## 요약

기존 테스트 이미지가 아닌 `Running Challenge` 화면을 선택한 뒤 이미지 분석과 화면 구현을 요청하면, 구현 단계까지 가지 못하고 선택 이미지 export 단계에서 실패했다.

UI에 표시된 실패 메시지:

```text
이미지 분석 화면 구성 실패: Timed out waiting for plugin response: export_node
```

이번 문제의 핵심은 AI가 화면을 잘못 해석한 것이 아니라, 선택한 Figma 노드를 PNG로 내보내는 `export_node` 명령이 timeout 된 것이다.

## 선택 노드 상태

당시 선택된 노드:

```text
id: 33392:3971998
name: Frame 2
type: FRAME
size: 약 402 x 870
```

선택 프레임 내부 구조:

```text
Frame 2
└─ image 2
   type: RECTANGLE
   size: 약 848 x 1060
   position: 프레임 밖까지 걸쳐 있음
```

프레임 자체는 모바일 화면 크기였지만, 내부 이미지 사각형은 프레임보다 훨씬 크고 프레임 바깥 영역까지 확장되어 있었다.

## 원인

기존 이미지 분석 경로는 선택 노드를 PNG로 export할 때 다음 옵션을 사용했다.

```js
{
  format: "png",
  scale: 1,
  contentsOnly: true
}
```

이 옵션은 rectangle 이미지 선택에는 문제가 없었지만, 이번처럼 `FRAME` 안에 큰 이미지 레이어가 들어 있고 그 이미지가 프레임 밖으로 벗어난 경우에는 export 범위가 불필요하게 커질 수 있다.

그 결과 Figma 플러그인의 `targetNode.exportAsync()`가 오래 걸리거나 응답을 돌려주지 못했고, bridge 서버는 `export_node` 응답 timeout으로 실패했다.

## 확인한 증거

bridge health 자체는 정상 상태였다.

```text
ok: true
transportHealth: healthy
commandReadiness: ready
writeReadiness: ready
activeSession: Agent_skill_test / Page 55
```

즉, 서버 연결이나 Figma 플러그인 세션 문제는 아니었다.

직접 export 실험 결과:

```text
Frame 2, scale 0.25, contentsOnly false, useAbsoluteBounds false
=> 성공
```

반면 다음 조합들은 timeout 되었다.

```text
Frame 2, scale 0.5~1
Frame 2, contentsOnly true
Frame 2, useAbsoluteBounds true
```

따라서 단순히 timeout 값을 늘리는 방식이 아니라, frame-like 선택 노드에는 더 안전한 export 옵션을 적용해야 한다.

## 수정 방향

이미지 분석용 선택 export에서 노드 타입을 구분하도록 수정했다.

일반 rectangle/image 선택:

```js
{
  format: "png",
  scale: 1,
  contentsOnly: true,
  useAbsoluteBounds: false
}
```

frame-like 선택:

```js
{
  format: "png",
  scale: 0.25,
  contentsOnly: false,
  useAbsoluteBounds: false
}
```

frame-like 대상:

- `FRAME`
- `COMPONENT`
- `COMPONENT_SET`
- `INSTANCE`
- `SECTION`

추가로 frame-like 선택에는 분석 범위를 명시하는 메타데이터를 붙인다.

```js
{
  analysisScope: "clipped_frame_viewport",
  frameViewportClipped: true,
  selectedNodeType: "FRAME"
}
```

이 메타데이터는 Codex 이미지 분석 프롬프트의 `images[]` payload로 전달된다. 프롬프트에는 다음 전제가 명시된다.

```text
images[].analysisScope가 clipped_frame_viewport인 이미지는 선택한 Figma 프레임의 clipped viewport 안에 실제로 보이는 픽셀만 분석 대상입니다.
프레임 밖으로 넘친 자식 이미지/레이어 영역은 무시하고, bbox와 canvas 크기도 보이는 프레임 viewport 기준으로 잡으세요.
```

## 반영 파일

- `src/server.js`
- `tests/ai-designer-chat-api.integration.test.js`
- `tests/ui-designer-contract.test.js`

## 추가한 검증

추가 테스트:

```text
designer chat exports selected frame screenshots with bounded frame-safe options
runCodexImageLayoutPlan instructs clipped frame viewport analysis for frame exports
```

검증 내용:

- 선택 노드가 `FRAME`일 때 `export_node`가 호출되는지 확인
- payload가 `contentsOnly: false`로 나가는지 확인
- payload가 `useAbsoluteBounds: false`로 나가는지 확인
- payload가 `scale: 0.25`로 나가는지 확인
- payload가 `analysisScope: "clipped_frame_viewport"`로 나가는지 확인
- Codex 프롬프트에 clipped viewport 기준 분석 지시가 포함되는지 확인
- 기존 rectangle 선택은 `contentsOnly: true`, `scale: 1` 동작을 유지하는지 확인

## 테스트 결과

```text
node --check src/server.js
=> pass
```

```text
node --test tests/ui-designer-contract.test.js
=> 15 pass, 0 fail
```

```text
node --test tests/codex-cli-runner.test.js
=> 40 pass, 0 fail
```

```text
node --test tests/ai-designer-chat-api.integration.test.js tests/ui-designer-contract.test.js
=> 30 pass
=> 12 skipped
=> 0 fail
```

```text
npm test
=> 490 tests
=> 478 pass
=> 12 skipped
=> 0 fail
```

## 결론

이번 실패는 이미지 분석 모델이나 화면 구현 로직의 직접 문제가 아니라, 선택한 Figma frame을 분석 이미지로 변환하는 export 단계의 옵션 문제였다.

프레임 내부의 큰 이미지 레이어가 프레임 밖까지 걸쳐 있는 구조에서 `contentsOnly: true` 또는 높은 scale export를 사용하면 timeout이 발생할 수 있다.

수정 후에는 frame-like 선택 노드에 대해 프레임 기준으로 더 작고 안정적인 PNG를 export하므로, 같은 `Running Challenge` 프레임 선택 흐름에서 `export_node` timeout으로 막힐 가능성이 낮아진다.
