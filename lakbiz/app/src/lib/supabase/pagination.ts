export type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGES = 10_000;

/**
 * Fetch a complete PostgREST collection without assuming the server's max-row
 * setting. The next range begins after the number of rows actually returned,
 * which prevents gaps when the server cap is smaller than our requested page.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PageResult<T>> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer");
  }

  const data: T[] = [];
  let from = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };

    const rows = result.data ?? [];
    if (rows.length === 0) return { data, error: null };

    data.push(...rows);
    from += rows.length;
  }

  return {
    data: null,
    error: { message: "Pagination safety limit exceeded" },
  };
}
