import { describe, expect, it, vi } from "vitest";
import { emptyAppData } from "@/lib/store/storage";
import { pushBusinessData } from "./business-sync";

const fixture = vi.hoisted(() => ({ stockReads: 0, stockDeletes: 0 }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  rpc: async () => ({ data: 1, error: null }),
  from: (table: string) => {
    const result = { data: [], error: null, count: table === "org_members" ? 1 : 0 };
    const builder = {
      select: () => { if (table === "stock_logs") fixture.stockReads += 1; return builder; },
      eq: () => builder,
      in: () => builder,
      delete: () => { if (table === "stock_logs") fixture.stockDeletes += 1; return builder; },
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
  });
});
