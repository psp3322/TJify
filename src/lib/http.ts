import { t } from "@/lib/i18n";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export interface FetchRetryOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 연결 자체가 안 된 오류인지. Node는 "fetch failed", 브라우저는 "Failed to fetch"(Chrome)·
 * "NetworkError …"(Firefox)·"Load failed"(Safari)로 알려 준다. 브라우저는 CORS 거절도 같은 오류로 보여 준다.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error) || error instanceof UpstreamError) return false;
  return /fetch failed|failed to fetch|load failed|networkerror|econn|enotfound|etimedout|socket/i.test(error.message);
}

/** 사용자에게 보여 줄 오류 문구. 브라우저가 내는 영어 네트워크 오류를 그대로 내보내지 않는다. target은 이미 번역한 이름 */
export function describeError(error: unknown, target: string = t("target.music")): string {
  if (error instanceof UpstreamError) return error.message;
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return t("error.timeout", { target });
    if (isNetworkError(error)) return t("error.connect", { target });
    return error.message;
  }
  return String(error);
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError" || isNetworkError(error);
}

/** 429·5xx·일시적 네트워크 오류일 때만 지수 백오프로 다시 시도하는 fetch */
export async function fetchWithRetry(url: string, options: FetchRetryOptions = {}): Promise<Response> {
  const { timeoutMs = 10_000, retries = 2, fetchImpl = fetch, ...init } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
      if (attempt < retries && isTransient(error)) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw error;
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = new UpstreamError(`HTTP ${res.status}`, res.status);
      if (attempt < retries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
    return res;
  }
  throw lastError ?? new Error("fetch failed");
}
