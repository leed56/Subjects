import type { ProductInput } from "@/lib/store/types";

// The existing starter catalogue already contains general Chicken. This
// optional range adds distinct cuts and prepared products, with no invented
// price, barcode or received stock.
const PRODUCTS = [
  ["Chicken Breast", "BRE", "1 kg"],
  ["Chicken Drumsticks", "DRM", "1 kg"],
  ["Mixed Chicken Parts", "PRT", "1 kg"],
  ["Chicken Sausages (Small Pack)", "SAS", "80 g"],
  ["Chicken Sausages (Large Pack)", "SAL", "500 g"],
  ["Chicken Meatballs", "MBL", "200 g"],
  ["Whole Broiler Chicken", "BRO", "1 kg"],
  ["Broiler Parent Chicken", "PAR", "1 kg"],
  ["Farm Chicken", "FAR", "1 kg"],
] as const;

export const GROCERY_MEAT_CATALOGUE: readonly ProductInput[] = PRODUCTS.map(([name, code, pack]) => ({
  name,
  sku: `GRC-MEAT-${code}-001`,
  category: "Meat & Poultry",
  sectorId: "grocery",
  condition: "new",
  active: false,
  buyPrice: 0,
  sellPrice: 0,
  stockQty: 0,
  reorderLevel: 0,
  unit: "pack",
  notes: "Grocery meat template. Confirm cut, chilled/frozen handling, pack, cost, selling price, barcode and received stock before activation.",
  customFields: {
    unitVariant: pack,
    imageUrl: `/images/grocery/meat/${code.toLowerCase()}.svg`,
    templateSku: `GRC-MEAT-${code}-001`,
  },
}));

export function groceryMeatProductsMissing(existingSkus: Iterable<string | undefined>): ProductInput[] {
  const present = new Set(Array.from(existingSkus).map((sku) => sku?.trim().toUpperCase()).filter(Boolean));
  return GROCERY_MEAT_CATALOGUE.filter((product) => !present.has(product.sku?.toUpperCase())).map((product) => ({
    ...product,
    customFields: { ...product.customFields },
  }));
}
