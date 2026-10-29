import { connection, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { TtlCache } from "@/lib/cache";
import { buildTjChartIndex, type ChartIndex } from "@/lib/karaoke/tj-chart";

const HOUR = 60 * 60 * 1000;
const cache = new TtlCache<ChartIndex>(2);

/** 최근 1년 TJ 인기차트 TOP100 (곡번호별 최고 순위). 하루에 한두 번만 새로 받는다 */
export async function GET() {
  await connection();
  try {
    const index = await cache.getOrLoad("tj", () => buildTjChartIndex(), () => 12 * HOUR);
    return NextResponse.json(index, {
      headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
