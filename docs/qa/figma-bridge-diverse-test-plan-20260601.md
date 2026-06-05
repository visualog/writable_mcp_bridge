# Figma Xbridge Diverse Test Plan - 2026-06-01

> Korean execution companion: `docs/qa/figma-designer-workflow-test-plan-20260601.ko.md`

## Purpose

This plan defines broad Figma-side QA coverage for Xbridge. It is not a single smoke test. It is a repeatable matrix for validating that the bridge works as a Figma-native agent across reading, analysis, response display, writing, image reconstruction, token/design-system inspection, failure handling, and realtime transport.

## Current Baseline

Checked before writing this plan:

- Workspace: `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`
- Server version: `0.5.65`
- `/health`: `ok=true`
- Transport: `healthy`
- Command readiness: `ready`
- Write readiness: `ready`
- Active sessions at check time: `page:0:1`, `page:2825:3142`, `page:33276:16484`
- Session resolution: `ambiguous`, so live tests must pass an explicit `pluginId` or use the currently open Xbridge panel session.

## Test Principles

1. Test from Figma first. The user-facing plugin panel is the primary surface.
2. Every live test records the target file, page, selected node, plugin id, prompt, result, and evidence.
3. Read tests must prove what was read, not only that a message appeared.
4. Write tests must verify readback after mutation.
5. Analysis tests must show evidence before limitations.
6. Image reconstruction tests must separate image analysis, editable layer creation, and post-build quality validation.
7. Failure tests are first-class. Partial data must become actionable guidance, not a vague failure.
8. When multiple Figma sessions are open, explicit `pluginId` is required.

## Test Environments

Use at least these Figma contexts:

| Context | Purpose |
| --- | --- |
| `Agent_skill_test / Page 55` | Image selection, mobile screen reconstruction, generated screen follow-up |
| `FDS v2.0 -테스트용 / ┗ Color` | Primitive color, token export, design-system QA |
| Component pages such as `Button`, `Badge & Tag & Chip`, `Tabs`, `Toggle & Switch` | Component/instance detail and design-system alignment |
| Empty or low-content page | Empty state, selection-required, partial data fallback |
| Large design-system file/page | Dynamic-page loading, token export chunking, performance |
| Multiple Figma tabs/files open | Session ambiguity and pluginId scoping |

## Evidence Template

For every case, record:

```text
Test ID:
Figma file/page:
pluginId:
Selection:
Prompt or API call:
Expected result:
Actual result:
Evidence:
- UI screenshot or copied response
- /health snapshot if relevant
- API response or artifact path if relevant
- Created/modified node id if write occurred
Pass/Fail:
Notes:
```

## Release Gates

### Smoke Gate

Run before any demo or quick validation.

- Server health is OK.
- Active Figma plugin session is live.
- One selection read succeeds.
- One inspect-selection chat request returns structured answer.
- One harmless write creates and then reads back a QA node.
- One low-risk Designer Workflow edit such as `L01` or `L03` succeeds with readback evidence, or returns a safe unsupported response.
- One failure/selection-required path returns actionable guidance.

### Standard Gate

Run before merging feature work.

- All Smoke Gate items pass.
- Token export summary and one chunk/export path pass.
- Component/instance analysis pass.
- Image analysis-only pass.
- Image-to-screen generation pass or returns a structured quality failure.
- Response display UX pass.
- Representative Designer Workflow cases pass across layout, style/token, component, repeated edit, and safety handling.
- Transport fallback and reconnect sanity pass.
- Targeted regression tests pass.

### Release Gate

Run before treating the bridge as stable for broader use.

- All Standard Gate items pass.
- Multi-session ambiguity pass.
- Large file dynamic-page reads pass.
- Full token export with aliases/resolved values/styles either completes or returns a partial artifact with explicit warning.
- Write/readback tests pass across create, update, rename, bulk text update, variable bind when available.
- All `L01-L31` Designer Workflow Editing cases pass or are explicitly marked as safe unsupported with confirmation/refusal/partial-guidance evidence.
- Full `npm test` passes.

## Test Matrix

### A. Setup, Health, and Session

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| A01 | Server health | `curl /health` | `ok=true`, version shown, transport/command/write status visible |
| A02 | Plugin panel boot | Open Xbridge in Figma | Brand, version, WS/SSE state, stability pill visible |
| A03 | Session registration | Open `/api/sessions` or `/health` | Current Figma file/page appears as live session |
| A04 | Multi-session ambiguity | Keep 2-3 Figma files with Xbridge open | `/health.activeSessionResolution.status=ambiguous`; UI request still uses current panel session |
| A05 | Plugin panel reload | Close/reopen Xbridge panel | New UI loads without stale old behavior |
| A06 | Server restart recovery | Restart bridge while panel is open | UI reconnects, health returns ready, no stuck pending command |
| A07 | Figma Beta vs Figma App | Open both apps if available | Sessions are separate and do not steal each other's selection |

### B. Read-Only Figma Inspection

| ID | Scenario | Prompt/API | Expected |
| --- | --- | --- | --- |
| B01 | No selection | `선택한 항목 분석해줘` with nothing selected | Selection-required or current context guidance, no crash |
| B02 | Single text node | Select text and ask `선택한 텍스트 구조 읽어줘` | Text content, node type, geometry evidence |
| B03 | Single frame | Select frame and ask UX/UI review | Child count, layout evidence, recommendations |
| B04 | Instance | Select component instance | Variant/component properties and override summary |
| B05 | Component set | Select component set | Component set or variant detail, not generic frame-only answer |
| B06 | Section | Select design-system section | Section/page scope identified correctly |
| B07 | Deep nested frame | Select nested auto-layout frame | Parent/child hierarchy and spacing evidence |
| B08 | Page discovery | `GET /api/pages?pluginId=...` | Page list without loading all pages unnecessarily |
| B09 | Metadata fallback | Force or observe sparse detail path | UI labels it as limited evidence |
| B10 | Large page shallow read | Select large section | Bounded read completes, does not hang panel |

### C. AI Designer Intent and Report Quality

| ID | Scenario | Prompt | Expected |
| --- | --- | --- | --- |
| C01 | Primitive color analysis | `선택한 프리미티브 컬러를 분석하고 개선이 필요한지 분석해줘` | Token-aware read, evidence counts, issues, priorities, next actions |
| C02 | Component improvement | `선택한 컴포넌트 개선할 부분 정리해줘` | Component evidence, variant/override findings |
| C03 | Frame UX review | `선택한 화면 UX/UI 리뷰해줘` | Hierarchy/spacing/actionability findings |
| C04 | Design-system alignment | `이 화면을 디자인 시스템 기준으로 정리할 부분 알려줘` | Asset/token/component lookup appears when needed |
| C05 | Generic question | `이 파일에서 무엇을 할 수 있어?` | No unnecessary heavy read, helpful orientation |
| C06 | Ambiguous target | Ask about button while selected node is frame | UI corrects actual selected target |
| C07 | Partial evidence | Disable or fail one read path | Answer says usable evidence first, limitations last |
| C08 | Deterministic report preservation | Primitive/token evidence exists | Codex reply does not overwrite deterministic QA summary |
| C09 | Korean readability | Long Korean analysis response | No single giant paragraph; headings/lists/cards appear |
| C10 | Evidence-first response | Any analysis request | `근거` appears before `판단 제한` |

### D. Response Display UX/UI

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| D01 | Progressive assistant rendering | Run an analysis request | Blocks appear as structured assistant message, not log dump |
| D02 | Section cards | Request with evidence/issues/actions | Summary/evidence/issue/priority/action/limitation cards visible |
| D03 | Response filter | Click response filters | Only selected section type is shown; all restores full answer |
| D04 | Ledger card | Run read-backed request | `분석 반영 현황` shows read target, command, success/skip/fail counts |
| D05 | Status card | Submit long request | Reading/analyzing/validating/completed status is visible |
| D06 | Failure card | Trigger known failure | Failure appears as a card with status and actionable detail |
| D07 | Accessibility live regions | Inspect DOM or screen-reader snapshot | `role=log`, `role=status`, `aria-live=polite` exist |
| D08 | Reduced motion | Enable reduced motion | Typing/progress animations are minimized |
| D09 | Narrow panel | Resize Figma plugin panel small | Text wraps, filters do not overflow badly |
| D10 | Long answer | Ask for detailed analysis | Scroll remains usable, composer not covered |

### E. Write and Mutation

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| E01 | Create frame | Use API or prompt to create QA frame | New frame appears, node id returned |
| E02 | Create text | Create text under QA frame | Text node appears with expected text |
| E03 | Create rectangle button | Create rounded rectangle + label | Editable layers, correct parent |
| E04 | Bulk text update | Select generated text nodes and rewrite | All expected text nodes update, readback confirms |
| E05 | Rename node | Rename QA frame | Name changed in Figma and detail API |
| E06 | Move/resize | Move or resize QA child | Geometry changed and readback confirms |
| E07 | Apply fill/stroke | Change color/stroke | Style changed and no unrelated node touched |
| E08 | Bind variable | Bind variable where available | Variable binding success or clear unsupported explanation |
| E09 | Component property write | Update instance property | Property changes and readback confirms |
| E10 | Guard unsafe write | Ask broad destructive request | Requires confirmation or refuses unsafe broad mutation |

### F. Image Analysis and Reconstruction

| ID | Scenario | Prompt | Expected |
| --- | --- | --- | --- |
| F01 | Image analysis only | `선택한 이미지를 분석만 하고 화면 구현은 하지마` | No Figma nodes created; role/text/quality summary returned |
| F02 | Selected image to screen | `선택한 이미지를 분석하고 동일한 화면 생성해줘` | Editable layer tree created or structured quality failure |
| F03 | Selected frame export | Select frame screenshot/reference | Frame-safe export uses clipped viewport scope |
| F04 | Attached image | Attach image in plugin UI | Attachment reaches bridge and Codex image layout path |
| F05 | Text coverage gate | Use image with many labels | Missing text is listed; no fake pass |
| F06 | Coordinate coverage gate | Use image with rows/cards | Major roles have coordinates or failure says why |
| F07 | Overlap repair | Candidate text overlaps but role bbox can repair | Deterministic repair occurs or clear retry guidance |
| F08 | Visual sanity failure | Use problematic mobile screenshot | Failure card lists overlap/fallback/origin issues |
| F09 | Post-build readback | After generation | Created screen is read back; coverage/regression summarized |
| F10 | Follow-up on generated screen | `방금 만든 화면 간격 정리해줘` | Generated screen context is targeted, not random selection |

### G. Token and Design-System

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| G01 | Token summary | Export variable collection summary | Collection/variable counts returned quickly |
| G02 | Chunk export | Export selected chunk | Artifact or response includes token slice |
| G03 | Full token export | Include aliases/resolved/styles | Completes or partial artifact with warning |
| G04 | Primitive color QA | Color section selected | Scale gaps, naming mismatch, similar families if evidence supports |
| G05 | Semantic/theme check | Select semantic/theme sections | Primitive references and mode gaps discussed |
| G06 | Component search | Search local components | Relevant component candidates returned |
| G07 | Library asset search | Search library assets if configured | Results or explicit unavailable state |
| G08 | Design-system apply candidate | Ask to align screen | Candidate actions are previewable, not blindly applied |

### H. Transport, Realtime, and Queue

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| H01 | SSE stream | Run streaming validator | SSE responds with event-stream |
| H02 | WS command channel | Run websocket command integration | Submit/ack/result works |
| H03 | HTTP fallback | Temporarily block/close WS if possible | Polling fallback works without duplicate command |
| H04 | Reconnect | Close/reopen plugin panel | Pending/recent state recovers |
| H05 | Queue backlog | Fire several read commands | Command readiness degrades before expiry and recovers |
| H06 | Write backlog | Fire write commands sequentially | Write readiness reflects pending writes |
| H07 | Multi-session routing | Two live plugin ids | Explicit pluginId receives command; other session does not |
| H08 | Stale session prune | Leave one Figma panel idle | Stale session does not override live one |

### I. Error, Partial, and Edge Cases

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| I01 | Server down | Stop server, use plugin | Clear local server required/reconnect state |
| I02 | Plugin registered but no active file | Open panel before file ready | No misleading write-ready state |
| I03 | Missing selection for write | Ask to modify selection with no selection | Selection-required guidance |
| I04 | Unsupported node type | Try unsupported create type such as ellipse if still unsupported | Clear unsupported type message |
| I05 | Dynamic-page unloaded target | Read node on another page | Page loads by pageId or reports limitation |
| I06 | Timeout | Force long token/image read | Timeout maps to specific error, not generic failure |
| I07 | Malformed bridge response | Simulate bad HTTP 200 body | Stable `bridge_response_invalid` handling |
| I08 | Codex invalid output | Mock invalid structured output | Deterministic fallback or structured error |
| I09 | Token export partial artifact | Force chunk failure | Partial artifact path and warning returned |
| I10 | User cancels/rapid submits | Submit repeated prompts quickly | Button busy state prevents duplicate command storm |

### J. Performance and Large Files

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| J01 | Startup on large file | Open Xbridge in large DS file | No forced whole-file load; dynamic-page behavior maintained |
| J02 | Large section detail | Select section with many descendants | Bounded read, no UI freeze |
| J03 | Token summary latency | Run token summary | Fast enough for interactive use; record elapsed |
| J04 | Full export latency | Run full export | Completes within agreed budget or partial warning |
| J05 | Image generation timeout | Use large frame export | Timeout is actionable and classified |
| J06 | Soak quick | `npm run validate:streaming-first:soak:quick` | All runs pass |
| J07 | Soak standard | `npm run validate:streaming-first:soak:standard` | Use before release gate |

### K. Integration with FDS Inspector or External Consumers

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| K01 | FDS Inspector reads bridge output | Run inspector path if available | Inspector can consume bridge data |
| K02 | Snapshot-first fallback | Disable bridge dependency in inspector scenario | Inspector does not unnecessarily require bridge when snapshot exists |
| K03 | Cross-tool session pressure | Xbridge and inspector both active | Sessions remain explicit and stable |
| K04 | Handoff API | Create/list/claim/complete handoff | Local handoff contract remains stable |

### L. Designer Workflow Editing

These cases validate Xbridge as a Figma design-work assistant, not only as an API bridge. Unlike `E. Write and Mutation`, which checks atomic write commands, this section uses natural-language designer requests and verifies that Xbridge reads the current design context, applies or proposes the right Figma edit, and returns readback evidence. If a workflow is not yet supported, the expected result is a clear unsupported/confirmation/partial-guidance response rather than a silent no-op.

### Designer Workflow Coverage Matrix

| Task Type | Case IDs | What This Proves |
| --- | --- | --- |
| Layout editing | L01-L07 | Auto Layout, padding, gap, alignment, and distribution can be handled from natural-language prompts with geometry/layout readback. |
| Layer structure | L08-L12 | Grouping, frame wrapping, ungrouping, section movement, and naming cleanup are scoped to the selected nodes and verified through hierarchy/name readback. |
| Style and token application | L13-L17 | Fill, text, stroke/effect, semantic variable binding, and safe unbinding are applied only when token/style evidence is available. |
| Component operations | L18-L20 | Instance swap, variant/property update, and component replacement avoid blind destructive edits and leave component/source evidence. |
| Screen improvement | L21-L23 | Broad polish requests become scoped hierarchy, spacing, and cleanup actions or safe preview plans. |
| Repeated and batch editing | L24-L26 | Multi-selection buttons, repeated cards, and table/list rows can be changed consistently with per-target readback. |
| Safety and guarded mutation | L27-L31 | Locked, hidden, masked, image-filled, and instance override cases are skipped, refused, or confirmed before risky mutation. |

| ID | Scenario | Prompt | Selection | Expected Figma Change | Readback Evidence | Failure Handling |
| --- | --- | --- | --- | --- | --- | --- |
| L01 | Apply Auto Layout | `선택한 카드 묶음을 세로 Auto Layout으로 정리하고 간격을 12로 맞춰줘` | Frame or group with stacked children | Parent uses vertical auto layout, item spacing 12, children remain in visual order | Node detail shows `layoutMode=VERTICAL`, `itemSpacing=12`, child order unchanged | If selection cannot accept auto layout, explain supported target types |
| L02 | Change Auto Layout direction | `이 버튼 그룹을 가로 정렬로 바꾸고 좌우 padding을 맞춰줘` | Auto-layout frame or button group | Layout direction changes to horizontal and padding is normalized | Readback shows horizontal layout and padding values | If mixed/non-frame selection, propose wrapping in a frame first |
| L03 | Normalize padding | `선택한 카드 padding을 16으로 통일해줘` | Auto-layout frame/card | Padding left/right/top/bottom becomes 16 | Node detail confirms padding values | If no auto layout, explain that padding requires auto-layout frame |
| L04 | Normalize gap | `리스트 행 사이 간격을 8로 통일해줘` | List frame with rows | Item spacing becomes 8 or row y positions become consistent | Layout/readback shows spacing samples near 8 | If rows are absolute positioned, return proposed move plan or ask confirmation |
| L05 | Align left edges | `선택한 요소들의 왼쪽 기준선을 맞춰줘` | Multiple nodes | Selected nodes share same x position or parent alignment is updated | Readback geometry x values match | If selection has one node, return selection guidance |
| L06 | Center align objects | `선택한 아이콘과 텍스트를 세로 중앙 정렬해줘` | Icon/text pair or row | Cross-axis alignment centers children | Node detail shows alignItems/geometry center match | If unsupported, propose row wrapper and ask confirmation |
| L07 | Distribute horizontal spacing | `상단 탭들을 같은 간격으로 배치해줘` | Multiple tabs | x positions become evenly distributed or auto layout spacing set | Readback geometry deltas are consistent | If parent constraints prevent move, explain limitation |
| L08 | Wrap layers in frame | `선택한 레이어들을 하나의 프레임으로 묶어줘` | Multiple loose layers | New frame contains selected layers, visual bounds preserved | New frame id, child ids, bounding box readback | If selection includes locked/remote instance children, partial guidance |
| L09 | Group layers | `선택한 요소들을 그룹으로 묶어줘` | Multiple editable layers | Group or frame grouping created per supported contract | Parent/children structure readback | If group command unsupported, explain alternative frame wrapping |
| L10 | Ungroup or flatten structure | `이 불필요한 그룹을 풀고 레이어를 정리해줘` | Group/frame | Children move to parent without visual drift, or safe plan returned | Parent/child hierarchy before/after | If destructive, require confirmation before mutation |
| L11 | Move to section | `선택한 컴포넌트를 Component 섹션 아래로 옮겨줘` | Component/frame | Node parent changes to target section or move plan is proposed | Node parent id/name readback | If target section ambiguous, ask user to select destination |
| L12 | Apply naming rule | `선택한 모바일 화면 레이어 이름을 규칙에 맞게 정리해줘` | Screen/frame | Layer names follow app-screen naming rule | Name list readback before/after | If naming preset missing, return supported naming rules |
| L13 | Apply color token | `선택한 버튼 색상을 primary 토큰으로 바꿔줘` | Button/frame/shape | Fill is bound to or matched with primary token | Fill/variable binding readback | If token not found, show closest candidates and do not guess |
| L14 | Apply text style | `제목 텍스트에 FDS heading 스타일을 적용해줘` | Text node(s) | Text style or font attributes updated | Text style/font readback | If style lookup unavailable, explain available style evidence |
| L15 | Apply stroke/effect style | `선택한 카드에 기본 border와 shadow 스타일을 적용해줘` | Card/frame | Stroke/effect style applied or tokenized values set | Stroke/effects readback | If effect style unsupported, return manual values and limitation |
| L16 | Bind semantic variable | `이 배경색을 semantic surface 변수에 연결해줘` | Shape/frame | Fill variable binding points to semantic surface variable | Bound variable id/key readback | If mode/collection conflict exists, explain collection/mode mismatch |
| L17 | Unbind variable safely | `선택한 색상 변수 연결을 해제하고 현재 색상은 유지해줘` | Variable-bound node | Binding removed, resolved color preserved | Binding absent and color value unchanged | If resolved value unavailable, require confirmation |
| L18 | Instance swap | `이 아이콘을 검색 아이콘 인스턴스로 교체해줘` | Icon instance | Instance swap changes to requested component | Instance/source component readback | If multiple matches, show candidates and do not swap blindly |
| L19 | Update variant property | `선택한 버튼을 large / primary / disabled 상태로 바꿔줘` | Component instance | Variant/component properties updated | Variant properties readback | If property names differ, map safely or report available properties |
| L20 | Replace drawn layer with component | `직접 그린 버튼을 디자인 시스템 버튼 컴포넌트로 대체해줘` | Drawn button layers | Component instance replaces drawn layers, label preserved | Instance source and text readback | If replacement is destructive, require confirmation and preserve backup |
| L21 | Polish visual hierarchy | `이 화면의 정보 계층을 더 명확하게 다듬어줘` | Screen/frame | Title/body/action hierarchy adjusted or action plan returned | Font size/weight/position changes readback | If broad edit risk is high, return preview plan before applying |
| L22 | Normalize spacing across screen | `이 화면 전체 간격을 FDS 기준으로 정리해줘` | Screen/frame | Repeated spacing values are normalized | Spacing samples before/after | If many absolute nodes, propose scoped edits and ask confirmation |
| L23 | Remove redundant helper layers | `불필요한 빈 프레임과 중복 텍스트를 정리해줘` | Screen/frame | Empty/redundant layers removed or flagged | Removed/skipped node list and readback count | Require confirmation before deleting non-empty or named layers |
| L24 | Batch edit multiple buttons | `선택한 버튼들을 모두 같은 높이와 radius로 맞춰줘` | Multiple buttons | Height/radius normalized across selected buttons | Geometry/radius readback for each target | If some targets are instances, split supported/unsupported results |
| L25 | Batch edit repeated cards | `카드 리스트의 제목/본문 간격을 모두 같게 맞춰줘` | List/card container | Repeated card internal spacing normalized | Per-card spacing samples readback | If pattern detection is weak, return candidate groups first |
| L26 | Batch edit table/list rows | `테이블 행 높이를 40으로 통일하고 텍스트를 왼쪽 정렬해줘` | Table/list frame | Row heights and text alignment normalized | Row geometry and text alignment readback | If rows use mixed structures, partial changes are reported by row |
| L27 | Locked layer safety | `선택한 화면 전체를 정리해줘` | Frame with locked layers | Editable layers only are changed or no mutation occurs | Locked node ids listed as skipped | Locked layers are never modified silently |
| L28 | Hidden layer safety | `숨겨진 레이어까지 포함해서 정리해줘` | Frame with hidden layers | Visible layers handled; hidden layers require explicit confirmation | Hidden node list and skipped status | Refuse hidden-layer mutation unless explicitly confirmed |
| L29 | Mask/image safety | `이 이미지 카드들을 같은 크기로 맞춰줘` | Masked/image-filled cards | Container size changes without corrupting image fill/mask | Image fill/mask status readback | If image crop/mask edit unsupported, preserve image and report limitation |
| L30 | Instance override safety | `이 인스턴스 안의 텍스트와 색상을 직접 고쳐줘` | Component instance | Supported overrides apply; risky detach/direct edits are blocked | Override properties readback | If detach is required, ask confirmation and explain consequence |
| L31 | Mask node safety | `마스크로 잘린 이미지 카드까지 포함해서 정리해줘` | Mask node or masked image group | Mask node is not resized/recolored unless explicitly allowed | Mask flag and geometry readback remain unchanged | Refuse mask-node mutation unless `allowMask` or equivalent confirmation is explicit |

## Recommended Execution Order

### 30-Minute Smoke

1. A01, A02, A03
2. B02 or B03
3. C03
4. D01, D04
5. E01, E02, E05
6. L01 or L03
7. I03
8. `node --test tests/ui-designer-contract.test.js`

### 2-Hour Standard QA

1. Full Smoke
2. C01, C02, C04, C07
3. D01-D10
4. F01, F02, F08, F10
5. G01-G04
6. H01, H02, H07
7. I01, I06, I08
8. L01-L06, L12-L16, L19, L21-L24, L27-L31
9. Targeted tests:

```bash
node --check src/server.js
node --check src/codex-cli-runner.js
node --test tests/ui-designer-contract.test.js
node --test tests/ai-designer-chat-api.integration.test.js
node --test tests/codex-cli-runner.test.js
node --test tests/token-export-contract.test.js
```

### Release QA

1. Full Standard QA
2. E01-E10
3. G01-G08
4. H01-H08
5. J01-J07
6. K01-K04 if the dependent app is in scope
7. DS01 real design-system component evidence check with `XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1`
8. L01-L31
9. Full regression:

```bash
XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1 XBRIDGE_QA_DS_FILE_KEY=<figma-file-key> node scripts/run-figma-designer-workflow-live-qa.mjs
npm test
npm run validate:streaming-first
npm run validate:streaming-first:soak:quick
```

## Pass Criteria

A QA cycle passes only when:

- No critical health/read/write/transport failure remains.
- All Figma write tests have readback evidence.
- Designer workflow edits have prompt, selection, expected change, readback evidence, and failure-handling records.
- Release DS component checks prove that the bridge can find real file component/component-set candidates or fail with explicit missing `fileKey`/token evidence.
- Analysis responses include evidence and limitations in separate sections.
- Image reconstruction either creates editable layers with validation or fails with clear quality details.
- Multi-session ambiguity does not cause cross-file selection leakage.
- Targeted regression tests pass.
- Any skipped test is explicitly marked out of scope with a reason.

## Failure Severity

| Severity | Definition | Examples |
| --- | --- | --- |
| Critical | Blocks core use or risks wrong file/node mutation | Wrong pluginId target, write to wrong page, server crash |
| High | Major user trust or data quality failure | Vague failure, missing evidence, image generation false pass |
| Medium | Workflow degradation with workaround | Partial token export warning, slow large section read |
| Low | Cosmetic or copy issue | Minor spacing, wording, filter label polish |

## QA Report Output

After a live run, create a report under `docs/qa/` named:

```text
xbridge-qa-YYYYMMDD-HHMM.md
```

Include:

- Environment
- Figma file/page/pluginId
- Test cases run
- Pass/fail table
- Evidence links or artifact paths
- Created/modified Figma node ids
- Bugs found
- Fixes made during QA
- Remaining risks
- Final gate verdict

Designer Workflow live runs automatically generate `summary.md` next to `results.json`. To regenerate it manually from an existing artifact:

```bash
node scripts/summarize-designer-workflow-qa.mjs --input docs/qa/runs/<designer-workflow-run>/results.json --require-release-gates
```

The generated `summary.md` must be treated as the release verdict. A raw `results.json` with all cases marked `pass` is not sufficient if release-required evidence such as `RAG01` or `DS01` is missing.

After live workflow, response UI, RAG evidence, and regression checks are collected, run the release readiness audit:

```bash
node scripts/audit-designer-workflow-release-readiness.mjs
```

This writes `docs/qa/release-readiness-latest.json` and `docs/qa/release-readiness-latest.md`. The release is not ready unless this audit reports `Release readiness: PASS`.

If no live Figma plugin session is available, the live runner must not fail with only a stack trace. It must write `live-readiness.json` and `live-readiness.md` in the run directory with:

- `/health` status, server version, transport grade, command readiness, and write readiness
- `activeSessionResolution` reason such as `no_live_session` or `multiple_live_sessions`
- required next action such as opening the Xbridge plugin panel or setting `XBRIDGE_QA_PLUGIN_ID`

This readiness artifact is not a pass verdict. It is blocked-run evidence that explains why the live canvas mutation/readback cases could not execute.
