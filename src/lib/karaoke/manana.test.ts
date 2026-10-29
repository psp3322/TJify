import { describe, expect, it, vi } from "vitest";
import { buildMananaUrl, parseMananaRows, searchManana } from "./manana";

// Manana API 문서에 나온 응답 필드 모양대로 만든 테스트용 행이다 (실제 곡 데이터 아님).
const rows = [
  { brand: "kumyoung", no: "100", title: "제목A", singer: "가수A", composer: "", lyricist: "작사A", release: "2020-01-01" },
  { brand: "tj", no: "200", title: "제목A", singer: "가수A", composer: "", lyricist: "", release: "2020-01-01" },
  { brand: "kumyoung", no: 101, title: "제목B", singer: "가수B" },
  { brand: "kumyoung", no: "", title: "번호 없음", singer: "?" },
];

describe("parseMananaRows", () => {
  it("요청한 브랜드만 남기고 번호 없는 행은 버린다", () => {
    expect(parseMananaRows(rows, "ky")).toEqual([
      { brand: "ky", no: "100", title: "제목A", singer: "가수A", lyricist: "작사A" },
      { brand: "ky", no: "101", title: "제목B", singer: "가수B" },
    ]);
    expect(parseMananaRows(rows, "tj").map((s) => s.no)).toEqual(["200"]);
  });

  it("v2 형식 { data: [...] }도 받는다", () => {
    expect(parseMananaRows({ total: { row: 1 }, data: [rows[0]] }, "ky")).toHaveLength(1);
    expect(parseMananaRows("nope", "ky")).toEqual([]);
  });
});

describe("buildMananaUrl", () => {
  it("검색어를 경로에 인코딩하고 브랜드를 쿼리로 붙인다", () => {
    expect(buildMananaUrl("song", "좋은 날", "ky")).toBe(
      "https://api.manana.kr/karaoke/song/%EC%A2%8B%EC%9D%80%20%EB%82%A0.json?brand=kumyoung",
    );
    expect(buildMananaUrl("singer", "AC/DC", "tj")).toBe("https://api.manana.kr/karaoke/singer/AC%20DC.json?brand=tj");
  });
});

describe("searchManana", () => {
  it("HTML이 오면 오류로 처리한다", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>maintenance</html>", { status: 200 }));
    await expect(searchManana("song", "x", "ky", { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow("HTML");
  });

  it("404는 결과 없음으로 본다", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    await expect(searchManana("song", "x", "ky", { fetchImpl: fetchImpl as unknown as typeof fetch })).resolves.toEqual([]);
  });
});
