export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/** 동시에 실행되는 작업 수를 제한한다. 노래방 사이트에 요청이 몰리지 않게 하려는 용도 */
export function createLimiter(concurrency: number): Limiter {
  const max = Math.max(1, Math.floor(concurrency));
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (active < max && queue.length > 0) {
      const start = queue.shift()!;
      active++;
      start();
    }
  };

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            pump();
          });
      });
      pump();
    });
}
