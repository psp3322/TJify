import { isNetworkError } from "@/lib/http";
import { t } from "@/lib/i18n";
import { GEMINI_MODEL } from "./models";
import { GEMINI_SCHEMA, InsightRefusedError, parseGeminiOutput, songList, systemPrompt, toInsights, type InsightErrorInfo } from "./prompt";
import type { InsightRequestItem, SongInsight } from "./types";

/*
 * Google Gemini API로 곡 난이도·대중성 추정. Gemini API에는 무료 등급이 있어서 돈을 내지 않고 쓸 수 있다.
 * 사이트에 넣어 둔 무료 키나 방문자가 설정에 넣은 자기 키로 브라우저에서 바로 부른다 (Gemini API는 CORS를 허용한다).
 * REST: POST /v1beta/models/{model}:generateContent, 응답은 responseJsonSchema에 맞춘 JSON 문자열.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";
/** 안전 필터 등으로 답을 끝까지 내지 않은 경우 */
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER"]);

interface GeminiErrorDetail {
  "@type"?: string;
  reason?: string;
  retryDelay?: string;
  violations?: Array<{ quotaId?: string }>;
}

interface GeminiResponse {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string; details?: GeminiErrorDetail[] };
}

export class GeminiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | undefined,
    readonly apiStatus: string | undefined,
    /** RetryInfo의 retryDelay (초) */
    readonly retryAfterSec: number | undefined,
    /** 하루 무료 한도를 다 쓴 경우 */
    readonly daily: boolean,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function toGeminiError(status: number, body: GeminiResponse | null): GeminiError {
  const details = body?.error?.details ?? [];
  const reason = details.find((d) => d.reason)?.reason;
  const delay = details.find((d) => d["@type"]?.endsWith("RetryInfo"))?.retryDelay;
  const retryAfterSec = delay ? Math.ceil(Number.parseFloat(delay)) || undefined : undefined;
  const daily = details.some((d) => d.violations?.some((v) => /per\s*day/i.test(v.quotaId ?? "")));
  return new GeminiError(status, reason, body?.error?.status, retryAfterSec, daily, body?.error?.message ?? `HTTP ${status}`);
}

export interface GeminiOptions {
  model?: string;
  fetchImpl?: typeof fetch;
}

export async function estimateWithGemini(items: InsightRequestItem[], apiKey: string, options: GeminiOptions = {}): Promise<Array<SongInsight | null>> {
  if (items.length === 0) return [];
  const { model = GEMINI_MODEL, fetchImpl = fetch } = options;

  const res = await fetchImpl(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt("0") }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(songList(items)) }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: GEMINI_SCHEMA, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = (await res.json().catch(() => null)) as GeminiResponse | null;
  if (!res.ok) throw toGeminiError(res.status, body);

  const candidate = body?.candidates?.[0];
  if (!candidate || body?.promptFeedback?.blockReason || BLOCKED.has(candidate.finishReason ?? "")) throw new InsightRefusedError();
  // 생각 과정(thought)은 빼고 답만 이어 붙인다
  const text = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  return toInsights(items.length, parseGeminiOutput(text));
}

/** Gemini API 오류를 화면에 보여 줄 문구로 바꾼다 */
export function describeGeminiError(error: unknown): InsightErrorInfo {
  if (error instanceof InsightRefusedError) return { message: error.message };
  if (error instanceof GeminiError) {
    if (error.reason === "API_KEY_INVALID") return { message: t("error.geminiKey") };
    if (error.reason === "API_KEY_HTTP_REFERRER_BLOCKED") return { message: t("error.geminiReferrer") };
    if (error.reason === "SERVICE_DISABLED" || error.reason === "API_KEY_SERVICE_BLOCKED") return { message: t("error.geminiServiceOff") };
    if (error.status === 429) {
      // 분당 한도면 알려 준 시간만큼 쉬었다가 이어서 하고, 하루 한도면 멈춘다
      if (!error.daily && (error.retryAfterSec ?? 30) <= 120) return { message: t("error.geminiRateLimit"), retryAfterSec: error.retryAfterSec ?? 30 };
      return { message: t("error.geminiDailyQuota") };
    }
    if (error.apiStatus === "FAILED_PRECONDITION" || /location/i.test(error.message)) return { message: t("error.geminiLocation") };
    if (error.status === 404) return { message: t("error.geminiModel") };
    return { message: t("error.geminiHttp", { status: error.status }) };
  }
  if (isNetworkError(error) || (error instanceof Error && error.name === "TimeoutError")) return { message: t("error.geminiConnect") };
  return { message: error instanceof Error ? error.message : t("error.insightParse") };
}
