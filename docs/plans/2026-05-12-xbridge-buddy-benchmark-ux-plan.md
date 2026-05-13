# Xbridge Buddy Benchmark UX Plan

Date: 2026-05-12
Status: Draft for execution
Source: live runtime/UI benchmark observation of Buddy in Figma Beta

## 1. Purpose

This note captures what Xbridge should learn from Buddy without copying Buddy's implementation.

The useful benchmark is not "what model Buddy uses."
The useful benchmark is how Buddy makes AI work inside Figma feel:

- active
- trustworthy
- tool-like rather than chat-like
- connected to design-system-aware actions

## 2. What Matters From The Benchmark

Observed high-value signals:

1. clear work-log style progress
2. short, action-shaped status updates
3. final result summary after the task ends
4. follow-up action buttons immediately after completion
5. visible design system participation in the workflow
6. less emphasis on settings chrome, more emphasis on task flow

This means Buddy feels less like "a chat wrapper around a model" and more like "an AI work console for Figma."

That is the main UX lesson for Xbridge.

## 3. Xbridge Design Goal

Shift Xbridge from:

- model picker + chat + hidden bridge execution

toward:

- task console + visible AI execution + explicit result summary + next actions

The user should feel:

- "the AI is doing work in my file"
- not "the plugin is waiting for a model reply"

## 4. Product Direction Implication

This benchmark strongly supports the AI-first PRD.

The gap is not only model quality.
The gap is also that Xbridge still exposes too much "chat" and too little "work state."

So the product direction should become:

- AI conversation remains the entry point
- but the main experience becomes task execution flow
- status, summary, and next actions become first-class UI objects

## 5. Recommended UX Architecture

### 5.1 Main Surface

The plugin should have four primary regions:

1. context header
2. active task log
3. result summary block
4. follow-up action rail

The message composer remains, but it should no longer visually dominate the product.

### 5.2 Context Header

Show only the most useful state:

- current file / page / selection scope
- active model
- design system mode state
- compact health indicator

Do not lead with settings or infrastructure language.

### 5.3 Active Task Log

Replace vague progress text with short execution logs.

Examples:

- `Read from 5 text nodes`
- `Generating Korean titles`
- `Validating model output`
- `Applying text updates`
- `Created Figma node`
- `Updated 5 text layers`

Important rule:
logs should describe actions, not internal implementation trivia.

### 5.4 Result Summary Block

Every task that completes should emit a summary card.

Examples:

- `텍스트 5개를 제목 형식으로 변경했습니다`
- `3개 화면을 캔버스에 추가했습니다`
- `선택 프레임 구조를 분석하고 핵심 블록을 정리했습니다`

The summary block should include:

- what changed
- how many targets were affected
- what model was used
- whether design system context was used

### 5.5 Follow-Up Action Rail

After completion, Xbridge should suggest the next 2-5 useful actions.

Examples:

- `이 톤으로 다시 제목 바꾸기`
- `더 짧게 다듬기`
- `디자인 시스템 기준으로 정리하기`
- `이 프레임 구조 설명하기`
- `비슷한 화면 추가 생성`

These should be buttons, not just text recommendations.

### 5.6 Settings Placement

Settings should stay available, but not feel central.

Model/provider selection matters before execution.
During execution, what matters more is:

- what the AI is doing
- what changed
- what can be done next

So settings should become secondary chrome, not the main visual anchor.

## 6. Design System Integration Signal

Buddy's benchmark suggests that design system awareness should be visible, not hidden.

Xbridge should surface design system participation in the main flow.

Examples:

- `Design system context: on`
- `Using local design system references`
- `No design system references used for this task`

This does not require full design-system authoring yet.
It only requires that the user can tell whether the current task is design-system-aware.

## 7. Recommended Information Hierarchy

Order the experience like this:

1. what I selected
2. what the AI is doing now
3. what changed
4. what I can do next
5. what model/settings are active
6. transport or debug detail

This is a major shift from an operations-first UI to a work-first UI.

## 8. Suggested Implementation Priorities

### Priority 1 - Log-style progress pass

Goal:
make every task feel visibly active.

Implement:

- short structured progress lines
- action verbs rather than abstract narration
- per-step elapsed time if possible

Examples:

- `Read from 3 components`
- `Generated 5 title drafts`
- `Applied 5 text updates`

### Priority 2 - Result summary card

Goal:
make completion feel explicit and satisfying.

Implement:

- one summary card per completed task
- include changed count, task type, and model used

### Priority 3 - Follow-up action buttons

Goal:
make the plugin feel like a guided workflow instead of a dead-end response surface.

Implement:

- generate a small set of context-sensitive next actions
- allow one-click reuse as the next prompt

### Priority 4 - Design system state in main flow

Goal:
make system-aware work visible and understandable.

Implement:

- compact design-system state badge in header
- mention usage in result summary when applicable

### Priority 5 - Demote settings chrome

Goal:
reduce the feeling that model configuration is the product.

Implement:

- keep settings accessible
- visually prioritize task execution and outcomes

## 9. Mapping To Current Xbridge Problems

### Problem: slow tasks feel broken

Buddy lesson:
show an execution log, not only a waiting state.

Xbridge answer:
task-log UI with short action lines.

### Problem: users do not trust what happened

Buddy lesson:
show a completion summary.

Xbridge answer:
result summary cards after every apply or analysis task.

### Problem: tasks feel one-shot and dead-ended

Buddy lesson:
offer next actions immediately.

Xbridge answer:
follow-up action buttons tied to current result type.

### Problem: product feels like bridge infrastructure

Buddy lesson:
keep tool flow in front, infrastructure in the background.

Xbridge answer:
demote settings and health UI during normal work.

## 10. What Not To Copy

Do not copy:

- Buddy's branding
- Buddy's wording
- Buddy's visual design directly
- any unverified internal implementation assumptions

Do adopt:

- progress as task log
- visible task completion
- next-action flow
- visible design-system context
- work-console framing

## 11. Recommended Delivery Sequence

### Step 1

Upgrade current progress UI into a true task log.

### Step 2

Add result summary cards for completed tasks.

### Step 3

Add follow-up action buttons for the most common task types:

- translation
- rewrite
- title generation
- frame explanation

### Step 4

Expose design-system participation state in header and summary.

### Step 5

Reduce settings prominence and shift the plugin toward task-console hierarchy.

## 12. Success Signal

This benchmark work is successful when a user says:

- "I can tell what Xbridge is doing"
- "I can see what changed"
- "I know what to do next"
- "This feels like an AI tool working in Figma, not just a model chat window"
