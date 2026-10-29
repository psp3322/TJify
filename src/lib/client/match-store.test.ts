import { describe, expect, it } from "vitest";
import type { BrandMatch, KaraokeSong } from "@/lib/types";
import { hasNumber, isFresh, mergeResults, pruneStore, resolveNumber, trackKey, type MatchStore } from "./match-store";

// 저장·표시 규칙 확인용 테스트 데이터 (실제 노래방 번호 아님)
const song: KaraokeSong = { brand: "tj", no: "12345", title: "곡", singer: "가수" };
const found: BrandMatch = { best: song, score: 0.95, confidence: "high", candidates: [song] };
const maybe: BrandMatch = { ...found, confidence: "low" };
const none: BrandMatch = { best: null, score: 0, confidence: "none", candidates: [] };
const failed: BrandMatch = { ...none, error: "노래방 검색에 연결하지 못했어요." };

describe("trackKey", () => {
  it("공백·대소문자·가수 순서가 달라도 같은 키", () => {
    expect(trackKey({ title: "Love Wins All", artists: ["IU", "B"] })).toBe(trackKey({ title: "love wins all", artists: ["b", "iu"] }));
  });
});

describe("mergeResults / isFresh", () => {
  it("결과를 저장하고, 오류였던 브랜드는 다시 찾게 한다", () => {
    const store = mergeResults({}, [{ key: "a", tj: found, ky: failed }]);
    expect(isFresh(store.a, ["tj"])).toBe(true);
    expect(isFresh(store.a, ["tj", "ky"])).toBe(false);
  });

  it("버전이 다른 예전 결과는 버린다", () => {
    const store: MatchStore = { a: { v: 0, at: Date.now(), tj: { best: song, confidence: "high", candidates: [] } } };
    expect(isFresh(store.a, ["tj"])).toBe(false);
  });

  it("오래된 항목부터 지운다", () => {
    const big: MatchStore = {};
    for (let i = 0; i < 6005; i++) big[`k${i}`] = { v: 1, at: i, tj: { best: null, confidence: "none", candidates: [] } };
    const pruned = pruneStore(big);
    expect(Object.keys(pruned)).toHaveLength(6000);
    expect(pruned.k0).toBeUndefined();
    expect(pruned.k6004).toBeDefined();
  });
});

describe("resolveNumber", () => {
  const store = mergeResults({}, [
    { key: "found", tj: found },
    { key: "maybe", tj: maybe },
    { key: "none", tj: none },
    { key: "failed", tj: failed },
  ]);

  it("상태를 구분한다", () => {
    expect(resolveNumber("found", "tj", store, {}).status).toBe("found");
    expect(resolveNumber("maybe", "tj", store, {}).status).toBe("maybe");
    expect(resolveNumber("none", "tj", store, {}).status).toBe("none");
    expect(resolveNumber("failed", "tj", store, {}).status).toBe("error");
    expect(resolveNumber("unknown", "tj", store, {}).status).toBe("pending");
  });

  it("직접 고른 번호가 자동 결과보다 앞선다", () => {
    const manual = { ...song, no: "99999" };
    expect(resolveNumber("none", "tj", store, { none: { tj: manual } })).toMatchObject({ status: "manual", song: manual });
    expect(resolveNumber("found", "tj", store, { found: { tj: null } }).status).toBe("none");
  });

  it("번호가 있는 상태만 hasNumber", () => {
    expect(hasNumber(resolveNumber("found", "tj", store, {}))).toBe(true);
    expect(hasNumber(resolveNumber("maybe", "tj", store, {}))).toBe(true);
    expect(hasNumber(resolveNumber("none", "tj", store, {}))).toBe(false);
  });
});
