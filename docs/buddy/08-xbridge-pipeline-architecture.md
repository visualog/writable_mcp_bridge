# Xbridge Pipeline Architecture

이 문서는 Xbridge가 Buddy를 참고해 개선해야 할 실제 제품 흐름을 정리합니다. 핵심은 특정 요청마다 전용 분석기를 계속 만드는 것이 아니라, 어떤 요청이 오더라도 같은 파이프라인으로 읽고, 판단하고, 답변하거나 실행하는 구조를 만드는 것입니다.

## 목표

사용자가 Figma 안의 Xbridge 채팅에 요청을 입력하면 다음 순서가 안정적으로 실행되어야 합니다.

```text
사용자 요청
-> Figma plugin UI
-> Bridge server
-> Figma read/write command
-> context/evidence model
-> Codex CLI
-> Codex structured response
-> Bridge server
-> Figma plugin UI response or Figma write
-> optional readback validation
```

## 역할 분리

### Frontend: Figma plugin UI

프론트엔드는 사용자가 보는 부분입니다.

- 사용자의 자연어 요청, 첨부 이미지, 현재 선택 상태를 서버로 보냅니다.
- 진행 상태를 숨기지 않고 `의도 분류 -> Figma 읽기 -> Context 정리 -> Codex 분석 -> 응답/실행 판단`으로 보여줍니다.
- 서버가 반환한 답변, 부분 성공, 실패, 실행 후보를 구분해서 보여줍니다.
- 직접 복잡한 분석을 하지 않습니다. UI는 사용자의 신뢰를 얻기 위한 상태 표시와 입력/결과 표시를 담당합니다.

### Backend: Bridge server

백엔드는 파이프라인의 지휘자입니다.

- 요청을 intent로 분류합니다.
- Figma에서 필요한 데이터를 결정적으로 읽습니다.
- 읽기 결과를 Codex가 이해하기 쉬운 `contextModel`, `evidence`, `pipeline`으로 압축합니다.
- Codex CLI를 호출할 때 request, context, evidence, output contract를 함께 보냅니다.
- Codex 결과가 유효한 JSON인지 검증하고, 실패하면 deterministic fallback을 반환합니다.
- Figma를 수정해야 하는 요청이면 write command를 만들고 실행한 뒤 readback validation으로 확인합니다.

### Figma Command Layer

Figma command layer는 실제 Figma 파일에 접근하는 부분입니다.

- selection, page, node details, component properties, token snapshot, export image 같은 원본 데이터를 읽습니다.
- 화면 생성/수정 요청에서는 create/update/move/write 명령을 실행합니다.
- green plugin UI나 active session만 믿지 않고 command 결과를 기준으로 성공 여부를 판단합니다.

### Codex CLI

Codex CLI는 분석과 응답 구성을 담당합니다.

- Figma에 직접 접근하지 않습니다.
- 브리지가 준 context와 evidence만 사용합니다.
- raw Figma 데이터를 다시 추측하지 않습니다.
- deterministic report가 있으면 덮어쓰지 않고 보강합니다.
- 출력은 서버가 파싱할 수 있는 구조화 JSON이어야 합니다.

## 현재 구현된 계약

`src/ai-designer-server-contract.js`의 `buildDesignerPipelineSnapshot`은 브리지가 Codex CLI에 넘기는 파이프라인 스냅샷입니다.

포함 정보:

- `request`: 사용자 요청 원문
- `intent`: 요청 종류, 대상 타입, 선택 필요 여부
- `read`: 실행한 read command, 성공/실패/스킵 수, 경고
- `context`: 선택 노드, 구조 요약, 디자인 시스템/토큰 요약
- `deterministicEvidence`: 서버가 이미 판단한 report, findings, recommendations
- `responsePolicy`: evidence-first, 추측 금지, deterministic report 보존, limitations 분리

`src/codex-cli-runner.js`는 이 스냅샷을 Codex CLI prompt에 포함합니다. 그래서 Codex는 “무엇을 읽었는지”와 “무엇은 부족한지”를 알고 답변할 수 있습니다.

## Buddy에서 참고한 점

Buddy의 강점은 전용 컬러 분석기가 아니라, 사용자가 분석을 받고 있다고 느끼게 하는 운영 방식입니다.

- 먼저 “노드를 읽겠다”고 기대를 설정합니다.
- read/action 단계를 사용자에게 노출합니다.
- 읽은 데이터에서 근거를 뽑습니다.
- 근거 기반으로 잘 된 점, 개선점, 우선순위, 다음 액션을 구성합니다.
- 데이터가 부족해도 가능한 진단과 판단 제한을 분리합니다.

Xbridge는 이 패턴을 pipeline contract로 일반화해야 합니다. 컬러, 컴포넌트, 프레임, 이미지 재구성은 모두 같은 파이프라인을 타되, evidence extraction과 QA 기준만 달라집니다.

## 요청별 처리 방식

### 분석 요청

예: “선택한 프리미티브 컬러를 분석하고 개선이 필요한지 알려줘”

처리:

- intent를 `inspect/analyze`로 분류합니다.
- 선택 노드와 가능한 토큰/변수 요약을 읽습니다.
- 읽은 데이터로 evidence를 만듭니다.
- Codex CLI에 evidence와 pipeline을 넘깁니다.
- 답변은 근거, 진단, 개선 우선순위, 한계 순서로 반환합니다.

### 수정 요청

예: “이 버튼을 디자인 시스템에 맞게 정리해줘”

처리:

- intent를 `modify/apply_design_system`으로 분류합니다.
- 현재 선택, 컴포넌트 후보, 토큰 후보를 읽습니다.
- Codex가 수정 계획을 구조화합니다.
- 서버가 Figma write command로 변환합니다.
- 적용 후 다시 읽어 검증합니다.

### 생성 요청

예: “선택한 이미지를 분석해서 동일한 화면을 만들어줘”

처리:

- 선택 이미지 또는 첨부 이미지를 export합니다.
- 이미지 역할, 텍스트, 좌표를 분석합니다.
- Codex가 editable layer tree를 만듭니다.
- 서버가 Figma 노드를 생성합니다.
- 텍스트 커버리지, 좌표 커버리지, 겹침, fallback icon을 검증합니다.

## 실패/부분 성공 원칙

“데이터가 없어 판단할 수 없습니다”로 끝내면 안 됩니다.

올바른 순서:

1. 읽은 데이터와 성공한 command를 말합니다.
2. 그 데이터로 가능한 진단을 먼저 말합니다.
3. 부족한 데이터 때문에 제한되는 판단을 마지막에 분리합니다.
4. 다음에 어떤 read나 선택이 필요할지 제시합니다.

## 구현 우선순위

1. Pipeline snapshot을 모든 Codex CLI 분석/수정 경로에 전달합니다.
2. Frontend progress copy를 실제 pipeline 단계와 일치시킵니다.
3. Codex output contract를 요청 유형별로 분리하되, 공통 필드는 유지합니다.
4. Figma write가 있는 요청에는 readback validation을 필수화합니다.
5. Buddy 샘플은 regression fixture로만 사용하고, Buddy 답변을 그대로 복제하지 않습니다.

## QA 기준

통과 기준:

- 요청이 intent로 분류된다.
- 필요한 Figma read command가 실행된다.
- Codex CLI prompt에 request, context, evidence, pipeline이 포함된다.
- 응답에 가능한 진단이 먼저 나오고 limitations가 마지막에 분리된다.
- 수정/생성 요청은 Figma write 후 검증 결과를 반환한다.
- 프론트 진행 상태가 실제 백엔드 흐름과 어긋나지 않는다.

