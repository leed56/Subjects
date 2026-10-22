import { describe, expect, it } from "vitest";
import { buildDemoLotRows, ensureTrackedDemoStock } from "./lot-fixtures.mjs";

const orgId = "00000000-0000-4000-8000-000000000001";
const product = { id: "demo:pharmacy:spc:test" };

describe("pharmacy demo lot fixtures", () => {
  it("keeps the first workflow fixtures sufficiently stocked", () => {
    expect(ensureTrackedDemoStock(0, 0)).toBe(12);
    expect(ensureTrackedDemoStock(2, 1)).toBe(12);
    expect(ensureTrackedDemoStock(20, 2)).toBe(20);
    expect(ensureTrackedDemoStock(2, 3)).toBe(2);
  });

  it("creates expired plus valid stock without exceeding aggregate", () => {
    const rows = buildDemoLotRows(orgId, product, 0, 12);
    expect(rows.map((row) => row.status)).toEqual(["expired", "available"]);
    expect(rows.reduce((sum, row) => sum + row.qty_on_hand, 0)).toBe(12);
    expect(rows[0].expiry_date < new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it("creates two available lots in FEFO order", () => {
    const rows = buildDemoLotRows(orgId, product, 1, 12);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "available")).toBe(true);
    expect(rows[0].expiry_date < rows[1].expiry_date).toBe(true);
    expect(rows.reduce((sum, row) => sum + row.qty_on_hand, 0)).toBe(12);
  });

  it("creates quarantine plus saleable stock as separate identities", () => {
    const rows = buildDemoLotRows(orgId, product, 2, 12);
    expect(rows.map((row) => row.status)).toEqual(["quarantine", "available"]);
    expect(rows.reduce((sum, row) => sum + row.qty_on_hand, 0)).toBe(12);
  });
});
