import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GROCERY_MEAT_CATALOGUE, groceryMeatProductsMissing } from "@/lib/grocery-meat-catalogue";
import { groceryProductLabel, groceryProductSearchText } from "@/lib/grocery-localization";
import { addProduct, createSale, updateProduct } from "@/lib/store/actions";
import { emptyAppData } from "@/lib/store/storage";

describe("optional grocery meat range", () => {
  it("keeps each cut editable, inactive, unpriced, barcode-free and zero-stock", () => {
    expect(GROCERY_MEAT_CATALOGUE).toHaveLength(9);
    expect(new Set(GROCERY_MEAT_CATALOGUE.map((p) => p.sku)).size).toBe(9);
    for (const product of GROCERY_MEAT_CATALOGUE) {
      expect(product.sectorId).toBe("grocery");
      expect(product.category).toBe("Meat & Poultry");
      expect(product.active).toBe(false);
      expect(product.sellPrice).toBe(0);
      expect(product.buyPrice).toBe(0);
      expect(product.stockQty).toBe(0);
      expect(product.customFields?.barcode).toBeUndefined();
      expect(existsSync(path.join(process.cwd(), "public", String(product.customFields?.imageUrl).replace(/^\//, "")))).toBe(true);
    }
  });

  it("preserves existing shop records on retry and SKU changes", () => {
    const breast = GROCERY_MEAT_CATALOGUE[0];
    const initial = addProduct(emptyAppData(), { ...breast, active: true, stockQty: 4, sellPrice: 1800 });
    expect(groceryMeatProductsMissing(initial.products.map((p) => p.sku))).toHaveLength(8);
    const edited = updateProduct(initial, initial.products[0].id, { ...breast, active: true, stockQty: 4, sellPrice: 1800, sku: "LOCAL-BREAST" });
    expect(groceryMeatProductsMissing(edited.products.flatMap((p) => [p.sku, String(p.customFields.templateSku)]))).toHaveLength(8);
    expect(edited.products[0].sellPrice).toBe(1800);
  });

  it("localizes parent chicken and prevents sale until activated with stock and price", () => {
    const parent = GROCERY_MEAT_CATALOGUE.find((p) => p.name === "Broiler Parent Chicken")!;
    expect(groceryProductLabel(parent, "si")).toBe("බ්‍රොයිලර් මව් කුකුළා");
    expect(groceryProductSearchText(parent)).toContain("பிராய்லர் தாய்க்கோழி");
    const initial = addProduct(emptyAppData(), parent);
    expect(createSale(initial, [{ productId: initial.products[0].id, qty: 1 }], "cash").sales).toHaveLength(0);
  });
});
