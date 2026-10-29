import { collapseSpaces } from "./normalize";

/**
 * 유튜브 영상 제목에서 "가수"와 "곡 제목"을 뽑는다.
 *
 * 처리하는 대표 형태
 *   "Love wins all"                     (채널 "IU - Topic", 유튜브 뮤직 자동 생성)
 *   "[MV] IU(아이유) _ Love wins all"
 *   "aespa 에스파 'Supernova' MV"
 *   "Ed Sheeran - Shape of You (Official Music Video)"
 *   "YOASOBI「アイドル」 Official Music Video"
 * 어느 형태에도 맞지 않으면 제목 전체를 곡 제목으로, 채널 이름을 가수로 본다.
 */

const NOISE_WORDS = [
  "mv",
  "m/v",
  "official",
  "music video",
  "video",
  "lyric",
  "lyrics",
  "가사",
  "audio",
  "visualizer",
  "teaser",
  "4k",
  "8k",
  "hd",
  "hq",
  "1080p",
  "eng",
  "sub",
  "자막",
  "color coded",
  "performance",
  "dance",
  "안무",
  "choreography",
  "stage",
  "직캠",
  "fancam",
  "special clip",
  "behind",
  "making",
  "reaction",
  "1시간",
  "1 hour",
  "반복",
  "연속",
  "듣기",
  "노래방",
  "karaoke",
  "inst",
  "instrumental",
  "piano",
  "cover",
  "커버",
  "full album",
  "playlist",
  "플레이리스트",
  "spot",
  "clip",
  "premiere",
];

const NOISE_RE = new RegExp(
  `(^|[^\\p{L}\\p{N}])(${NOISE_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})($|[^\\p{L}\\p{N}])`,
  "iu",
);

const TRAILING_NOISE_RE =
  /\s*(?:[-–—|:]\s*)?\b(?:official\s+)?(?:music\s+video|mv|m\/v|video|audio|lyric\s+video|lyrics?|visualizer|teaser|performance\s+video|dance\s+practice|live\s+clip|special\s+clip)\s*$/i;

/** 레이블·방송사 채널. 제목에서 가수를 못 찾았을 때 이 채널명을 가수로 쓰지 않는다. */
const LABEL_CHANNELS = [
  "1thek",
  "원더케이",
  "smtown",
  "hybe labels",
  "jyp entertainment",
  "yg entertainment",
  "stone music entertainment",
  "starship",
  "kakao entertainment",
  "mnet k-pop",
  "mnet kpop",
  "kbs kpop",
  "kbs world tv",
  "mbckpop",
  "mbc kpop",
  "sbs kpop",
  "m2",
  "dingo music",
  "dingo",
  "genie music",
  "melon",
  "studio choom",
  "it's live",
  "killing verse",
];

const QUOTE_PAIRS: Array<[string, string]> = [
  ["'", "'"],
  ["‘", "’"],
  ['"', '"'],
  ["“", "”"],
  ["「", "」"],
  ["『", "』"],
  ["《", "》"],
  ["〈", "〉"],
];

const BRACKET_SEGMENT_RE = /[\[(【（［〔]([^\])】）］〕]*)[\])】）］〕]/g;

export interface ParsedVideoTitle {
  title: string;
  artists: string[];
}

function removeNoiseBrackets(input: string): string {
  return collapseSpaces(input.replace(BRACKET_SEGMENT_RE, (whole, inner: string) => (NOISE_RE.test(inner) ? " " : whole)));
}

/** 끝에 붙은 "Official MV" 같은 꼬리를 지운다. 전부 꼬리였으면 빈 문자열 */
function stripTrailingNoise(input: string): string {
  let out = input;
  for (let i = 0; i < 4; i++) {
    const next = out.replace(TRAILING_NOISE_RE, "").trim();
    if (next === out) break;
    out = next;
  }
  return out.replace(/[\s\-–—_|:~]+$/u, "").trim();
}

/** 채널 이름을 가수 이름으로 다듬는다. "IU Official" -> "IU", 레이블 채널이면 null */
export function channelToArtist(channel: string | undefined): string | null {
  if (!channel) return null;
  const topic = channel.match(/^(.*)\s+-\s+Topic$/i);
  if (topic) return collapseSpaces(topic[1]);
  const lowered = channel.toLowerCase();
  if (LABEL_CHANNELS.some((label) => lowered.includes(label))) return null;
  const cleaned = collapseSpaces(
    channel
      .replace(/vevo$/i, "")
      .replace(/\b(official|officials|channel|music|tv)\b/gi, " ")
      .replace(/(공식|채널)/g, " "),
  );
  return cleaned || null;
}

function splitByQuote(text: string): ParsedVideoTitle | null {
  for (const [open, close] of QUOTE_PAIRS) {
    const start = text.indexOf(open);
    if (start <= 0) continue;
    // 따옴표 앞은 공백이어야 한다 (Don't 같은 아포스트로피 제외). 「」류는 붙어 있어도 된다
    const isCjk = open === "「" || open === "『" || open === "《" || open === "〈";
    if (!isCjk && !/\s/.test(text[start - 1])) continue;
    const end = text.indexOf(close, start + 1);
    if (end <= start + 1) continue;
    const artist = collapseSpaces(text.slice(0, start));
    const title = collapseSpaces(text.slice(start + 1, end));
    if (artist && title) return { artists: [artist], title };
  }
  return null;
}

function splitByDash(text: string): ParsedVideoTitle | null {
  const m = text.match(/^(.+?)\s+[-–—_~]\s+(.+)$/);
  if (!m) return null;
  const artist = collapseSpaces(m[1]);
  const title = collapseSpaces(m[2]);
  if (!artist || !title) return null;
  return { artists: [artist], title };
}

export function parseVideoTitle(rawTitle: string, channelTitle?: string): ParsedVideoTitle {
  const channelArtist = channelToArtist(channelTitle);
  const isTopic = Boolean(channelTitle && /\s+-\s+Topic$/i.test(channelTitle));

  // 유튜브 뮤직 자동 생성 영상은 제목이 곧 곡 제목이다
  if (isTopic && channelArtist) {
    return { title: collapseSpaces(rawTitle), artists: [channelArtist] };
  }

  // "제목 | 채널명 Official" 같은 꼬리는 첫 구간만 남긴다
  const firstSegment = rawTitle.split(/\s+\|\s+|\s*｜\s*/)[0] ?? rawTitle;
  const base = removeNoiseBrackets(firstSegment);
  const fallbackArtists = channelArtist ? [channelArtist] : [];

  const parsed = splitByDash(base) ?? splitByQuote(base);
  if (parsed) {
    const title = stripTrailingNoise(parsed.title);
    const artists = parsed.artists.map((a) => stripTrailingNoise(a) || a);
    if (title) return { title, artists };
    // "곡명 - Official Video"처럼 대시 뒤가 전부 꼬리면 앞부분이 곡 제목이다
    return { title: artists[0], artists: fallbackArtists };
  }

  return {
    title: stripTrailingNoise(base) || collapseSpaces(rawTitle),
    artists: fallbackArtists,
  };
}
