import { TtlCache } from "@/lib/cache";
import { trackKey } from "@/lib/track-key";
import { estimateSongs, type InsightClient } from "./claude";
import type { InsightRequestItem, InsightResult, SongInsight } from "./types";

const DAY = 24 * 60 * 60 * 1000;
// 같은 곡은 여러 사람이 물어봐도 한 번만 Claude에 보낸다
const cache = new TtlCache<SongInsight | null>(20_000);

/** 서버 인스턴스 하나가 하루에 Claude에 보내는 곡 수 상한 (요금 폭주 방지) */
function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_SONG_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

let usage = { day: "", count: 0 };

export class DailyLimitError extends Error {
  constructor() {
    super("오늘 난이도 추정 한도를 다 썼어요. 내일 다시 볼 수 있어요.");
    this.name = "DailyLimitError";
  }
}

function reserve(count: number) {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) usage = { day: today, count: 0 };
  if (usage.count + count > dailyLimit()) throw new DailyLimitError();
  usage.count += count;
}

/** 캐시에 없는 곡만 모아 한 번에 추정하고, 요청 순서대로 돌려준다 */
export async function songInsights(items: InsightRequestItem[], client?: InsightClient): Promise<InsightResult[]> {
  const keys = items.map((item) => trackKey(item));
  const missing: number[] = [];
  keys.forEach((k, i) => {
    if (cache.get(k) === undefined && !missing.some((j) => keys[j] === k)) missing.push(i);
  });

  if (missing.length > 0) {
    reserve(missing.length);
    const estimated = await estimateSongs(
      missing.map((i) => items[i]),
      client,
    );
    missing.forEach((i, n) => cache.set(keys[i], estimated[n] ?? null, estimated[n] ? 30 * DAY : 7 * DAY));
  }

  return items.map((item, i) => ({ key: item.key, insight: cache.get(keys[i]) ?? null }));
}
