/**
 * A small typed promise pool that runs concurrency-limited tasks.
 * Rejects on the first task error.
 */
export default function promisePool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 4,
): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const results: T[] = new Array(tasks.length);
    let i = 0;
    let active = 0;
    let finished = 0;
    const total = tasks.length;

    function next() {
      if (finished === total) return resolve(results);
      while (active < concurrency && i < total) {
        const idx = i++;
        active++;
        let task: () => Promise<T> = tasks[idx];
        Promise.resolve()
          .then(() => task())
          .then((res) => {
            results[idx] = res;
          })
          .catch((err) => {
            reject(err);
          })
          .finally(() => {
            active--;
            finished++;
            next();
          });
      }
    }

    if (total === 0) return resolve([]);
    next();
  });
}
