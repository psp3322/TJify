import { describe, expect, it, vi } from "vitest";
import { describeGeminiError, estimateWithGemini, GeminiError } from "./gemini";
import { GEMINI_MODEL } from "./models";
import { InsightRefusedError } from "./prompt";

// 아래 응답은 Gemini generateContent 응답 모양대로 만든 테스트용 데이터다 (실제 Gemini 답변 아님)
const reply = (text: string, finishReason = "STOP") => Response.json({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });

const items = [
  { key: "a", title: "밤편지", artists: ["아이유"] },
  { key: "b", title: "모르는 곡", artists: [] },
];

describe("estimateWithGemini", () => {
  it("키를 헤더에 싣고 JSON 형식을 지정해 부르고, 0은 모름으로 바꾼다", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      reply(
        JSON.stringify({
          songs: [
            { i: 0, known: true, difficulty: 4, tags: ["고음", "없는 꼬리표"], popularity: 5, tip: "숨 고르기", tip_en: "Breathe first" },
            { i: 1, known: false, difficulty: 0, tags: [], popularity: 0, tip: "", tip_en: "" },
          ],
        }),
      ),
    );
    const out = await estimateWithGemini(items, "AIzaTEST", { fetchImpl });
    expect(out).toEqual([{ difficulty: 4, tags: ["고음"], popularity: 5, tip: "숨 고르기", tipEn: "Breathe first" }, null]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`);
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("AIzaTEST");
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.required).toEqual(["songs"]);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual([
      { i: 0, title: "밤편지", artist: "아이유" },
      { i: 1, title: "모르는 곡", artist: "알 수 없음" },
    ]);
  });

  it("생각 과정 부분은 빼고 답만 읽는다", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "생각 중", thought: true }, { text: JSON.stringify({ songs: [{ i: 0, known: true, difficulty: 2, tags: [], popularity: 3 }] }) }] },
          },
        ],
      }),
    );
    await expect(estimateWithGemini(items.slice(0, 1), "k", { fetchImpl })).resolves.toEqual([{ difficulty: 2, tags: [], popularity: 3 }]);
  });

  it("안전 필터로 멈추면 거절로, 형식이 틀리면 읽기 오류로 본다", async () => {
    await expect(estimateWithGemini(items, "k", { fetchImpl: async () => reply("", "SAFETY") })).rejects.toBeInstanceOf(InsightRefusedError);
    await expect(estimateWithGemini(items, "k", { fetchImpl: async () => reply("not json") })).rejects.toThrow("AI 응답");
  });
});

describe("describeGeminiError", () => {
  const fail = (status: number, error: object) => estimateWithGemini(items, "k", { fetchImpl: async () => Response.json({ error }, { status }) });

  it("잘못된 키, 분당 한도, 하루 한도를 구분한다", async () => {
    const invalid = await fail(400, { status: "INVALID_ARGUMENT", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }] }).catch(
      (e: unknown) => e,
    );
    expect(invalid).toBeInstanceOf(GeminiError);
    expect(describeGeminiError(invalid).message).toContain("키가 올바르지 않아요");

    const perMinute = await fail(429, {
      status: "RESOURCE_EXHAUSTED",
      details: [
        { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] },
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "21.5s" },
      ],
    }).catch((e: unknown) => e);
    expect(describeGeminiError(perMinute)).toEqual({ message: expect.any(String), retryAfterSec: 22 });

    const perDay = await fail(429, {
      status: "RESOURCE_EXHAUSTED",
      details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }],
    }).catch((e: unknown) => e);
    expect(describeGeminiError(perDay)).toEqual({ message: expect.stringContaining("무료 사용량") });
  });

  it("웹사이트 제한에 걸린 키를 알려 준다", async () => {
    const blocked = await fail(403, { status: "PERMISSION_DENIED", details: [{ reason: "API_KEY_HTTP_REFERRER_BLOCKED" }] }).catch((e: unknown) => e);
    expect(describeGeminiError(blocked).message).toContain("웹사이트 제한");
  });
});
