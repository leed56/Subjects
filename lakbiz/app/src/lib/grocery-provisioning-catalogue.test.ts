import { describe, expect, it } from "vitest";
import { GROCERY_PROVISIONING_CATALOGUE } from "@/lib/grocery-provisioning-catalogue";

describe("new grocery shop provisioning catalogue", () => {
  it("includes the starter grocery, meat and grinding-mill ranges", () => {
    expect(GROCERY_PROVISIONING_CATALOGUE).toHaveLength(60);
    expect(GROCERY_PROVISIONING_CATALOGUE.filter((product) => product.sku?.startsWith("GRC-MEAT-")).length).toBe(8);
    expect(GROCERY_PROVISIONING_CATALOGUE.filter((product) => product.sku?.startsWith("GRC-MILL-")).length).toBe(36);
    expect(GROCERY_PROVISIONING_CATALOGUE.filter((product) => product.sku?.startsWith("GRC-") && !product.sku?.startsWith("GRC-MEAT-") && !product.sku?.startsWith("GRC-MILL-")).length).toBe(16);
  });

  it("keeps every seeded item inactive and without assumed prices, stock or barcodes", () => {
    const skus = GROCERY_PROVISIONING_CATALOGUE.map((product) => product.sku);
    expect(skus.every(Boolean)).toBe(true);
    expect(new Set(skus).size).toBe(skus.length);
    for (const product of GROCERY_PROVISIONING_CATALOGUE) {
      expect(product.active).toBe(false);
      expect(product.buyPrice).toBe(0);
      expect(product.sellPrice).toBe(0);
      expect(product.stockQty).toBe(0);
      expect(product.reorderLevel).toBe(0);
      expect(product.customFields?.barcode).toBeUndefined();
      expect(product.customFields?.imageUrl).toMatch(/^\/images\/grocery\//);
    }
  });
});
