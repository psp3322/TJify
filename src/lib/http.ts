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

/** 사용자에게 보여 줄 오류 문구. 네트워크 오류의 영어 메시지를 그대로 내보내지 않는다 */
export function describeError(error: unknown, target = "서버"): string {
  if (error instanceof UpstreamError) return error.message;
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return `${target} 응답이 너무 늦어요.`;
    if (/fetch failed|econn|enotfound|socket|network/i.test(error.message)) return `${target}에 연결하지 못했어요.`;
    return error.message;
  }
  return String(error);
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("socket")
  );
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
