/** 사이트 하단 소개. README에 적던 설명을 방문자가 사이트 안에서 바로 읽을 수 있게 옮겼다 */
export function AboutSection({ aiEnabled }: { aiEnabled: boolean }) {
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
            &quot;아이유&quot;처럼 영어·한글 가수 이름을 이어서 비교해요. 확실하지 않은 번호에는 <b>?</b>가 붙고, 곡을 눌러 노래방 사이트에서 직접 찾아볼 수도 있어요.
          </p>
        </Item>

        <Item title="난이도와 '다 같이' 표시는 뭔가요?">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>난이도</b>는 노래를 따로 배우지 않은 사람이 노래방에서 부를 때 기준으로 아주 쉬움~아주 어려움 다섯 단계예요.{" "}
              {aiEnabled ? "Claude가 곡을 보고 추정해요." : "설정에 Anthropic API 키를 넣으면 Claude가 곡을 보고 추정해요."} 직접 불러 보고 매긴 난이도가 있으면
              그걸 먼저 보여 줘요.
            </li>
            <li>
              <b>다 같이</b>는 같이 간 사람들도 따라 부를 수 있을 만큼 알려진 곡이라는 뜻이에요. TJ 노래방 인기차트 TOP100(최근 1년, 매주 새로 받아요)에 든 곡,
              YouTube 조회수가 많은 곡{aiEnabled ? ", Claude가 '대부분 아는 곡'으로 본 곡" : ""}이 여기에 들어가요.
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
            이 사이트는 서버 없이 GitHub Pages에서 돌아가요. 노래방 번호 검색, YouTube·Spotify, Claude 요청은 모두 이 브라우저에서 해당 서비스로 바로 가고, 찾은
            번호·부른 기록·로그인 정보·API 키는 이 브라우저에만 저장돼요. 로그인은 읽기 권한만 요청하고, 난이도를 추정할 때는 곡 제목과 가수 이름만 Claude에 보내요.
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
