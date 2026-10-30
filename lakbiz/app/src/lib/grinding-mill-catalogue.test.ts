import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { groceryCategoryLabel, groceryProductLabel, groceryProductSearchText } from "@/lib/grocery-localization";
import { GRINDING_MILL_CATALOGUE, grindingMillProductsMissing } from "@/lib/grinding-mill-catalogue";
import { addProduct, createSale, updateProduct } from "@/lib/store/actions";
import { emptyAppData } from "@/lib/store/storage";

describe("optional Sri Lankan grinding-mill catalogue", () => {
  it("creates unique, unsellable templates with original local art and no fabricated price, barcode or stock", () => {
    expect(GRINDING_MILL_CATALOGUE).toHaveLength(36);
    expect(new Set(GRINDING_MILL_CATALOGUE.map((p) => p.sku)).size).toBe(GRINDING_MILL_CATALOGUE.length);
    for (const product of GRINDING_MILL_CATALOGUE) {
      expect(product.sectorId).toBe("grocery");
      expect(product.active).toBe(false);
      expect(product.sellPrice).toBe(0);
      expect(product.buyPrice).toBe(0);
      expect(product.stockQty).toBe(0);
      expect(product.customFields?.barcode).toBeUndefined();
      const image = product.customFields?.imageUrl;
      expect(typeof image).toBe("string");
      expect(existsSync(path.join(process.cwd(), "public", String(image).replace(/^\//, "")))).toBe(true);
    }
  });

  it("is opt-in, shop-local and safe to resume without replacing an existing SKU", () => {
    const first = GRINDING_MILL_CATALOGUE[0];
    const existing = addProduct(emptyAppData(), { ...first, sellPrice: 410, stockQty: 12, active: true });
    const missing = grindingMillProductsMissing(existing.products.map((p) => p.sku));
    expect(missing).toHaveLength(35);
    expect(missing.some((p) => p.sku === first.sku)).toBe(false);
    expect(grindingMillProductsMissing([` ${first.sku?.toLowerCase()} `])).toHaveLength(35);
    expect(existing.products[0].sellPrice).toBe(410);
    expect(existing.products[0].stockQty).toBe(12);
  });

  it("supports core spices and flour in English, Sinhala and Tamil search", () => {
    const cumin = GRINDING_MILL_CATALOGUE.find((p) => p.name === "Cumin Powder")!;
    const flour = GRINDING_MILL_CATALOGUE.find((p) => p.name === "Kurakkan Flour")!;
    expect(groceryProductLabel(cumin, "si")).toBe("සූදුරු කුඩු");
    expect(groceryProductLabel(cumin, "ta")).toBe("சீரகத் தூள்");
    expect(groceryProductSearchText(cumin)).toContain("சீரகத் தூள்");
    expect(groceryProductLabel(flour, "si")).toBe("කුරක්කන් පිටි");
    expect(groceryCategoryLabel(cumin.category, "ta")).toBe("மசாலா மற்றும் சுவையூட்டிகள்");
  });

  it("keeps inactive and unpriced grocery templates out of direct sale actions", () => {
    const template = GRINDING_MILL_CATALOGUE[0];
    const inactive = addProduct(emptyAppData(), { ...template, stockQty: 5 });
    expect(createSale(inactive, [{ productId: inactive.products[0].id, qty: 1 }], "cash").sales).toHaveLength(0);
    const unpriced = addProduct(emptyAppData(), { ...template, active: true, stockQty: 5 });
    expect(createSale(unpriced, [{ productId: unpriced.products[0].id, qty: 1 }], "cash").sales).toHaveLength(0);
  });

  it("records a stock movement when an owner changes opening quantity in Stock", () => {
    const template = GRINDING_MILL_CATALOGUE[0];
    const initial = addProduct(emptyAppData(), template);
    const corrected = updateProduct(initial, initial.products[0].id, { ...template, stockQty: 8 });
    expect(corrected.products[0].stockQty).toBe(8);
    expect(corrected.stockLogs[0]).toMatchObject({ type: "in", qty: 8, productId: initial.products[0].id });
    const reduced = updateProduct(corrected, initial.products[0].id, { ...template, stockQty: 3 });
    expect(reduced.stockLogs[0]).toMatchObject({ type: "out", qty: 5 });
  });
});
