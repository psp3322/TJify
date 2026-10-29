import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, isSameOrigin, jsonError } from "@/lib/api";
import { MATCH_BATCH_SIZE } from "@/lib/constants";
import { matchTracks } from "@/lib/karaoke/service";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

const Body = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(400),
        title: z.string().trim().min(1).max(300),
        artists: z.array(z.string().max(200)).max(10),
      }),
    )
    .min(1)
    .max(MATCH_BATCH_SIZE),
  brands: z.array(z.enum(["tj", "ky"])).min(1).max(2),
});

// IP당 1분에 곡 240개까지
const take = createRateLimiter(240, 60_000);

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_request", "허용되지 않은 요청입니다.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "bad_request", "요청 형식이 맞지 않습니다.");

  const { items, brands } = parsed.data;
  const limit = take(clientKey(request.headers), items.length);
  if (!limit.ok) {
    const res = jsonError(429, "rate_limited", `요청이 너무 많습니다. ${limit.retryAfterSec}초 뒤 다시 시도합니다.`);
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  try {
    const results = await matchTracks(items, [...new Set(brands)]);
    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}
