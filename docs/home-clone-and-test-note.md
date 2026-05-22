# 집에서 Mac/Windows로 Xbridge 작업 이어가기

## 목적

집에 있는 Mac 또는 Windows PC에서 GitHub 저장소를 새로 클론한 뒤, 오늘 작업한 Xbridge 브리지/이미지 기반 Figma 화면 생성 기능을 이어서 개발하고 테스트하기 위한 절차입니다.

## GitHub 저장소

- Repository: `https://github.com/visualog/writable_mcp_bridge.git`
- 작업 브랜치: `feature/ai-designer-hybrid-main-pr`
- 최신 커밋: `b581aa8`
- 커밋 메시지: `Improve image-based Figma screen generation`

## 공통 준비

1. Git 설치
2. Node.js 설치
   - 가능하면 현재 프로젝트와 호환되는 LTS 버전을 사용
   - 설치 확인:
     ```bash
     node -v
     npm -v
     ```
3. GitHub 인증 준비
   - HTTPS 인증 또는 SSH key 중 하나를 설정
4. Figma Desktop 설치
5. Xbridge Figma 플러그인 개발 버전 로드 준비

## Mac에서 클론

```bash
mkdir -p ~/Documents/GitHub/Project/figma_skills
cd ~/Documents/GitHub/Project/figma_skills
git clone https://github.com/visualog/writable_mcp_bridge.git xbridge
cd xbridge
git checkout feature/ai-designer-hybrid-main-pr
npm install
```

## Windows에서 클론

PowerShell 기준:

```powershell
mkdir $HOME\Documents\GitHub\Project\figma_skills
cd $HOME\Documents\GitHub\Project\figma_skills
git clone https://github.com/visualog/writable_mcp_bridge.git xbridge
cd xbridge
git checkout feature/ai-designer-hybrid-main-pr
npm install
```

Windows에서는 경로 구분자가 다르므로 스크립트 실행 중 macOS 전용 명령이 나오면 Git Bash나 WSL에서 실행하는 편이 안정적입니다.

## 브리지 서버 실행

Mac:

```bash
npm run start:keychain
```

Windows:

```bash
npm start
```

확인:

```bash
curl -s http://127.0.0.1:3846/health
```

정상 상태에서 확인할 항목:

- `ok: true`
- `serverVersion`
- `transportCapabilities`
- `transportHealth.grade`
- `commandReadiness.status`
- `writeReadiness.status`
- `activePlugins`

`activePlugins: []`이면 브리지 서버는 떠 있지만 Figma 플러그인이 아직 연결되지 않은 상태입니다. Figma에서 플러그인을 실행하면 활성 세션이 잡힙니다.

## Figma 플러그인 연결

1. Figma Desktop 실행
2. 개발 플러그인 로드
3. Xbridge 플러그인 실행
4. 브리지 UI에서 연결 상태 확인
5. 다시 health 확인:
   ```bash
   curl -s http://127.0.0.1:3846/health
   ```

`activePlugins`에 `page:...` 또는 `file:...` 값이 보이면 Figma 플러그인 세션이 연결된 상태입니다.

## Figma token 관련

Mac에서 아래 로그가 나올 수 있습니다.

```text
No Figma token found in macOS Keychain; starting without FIGMA_ACCESS_TOKEN.
```

의미:

- 현재 선택 읽기, 노드 상세 읽기, 플러그인 기반 쓰기 작업은 대체로 가능
- Figma REST API 기반 계정/라이브러리/파일 API 기능은 제한될 수 있음

토큰이 필요할 때:

```bash
npm run set:keychain-token -- YOUR_TOKEN
npm run start:keychain
```

Windows에서는 keychain 스크립트 대신 환경 변수로 `FIGMA_ACCESS_TOKEN`을 설정하는 방식이 필요할 수 있습니다.

## 기본 검증

빠른 문법 검사:

```bash
node --check src/server.js
node --check src/codex-cli-runner.js
node --check src/build-layout.js
node --check figma-plugin/code.js
```

핵심 테스트:

```bash
node --test tests/codex-cli-runner.test.js tests/build-layout.test.js tests/ui-designer-contract.test.js
```

전체 테스트:

```bash
npm test
```

오늘 기준 전체 테스트 결과:

- `npm test`
- 430 tests
- 418 pass
- 12 skip
- 0 fail

## 이미지 기반 화면 생성 테스트

Figma에서 테스트할 흐름:

1. 테스트용 페이지 열기
2. 이미지 또는 이미지가 들어 있는 프레임 선택
3. Xbridge 입력창에 요청:
   ```text
   선택한 이미지를 분석하고 동일한 화면을 생성해줘
   ```
4. 생성 결과 확인
5. 특히 아래 항목을 확인:
   - 모바일/웹 캔버스 크기가 적절한지
   - margin, column, gutter 판단이 맞는지
   - 4px grid 기준으로 사이즈/여백이 정리되는지
   - 아바타/아이콘/dot/checkbox/radio 등이 1:1 비율을 유지하는지
   - hero/artwork/photo 영역이 오토레이아웃으로 억지 생성되지 않는지
   - 텍스트가 라벨/본문/수치/제목 역할에 맞게 크기, 두께, 행간을 갖는지
   - 빈 박스나 `Status`, `Label`, `Button`, `New text` 같은 가짜 placeholder가 생기지 않는지

## 오늘 반영된 핵심 변경

- Codex 이미지 분석 결과 schema 확장
  - `canvasSpecJson`
  - `roleMapJson`
  - `layoutMapJson`
  - `textStyleMapJson`
  - `treeJson`
- 앱/웹 캔버스 규격 판단 추가
  - mobile app: 390x844 전후, 4 columns, margin 24, gutter 16
  - tablet: 768x1024, 8 columns, margin 32, gutter 24
  - desktop web: 1440x1024, 12 columns, margin 80, gutter 24
- 4px grid 스냅 보정
- 1:1 비율 요소 보정
- 텍스트 역할별 font size, weight, line height 보정
- hero/artwork/photo 영역은 `layout: "none"` + 좌표 기반 배치 유지
- `lineHeight`, `clipsContent`가 Figma 플러그인 생성 경로까지 전달되도록 보강
- command readiness에서 backlog risk와 expiry risk 분류 조건 정리

## 작업 전 주의

집에서 클론 후 바로 작업하기 전에:

```bash
git status
git pull origin feature/ai-designer-hybrid-main-pr
```

작업 중 다른 컴퓨터에서도 같은 브랜치를 수정했다면:

```bash
git fetch origin
git status
git log --oneline --decorate -5
```

충돌이 있으면 임의로 `reset --hard` 하지 말고 변경 파일을 먼저 확인합니다.

## 작업 후 커밋/푸시

```bash
git status
npm test
git add <changed-files>
git commit -m "커밋 메시지"
git push origin feature/ai-designer-hybrid-main-pr
```

임시 파일, 캡처 이미지, 로컬 플래그 파일은 커밋하지 않습니다.

제외해야 할 가능성이 높은 파일:

- `.codex-*`
- `.xbridge-*`
- `error-capture/`
- `image-gen/`
- benchmark 참고 자료
- 개인 테스트 산출물

## 문제가 생겼을 때 확인 순서

1. 서버 health:
   ```bash
   curl -s http://127.0.0.1:3846/health
   ```
2. Figma 플러그인 연결 여부:
   - `activePlugins`
   - `commandReadiness`
   - `writeReadiness`
3. 세션 확인:
   ```bash
   curl -s http://127.0.0.1:3846/api/sessions
   ```
4. 서버 로그 확인
5. 관련 테스트만 먼저 실행
6. 마지막으로 `npm test`

## 다음 개선 후보

- 생성된 화면을 다시 읽어 원본 이미지와 비교하는 후처리 루프
- 이미지 내 복잡한 hero/artwork/photo 영역을 vector가 아니라 bitmap asset으로 처리하는 경로
- UI role detection 품질 개선
- grid/margin/column 판단을 화면 타입별로 더 세분화
- Figma 플러그인 reload 없이 `code.js` 변경 반영이 헷갈리지 않도록 dev workflow 문서화
