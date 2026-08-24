import { describe, expect, it } from "vitest";
import type { SectorId } from "@/lib/types";
import {
  categoriesForSector,
  defaultCategoryForSector,
  parseSectorId,
  sectorById,
  sectors,
} from "./sectors";
import { sectorFormFields } from "./sector-fields";
import { sectorFeatures } from "./sector-features";
import { BUSINESS_TEMPLATES } from "./admin/templates";

const EXPECTED_SECTORS: SectorId[] = [
  "grocery",
  "pharmacy",
  "electronics",
  "mobile_shop",
  "electricals",
  "spare_parts",
  "footwear",
  "textile",
  "ac_hvac",
  "car_sales",
];

describe("business sector templates", () => {
  it("has one complete runtime + provisioning template per supported sector", () => {
    expect(sectors.map((s) => s.id)).toEqual(EXPECTED_SECTORS);
    expect(new Set(sectors.map((s) => s.id)).size).toBe(EXPECTED_SECTORS.length);

    for (const sectorId of EXPECTED_SECTORS) {
      expect(sectorById(sectorId)).toBeDefined();
      expect(BUSINESS_TEMPLATES.some((t) => t.sectorId === sectorId)).toBe(true);
      expect(parseSectorId(sectorId)).toBe(sectorId);
    }
  });

  it("never points a sector at a missing field definition", () => {
    for (const sectorId of EXPECTED_SECTORS) {
      const template = sectorById(sectorId)!;
      const resolved = sectorFormFields(sectorId);
      expect(resolved.map((f) => f.key)).toEqual(template.extraFields);
    }
  });

  it("has a valid default category inside every sector catalogue", () => {
    for (const sectorId of EXPECTED_SECTORS) {
      const categories = categoriesForSector(sectorId);
      expect(categories.length).toBeGreaterThan(1);
      expect(categories).toContain(defaultCategoryForSector(sectorId));
      expect(new Set(categories).size).toBe(categories.length);
    }
  });

  it("keeps specialized modules isolated by business type", () => {
    expect(sectorFeatures("ac_hvac").ac_jobs).toBe(true);
    expect(sectorFeatures("ac_hvac").vehicles).toBe(false);
    expect(sectorFeatures("car_sales").vehicles).toBe(true);
    expect(sectorFeatures("car_sales").ac_jobs).toBe(false);

    for (const sectorId of ["grocery", "pharmacy", "electronics", "mobile_shop", "electricals", "spare_parts", "footwear", "textile"] as SectorId[]) {
      expect(sectorFeatures(sectorId).ac_jobs).toBe(false);
      expect(sectorFeatures(sectorId).vehicles).toBe(false);
      expect(sectorFeatures(sectorId).sales).toBe(true);
      expect(sectorFeatures(sectorId).stock).toBe(true);
    }
  });

  it("includes the key deep fields for pharmacy, mobile repair and footwear", () => {
    const pharmacy = sectorFormFields("pharmacy").map((f) => f.key);
    expect(pharmacy).toEqual(expect.arrayContaining(["genericName", "strength", "batchNo", "expiryDate", "requiresPrescription"]));

    const mobile = sectorFormFields("mobile_shop").map((f) => f.key);
    expect(mobile).toEqual(expect.arrayContaining(["imei", "serialNo", "compatibleModels", "partNo", "warrantyMonths"]));

    const footwear = sectorFormFields("footwear").map((f) => f.key);
    expect(footwear).toEqual(expect.arrayContaining(["styleCode", "size", "color", "material", "gender"]));

    const textile = sectorFormFields("textile").map((f) => f.key);
    expect(textile).toEqual(expect.arrayContaining(["fabricFamily", "composition", "width", "gsm", "shade", "dyeLot"]));
  });

  it("falls back unknown persisted sector values safely to grocery", () => {
    expect(parseSectorId("unknown-old-sector")).toBe("grocery");
    expect(parseSectorId(null)).toBe("grocery");
  });
});
