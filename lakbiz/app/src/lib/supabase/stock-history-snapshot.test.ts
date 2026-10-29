import { describe, expect, it, vi } from "vitest";
import { emptyAppData } from "@/lib/store/storage";
import { pushBusinessData } from "./business-sync";

const fixture = vi.hoisted(() => ({ stockReads: 0, stockDeletes: 0, invoiceDeletes: 0, lineWrites: 0, invoiceRpc: 0 }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  rpc: async (name: string) => { if (name === "record_completed_invoice") fixture.invoiceRpc += 1; return { data: 1, error: null }; },
  from: (table: string) => {
    const result = { data: table === "sales" ? [{ id: "recorded" }] : [], error: null, count: table === "org_members" ? 1 : 0 };
    const builder = {
      select: () => { if (table === "stock_logs") fixture.stockReads += 1; return builder; },
      eq: () => builder,
      in: () => builder,
      delete: () => { if (table === "stock_logs") fixture.stockDeletes += 1; if (table === "sales") fixture.invoiceDeletes += 1; if (table === "sale_lines") fixture.lineWrites += 1; return builder; },
      insert: () => { if (table === "sale_lines") fixture.lineWrites += 1; return builder; },
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  },
}) }));

describe("stale single-owner snapshots", () => {
  it("cannot prune remote stock history missing from the browser cache", async () => {
    const result = await pushBusinessData("shop-a", emptyAppData(), { seenGeneration: 0 });
    expect(result.error).toBeNull();
    expect(fixture.stockReads).toBe(0);
    expect(fixture.stockDeletes).toBe(0);
    expect(fixture.invoiceDeletes).toBe(0);
  });

  it("does not replace or prune a recorded invoice and its lines after unrelated edits", async () => {
    const data = emptyAppData();
    data.sales = [{ id: "recorded", total: 999999, lines: [] }] as unknown as typeof data.sales;
    expect((await pushBusinessData("shop-a", data, { seenGeneration: 0 })).error).toBeNull();
    expect(fixture.invoiceDeletes).toBe(0);
    expect(fixture.lineWrites).toBe(0);
    expect(fixture.invoiceRpc).toBe(0);
  });
});
