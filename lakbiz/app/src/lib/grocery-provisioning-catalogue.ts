import {
  GRINDING_MILL_CATALOGUE,
} from "@/lib/grinding-mill-catalogue";
import { GROCERY_STARTER_CATALOGUE } from "@/lib/grocery-starter-catalogue";
import type { ProductInput } from "@/lib/store/types";

const MEAT_AND_POULTRY: ProductInput[] = [
  { name: "Chicken Breast", sku: "GRC-MEAT-CHB-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "kg", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm supplier, cold-chain handling, price and received stock before activation.", customFields: { unitVariant: "1 kg", imageUrl: "/images/grocery/meat/chicken-breast.svg" } },
  { name: "Chicken Drumsticks", sku: "GRC-MEAT-DRM-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "kg", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm supplier, cold-chain handling, price and received stock before activation.", customFields: { unitVariant: "1 kg", imageUrl: "/images/grocery/meat/chicken-drumsticks.svg" } },
  { name: "Chicken Parts", sku: "GRC-MEAT-PRT-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "kg", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm supplier, cold-chain handling, price and received stock before activation.", customFields: { unitVariant: "1 kg", imageUrl: "/images/grocery/meat/chicken-parts.svg" } },
  { name: "Small Sausages", sku: "GRC-MEAT-SSG-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "pack", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm brand, pack size, price and received stock before activation.", customFields: { unitVariant: "small pack", imageUrl: "/images/grocery/meat/sausages-small.svg" } },
  { name: "Large Sausages", sku: "GRC-MEAT-LSG-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "pack", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm brand, pack size, price and received stock before activation.", customFields: { unitVariant: "large pack", imageUrl: "/images/grocery/meat/sausages-large.svg" } },
  { name: "Meatballs", sku: "GRC-MEAT-MBL-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "pack", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm brand, pack size, price and received stock before activation.", customFields: { unitVariant: "pack", imageUrl: "/images/grocery/meat/meatballs.svg" } },
  { name: "Broiler Parent Chicken", sku: "GRC-MEAT-BPC-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "each", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm product form, supplier, cold-chain handling, price and received stock before activation.", customFields: { unitVariant: "each", imageUrl: "/images/grocery/meat/broiler-parent-chicken.svg" } },
  { name: "Farm Chicken", sku: "GRC-MEAT-FCH-001", category: "Meat & Poultry", sectorId: "grocery", condition: "new", unit: "kg", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0, active: false, notes: "Template only. Confirm supplier, cold-chain handling, price and received stock before activation.", customFields: { unitVariant: "1 kg", imageUrl: "/images/grocery/meat/farm-chicken.svg" } },
];

const STANDARD_PRODUCT_IMAGES: Record<string, string> = {
  "GRC-BAN-001": "/images/grocery/banana.png",
  "GRC-APL-001": "/images/grocery/apple.png",
  "GRC-TOM-001": "/images/grocery/tomato.png",
  "GRC-POT-001": "/images/grocery/potato.png",
  "GRC-ONI-001": "/images/grocery/red-onion.png",
  "GRC-CAR-001": "/images/grocery/carrot.png",
  "GRC-GIN-001": "/images/grocery/ginger.png",
  "GRC-CHI-001": "/images/grocery/green-chilli.png",
  "GRC-CHK-001": "/images/grocery/chicken.png",
  "GRC-BRD-001": "/images/grocery/bread.png",
  "GRC-RIC-001": "/images/grocery/rice.png",
  "GRC-FLR-001": "/images/grocery/wheat-flour.png",
  "GRC-SUG-001": "/images/grocery/sugar.png",
  "GRC-COC-001": "/images/grocery/coconut.png",
  "GRC-EGG-001": "/images/grocery/eggs.png",
  "GRC-MLK-001": "/images/grocery/fresh-milk.png",
};

function asUnpricedTemplate(product: ProductInput): ProductInput {
  const customFields = { ...product.customFields };
  delete customFields.barcode;
  customFields.imageUrl ??= STANDARD_PRODUCT_IMAGES[product.sku ?? ""] ?? "";

  return {
    ...product,
    buyPrice: 0,
    sellPrice: 0,
    stockQty: 0,
    reorderLevel: 0,
    active: false,
    notes: "Starter catalogue template. Enter real supplier cost, selling price, barcode and received stock before activation.",
    customFields,
  };
}

/** Catalogues preloaded only when an administrator creates a new grocery shop. */
export const GROCERY_PROVISIONING_CATALOGUE: readonly ProductInput[] = [
  ...GROCERY_STARTER_CATALOGUE.map(asUnpricedTemplate),
  ...MEAT_AND_POULTRY,
  ...GRINDING_MILL_CATALOGUE.map(asUnpricedTemplate),
];

