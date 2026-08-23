import type { SectorId } from "./types";

export type InventoryTrackingPreset = "simple" | "lot" | "serial" | "variant" | "variant_lot" | "variant_serial";

export type SectorCategoryBlueprint = {
  department: string;
  category: string;
  subcategory: string;
  defaultTrackingMode?: InventoryTrackingPreset;
  fefo?: boolean;
};

const PHARMACY_BLUEPRINT: readonly SectorCategoryBlueprint[] = [
  { department: "Pharmaceutical", category: "Medicines", subcategory: "Unclassified Medicine", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "Prescription Medicines", subcategory: "Prescription Medicines", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "OTC Medicines", subcategory: "Pain & Fever", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "OTC Medicines", subcategory: "Cough, Cold & Allergy", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "OTC Medicines", subcategory: "Stomach & Digestion", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "OTC Medicines", subcategory: "Eyes & Ears", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "Dermatology & Topicals", subcategory: "Creams & Ointments", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "Diabetes Care", subcategory: "Diabetes Medicines", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "First Aid", subcategory: "Dressings & Wound Care", defaultTrackingMode: "lot", fefo: true },
  { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Blood Pressure Monitors" },
  { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Glucose Monitoring" },
  { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Thermometers" },
  { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Masks & Protective Supplies" },
  { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Supports & Braces" },
  { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Testing Consumables" },
  { department: "Wellness", category: "Vitamins & Supplements", subcategory: "Multivitamins", defaultTrackingMode: "lot", fefo: true },
  { department: "Wellness", category: "Vitamins & Supplements", subcategory: "Minerals", defaultTrackingMode: "lot", fefo: true },
  { department: "Wellness", category: "Vitamins & Supplements", subcategory: "Beauty Supplements", defaultTrackingMode: "lot", fefo: true },
  { department: "Wellness", category: "Nutrition", subcategory: "Adult Nutrition", defaultTrackingMode: "lot", fefo: true },
  { department: "Wellness", category: "Nutrition", subcategory: "Diabetic Nutrition", defaultTrackingMode: "lot", fefo: true },
  { department: "Wellness", category: "Nutrition", subcategory: "Sports Nutrition", defaultTrackingMode: "lot", fefo: true },
  { department: "Wellness", category: "Nutrition", subcategory: "Weight Management", defaultTrackingMode: "lot", fefo: true },
  { department: "Wellness", category: "Preventive Care", subcategory: "Preventive Health" },
  { department: "Wellness", category: "Traditional Remedies", subcategory: "Traditional & Herbal" },
  { department: "Personal Care", category: "Oral Care", subcategory: "Toothpaste" },
  { department: "Personal Care", category: "Oral Care", subcategory: "Toothbrushes" },
  { department: "Personal Care", category: "Oral Care", subcategory: "Mouthwash" },
  { department: "Personal Care", category: "Bath & Body", subcategory: "Soap" },
  { department: "Personal Care", category: "Bath & Body", subcategory: "Body Wash" },
  { department: "Personal Care", category: "Hair Care", subcategory: "Shampoo" },
  { department: "Personal Care", category: "Hair Care", subcategory: "Conditioner" },
  { department: "Personal Care", category: "Skin Care", subcategory: "Moisturizers" },
  { department: "Personal Care", category: "Skin Care", subcategory: "Sun Care" },
  { department: "Personal Care", category: "Feminine Care", subcategory: "Sanitary Products" },
  { department: "Personal Care", category: "Grooming", subcategory: "Men's Care" },
  { department: "Mother & Baby", category: "Baby Care", subcategory: "Baby Toiletries" },
  { department: "Mother & Baby", category: "Baby Care", subcategory: "Diapers & Wipes" },
  { department: "Mother & Baby", category: "Baby Nutrition", subcategory: "Milk Formula", defaultTrackingMode: "lot", fefo: true },
  { department: "Mother & Baby", category: "Baby Nutrition", subcategory: "Baby Food", defaultTrackingMode: "lot", fefo: true },
  { department: "Mother & Baby", category: "Feeding", subcategory: "Feeding Accessories" },
  { department: "Mother & Baby", category: "Mother Care", subcategory: "Mother Care" },
  { department: "Convenience Retail", category: "Biscuits & Crackers", subcategory: "Biscuits" },
  { department: "Convenience Retail", category: "Confectionery", subcategory: "Chocolate & Candy" },
  { department: "Convenience Retail", category: "Confectionery", subcategory: "Mints & Gum" },
  { department: "Convenience Retail", category: "Snacks", subcategory: "Snack Foods" },
  { department: "Convenience Retail", category: "Beverages", subcategory: "Water" },
  { department: "Convenience Retail", category: "Beverages", subcategory: "Soft Drinks" },
  { department: "Convenience Retail", category: "Beverages", subcategory: "Fruit Drinks & Juice" },
  { department: "Convenience Retail", category: "Beverages", subcategory: "Energy & Sports Drinks" },
  { department: "Convenience Retail", category: "Beverages", subcategory: "Milk Drinks" },
  { department: "Convenience Retail", category: "Healthy Snacks", subcategory: "Healthy Snacks" },
  { department: "Household & Health Convenience", category: "Hygiene", subcategory: "Hand Sanitizer" },
  { department: "Household & Health Convenience", category: "Hygiene", subcategory: "Disinfectant" },
  { department: "Household & Health Convenience", category: "Paper & Wipes", subcategory: "Tissues" },
  { department: "Household & Health Convenience", category: "Paper & Wipes", subcategory: "Wet Wipes" },
  { department: "Household & Health Convenience", category: "Mosquito Protection", subcategory: "Repellents" },
];

const GROCERY_BLUEPRINT: readonly SectorCategoryBlueprint[] = [
  { department: "Grocery & Staples", category: "Rice, Flour & Grains", subcategory: "Rice" },
  { department: "Grocery & Staples", category: "Rice, Flour & Grains", subcategory: "Flour" },
  { department: "Grocery & Staples", category: "Pulses", subcategory: "Dhal" },
  { department: "Grocery & Staples", category: "Pulses", subcategory: "Pulses & Beans" },
  { department: "Grocery & Staples", category: "Sugar & Salt", subcategory: "Sugar" },
  { department: "Grocery & Staples", category: "Sugar & Salt", subcategory: "Salt" },
  { department: "Grocery & Staples", category: "Spices & Seasoning", subcategory: "Spices" },
  { department: "Grocery & Staples", category: "Spices & Seasoning", subcategory: "Seasoning" },
  { department: "Grocery & Staples", category: "Coconut Products", subcategory: "Coconut Milk & Cream" },
  { department: "Grocery & Staples", category: "Oil & Fats", subcategory: "Cooking Oil" },
  { department: "Packaged Food", category: "Biscuits & Crackers", subcategory: "Biscuits" },
  { department: "Packaged Food", category: "Biscuits & Crackers", subcategory: "Crackers & Cookies" },
  { department: "Packaged Food", category: "Noodles & Pasta", subcategory: "Noodles" },
  { department: "Packaged Food", category: "Noodles & Pasta", subcategory: "Pasta" },
  { department: "Packaged Food", category: "Breakfast", subcategory: "Cereals" },
  { department: "Packaged Food", category: "Soups & Ready Mixes", subcategory: "Soups" },
  { department: "Packaged Food", category: "Sauces & Condiments", subcategory: "Sauces" },
  { department: "Packaged Food", category: "Sauces & Condiments", subcategory: "Condiments" },
  { department: "Packaged Food", category: "Canned & Preserved", subcategory: "Canned Fish" },
  { department: "Packaged Food", category: "Canned & Preserved", subcategory: "Canned Foods" },
  { department: "Packaged Food", category: "Baking", subcategory: "Baking Products" },
  { department: "Snacks & Confectionery", category: "Snacks", subcategory: "Chips & Crisps" },
  { department: "Snacks & Confectionery", category: "Snacks", subcategory: "Mixtures & Savoury Snacks" },
  { department: "Snacks & Confectionery", category: "Snacks", subcategory: "Nuts & Dried Fruit" },
  { department: "Snacks & Confectionery", category: "Confectionery", subcategory: "Chocolate" },
  { department: "Snacks & Confectionery", category: "Confectionery", subcategory: "Candy & Sweets" },
  { department: "Snacks & Confectionery", category: "Confectionery", subcategory: "Gum & Mints" },
  { department: "Beverages", category: "Water & Soft Drinks", subcategory: "Water" },
  { department: "Beverages", category: "Water & Soft Drinks", subcategory: "Soft Drinks" },
  { department: "Beverages", category: "Juice & Fruit Drinks", subcategory: "Juice" },
  { department: "Beverages", category: "Tea & Coffee", subcategory: "Tea" },
  { department: "Beverages", category: "Tea & Coffee", subcategory: "Coffee" },
  { department: "Beverages", category: "Milk & Malt Drinks", subcategory: "Milk Powder" },
  { department: "Beverages", category: "Milk & Malt Drinks", subcategory: "Malt Drinks" },
  { department: "Beverages", category: "Energy & Sports Drinks", subcategory: "Energy Drinks" },
  { department: "Fresh Food", category: "Vegetables", subcategory: "Local Vegetables" },
  { department: "Fresh Food", category: "Vegetables", subcategory: "Up Country & Exotic" },
  { department: "Fresh Food", category: "Fruits", subcategory: "Local Fruits" },
  { department: "Fresh Food", category: "Fruits", subcategory: "Imported Fruits" },
  { department: "Fresh Food", category: "Eggs", subcategory: "Eggs" },
  { department: "Chilled & Dairy", category: "Milk & Dairy", subcategory: "Liquid Milk" },
  { department: "Chilled & Dairy", category: "Milk & Dairy", subcategory: "Yogurt & Curd" },
  { department: "Chilled & Dairy", category: "Milk & Dairy", subcategory: "Cheese" },
  { department: "Chilled & Dairy", category: "Milk & Dairy", subcategory: "Butter & Spreads" },
  { department: "Frozen", category: "Frozen Meat & Seafood", subcategory: "Frozen Meat" },
  { department: "Frozen", category: "Frozen Meat & Seafood", subcategory: "Frozen Seafood" },
  { department: "Frozen", category: "Frozen Foods", subcategory: "Frozen Vegetables" },
  { department: "Frozen", category: "Frozen Foods", subcategory: "Prepared Frozen Foods" },
  { department: "Frozen", category: "Frozen Desserts", subcategory: "Ice Cream & Desserts" },
  { department: "Bakery", category: "Bread & Buns", subcategory: "Bread" },
  { department: "Bakery", category: "Bread & Buns", subcategory: "Buns" },
  { department: "Bakery", category: "Cakes & Bakery Snacks", subcategory: "Cakes" },
  { department: "Personal & Baby", category: "Personal Care", subcategory: "Soap & Body Care" },
  { department: "Personal & Baby", category: "Personal Care", subcategory: "Shampoo & Hair Care" },
  { department: "Personal & Baby", category: "Oral Care", subcategory: "Oral Care" },
  { department: "Personal & Baby", category: "Feminine Care", subcategory: "Sanitary Products" },
  { department: "Personal & Baby", category: "Baby Care", subcategory: "Diapers & Baby Products" },
  { department: "Household", category: "Laundry", subcategory: "Laundry Care" },
  { department: "Household", category: "Cleaning", subcategory: "Surface & Floor Cleaning" },
  { department: "Household", category: "Dishwashing", subcategory: "Dishwashing" },
  { department: "Household", category: "Paper & Tissue", subcategory: "Tissues & Paper" },
  { department: "Household", category: "Home Care", subcategory: "Air Fresheners" },
  { department: "Household", category: "Home Care", subcategory: "Pest Control" },
  { department: "Household", category: "General Merchandise", subcategory: "Batteries & Consumables" },
  { department: "Pet Care", category: "Pet Food & Care", subcategory: "Pet Food & Care" },
];

export const SECTOR_CATEGORY_BLUEPRINTS: Partial<Record<SectorId, readonly SectorCategoryBlueprint[]>> = {
  pharmacy: PHARMACY_BLUEPRINT,
  grocery: GROCERY_BLUEPRINT,
};

export function categoryBlueprintForSector(sectorId: SectorId): readonly SectorCategoryBlueprint[] {
  return SECTOR_CATEGORY_BLUEPRINTS[sectorId] ?? [];
}

export function categoryNamesFromBlueprint(sectorId: SectorId): string[] {
  return Array.from(new Set(categoryBlueprintForSector(sectorId).map((entry) => entry.category)));
}

export function findCategoryBlueprint(
  sectorId: SectorId,
  department: string,
  category: string,
  subcategory: string,
): SectorCategoryBlueprint | undefined {
  return categoryBlueprintForSector(sectorId).find(
    (entry) =>
      entry.department === department &&
      entry.category === category &&
      entry.subcategory === subcategory,
  );
}
