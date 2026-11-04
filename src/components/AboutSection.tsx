"use client";

import { useLang } from "@/lib/i18n/react";

/** 사이트 하단 소개. README에 적던 설명을 방문자가 사이트 안에서 바로 읽을 수 있게 옮겼다 (한국어·영어) */
export function AboutSection({ aiEnabled }: { aiEnabled: boolean }) {
  return useLang() === "en" ? <AboutEn aiEnabled={aiEnabled} /> : <AboutKo aiEnabled={aiEnabled} />;
}

function AboutKo({ aiEnabled }: { aiEnabled: boolean }) {
  return (
    <section aria-labelledby="about-title" className="mt-auto space-y-2 border-t border-line pt-6">
      <h2 id="about-title" className="text-sm font-semibold">
        TJify 소개
      </h2>
      <p className="text-sm text-muted">
        노래방 갈 때마다 같은 노래만 부르게 되는 게 싫어서 만든 사이트예요. 평소에 듣던 플레이리스트를 넣으면 곡마다 TJ·금영 번호를 찾고, 부르기 어려운지,
        같이 간 사람들도 아는 노래인지 같이 보여 줘요.
      </p>

      <div className="divide-y divide-line/60 rounded-xl border border-line text-sm">
        <Item title="어떻게 쓰나요?">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <b>링크로 가져오기</b>에 YouTube·YouTube Music 재생목록이나 Spotify 플레이리스트 주소를 붙여넣어요.
            </li>
            <li>곡 목록이 뜨면 번호와 난이도를 차례로 찾아요. 한 번 찾은 결과는 이 브라우저에 남아서 다음엔 바로 떠요.</li>
            <li>곡을 누르면 다른 후보 번호를 고르거나 직접 검색할 수 있고, 부른 곡은 “불렀어요”로 기록해 둘 수 있어요.</li>
            <li>“뭐 부르지?”를 누르면 최근 2주 안에 부르지 않은 곡 중에서 하나 골라 줘요.</li>
          </ol>
          <p className="mt-2">링크가 없으면 “가수 - 제목”을 한 줄씩 붙여넣어도 돼요.</p>
        </Item>

        <Item title="번호는 어디서 가져오나요?">
          <p>
            TJ·금영 번호 모두 여러 노래방 번호 앱이 쓰는 공개 API(Manana)에서 찾아요. 제목 표기가 달라도 찾을 수 있게 띄어쓰기·괄호를 무시하고, &quot;IU&quot;와
            &quot;아이유&quot;처럼 영어·한글 가수 이름을 이어서 비교해요. 확실하지 않은 번호에는 <b>?</b>가 붙고, 곡을 눌러 직접 찾아볼 수도 있어요.
          </p>
        </Item>

        <Item title="난이도와 '다 같이' 표시는 뭔가요?">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>난이도</b>는 노래를 따로 배우지 않은 사람이 노래방에서 부를 때 기준으로 아주 쉬움~아주 어려움 다섯 단계예요.{" "}
              {aiEnabled ? "AI(Gemini나 Claude)가 곡을 보고 추정해요." : "설정에 무료 Gemini API 키를 넣으면 AI가 곡을 보고 추정해요."} 직접 불러 보고 매긴
              난이도가 있으면 그걸 먼저 보여 줘요.
            </li>
            <li>
              <b>다 같이</b>는 같이 간 사람들도 따라 부를 수 있을 만큼 알려진 곡이라는 뜻이에요. TJ 노래방 인기차트 TOP100(최근 1년, 매주 새로 받아요)에 든 곡,
              YouTube 조회수가 많은 곡{aiEnabled ? ", AI가 '대부분 아는 곡'으로 본 곡" : ""}이 여기에 들어가요.
            </li>
            <li>추정이라 틀릴 수 있어요. 특히 덜 알려진 곡은 &quot;모름&quot;으로 남겨 둬요.</li>
          </ul>
        </Item>

        <Item title="어떤 링크를 넣을 수 있나요?">
          <ul className="list-disc space-y-1 pl-5">
            <li>YouTube·YouTube Music: 공개나 일부 공개 재생목록은 로그인 없이 가져와요 (YouTube API 키가 있을 때). YouTube Music 자동 믹스는 안 돼요.</li>
            <li>
              Spotify: Spotify 정책(2026년 2월 변경)상 연결한 계정이 만들었거나 공동 작업 중인 플레이리스트만 읽을 수 있어요. 다른 사람 플레이리스트나 Spotify가 만든
              플레이리스트는 막혀 있어요.
            </li>
            <li>가져온 목록의 주소를 친구에게 보내면 같은 목록이 바로 열려요 (YouTube 재생목록).</li>
          </ul>
        </Item>

        <Item title="개인정보는요?">
          <p>
            이 사이트는 서버 없이 GitHub Pages에서 돌아가요. 노래방 번호 검색, YouTube·Spotify, AI 요청은 모두 이 브라우저에서 해당 서비스로 바로 가고, 찾은 번호·부른
            기록·로그인 정보·API 키는 이 브라우저에만 저장돼요. 로그인은 읽기 권한만 요청하고, 난이도를 추정할 때는 곡 제목과 가수 이름만 AI에 보내요. Gemini 무료
            등급에서는 보낸 곡 제목·가수가 Google 서비스 개선에 쓰일 수 있어요.
          </p>
        </Item>
      </div>
    </section>
  );
}

function AboutEn({ aiEnabled }: { aiEnabled: boolean }) {
  return (
    <section aria-labelledby="about-title" className="mt-auto space-y-2 border-t border-line pt-6">
      <h2 id="about-title" className="text-sm font-semibold">
        About TJify
      </h2>
      <p className="text-sm text-muted">
        I made this because I kept singing the same songs at karaoke. Add a playlist you already listen to, and for each song it finds the TJ and KY (Kumyoung) karaoke
        numbers, how hard it is to sing, and whether the people you&apos;re with will know it.
      </p>

      <div className="divide-y divide-line/60 rounded-xl border border-line text-sm">
        <Item title="How do I use it?">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Paste a YouTube / YouTube Music playlist or a Spotify playlist link into <b>Import a link</b>.
            </li>
            <li>Numbers and difficulty fill in song by song. Results stay in this browser, so they show up instantly next time.</li>
            <li>Tap a song to pick another candidate number or search yourself, and mark songs you sang with “I sang this”.</li>
            <li>“What should I sing?” picks a song you haven&apos;t sung in the last 2 weeks.</li>
          </ol>
          <p className="mt-2">No link? Paste “Artist - Title” one per line.</p>
        </Item>

        <Item title="Where do the numbers come from?">
          <p>
            Both TJ and KY numbers come from Manana, a public karaoke API that many karaoke number apps use. Spacing and brackets are ignored so different spellings still
            match, and English and Korean artist names (like &quot;IU&quot; and &quot;아이유&quot;) are treated as the same. Numbers that aren&apos;t certain get a{" "}
            <b>?</b>, and you can tap a song to search yourself.
          </p>
          <p className="mt-2">Karaoke song titles are stored the way Korean karaoke machines list them, so Korean songs are usually listed by their Korean titles.</p>
        </Item>

        <Item title="What do difficulty and “Sing-along” mean?">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Difficulty</b> has five levels, from very easy to very hard, for someone without vocal training singing at karaoke.{" "}
              {aiEnabled ? "An AI (Gemini or Claude) estimates it." : "Add a free Gemini API key in settings and an AI will estimate it."} Your own rating, if you set
              one, comes first.
            </li>
            <li>
              <b>Sing-along</b> means the song is well known enough that others can sing along: songs in the TJ karaoke TOP 100 chart (past year, refreshed weekly),
              songs with lots of YouTube views{aiEnabled ? ", and songs the AI rates as widely known" : ""}.
            </li>
            <li>These are estimates and can be wrong. Lesser-known songs are left as unknown.</li>
          </ul>
        </Item>

        <Item title="Which links work?">
          <ul className="list-disc space-y-1 pl-5">
            <li>YouTube / YouTube Music: public or unlisted playlists load without signing in (when a YouTube API key is set). Auto-generated mixes don&apos;t work.</li>
            <li>
              Spotify: since Spotify&apos;s February 2026 policy change, only playlists created by, or shared for collaboration with, the connected account can be read.
              Other people&apos;s playlists and Spotify-made playlists are blocked.
            </li>
            <li>Send the page address to a friend and the same list opens for them (YouTube playlists).</li>
          </ul>
        </Item>

        <Item title="What about privacy?">
          <p>
            This site runs on GitHub Pages with no server. Karaoke lookups and YouTube, Spotify and AI requests go straight from this browser to those services, and your
            numbers, singing history, sign-ins and API keys are stored only in this browser. Sign-in asks for read access only, and only song titles and artists are sent
            to the AI. On Gemini&apos;s free tier, the titles and artists you send may be used to improve Google&apos;s products.
          </p>
        </Item>
      </div>
    </section>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group px-4 py-3">
      <summary className="cursor-pointer list-none font-medium marker:hidden">
        <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="mt-2 space-y-1 pl-5 text-muted">{children}</div>
    </details>
  );
}
