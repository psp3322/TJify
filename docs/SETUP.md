# TJify 운영·개발 안내

사이트 소개는 [README](../README.md)에 있습니다. 이 문서는 사이트를 직접 올리거나 고치려는 사람을 위한 안내입니다.

## 어떻게 돌아가나요

TJify는 서버가 없는 정적 사이트입니다. `npm run build`를 하면 `out/` 폴더에 HTML·CSS·자바스크립트 파일이 만들어지고, 이 파일만 올리면 어디서든 열립니다.

- **노래방 번호**: 방문자 브라우저가 [Manana 노래방 API](https://api.manana.kr/karaoke)를 바로 부릅니다 (TJ·금영 모두).
- **재생목록**: 브라우저가 YouTube Data API와 Spotify Web API를 바로 부릅니다. 공개 YouTube 재생목록은 API 키로, 계정 목록은 로그인 토큰으로 읽습니다.
- **로그인**: Spotify는 PKCE 방식, Google은 클라이언트 측 웹 앱 방식이라 client secret이 필요 없습니다. 토큰은 방문자 브라우저의 localStorage에만 저장됩니다.
- **난이도**: 브라우저에서 AI를 바로 부릅니다. 방문자가 넣은 Anthropic 키(유료) → 방문자가 넣은 Gemini 키(무료) → 사이트에 넣어 둔 Gemini 무료 키 순서로 씁니다.
- **언어**: 화면 문구는 `src/lib/i18n/messages.ts`의 한국어·영어 문구표에서 나옵니다. 처음에는 브라우저 언어를 따르고, 화면 위쪽 버튼으로 바꾼 언어는 브라우저에 기억합니다.
- **인기차트**: 빌드할 때 TJ미디어 인기차트(최근 1년 TOP100)를 받아 `/data/tj-chart.json`으로 넣습니다. TJ 사이트가 막히면 Manana의 TJ 인기곡(최근 한 달)으로 대신하고, 그것도 안 되면 차트 없이 빌드합니다.

## 빌드할 때 넣는 값

모두 선택입니다. 사이트 자바스크립트에 그대로 들어가는 **공개 값**이라 비밀 값은 넣으면 안 됩니다.

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | 사이트가 열리는 하위 경로 (예: `/TJify`). GitHub Pages 워크플로가 자동으로 넣습니다 |
| `NEXT_PUBLIC_GEMINI_API_KEY` | 모든 방문자가 쓰는 곡 난이도·대중성 추정 (Gemini 무료 등급) |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | 공개 YouTube 재생목록을 로그인 없이 가져오기, 조회수 |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify 계정 연결 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | YouTube 계정 연결 |
| `KARAOKE_USER_AGENT` | 빌드할 때 인기차트를 받으러 갈 때 쓰는 User-Agent (막힐 때만 바꿉니다) |

GitHub Pages 워크플로에서는 저장소 **Settings → Secrets and variables → Actions → Variables**에 `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `GOOGLE_CLIENT_ID`라는 이름으로 넣으면 위 변수로 들어갑니다.

## GitHub Pages에 올리기

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다. 이 설정이 없으면 워크플로의 `configure-pages` 단계에서 실패합니다.
2. main 브랜치에 코드가 올라오면 `.github/workflows/pages.yml`이 빌드해서 올립니다. 매주 월요일 새벽에도 한 번 다시 빌드해서 인기차트를 새로 받습니다.
3. 변수를 새로 넣거나 바꿨다면 **Actions → GitHub Pages → Run workflow**로 다시 빌드해야 반영됩니다.

사이트 주소는 `https://<GitHub 사용자 이름>.github.io/<저장소 이름>/`입니다. 이 저장소라면 https://psp3322.github.io/TJify/ 입니다.

## 다른 곳에 올리기

`out/` 폴더를 정적 파일로 올리면 Netlify, Cloudflare Pages, 개인 서버 어디서든 됩니다. 도메인 맨 앞(`https://example.com/`)에 올릴 때는 `NEXT_PUBLIC_BASE_PATH`를 비워 두고, 하위 경로에 올릴 때는 그 경로를 넣고 빌드합니다.

## YouTube API 키 만들기

1. [Google Cloud 콘솔](https://console.cloud.google.com)에서 프로젝트를 만들고 **API 및 서비스 → 라이브러리**에서 **YouTube Data API v3**를 사용 설정합니다.
2. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**를 누릅니다.
3. 만든 키를 꼭 제한합니다. 키가 사이트에 공개되기 때문입니다.
   - **애플리케이션 제한사항**: 웹사이트, 허용할 주소에 `https://psp3322.github.io/*` (로컬에서도 쓰려면 `http://127.0.0.1:3000/*`, `http://127.0.0.1:4173/*`)
   - **API 제한사항**: YouTube Data API v3만
4. 저장소 Variables의 `YOUTUBE_API_KEY`에 넣습니다.

재생목록 50곡을 읽을 때마다 하루 할당량(기본 10,000)을 2씩 씁니다(곡 목록 1, 조회수 1). 할당량이 모자라면 방문자가 설정에 자기 키를 넣어 쓸 수 있습니다.

## Spotify 앱 만들기 (계정 연결)

Spotify는 2026년 2월부터 개발 모드 앱에 제약이 있습니다. 앱을 만든 계정이 Premium이어야 하고, 대시보드에 등록한 5명까지만 쓸 수 있습니다.

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에서 **Create app**을 누릅니다.
2. Redirect URIs에 사이트 첫 화면 주소를 그대로 넣습니다: `https://psp3322.github.io/TJify/` (로컬은 `http://127.0.0.1:3000/`). 끝의 `/`까지 같아야 하고, Spotify는 `localhost` 주소를 받지 않습니다.
3. 사용할 API로 **Web API**를 고릅니다.
4. Client ID를 저장소 Variables의 `SPOTIFY_CLIENT_ID`에 넣습니다. Client Secret은 쓰지 않습니다.
5. **User Management**에 쓸 사람의 Spotify 계정 이메일을 등록합니다.

## Google OAuth 설정 (YouTube 계정 연결)

1. YouTube API 키를 만든 프로젝트의 **Google 인증 플랫폼(OAuth 동의 화면)** 에서 사용자 유형을 **외부**로 정합니다.
   - **대상**에서 테스트 사용자 이메일을 추가합니다 (테스트 모드에서는 최대 100명).
   - **데이터 액세스**에 `https://www.googleapis.com/auth/youtube.readonly` 범위를 추가합니다.
2. **클라이언트 → 클라이언트 만들기 → 웹 애플리케이션**을 고릅니다.
   - 승인된 자바스크립트 원본: `https://psp3322.github.io` (로컬은 `http://127.0.0.1:3000`)
   - 승인된 리디렉션 URI: `https://psp3322.github.io/TJify/` (로컬은 `http://127.0.0.1:3000/`)
3. 클라이언트 ID를 저장소 Variables의 `GOOGLE_CLIENT_ID`에 넣습니다. 클라이언트 보안 비밀번호는 쓰지 않습니다.

이 방식은 refresh token이 없어서 로그인이 한 시간 뒤 만료되고, 그때 다시 연결하면 됩니다.

## Gemini API 키 (난이도·대중성, 무료)

Google Gemini API에는 무료 등급이 있습니다. 사이트에 무료 키를 넣어 두면 방문자 모두가 따로 할 일 없이 난이도를 볼 수 있습니다.

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 **Create API key**를 누릅니다. 카드를 등록하지 않으면 무료 등급으로만 쓰입니다.
   - 키를 만들 프로젝트는 **결제(billing)를 켜지 않은 새 프로젝트**로 고릅니다. 키가 사이트에 공개되므로, 결제가 꺼져 있어야 누가 키를 가져가도 요금이 나오지 않습니다.
   - YouTube 키와 같은 프로젝트를 쓰지 않는 편이 안전합니다.
2. [Google Cloud 콘솔](https://console.cloud.google.com/apis/credentials)에서 그 키를 열고 제한을 겁니다.
   - **애플리케이션 제한사항**: 웹사이트, 허용할 주소에 `https://psp3322.github.io/*` (로컬에서도 쓰려면 `http://127.0.0.1:3000/*`, `http://127.0.0.1:4173/*`). 브라우저는 주소의 앞부분(`https://psp3322.github.io/`)만 보내므로 저장소 경로까지 넣으면 막힙니다.
   - **API 제한사항**: Generative Language API만
3. 저장소 Variables의 `GEMINI_API_KEY`에 넣고 워크플로를 다시 실행합니다.

알아 둘 점:

- 무료 등급은 분당·하루 요청 수 제한이 있습니다. 곡 20개를 한 번에 묻고 결과를 브라우저에 90일 동안 남겨서 요청을 아낍니다. 분당 한도에 걸리면 잠시 기다렸다가 이어서 하고, 하루 한도를 다 쓰면 "오늘 무료 사용량을 다 썼어요"라고 알리고 멈춥니다.
- 무료 등급에서는 보낸 내용(곡 제목·가수)이 Google 서비스 개선에 쓰일 수 있습니다. 사이트 소개의 개인정보 항목에도 적어 두었습니다.
- 모델은 Flash 계열의 최신 모델을 가리키는 별칭 `gemini-flash-latest`를 씁니다 (`src/lib/insights/models.ts`). 새 모델이 나오면 Google이 별칭 뒤의 모델을 바꿔 줍니다.
- Google은 원래 API 키를 웹페이지에 넣지 말라고 권합니다. 무료 등급 키를 위처럼 제한해 두면 최악의 경우가 "그날 무료 사용량이 먼저 바닥난다" 정도라서 취미 사이트에서는 감수할 만하다고 보고 넣은 기능입니다. 걱정되면 변수를 비워 두고, 방문자가 각자 무료 키를 설정에 넣게 하면 됩니다.

## Anthropic API 키 (난이도·대중성, 유료)

운영자가 따로 설정할 것은 없습니다. Claude로 추정하고 싶은 사람이 [Claude Console](https://platform.claude.com)에서 API 키를 만들어 사이트 아래 **설정**에 넣으면, Gemini 대신 Claude가 추정합니다.

- 키는 그 사람 브라우저의 localStorage에만 저장되고, Anthropic API에 요청할 때만 씁니다.
- 기본 모델은 `claude-opus-5-5`이고, 설정에서 더 저렴한 `claude-haiku-5-5`로 바꿀 수 있습니다. 대신 덜 알려진 곡을 아는 정도가 떨어질 수 있습니다.
- 곡 20개를 한 번에 묻고, 결과는 브라우저에 90일 동안 남아서 같은 곡을 다시 묻지 않습니다.

## 로컬에서 실행하기

Node.js 20.9 이상이 필요합니다.

```bash
npm install
```

키를 넣어 보고 싶다면 `.env.example`을 `.env.local`로 복사해서 채웁니다 (선택).

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

브라우저에서 http://127.0.0.1:3000 을 엽니다. GitHub Pages에 올라갈 결과물 그대로 보고 싶다면 빌드한 뒤 미리 보기 서버를 띄웁니다.

```bash
npm run build
```

```bash
npm run preview
```

http://127.0.0.1:4173 에서 열립니다.

## 개발 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 (127.0.0.1:3000) |
| `npm run build` | 정적 사이트 빌드 (`out/`) |
| `npm run preview` | `out/`을 GitHub Pages처럼 띄우는 미리 보기 서버 (127.0.0.1:4173) |
| `npm run lint` | ESLint |
| `npm run typecheck` | 라우트 타입 생성 후 TypeScript 검사 |
| `npm test` | Vitest 단위 테스트 |

```
src/
  app/                  첫 화면, 빌드 때 만드는 인기차트 파일(data/tj-chart.json)
  components/           화면 (TjifyApp이 메인, SettingsPanel이 내 API 키 설정)
  lib/i18n/             한국어·영어 문구표와 언어 전환
  lib/karaoke/          Manana 클라이언트, 매칭 점수, TJ 인기차트
  lib/insights/         Gemini·Claude 난이도·대중성 추정, "다 같이" 판정
  lib/text/             제목 정리, 가수 별칭표, 유튜브 제목 파싱, 붙여넣기 파싱
  lib/sources/          Spotify·YouTube API 호출
  lib/client/           브라우저 쪽 로그인, 저장소, 번호·난이도 대기열
```

Next.js 16(App Router, 정적 내보내기), React 19, TypeScript, Tailwind CSS 4, Vitest, zod, Anthropic SDK를 씁니다.

## 매칭이 틀릴 때

가수 이름의 영어·한글 표기가 달라 `?`가 자주 붙는다면 `src/lib/text/artist-aliases.ts`에 한 줄을 추가하는 것이 가장 빠릅니다. 검색어를 만드는 규칙은 `src/lib/karaoke/matcher.ts`와 `providers.ts`에 있습니다.
