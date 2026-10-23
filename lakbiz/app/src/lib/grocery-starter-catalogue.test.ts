import { describe, expect, it } from "vitest";
import { buildRetailDashboardIntelligence } from "@/lib/dashboard/retail-intelligence";
import {
  GROCERY_STARTER_CATALOGUE,
  groceryStarterProductsMissing,
} from "@/lib/grocery-starter-catalogue";
import { addProduct, createSale, updateProduct } from "@/lib/store/actions";
import { emptyAppData } from "@/lib/store/storage";

describe("grocery starter catalogue", () => {
  it("contains the agreed editable Sri Lankan grocery products and LKR prices", () => {
    expect(GROCERY_STARTER_CATALOGUE).toHaveLength(16);
    expect(new Set(GROCERY_STARTER_CATALOGUE.map((product) => product.sku)).size).toBe(16);
    expect(GROCERY_STARTER_CATALOGUE.find((product) => product.name === "Banana")?.sellPrice).toBe(280);
    expect(GROCERY_STARTER_CATALOGUE.find((product) => product.name === "Fresh Milk")?.sellPrice).toBe(490);
    expect(GROCERY_STARTER_CATALOGUE.every((product) => product.sectorId === "grocery" && Boolean(product.customFields?.barcode))).toBe(true);
  });

  it("does not re-add a starter product that is already in the owner catalogue", () => {
    const missing = groceryStarterProductsMissing(["GRC-BAN-001", "GRC-MLK-001"]);
    expect(missing).toHaveLength(14);
    expect(missing.some((product) => product.sku === "GRC-BAN-001")).toBe(false);
    expect(missing.some((product) => product.sku === "GRC-MLK-001")).toBe(false);
  });

  it("uses a changed owner price at checkout, decrements stock, and feeds the live grocery dashboard", () => {
    const bananaInput = GROCERY_STARTER_CATALOGUE.find((product) => product.sku === "GRC-BAN-001");
    expect(bananaInput).toBeDefined();
    const seeded = addProduct(emptyAppData(), bananaInput!);
    const banana = seeded.products[0];
    const repriced = updateProduct(seeded, banana.id, {
      ...bananaInput!,
      sellPrice: 300,
      stockQty: 30,
      customFields: { ...bananaInput!.customFields, imageUrl: "https://example.com/banana.png" },
    });
    const sold = createSale(repriced, [{ productId: banana.id, qty: 2 }], "cash");

    expect(sold.products[0].stockQty).toBe(28);
    expect(sold.sales[0].lines[0].unitPrice).toBe(300);
    expect(sold.products[0].customFields.imageUrl).toBe("https://example.com/banana.png");

    const dashboard = buildRetailDashboardIntelligence(sold, "grocery", true, [], new Date());
    expect(dashboard.todaySales).toBe(600);
    expect(dashboard.todayTransactions).toBe(1);
  });
});
