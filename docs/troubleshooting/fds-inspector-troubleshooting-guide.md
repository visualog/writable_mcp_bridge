# FDS Inspector 문제 해결 가이드

이 문서는 `xbridge + FDS Inspector`를 사용할 때 자주 막히는 문제와 확인 순서를 정리한 문서입니다.

## 1. 먼저 기억할 핵심

`FDS Inspector`가 바로 Figma를 읽는 것이 아닙니다.

반드시 아래 3가지가 연결되어 있어야 합니다.

1. `xbridge` 로컬 서버 실행
2. Figma에서 `Xbridge` 플러그인 실행
3. Chrome에서 `FDS Inspector` 실행

하나라도 빠지면 검사 데이터가 비거나 연결이 실패할 수 있습니다.

## 2. GitHub 저장소 주소와 포크 정보

원본 저장소:

- [https://github.com/visualog/writable_mcp_bridge](https://github.com/visualog/writable_mcp_bridge)

포크 방법:

1. 저장소 페이지 열기
2. GitHub 우측 상단 `Fork` 클릭
3. 자신의 계정으로 복사

권장 브랜치:

- `feature/ai-designer-hybrid-main-pr`

코드 받는 기본 명령:

```bash
git clone https://github.com/<내계정>/writable_mcp_bridge.git
cd writable_mcp_bridge
git remote add upstream https://github.com/visualog/writable_mcp_bridge.git
git fetch upstream
git checkout -b feature/ai-designer-hybrid-main-pr upstream/feature/ai-designer-hybrid-main-pr
```

## 3. xbridge 서버가 안 켜질 때

터미널에서 아래 명령을 다시 실행합니다.

```bash
npm run start:keychain
```

그래도 안 되면 아래를 확인합니다.

1. 현재 폴더가 `writable_mcp_bridge`인지
2. `npm install`을 했는지
3. 다른 프로세스가 포트를 점유하고 있지 않은지

## 4. health 확인이 안 될 때

브라우저에서 아래 주소를 엽니다.

- `http://localhost:3846/health`

열리지 않으면:

1. `xbridge` 서버가 꺼져 있음
2. 서버가 다른 포트에서 실행 중일 수 있음
3. 서버가 시작 직후 오류로 종료됐을 수 있음

이 경우 터미널 로그를 먼저 확인합니다.

## 5. Figma에서 Xbridge 플러그인이 안 보일 때

다시 등록합니다.

1. Figma 데스크톱 앱 열기
2. `Plugins`
3. `Development`
4. `Import plugin from manifest...`
5. `figma-plugin/manifest.json` 선택

선택해야 하는 파일 예시:

- `~/.../writable_mcp_bridge/figma-plugin/manifest.json`

## 6. Figma 플러그인은 열었는데 연결이 안 될 때

아래 순서로 확인합니다.

1. `xbridge` 서버가 켜져 있는지
2. `http://localhost:3846/health`가 열리는지
3. Figma 플러그인 창이 닫히지 않았는지
4. Figma에서 올바른 파일이 열려 있는지

플러그인 창을 닫으면 세션이 끊길 수 있습니다.

## 7. FDS Inspector가 데이터를 못 읽을 때

보통 원인은 아래 셋 중 하나입니다.

1. `xbridge` 서버가 꺼져 있음
2. Figma 플러그인이 실행되지 않음
3. Figma 플러그인 세션이 살아 있지 않음

확인 순서:

1. 터미널에서 `npm run start:keychain`
2. 브라우저에서 `http://localhost:3846/health`
3. Figma에서 `Xbridge` 플러그인 다시 열기
4. Chrome에서 `FDS Inspector` 새로고침 또는 다시 실행

## 8. 플러그인 세션이 불안정할 때

아래 순서대로 다시 맞추면 대부분 복구됩니다.

1. Figma 플러그인 창 닫기
2. `xbridge` 서버가 살아 있는지 확인
3. Figma에서 `Xbridge` 플러그인 다시 실행
4. Chrome에서 `FDS Inspector` 다시 확인

## 9. 처음부터 다시 맞추는 가장 쉬운 순서

```bash
cd writable_mcp_bridge
npm install
npm run start:keychain
```

그 다음:

1. Figma에서 `manifest.json` 등록
2. `Xbridge` 플러그인 실행
3. `http://localhost:3846/health` 확인
4. Chrome에서 `FDS Inspector` 실행

## 10. 이 구조를 한 줄로 이해하기

- `xbridge`는 Figma 정보를 읽는 로컬 서버
- `FDS Inspector`는 그 정보를 검사하는 Chrome 도구

즉 `xbridge`가 꺼져 있으면 `FDS Inspector`는 검사할 데이터를 받을 수 없습니다.
