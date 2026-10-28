import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendStockLogRows } from "./stock-log-sync";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), select: vi.fn(), eq: vi.fn(), in: vi.fn(), connected: true }));
vi.mock("./client", () => ({ createBrowserClient: () => mocks.connected ? { from: () => ({ upsert: mocks.upsert, select: mocks.select }) } : null }));
const movement = (id = "movement-1") => ({ id, organization_id: "shop-a", product_id: "rice", product_name: "Rice", log_type: "in", qty: 10, note: "Received", log_date: "2026-10-28T01:00:00.000Z", related_job_id: null, related_supplier_id: null });

describe("append-only stock movement sync", () => {
  beforeEach(() => {
    mocks.connected = true;
    mocks.upsert.mockReset().mockResolvedValue({ error: null });
    mocks.select.mockReset().mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReset().mockReturnValue({ in: mocks.in });
    mocks.in.mockReset().mockResolvedValue({ data: [movement()], error: null });
  });

  it("retries by stable id without updating the original movement", async () => {
    expect(await appendStockLogRows([movement()])).toBeNull();
    expect(mocks.upsert).toHaveBeenCalledWith([movement()], { onConflict: "id", ignoreDuplicates: true });
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", "shop-a");
    expect(mocks.in).toHaveBeenCalledWith("id", ["movement-1"]);
    expect(await appendStockLogRows([movement()])).toBeNull();
  });

  it("refuses an altered local copy of recorded history", async () => {
    expect(await appendStockLogRows([{ ...movement(), qty: 99 }])).toMatch(/cannot be changed/);
    expect(await appendStockLogRows([{ ...movement(), note: "Rewritten" }])).toMatch(/cannot be changed/);
  });

  it("does not mistake a hidden foreign-shop id collision for success", async () => {
    mocks.in.mockResolvedValue({ data: [], error: null });
    expect(await appendStockLogRows([movement()])).toMatch(/could not be confirmed for this shop/);
  });

  it("accepts equivalent database decimal/timestamp encodings", async () => {
    mocks.in.mockResolvedValue({ data: [{ ...movement(), qty: "10.000", log_date: "2026-10-28T06:30:00+05:30" }], error: null });
    expect(await appendStockLogRows([movement()])).toBeNull();
  });

  it("returns write/read failures and supports a safe retry", async () => {
    mocks.upsert.mockResolvedValueOnce({ error: { message: "connection interrupted" } });
    expect(await appendStockLogRows([movement()])).toBe("connection interrupted");
    mocks.in.mockResolvedValueOnce({ data: null, error: { message: "read interrupted" } });
    expect(await appendStockLogRows([movement()])).toBe("read interrupted");
    expect(await appendStockLogRows([movement()])).toBeNull();
  });

  it("rejects mixed shops before sending any data", async () => {
    expect(await appendStockLogRows([movement(), { ...movement("other"), organization_id: "shop-b" }])).toMatch(/one shop/);
    expect(await appendStockLogRows([{ ...movement(), id: "" }])).toMatch(/stable identifiers/);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(await appendStockLogRows([])).toBeNull();
    mocks.connected = false;
    expect(await appendStockLogRows([movement()])).toBe("Supabase not configured");
  });

  it("bounds writes and URL-based confirmation reads for large snapshots", async () => {
    const rows = Array.from({ length: 451 }, (_, index) => movement(`movement-${index}`));
    mocks.in.mockImplementation(async (_column, ids: string[]) => ({ data: rows.filter((row) => ids.includes(row.id)), error: null }));
    expect(await appendStockLogRows(rows)).toBeNull();
    expect(mocks.upsert.mock.calls.map(([batch]) => batch.length)).toEqual([200, 200, 51]);
    expect(mocks.in.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 100, 100, 100, 51]);
  });
});
