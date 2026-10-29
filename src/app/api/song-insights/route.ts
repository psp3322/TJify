import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOrigin, jsonError } from "@/lib/api";
import { InsightRefusedError, isInsightConfigured, MAX_INSIGHT_BATCH } from "@/lib/insights/claude";
import { DailyLimitError, songInsights } from "@/lib/insights/service";
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
    .max(MAX_INSIGHT_BATCH),
});

// IP당 1분에 곡 200개까지
const take = createRateLimiter(200, 60_000);

/** 곡 난이도·대중성 추정 (Claude). ANTHROPIC_API_KEY가 있을 때만 켜진다 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_request", "허용되지 않은 요청입니다.");
  if (!isInsightConfigured()) return jsonError(503, "not_configured", "서버에 ANTHROPIC_API_KEY가 없어서 난이도 추정이 꺼져 있어요.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "bad_request", "요청 형식이 맞지 않습니다.");

  const limit = take(clientKey(request.headers), parsed.data.items.length);
  if (!limit.ok) {
    const res = jsonError(429, "rate_limited", `요청이 너무 많습니다. ${limit.retryAfterSec}초 뒤 다시 시도합니다.`);
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  try {
    return NextResponse.json({ results: await songInsights(parsed.data.items) });
  } catch (error) {
    if (error instanceof DailyLimitError) return jsonError(429, "rate_limited", error.message);
    if (error instanceof InsightRefusedError) return jsonError(502, "upstream", error.message);
    if (error instanceof Anthropic.AuthenticationError) return jsonError(503, "not_configured", "서버의 ANTHROPIC_API_KEY가 올바르지 않아요.");
    if (error instanceof Anthropic.RateLimitError) {
      const res = jsonError(429, "rate_limited", "Claude 요청 한도에 걸렸어요. 잠시 뒤 다시 시도합니다.");
      res.headers.set("Retry-After", "30");
      return res;
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[song-insights]", error.status, error.message);
      return jsonError(502, "upstream", "난이도를 추정하지 못했어요.");
    }
    console.error("[song-insights]", error);
    return jsonError(500, "internal", "서버에서 문제가 생겼습니다.");
  }
}
