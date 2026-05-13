# Xbridge Task Console UI Backlog

Date: 2026-05-12
Status: Active design-to-build backlog
Companion docs:

- `docs/plans/2026-05-12-xbridge-buddy-benchmark-ux-plan.md`
- `docs/plans/2026-05-12-xbridge-ai-first-prd.md`
- `docs/plans/2026-05-12-xbridge-ai-first-stabilization-backlog.md`

## 1. Purpose

This backlog converts the Buddy benchmark UX direction into concrete Xbridge UI build slices.

The target is not a visual redesign for its own sake.
The target is to make Xbridge feel like a task console instead of a model chat wrapper.

## 2. Build Goal

Turn the current plugin UI into a work-focused surface with these visible states:

1. current context
2. current task log
3. result summary
4. next actions
5. secondary settings and health

## 3. Delivery Order

### Slice 1

Task-log progress UI

### Slice 2

Result summary cards

### Slice 3

Follow-up action buttons

### Slice 4

Design-system state in the main flow

### Slice 5

Settings demotion and layout rebalance

## 4. Slice 1 - Task-Log Progress UI

### Objective

Replace vague progress text with short, console-like task logs.

### User problem

Right now the user can still feel like the plugin is waiting silently.
Even when work is happening, the experience does not always feel active.

### UI requirements

- show a live active-task block near the center of the workflow
- render short step logs with action verbs
- keep the current step visually distinct
- show elapsed time
- show target scope when relevant

### Example log lines

- `Read from 5 text nodes`
- `Generating 5 Korean titles`
- `Validating model output`
- `Applying 5 text updates`
- `Updated 5 text layers`

### Data requirements

- task type
- target count
- current stage
- stage detail
- elapsed time
- terminal state

### Implementation notes

- reuse current progress-state machinery where possible
- change presentation from abstract narrative to task-log format
- prefer one-line stage messages
- do not expose internal debugging jargon

### Done when

- every non-trivial task shows short stage lines
- users can tell whether the system is reading, generating, validating, or applying
- completed tasks stop looking active

## 5. Slice 2 - Result Summary Cards

### Objective

Give every completed task a clear visible ending.

### User problem

Users need to know what actually happened without re-reading the whole conversation.

### UI requirements

- render a summary card after task completion
- separate summary from raw chat transcript
- support both read-only tasks and apply tasks

### Example summaries

- `텍스트 5개를 AI 기술 트렌드 게시물 제목으로 변경했습니다`
- `선택한 텍스트 7개를 한글로 번역 적용했습니다`
- `선택 프레임 구조를 분석하고 핵심 블록을 정리했습니다`
- `3개 화면을 캔버스에 추가했습니다`

### Card contents

- task result sentence
- affected target count
- active model used
- optional design-system-used badge
- optional warning state if output needed recovery

### Data requirements

- task type
- status
- count changed or analyzed
- selected model label
- design system participation flag
- fallback or recovery metadata if user-visible

### Done when

- task completion is visible without reading all prior messages
- the user can tell what changed and how much changed

## 6. Slice 3 - Follow-Up Action Buttons

### Objective

Make the plugin feel guided instead of dead-ended after a result.

### User problem

After a task completes, the user often has an obvious next step but has to type it manually.

### UI requirements

- show 2-5 suggested follow-up actions under the result summary
- each action should be one-click runnable as the next prompt seed
- actions must reflect the current task type and context

### Example follow-up actions

For translation:

- `더 자연스럽게 다듬기`
- `더 짧은 UI 문구로 바꾸기`
- `원문과 나란히 비교하기`

For title generation:

- `더 전문적인 톤으로 다시 만들기`
- `더 짧은 제목으로 다시 만들기`
- `2026년 전망 중심으로 다시 만들기`

For frame explanation:

- `계층 문제만 요약하기`
- `간격 개선안 제안하기`
- `디자인 시스템 기준으로 보기`

### Data requirements

- task type
- result metadata
- current context type
- optional intent classification

### Implementation notes

- first version can use deterministic suggestion templates by task kind
- later versions can allow the selected model to propose next actions

### Done when

- the user can continue the workflow without always typing a fresh prompt

## 7. Slice 4 - Design System State In Main Flow

### Objective

Make design system participation visible in the working surface.

### User problem

Users should not have to guess whether a task used design-system-aware logic.

### UI requirements

- show a compact design-system badge in the context area
- mention design system usage in summary cards when relevant
- support states such as:
  - `DS On`
  - `DS Context Used`
  - `DS Not Used`

### Data requirements

- whether DS lookup happened
- whether DS reference influenced output
- whether the task was DS-eligible but unused

### Done when

- users can tell whether the current task was design-system-aware

## 8. Slice 5 - Settings Demotion And Layout Rebalance

### Objective

Make settings and transport chrome feel secondary to the work experience.

### User problem

The plugin can still feel like configuration UI with a chat box attached.

### UI requirements

- keep model/settings accessible
- reduce visual dominance of settings controls during normal work
- move execution, summary, and next steps higher in hierarchy
- keep health state compact unless there is a problem

### Layout target

Preferred order:

1. context
2. active task
3. result summary
4. next actions
5. composer
6. model/settings
7. expanded debug or health

### Done when

- the plugin reads as a work console first and a settings tool second

## 9. Technical Dependencies

### Existing pieces we can reuse

- current progress state model in `figma-plugin/ui.html`
- AI result metadata returned by server paths
- model/provider state from `/api/designer/models`
- task classification and rewrite metadata from AI designer endpoints

### Likely additions needed

- normalized task summary payload
- normalized follow-up action payload
- normalized design-system participation metadata
- unified task-completion event shape

## 10. API/State Additions To Consider

### Client-side additions

- `activeTaskLog`
- `lastTaskSummary`
- `followUpActions`
- `designSystemUsageState`

### Server-side additions

- result summary fields for text tasks
- task metadata for affected count and apply status
- optional DS usage hints
- optional next-action suggestions

## 11. Suggested Build Sequence

### Step 1

Implement Slice 1 without changing the server contract too much.

### Step 2

Add a normalized summary payload for the most common completed tasks.

### Step 3

Render follow-up action buttons using deterministic task-type templates.

### Step 4

Add DS usage metadata and display.

### Step 5

Rebalance layout and visually demote settings.

## 12. Acceptance Review Checklist

Use this checklist when reviewing the UI after each slice:

- can I tell what is happening right now
- can I tell whether work is blocked or active
- can I tell what changed when the task ends
- can I continue the workflow in one click
- can I tell which model did the work
- can I tell whether design system context was involved
- does the plugin feel more like a work console than a chat widget

## 13. Non-Goals For This Pass

This backlog does not require:

- a full visual rebrand
- advanced animation work
- a fully AI-generated next-action system
- complete design-system authoring support
- replacing the whole plugin layout in one shot

The focus is execution clarity and task UX, not maximum surface change.
