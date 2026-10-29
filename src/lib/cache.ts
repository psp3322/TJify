/** 크기 제한이 있는 TTL 캐시 (가장 오래 안 쓴 항목부터 버림) */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(private readonly maxEntries = 5000) {}

  get(key: string): V | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // 최근 사용으로 옮긴다
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** 캐시에 있으면 돌려주고, 없으면 load를 한 번만 실행해 채운다 (동시 요청은 같은 Promise를 공유) */
  async getOrLoad(key: string, load: () => Promise<V>, ttlFor: (value: V) => number): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        this.set(key, value, ttlFor(value));
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  get size(): number {
    return this.entries.size;
  }
}
