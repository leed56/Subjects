import { describe, expect, it } from "vitest";
import {
  catalogNameQualityIssue,
  classifyPharmacyRetailProduct,
  conservativeMediVerifyMatch,
  isPharmacyRetailCandidate,
} from "./quality.mjs";
import { parseHealthguardListingText } from "./healthguard-fallback.mjs";

describe("demo catalog quality guards", () => {
  it("rejects price-only Healthguard pseudo-products", () => {
    const html = `
      <div>- LKR9,999.99</div><div>LKR10,000.00</div>
      <div>B WELL DIGITAL BPM MED 55</div><div>LKR23,300.00</div>`;
    const rows = parseHealthguardListingText(html, "https://www.healthguard.lk/all-products/medical-devices?p=1");
    expect(rows.map((row) => row.productName)).toEqual(["B WELL DIGITAL BPM MED 55"]);
    expect(catalogNameQualityIssue("- LKR9,999.99")).toBe("price_only");
  });

  it("does not classify wheelchair as hair care or floral as oral care", () => {
    expect(classifyPharmacyRetailProduct("WHEEL CHAIR")).toMatchObject({
      department: "Pharmaceutical",
      category: "Medical Devices",
    });
    expect(classifyPharmacyRetailProduct("DISINFECTANT FLORAL 500ML")).toMatchObject({
      department: "Household & Health Convenience",
      category: "Hygiene",
    });
  });

  it("classifies infant formula as Baby Nutrition so lot+FEFO defaults can apply", () => {
    expect(classifyPharmacyRetailProduct("LACTOGEN 2 Infant Formula 350g")).toMatchObject({
      department: "Mother & Baby",
      category: "Baby Nutrition",
      subcategory: "Milk Formula",
    });
    expect(isPharmacyRetailCandidate("SIMILAC Infant Formula 400g")).toBe(true);
    expect(classifyPharmacyRetailProduct("BABY WIPES 80 PCS")).toMatchObject({
      department: "Mother & Baby",
      category: "Baby Care",
    });
  });

  it("rejects obvious grocery cream products from the pharmacy fallback", () => {
    expect(isPharmacyRetailCandidate("ANCHOR Full Cream Milk Powder, 400g")).toBe(false);
    expect(isPharmacyRetailCandidate("MALIBAN Biscuit Custard Cream, 100g")).toBe(true);
    expect(isPharmacyRetailCandidate("NIVEA Face Cream, 50ml")).toBe(true);
    expect(isPharmacyRetailCandidate("ENSURE Vanilla Nutrition Powder, 400g")).toBe(true);
  });

  it("requires brand plus generic identity and compatible strength for regulatory enrichment", () => {
    const valid = {
      brand: "AMLODEP 5",
      genericName: "AMLODIPINE BESYLATE TABLETS USP 5MG",
      registrationNumber: "M014746",
    };
    expect(conservativeMediVerifyMatch(
      { productName: "AMLODIPINE TAB 5MG (AMLODEP 5)(3X10)" },
      [valid],
    )?.registrationNumber).toBe("M014746");

    expect(conservativeMediVerifyMatch(
      { productName: "AMLODIPINE TAB 10MG (AMLODEP 5)(3X10)" },
      [valid],
    )).toBeNull();

    expect(conservativeMediVerifyMatch(
      { productName: "CERVICAL COLLERS (SOFT)" },
      [{ brand: "SOFT", genericName: "AMLODIPINE TABLETS 5MG", registrationNumber: "WRONG" }],
    )).toBeNull();
  });
});
