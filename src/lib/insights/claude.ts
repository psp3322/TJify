import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { t } from "@/lib/i18n";
import { DEFAULT_MODEL } from "./models";
import { InsightRefusedError, OutputSchema, songList, systemPrompt, toInsights, type InsightErrorInfo } from "./prompt";
import type { InsightRequestItem, SongInsight } from "./types";

/*
 * Claude로 곡 난이도·대중성 추정 (유료, 방문자가 설정에 넣은 자기 Anthropic API 키).
 * 이 사이트에는 서버가 없으므로 브라우저에서 API를 바로 부른다.
 */

export { DEFAULT_MODEL };
/** 서버 측 거절 폴백("default")을 받는 모델. Haiku 5.5에는 폴백이 없어서 붙이지 않는다 */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

/** messages.parse만 쓰므로 테스트에서 이 모양의 가짜 클라이언트를 넣을 수 있다 */
export interface InsightClient {
  beta: { messages: { parse: Anthropic["beta"]["messages"]["parse"] } };
}

/** 방문자 자신의 키로 브라우저에서 바로 부르는 클라이언트. 키는 그 브라우저에만 저장된다 */
export function createInsightClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function estimateSongs(items: InsightRequestItem[], client: InsightClient, model = DEFAULT_MODEL): Promise<Array<SongInsight | null>> {
  if (items.length === 0) return [];

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    // 곡 목록 분류라 생각을 길게 할 일이 없다
    output_config: { effort: "low", format: betaZodOutputFormat(OutputSchema) },
    system: systemPrompt("null"),
    messages: [{ role: "user", content: JSON.stringify(songList(items)) }],
  });

  if (response.stop_reason === "refusal") throw new InsightRefusedError();
  if (!response.parsed_output) throw new Error(t("error.insightParse"));
  return toInsights(items.length, response.parsed_output);
}

/** Claude API 오류를 화면에 보여 줄 문구로 바꾼다 */
export function describeInsightError(error: unknown): InsightErrorInfo {
  if (error instanceof InsightRefusedError) return { message: error.message };
  if (error instanceof Anthropic.AuthenticationError) return { message: t("error.claudeKey") };
  if (error instanceof Anthropic.PermissionDeniedError) return { message: t("error.claudePermission") };
  if (error instanceof Anthropic.NotFoundError) return { message: t("error.claudeModel") };
  if (error instanceof Anthropic.RateLimitError) {
    const retry = Number(error.headers?.get("retry-after"));
    return { message: t("error.claudeRateLimit"), retryAfterSec: Number.isFinite(retry) && retry > 0 ? retry : 30 };
  }
  if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) return { message: t("error.claudeCredit") };
  if (error instanceof Anthropic.APIConnectionError) return { message: t("error.claudeConnect") };
  if (error instanceof Anthropic.APIError) return { message: t("error.claudeHttp", { status: error.status ?? "?" }) };
  return { message: error instanceof Error ? error.message : t("error.insightParse") };
}
