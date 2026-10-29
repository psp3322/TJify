import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { DIFFICULTY_TAGS, type InsightRequestItem, type SongInsight } from "./types";

/*
 * 곡 난이도·대중성 추정 (Claude API).
 * 노래방 난이도나 "다들 아는 노래인지"를 알려 주는 공개 데이터가 없어서 Claude의 지식으로 추정한다.
 * 모르는 곡은 지어내지 말고 known=false로 답하게 한다.
 */

export const DEFAULT_MODEL = "claude-opus-5-5";
/** 서버 측 거절 폴백("default")을 받는 모델. Haiku 5.5에는 폴백이 없어서 붙이지 않는다 */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

export const MAX_INSIGHT_BATCH = 20;

const SYSTEM_PROMPT = `당신은 한국 노래방 문화와 가요·K-pop·팝·J-pop을 잘 아는 보컬 트레이너입니다.
곡 목록을 받으면 각 곡을 "노래를 특별히 배우지 않은 사람이 노래방에서 부를 때" 기준으로 평가합니다.

- difficulty (1~5): 1 누구나 편하게 부름, 2 쉬운 편, 3 보통, 4 어려움(고음·랩·박자 중 하나가 까다로움), 5 아주 어려움(전문 보컬급 고음이나 고난도 랩).
- popularity (1~5): 한국 사람들이 이 곡을 얼마나 알고 따라 부를 수 있는지. 1 아는 사람만 앎, 2 팬층은 있음, 3 꽤 알려짐, 4 대부분 앎, 5 모두 따라 부르는 국민곡·떼창곡.
- tags: 난이도의 이유나 부를 때의 특징을 주어진 목록에서 최대 3개.
- tip: 이 곡을 부를 때 도움이 되는 한국어 한 줄(40자 이내). 떠오르지 않으면 빈 문자열.

곡을 확실히 모르면 known=false, difficulty와 popularity는 null, tags는 빈 배열, tip은 빈 문자열로 답하세요. 비슷한 제목의 다른 곡과 헷갈리면 모르는 곡으로 처리하세요.
제목과 가수 이름은 영어·한국어가 섞여 있거나 괄호 안에 다른 표기가 있을 수 있습니다.
입력의 i 값을 그대로 돌려주고, 입력한 모든 곡에 대해 한 줄씩 답하세요.`;

const OutputSchema = z.object({
  songs: z.array(
    z.object({
      i: z.number().int(),
      known: z.boolean(),
      difficulty: z.number().int().nullable(),
      tags: z.array(z.enum(DIFFICULTY_TAGS)),
      popularity: z.number().int().nullable(),
      tip: z.string(),
    }),
  ),
});

type Output = z.infer<typeof OutputSchema>;

/** messages.parse만 쓰므로 테스트에서 이 모양의 가짜 클라이언트를 넣을 수 있다 */
export interface InsightClient {
  beta: { messages: { parse: Anthropic["beta"]["messages"]["parse"] } };
}

export class InsightRefusedError extends Error {
  constructor() {
    super("Claude가 이 요청에 답하지 않았습니다.");
    this.name = "InsightRefusedError";
  }
}

export function insightModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

function insightEffort(): Effort {
  const value = process.env.ANTHROPIC_EFFORT?.trim() as Effort | undefined;
  // 곡 목록 분류라 생각을 길게 할 일이 없다
  return value && EFFORTS.includes(value) ? value : "low";
}

export function isInsightConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());
}

const clamp = (n: number | null): number | null => (n === null ? null : Math.min(5, Math.max(1, Math.round(n))));

/** 모델 출력을 입력 순서대로 정리한다. 빠졌거나 모르는 곡은 null */
export function toInsights(count: number, output: Output): Array<SongInsight | null> {
  const byIndex = new Map(output.songs.map((s) => [s.i, s]));
  return Array.from({ length: count }, (_, i) => {
    const s = byIndex.get(i);
    if (!s || !s.known || (s.difficulty === null && s.popularity === null)) return null;
    const tip = s.tip.trim().slice(0, 60);
    return {
      difficulty: clamp(s.difficulty),
      tags: [...new Set(s.tags)].slice(0, 3),
      popularity: clamp(s.popularity),
      ...(tip ? { tip } : {}),
    };
  });
}

let defaultClient: Anthropic | undefined;

export async function estimateSongs(items: InsightRequestItem[], client: InsightClient = (defaultClient ??= new Anthropic())): Promise<Array<SongInsight | null>> {
  if (items.length === 0) return [];
  const model = insightModel();
  const list = items.map((item, i) => ({ i, title: item.title, artist: item.artists.join(", ") || "알 수 없음" }));

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: { effort: insightEffort(), format: betaZodOutputFormat(OutputSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(list) }],
  });

  if (response.stop_reason === "refusal") throw new InsightRefusedError();
  if (!response.parsed_output) throw new Error("Claude 응답을 읽지 못했습니다.");
  return toInsights(items.length, response.parsed_output);
}
