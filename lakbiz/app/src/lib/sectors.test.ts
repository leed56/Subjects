import { describe, expect, it } from "vitest";
import { categoriesForSector, parseSectorId } from "./sectors";
import { categoryBlueprintForSector } from "./sector-category-blueprints";

describe("sector presets", () => {
  it("preserves every supported sector id instead of coercing newer sectors to grocery", () => {
    for (const sector of [
      "grocery",
      "pharmacy",
      "electronics",
      "mobile_shop",
      "electricals",
      "spare_parts",
      "footwear",
      "ac_hvac",
      "car_sales",
    ] as const) {
      expect(parseSectorId(sector)).toBe(sector);
    }
    expect(parseSectorId("unknown")).toBe("grocery");
  });

  it("gives pharmacy a modern retail taxonomy beyond medicines", () => {
    const blueprint = categoryBlueprintForSector("pharmacy");
    const departments = new Set(blueprint.map((entry) => entry.department));
    expect(departments.size).toBeGreaterThanOrEqual(6);
    expect([...departments]).toEqual(
      expect.arrayContaining([
        "Pharmaceutical",
        "Wellness",
        "Personal Care",
        "Mother & Baby",
        "Convenience Retail",
        "Household & Health Convenience",
      ]),
    );
    expect(categoriesForSector("pharmacy")).toEqual(
      expect.arrayContaining([
        "Medicines",
        "Medical Devices",
        "Vitamins & Supplements",
        "Oral Care",
        "Baby Care",
        "Beverages",
      ]),
    );
  });

  it("gives grocery broad supermarket coverage", () => {
    const categories = categoriesForSector("grocery");
    expect(categories).toEqual(
      expect.arrayContaining([
        "Rice, Flour & Grains",
        "Pulses",
        "Spices & Seasoning",
        "Biscuits & Crackers",
        "Water & Soft Drinks",
        "Vegetables",
        "Milk & Dairy",
        "Frozen Foods",
        "Bread & Buns",
        "Personal Care",
        "Cleaning",
        "Pet Food & Care",
      ]),
    );
  });
});
