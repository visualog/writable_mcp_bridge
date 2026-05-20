# Codex 내부 Tool 분석

분석 대상: `openai/codex` 소스, commit `64ead6a83a6ed348229bc98a9b5d8b0c550d8305`

이 문서는 Codex가 모델에게 제공하거나 내부 실행기로 연결하는 Tool을 정리한다. 기준 파일은 `codex-rs/core/src/tools/spec_plan.rs`의 `collect_tool_executors`이며, 각 Tool의 입력 형태는 `codex-rs/core/src/tools/handlers/*_spec.rs`, `codex-rs/tools/src/*`, `codex-rs/codex-mcp/src/*`에서 확인했다.

## 전체 구조

Codex의 Tool은 크게 두 종류다.

1. 이름이 소스에 고정된 Tool
2. MCP 서버, 앱/플러그인, 동적 도구, 확장 기능이 런타임에 공급하는 Tool

소스에 고정된 이름은 아래 표에 모두 정리했다. 단, MCP/동적/확장 도구는 외부 서버나 현재 스레드가 이름과 스키마를 공급하므로 정적 소스만으로 모든 개별 이름을 나열할 수 없다. 대신 이름 생성 규칙과 실행 방식을 따로 정리했다.

## 등록 흐름

`collect_tool_executors`는 설정과 실행 환경을 보고 Tool을 등록한다.

| 조건 | 등록되는 Tool |
|---|---|
| 실행 환경 있음, Unified Exec 사용 | `exec_command`, `write_stdin`, 호환용 `shell_command` |
| 실행 환경 있음, 기존 Shell 사용 | `shell_command` |
| MCP resource 기능 있음 | `list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource` |
| 항상 | `update_plan`, `request_user_input` |
| goal 기능 켜짐 | `get_goal`, `create_goal`, `update_goal` |
| 권한 요청 기능 켜짐 | `request_permissions` |
| 앱/플러그인 추천 기능 켜짐 | `request_plugin_install` |
| 실행 환경 있음, apply patch 지원 | `apply_patch` |
| 이미지 보기 가능 | `view_image` |
| 협업 기능 켜짐 | multi-agent Tool |
| CSV agent job 기능 켜짐 | agent job Tool |
| 웹 검색 가능 | `web_search` |
| 이미지 생성 가능 | `image_generation` |
| MCP 서버 설정 있음 | MCP 서버가 제공하는 Tool |
| dynamic tools 전달됨 | 현재 스레드가 제공하는 동적 Tool |
| extension tool contributor 있음 | 확장 기능 Tool |
| 지연 로딩 Tool이 있고 검색 기능 켜짐 | `tool_search` |
| code mode 켜짐 | `exec`, `wait` |
| 테스트 플래그 있음 | `test_sync_tool` |

## Shell / 실행 Tool

### `exec_command`

용도: PTY 기반으로 터미널 명령을 실행한다. 명령이 오래 돌면 결과 전체 대신 `session_id`를 반환하고, 이후 `write_stdin`으로 이어서 입력하거나 출력 확인이 가능하다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `cmd` | 실행할 명령 문자열. 필수 |
| `workdir` | 실행 디렉터리 |
| `shell` | 사용할 셸 |
| `tty` | TTY 할당 여부 |
| `yield_time_ms` | 출력 대기 시간 |
| `max_output_tokens` | 반환 출력 최대 토큰 수 |
| `login` | 로그인 셸 사용 여부. 설정상 허용될 때만 노출 |
| `sandbox_permissions` | 샌드박스 밖 실행 요청. 값은 `require_escalated` |
| `justification` | 권한 상승을 사용자에게 설명하는 문장 |
| `prefix_rule` | 사용자가 같은 종류 명령을 다음부터 허용할 수 있게 제안하는 prefix |
| `additional_permissions` | 실험 기능이 켜진 경우 추가 권한 요청 |

사용 예:

```json
{
  "cmd": "npm test",
  "workdir": "/path/to/project",
  "yield_time_ms": 1000,
  "max_output_tokens": 6000
}
```

반환에는 `exit_code`, `output`, `session_id`, `wall_time_seconds` 등이 포함된다.

### `write_stdin`

용도: `exec_command`가 만든 실행 세션에 글자를 보내고, 최근 출력을 받는다. 예를 들어 대화형 프로그램에 `q`, `Ctrl-C`, 줄 입력을 보낼 때 쓴다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `session_id` | 이어서 다룰 실행 세션 ID. 필수 |
| `chars` | 보낼 문자 |
| `yield_time_ms` | 출력 대기 시간 |
| `max_output_tokens` | 반환 출력 최대 토큰 수 |

사용 예:

```json
{
  "session_id": 12,
  "chars": "q",
  "yield_time_ms": 1000
}
```

### `shell_command`

용도: 기존 방식의 셸 실행 Tool이다. Unified Exec이 아닌 환경에서 기본 실행 Tool로 쓰이고, Unified Exec 환경에서도 호환용으로 함께 등록될 수 있다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `command` | 실행할 명령 문자열. 필수 |
| `workdir` | 실행 디렉터리 |
| `timeout_ms` | 제한 시간 |
| `login` | 로그인 셸 사용 여부 |
| `sandbox_permissions`, `justification`, `prefix_rule` | 권한 상승 요청용 |

## 파일 수정 / 이미지 Tool

### `apply_patch`

용도: 파일을 수정하는 freeform Tool이다. JSON이 아니라 정해진 패치 문법을 그대로 보낸다.

사용 형식:

```text
*** Begin Patch
*** Update File: path/to/file
@@
-old line
+new line
*** End Patch
```

지원 작업:

| 작업 | 문법 |
|---|---|
| 파일 추가 | `*** Add File: <path>` |
| 파일 삭제 | `*** Delete File: <path>` |
| 파일 수정 | `*** Update File: <path>` |
| 파일 이동 | `*** Move to: <path>` |

### `view_image`

용도: 로컬 파일 시스템의 이미지를 읽어 모델이 볼 수 있는 이미지 입력으로 반환한다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `path` | 이미지 파일 경로. 필수 |
| `detail` | `high` 또는 `original`. 원본 상세 보기 지원 모델에서만 `original` 사용 |
| `environment_id` | 여러 실행 환경이 있을 때 대상 환경 |

사용 예:

```json
{
  "path": "/path/to/screenshot.png",
  "detail": "original"
}
```

## 계획 / 사용자 입력 / 권한 Tool

### `update_plan`

용도: 현재 작업 계획을 사용자에게 보이는 체크리스트 형태로 갱신한다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `explanation` | 계획 변경 이유 |
| `plan` | `{step, status}` 배열. 필수 |

`status` 값은 `pending`, `in_progress`, `completed` 중 하나이며, `in_progress`는 한 번에 하나만 가능하다.

### `request_user_input`

용도: 사용자에게 1~3개의 짧은 질문을 보여주고 답을 기다린다. 일부 협업 모드에서만 사용 가능하다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `questions` | 질문 배열. 필수, 1~3개 |

각 질문은 `id`, `header`, `question`, `options`를 가진다. `options`는 2~3개이며 각 항목은 `label`, `description`을 가진다.

### `request_permissions`

용도: 현재 샌드박스에 없는 파일 시스템 또는 네트워크 권한을 요청한다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `permissions` | 요청할 권한 묶음. 필수 |
| `reason` | 왜 권한이 필요한지 설명 |

`permissions` 안에는 `network.enabled`, `file_system.read`, `file_system.write`가 들어갈 수 있다.

## Goal Tool

Goal Tool은 `/goal` 기능과 연결된다. 모델이 현재 목표와 예산을 확인하거나, 명시적으로 새 목표를 만들거나, 완료 처리할 수 있게 한다.

### `get_goal`

용도: 현재 활성 goal을 조회한다. 입력은 없다.

반환 정보에는 goal 상태, 목표 문장, 토큰 예산, 경과 시간, 사용량, 남은 예산이 포함된다.

### `create_goal`

용도: 명시적으로 요청받은 목표를 새로 만든다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `objective` | 목표 문장. 필수 |
| `token_budget` | 양수 토큰 예산 |

이미 활성 goal이 있으면 실패한다.

### `update_goal`

용도: 기존 goal을 완료 처리한다.

주요 입력:

| 이름 | 설명 |
|---|---|
| `status` | 현재 소스 기준 `"complete"`만 허용 |

## MCP Resource Tool

이 세 Tool은 MCP 서버의 “resource”를 다룬다. MCP의 function tool 호출과는 별개다.

### `list_mcp_resources`

용도: MCP 서버가 제공하는 resource 목록을 조회한다.

입력:

| 이름 | 설명 |
|---|---|
| `server` | 특정 MCP 서버 이름 |
| `cursor` | 페이지네이션 커서 |

### `list_mcp_resource_templates`

용도: 파라미터를 넣어 읽을 수 있는 MCP resource template 목록을 조회한다.

입력은 `list_mcp_resources`와 같다.

### `read_mcp_resource`

용도: 특정 MCP resource URI를 읽는다.

입력:

| 이름 | 설명 |
|---|---|
| `server` | MCP 서버 이름. 필수 |
| `uri` | 읽을 resource URI. 필수 |

## 검색 / 앱 설치 Tool

### `tool_search`

용도: 처음부터 모델에게 전부 노출하지 않은 deferred Tool을 BM25 검색으로 찾고, 다음 모델 호출에 노출한다.

입력:

| 이름 | 설명 |
|---|---|
| `query` | 검색어. 필수 |
| `limit` | 최대 결과 수. 기본값은 8 |

MCP Tool discovery는 이 Tool이 있으면 `list_mcp_resources` 대신 `tool_search`를 쓰도록 설명되어 있다.

### `request_plugin_install`

용도: 사용자가 명시적으로 특정 플러그인 또는 커넥터 사용을 요청했지만 아직 설치되어 있지 않을 때 설치 요청 UI를 띄운다.

입력:

| 이름 | 설명 |
|---|---|
| `tool_type` | `connector` 또는 `plugin`. 필수 |
| `action_type` | 현재는 `install`. 필수 |
| `tool_id` | 설치 후보 목록의 정확한 ID. 필수 |
| `suggest_reason` | 왜 필요한지 한 줄 설명. 필수 |

## Hosted Tool

Hosted Tool은 Codex가 직접 실행하지 않고 OpenAI Responses API 쪽에 전달하는 도구다.

### `web_search`

용도: 웹 검색. 설정에 따라 캐시 검색 또는 실시간 검색으로 동작한다.

주요 설정:

| 이름 | 설명 |
|---|---|
| `external_web_access` | `true`면 live, `false`면 cached |
| `filters.allowed_domains` | 허용 도메인 제한 |
| `user_location` | 검색 지역 정보 |
| `search_context_size` | 검색 문맥 크기 |
| `search_content_types` | `text`, 또는 모델에 따라 `text`와 `image` |

### `image_generation`

용도: 이미지 생성. Responses API의 `image_generation` tool로 전달된다.

주요 설정:

| 이름 | 설명 |
|---|---|
| `output_format` | 생성 이미지 포맷. 소스의 생성 함수는 문자열로 받으며 기본 사용은 `png` 계열 |

## Multi-Agent Tool

협업 기능이 켜지면 하위 에이전트를 만들고 대화하는 Tool이 등록된다. 소스에는 v1과 v2 두 계열이 있다.

### v1 Tool

| 이름 | 용도 | 주요 입력 |
|---|---|---|
| `spawn_agent` | 새 하위 에이전트 생성 | `message`, `items`, `agent_type`, `fork_context`, `model`, `reasoning_effort`, `service_tier` |
| `send_input` | 기존 에이전트에 입력 전달 | `target`, `message`, `items`, `interrupt` |
| `resume_agent` | 닫힌 에이전트 재개 | `id` |
| `wait_agent` | 에이전트 완료 또는 상태 대기 | `targets`, `timeout_ms` |
| `close_agent` | 에이전트와 하위 에이전트 종료 | `target` |

`spawn_agent`는 `agent_id`와 선택적 `nickname`을 반환한다. `send_input`은 `submission_id`를 반환한다.

### v2 Tool

| 이름 | 용도 | 주요 입력 |
|---|---|---|
| `spawn_agent` | 이름 있는 작업 에이전트 생성 | `task_name`, `message`, `agent_type`, `fork_turns`, `model`, `reasoning_effort`, `service_tier` |
| `send_message` | 에이전트에 메시지 전달. 새 턴을 강제로 시작하지 않음 | `target`, `message` |
| `followup_task` | 에이전트에 후속 작업 전달하고 턴 시작 | `target`, `message` |
| `wait_agent` | 에이전트 mailbox 업데이트 대기 | `timeout_ms` |
| `close_agent` | 에이전트 종료 | `target` |
| `list_agents` | 살아 있는 에이전트 목록 조회 | `path_prefix` |

v2는 설정에 따라 별도 namespace 아래에 노출될 수 있다. 예를 들어 namespace가 있으면 모델이 보는 이름은 namespace child tool 형태가 된다.

## Agent Job Tool

CSV 기반 대량 작업 기능이 켜질 때 노출된다.

### `spawn_agents_on_csv`

용도: CSV의 각 행마다 worker sub-agent를 하나씩 만들어 같은 지시문을 실행한다. 모든 worker가 끝날 때까지 대기한다.

입력:

| 이름 | 설명 |
|---|---|
| `csv_path` | 입력 CSV 경로. 필수 |
| `instruction` | 각 행에 적용할 지시문. 필수 |
| `id_column` | 행 ID 컬럼 |
| `output_csv_path` | 결과 CSV 경로 |
| `max_concurrency` | 동시에 실행할 worker 수 |
| `max_workers` | 최대 worker 수 |
| `max_runtime_seconds` | 전체 실행 제한 시간 |
| `output_schema` | 결과 스키마 |

### `report_agent_job_result`

용도: agent job worker가 자신의 결과를 보고한다. worker 세션에서만 쓰인다.

입력:

| 이름 | 설명 |
|---|---|
| `job_id` | 작업 ID. 필수 |
| `item_id` | CSV 행 또는 항목 ID. 필수 |
| `result` | 보고할 결과. 필수 |
| `stop` | 보고 후 중단 여부 |

## Code Mode Tool

Code Mode가 켜지면 일반 Tool을 직접 호출하지 않고 코드 셀 실행 방식으로 감싼다.

### `exec`

용도: freeform code-mode 실행 Tool. 내부적으로는 `codex_code_mode::PUBLIC_TOOL_NAME`이며 소스상 공개 이름은 `exec`다.

입력 형식은 JSON이 아니라 코드 텍스트다. 앞줄에 실행 옵션 pragma를 둘 수 있다.

```text
// @exec: ...
source code
```

설명 생성 시 현재 사용 가능한 nested Tool 목록을 함께 넣는다. namespace Tool은 code mode 안에서 `<namespace>_<tool>` 형태 이름으로 변환된다. namespace가 `_`로 끝나거나 tool 이름이 `_`로 시작하면 중복 `_` 없이 붙인다.

### `wait`

용도: `exec`가 yield한 실행 cell을 기다리거나 종료한다.

입력:

| 이름 | 설명 |
|---|---|
| `cell_id` | 실행 중인 cell ID. 필수 |
| `yield_time_ms` | 추가 출력 대기 시간 |
| `max_tokens` | 반환할 최대 출력 토큰 수 |
| `terminate` | 실행 중인 cell 종료 여부 |

## MCP Function Tool

MCP 서버가 제공하는 function tool은 고정 이름 목록이 없다. Codex는 각 MCP 서버에서 받은 `ToolInfo`를 `McpHandler`로 등록한다.

모델에게 보이는 이름 규칙:

| 항목 | 규칙 |
|---|---|
| 기본 namespace | `mcp__<server_name>__` |
| Codex Apps connector namespace | `mcp__codex_apps__<connector_name>` |
| tool 이름 | MCP tool 이름 또는 connector prefix를 제거한 이름 |
| 정규화 | Responses API 이름 규칙에 맞게 sanitize |
| 충돌 처리 | namespace/tool 이름이 충돌하면 SHA1 기반 12자리 suffix 추가 |
| 길이 제한 | namespace + tool 이름 합이 64자를 넘지 않게 자르고 hash suffix 추가 |

실행 방식:

1. 모델이 namespace child function을 호출한다.
2. Codex는 model-visible 이름을 원래 MCP 서버 이름과 원래 MCP tool 이름으로 매핑한다.
3. `handle_mcp_tool_call`이 해당 MCP 서버에 요청을 보낸다.
4. 결과를 모델용 Tool output으로 변환한다.

예시 형태:

```json
{
  "namespace": "mcp__github__",
  "name": "search_issues",
  "arguments": "{\"query\":\"repo:owner/repo bug\"}"
}
```

## Dynamic Tool

Dynamic Tool은 현재 Codex thread가 외부에서 전달받는 Tool이다. 이름은 소스에 고정되어 있지 않고 `DynamicToolSpec`이 정한다.

스펙 입력:

| 이름 | 설명 |
|---|---|
| `namespace` | 선택적 namespace |
| `name` | Tool 이름 |
| `description` | 설명 |
| `inputSchema` | JSON schema |
| `deferLoading` | true면 처음부터 노출하지 않고 검색으로 노출 |

동작:

1. 모델이 dynamic Tool을 호출한다.
2. Codex가 `DynamicToolCallRequest` 이벤트를 app/server 쪽으로 보낸다.
3. 외부가 `DynamicToolResponse`로 결과를 돌려준다.
4. Codex가 결과를 function output으로 모델에게 반환한다.

출력 content item은 `inputText` 또는 `inputImage`가 가능하다.

## Extension Tool

Extension Tool은 `codex_extension_api::ToolContributor`가 공급한다. `ExtensionToolAdapter`가 core Tool과 같은 방식으로 실행 가능하게 감싼다.

고정 이름 목록은 extension 구현에 따라 달라진다. 현재 소스에 포함된 memories extension에는 다음 Tool 구현이 있다.

| namespace | 이름 | 용도 |
|---|---|---|
| `memories/` | `list` | Codex memory 저장소의 디렉터리/파일 목록 조회 |
| `memories/` | `read` | memory 파일 읽기 |
| `memories/` | `search` | memory 파일 검색 |

주의: `codex-rs/ext/memories/src/extension.rs`에서 `registry.tool_contributor(extension)`이 주석 처리되어 있어, 현재 소스 기준 memories Tool은 구현은 있지만 기본 설치 흐름에서는 app-server에 의도적으로 노출하지 않는다.

## Test Tool

### `test_sync_tool`

용도: 통합 테스트용 동기화 Tool이다. 일반 사용자 작업용이 아니다. `experimental_supported_tools`에 `"test_sync_tool"`이 있을 때만 등록된다.

입력:

| 이름 | 설명 |
|---|---|
| `sleep_before_ms` | barrier 전 대기 |
| `sleep_after_ms` | barrier 후 대기 |
| `barrier` | 여러 호출이 같은 지점에서 만날 수 있게 하는 테스트 barrier |

`barrier`에는 `id`, `participants`, `timeout_ms`가 들어간다.

## 고정 Tool 이름 전체 목록

소스에 이름이 직접 고정된 Tool은 다음과 같다.

| 이름 | 분류 |
|---|---|
| `exec_command` | Shell / 실행 |
| `write_stdin` | Shell / 실행 |
| `shell_command` | Shell / 실행, legacy |
| `request_permissions` | 권한 요청 |
| `apply_patch` | 파일 수정 |
| `view_image` | 이미지 읽기 |
| `update_plan` | 계획 관리 |
| `request_user_input` | 사용자 입력 요청 |
| `get_goal` | Goal |
| `create_goal` | Goal |
| `update_goal` | Goal |
| `list_mcp_resources` | MCP resource |
| `list_mcp_resource_templates` | MCP resource |
| `read_mcp_resource` | MCP resource |
| `tool_search` | 지연 로딩 Tool 검색 |
| `request_plugin_install` | 플러그인/커넥터 설치 요청 |
| `web_search` | Hosted web search |
| `image_generation` | Hosted image generation |
| `spawn_agent` | Multi-agent v1/v2 |
| `send_input` | Multi-agent v1 |
| `resume_agent` | Multi-agent v1 |
| `send_message` | Multi-agent v2 |
| `followup_task` | Multi-agent v2 |
| `wait_agent` | Multi-agent v1/v2 |
| `close_agent` | Multi-agent v1/v2 |
| `list_agents` | Multi-agent v2 |
| `spawn_agents_on_csv` | Agent jobs |
| `report_agent_job_result` | Agent jobs worker |
| `exec` | Code Mode |
| `wait` | Code Mode |
| `test_sync_tool` | 테스트 |

## 실무적으로 이해하기

일반적인 Codex 실행에서 가장 핵심적인 Tool은 다음 네 가지다.

| Tool | 쉽게 말하면 |
|---|---|
| `exec_command` / `shell_command` | 터미널 명령 실행 |
| `apply_patch` | 파일 수정 |
| `update_plan` | 작업 진행 상황 표시 |
| `view_image` | 로컬 이미지 확인 |

MCP, Dynamic, Extension Tool은 Codex 본체에 모든 기능을 넣는 대신 외부 기능을 꽂아 쓰는 통로다. 그래서 이름이 항상 고정되어 있지 않고, 실행 시점에 연결된 서버나 플러그인이 제공하는 목록에 따라 달라진다.
