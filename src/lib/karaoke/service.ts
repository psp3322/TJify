import type { Brand, MatchRequestItem, MatchResult } from "@/lib/types";
import { matchOnBrand } from "./matcher";
import { searchers } from "./providers";

/** 곡 여러 개를 요청한 브랜드들에서 동시에 찾는다. 실제 동시 요청 수는 providers의 제한을 따른다 */
export async function matchTracks(items: MatchRequestItem[], brands: Brand[]): Promise<MatchResult[]> {
  return Promise.all(
    items.map(async (item) => {
      const result: MatchResult = { key: item.key };
      await Promise.all(
        brands.map(async (brand) => {
          result[brand] = await matchOnBrand(item, searchers[brand]);
        }),
      );
      return result;
    }),
  );
}
