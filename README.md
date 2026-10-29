# TJify

Spotify와 YouTube에서 좋아요 누른 노래를 불러와 TJ·금영 노래방 번호를 찾아 주는 웹앱입니다.
노래방 갈 때마다 같은 노래만 부르지 않으려고 만들었습니다.

- Spotify **좋아요 표시한 곡**과 플레이리스트
- YouTube·YouTube Music에서 **좋아요 누른 영상**과 재생목록
- 계정 연결 없이 **목록 붙여넣기** ("가수 - 제목" 한 줄씩, Exportify CSV)
- TJ·금영 번호 자동 매칭. 확실하지 않은 결과는 `?`로 표시하고, 후보 중에서 고르거나 직접 검색해 바로잡을 수 있습니다
- 부른 곡 기록, 최근 2주 안에 부른 곡을 뺀 랜덤 추천("뭐 부르지?")
- 휴대폰 홈 화면에 앱처럼 추가(PWA)

## 먼저 알아 둘 제약

**Spotify 개발 모드 정책 (2026년 2월 변경)**
- 개발 모드 앱은 앱 소유자 계정이 Spotify Premium이어야 동작합니다.
- 새로 만든 앱은 사용자를 최대 5명까지, 대시보드에 직접 등록해야 쓸 수 있습니다.
- 그 이상 공개하려면 확장 할당량(Extended Quota)을 받아야 하는데, 사업자 요건이 있어 개인 프로젝트로는 어렵습니다. 친구 몇 명과 쓰는 용도로 생각하고, 더 많은 사람에게는 YouTube 연결이나 붙여넣기를 안내하는 편이 현실적입니다.

**Google(YouTube) 테스트 모드**
- 테스트 사용자는 최대 100명이고 Google Cloud 콘솔에 이메일을 등록해야 합니다.
- 테스트 모드에서는 refresh token이 7일 뒤 만료되므로 일주일에 한 번쯤 다시 연결해야 합니다.
- 누구나 쓰게 하려면 Google 앱 인증을 받아야 합니다(`youtube.readonly`는 민감한 범위).

**노래방 번호 데이터**
- TJ미디어와 금영 모두 공식 공개 API가 없습니다.
- TJ는 tjmedia.com 반주곡 검색 페이지를 사이트 검색창과 같은 방식으로 요청해 결과를 읽습니다. 사이트 구조가 바뀌면 `src/lib/karaoke/tj-parser.ts`를 고쳐야 합니다.
- 금영은 여러 노래방 번호 앱이 쓰는 [Manana 노래방 API](https://api.manana.kr/karaoke)로 찾습니다. TJ 사이트가 응답하지 않을 때도 이 API로 대신 찾습니다.
- 이 저장소를 만든 개발 환경에서는 api.manana.kr에 접속할 수 없어서, 금영 검색은 실제 응답으로 확인하지 못했습니다. 처음 실행할 때 `npm run smoke`로 꼭 확인해 주세요.
- 번호는 노래방 기기 모델이나 업데이트 시점에 따라 실제와 다를 수 있습니다.

## 로컬에서 실행하기

Node.js 20.9 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 `SESSION_SECRET`부터 채웁니다. 아래 명령이 32자 이상의 임의 문자열을 만들어 줍니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```bash
npm run dev
```

브라우저에서 **http://127.0.0.1:3000** 을 엽니다. `localhost`가 아니라 `127.0.0.1`인 이유는 Spotify가 `localhost` 리디렉션 주소를 받지 않기 때문입니다.

붙여넣기 탭은 Spotify·Google 설정 없이도 바로 쓸 수 있습니다. 서버를 띄운 상태에서 다른 터미널로 노래방 검색이 되는지 확인합니다.

```bash
npm run smoke
```

## Spotify 앱 만들기

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에서 **Create app**을 누릅니다.
2. Redirect URIs에 `http://127.0.0.1:3000/api/auth/spotify/callback`을 넣습니다. 배포한 뒤에는 `https://배포주소/api/auth/spotify/callback`도 추가합니다.
3. 사용할 API로 **Web API**를 고릅니다.
4. 앱 설정의 Client ID를 `.env.local`의 `SPOTIFY_CLIENT_ID`에 넣습니다. PKCE 방식이라 Client Secret은 필요 없습니다.
5. **User Management**에 쓸 사람의 Spotify 계정 이메일을 등록합니다(본인 포함 최대 5명).

## Google(YouTube) 설정

1. [Google Cloud 콘솔](https://console.cloud.google.com)에서 새 프로젝트를 만듭니다.
2. **API 및 서비스 → 라이브러리**에서 **YouTube Data API v3**를 사용 설정합니다.
3. **Google 인증 플랫폼(OAuth 동의 화면)** 에서 사용자 유형을 **외부**로 정하고, 앱 이름과 연락처 이메일을 입력합니다.
   - **대상**에서 테스트 사용자 이메일을 추가합니다.
   - **데이터 액세스**에 `https://www.googleapis.com/auth/youtube.readonly` 범위를 추가합니다.
4. **클라이언트 → 클라이언트 만들기 → 웹 애플리케이션**을 고르고, 승인된 리디렉션 URI에 `http://127.0.0.1:3000/api/auth/google/callback`을 넣습니다. 배포 주소도 같은 형식으로 추가합니다.
5. 발급된 클라이언트 ID와 보안 비밀번호를 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣습니다.

YouTube Music에서 좋아요한 곡은 YouTube의 "좋아요 표시한 동영상"에도 들어가므로 YouTube 좋아요 탭에서 같이 보입니다.

## Vercel에 배포하기

1. [Vercel](https://vercel.com)에서 **Add New → Project**를 누르고 이 GitHub 저장소를 가져옵니다. 프레임워크는 Next.js로 자동 인식됩니다.
2. Environment Variables에 `SESSION_SECRET`, `APP_URL`(예: `https://tjify.vercel.app`), `SPOTIFY_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 넣고 배포합니다.
3. 배포 주소 기준의 콜백 URI 두 개를 Spotify 대시보드와 Google 콘솔에 추가합니다. `APP_URL`과 글자 하나까지 같아야 합니다.
4. 휴대폰에서 주소를 열고 홈 화면에 추가하면 앱처럼 쓸 수 있습니다. iPhone은 Safari 공유 버튼 → 홈 화면에 추가, Android는 Chrome 메뉴 → 앱 설치입니다.

## 번호를 찾는 방식

1. 곡 제목을 정리합니다. 공백과 문장부호는 무시하고 `(feat. …)`, `Remastered`, `Live` 같은 버전 표시를 뗍니다. `Good Day(좋은 날)`처럼 괄호 안에 다른 언어 제목이 있으면 그것도 검색어 후보로 씁니다.
2. 노래방 곡 제목으로 먼저 검색하고, 확실한 결과가 없으면 가수명으로 한 번 더 검색합니다. 가수명은 `IU ↔ 아이유`, `BTS ↔ 방탄소년단` 같은 별칭표(`src/lib/text/artist-aliases.ts`)로 한글 표기를 먼저 씁니다.
3. 제목 유사도 65%, 가수 유사도 35%로 점수를 매겨 `확실 / 거의 확실 / ?(확인 필요) / 없음`으로 나눕니다. 같은 제목에 MR·라이브 수록본이 따로 있으면 원곡 번호를 앞에 둡니다.
4. 찾은 결과는 브라우저 localStorage에 30일(못 찾은 곡은 7일) 동안 남겨 두고, 서버는 같은 검색을 12시간 캐시합니다.
5. 노래방 사이트에는 동시에 3건까지만 요청하고, 연달아 실패하면 30초 동안 요청을 멈춥니다.

별칭표에 없는 가수라 번호가 `?`로 나오면 곡을 눌러 후보에서 고르면 됩니다. 고른 번호는 다음부터 그대로 쓰입니다. 자주 틀리는 가수가 있으면 별칭표에 한 줄 추가하는 것이 가장 빠른 개선입니다.

## 개인정보

- Spotify·YouTube에는 읽기 권한만 요청합니다.
- 로그인 토큰은 암호화한 httpOnly 쿠키에만 저장하며, 서버에 데이터베이스가 없습니다.
- 찾은 번호, 직접 고른 번호, 부른 기록은 각자의 브라우저에만 저장됩니다.

## 개발

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
  app/api/            인증(auth), 라이브러리(library), 노래방 검색(karaoke) API
  components/         화면 (TjifyApp이 메인)
  lib/karaoke/        TJ 검색·파서, Manana 클라이언트, 매칭 점수, 캐시
  lib/text/           제목 정리, 가수 별칭표, 유튜브 제목 파싱, 붙여넣기 파싱
  lib/sources/        Spotify·YouTube API 호출
  lib/auth/           OAuth(PKCE), 암호화 쿠키 세션
  lib/client/         브라우저 쪽 저장소와 번호 찾기 대기열
```

Next.js 16(App Router), React 19, TypeScript, Tailwind CSS 4, Vitest, cheerio, iron-session, zod를 씁니다.

## 앞으로 해 볼 만한 것

- 금영 공식 검색(kysing.kr)을 직접 읽기
- TJ·금영 곡 목록을 미리 받아 두고 서버 안에서 매칭하기 (훨씬 빨라지고 노래방 사이트에 보내는 요청도 줄어듭니다)
- 멜론·지니 플레이리스트 가져오기
- 앱스토어용 앱으로 감싸기 (Capacitor 등)

## 참고와 면책

- TJ 검색 경로와 결과 마크업 구조는 [tj-mcp](https://github.com/ara-hwang/tj-mcp)(MIT)를 참고했습니다. 파서 테스트에 쓰는 `src/lib/karaoke/__fixtures__/tj-search-singer.html`은 그 저장소에 있는 실제 검색 결과 HTML에서 세 줄을 발췌한 것입니다.
- 금영 번호는 Manana 노래방 API에서 가져옵니다.
- TJ미디어, 금영엔터테인먼트와 관계없는 개인 프로젝트입니다.

라이선스: [Apache-2.0](./LICENSE)
