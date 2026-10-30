import { describe, expect, it } from "vitest";
import {
  calculateTierPrices,
  findMoleculeEquivalents,
  formatUomBreakdown,
  parsePharmacyPackaging,
  validateRxClinicalIntake,
} from "./pharmacy-uom";
import type { Product } from "./types";

describe("Pharmacy Packaging & UOM Dispensing", () => {
  it("parses multi-pack 10x10 format correctly", () => {
    const pkg = parsePharmacyPackaging("10x10");
    expect(pkg.totalUnitsPerBox).toBe(100);
    expect(pkg.stripsPerBox).toBe(10);
    expect(pkg.unitsPerStrip).toBe(10);
    expect(pkg.hasSubUnits).toBe(true);
  });

  it("parses descriptive '10 strips of 10' format", () => {
    const pkg = parsePharmacyPackaging("10 strips of 10", "capsule");
    expect(pkg.totalUnitsPerBox).toBe(100);
    expect(pkg.stripsPerBox).toBe(10);
    expect(pkg.unitsPerStrip).toBe(10);
    expect(pkg.unitLabel).toBe("capsule");
  });

  it("parses integer quantity '30' into 3 strips of 10", () => {
    const pkg = parsePharmacyPackaging(30);
    expect(pkg.totalUnitsPerBox).toBe(30);
    expect(pkg.stripsPerBox).toBe(3);
    expect(pkg.unitsPerStrip).toBe(10);
  });

  it("handles single-unit bottles/syrups gracefully", () => {
    const pkg = parsePharmacyPackaging("1 bottle 150ml", "bottle");
    expect(pkg.totalUnitsPerBox).toBe(1);
    expect(pkg.hasSubUnits).toBe(false);
  });

  it("calculates proportional tier prices accurately", () => {
    const pkg = parsePharmacyPackaging("10x10"); // 100 tabs
    const prices = calculateTierPrices(1000, pkg);
    expect(prices.boxPrice).toBe(1000);
    expect(prices.stripPrice).toBe(100);
    expect(prices.loosePrice).toBe(10);
  });

  it("formats human-readable UOM breakdowns (boxes + strips + loose)", () => {
    const pkg = parsePharmacyPackaging("10x10", "tab");
    // 124 tabs = 1 box (100) + 2 strips (20) + 4 tabs
    const breakdown = formatUomBreakdown(124, pkg);
    expect(breakdown.boxes).toBe(1);
    expect(breakdown.strips).toBe(2);
    expect(breakdown.loose).toBe(4);
    expect(breakdown.formatted).toBe("1 box + 2 strips + 4 tabs");

    // 15 tabs = 1 strip + 5 tabs
    const partialBreakdown = formatUomBreakdown(15, pkg);
    expect(partialBreakdown.boxes).toBe(0);
    expect(partialBreakdown.strips).toBe(1);
    expect(partialBreakdown.loose).toBe(5);
    expect(partialBreakdown.formatted).toBe("1 strip + 5 tabs");
  });
});

describe("Generic Molecule Equivalent Lookup", () => {
  const dummyProducts: Product[] = [
    {
      id: "prod-1",
      name: "Panadol 500mg",
      category: "Pain & Fever",
      sectorId: "pharmacy",
      condition: "new",
      buyPrice: 3.5,
      sellPrice: 5.0,
      stockQty: 50,
      active: true,
      customFields: { genericName: "Paracetamol", strength: "500mg" },
    },
    {
      id: "prod-2",
      name: "Paramol 500mg",
      category: "Pain & Fever",
      sectorId: "pharmacy",
      condition: "new",
      buyPrice: 3.0,
      sellPrice: 4.5,
      stockQty: 200,
      active: true,
      customFields: { genericName: "Paracetamol", strength: "500mg" },
    },
    {
      id: "prod-3",
      name: "Fevridol 500mg",
      category: "Pain & Fever",
      sectorId: "pharmacy",
      condition: "new",
      buyPrice: 3.2,
      sellPrice: 4.8,
      stockQty: 100,
      active: true,
      customFields: { genericName: "paracetamol", strength: "500mg" },
    },
    {
      id: "prod-4",
      name: "Amoxicillin 500mg",
      category: "Antibiotics",
      sectorId: "pharmacy",
      condition: "new",
      buyPrice: 15.0,
      sellPrice: 22.0,
      stockQty: 80,
      active: true,
      customFields: { genericName: "Amoxicillin", strength: "500mg" },
    },
  ];

  it("finds equivalent products sharing the same active molecule", () => {
    const equivalents = findMoleculeEquivalents(dummyProducts, "Paracetamol", "prod-1");
    expect(equivalents).toHaveLength(2);
    // Highest stock first: Paramol (200) then Fevridol (100)
    expect(equivalents[0].id).toBe("prod-2");
    expect(equivalents[1].id).toBe("prod-3");
  });

  it("is case-insensitive for generic molecules", () => {
    const equivalents = findMoleculeEquivalents(dummyProducts, "PARACETAMOL");
    expect(equivalents).toHaveLength(3);
  });
});

describe("Prescription (Rx) Clinical Intake Validation", () => {
  it("rejects incomplete intake missing Doctor and SLMC", () => {
    const result = validateRxClinicalIntake({ patientName: "Nimal Perera" });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Doctor Name is required for prescription items.");
    expect(result.errors).toContain("Doctor SLMC Registration Number is required.");
  });

  it("validates complete clinical intake", () => {
    const result = validateRxClinicalIntake({
      doctorName: "Dr. K. Perera",
      doctorSlmc: "SLMC-24890",
      patientName: "Nimal Perera",
      patientAge: "45",
      dosageInstructions: "1 TDS x 5 days",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
