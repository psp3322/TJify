import { describe, expect, it } from "vitest";
import { expandArtists, singerQueries } from "./artists";
import {
  artistPieces,
  bestSimilarity,
  bracketContents,
  compact,
  similarity,
  splitScripts,
  stripBrackets,
  stripDecorations,
  titleVariants,
} from "./normalize";

describe("compact", () => {
  it("공백·문장부호를 지우고 소문자로 맞춘다", () => {
    expect(compact("좋은 날")).toBe("좋은날");
    expect(compact("Love Wins All!")).toBe("lovewinsall");
    expect(compact("Ｆｕｌｌ　Ｗｉｄｔｈ")).toBe("fullwidth");
  });
});

describe("괄호 처리", () => {
  it("괄호 구간을 지우거나 안쪽만 꺼낸다", () => {
    expect(stripBrackets("역겹겠지만(Remember me)")).toBe("역겹겠지만");
    expect(bracketContents("Good Day(좋은 날)")).toEqual(["좋은 날"]);
    expect(bracketContents("迷宮バタフライ(しゅごキャラ! OST)")).toEqual(["しゅごキャラ! OST"]);
  });

  it("버전 표시만 지우고 다른 제목은 남긴다", () => {
    expect(stripDecorations("Song (feat. Someone)")).toBe("Song");
    expect(stripDecorations("Hey Jude - Remastered 2015")).toBe("Hey Jude");
    expect(stripDecorations("거리에서 (Live)")).toBe("거리에서");
    expect(stripDecorations("역겹겠지만(Remember me)")).toBe("역겹겠지만(Remember me)");
    expect(stripDecorations("Let It Go - From \"Frozen\"")).toBe("Let It Go");
  });
});

describe("titleVariants", () => {
  it("버전 표시 제거, 원문, 괄호 제거, 괄호 안 제목 순으로 낸다", () => {
    expect(titleVariants("Good Day(좋은 날)")).toEqual(["Good Day(좋은 날)", "Good Day", "좋은 날"]);
    expect(titleVariants("에잇(Prod.&Feat. SUGA of BTS)")).toEqual(["에잇", "에잇(Prod.&Feat. SUGA of BTS)"]);
  });
});

describe("similarity", () => {
  it("같으면 1, 포함 관계면 0.8 이상", () => {
    expect(similarity("좋은날", "좋은날")).toBe(1);
    expect(similarity("밤편지", "밤편지throughthenight")).toBeGreaterThan(0.8);
  });

  it("라틴 1~2글자는 포함 관계로 보지 않는다", () => {
    expect(similarity("v", "beverly")).toBe(0);
    expect(similarity("iu", "iuliia")).toBeLessThan(0.8);
  });

  it("공백 차이는 변형 비교에서 사라진다", () => {
    expect(bestSimilarity(titleVariants("좋은 날"), titleVariants("좋은날"))).toBe(1);
  });
});

describe("가수 이름", () => {
  it("괄호·구분자·문자 종류로 조각을 낸다", () => {
    expect(artistPieces("아이유(IU)")).toEqual(expect.arrayContaining(["아이유", "IU"]));
    expect(artistPieces("B.I,MILLENNIUM")).toEqual(expect.arrayContaining(["B.I", "MILLENNIUM"]));
    expect(splitScripts("aespa 에스파")).toEqual(["aespa", "에스파"]);
  });

  it("별칭표로 영문·한글 표기를 잇는다", () => {
    expect(expandArtists(["IU"])).toEqual(expect.arrayContaining(["IU", "아이유"]));
    expect(bestSimilarity(expandArtists(["BTS"]), expandArtists(["방탄소년단"]))).toBe(1);
  });

  it("가수명 검색어는 한글 표기를 먼저, 한 글자 별칭은 뺀다", () => {
    expect(singerQueries(["IU"])[0]).toBe("아이유");
    expect(singerQueries(["BTS (방탄소년단)"])[0]).toBe("방탄소년단");
    expect(singerQueries(["Rain"])).not.toContain("비");
    expect(singerQueries(["Taylor Swift"])).toEqual(["Taylor Swift"]);
    expect(singerQueries([])).toEqual([]);
  });
});
