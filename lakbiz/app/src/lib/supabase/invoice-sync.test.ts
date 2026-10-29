import { beforeEach, describe, expect, it, vi } from "vitest";
import { completedInvoiceCommitReady, invoiceSetupPending, pendingLegacyInvoiceIds, recordCompletedInvoice } from "./invoice-sync";

const mocks = vi.hoisted(() => ({ in: vi.fn(), single: vi.fn(), rpc: vi.fn(), eq: vi.fn(), connected: true }));
vi.mock("./client", () => ({ createBrowserClient: () => mocks.connected ? {
  from: () => ({ select: () => ({ eq: mocks.eq }) }), rpc: mocks.rpc,
} : null }));

describe("completed-invoice sync", () => {
  beforeEach(() => {
    mocks.connected = true;
    mocks.in.mockReset().mockResolvedValue({ data: [], error: null });
    mocks.single.mockReset().mockResolvedValue({ data: { sector: "ac_hvac" }, error: null });
    mocks.eq.mockReset().mockReturnValue({ in: mocks.in, single: mocks.single });
    mocks.rpc.mockReset().mockImplementation(async (name: string) => ({ data: name === "completed_invoice_commit_ready" ? true : { ok: true }, error: null }));
  });

  it("never resends a recorded invoice, including an altered local copy", async () => {
    mocks.in.mockResolvedValue({ data: [{ id: "recorded" }], error: null });
    expect((await pendingLegacyInvoiceIds("shop-a", ["recorded"])).ids.size).toBe(0);
    expect(mocks.single).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", "shop-a");
  });

  it("sends only genuinely pending legacy invoices", async () => {
    mocks.in.mockResolvedValue({ data: [{ id: "recorded" }], error: null });
    expect([...(await pendingLegacyInvoiceIds("shop-a", ["recorded", "pending"])).ids]).toEqual(["pending"]);
  });

  it.each(["grocery", "pharmacy", "electronics", "mobile_shop", "footwear", "textile"])("refuses a snapshot checkout backdoor for %s", async (sector) => {
    mocks.single.mockResolvedValue({ data: { sector }, error: null });
    const result = await pendingLegacyInvoiceIds("shop-a", ["pending"]);
    expect(result.error).toMatch(/POS checkout/);
    expect(result.ids.size).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when it cannot read invoice history or the owning shop", async () => {
    mocks.in.mockResolvedValueOnce({ data: null, error: { message: "history unavailable" } });
    expect((await pendingLegacyInvoiceIds("shop-a", ["pending"])).error).toBe("history unavailable");
    mocks.single.mockResolvedValueOnce({ data: null, error: { message: "shop unavailable" } });
    expect((await pendingLegacyInvoiceIds("shop-a", ["pending"])).error).toBe("shop unavailable");
  });

  it("bounds history reads without unnecessarily requiring a legacy write route", async () => {
    const ids = Array.from({ length: 251 }, (_, index) => `sale-${index}`);
    mocks.in.mockImplementation(async (_key, batch: string[]) => ({ data: batch.map((id) => ({ id })), error: null }));
    expect((await pendingLegacyInvoiceIds("shop-a", ids)).ids.size).toBe(0);
    expect(mocks.in.mock.calls.map(([, batch]) => batch.length)).toEqual([100, 100, 51]);
  });

  it("commits header and lines through one RPC and never falls back to mutable writes", async () => {
    const sale = { id: "sale-a", organization_id: "shop-a" };
    const lines = [{ sale_id: "sale-a", qty: 1 }];
    expect(await recordCompletedInvoice("shop-a", sale, lines)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("record_completed_invoice", {
      p_organization_id: "shop-a",
      p_sale: sale,
      p_lines: lines,
      p_context: {},
    });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "connection lost" } });
    expect(await recordCompletedInvoice("shop-a", sale, lines)).toBe("connection lost");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await recordCompletedInvoice("shop-a", sale, lines)).toMatch(/not confirmed/);
  });

  it("checks deployment availability with a read-only GET and fails closed", async () => {
    expect(await completedInvoiceCommitReady("shop-a")).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("completed_invoice_commit_ready", { p_organization_id: "shop-a" }, { get: true });
    mocks.rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await completedInvoiceCommitReady("shop-a")).toBe(false);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "schema cache details" } });
    expect((await pendingLegacyInvoiceIds("shop-a", ["pending"])).error).toBe(invoiceSetupPending);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "schema cache details" } });
    expect(await recordCompletedInvoice("shop-a", { id: "pending" }, [])).toBe(invoiceSetupPending);
    expect(invoiceSetupPending).not.toContain("schema");
  });

  it("retains pending work on thrown network errors and never switches write paths", async () => {
    mocks.in.mockRejectedValueOnce(new Error("private network detail"));
    const result = await pendingLegacyInvoiceIds("shop-a", ["pending"]);
    expect(result.ids.size).toBe(0);
    expect(result.error).toMatch(/interrupted/);
    expect(result.error).not.toContain("private");
    mocks.rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await recordCompletedInvoice("shop-a", { id: "pending" }, [])).toMatch(/pending bill/);
  });
});
