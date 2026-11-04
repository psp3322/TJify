import * as z from "zod/v4";
import { t } from "@/lib/i18n";
import { DIFFICULTY_TAGS, type DifficultyTag, type SongInsight } from "./types";

/*
 * Claude·Gemini가 같이 쓰는 지시문과 응답 형식.
 * 노래방 난이도나 "다들 아는 노래인지"를 알려 주는 공개 데이터가 없어서 AI의 지식으로 추정한다.
 * 모르는 곡은 지어내지 말고 known=false로 답하게 한다.
 */

export const MAX_INSIGHT_BATCH = 20;

/** unknown: 모르는 곡일 때 difficulty·popularity에 넣을 값 (Claude는 null, Gemini는 null 대신 0) */
export function systemPrompt(unknown: "null" | "0"): string {
  return `당신은 한국 노래방 문화와 가요·K-pop·팝·J-pop을 잘 아는 보컬 트레이너입니다.
곡 목록을 받으면 각 곡을 "노래를 특별히 배우지 않은 사람이 노래방에서 부를 때" 기준으로 평가합니다.

- difficulty (1~5): 1 누구나 편하게 부름, 2 쉬운 편, 3 보통, 4 어려움(고음·랩·박자 중 하나가 까다로움), 5 아주 어려움(전문 보컬급 고음이나 고난도 랩).
- popularity (1~5): 한국 사람들이 이 곡을 얼마나 알고 따라 부를 수 있는지. 1 아는 사람만 앎, 2 팬층은 있음, 3 꽤 알려짐, 4 대부분 앎, 5 모두 따라 부르는 국민곡·떼창곡.
- tags: 난이도의 이유나 부를 때의 특징을 주어진 목록에서 최대 3개.
- tip: 이 곡을 부를 때 도움이 되는 한국어 한 줄(40자 이내). 떠오르지 않으면 빈 문자열.
- tip_en: tip과 같은 내용의 자연스러운 영어 한 줄(80자 이내). tip이 비었으면 빈 문자열.

곡을 확실히 모르면 known=false, difficulty와 popularity는 ${unknown}, tags는 빈 배열, tip과 tip_en은 빈 문자열로 답하세요. 비슷한 제목의 다른 곡과 헷갈리면 모르는 곡으로 처리하세요.
제목과 가수 이름은 영어·한국어가 섞여 있거나 괄호 안에 다른 표기가 있을 수 있습니다.
입력의 i 값을 그대로 돌려주고, 입력한 모든 곡에 대해 한 줄씩 답하세요.`;
}

/** Claude 구조화 출력 형식 */
export const OutputSchema = z.object({
  songs: z.array(
    z.object({
      i: z.number().int(),
      known: z.boolean(),
      difficulty: z.number().int().nullable(),
      tags: z.array(z.enum(DIFFICULTY_TAGS)),
      popularity: z.number().int().nullable(),
      tip: z.string(),
      tip_en: z.string(),
    }),
  ),
});

export type Output = z.infer<typeof OutputSchema>;

/** Gemini responseJsonSchema. 지원 범위가 좁아서 null 대신 0을 쓰고 기본 키워드만 쓴다 */
export const GEMINI_SCHEMA = {
  type: "object",
  properties: {
    songs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          known: { type: "boolean" },
          difficulty: { type: "integer" },
          tags: { type: "array", items: { type: "string", enum: [...DIFFICULTY_TAGS] } },
          popularity: { type: "integer" },
          tip: { type: "string" },
          tip_en: { type: "string" },
        },
        required: ["i", "known", "difficulty", "tags", "popularity", "tip", "tip_en"],
      },
    },
  },
  required: ["songs"],
} as const;

const GeminiOutputSchema = z.object({
  songs: z.array(
    z.object({
      i: z.number(),
      known: z.boolean(),
      difficulty: z.number().nullable().optional(),
      tags: z.array(z.string()).optional(),
      popularity: z.number().nullable().optional(),
      tip: z.string().optional(),
      tip_en: z.string().optional(),
    }),
  ),
});

const TAG_SET = new Set<string>(DIFFICULTY_TAGS);
const orNull = (n: number | null | undefined) => (typeof n === "number" && n >= 1 ? n : null);

/** Gemini 응답(JSON 문자열)을 Claude와 같은 모양으로 바꾼다. 형식이 틀리면 오류 */
export function parseGeminiOutput(text: string): Output {
  let parsed: z.infer<typeof GeminiOutputSchema>;
  try {
    parsed = GeminiOutputSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(t("error.insightParse"));
  }
  return {
    songs: parsed.songs.map((s) => ({
      i: Math.round(s.i),
      known: s.known,
      difficulty: orNull(s.difficulty),
      tags: (s.tags ?? []).filter((tag): tag is DifficultyTag => TAG_SET.has(tag)),
      popularity: orNull(s.popularity),
      tip: s.tip ?? "",
      tip_en: s.tip_en ?? "",
    })),
  };
}

const clamp = (n: number | null): number | null => (n === null ? null : Math.min(5, Math.max(1, Math.round(n))));

/** 모델 출력을 입력 순서대로 정리한다. 빠졌거나 모르는 곡은 null */
export function toInsights(count: number, output: Output): Array<SongInsight | null> {
  const byIndex = new Map(output.songs.map((s) => [s.i, s]));
  return Array.from({ length: count }, (_, i) => {
    const s = byIndex.get(i);
    if (!s || !s.known || (s.difficulty === null && s.popularity === null)) return null;
    const tip = s.tip.trim().slice(0, 60);
    const tipEn = s.tip_en.trim().slice(0, 120);
    return {
      difficulty: clamp(s.difficulty),
      tags: [...new Set(s.tags)].slice(0, 3),
      popularity: clamp(s.popularity),
      ...(tip ? { tip } : {}),
      ...(tipEn ? { tipEn } : {}),
    };
  });
}

export class InsightRefusedError extends Error {
  constructor() {
    super(t("error.insightRefused"));
    this.name = "InsightRefusedError";
  }
}

export interface InsightErrorInfo {
  message: string;
  /** 잠시 뒤 저절로 다시 시도해도 되는 오류면 기다릴 초 */
  retryAfterSec?: number;
}

/** 곡 목록을 AI에 보낼 모양으로 */
export function songList(items: Array<{ title: string; artists: string[] }>) {
  return items.map((item, i) => ({ i, title: item.title, artist: item.artists.join(", ") || "알 수 없음" }));
}
