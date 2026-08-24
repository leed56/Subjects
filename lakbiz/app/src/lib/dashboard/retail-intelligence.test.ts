import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import type { AppData } from "@/lib/store/types";
import {
  buildRetailDashboardIntelligence,
  isPharmacyMedicine,
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
});
