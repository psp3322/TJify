import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./cache";
import { createCircuit } from "./circuit";
import { describeError, fetchWithRetry, UpstreamError } from "./http";
import { createLimiter } from "./limiter";
import { createRateLimiter } from "./rate-limit";

describe("TtlCache", () => {
  it("동시에 같은 키를 요청하면 한 번만 불러온다", async () => {
    const cache = new TtlCache<number>();
    const load = vi.fn(async () => 42);
    const [a, b] = await Promise.all([cache.getOrLoad("k", load, () => 1000), cache.getOrLoad("k", load, () => 1000)]);
    expect([a, b]).toEqual([42, 42]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("실패는 캐시하지 않는다", async () => {
    const cache = new TtlCache<number>();
    await expect(cache.getOrLoad("k", async () => Promise.reject(new Error("x")), () => 1000)).rejects.toThrow("x");
    await expect(cache.getOrLoad("k", async () => 7, () => 1000)).resolves.toBe(7);
  });

  it("최대 개수를 넘으면 가장 오래 안 쓴 항목을 버린다", () => {
    const cache = new TtlCache<number>(2);
    cache.set("a", 1, 1000);
    cache.set("b", 2, 1000);
    cache.get("a");
    cache.set("c", 3, 1000);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
  });
});

describe("createLimiter", () => {
  it("동시 실행 수를 넘지 않는다", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      });
    await Promise.all(Array.from({ length: 6 }, task));
    expect(peak).toBe(2);
  });
});

describe("createCircuit", () => {
  it("연속 실패하면 잠시 바로 실패를 돌려준다", async () => {
    const run = createCircuit("테스트", 2, 60_000);
    const failing = vi.fn(async () => {
      throw new UpstreamError("down", 503);
    });
    await expect(run(failing)).rejects.toThrow("down");
    await expect(run(failing)).rejects.toThrow("down");
    await expect(run(failing)).rejects.toThrow("쉬는 중");
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("404 같은 요청 오류는 장애로 세지 않는다", async () => {
    const run = createCircuit("테스트", 1, 60_000);
    await expect(run(async () => Promise.reject(new UpstreamError("nf", 404)))).rejects.toThrow("nf");
    await expect(run(async () => "ok")).resolves.toBe("ok");
  });
});

describe("fetchWithRetry", () => {
  it("5xx면 다시 시도한다", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await fetchWithRetry("https://example.test", { fetchImpl, retries: 1 });
    expect(await res.text()).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("4xx는 그대로 돌려준다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const res = await fetchWithRetry("https://example.test", { fetchImpl, retries: 2 });
    expect(res.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("describeError", () => {
  it("네트워크 오류를 한국어 문구로 바꾼다", () => {
    expect(describeError(new TypeError("fetch failed"), "노래방 검색")).toBe("노래방 검색에 연결하지 못했어요.");
    expect(describeError(Object.assign(new Error("t"), { name: "TimeoutError" }), "Spotify 서버")).toBe("Spotify 서버 응답이 너무 늦어요.");
  });
});

describe("createRateLimiter", () => {
  it("창 안에서 한도를 넘으면 막는다", () => {
    const take = createRateLimiter(3, 60_000);
    expect(take("ip", 2).ok).toBe(true);
    expect(take("ip", 2).ok).toBe(false);
    expect(take("other", 3).ok).toBe(true);
  });
});
