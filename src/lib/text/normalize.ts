/**
 * 곡 제목·가수 이름 비교용 문자열 처리.
 *
 * 노래방 DB와 스트리밍 서비스는 같은 곡을 다르게 적는다.
 *   Spotify  "좋은 날"            /  TJ "좋은날"
 *   YouTube  "Good Day(좋은 날)"  /  TJ "좋은날"
 *   Spotify  "Love wins all"     /  TJ "Love wins all"
 * 그래서 공백·문장부호를 지운 "압축형"끼리 비교하고, 괄호 안팎을 따로 떼어 낸
 * 여러 변형을 만들어 그중 가장 잘 맞는 쌍의 점수를 쓴다.
 */

const OPEN = "([{（［【「『〈《";
const CLOSE = ")]}）］】」』〉》";
const BRACKET_RE = new RegExp(`[${escapeClass(OPEN)}]([^${escapeClass(OPEN + CLOSE)}]*)[${escapeClass(CLOSE)}]`, "g");

/** 괄호 안에 있으면 "곡 이름이 아니라 버전 표시"로 보는 단어들 */
const DECORATION_RE =
  /\b(feat|ft|featuring|prod|produced|remaster(ed)?|live|ver|version|edit|mix|remix|inst|instrumental|acoustic|sped\s*up|slowed|explicit|clean|bonus|demo|from|ost|o\.s\.t|soundtrack|with|vocal|mr|radio|original|english|japanese|korean|chinese)\b|라이브|버전|리믹스|피처링|어쿠스틱|드라마|영화|삽입곡|주제가|원곡/i;

function escapeClass(chars: string): string {
  return chars.replace(/[\\\]\[^-]/g, "\\$&");
}

/** NFKC + 소문자 + 문자·숫자 이외 전부 제거 */
export function compact(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function collapseSpaces(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function hasHangul(input: string): boolean {
  return /\p{Script=Hangul}/u.test(input);
}

export function hasLatin(input: string): boolean {
  return /\p{Script=Latin}/u.test(input);
}

export function isDecoration(segment: string): boolean {
  return DECORATION_RE.test(segment);
}

/** 괄호 구간을 모두 지운다. "좋은 날 (Good Day)" -> "좋은 날" */
export function stripBrackets(input: string): string {
  let out = input;
  // 중첩 괄호를 위해 바뀌지 않을 때까지 반복
  for (let i = 0; i < 3; i++) {
    const next = out.replace(BRACKET_RE, " ");
    if (next === out) break;
    out = next;
  }
  return collapseSpaces(out);
}

/** 괄호 안 내용들. "Good Day(좋은 날)" -> ["좋은 날"] */
export function bracketContents(input: string): string[] {
  const found: string[] = [];
  for (const m of input.matchAll(BRACKET_RE)) {
    const inner = collapseSpaces(m[1] ?? "");
    if (inner) found.push(inner);
  }
  return found;
}

/**
 * 버전 표시만 지운다. "Song (feat. X)" -> "Song", "Song - Remastered 2011" -> "Song".
 * 버전 표시가 아닌 괄호("역겹겠지만(Remember me)")는 남긴다.
 */
export function stripDecorations(title: string): string {
  let out = title.replace(BRACKET_RE, (whole, inner: string) => (isDecoration(inner) ? " " : whole));
  // " - Live", " - From "Movie"" 처럼 대시 뒤에 붙는 Spotify식 버전 표시
  const dash = out.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  if (dash && isDecoration(dash[2])) out = dash[1];
  return collapseSpaces(out);
}

function uniqueByCompact(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = compact(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * 제목 변형 목록 (우선순위 순, 원문 형태 유지).
 * 1) 버전 표시 제거 2) 원문 3) 괄호 전부 제거 4) 괄호 안의 다른 제목
 */
export function titleVariants(title: string): string[] {
  const base = collapseSpaces(title);
  const variants = [stripDecorations(base), base, stripBrackets(base)];
  for (const inner of bracketContents(base)) {
    if (!isDecoration(inner)) variants.push(inner);
  }
  return uniqueByCompact(variants);
}

/** 한글과 라틴 문자가 섞인 이름을 문자 종류별로 나눈다. "aespa 에스파" -> ["aespa", "에스파"] */
export function splitScripts(input: string): string[] {
  if (!hasHangul(input) || !hasLatin(input)) return [];
  const hangul = collapseSpaces(input.replace(/[^\p{Script=Hangul}\p{N}\s]/gu, " "));
  const latin = collapseSpaces(input.replace(/[\p{Script=Hangul}]/gu, " ").replace(/[()]/g, " "));
  return [latin, hangul].filter((s) => compact(s).length > 0);
}

const ARTIST_SPLIT_RE = /\s*(?:,|&|\/|;|\s+x\s+|\s+×\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+featuring\s+|\s+with\s+|\s+and\s+)\s*/i;

/** 가수 문자열 하나를 비교 가능한 조각들로 나눈다. "아이유(IU)" -> ["아이유(IU)", "아이유", "IU"] */
export function artistPieces(artist: string): string[] {
  const base = collapseSpaces(artist);
  if (!base) return [];
  const pieces = [base, stripBrackets(base), ...bracketContents(base)];
  for (const part of stripBrackets(base).split(ARTIST_SPLIT_RE)) pieces.push(part);
  for (const inner of bracketContents(base)) {
    for (const part of inner.split(ARTIST_SPLIT_RE)) pieces.push(part);
  }
  pieces.push(...splitScripts(stripBrackets(base)));
  return uniqueByCompact(pieces.map((p) => p.replace(/^(feat|ft|prod)\.?\s+/i, "")));
}

function bigrams(s: string): Map<string, number> {
  const chars = Array.from(s);
  const grams = new Map<string, number>();
  for (let i = 0; i < chars.length - 1; i++) {
    const g = chars[i] + chars[i + 1];
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

/** 바이그램 Dice 계수 (0~1) */
export function dice(a: string, b: string): number {
  if (Array.from(a).length < 2 || Array.from(b).length < 2) return 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const [g, n] of ga) {
    overlap += Math.min(n, gb.get(g) ?? 0);
    total += n;
  }
  for (const n of gb.values()) total += n;
  return total === 0 ? 0 : (2 * overlap) / total;
}

function containmentAllowed(shorter: string): boolean {
  const len = Array.from(shorter).length;
  // 라틴 1~2글자("v", "iu")가 아무 단어에나 포함되는 오탐을 막는다
  return len >= 3 || (len === 2 && /[^\x00-\x7f]/.test(shorter));
}

/** 압축형 문자열 두 개의 유사도 (0~1) */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (longer.includes(shorter) && containmentAllowed(shorter)) {
    return 0.8 + 0.2 * (Array.from(shorter).length / Array.from(longer).length);
  }
  return dice(a, b);
}

/** 두 변형 집합(원문 형태) 사이의 최대 유사도 */
export function bestSimilarity(left: string[], right: string[]): number {
  const l = left.map(compact).filter(Boolean);
  const r = right.map(compact).filter(Boolean);
  let best = 0;
  for (const a of l) {
    for (const b of r) {
      const s = similarity(a, b);
      if (s > best) best = s;
      if (best === 1) return 1;
    }
  }
  return best;
}
