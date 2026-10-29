import * as cheerio from "cheerio";
import { collapseSpaces } from "@/lib/text/normalize";
import type { KaraokeSong } from "@/lib/types";

/**
 * tjmedia.com 반주곡 검색 결과(/song/accompaniment_search) HTML 파서.
 *
 * 결과 한 줄의 마크업 (2025년 개편 이후):
 *   <ul class="grid-container list ico">
 *     <li class="grid-item center pos-type"><p class="count"><span class="mo-title">곡번호</span><span class="num2">80563</span></p></li>
 *     <li class="grid-item title3"><div class="flex-box ico-flex"><ul><li><p class="ico mr">MR</p></li></ul><p class=""><span>곡 제목</span></p></div></li>
 *     <li class="grid-item title4 singer"><p><span>가수</span></p></li>
 *     <li class="grid-item title5"><p><span>작사</span></p></li>
 *     <li class="grid-item title6"><p><span>작곡</span></p></li>
 *   </ul>
 * 머리글 줄은 "grid-container top"이라 ".list" 선택자에 걸리지 않는다.
 * 통합검색은 곡 제목/가수 구역에 같은 곡이 반복될 수 있어 곡번호로 중복을 거른다.
 */
export function parseTjSearchHtml(html: string): KaraokeSong[] {
  const $ = cheerio.load(html);
  const songs: KaraokeSong[] = [];
  const seen = new Set<string>();

  $("ul.grid-container.list").each((_, el) => {
    const row = $(el);
    const no = row.find(".num2").first().text().replace(/\D+/g, "");
    const titleCell = row.find("li.title3");
    const title = collapseSpaces(titleCell.find("p").not(".ico, .no-ico").last().text());
    const singer = collapseSpaces(row.find("li.title4").first().text());
    if (!no || !title || seen.has(no)) return;
    seen.add(no);

    const tags = titleCell
      .find("p.ico")
      .map((__, p) => collapseSpaces($(p).text()))
      .get()
      .filter(Boolean);
    const lyricist = collapseSpaces(row.find("li.title5").first().text());
    const composer = collapseSpaces(row.find("li.title6").first().text());

    songs.push({
      brand: "tj",
      no,
      title,
      singer,
      ...(lyricist ? { lyricist } : {}),
      ...(composer ? { composer } : {}),
      ...(tags.length ? { tags } : {}),
    });
  });

  return songs;
}
