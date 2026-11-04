import { UpstreamError } from "./http";
import { t } from "./i18n";

/**
 * 연속으로 실패하는 외부 사이트에 계속 요청하지 않도록 잠시 차단하는 회로 차단기.
 * threshold번 연달아 실패하면 cooldownMs 동안 바로 실패를 돌려준다.
 */
export function createCircuit(name: string | (() => string), threshold = 6, cooldownMs = 30_000) {
  let failures = 0;
  let openUntil = 0;

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (Date.now() < openUntil) {
      throw new UpstreamError(t("error.circuit", { name: typeof name === "function" ? name() : name }), 503);
    }
    try {
      const result = await task();
      failures = 0;
      return result;
    } catch (error) {
      // 400·404(검색어 문제 등)는 사이트 장애가 아니므로 세지 않는다. 403은 차단일 수 있어 센다
      const status = error instanceof UpstreamError ? error.status : undefined;
      if (status === undefined || status === 403 || status === 429 || status >= 500) {
        failures++;
        if (failures >= threshold) {
          openUntil = Date.now() + cooldownMs;
          failures = 0;
        }
      }
      throw error;
    }
  };
}
