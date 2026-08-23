import { describe, expect, it } from "vitest";
import {
  assertLakBizTarget,
  DEMO_HISTORY_SALE_COUNT,
  inventoryLotRow,
  inventoryProfileRow,
  productDbRow,
  shouldTrackLot,
  uuidFromSeed,
} from "./importer.mjs";

describe("LakBiz demo importer guards", () => {
  it("refuses every Supabase project except the verified nexus-erp project", () => {
    expect(() => assertLakBizTarget("https://zestppstpwjxriwcuykc.supabase.co")).not.toThrow();
    expect(() => assertLakBizTarget("https://baobnskkrgkwdaefzulc.supabase.co")).toThrow(/Refusing demo import/);
  });

  it("seeds a non-toy deterministic 30-day sales history", () => {
    expect(DEMO_HISTORY_SALE_COUNT).toBe(185);
  });

  it("creates stable UUIDs for idempotent lot rows", () => {
    const first = uuidFromSeed("demo:pharmacy:lot");
    expect(first).toBe(uuidFromSeed("demo:pharmacy:lot"));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("tracks medicines and wellness by lot+FEFO but leaves convenience goods simple", () => {
    const medicine = { id: "med", productKind: "medicine", department: "Pharmaceutical", category: "Medicines" };
    const supplement = { id: "supp", productKind: "retail", department: "Wellness", category: "Vitamins & Supplements" };
    const biscuit = { id: "biscuit", productKind: "retail", department: "Convenience Retail", category: "Biscuits & Crackers" };
    expect(shouldTrackLot(medicine)).toBe(true);
    expect(shouldTrackLot(supplement)).toBe(true);
    expect(shouldTrackLot(biscuit)).toBe(false);
    expect(inventoryProfileRow("00000000-0000-4000-8000-000000000001", medicine)).toMatchObject({ tracking_mode: "lot", fefo_enabled: true });
    expect(inventoryProfileRow("00000000-0000-4000-8000-000000000001", biscuit)).toMatchObject({ tracking_mode: "simple", fefo_enabled: false });
  });

  it("marks synthetic stock/cost provenance explicitly in the existing product custom fields", () => {
    const product = {
      id: "demo:pharmacy:spc:x",
      source: "spc",
      sourceUrl: "https://www.spc.lk/products.php",
      sourceProductId: "123",
      retrievedAt: "2026-08-23T00:00:00Z",
      productName: "TEST MED 5MG",
      category: "Medicines",
      department: "Pharmaceutical",
      subcategory: "Unclassified Medicine",
      productKind: "medicine",
      taxonomyMethod: "source_context",
      buyPrice: 100,
      sellPrice: 120,
      unit: "pack",
      costSource: "spc_wholesale",
      active: true,
    };
    const row = productDbRow("00000000-0000-4000-8000-000000000001", "pharmacy", product);
    expect(row.custom_fields.demoData).toBe(true);
    expect(row.custom_fields.stockIsSynthetic).toBe(true);
    expect(row.custom_fields.costIsSynthetic).toBe(false);
    const lot = inventoryLotRow("00000000-0000-4000-8000-000000000001", product, 0, row.stock_qty);
    expect(lot.status).toBe("expired");
    expect(lot.notes).toMatch(/DEMO synthetic expired batch/);
  });
});
