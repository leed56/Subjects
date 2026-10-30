import type { ProductInput } from "@/lib/store/types";

/**
 * Optional Sri Lankan grocery range informed by local mills' published product
 * catalogues. These are unbranded templates, never actual stock or price data.
 * The owner must confirm a pack, cost, selling price, barcode and physical stock
 * before activating each item in Stock.
 */
const PRODUCTS = [
  ["Chilli Powder", "CHP", "100 g", "spice"],
  ["Chilli Pieces", "CHL", "100 g", "spice"],
  ["Roasted Chilli Powder", "RCH", "100 g", "spice"],
  ["Turmeric Powder", "TUR", "100 g", "spice"],
  ["Coriander Powder", "COR", "100 g", "spice"],
  ["Cumin Powder", "CUM", "100 g", "spice"],
  ["Roasted Cumin Powder", "RCU", "100 g", "spice"],
  ["Fennel Powder", "FEN", "100 g", "spice"],
  ["Fenugreek Powder", "FGK", "100 g", "spice"],
  ["Black Pepper Powder", "PEP", "50 g", "spice"],
  ["Cinnamon Powder", "CIN", "50 g", "spice"],
  ["Mustard Powder", "MUS", "100 g", "spice"],
  ["Ginger Powder", "GIN", "100 g", "spice"],
  ["Clove Powder", "CLO", "50 g", "spice"],
  ["Cardamom Powder", "CAR", "50 g", "spice"],
  ["Nutmeg Powder", "NUT", "50 g", "spice"],
  ["Goraka Powder", "GOR", "100 g", "spice"],
  ["Curry Leaf Powder", "CLF", "50 g", "spice"],
  ["Raw Curry Powder", "RAW", "100 g", "blend"],
  ["Roasted Curry Powder", "RST", "100 g", "blend"],
  ["Jaffna Curry Powder", "JAF", "100 g", "blend"],
  ["Meat Curry Powder", "MEA", "100 g", "blend"],
  ["Fish Curry Powder", "FIS", "100 g", "blend"],
  ["Chicken Masala", "CKM", "100 g", "blend"],
  ["Fish Masala", "FSM", "100 g", "blend"],
  ["Biryani Masala", "BIR", "100 g", "blend"],
  ["Garam Masala", "GAR", "100 g", "blend"],
  ["Sambar Powder", "SAM", "100 g", "blend"],
  ["Red Rice Flour", "RRF", "1 kg", "flour"],
  ["White Rice Flour", "WRF", "1 kg", "flour"],
  ["Kurakkan Flour", "KUR", "400 g", "flour"],
  ["Gram Flour", "GRF", "500 g", "flour"],
  ["Undu Flour", "UND", "200 g", "flour"],
  ["Atta Flour", "ATT", "1 kg", "flour"],
  ["Thosai Mix", "THO", "400 g", "flour"],
  ["Hopper Mix", "HOP", "400 g", "flour"],
] as const;

export const GRINDING_MILL_CATALOGUE: readonly ProductInput[] = PRODUCTS.map(([name, code, pack, kind]) => ({
  name,
  sku: `GRC-MILL-${code}-001`,
  category: kind === "flour" ? "Rice, Flour & Grains" : "Spices & Seasoning",
  sectorId: "grocery",
  condition: "new",
  active: false,
  buyPrice: 0,
  sellPrice: 0,
  stockQty: 0,
  reorderLevel: 0,
  unit: "pack",
  notes: "Grinding-mill catalogue template. Confirm the pack, recipe, price, barcode and received stock before activation.",
  customFields: {
    unitVariant: pack,
    imageUrl: `/images/grocery/grinding-mill/${code.toLowerCase()}.svg`,
  },
}));

export function grindingMillProductsMissing(existingSkus: Iterable<string | undefined>): ProductInput[] {
  const present = new Set(Array.from(existingSkus).map((sku) => sku?.trim().toUpperCase()).filter(Boolean));
  return GRINDING_MILL_CATALOGUE.filter((product) => !present.has(product.sku?.toUpperCase())).map((product) => ({
    ...product,
    customFields: { ...product.customFields },
  }));
}
