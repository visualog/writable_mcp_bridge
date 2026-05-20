# Codex CLI 인터페이스 조사

조사일: 2026-05-18  
대상 소스: `codex/` 클론, 커밋 `64ead6a83a`  
실측 바이너리: `/usr/local/bin/codex`, `codex-cli 0.130.0`

## 요약

Codex는 하나의 `codex` 명령 아래에 여러 인터페이스를 둔다. 인자 없이 실행하면 대화형 TUI가 열리고, 자동화나 배치 작업에는 `codex exec`가 핵심이다. `codex exec`는 별도 터미널 UI를 띄우지 않고 프롬프트를 한 번 전달한 뒤, 결과를 일반 텍스트 또는 JSONL 이벤트 스트림으로 출력한다.

소스 기준 최상위 CLI는 `codex-rs/cli/src/main.rs`의 `MultitoolCli`가 담당한다. npm 패키지의 `codex-cli/bin/codex.js`는 플랫폼별 Rust 바이너리를 찾아 실행하는 래퍼다.

## 최상위 실행 형태

```bash
codex [OPTIONS] [PROMPT]
codex [OPTIONS] <COMMAND> [ARGS]
```

소스상 주요 명령:

| 명령 | 성격 | 용도 |
| --- | --- | --- |
| `codex` | 대화형 | TUI 실행. 프롬프트를 바로 넘기면 초기 사용자 메시지로 시작 |
| `codex exec` / `codex e` | 비대화형 | 프롬프트를 한 번 실행하고 종료 |
| `codex review` | 비대화형 | 코드 리뷰 전용 실행 |
| `codex login`, `logout` | 관리 | 인증 상태 관리 |
| `codex mcp` | 관리 | MCP 서버 설정 관리 |
| `codex plugin` | 관리 | Codex 플러그인/마켓플레이스 관리 |
| `codex mcp-server` | 서버 | Codex를 MCP 서버(stdio)로 실행 |
| `codex app-server` | 서버/도구 | 앱 서버 실행 및 프로토콜 산출물 생성 |
| `codex remote-control` | 서버 | headless app-server 원격 제어 |
| `codex app` | 데스크톱 | Codex Desktop 실행 |
| `codex completion` | 셸 도구 | bash/fish/zsh 등 completion 생성 |
| `codex update` | 관리 | Codex 업데이트 |
| `codex sandbox` | 실행 도구 | OS별 sandbox 안에서 명령 실행 |
| `codex debug` | 진단 | 모델 목록, prompt input 등 디버깅 |
| `codex apply` / `codex a` | 작업 반영 | Codex task diff를 `git apply`로 반영 |
| `codex resume` | 대화형 재개 | 이전 interactive session 재개 |
| `codex fork` | 대화형 분기 | 이전 interactive session fork |
| `codex cloud` | Cloud | Codex Cloud task 조회/실행/반영 |
| `codex exec-server` | 서버 | standalone exec-server 실행 |
| `codex features` | 관리 | feature flag 조회/변경 |

소스에는 `doctor`도 정의되어 있으나, 현재 설치된 `codex-cli 0.130.0`의 `codex --help`에는 표시되지 않았다. 즉 다운로드한 최신 소스와 설치된 바이너리 사이에는 차이가 있다.

## 실제 바이너리 실측

실행한 명령:

```bash
which codex
codex --version
codex --help
codex exec --help
codex login status
codex features list
codex exec --json --skip-git-repo-check --ephemeral --color never "Reply with exactly OK."
```

관찰 결과:

- `which codex` 결과는 `/usr/local/bin/codex`.
- 버전은 `codex-cli 0.130.0`.
- 모든 실행에서 `WARNING: proceeding, even though we could not update PATH: Operation not permitted (os error 1)` 경고가 먼저 출력됐다. 명령 자체는 대부분 정상 동작했다.
- `codex login status`는 `Logged in using ChatGPT`를 출력했다.
- `codex features list`에서 `unified_exec`, `shell_tool`, `apps`, `plugins`, `tool_search` 등은 활성화 상태였고, `goals`는 `experimental false`였다.
- 현재 Codex 샌드박스 안에서 `codex exec`를 실행하면 app-server 초기화가 `Operation not permitted`로 실패했다. 승인 후 샌드박스 밖에서 같은 명령을 실행하자 성공했다.

성공한 `codex exec --json`의 실제 JSONL 출력 흐름:

```jsonl
{"type":"thread.started","thread_id":"019e3985-3ced-7620-8da6-61f159e8a9c1"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"OK"}}
{"type":"turn.completed","usage":{"input_tokens":20755,"cached_input_tokens":2432,"output_tokens":12,"reasoning_output_tokens":10}}
```

중간에 Cloudflare MCP 인증 실패 로그가 stderr로 출력됐지만, 작업 자체는 실패하지 않았다. JSONL 소비자는 stdout만 JSONL로 처리하고 stderr 로그는 별도로 다루는 편이 안전하다.

## `codex exec` 집중 분석

`codex exec`의 목적은 “대화형 화면 없이 Codex 작업을 한 번 실행하고 종료”하는 것이다.

기본 형태:

```bash
codex exec "작업 지시문"
codex exec --json "작업 지시문"
codex exec --output-last-message result.txt "작업 지시문"
echo "작업 지시문" | codex exec -
```

소스상 usage:

```text
codex exec [OPTIONS] [PROMPT]
codex exec [OPTIONS] <COMMAND> [ARGS]
```

`exec` 하위 명령:

| 명령 | 용도 |
| --- | --- |
| `codex exec` | 새 비대화형 session 시작 |
| `codex exec resume` | 이전 session/thread를 이어서 비대화형으로 실행 |
| `codex exec review` | 현재 저장소에 대한 비대화형 리뷰 실행 |

주요 옵션:

| 옵션 | 의미 |
| --- | --- |
| `--json`, `--experimental-json` | stdout에 JSONL 이벤트 출력 |
| `-o`, `--output-last-message <FILE>` | 마지막 agent 메시지를 파일로 저장 |
| `--output-schema <FILE>` | 최종 응답이 따라야 할 JSON Schema 지정 |
| `--skip-git-repo-check` | Git 저장소 밖에서도 실행 허용 |
| `--ephemeral` | session 파일을 디스크에 저장하지 않음 |
| `--ignore-user-config` | `$CODEX_HOME/config.toml` 미로드. 인증에는 `CODEX_HOME` 사용 |
| `--ignore-rules` | 사용자/프로젝트 execpolicy rules 미로드 |
| `--color always|never|auto` | 사람이 읽는 출력의 색상 제어 |
| `-m`, `--model <MODEL>` | 사용할 모델 지정 |
| `-s`, `--sandbox read-only|workspace-write|danger-full-access` | 모델이 실행하는 셸 명령의 sandbox 정책 |
| `--dangerously-bypass-approvals-and-sandbox` | 승인과 sandbox를 모두 우회. 외부 격리 환경에서만 사용해야 함 |
| `-C`, `--cd <DIR>` | Codex 작업 루트 지정 |
| `--add-dir <DIR>` | 추가 writable directory 지정 |
| `-i`, `--image <FILE>` | 이미지 입력 첨부 |
| `-c`, `--config key=value` | config.toml 값을 CLI에서 덮어쓰기 |
| `--oss`, `--local-provider` | 로컬/오픈소스 provider 사용 |

### 입력 처리

`exec`는 프롬프트를 세 가지 방식으로 받는다.

```bash
codex exec "프롬프트"
echo "프롬프트" | codex exec
echo "추가 컨텍스트" | codex exec "프롬프트"
```

소스 주석 기준으로, prompt가 없거나 prompt가 `-`이면 stdin을 읽는다. prompt와 piped stdin이 함께 있으면 stdin 내용은 `<stdin>` 블록으로 덧붙는다.

### 내부 실행 원리

`codex exec`는 TUI를 띄우지 않지만, 내부적으로는 app-server 클라이언트를 프로세스 안에서 시작한다. 흐름은 다음과 같다.

1. CLI 옵션과 `config.toml`을 합쳐 실행 설정을 만든다.
2. 기본 approval policy를 headless 모드에 맞춰 `never`로 둔다.
3. Git 저장소 검사, 인증 제한, execpolicy rule 검사를 수행한다.
4. in-process app-server client를 시작한다.
5. 새 thread를 만들거나 `resume`이면 기존 thread를 연다.
6. `turn/start` 또는 `review/start` 요청을 보낸다.
7. 서버 이벤트를 끝까지 읽는다.
8. 일반 모드면 마지막 답변 중심으로 출력하고, `--json`이면 JSONL 이벤트로 출력한다.
9. 실패/중단 이벤트가 있으면 종료 코드를 1로 만든다.

### JSONL 이벤트 형식

`--json`은 자동화에서 가장 중요한 모드다. 이벤트는 한 줄에 JSON 객체 하나씩 출력된다.

주요 이벤트:

| 이벤트 | 의미 |
| --- | --- |
| `thread.started` | 새 thread 생성. `thread_id` 포함 |
| `turn.started` | 모델 작업 turn 시작 |
| `item.started` | 명령 실행, MCP 호출, 계획 등 항목 시작 |
| `item.updated` | 항목 진행 중 업데이트 |
| `item.completed` | 항목 완료 |
| `turn.completed` | turn 종료. 토큰 사용량 포함 |
| `turn.failed` | turn 실패 |
| `error` | 치명적 스트림 오류 |

`item` 타입:

| item type | 의미 |
| --- | --- |
| `agent_message` | 모델의 최종/중간 메시지 |
| `reasoning` | reasoning summary |
| `command_execution` | 모델이 실행한 셸 명령 |
| `file_change` | patch/file 변경 |
| `mcp_tool_call` | MCP tool 호출 |
| `collab_tool_call` | subagent/collaboration tool 호출 |
| `web_search` | 웹 검색 |
| `todo_list` | 계획/할 일 목록 |
| `error` | 비치명 오류 항목 |

자동화에서는 `item.completed` 중 `agent_message.text`를 최종 응답 후보로 보고, `turn.completed.usage`로 비용/사용량을 기록하면 된다. 다만 `--output-last-message`를 쓰면 마지막 agent 메시지를 파일로 별도 저장할 수 있어 파싱 부담이 줄어든다.

### `image_generation` 실사용 메모

2026-05-18에 로컬 이미지 입력을 붙여 `codex exec`로 `image_generation` tool을 실제 호출해 봤다. 결론은 다음과 같다.

- `codex exec --image <FILE>`로 참조 이미지를 붙인 뒤, 프롬프트에서 이미지 생성 작업을 지시하면 실제 PNG 아티팩트가 생성된다.
- 생성 파일은 `CODEX_HOME/generated_images/<thread_id>/<call_id>.png` 경로에 저장된다.
- 내부 이벤트에는 `saved_path`가 실릴 수 있으므로, `--json` 소비자는 이 값을 우선적으로 읽는 편이 좋다.
- 다만 설치된 `codex-cli 0.130.0`에서는 이미지가 이미 생성됐더라도 마지막 텍스트 응답이나 `-o` 출력 파일이 늦게 나오거나, timeout 전에 정리되지 않는 경우가 있었다.
- 따라서 이미지 생성 백엔드에서는 “최종 agent 메시지”보다 “생성 아티팩트 경로”를 우선 성공 기준으로 삼는 편이 안전했다.

실측에서 유효했던 래핑 패턴:

1. 호출 시작 전에 `generated_images/`의 기존 PNG 목록을 읽는다.
2. `codex exec --json --ignore-user-config --image ...`를 실행한다.
3. timeout이 나더라도 `generated_images/`를 몇 초 더 polling해서 새 PNG를 찾는다.
4. 새 PNG가 있으면 성공으로 판정하고, 구조화 JSON은 호스트 앱이 직접 조립한다.

반대로, 이번 실험에서 덜 안정적이었던 패턴:

- 이미지 생성 후 모델이 직접 JSON Schema에 맞는 최종 응답까지 완벽히 마무리하길 기대하는 것
- 짧은 timeout 안에 `-o` 파일까지 반드시 생긴다고 가정하는 것
- 생성 성공 판단을 `agent_message == "OK"` 같은 텍스트 완료 신호에만 의존하는 것

### `exec resume`

`codex exec resume`은 기존 session/thread를 이어서 비대화형으로 실행한다.

```bash
codex exec resume <SESSION_ID> "이어서 할 일"
codex exec resume --last "이어서 할 일"
codex exec resume --last --json "상태를 요약해줘"
```

특이점: 소스에서 `--last`가 있고 prompt 인자가 따로 없으면, positional 값을 session id가 아니라 prompt로 재해석한다. 즉 아래 형태가 가능하다.

```bash
codex exec resume --last "continue"
```

### `exec review`

`codex exec review`는 `codex review`와 유사하게 코드 리뷰를 비대화형으로 수행한다. 대상 지정 옵션은 다음과 같다.

```bash
codex exec review --uncommitted
codex exec review --base main
codex exec review --commit <SHA> --title "PR title"
codex exec review "특정 관점으로 리뷰해줘"
```

`--uncommitted`, `--base`, `--commit`, positional prompt는 서로 충돌하도록 설계되어 있다.

## 다른 CLI 인터페이스 정리

### `codex review`

비대화형 리뷰 전용 top-level 명령이다. `codex exec review`와 같은 `ReviewArgs`를 공유한다. 현재 실측 help 기준 옵션은 `--uncommitted`, `--base`, `--commit`, `--title`, prompt다.

### `codex login` / `logout`

인증 관리 명령이다.

```bash
codex login
codex login status
printenv OPENAI_API_KEY | codex login --with-api-key
printenv CODEX_ACCESS_TOKEN | codex login --with-access-token
codex logout
```

실측 상태는 `Logged in using ChatGPT`였다.

### `codex mcp`

MCP 서버 설정 관리용이다.

```bash
codex mcp list
codex mcp get <name>
codex mcp add <name> -- <command> ...
codex mcp add <name> --url <url>
codex mcp remove <name>
codex mcp login <name>
codex mcp logout <name>
```

`mcp add`는 stdio 서버 명령 또는 streamable HTTP URL을 등록할 수 있다. stdio 서버에는 `--env KEY=VALUE`, HTTP 서버에는 `--bearer-token-env-var ENV_VAR`를 붙일 수 있다.

### `codex plugin`

플러그인 관리 명령이다. 현재 설치 바이너리 help에서는 `plugin marketplace`가 노출됐다.

### `codex mcp-server`

Codex 자체를 MCP server로 stdio에서 실행한다. IDE, 다른 agent harness, MCP client와 연결하기 위한 인터페이스다.

### `codex app-server`

Codex app-server를 실행하거나 도구 명령을 수행한다.

주요 형태:

```bash
codex app-server
codex app-server --listen stdio://
codex app-server --listen unix://
codex app-server --listen ws://127.0.0.1:PORT
codex app-server proxy --sock <SOCKET_PATH>
codex app-server generate-ts -o <DIR>
codex app-server generate-json-schema -o <DIR>
```

소스 최신본에는 daemon 관련 하위 명령도 정의되어 있으나, 현재 설치된 0.130.0 help에는 보이지 않았다.

### `codex remote-control`

headless app-server 원격 제어를 켜는 실험 명령이다. 설치 바이너리 help 기준으로는 별도 하위 명령 없이 실행하는 형태로 보인다.

### `codex app`

macOS/Windows에서 Codex Desktop을 실행한다.

```bash
codex app [PATH]
```

실측 환경에서는 `[PATH]` 기본값이 `.`이고, `--download-url`로 installer URL을 덮어쓸 수 있었다.

### `codex completion`

셸 completion 생성:

```bash
codex completion bash
codex completion zsh
codex completion fish
codex completion powershell
codex completion elvish
```

### `codex sandbox`

Codex가 제공하는 OS sandbox 안에서 명령을 실행한다.

```bash
codex sandbox macos ...
codex sandbox linux ...
codex sandbox windows ...
```

macOS에서는 Seatbelt, Linux에서는 bubblewrap/landlock 계열, Windows에서는 restricted token 계열이다.

### `codex debug`

진단/개발용 명령이다.

```bash
codex debug models
codex debug app-server ...
codex debug prompt-input [PROMPT]
```

소스에는 숨김 명령으로 trace reduce, memory reset도 있다.

### `codex apply`

Codex agent가 만든 최신 diff를 로컬 working tree에 `git apply`로 반영한다.

```bash
codex apply <TASK_ID>
```

### `codex resume` / `codex fork`

대화형 session을 재개하거나 fork한다. `exec resume`과 달리 TUI 흐름으로 돌아가는 명령이다.

```bash
codex resume --last
codex resume --all
codex fork --last
```

### `codex cloud`

Codex Cloud task용 실험 명령이다.

```bash
codex cloud exec
codex cloud status
codex cloud list
codex cloud apply
codex cloud diff
```

### `codex exec-server`

standalone exec-server 서비스 실행용이다.

```bash
codex exec-server --listen ws://127.0.0.1:PORT
codex exec-server --listen stdio://
codex exec-server --remote <URL> --executor-id <ID>
```

원격 실행자 등록 시 `--name`, `--use-agent-identity-auth` 같은 옵션이 소스에는 있다. 설치 바이너리 help에는 `--use-agent-identity-auth`가 표시되지 않았다.

### `codex features`

feature flag 조회/변경용이다.

```bash
codex features list
codex features enable <feature>
codex features disable <feature>
```

실측에서 `goals`는 `experimental false`, `unified_exec`는 `stable true`였다.

## 자동화 사용 권장 패턴

일반적인 비대화형 실행:

```bash
codex exec --skip-git-repo-check --ephemeral "작업을 수행하고 결과만 요약해줘"
```

CI나 스크립트에서 파싱하기 좋은 실행:

```bash
codex exec --json --skip-git-repo-check --ephemeral "작업을 수행해줘"
```

최종 답변만 파일로 받고 싶은 실행:

```bash
codex exec --output-last-message /tmp/codex-last.txt "작업을 수행해줘"
```

작업 디렉터리를 명시:

```bash
codex exec -C /path/to/repo --json "테스트 실패 원인을 찾아줘"
```

출력 JSON 형태를 강제:

```bash
codex exec --json --output-schema schema.json "분석 결과를 스키마에 맞춰 출력해줘"
```

이전 작업 이어가기:

```bash
codex exec resume --last --json "이전 작업을 이어서 마무리해줘"
```

## 주의점

- `codex exec`는 비대화형이지만 내부적으로 app-server를 시작하므로, 제한된 sandbox 안에서는 초기화가 실패할 수 있다.
- headless 모드의 기본 approval policy는 소스상 `never`로 설정된다. 즉 승인 프롬프트를 기다리지 않는 자동화 친화 동작이다.
- `--dangerously-bypass-approvals-and-sandbox`는 승인과 sandbox를 모두 우회하므로 로컬에서 직접 쓰기에는 위험하다.
- `--json` 모드의 stdout은 JSONL로 안정적으로 소비할 수 있지만, stderr에는 경고/로그가 섞일 수 있다.
- 이미지 생성 자동화에서는 최종 텍스트 응답보다 디스크에 저장된 PNG 아티팩트를 우선 성공 기준으로 잡는 편이 더 안정적이었다.
- 이미지 생성 작업에서는 `--ignore-user-config`를 붙여 불필요한 MCP 초기화 지연을 줄이는 것이 유효했다.
- 다운로드한 소스와 설치된 바이너리 버전이 다를 수 있다. 이번 조사에서도 소스에는 `doctor`가 있으나 설치 바이너리 help에는 없었다.

## 주요 소스 근거

- npm 래퍼: `codex-cli/bin/codex.js`
- 최상위 CLI 파서: `codex-rs/cli/src/main.rs`
- `exec` CLI 옵션: `codex-rs/exec/src/cli.rs`
- `exec` 실행 흐름: `codex-rs/exec/src/lib.rs`
- `exec --json` 이벤트 타입: `codex-rs/exec/src/exec_events.rs`
- TypeScript SDK의 `exec` 래핑: `sdk/typescript/src/exec.ts`
