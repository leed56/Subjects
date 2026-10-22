import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "gte", "lte", "order"])
    query[method] = vi.fn(() => query);
  query.range = vi.fn();
  return { query, from: vi.fn(() => query) };
});
vi.mock("./client", () => ({
  createBrowserClient: () => ({ from: mock.from }),
}));
import { fetchLedgerDetail } from "./general-ledger-client";

describe("owner ledger detail query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.query.range.mockResolvedValue({ data: [], error: null });
  });
  it("filters both tenant boundaries, posted parents and inclusive dates before pagination", async () => {
    await fetchLedgerDetail("org-a", { accountId: "cash-a" }, 2, {
      from: "2026-10-01",
      to: "2026-10-11",
    });
    expect(mock.query.eq.mock.calls).toEqual([
      ["organization_id", "org-a"],
      ["journal.organization_id", "org-a"],
      ["journal.status", "posted"],
      ["account_id", "cash-a"],
    ]);
    expect(mock.query.select).toHaveBeenCalledWith(
      expect.stringContaining("journal_batches!inner"),
    );
    expect(mock.query.gte).toHaveBeenCalledWith(
      "journal.journal_date",
      "2026-10-01",
    );
    expect(mock.query.lte).toHaveBeenCalledWith(
      "journal.journal_date",
      "2026-10-11",
    );
    expect(mock.query.range).toHaveBeenCalledWith(100, 149);
  });
  it("supports journal selection without implicit date bounds", async () => {
    await fetchLedgerDetail("org-a", { batchId: "batch-a" }, 0);
    expect(mock.query.eq).toHaveBeenCalledWith("batch_id", "batch-a");
    expect(mock.query.gte).not.toHaveBeenCalled();
    expect(mock.query.lte).not.toHaveBeenCalled();
  });
  it("rejects invalid bounds without requesting data", async () => {
    await expect(
      fetchLedgerDetail("org-a", { batchId: "batch-a" }, 0, {
        from: "2026-10-12",
        to: "2026-10-11",
      }),
    ).rejects.toThrow();
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("does not turn server errors into empty reports", async () => {
    mock.query.range.mockResolvedValue({
      data: null,
      error: { message: "Permission denied", code: "42501" },
    });
    await expect(
      fetchLedgerDetail("org-a", { batchId: "batch-a" }, 0),
    ).rejects.toThrow("Permission denied");
  });
});
