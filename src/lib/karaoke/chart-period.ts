import { translate, type Lang } from "@/lib/i18n";

/** 인기차트 기간("2026-09" 또는 "recent")을 화면 언어로 */
export function formatChartPeriod(period: string, lang: Lang): string {
  if (period === "recent") return translate(lang, "chart.recent");
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return period;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return translate(lang, "chart.month", { year, month, monthName });
}
