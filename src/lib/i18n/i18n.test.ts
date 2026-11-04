import { describe, expect, it } from "vitest";
import { formatChartPeriod } from "@/lib/karaoke/chart-period";
import { getLang, t, translate } from ".";
import { en, ko } from "./messages";

describe("i18n", () => {
  it("빌드·테스트 환경에서는 한국어다", () => {
    expect(getLang()).toBe("ko");
    expect(t("common.songs", { n: 3 })).toBe("3곡");
  });

  it("영어 문구도 같은 자리 표시를 쓴다", () => {
    expect(translate("en", "common.songs", { n: 3 })).toBe("3 songs");
    for (const key of Object.keys(ko) as Array<keyof typeof ko>) {
      const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      // 영어 문장에서 쓰는 이름(monthName)만 다를 수 있다
      expect(names(en[key]).filter((n) => n !== "monthName"), key).toEqual(names(ko[key]).filter((n) => n !== "month"));
    }
  });

  it("인기차트 기간을 언어에 맞게 쓴다", () => {
    expect(formatChartPeriod("2026-09", "ko")).toBe("2026년 9월");
    expect(formatChartPeriod("2026-09", "en")).toBe("Sep 2026");
    expect(formatChartPeriod("recent", "en")).toBe("past month");
  });
});
