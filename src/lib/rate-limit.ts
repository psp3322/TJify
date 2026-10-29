/**
 * 아주 단순한 고정 창(fixed window) 요청 제한. 서버 인스턴스 메모리에만 있어서
 * 서버리스 환경에서는 대략적인 보호막 정도로만 동작한다.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return function take(key: string, cost = 1): { ok: boolean; retryAfterSec: number } {
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count + cost > limit) {
      return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += cost;
    return { ok: true, retryAfterSec: 0 };
  };
}

export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
