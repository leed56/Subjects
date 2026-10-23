import type { ProductInput } from "@/lib/store/types";

/**
 * A small, practical catalogue for a newly opened Sri Lankan grocery shop.
 * It is deliberately data only: nothing imports this file to populate a shop
 * automatically. An owner explicitly chooses to add it from the empty POS or
 * stock workspace, and can change every field afterwards.
 */
export const GROCERY_STARTER_CATALOGUE: readonly ProductInput[] = [
  { name: "Banana", sku: "GRC-BAN-001", category: "Fruits", sectorId: "grocery", condition: "new", buyPrice: 190, sellPrice: 280, stockQty: 30, reorderLevel: 8, unit: "kg", customFields: { barcode: "2000000000019", unitVariant: "1 kg" } },
  { name: "Apple", sku: "GRC-APL-001", category: "Fruits", sectorId: "grocery", condition: "new", buyPrice: 900, sellPrice: 1200, stockQty: 20, reorderLevel: 6, unit: "kg", customFields: { barcode: "2000000000026", unitVariant: "1 kg" } },
  { name: "Tomato", sku: "GRC-TOM-001", category: "Vegetables", sectorId: "grocery", condition: "new", buyPrice: 300, sellPrice: 420, stockQty: 25, reorderLevel: 7, unit: "kg", customFields: { barcode: "2000000000033", unitVariant: "1 kg" } },
  { name: "Potato", sku: "GRC-POT-001", category: "Vegetables", sectorId: "grocery", condition: "new", buyPrice: 230, sellPrice: 320, stockQty: 30, reorderLevel: 8, unit: "kg", customFields: { barcode: "2000000000040", unitVariant: "1 kg" } },
  { name: "Red Onion", sku: "GRC-ONI-001", category: "Vegetables", sectorId: "grocery", condition: "new", buyPrice: 390, sellPrice: 520, stockQty: 25, reorderLevel: 7, unit: "kg", customFields: { barcode: "2000000000057", unitVariant: "1 kg" } },
  { name: "Carrot", sku: "GRC-CAR-001", category: "Vegetables", sectorId: "grocery", condition: "new", buyPrice: 340, sellPrice: 480, stockQty: 20, reorderLevel: 6, unit: "kg", customFields: { barcode: "2000000000064", unitVariant: "1 kg" } },
  { name: "Ginger", sku: "GRC-GIN-001", category: "Vegetables", sectorId: "grocery", condition: "new", buyPrice: 820, sellPrice: 1100, stockQty: 12, reorderLevel: 4, unit: "kg", customFields: { barcode: "2000000000071", unitVariant: "1 kg" } },
  { name: "Green Chilli", sku: "GRC-CHI-001", category: "Vegetables", sectorId: "grocery", condition: "new", buyPrice: 290, sellPrice: 400, stockQty: 18, reorderLevel: 5, unit: "pack", customFields: { barcode: "2000000000088", unitVariant: "250 g" } },
  { name: "Chicken", sku: "GRC-CHK-001", category: "Frozen Meat & Seafood", sectorId: "grocery", condition: "new", buyPrice: 1180, sellPrice: 1450, stockQty: 18, reorderLevel: 5, unit: "kg", customFields: { barcode: "2000000000095", unitVariant: "1 kg" } },
  { name: "Bread", sku: "GRC-BRD-001", category: "Bread & Buns", sectorId: "grocery", condition: "new", buyPrice: 155, sellPrice: 220, stockQty: 40, reorderLevel: 12, unit: "pcs", customFields: { barcode: "2000000000101", unitVariant: "1 loaf" } },
  { name: "Rice", sku: "GRC-RIC-001", category: "Rice, Flour & Grains", sectorId: "grocery", condition: "new", buyPrice: 215, sellPrice: 280, stockQty: 50, reorderLevel: 15, unit: "kg", customFields: { barcode: "2000000000118", unitVariant: "1 kg" } },
  { name: "Wheat Flour", sku: "GRC-FLR-001", category: "Rice, Flour & Grains", sectorId: "grocery", condition: "new", buyPrice: 190, sellPrice: 250, stockQty: 40, reorderLevel: 12, unit: "kg", customFields: { barcode: "2000000000125", unitVariant: "1 kg" } },
  { name: "Sugar", sku: "GRC-SUG-001", category: "Sugar & Salt", sectorId: "grocery", condition: "new", buyPrice: 235, sellPrice: 290, stockQty: 45, reorderLevel: 12, unit: "kg", customFields: { barcode: "2000000000132", unitVariant: "1 kg" } },
  { name: "Coconut", sku: "GRC-COC-001", category: "Coconut Products", sectorId: "grocery", condition: "new", buyPrice: 95, sellPrice: 130, stockQty: 50, reorderLevel: 15, unit: "pcs", customFields: { barcode: "2000000000149", unitVariant: "each" } },
  { name: "Eggs", sku: "GRC-EGG-001", category: "Eggs", sectorId: "grocery", condition: "new", buyPrice: 520, sellPrice: 650, stockQty: 30, reorderLevel: 8, unit: "pack", customFields: { barcode: "2000000000156", unitVariant: "10 pack" } },
  { name: "Fresh Milk", sku: "GRC-MLK-001", category: "Milk & Dairy", sectorId: "grocery", condition: "new", buyPrice: 390, sellPrice: 490, stockQty: 24, reorderLevel: 8, unit: "L", customFields: { barcode: "2000000000163", unitVariant: "1 L" } },
];

export function copyGroceryStarterCatalogue(): ProductInput[] {
  return GROCERY_STARTER_CATALOGUE.map((product) => ({
    ...product,
    customFields: { ...product.customFields },
  }));
}

export function groceryStarterProductsMissing(existingSkus: Iterable<string | undefined>): ProductInput[] {
  const present = new Set(Array.from(existingSkus).filter(Boolean));
  return copyGroceryStarterCatalogue().filter((product) => !present.has(product.sku));
}
