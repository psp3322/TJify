import { fetchWithRetry, UpstreamError } from "@/lib/http";
import { userAgent } from "./user-agent";

/*
 * TJ미디어 인기차트(TOP100).
 * 차트 화면(/chart/top100)이 쓰는 내부 API를 화면과 같은 방식으로 부른다:
 * 차트 화면을 한 번 열어 세션 쿠키와 CSRF_TOKEN 쿠키를 받고, 그 값을 X-CSRF-TOKEN 헤더에 실어 POST 한다.
 * 응답 항목: { rank, pro(곡번호), indexTitle(제목), indexSong(가수), ... }
 */

const TJ_BASE = "https://www.tjmedia.com";
const CHART_PAGE = `${TJ_BASE}/chart/top100`;
const CHART_API = `${TJ_BASE}/legacy/api/topAndHot100`;

export interface ChartEntry {
  no: string;
  rank: number;
  title: string;
  singer: string;
}

export interface ChartIndex {
  updatedAt: string;
  /** TJ 곡번호 → [그 기간 최고 순위, 기간 이름] */
  songs: Record<string, [number, string]>;
}

interface ChartSession {
  cookie: string;
  csrf: string;
}

export function parseTjChart(json: unknown): ChartEntry[] {
  const items = (json as { resultData?: { items?: unknown } } | null)?.resultData?.items;
  if (!Array.isArray(items)) return [];
  const out: ChartEntry[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const no = String(r.pro ?? "").trim();
    const rank = Number(r.rank);
    if (!/^\d+$/.test(no) || !Number.isInteger(rank) || rank < 1) continue;
    out.push({ no, rank, title: String(r.indexTitle ?? "").trim(), singer: String(r.indexSong ?? "").trim() });
  }
  return out;
}

function readCookies(res: Response): Record<string, string> {
  const lines = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookies: Record<string, string> = {};
  for (const line of lines) {
    const [pair] = line.split(";");
    const at = pair.indexOf("=");
    if (at > 0) cookies[pair.slice(0, at).trim()] = pair.slice(at + 1).trim();
  }
  return cookies;
}

async function openSession(fetchImpl: typeof fetch): Promise<ChartSession> {
  const res = await fetchWithRetry(CHART_PAGE, { fetchImpl, headers: { "User-Agent": userAgent(), Accept: "text/html" } });
  if (!res.ok) throw new UpstreamError(`TJ 차트 화면을 열지 못했습니다 (HTTP ${res.status})`, res.status);
  await res.arrayBuffer();
  const cookies = readCookies(res);
  return {
    cookie: Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; "),
    csrf: cookies.CSRF_TOKEN ?? "",
  };
}

async function fetchTop100(session: ChartSession, start: string, end: string, fetchImpl: typeof fetch): Promise<ChartEntry[]> {
  const res = await fetchWithRetry(CHART_API, {
    fetchImpl,
    method: "POST",
    headers: {
      "User-Agent": userAgent(),
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: TJ_BASE,
      Referer: CHART_PAGE,
      "X-Requested-With": "XMLHttpRequest",
      ...(session.csrf ? { "X-CSRF-TOKEN": session.csrf } : {}),
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    },
    body: new URLSearchParams({ chartType: "TOP", searchStartDate: start, searchEndDate: end, strType: "" }).toString(),
  });
  if (!res.ok) throw new UpstreamError(`TJ 차트를 받지 못했습니다 (HTTP ${res.status})`, res.status);
  return parseTjChart(await res.json());
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 최근 months개월을 한 달씩 나눈 기간 (한국 시간 기준, 이번 달은 오늘까지) */
export function monthWindows(now: Date, months = 12): Array<{ start: string; end: string; label: string }> {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const windows = [];
  for (let i = 0; i < months; i++) {
    const first = new Date(Date.UTC(y, m - i, 1));
    const last = i === 0 ? kst : new Date(Date.UTC(y, m - i + 1, 0));
    const fy = first.getUTCFullYear();
    const fm = first.getUTCMonth() + 1;
    windows.push({
      start: `${fy}-${pad(fm)}-01`,
      end: `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`,
      label: `${fy}년 ${fm}월`,
    });
  }
  return windows;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 최근 1년 동안 달마다 TOP100에 든 곡을 모아 곡번호별 최고 순위를 만든다 */
export async function buildTjChartIndex(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<ChartIndex> {
  const session = await openSession(fetchImpl);
  const songs: Record<string, [number, string]> = {};
  let succeeded = 0;
  let lastError: unknown;
  for (const w of monthWindows(now)) {
    try {
      for (const e of await fetchTop100(session, w.start, w.end, fetchImpl)) {
        const prev = songs[e.no];
        if (!prev || e.rank < prev[0]) songs[e.no] = [e.rank, w.label];
      }
      succeeded++;
    } catch (error) {
      lastError = error;
    }
    // TJ 서버에 한꺼번에 몰아서 보내지 않는다
    await sleep(200);
  }
  if (succeeded === 0) throw lastError ?? new UpstreamError("TJ 차트를 받지 못했습니다");
  return { updatedAt: now.toISOString(), songs };
}
