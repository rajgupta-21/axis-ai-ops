/**
 * Maps over items with a bounded number of in-flight operations, preserving
 * input order in the result.
 *
 * Plain `Promise.all(items.map(...))` starts every operation at once. That is
 * fine for a handful of items but falls over on a real server's package list
 * (hundreds of entries): it exhausts the database connection pool and floods
 * any outbound HTTP dependency. Use this whenever the collection size is driven
 * by external data rather than a fixed constant.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));
  return results;
}
