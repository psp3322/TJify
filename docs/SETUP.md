# TJify 운영·개발 안내

사이트 소개는 [README](../README.md)에 있습니다. 이 문서는 사이트를 직접 띄우거나 고치려는 사람을 위한 안내입니다.

## 환경 변수

모두 선택입니다. 아무것도 넣지 않아도 붙여넣기와 노래방 번호 찾기는 동작합니다.

| 변수 | 용도 |
| --- | --- |
| `YOUTUBE_API_KEY` | YouTube 재생목록 링크를 로그인 없이 가져오기, 조회수 |
| `ANTHROPIC_API_KEY` | 곡 난이도·대중성 추정 |
| `ANTHROPIC_MODEL` | 추정에 쓸 모델. 기본값 `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` | 추정할 때 생각하는 정도. 기본값 `low` |
| `AI_DAILY_SONG_LIMIT` | 서버 인스턴스 하나가 하루에 Claude에 보내는 곡 수 상한. 기본값 3000 |
| `SESSION_SECRET` | 계정 연결용 쿠키 암호화 키 (32자 이상) |
| `APP_URL` | OAuth 리디렉션 기준 주소 (예: `https://tjify.vercel.app`) |
| `SPOTIFY_CLIENT_ID` | Spotify 계정 연결 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | YouTube 계정 연결 |
| `KY_PROVIDER` | `off`로 두면 금영 검색을 끕니다 |
| `TJ_CONCURRENCY`, `MANANA_CONCURRENCY` | 노래방 사이트로 보내는 동시 요청 수 (기본 3) |
| `KARAOKE_USER_AGENT` | 노래방 사이트가 기본 User-Agent를 막을 때만 바꿉니다 |

## Vercel에 배포하기

1. README의 **Deploy** 버튼을 누르거나, [Vercel](https://vercel.com)에서 **Add New → Project**로 이 저장소를 가져옵니다. 프레임워크는 Next.js로 자동 인식됩니다.
2. 필요한 환경 변수를 넣고 배포합니다. 나중에 넣었다면 Deployments에서 **Redeploy**를 눌러야 반영됩니다.
3. 계정 연결을 쓴다면 배포 주소 기준의 콜백 URI(`https://배포주소/api/auth/spotify/callback`, `https://배포주소/api/auth/google/callback`)를 Spotify 대시보드와 Google 콘솔에 추가합니다. `APP_URL`과 글자 하나까지 같아야 합니다.

## YouTube API 키 만들기

1. [Google Cloud 콘솔](https://console.cloud.google.com)에서 프로젝트를 만들고 **API 및 서비스 → 라이브러리**에서 **YouTube Data API v3**를 사용 설정합니다.
2. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**를 누릅니다.
3. 만든 키의 **API 제한사항**에서 YouTube Data API v3만 쓰도록 묶어 두고, `YOUTUBE_API_KEY`에 넣습니다.

재생목록 50곡을 읽을 때마다 하루 할당량(기본 10,000)을 2씩 씁니다(곡 목록 1, 조회수 1). 같은 링크는 서버가 10분 동안 캐시합니다.

## Anthropic API 키 만들기 (난이도·대중성)

1. [Claude Console](https://platform.claude.com)에서 API 키를 만들어 `ANTHROPIC_API_KEY`에 넣습니다.
2. 기본 모델은 `claude-opus-5-5`입니다. 곡 20개를 한 번에 묻고, 결과는 방문자 브라우저에 90일 동안 남아서 같은 곡을 다시 묻지 않습니다.
3. 요금을 줄이고 싶으면 `ANTHROPIC_MODEL=claude-haiku-5-5`로 바꿀 수 있습니다. 대신 덜 알려진 곡을 아는 정도가 떨어질 수 있습니다.
4. 요금 폭주를 막으려고 IP당 분당 200곡, 서버 인스턴스당 하루 `AI_DAILY_SONG_LIMIT`곡까지만 묻습니다.

## Spotify 앱 만들기 (계정 연결)

Spotify는 2026년 2월부터 개발 모드 앱에 제약이 있습니다. 앱을 만든 계정이 Premium이어야 하고, 대시보드에 등록한 5명까지만 쓸 수 있습니다.

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에서 **Create app**을 누릅니다.
2. Redirect URIs에 `http://127.0.0.1:3000/api/auth/spotify/callback`과 배포 주소의 콜백을 넣습니다. Spotify는 `localhost` 주소를 받지 않습니다.
3. 사용할 API로 **Web API**를 고릅니다.
4. Client ID를 `SPOTIFY_CLIENT_ID`에 넣습니다. PKCE 방식이라 Client Secret은 필요 없습니다.
5. **User Management**에 쓸 사람의 Spotify 계정 이메일을 등록합니다.

## Google OAuth 설정 (YouTube 계정 연결)

1. YouTube API 키를 만든 프로젝트의 **Google 인증 플랫폼(OAuth 동의 화면)** 에서 사용자 유형을 **외부**로 정합니다.
   - **대상**에서 테스트 사용자 이메일을 추가합니다 (테스트 모드에서는 최대 100명, 7일마다 다시 로그인).
   - **데이터 액세스**에 `https://www.googleapis.com/auth/youtube.readonly` 범위를 추가합니다.
2. **클라이언트 → 클라이언트 만들기 → 웹 애플리케이션**을 고르고, 승인된 리디렉션 URI에 `http://127.0.0.1:3000/api/auth/google/callback`과 배포 주소의 콜백을 넣습니다.
3. 클라이언트 ID와 보안 비밀번호를 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣습니다.

## 로컬에서 실행하기

Node.js 20.9 이상이 필요합니다.

```bash
npm install
```

```bash
cp .env.example .env.local
```

계정 연결을 쓸 거라면 `SESSION_SECRET`을 채웁니다. 아래 명령이 임의 문자열을 만들어 줍니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```bash
npm run dev
```

브라우저에서 http://127.0.0.1:3000 을 엽니다. 서버를 띄운 상태에서 다른 터미널로 실제 노래방 검색이 되는지 확인할 수 있습니다.

```bash
npm run smoke
```

## 개발 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 (127.0.0.1:3000) |
| `npm run build` / `npm start` | 프로덕션 빌드와 실행 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 라우트 타입 생성 후 TypeScript 검사 |
| `npm test` | Vitest 단위 테스트 |
| `npm run smoke` | 실행 중인 서버로 실제 TJ·금영 검색 확인 |

```
src/
  app/api/              import(링크), library(계정), karaoke(번호), song-insights(난이도), charts(TJ 인기차트), auth
  components/           화면 (TjifyApp이 메인)
  lib/karaoke/          TJ 검색·파서·인기차트, Manana 클라이언트, 매칭 점수
  lib/insights/         Claude 난이도·대중성 추정, "다 같이" 판정
  lib/text/             제목 정리, 가수 별칭표, 유튜브 제목 파싱, 붙여넣기 파싱
  lib/sources/          Spotify·YouTube API 호출
  lib/auth/             OAuth(PKCE), 암호화 쿠키 세션
  lib/client/           브라우저 쪽 저장소와 번호·난이도 대기열
```

Next.js 16(App Router), React 19, TypeScript, Tailwind CSS 4, Vitest, cheerio, iron-session, zod, Anthropic SDK를 씁니다.

## 매칭이 틀릴 때

가수 이름의 영어·한글 표기가 달라 `?`가 자주 붙는다면 `src/lib/text/artist-aliases.ts`에 한 줄을 추가하는 것이 가장 빠릅니다. TJ 홈페이지 구조가 바뀌어 번호를 못 찾으면 `src/lib/karaoke/tj-parser.ts`를 고칩니다.
