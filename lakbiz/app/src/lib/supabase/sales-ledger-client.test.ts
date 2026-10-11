import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ queries: [] as Record<string, ReturnType<typeof vi.fn>>[], responses: [] as unknown[], rpc: vi.fn(), available: true }));
vi.mock("./client", () => ({ createBrowserClient: () => mock.available ? {
  from: (table: string) => {
    const response = mock.responses.shift();
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "order"]) query[method] = vi.fn(() => query);
    for (const method of ["limit", "maybeSingle"]) query[method] = vi.fn(() => Promise.resolve(response));
    query.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve));
    query.table = vi.fn(() => table);
    mock.queries.push(query);
    return query;
  }, rpc: mock.rpc,
} : null }));
import { fetchSalesLedger, setSalesLedgerEnabled } from "./sales-ledger-client";
import { LedgerUnavailable } from "./general-ledger-client";
describe("owner sales ledger bridge client", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.queries = []; mock.available = true;
    // Events query is constructed first; requests then await settings, events and count.
    mock.responses = [{ data: [], error: null }, { data: null, error: null }, { count: 72, error: null }];
    mock.rpc.mockResolvedValue({ error: null });
  });
  it("defaults off and uses a tenant-filtered exact review count, independent of the 50-row limit", async () => {
    expect(await fetchSalesLedger("org-a")).toEqual({ enabled: false, events: [], reviewCount: 72 });
    for (const query of mock.queries) expect(query.eq).toHaveBeenCalledWith("organization_id", "org-a");
    expect(mock.queries[0].limit).toHaveBeenCalledWith(50);
    expect(mock.queries[0].order.mock.calls).toEqual([["created_at", { ascending: false }], ["id", { ascending: false }]]);
    expect(mock.queries[2].select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(mock.queries[2].eq).toHaveBeenCalledWith("status", "needs_review");
  });
  it("can load older review entries without excluding them behind newer posted sales", async () => {
    await fetchSalesLedger("org-a", true);
    expect(mock.queries[0].eq).toHaveBeenCalledWith("status", "needs_review");
  });
  it("reports an unapplied migration instead of silently showing disabled", async () => {
    mock.responses[1] = { error: { code: "42P01", message: "missing relation" } };
    await expect(fetchSalesLedger("org-a")).rejects.toBeInstanceOf(LedgerUnavailable);
  });
  it("does not turn permission errors into an empty queue", async () => {
    mock.responses[0] = { error: { code: "42501", message: "Permission denied" } };
    await expect(fetchSalesLedger("org-a")).rejects.toThrow("Permission denied");
  });
  it("does not claim zero reviews when the count is unavailable", async () => {
    mock.responses[2] = { count: null, error: null };
    await expect(fetchSalesLedger("org-a")).rejects.toThrow("number of sales");
  });
  it("requires acknowledgement before enabling and submits only the scoped RPC payload", async () => {
    await expect(setSalesLedgerEnabled("org-a", true)).rejects.toThrow("Acknowledge");
    expect(mock.rpc).not.toHaveBeenCalled();
    await setSalesLedgerEnabled("org-a", true, true);
    expect(mock.rpc).toHaveBeenCalledWith("set_sales_ledger_enabled", { p_organization_id: "org-a", p_enabled: true, p_acknowledgement: "NEW_SALES_REVENUE_ONLY" });
  });
  it("disables without requesting history changes or posting a journal", async () => {
    await setSalesLedgerEnabled("org-a", false);
    expect(mock.rpc).toHaveBeenCalledWith("set_sales_ledger_enabled", { p_organization_id: "org-a", p_enabled: false, p_acknowledgement: "" });
  });
  it("requires a connected client", async () => {
    mock.available = false;
    await expect(fetchSalesLedger("org-a")).rejects.toBeInstanceOf(LedgerUnavailable);
  });
});
