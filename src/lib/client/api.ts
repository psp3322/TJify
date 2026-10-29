export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  const retry = Number(res.headers.get("retry-after"));
  throw new ApiClientError(
    res.status,
    body?.error ?? "unknown",
    body?.message ?? `요청 실패 (HTTP ${res.status})`,
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}

export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  return handle<T>(await fetch(url, { signal, cache: "no-store" }));
}

export async function apiPost<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return handle<T>(
    await fetch(url, {
      method: "POST",
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
