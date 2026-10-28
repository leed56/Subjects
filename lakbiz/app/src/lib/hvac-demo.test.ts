import { describe, expect, it } from "vitest";
import { createHvacDemoData, HVAC_DEMO_ID, isHvacDemo } from "./hvac-demo";

describe("HVAC demo isolation and records", () => {
  it("only enables the demo adapter for its anonymous demo workspace", () => {
    expect(isHvacDemo({ id: HVAC_DEMO_ID, sector: "ac_hvac", isAuthenticated: false })).toBe(true);
    expect(isHvacDemo({ id: HVAC_DEMO_ID, sector: "ac_hvac", isAuthenticated: true })).toBe(false);
    expect(isHvacDemo({ id: "real-shop", sector: "ac_hvac", isAuthenticated: false })).toBe(false);
    expect(isHvacDemo({ id: HVAC_DEMO_ID, sector: "grocery", isAuthenticated: false })).toBe(false);
  });

  it("builds internally linked, priced sample records with balanced stock history", () => {
    const data = createHvacDemoData(new Date("2026-10-27T06:00:00Z"));
    expect(data.acJobs.length).toBeGreaterThan(5);
    expect(data.sales.length).toBeGreaterThan(10);
    for (const product of data.products) {
      expect(product.sellPrice).toBeGreaterThan(0);
      const moves = data.stockLogs.filter((move) => move.productId === product.id);
      expect(moves.reduce((sum, move) => sum + (move.type === "in" ? move.qty : -move.qty), 0)).toBe(product.stockQty);
    }
    for (const job of data.acJobs) {
      expect(data.customers.some((customer) => customer.id === job.customerId)).toBe(true);
      expect(data.technicians.some((tech) => tech.id === job.assigneeId)).toBe(true);
    }
    expect(data.sales.some((sale) => sale.date.startsWith("2026-10-27"))).toBe(true);
  });
});
