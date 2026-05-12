# FDS Inspector 시작 가이드

이 문서는 `FDS Inspector`를 사용하려는 작업자가 `xbridge`를 로컬에서 실행하고, Figma 플러그인을 등록한 뒤, Chrome에서 검사까지 진행하는 방법을 쉽게 설명합니다.

## 1. xbridge와 FDS Inspector의 관계

- `xbridge`는 Figma와 통신하는 로컬 브리지 서버입니다.
- `FDS Inspector`는 Chrome에서 실행되는 검사 도구입니다.
- `FDS Inspector`는 직접 Figma를 읽지 않고, `xbridge`가 Figma에서 읽어온 정보를 받아 검사합니다.

흐름은 아래와 같습니다.

`Figma 파일 -> Xbridge 플러그인 -> xbridge 로컬 서버 -> FDS Inspector`

즉, `FDS Inspector`를 사용하려면 `xbridge 서버`가 켜져 있어야 합니다.

## 2. GitHub 저장소 주소

원본 저장소:

- [https://github.com/visualog/writable_mcp_bridge](https://github.com/visualog/writable_mcp_bridge)

권장 시작 브랜치:

- `feature/ai-designer-hybrid-main-pr`

## 3. GitHub에서 포크하는 방법

1. 위 저장소 링크를 엽니다.
2. GitHub 우측 상단의 `Fork` 버튼을 누릅니다.
3. 자신의 GitHub 계정으로 포크를 생성합니다.

포크가 끝나면 자신의 저장소 주소는 보통 아래와 같은 형태입니다.

- `https://github.com/<내계정>/writable_mcp_bridge`

## 4. 내 컴퓨터에 코드 받기

터미널에서 아래 순서대로 실행합니다.

```bash
git clone https://github.com/<내계정>/writable_mcp_bridge.git
cd writable_mcp_bridge
git remote add upstream https://github.com/visualog/writable_mcp_bridge.git
git fetch upstream
git checkout -b feature/ai-designer-hybrid-main-pr upstream/feature/ai-designer-hybrid-main-pr
```

## 5. 필요한 패키지 설치

```bash
npm install
```

## 6. xbridge 서버 실행

```bash
npm run start:keychain
```

이 명령으로 로컬 브리지 서버가 실행됩니다.

보통 브리지는 아래 주소에서 응답합니다.

- `http://localhost:3846`

## 7. Figma에 xbridge 플러그인 등록

Figma 데스크톱 앱에서 아래 순서대로 진행합니다.

1. `Plugins`
2. `Development`
3. `Import plugin from manifest...`
4. 로컬 저장소 안의 `figma-plugin/manifest.json` 선택

예시:

- `~/.../writable_mcp_bridge/figma-plugin/manifest.json`

## 8. Figma에서 플러그인 실행

1. 검사하려는 Figma 파일을 엽니다.
2. `Plugins > Development > Xbridge`를 실행합니다.
3. 플러그인 창을 닫지 말고 열어둡니다.

이 상태여야 `xbridge`가 현재 Figma 파일과 세션을 유지할 수 있습니다.

## 9. 브리지 연결 확인

브라우저에서 아래 주소를 열어 브리지가 살아 있는지 확인합니다.

- `http://localhost:3846/health`

정상이라면 health JSON이 보입니다.

## 10. Chrome에서 FDS Inspector 실행

이제 Chrome에서 `FDS Inspector`를 실행합니다.

권장 순서는 아래와 같습니다.

1. `xbridge` 서버 실행
2. Figma에서 `Xbridge` 플러그인 실행
3. `http://localhost:3846/health` 확인
4. Chrome에서 `FDS Inspector` 실행

## 11. 가장 짧은 실행 순서

```bash
git clone https://github.com/<내계정>/writable_mcp_bridge.git
cd writable_mcp_bridge
npm install
npm run start:keychain
```

그 다음 Figma에서:

1. `figma-plugin/manifest.json` 등록
2. `Xbridge` 실행

그 다음 Chrome에서:

1. `FDS Inspector` 실행

## 12. 중요한 메모

- 이 용도에서는 `Nemotron API 키`가 필요하지 않습니다.
- 필요한 것은 `xbridge 서버 실행`, `Figma 플러그인 연결`, `FDS Inspector 실행`입니다.
- `FDS Inspector`는 `xbridge`가 읽은 데이터를 기준으로 검사합니다.
