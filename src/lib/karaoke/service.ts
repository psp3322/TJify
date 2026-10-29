import type { Brand, BrandMatch, MatchRequestItem, MatchResult } from "@/lib/types";
import { matchOnBrand } from "./matcher";
import { isBrandEnabled, searchers } from "./providers";

const DISABLED: BrandMatch = { best: null, score: 0, confidence: "none", candidates: [], error: "이 노래방 검색이 꺼져 있습니다" };

/** 곡 여러 개를 요청한 브랜드들에서 동시에 찾는다. 실제 동시 요청 수는 providers의 제한을 따른다 */
export async function matchTracks(items: MatchRequestItem[], brands: Brand[]): Promise<MatchResult[]> {
  return Promise.all(
    items.map(async (item) => {
      const result: MatchResult = { key: item.key };
      await Promise.all(
        brands.map(async (brand) => {
          result[brand] = isBrandEnabled(brand) ? await matchOnBrand(item, searchers[brand]) : DISABLED;
        }),
      );
      return result;
    }),
  );
}
