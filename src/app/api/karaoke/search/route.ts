import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, isSameOrigin, jsonError } from "@/lib/api";
import { isBrandEnabled, searchers } from "@/lib/karaoke/providers";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

const take = createRateLimiter(60, 60_000);

/** 직접 검색 (번호를 고를 때 쓰는 수동 검색): ?q=…&brand=tj|ky&type=title|singer */
export async function GET(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_request", "허용되지 않은 요청입니다.");

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const brand = request.nextUrl.searchParams.get("brand");
  const type = request.nextUrl.searchParams.get("type") ?? "title";
  if (!q || q.length > 100) return jsonError(400, "bad_request", "검색어를 1~100자로 입력하세요.");
  if (brand !== "tj" && brand !== "ky") return jsonError(400, "bad_request", "brand는 tj 또는 ky여야 합니다.");
  if (type !== "title" && type !== "singer") return jsonError(400, "bad_request", "type은 title 또는 singer여야 합니다.");
  if (!isBrandEnabled(brand)) return jsonError(503, "not_configured", "이 노래방 검색이 꺼져 있습니다.");

  const limit = take(clientKey(request.headers));
  if (!limit.ok) return jsonError(429, "rate_limited", `요청이 너무 많습니다. ${limit.retryAfterSec}초 뒤 다시 시도하세요.`);

  try {
    const searcher = searchers[brand];
    const songs = type === "title" ? await searcher.searchByTitle(q) : await searcher.searchBySinger(q);
    return NextResponse.json({ songs: songs.slice(0, 100) });
  } catch (error) {
    return errorResponse(error);
  }
}
