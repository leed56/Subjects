import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import type { AppData } from "@/lib/store/types";
import {
  buildRetailDashboardIntelligence,
  isPharmacyMedicine,
  resolvePeriodRange,
  type RetailLotSnapshot,
} from "./retail-intelligence";

const product = (overrides: Partial<Product> & Pick<Product, "id" | "name">): Product => ({
  id: overrides.id,
  name: overrides.name,
  sku: overrides.sku,
  category: overrides.category ?? "General",
  sectorId: overrides.sectorId ?? "pharmacy",
  condition: overrides.condition ?? "new",
  buyPrice: overrides.buyPrice ?? 50,
  sellPrice: overrides.sellPrice ?? 100,
  stockQty: overrides.stockQty ?? 10,
  reorderLevel: overrides.reorderLevel ?? 5,
  active: overrides.active ?? true,
  notes: overrides.notes,
  customFields: overrides.customFields ?? { unit: "pcs" },
});

function data(products: Product[]): AppData {
  return {
    business: { name: "Demo" },
    products,
    sales: [
      {
        id: "sale-1",
        billNo: "INV-1",
        date: "2026-08-23T08:00:00.000Z",
        lines: [
          { productId: products[0].id, productName: products[0].name, qty: 2, unitPrice: products[0].sellPrice, buyPrice: products[0].buyPrice },
        ],
        total: products[0].sellPrice * 2,
        profit: (products[0].sellPrice - products[0].buyPrice) * 2,
        paymentMethod: "cash",
        creditAmount: 0,
      },
      {
        id: "sale-2",
        billNo: "INV-2",
        date: "2026-08-22T08:00:00.000Z",
        lines: [
          { productId: products[0].id, productName: products[0].name, qty: 1, unitPrice: products[0].sellPrice, buyPrice: products[0].buyPrice },
          { productId: products[1].id, productName: products[1].name, qty: 1, unitPrice: products[1].sellPrice, buyPrice: products[1].buyPrice },
        ],
        total: products[0].sellPrice + products[1].sellPrice,
        profit: 75,
        paymentMethod: "cash",
        creditAmount: 0,
      },
    ],
    stockLogs: [],
    customers: [],
    customerPayments: [],
    customerProductPrices: [],
    suppliers: [],
    purchases: [],
    purchaseOrders: [],
    supplierPayments: [],
    acJobs: [],
    jobItems: [],
    jobStatusHistory: [],
    technicians: [],
    contractors: [],
    contractorPayments: [],
    vehicles: [],
    bankAccounts: [],
    bankTransactions: [],
    bankTransfers: [],
    cheques: [],
  } as AppData;
}

describe("retail dashboard intelligence", () => {
  const products = [
    product({ id: "med", name: "ACARBOSE 50MG", category: "Medicines", customFields: { unit: "box", productKind: "medicine", genericName: "ACARBOSE", strength: "50MG" } }),
    product({ id: "care", name: "Face Wash", category: "Skin Care", buyPrice: 80, sellPrice: 150, stockQty: 3, reorderLevel: 5, customFields: { unit: "bottle", productKind: "retail" } }),
    product({ id: "out", name: "Thermometer", category: "Medical Devices", stockQty: 0, reorderLevel: 2, customFields: { unit: "pcs", productKind: "retail" } }),
  ];

  it("recognizes medicine identity from factual pharmacy fields", () => {
    expect(isPharmacyMedicine(products[0])).toBe(true);
    expect(isPharmacyMedicine(products[1])).toBe(false);
  });

  it("keeps owner-only cost/profit out of non-owner intelligence", () => {
    const result = buildRetailDashboardIntelligence(data(products), "pharmacy", false, [], new Date("2026-08-23T12:00:00Z"));
    expect(result.inventoryCostValue).toBeNull();
    expect(result.periodProfit).toBeNull();
    expect(result.grossMarginPct).toBeNull();
    expect(result.todaySales).toBe(200);
    expect(result.activeSkuCount).toBe(3);
    expect(result.lowStockCount).toBe(2);
  });

  it("computes today's sales trend against yesterday's actual recorded total, never a guess", () => {
    // Fixture: sale-1 is today (2026-08-23, total 200), sale-2 is
    // yesterday (2026-08-22, total 250) — a real 20% drop.
    const result = buildRetailDashboardIntelligence(data(products), "pharmacy", false, [], new Date("2026-08-23T12:00:00Z"));
    expect(result.todaySalesChangePct).toBeCloseTo(-20, 5);
  });

  it("reports no trend (never a fabricated 0% or infinite jump) when yesterday had no sales", () => {
    const result = buildRetailDashboardIntelligence(data(products), "pharmacy", false, [], new Date("2026-08-25T12:00:00Z"));
    expect(result.todaySalesChangePct).toBeNull();
  });

  it("exposes owner financial metrics only when explicitly allowed", () => {
    const result = buildRetailDashboardIntelligence(data(products), "pharmacy", true, [], new Date("2026-08-23T12:00:00Z"));
    expect(result.inventoryCostValue).toBeGreaterThan(0);
    expect(result.periodProfit).toBeGreaterThan(0);
    expect(result.grossMarginPct).toBeGreaterThan(0);
  });

  it("computes expiry, quarantine and FEFO signals from real lot status", () => {
    const lots: RetailLotSnapshot[] = [
      { id: "a", productId: "med", batchNo: "A", expiryDate: "2026-09-10", qtyOnHand: 4, status: "available" },
      { id: "b", productId: "med", batchNo: "B", expiryDate: "2027-01-10", qtyOnHand: 5, status: "available" },
      { id: "c", productId: "med", batchNo: "C", expiryDate: "2026-07-10", qtyOnHand: 2, status: "expired" },
      { id: "d", productId: "care", batchNo: "D", expiryDate: "2027-01-10", qtyOnHand: 1, status: "quarantine" },
    ];
    const result = buildRetailDashboardIntelligence(data(products), "pharmacy", false, lots, new Date("2026-08-23T12:00:00Z"));
    expect(result.nearExpiryCount).toBe(1);
    expect(result.expiredLotCount).toBe(1);
    expect(result.quarantineLotCount).toBe(1);
    expect(result.fefoProductCount).toBe(1);
    expect(result.expiryQueue[0]?.batchNo).toBe("A");
  });

  it("builds top movers and category mix from recorded sales", () => {
    const result = buildRetailDashboardIntelligence(data(products), "pharmacy", false, [], new Date("2026-08-23T12:00:00Z"));
    expect(result.topMovers[0]?.productId).toBe("med");
    expect(result.topMovers[0]?.qty).toBe(3);
    expect(result.categoryMix.length).toBeGreaterThan(0);
  });

  it("resolves each named period to real day-key bounds plus an equal-length prior period", () => {
    const reference = new Date("2026-08-23T12:00:00Z");

    const sevenDay = resolvePeriodRange("7d", reference);
    expect(sevenDay.startKey).toBe("2026-08-17");
    expect(sevenDay.endKey).toBe("2026-08-23");
    expect(sevenDay.priorStartKey).toBe("2026-08-10");
    expect(sevenDay.priorEndKey).toBe("2026-08-16");

    const thisMonth = resolvePeriodRange("this_month", reference);
    expect(thisMonth.startKey).toBe("2026-08-01");
    expect(thisMonth.endKey).toBe("2026-08-23");
    // Month-over-month: same day-count starting from the 1st of July.
    expect(thisMonth.priorStartKey).toBe("2026-07-01");
    expect(thisMonth.priorEndKey).toBe("2026-07-23");

    const lastMonth = resolvePeriodRange("last_month", reference);
    expect(lastMonth.startKey).toBe("2026-07-01");
    expect(lastMonth.endKey).toBe("2026-07-31");
  });

  it("switches periodSales/periodLabel with the selected DashboardPeriod, defaulting to 30d for existing callers", () => {
    const reference = new Date("2026-08-23T12:00:00Z");
    const result30d = buildRetailDashboardIntelligence(data(products), "pharmacy", false, [], reference);
    expect(result30d.periodLabel).toBe("Last 30 days");

    const result7d = buildRetailDashboardIntelligence(data(products), "pharmacy", false, [], reference, "7d");
    expect(result7d.periodLabel).toBe("Last 7 days");
    // Both of the fixture's sales (08-22, 08-23) fall inside a 7-day
    // window just as much as a 30-day one — same real total either way.
    expect(result7d.periodSales).toBe(result30d.periodSales);
    // No recorded sales in the preceding 7-day window (08-10..08-16) —
    // periodChangePct must be null, not a fabricated 0% or ∞.
    expect(result7d.periodChangePct).toBeNull();
  });

  it("computes periodChangePct from real recorded sales in the prior period, never a guess", () => {
    const priorPeriodSale: AppData["sales"][number] = {
      id: "sale-prior",
      billNo: "INV-0",
      date: "2026-08-14T08:00:00.000Z", // inside the 7d preset's prior window
      lines: [{ productId: products[0].id, productName: products[0].name, qty: 1, unitPrice: products[0].sellPrice, buyPrice: products[0].buyPrice }],
      total: 100,
      profit: 50,
      paymentMethod: "cash",
      creditAmount: 0,
    };
    const withPriorSale: AppData = { ...data(products), sales: [...data(products).sales, priorPeriodSale] };
    const result = buildRetailDashboardIntelligence(withPriorSale, "pharmacy", false, [], new Date("2026-08-23T12:00:00Z"), "7d");
    // periodSales (450) vs prior period total (100): +350%.
    expect(result.periodChangePct).toBeCloseTo(350, 5);
  });

  it("never renders a product's free-text pack size where a unit belongs (Replenishment Queue bug)", () => {
    // packSize is a descriptive field ("100 tablets", or shorthand like
    // "100C") — not a unit noun. A product missing an explicit `unit` used
    // to fall back to packSize here, producing "0 100C" next to a
    // reorder-queue quantity with no separator or label.
    const noUnitProduct = product({
      id: "capsule-only-packsize",
      name: "CEPHALEXIN CAP 250MG BP (NOVALEXIN)",
      category: "Medicines",
      stockQty: 0,
      reorderLevel: 10,
      customFields: { packSize: "100C", productKind: "medicine" },
    });
    const result = buildRetailDashboardIntelligence(
      data([noUnitProduct, products[1]]),
      "pharmacy",
      false,
      [],
      new Date("2026-08-23T12:00:00Z"),
    );
    const row = result.reorderQueue.find((item) => item.productId === "capsule-only-packsize");
    expect(row?.unit).toBe("units");
    expect(row?.unit).not.toContain("100C");
  });
});
