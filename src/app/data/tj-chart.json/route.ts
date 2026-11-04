import { buildChartIndex } from "@/lib/karaoke/tj-chart";

// next build 때 한 번 실행돼 out/data/tj-chart.json 파일이 된다. 차트를 새로 받으려면 사이트를 다시 빌드한다
export const dynamic = "force-static";

export async function GET() {
  return Response.json(await buildChartIndex());
}
